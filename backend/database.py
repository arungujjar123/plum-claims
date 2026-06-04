"""
Async MongoDB connection and CRUD operations for the Plum claims database.
Uses Motor (async driver for MongoDB).
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# ────────────────────────────────────────────────────────────────
# Connection management
# ────────────────────────────────────────────────────────────────

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> None:
    """Initialise the Motor client and select the database."""
    global _client, _db
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "plum_claims")
    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]

    # Create indexes for fast lookup
    await _db.claims.create_index("claim_id", unique=True)
    await _db.claims.create_index("member_id")
    await _db.claims.create_index("created_at")
    print(f"[OK] Connected to MongoDB: {mongo_url}/{db_name}")


async def close_db() -> None:
    """Gracefully close the Motor client."""
    global _client
    if _client:
        _client.close()
        print("[OK] MongoDB connection closed")


def get_db() -> AsyncIOMotorDatabase:
    """Return the current database handle."""
    if _db is None:
        raise RuntimeError("Database not initialised — call connect_db() first")
    return _db


# ────────────────────────────────────────────────────────────────
# CRUD helpers
# ────────────────────────────────────────────────────────────────

async def insert_claim(claim_doc: dict) -> str:
    """Insert a new claim document. Returns the claim_id."""
    db = get_db()
    claim_doc["created_at"] = datetime.utcnow()
    claim_doc["updated_at"] = datetime.utcnow()
    await db.claims.insert_one(claim_doc)
    return claim_doc["claim_id"]


async def update_claim(claim_id: str, update_fields: dict) -> bool:
    """Update an existing claim document by claim_id."""
    db = get_db()
    update_fields["updated_at"] = datetime.utcnow()
    result = await db.claims.update_one(
        {"claim_id": claim_id},
        {"$set": update_fields},
    )
    return result.modified_count > 0


async def get_claim(claim_id: str) -> Optional[dict]:
    """Retrieve a single claim by its claim_id."""
    db = get_db()
    doc = await db.claims.find_one({"claim_id": claim_id}, {"_id": 0})
    return doc


async def list_claims(skip: int = 0, limit: int = 50) -> tuple[list[dict], int]:
    """
    List claims ordered by creation date (newest first).
    Returns (documents, total_count).
    """
    db = get_db()
    total = await db.claims.count_documents({})
    cursor = (
        db.claims.find({}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return docs, total
