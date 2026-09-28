from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.database.session import get_session
from app.hindsight.client import hindsight_service
from app.models.schemas import HumanCorrection, MemoryReference

router = APIRouter(prefix="/memory", tags=["Memory Explorer"])

@router.get("")
def list_memories(
    service: Optional[str] = None,
    memory_type: Optional[str] = None,
    fingerprint: Optional[str] = None,
    limit: int = 100
):
    memories = hindsight_service.list_all(limit=limit)
    filtered = memories

    if service:
        s_low = service.lower()
        filtered = [m for m in filtered if s_low in [t.lower() for t in m.get("tags", [])] or s_low in m.get("contents", "").lower()]
    if memory_type:
        filtered = [m for m in filtered if m.get("memory_type") == memory_type]
    if fingerprint:
        fp_low = fingerprint.lower()
        filtered = [m for m in filtered if fp_low in [t.lower() for t in m.get("tags", [])] or fp_low in m.get("metadata", {}).get("failure_fingerprint", "").lower()]

    return {
        "status": hindsight_service.get_status(),
        "total": len(filtered),
        "memories": list(reversed(filtered))
    }

@router.get("/similar")
def query_similar_memories(
    query: str = Query(..., description="Search query or failure fingerprint"),
    service: Optional[str] = None,
    limit: int = 5
):
    tags = [service.lower()] if service else []
    results = hindsight_service.recall(query=query, tags=tags, limit=limit)
    return {
        "query": query,
        "results": results
    }

@router.get("/reflect")
def reflect_on_knowledge(
    query: str = Query(..., description="High level question about operational knowledge")
):
    reflection = hindsight_service.reflect(query)
    return {
        "query": query,
        "reflection": reflection
    }

@router.get("/corrections")
def list_corrections(
    fingerprint: Optional[str] = None,
    session: Session = Depends(get_session)
):
    query = select(HumanCorrection).order_by(HumanCorrection.id.desc())
    if fingerprint:
        query = query.where(HumanCorrection.failure_fingerprint == fingerprint)
    return session.exec(query).all()
