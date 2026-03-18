"""
Retailer Models
Retailer accounts, messaging, complaints, and legal compliance
"""
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, Literal, List
from datetime import datetime, timezone
import uuid
import re


# ===================== Base Config for JSON Encoding =====================
class BaseModelWithConfig(BaseModel):
    """Base model with datetime JSON encoding"""
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


# ===================== Helper Functions =====================

def to_title_case(text: str) -> str:
    """Convert text to title case (first letter of each word capitalized)"""
    if not text:
        return text
    return ' '.join(word.capitalize() for word in text.split())


def validate_gst_number(gst: str) -> str:
    """Validate Indian GST Number format"""
    # GST format: 2 digits state code + 10 char PAN + 1 digit entity + Z + 1 check digit
    # Example: 27AAPFU0939F1ZV
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    if not re.match(pattern, gst.upper()):
        raise ValueError('Invalid GST Number format')
    return gst.upper()


# ===================== SPOC (Single Point of Contact) Model =====================

class SPOCDetails(BaseModel):
    """Single Point of Contact details"""
    name: str = Field(..., min_length=2, max_length=100)
    designation: Optional[str] = None
    phone: str = Field(..., min_length=10, max_length=15)
    email: Optional[EmailStr] = None
    date_of_birth: Optional[str] = None  # YYYY-MM-DD format
    anniversary: Optional[str] = None  # YYYY-MM-DD format
    id_proof_type: Optional[Literal['aadhaar', 'pan', 'voter_id', 'passport', 'driving_license']] = None
    id_proof_number: Optional[str] = None
    id_proof_document: Optional[str] = None  # Base64 or URL
    
    @validator('name', pre=True, always=True)
    def title_case_name(cls, v):
        return to_title_case(v) if v else v
    
    @validator('designation', pre=True, always=True)
    def title_case_designation(cls, v):
        return to_title_case(v) if v else v


# ===================== Legal Documents Model =====================

class LegalDocuments(BaseModel):
    """Legal compliance documents"""
    gst_certificate: Optional[str] = None  # Base64 or URL of scanned GST certificate
    gst_certificate_uploaded_at: Optional[datetime] = None
    gst_certificate_valid_until: Optional[str] = None  # Date string
    business_registration: Optional[str] = None  # Base64 or URL
    trade_license: Optional[str] = None  # Base64 or URL
    other_documents: List[dict] = []  # [{name, document_url, uploaded_at}]


# ===================== Retailer Create Model (Admin Only) =====================

class RetailerCreate(BaseModel):
    """Create retailer account - Admin only with full compliance"""
    # Business Details (Mandatory)
    business_name: str = Field(..., min_length=2, max_length=200, description="Registered business name")
    gst_number: str = Field(..., min_length=15, max_length=15, description="GST Number (mandatory)")
    
    # Contact Details
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    whatsapp: Optional[str] = None
    
    # Registered Address
    registered_address: str = Field(..., min_length=10, description="Full registered address as per GST")
    city: str
    district: str
    state: str
    pincode: str = Field(..., pattern=r'^\d{6}$')
    
    # SPOC Details (Mandatory)
    spoc_name: str = Field(..., min_length=2, max_length=100)
    spoc_designation: Optional[str] = None
    spoc_phone: str = Field(..., min_length=10, max_length=15)
    spoc_email: Optional[EmailStr] = None
    spoc_dob: Optional[str] = None  # YYYY-MM-DD
    spoc_anniversary: Optional[str] = None  # YYYY-MM-DD
    
    # Authentication
    password: str = Field(..., min_length=6)
    
    @validator('business_name', 'city', 'district', 'state', 'spoc_name', pre=True, always=True)
    def apply_title_case(cls, v):
        return to_title_case(v) if v else v
    
    @validator('gst_number', pre=True, always=True)
    def validate_gst(cls, v):
        if v:
            return validate_gst_number(v)
        return v


# ===================== Retailer Update Model (Admin Only) =====================

class RetailerUpdate(BaseModel):
    """Update retailer details - Admin only"""
    business_name: Optional[str] = None
    gst_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    registered_address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    
    # SPOC Details
    spoc_name: Optional[str] = None
    spoc_designation: Optional[str] = None
    spoc_phone: Optional[str] = None
    spoc_email: Optional[EmailStr] = None
    spoc_dob: Optional[str] = None
    spoc_anniversary: Optional[str] = None
    spoc_id_proof_type: Optional[str] = None
    spoc_id_proof_number: Optional[str] = None
    
    # Status
    status: Optional[Literal['active', 'suspended', 'deleted']] = None
    suspended_reason: Optional[str] = None
    
    @validator('business_name', 'city', 'district', 'state', 'spoc_name', pre=True, always=True)
    def apply_title_case(cls, v):
        return to_title_case(v) if v else v
    
    @validator('gst_number', pre=True, always=True)
    def validate_gst(cls, v):
        if v:
            return validate_gst_number(v)
        return v


# ===================== Full Retailer Model =====================

class Retailer(BaseModelWithConfig):
    """Complete retailer account with compliance details"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    retailer_id: str = Field(default_factory=lambda: f"RTL_{str(uuid.uuid4())[:8].upper()}")
    
    # Business Details
    business_name: str  # Registered name as per GST
    trade_name: Optional[str] = None  # Display name if different
    gst_number: str  # Mandatory
    gst_state_code: Optional[str] = None  # First 2 digits of GST
    
    # Contact
    email: EmailStr
    phone: str
    whatsapp: Optional[str] = None
    
    # Registered Address (as per GST)
    registered_address: str
    city: str
    district: str
    state: str
    pincode: str
    coordinates: Optional[dict] = None
    
    # SPOC Details
    spoc: Optional[SPOCDetails] = None
    
    # Legal Documents
    legal_documents: Optional[LegalDocuments] = None
    
    # Authentication
    password_hash: str
    
    # Status & Verification
    status: Literal['active', 'suspended', 'pending_verification', 'deleted'] = 'pending_verification'
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    
    # Compliance Flags
    gst_verified: bool = False
    documents_complete: bool = False
    
    # Statistics
    total_orders_handled: int = 0
    total_pickups_completed: int = 0
    total_revenue: float = 0.0
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    suspended_at: Optional[datetime] = None
    suspended_reason: Optional[str] = None
    
    # Audit Trail
    created_by: Optional[str] = None
    last_updated_by: Optional[str] = None


# ===================== Retailer Message Model =====================

class RetailerMessage(BaseModelWithConfig):
    """Inter-retailer communication"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_retailer_id: str
    from_retailer_name: str
    to_retailer_id: str
    to_retailer_name: str
    subject: str
    message: str
    attachment_url: Optional[str] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================== Retailer Complaint Model =====================

class RetailerComplaint(BaseModelWithConfig):
    """Retailer complaint/grievance"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    complaint_id: str = Field(default_factory=lambda: f"CMP-{str(uuid.uuid4())[:8].upper()}")
    retailer_id: str
    retailer_name: str
    retailer_email: EmailStr
    subject: str
    description: str
    category: Literal['order_issue', 'payment', 'product_quality', 'delivery', 'other'] = 'other'
    priority: Literal['low', 'medium', 'high'] = 'medium'
    images: List[str] = []
    status: Literal['open', 'in_progress', 'resolved', 'closed'] = 'open'
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================== Response Models =====================

class RetailerProfileSummary(BaseModel):
    """Summary shown to retailer at login"""
    retailer_id: str
    business_name: str
    gst_number: str
    registered_address: str
    city: str
    state: str
    pincode: str
    spoc_name: Optional[str] = None
    spoc_phone: Optional[str] = None
    email: str
    phone: str
    status: str
    is_verified: bool
    gst_verified: bool
    documents_complete: bool
    gst_certificate_uploaded: bool = False
    spoc_id_uploaded: bool = False
    last_updated: Optional[str] = None
    
    # Alert flags for missing/expiring documents
    alerts: List[str] = []
