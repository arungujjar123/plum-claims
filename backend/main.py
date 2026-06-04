"""
Plum OPD Insurance Claim Adjudication Tool — FastAPI entry point.
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from database import close_db, connect_db, get_claim, insert_claim, list_claims, update_claim
from extractor import extract_claim_data
from models import ClaimListItem, ClaimListResponse, ClaimResponse, DecisionStatus
from rule_engine import load_policy, make_decision

# ────────────────────────────────────────────────────────────────
# Bootstrap
# ────────────────────────────────────────────────────────────────

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    await connect_db()
    # Pre-load the default policy so it fails fast if file is missing
    load_policy("PLUM_OPD_2024")
    print("[OK] Plum Claim Adjudication API is ready")
    yield
    await close_db()


app = FastAPI(
    title="Plum OPD Claim Adjudication API",
    description="AI-powered OPD insurance claim processing using Mistral LLM and a rule-based engine.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the React dev server and any production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────────
# Health
# ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "plum-claims-api"}


# ────────────────────────────────────────────────────────────────
# POST /api/claims — submit a new claim
# ────────────────────────────────────────────────────────────────

@app.post("/api/claims", response_model=ClaimResponse, status_code=201)
async def submit_claim(
    files: list[UploadFile] = File(..., description="Medical documents (PDF/images)"),
    policy_id: str = Form("PLUM_OPD_2024"),
    member_name: str = Form(...),
    member_id: str = Form(...),
):
    """
    Accept uploaded medical documents, run LLM extraction + rule engine,
    persist the result in MongoDB and return the adjudication decision.
    """
    request_id = str(uuid.uuid4())
    claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"

    # Validate files
    if not files:
        raise HTTPException(status_code=400, detail="At least one document file is required.")

    allowed_types = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/tiff",
    }
    for f in files:
        if f.content_type and f.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {f.content_type}. Allowed: PDF, PNG, JPEG, WebP, TIFF.",
            )

    file_names = [f.filename or "unnamed" for f in files]

    # Create initial claim record
    claim_doc = {
        "request_id": request_id,
        "claim_id": claim_id,
        "policy_id": policy_id,
        "member_name": member_name,
        "member_id": member_id,
        "file_names": file_names,
        "extracted_data": None,
        "decision": None,
        "status": "processing",
        "error": None,
    }
    await insert_claim(claim_doc)

    # Step 1: LLM extraction
    try:
        extracted = await extract_claim_data(files)
    except Exception as exc:
        error_msg = f"Document extraction failed: {str(exc)}"
        await update_claim(claim_id, {"status": "error", "error": error_msg})
        raise HTTPException(status_code=422, detail=error_msg)

    # Step 2: Load policy & run rule engine
    try:
        policy = load_policy(policy_id)
    except FileNotFoundError:
        await update_claim(claim_id, {"status": "error", "error": f"Policy '{policy_id}' not found."})
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found.")

    decision = make_decision(extracted, policy, claim_id)

    # Persist final result
    await update_claim(
        claim_id,
        {
            "extracted_data": extracted.model_dump(),
            "decision": decision.model_dump(),
            "status": "completed",
        },
    )

    return ClaimResponse(
        request_id=request_id,
        claim_id=claim_id,
        policy_id=policy_id,
        member_name=member_name,
        member_id=member_id,
        file_names=file_names,
        extracted_data=extracted,
        decision=decision,
        status="completed",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# ────────────────────────────────────────────────────────────────
# GET /api/claims — list all claims
# ────────────────────────────────────────────────────────────────

@app.get("/api/claims", response_model=ClaimListResponse)
async def get_all_claims(skip: int = 0, limit: int = 50):
    """Retrieve a paginated list of all submitted claims."""
    docs, total = await list_claims(skip=skip, limit=limit)

    items: list[ClaimListItem] = []
    for doc in docs:
        decision = doc.get("decision")
        extracted = doc.get("extracted_data")
        items.append(
            ClaimListItem(
                claim_id=doc["claim_id"],
                member_name=doc.get("member_name", ""),
                member_id=doc.get("member_id", ""),
                policy_id=doc.get("policy_id", ""),
                status=doc.get("status", "unknown"),
                decision_status=decision["decision"] if decision else None,
                approved_amount=decision["approved_amount"] if decision else None,
                total_amount=extracted["total_amount"] if extracted else None,
                created_at=doc.get("created_at"),
            )
        )

    return ClaimListResponse(claims=items, total=total)


# ────────────────────────────────────────────────────────────────
# GET /api/claims/{claim_id} — single claim detail
# ────────────────────────────────────────────────────────────────

@app.get("/api/claims/{claim_id}", response_model=ClaimResponse)
async def get_single_claim(claim_id: str):
    """Retrieve full details of a single claim including its decision."""
    doc = await get_claim(claim_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Claim '{claim_id}' not found.")

    return ClaimResponse(
        request_id=doc.get("request_id", ""),
        claim_id=doc["claim_id"],
        policy_id=doc.get("policy_id", ""),
        member_name=doc.get("member_name", ""),
        member_id=doc.get("member_id", ""),
        file_names=doc.get("file_names", []),
        extracted_data=doc.get("extracted_data"),
        decision=doc.get("decision"),
        status=doc.get("status", "unknown"),
        error=doc.get("error"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )
