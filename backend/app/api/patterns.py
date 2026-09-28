from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.database.session import get_session
from app.models.schemas import FailurePattern

router = APIRouter(prefix="/failure-patterns", tags=["Failure Patterns"])

@router.get("", response_model=List[FailurePattern])
def list_failure_patterns(session: Session = Depends(get_session)):
    return session.exec(select(FailurePattern).order_by(FailurePattern.occurrence_count.desc())).all()
