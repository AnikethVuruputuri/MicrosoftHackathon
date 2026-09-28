import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from cryptography.fernet import Fernet
from app.config import settings

# Derive a Fernet key safely from settings.ENCRYPTION_KEY or a fixed fallback
def _get_fernet() -> Fernet:
    try:
        raw_key = settings.ENCRYPTION_KEY.encode()
        if len(raw_key) == 44:
            return Fernet(raw_key)
    except Exception:
        pass
    # Generate deterministic 32-byte urlsafe base64 key from secret
    derived = base64.urlsafe_b64encode(hashlib.sha256(settings.JWT_SECRET.encode()).digest())
    return Fernet(derived)

_cipher = _get_fernet()

def encrypt_secret(plain_text: Optional[str]) -> Optional[str]:
    if not plain_text:
        return None
    try:
        return _cipher.encrypt(plain_text.encode()).decode()
    except Exception:
        return plain_text

def decrypt_secret(cipher_text: Optional[str]) -> Optional[str]:
    if not cipher_text:
        return None
    try:
        return _cipher.decrypt(cipher_text.encode()).decode()
    except Exception:
        return cipher_text

def hash_password(password: str) -> str:
    # Use sha256 with salt for simplicity and cross-platform reliability
    salt = settings.JWT_SECRET[:16]
    return hashlib.sha256((password + salt).encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except Exception:
        return None
