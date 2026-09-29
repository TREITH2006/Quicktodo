import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash


BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(BACKEND_ENV_FILE)

password_hash = PasswordHash.recommended()

SECRET_KEY = os.getenv("QUICKTODO_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        f"QUICKTODO_SECRET_KEY is missing. Add it to: {BACKEND_ENV_FILE}"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])