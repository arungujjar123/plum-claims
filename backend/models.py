"""
Pydantic models for the Plum OPD Insurance Claim Adjudication Tool.
Defines schemas for claims, decisions, and API responses.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ────────────────────────────────────────────────────────────────
# Enums
# ────────────────────────────────────────────────────────────────

class DecisionStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PARTIAL = "PARTIAL"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class TreatmentType(str, Enum):
    CONSULTATION = "consultation"
    PHARMACY = "pharmacy"
    DIAGNOSTIC = "diagnostic"
    DENTAL = "dental"
    VISION = "vision"
    ALTERNATIVE = "alternative"


# ────────────────────────────────────────────────────────────────
# Extracted data models  (output from LLM)
# ────────────────────────────────────────────────────────────────

class BillItem(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None


class DocumentsPresent(BaseModel):
    prescription: bool = False
    bill: bool = False
    test_reports: bool = False


class ExtractedClaimData(BaseModel):
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    treatment_date: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_registration_number: Optional[str] = None
    hospital_name: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment_type: Optional[str] = None
    medicines_prescribed: list[str] = Field(default_factory=list)
    tests_ordered: list[str] = Field(default_factory=list)
    total_amount: Optional[float] = None
    bill_items: list[BillItem] = Field(default_factory=list)
    documents_present: DocumentsPresent = Field(default_factory=DocumentsPresent)
    extraction_confidence: float = 0.0
    extraction_notes: Optional[str] = None


# ────────────────────────────────────────────────────────────────
# Decision model  (output from rule engine)
# ────────────────────────────────────────────────────────────────

class Decision(BaseModel):
    claim_id: str
    decision: DecisionStatus
    approved_amount: float = 0.0
    rejection_reasons: list[str] = Field(default_factory=list)
    confidence_score: float = 0.0
    copay_applied: float = 0.0
    notes: str = ""
    next_steps: str = ""


# ────────────────────────────────────────────────────────────────
# Claim document  (stored in MongoDB)
# ────────────────────────────────────────────────────────────────

class ClaimDocument(BaseModel):
    request_id: str
    claim_id: str
    policy_id: str
    member_name: str
    member_id: str
    file_names: list[str] = Field(default_factory=list)
    extracted_data: Optional[ExtractedClaimData] = None
    decision: Optional[Decision] = None
    status: str = "processing"
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ────────────────────────────────────────────────────────────────
# API response models
# ────────────────────────────────────────────────────────────────

class ClaimResponse(BaseModel):
    request_id: str
    claim_id: str
    policy_id: str
    member_name: str
    member_id: str
    file_names: list[str] = Field(default_factory=list)
    extracted_data: Optional[ExtractedClaimData] = None
    decision: Optional[Decision] = None
    status: str
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ClaimListItem(BaseModel):
    claim_id: str
    member_name: str
    member_id: str
    policy_id: str
    status: str
    decision_status: Optional[str] = None
    approved_amount: Optional[float] = None
    total_amount: Optional[float] = None
    created_at: Optional[datetime] = None


class ClaimListResponse(BaseModel):
    claims: list[ClaimListItem]
    total: int
