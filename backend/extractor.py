"""
LLM-based medical document data extractor.
Uses Mistral (Pixtral) for document/image analysis.
Supports PDF (auto-converted to images) and direct image uploads.
"""

from __future__ import annotations

import base64
import io
import json
import mimetypes
import os
import re
from typing import Any

from fastapi import UploadFile

from models import ExtractedClaimData

# ────────────────────────────────────────────────────────────────
# System prompt for the LLM
# ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a medical document analyzer for an insurance company. \
Extract the following fields from the provided medical documents and \
return ONLY a valid JSON object with no explanation:
{
  "patient_name": "string",
  "patient_age": 0,
  "treatment_date": "YYYY-MM-DD",
  "doctor_name": "string",
  "doctor_registration_number": "string",
  "hospital_name": "string",
  "diagnosis": "string",
  "treatment_type": "consultation/pharmacy/diagnostic/dental/vision/alternative",
  "medicines_prescribed": ["string"],
  "tests_ordered": ["string"],
  "total_amount": 0,
  "bill_items": [{"description": "string", "amount": 0}],
  "documents_present": {
    "prescription": true,
    "bill": true,
    "test_reports": false
  },
  "extraction_confidence": 0.95,
  "extraction_notes": "string"
}
If any field is not found, use null. Be precise with amounts."""


USER_PROMPT = (
    "Analyze the above medical documents and extract structured "
    "data as specified. Return ONLY a valid JSON object."
)


# ────────────────────────────────────────────────────────────────
# Helper utilities
# ────────────────────────────────────────────────────────────────

def _guess_media_type(filename: str) -> str:
    """Return a MIME type suitable for vision APIs."""
    mime, _ = mimetypes.guess_type(filename)
    if mime and mime.startswith("image/"):
        return mime
    if filename.lower().endswith(".pdf"):
        return "application/pdf"
    return "image/png"  # fallback


async def _read_file_bytes(file: UploadFile) -> tuple[bytes, str]:
    """Read an UploadFile and return (raw_bytes, media_type)."""
    content = await file.read()
    media_type = _guess_media_type(file.filename or "unknown.png")
    return content, media_type

def _convert_pdf_to_images(raw_bytes: bytes) -> list[tuple[bytes, str]]:
    """Convert each page of a PDF to a PNG image."""
    from pdf2image import convert_from_bytes
    import io

    # Windows pe poppler ka exact path do
    poppler_path = r"C:\Users\hp pc\Downloads\Release-26.02.0-0\poppler-26.02.0\Library\bin"

    images = convert_from_bytes(raw_bytes, dpi=200, poppler_path=poppler_path)
    result: list[tuple[bytes, str]] = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        result.append((buf.getvalue(), "image/png"))
    return result

def _parse_llm_json(raw_text: str) -> dict:
    """Strip markdown fencing and parse JSON from LLM output."""
    text = raw_text.strip()

    # Strip ```json ... ``` fencing
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"LLM returned invalid JSON: {exc}\n\nRaw response:\n{raw_text}"
        ) from exc


# ────────────────────────────────────────────────────────────────
# Mistral extractor  (PRIMARY)
# ────────────────────────────────────────────────────────────────

async def _extract_with_mistral(file_data: list[tuple[bytes, str]]) -> dict:
    """Use Mistral Pixtral for document extraction."""
    from mistralai import Mistral

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not set")

    model_name = os.getenv("MISTRAL_MODEL", "pixtral-12b-2409")
    client = Mistral(api_key=api_key)

    content_blocks: list[dict[str, Any]] = []

    for raw_bytes, media_type in file_data:
        if media_type == "application/pdf":
            # ── PDF: convert each page to PNG image ──────────────
            try:
                image_pages = _convert_pdf_to_images(raw_bytes)
            except Exception as exc:
                raise RuntimeError(
                    "PDF to image conversion failed. "
                    "Make sure poppler-utils is installed: "
                    "sudo apt-get install poppler-utils"
                ) from exc

            for img_bytes, img_type in image_pages:
                b64 = base64.standard_b64encode(img_bytes).decode("utf-8")
                content_blocks.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{img_type};base64,{b64}"},
                })
        else:
            # ── Image: send directly ──────────────────────────────
            b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
            content_blocks.append({
                "type": "image_url",
                "image_url": {"url": f"data:{media_type};base64,{b64}"},
            })

    content_blocks.append({"type": "text", "text": USER_PROMPT})

    response = client.chat.complete(
        model=model_name,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content_blocks},
        ],
        max_tokens=4096,
        temperature=0.1,
    )

    return _parse_llm_json(response.choices[0].message.content or "")


# ────────────────────────────────────────────────────────────────
# Public API
# ────────────────────────────────────────────────────────────────

async def extract_claim_data(files: list[UploadFile]) -> ExtractedClaimData:
    """
    Send uploaded medical documents to Mistral Pixtral and extract
    structured claim data.

    - PDFs are auto-converted to images (one image per page).
    - Images (PNG, JPG, WebP, TIFF) are sent directly.

    Raises:
        RuntimeError: if extraction fails.
    """
    file_data: list[tuple[bytes, str]] = []
    for file in files:
        raw_bytes, media_type = await _read_file_bytes(file)
        file_data.append((raw_bytes, media_type))

    try:
        data = await _extract_with_mistral(file_data)
        return ExtractedClaimData(**data)
    except Exception as exc:
        raise RuntimeError(
            f"Mistral extraction failed: {exc}"
        ) from exc