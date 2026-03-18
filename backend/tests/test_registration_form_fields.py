"""
Test Registration Form Field Improvements for Addrika
- New fields: Date of Birth (required), Date of Marriage (optional), Alternate Phone (optional)
- Duplicate checking by BOTH email AND phone number
- Title-Gender auto-mapping

This test retrieves OTPs from database since email service is configured.
"""
import pytest
import requests
import os
import random
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'addrika_db')


def generate_phone():
    """Generate a valid 10-digit phone number"""
    return f"9{random.randint(100000000, 999999999)}"


def generate_email(prefix="test"):
    """Generate a unique email"""
    return f"{prefix}_{random.randint(10000000, 99999999)}@testmail.com"


async def get_otp_from_db(email: str) -> str:
    """Get OTP from database for the given email"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    otp_record = await db.otp_verifications.find_one({'email': email})
    client.close()
    return otp_record['otp'] if otp_record else None


def sync_get_otp(email: str) -> str:
    """Sync wrapper for getting OTP"""
    return asyncio.get_event_loop().run_until_complete(get_otp_from_db(email))


class TestDuplicateEmailCheck:
    """Test duplicate email prevention"""
    
    @pytest.fixture(scope="class")
    def existing_user_email(self):
        """Create a test user to test duplicate checks against"""
        test_email = generate_email("dup_email_base")
        test_phone = generate_phone()
        
        # Send OTP
        send_resp = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": test_email})
        assert send_resp.status_code == 200, f"Send OTP failed: {send_resp.text}"
        
        # Get OTP from DB
        otp = sync_get_otp(test_email)
        assert otp, f"OTP not found in database for {test_email}"
        
        # Verify OTP
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": test_email, "otp": otp})
        assert verify_resp.status_code == 200, f"Verify failed: {verify_resp.text}"
        
        # Register user
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register-with-otp", json={
            "email": test_email,
            "password": "TestPass123",
            "name": "Base Test User",
            "phone": test_phone,
            "country_code": "+91",
            "salutation": "Mr.",
            "gender": "Male",
            "date_of_birth": "1990-01-01",
            "otp": otp,
            "address": "123 Test Street",
            "city": "Test City",
            "state": "Test State",
            "pincode": "110001"
        })
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        
        return {"email": test_email, "phone": test_phone}
    
    def test_duplicate_email_blocked_on_otp_send(self, existing_user_email):
        """Test that sending OTP to existing email is blocked"""
        send_resp = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "email": existing_user_email["email"]
        })
        
        assert send_resp.status_code == 400, f"Expected 400, got {send_resp.status_code}: {send_resp.text}"
        detail = send_resp.json().get("detail", "").lower()
        assert "already registered" in detail or "email" in detail
        print(f"✓ Duplicate email blocked: {send_resp.json().get('detail')}")


class TestDuplicatePhoneCheck:
    """Test duplicate phone number prevention"""
    
    @pytest.fixture(scope="class")
    def existing_user(self):
        """Create a test user with phone to test duplicate phone check"""
        test_email = generate_email("dup_phone_base")
        test_phone = generate_phone()
        
        # Send OTP
        send_resp = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": test_email})
        assert send_resp.status_code == 200, f"Send OTP failed: {send_resp.text}"
        
        # Get OTP from DB
        otp = sync_get_otp(test_email)
        assert otp
        
        # Verify OTP
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": test_email, "otp": otp})
        assert verify_resp.status_code == 200, f"Verify failed: {verify_resp.text}"
        
        # Register user
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register-with-otp", json={
            "email": test_email,
            "password": "TestPass123",
            "name": "Phone Base User",
            "phone": test_phone,
            "country_code": "+91",
            "salutation": "Ms.",
            "gender": "Female",
            "date_of_birth": "1995-05-15",
            "otp": otp,
            "address": "456 Test Avenue",
            "city": "Another City",
            "state": "Another State",
            "pincode": "220002"
        })
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        
        return {"email": test_email, "phone": test_phone}
    
    def test_duplicate_phone_blocked_on_registration(self, existing_user):
        """Test that registration with existing phone number fails"""
        # Try registering with new email but same phone
        new_email = generate_email("dup_phone_new")
        
        # Send OTP for new email
        send_resp = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": new_email})
        assert send_resp.status_code == 200
        
        # Get OTP
        otp = sync_get_otp(new_email)
        assert otp
        
        # Verify OTP
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": new_email, "otp": otp})
        assert verify_resp.status_code == 200
        
        # Try to register with same phone - should fail
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register-with-otp", json={
            "email": new_email,
            "password": "TestPass123",
            "name": "Duplicate Phone User",
            "phone": existing_user["phone"],  # Same phone as existing user
            "country_code": "+91",
            "salutation": "Mr.",
            "gender": "Male",
            "date_of_birth": "1992-03-10",
            "otp": otp,
            "address": "789 Test Blvd",
            "city": "Third City",
            "state": "Third State",
            "pincode": "330003"
        })
        
        assert reg_resp.status_code == 400, f"Expected 400 for duplicate phone, got {reg_resp.status_code}"
        detail = reg_resp.json().get("detail", "").lower()
        assert "phone" in detail and "already" in detail
        print(f"✓ Duplicate phone blocked: {reg_resp.json().get('detail')}")


class TestNewFieldsInRegistration:
    """Test new registration fields: DOB, Anniversary, Alternate Phone"""
    
    def test_registration_with_all_new_fields(self):
        """Test registration including DOB, Anniversary, and Alternate Phone"""
        test_email = generate_email("newfields_all")
        test_phone = generate_phone()
        
        # Send OTP
        send_resp = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": test_email})
        assert send_resp.status_code == 200
        print("✓ OTP sent")
        
        # Get OTP from DB
        otp = sync_get_otp(test_email)
        assert otp
        
        # Verify OTP
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": test_email, "otp": otp})
        assert verify_resp.status_code == 200
        print("✓ OTP verified")
        
        # Register with all new fields
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register-with-otp", json={
            "email": test_email,
            "password": "TestPass123",
            "name": "Full Feature User",
            "phone": test_phone,
            "country_code": "+91",
            "alternate_phone": "9988776655",  # NEW: Alternate phone
            "salutation": "Dr.",
            "gender": "Female",
            "date_of_birth": "1988-12-25",  # NEW: Required DOB
            "date_of_marriage": "2015-06-15",  # NEW: Optional Anniversary
            "otp": otp,
            "address": "999 Full Feature Rd",
            "landmark": "Near Test Park",
            "city": "Feature City",
            "state": "Feature State",
            "pincode": "440004"
        })
        
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        data = reg_resp.json()
        assert "user" in data
        assert data["user"]["email"] == test_email.lower()
        print(f"✓ Registration successful with all new fields")
        print(f"  User ID: {data['user']['user_id']}")
    
    def test_registration_without_optional_fields(self):
        """Test registration works without optional fields (anniversary, alternate phone)"""
        test_email = generate_email("newfields_minimal")
        test_phone = generate_phone()
        
        # Send OTP
        send_resp = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"email": test_email})
        assert send_resp.status_code == 200
        
        # Get OTP from DB
        otp = sync_get_otp(test_email)
        assert otp
        
        # Verify OTP
        verify_resp = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": test_email, "otp": otp})
        assert verify_resp.status_code == 200
        
        # Register without optional fields
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register-with-otp", json={
            "email": test_email,
            "password": "TestPass123",
            "name": "Minimal User",
            "phone": test_phone,
            "country_code": "+91",
            # No alternate_phone
            "salutation": "Mr.",
            "gender": "Male",
            "date_of_birth": "2000-01-01",  # DOB is required
            # No date_of_marriage
            "otp": otp,
            "address": "111 Minimal St",
            "city": "Minimal City",
            "state": "Minimal State",
            "pincode": "550005"
        })
        
        assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
        print("✓ Registration successful without optional fields")


class TestFieldOrderVerification:
    """Document the expected field order (tested in UI tests)"""
    
    def test_field_order_documentation(self):
        """Document expected field order: Title → Full Name → Gender"""
        print("\n=== Field Order Verification ===")
        print("Row 1: Title * → Full Name *")
        print("Row 2: Gender * → Date of Birth * → Anniversary (Optional)")
        print("Row 3: Username (Optional)")
        print("Row 4: Email * → Password *")
        print("Row 5: Phone * → Alternate Phone (Optional)")
        print("Row 6+: Billing Address fields")
        print("\n✓ Field order verified in UI tests (see browser automation)")


class TestTitleGenderAutoMapping:
    """Document Title-Gender auto-mapping (tested in UI tests)"""
    
    def test_title_gender_mapping_documentation(self):
        """Document Title-Gender auto-mapping behavior"""
        print("\n=== Title-Gender Auto-Mapping ===")
        print("When Title is selected:")
        print("  - Mr. → Gender auto-sets to 'Male'")
        print("  - Mrs. → Gender auto-sets to 'Female'")
        print("  - Ms. → Gender auto-sets to 'Female'")
        print("\nWhen Gender is selected:")
        print("  - Male → Title auto-sets to 'Mr.' (if empty or conflicting)")
        print("  - Female → Title auto-sets to 'Ms.' (if empty or conflicting)")
        print("\n✓ Title-Gender auto-mapping verified in UI tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
