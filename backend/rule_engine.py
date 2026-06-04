"""
Rule Engine for OPD claim adjudication.
Loads policy terms and runs a sequential pipeline of checks to produce
an APPROVED / REJECTED / PARTIAL / MANUAL_REVIEW decision.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from models import DecisionStatus, Decision, ExtractedClaimData

# ────────────────────────────────────────────────────────────────
# Policy loader
# ────────────────────────────────────────────────────────────────

_policy_cache: dict[str, dict] = {}

POLICY_FILE = Path(__file__).parent / "data" / "policy_terms.json"


def load_policy(policy_id: str = "PLUM_OPD_2024") -> dict:
    """Load and cache policy terms from the JSON file."""
    if policy_id in _policy_cache:
        return _policy_cache[policy_id]

    if not POLICY_FILE.exists():
        raise FileNotFoundError(f"Policy file not found: {POLICY_FILE}")

    with open(POLICY_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    _policy_cache[data["policy_id"]] = data
    return data


# ────────────────────────────────────────────────────────────────
# Internal check result container
# ────────────────────────────────────────────────────────────────

@dataclass
class CheckResult:
    passed: bool = True
    decision: Optional[DecisionStatus] = None
    rejection_reasons: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    capped_amount: Optional[float] = None  # set when PARTIAL


# ────────────────────────────────────────────────────────────────
# 1. Document checks
# ────────────────────────────────────────────────────────────────

def check_documents(extracted: ExtractedClaimData) -> CheckResult:
    """Validate that required supporting documents are present."""
    result = CheckResult()
    docs = extracted.documents_present

    if not docs.prescription:
        result.passed = False
        result.decision = DecisionStatus.REJECTED
        result.rejection_reasons.append("INVALID_PRESCRIPTION: No valid prescription found in uploaded documents.")

    if not docs.bill:
        result.passed = False
        result.decision = DecisionStatus.REJECTED
        result.rejection_reasons.append("MISSING_DOCUMENTS: Medical bill/invoice is missing.")

    if not extracted.doctor_registration_number:
        result.passed = False
        result.decision = DecisionStatus.REJECTED
        result.rejection_reasons.append("DOCTOR_REG_INVALID: Doctor registration number is missing or invalid.")

    return result


# ────────────────────────────────────────────────────────────────
# 2. Coverage checks
# ────────────────────────────────────────────────────────────────

def check_coverage(extracted: ExtractedClaimData, policy: dict) -> CheckResult:
    """Check whether the treatment type is covered and not excluded."""
    result = CheckResult()
    coverage = policy.get("coverage_details", {})
    treatment = (extracted.treatment_type or "").lower().strip()

    # Treatment type coverage
    if treatment not in coverage:
        result.passed = False
        result.decision = DecisionStatus.REJECTED
        result.rejection_reasons.append(
            f"SERVICE_NOT_COVERED: Treatment type '{treatment}' is not recognized under this policy."
        )
        return result

    category = coverage[treatment]
    if not category.get("covered", False):
        result.passed = False
        result.decision = DecisionStatus.REJECTED
        result.rejection_reasons.append(
            f"SERVICE_NOT_COVERED: Treatment type '{treatment}' is not covered under policy {policy['policy_id']}."
        )
        return result

    # Exclusions check
    exclusions = policy.get("exclusions", [])
    diagnosis = (extracted.diagnosis or "").lower()
    for excl in exclusions:
        if excl.lower() in diagnosis:
            result.passed = False
            result.decision = DecisionStatus.REJECTED
            result.rejection_reasons.append(
                f"EXCLUDED_CONDITION: Diagnosis '{extracted.diagnosis}' matches excluded condition '{excl}'."
            )
            return result

    return result


# ────────────────────────────────────────────────────────────────
# 3. Limits checks
# ────────────────────────────────────────────────────────────────

def check_limits(extracted: ExtractedClaimData, policy: dict) -> CheckResult:
    """Check claim amount against policy limits and sub-limits."""
    result = CheckResult()
    total = extracted.total_amount or 0
    coverage = policy.get("coverage_details", {})
    requirements = policy.get("claim_requirements", {})
    treatment = (extracted.treatment_type or "").lower().strip()

    min_amount = requirements.get("minimum_claim_amount", 0)
    per_claim_limit = coverage.get("per_claim_limit", float("inf"))

    # Below minimum
    if total < min_amount:
        result.passed = False
        result.decision = DecisionStatus.REJECTED
        result.rejection_reasons.append(
            f"BELOW_MIN_AMOUNT: Claim amount ₹{total} is below the minimum claim amount of ₹{min_amount}."
        )
        return result

    effective_amount = total

    # Per-claim cap
    if total > per_claim_limit:
        effective_amount = per_claim_limit
        result.decision = DecisionStatus.PARTIAL
        result.notes.append(
            f"Amount capped at per-claim limit of ₹{per_claim_limit} (original: ₹{total})."
        )

    # Sub-limit check
    if treatment in coverage:
        sub_limit = coverage[treatment].get("sub_limit", float("inf"))
        if effective_amount > sub_limit:
            effective_amount = sub_limit
            result.decision = DecisionStatus.PARTIAL
            result.notes.append(
                f"Amount capped at '{treatment}' sub-limit of ₹{sub_limit}."
            )

    if result.decision == DecisionStatus.PARTIAL:
        result.capped_amount = effective_amount

    return result


# ────────────────────────────────────────────────────────────────
# 4. Copay calculation
# ────────────────────────────────────────────────────────────────

def calculate_copay(
    extracted: ExtractedClaimData,
    policy: dict,
    effective_amount: Optional[float] = None,
) -> tuple[float, float]:
    """
    Calculate the approved amount after copay.
    Returns (approved_amount, copay_percentage).
    """
    coverage = policy.get("coverage_details", {})
    treatment = (extracted.treatment_type or "").lower().strip()
    base_amount = effective_amount if effective_amount is not None else (extracted.total_amount or 0)

    copay_pct = 0.0
    if treatment in coverage:
        copay_pct = coverage[treatment].get("copay_percentage", 0)

    approved = round(base_amount * (1 - copay_pct / 100), 2)
    return approved, copay_pct


# ────────────────────────────────────────────────────────────────
# 5. Manual review flag
# ────────────────────────────────────────────────────────────────

def check_manual_review(extracted: ExtractedClaimData, approved_amount: float) -> bool:
    """Return True if the claim should be routed to manual review."""
    if approved_amount > 25000:
        return True
    if extracted.extraction_confidence < 0.7:
        return True
    return False


# ────────────────────────────────────────────────────────────────
# 6. Master decision pipeline
# ────────────────────────────────────────────────────────────────

def make_decision(extracted: ExtractedClaimData, policy: dict, claim_id: str) -> Decision:
    """
    Run all checks sequentially and return the final adjudication decision.
    """
    all_rejection_reasons: list[str] = []
    all_notes: list[str] = []
    final_status = DecisionStatus.APPROVED
    approved_amount = extracted.total_amount or 0
    copay_pct = 0.0

    # --- Step 1: Documents ---
    doc_result = check_documents(extracted)
    if not doc_result.passed:
        all_rejection_reasons.extend(doc_result.rejection_reasons)
        return Decision(
            claim_id=claim_id,
            decision=DecisionStatus.REJECTED,
            approved_amount=0,
            rejection_reasons=all_rejection_reasons,
            confidence_score=extracted.extraction_confidence,
            copay_applied=0,
            notes="Claim rejected due to missing or invalid documents.",
            next_steps="Please re-submit with all required documents: a valid prescription and itemised medical bill.",
        )

    # --- Step 2: Coverage ---
    cov_result = check_coverage(extracted, policy)
    if not cov_result.passed:
        all_rejection_reasons.extend(cov_result.rejection_reasons)
        return Decision(
            claim_id=claim_id,
            decision=DecisionStatus.REJECTED,
            approved_amount=0,
            rejection_reasons=all_rejection_reasons,
            confidence_score=extracted.extraction_confidence,
            copay_applied=0,
            notes="Claim rejected due to coverage restrictions.",
            next_steps="Review your policy coverage details or contact Plum support for clarification.",
        )

    # --- Step 3: Limits ---
    lim_result = check_limits(extracted, policy)
    if not lim_result.passed:
        all_rejection_reasons.extend(lim_result.rejection_reasons)
        return Decision(
            claim_id=claim_id,
            decision=DecisionStatus.REJECTED,
            approved_amount=0,
            rejection_reasons=all_rejection_reasons,
            confidence_score=extracted.extraction_confidence,
            copay_applied=0,
            notes="Claim rejected due to amount limits.",
            next_steps="Ensure your claim amount meets the minimum requirement.",
        )

    effective_amount = lim_result.capped_amount if lim_result.capped_amount else (extracted.total_amount or 0)
    if lim_result.decision == DecisionStatus.PARTIAL:
        final_status = DecisionStatus.PARTIAL
        all_notes.extend(lim_result.notes)

    # --- Step 4: Copay ---
    approved_amount, copay_pct = calculate_copay(extracted, policy, effective_amount)
    all_notes.append(f"Copay of {copay_pct}% applied.")

    # --- Step 5: Manual review ---
    if check_manual_review(extracted, approved_amount):
        final_status = DecisionStatus.MANUAL_REVIEW
        all_notes.append("Routed for manual review based on amount/confidence thresholds.")

    # Build next-steps text
    next_steps_map = {
        DecisionStatus.APPROVED: "Your claim has been approved. The approved amount will be processed within 3-5 business days.",
        DecisionStatus.PARTIAL: "Your claim has been partially approved due to policy limits. The approved amount will be processed within 3-5 business days.",
        DecisionStatus.MANUAL_REVIEW: "Your claim has been flagged for manual review by our claims team. You will receive an update within 48 hours.",
    }

    return Decision(
        claim_id=claim_id,
        decision=final_status,
        approved_amount=approved_amount,
        rejection_reasons=all_rejection_reasons,
        confidence_score=extracted.extraction_confidence,
        copay_applied=copay_pct,
        notes=" | ".join(all_notes),
        next_steps=next_steps_map.get(final_status, ""),
    )
