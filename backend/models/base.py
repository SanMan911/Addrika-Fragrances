"""
Base Models and Shared Configurations
"""
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid


class BaseModelWithConfig(BaseModel):
    """Base model with datetime JSON encoding"""
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


def generate_uuid() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)
