from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlmodel import Session, select
from typing import Optional
from app.database.session import get_session
from app.models.schemas import (
    User,
    Organization,
    UserLoginRequest,
    UserRegisterRequest,
    AuthResponse
)
from app.services.security import verify_password, hash_password, create_access_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["Authentication & Organizations"])

def get_current_user(
    authorization: Optional[str] = Header(None),
    session: Session = Depends(get_session)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        # Return default admin user for zero-barrier demo mode
        user = session.exec(select(User)).first()
        if user:
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = session.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

@router.post("/register", response_model=AuthResponse)
def register(req: UserRegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == req.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    slug = req.org_name.lower().replace(" ", "-")
    org = session.exec(select(Organization).where(Organization.slug == slug)).first()
    if not org:
        org = Organization(name=req.org_name, slug=slug, hindsight_bank_id=f"opsmemory-{slug}")
        session.add(org)
        session.commit()
        session.refresh(org)

    user = User(
        org_id=org.id,
        name=req.name,
        email=req.email,
        hashed_password=hash_password(req.password),
        role="admin"
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token({"sub": user.id, "org_id": org.id, "email": user.email})
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        organization={"id": org.id, "name": org.name, "slug": org.slug, "bank_id": org.hindsight_bank_id}
    )

@router.post("/login", response_model=AuthResponse)
def login(req: UserLoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == req.email)).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    org = session.get(Organization, user.org_id)
    token = create_access_token({"sub": user.id, "org_id": user.org_id, "email": user.email})
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        organization={"id": org.id, "name": org.name, "slug": org.slug, "bank_id": org.hindsight_bank_id} if org else {}
    )

@router.get("/me")
def get_me(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    org = session.get(Organization, user.org_id)
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        "organization": {"id": org.id, "name": org.name, "slug": org.slug, "bank_id": org.hindsight_bank_id} if org else {}
    }
