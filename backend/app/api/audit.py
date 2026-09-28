from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.database.session import get_session
from app.models.schemas import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("", response_model=List[AuditLog])
def list_audit_logs(
    resource_type: Optional[str] = None,
    limit: int = 50,
    session: Session = Depends(get_session)
):
    query = select(AuditLog).order_by(AuditLog.id.desc())
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    return session.exec(query.limit(limit)).all()
