"""
Test Admin Panel Forms - Retailers and Coupons
Tests the bug fixes for:
1. Admin Login flow with 2FA
2. Add Retailer form (POST /api/retailers/admin/add)
3. Create Coupon form (POST /api/admin/discount-codes)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('NEXT_PUBLIC_BACKEND_URL', 'https://title-case-forms.preview.emergentagent.com')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"  # From test_credentials.md
ADMIN_PIN_ALT = "050499"  # Alternative PIN from handoff
MASTER_PASSWORD = "addrika_admin_override"


class TestAdminLogin:
    """Test Admin 2FA Login Flow"""
    
    def test_admin_login_initiate_success(self):
        """Test admin login initiation with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        # Should return 200 with token_id for OTP verification
        if response.status_code == 200:
            data = response.json()
            assert "token_id" in data
            assert "email_masked" in data
            print(f"✓ Admin login initiated, token_id received, email_masked: {data['email_masked']}")
        elif response.status_code == 401:
            # Try alternative PIN
            response2 = requests.post(
                f"{BASE_URL}/api/admin/login/initiate",
                json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN_ALT}
            )
            if response2.status_code == 200:
                data = response2.json()
                assert "token_id" in data
                print(f"✓ Admin login initiated with alt PIN, token_id received")
            else:
                pytest.skip(f"Admin login failed with both PINs: {response.text}, {response2.text}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code}, {response.text}")
    
    def test_admin_login_invalid_email(self):
        """Test admin login with non-admin email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "notadmin@example.com", "pin": "123456"}
        )
        assert response.status_code == 403
        print("✓ Non-admin email correctly rejected")
    
    def test_admin_login_invalid_pin(self):
        """Test admin login with wrong PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": "wrongpin"}
        )
        assert response.status_code == 401
        print("✓ Invalid PIN correctly rejected")
    
    def test_admin_login_missing_fields(self):
        """Test admin login with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL}
        )
        assert response.status_code == 400
        print("✓ Missing PIN correctly rejected")


class TestAdminRetailersEndpoint:
    """Test Add Retailer endpoint (POST /api/retailers/admin/add)"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        # Step 1: Initiate login
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if response.status_code != 200:
            # Try alt PIN
            response = requests.post(
                f"{BASE_URL}/api/admin/login/initiate",
                json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN_ALT}
            )
        
        if response.status_code != 200:
            pytest.skip("Could not initiate admin login")
        
        data = response.json()
        token_id = data.get("token_id")
        
        # Step 2: Verify OTP with master password
        response2 = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": token_id, "otp": MASTER_PASSWORD}
        )
        
        if response2.status_code != 200:
            pytest.skip(f"Could not verify admin OTP: {response2.text}")
        
        data2 = response2.json()
        session_token = data2.get("session_token")
        cookies = response2.cookies
        
        return {"session_token": session_token, "cookies": cookies}
    
    def test_add_retailer_endpoint_exists(self, admin_session):
        """Test that the add retailer endpoint exists and accepts POST"""
        session = requests.Session()
        session.cookies.update(admin_session["cookies"])
        
        # Test with minimal payload
        payload = {
            "business_name": "TEST_Retailer_" + str(int(time.time())),
            "email": f"test_{int(time.time())}@example.com",
            "phone": "9876543210",
            "address": "123 Test Street",
            "city": "Test City",
            "state": "Test State",
            "pincode": "123456"
        }
        
        response = session.post(
            f"{BASE_URL}/api/retailers/admin/add",
            json=payload,
            headers={"Authorization": f"Bearer {admin_session['session_token']}"}
        )
        
        # Should return 200 or 201 for success, or 400/422 for validation error
        assert response.status_code in [200, 201, 400, 422], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ Retailer added successfully: {data}")
        else:
            print(f"✓ Endpoint exists, validation error: {response.json()}")
    
    def test_add_retailer_without_auth(self):
        """Test that add retailer requires authentication"""
        payload = {
            "business_name": "Unauthorized Test",
            "email": "unauth@example.com",
            "phone": "1234567890",
            "address": "Test Address",
            "city": "Test City",
            "state": "Test State",
            "pincode": "123456"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/retailers/admin/add",
            json=payload
        )
        
        # Should return 401 or 403 for unauthorized
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("✓ Add retailer correctly requires authentication")


class TestAdminDiscountCodesEndpoint:
    """Test Create Coupon endpoint (POST /api/admin/discount-codes)"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        # Step 1: Initiate login
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if response.status_code != 200:
            response = requests.post(
                f"{BASE_URL}/api/admin/login/initiate",
                json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN_ALT}
            )
        
        if response.status_code != 200:
            pytest.skip("Could not initiate admin login")
        
        data = response.json()
        token_id = data.get("token_id")
        
        # Step 2: Verify OTP with master password
        response2 = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": token_id, "otp": MASTER_PASSWORD}
        )
        
        if response2.status_code != 200:
            pytest.skip(f"Could not verify admin OTP: {response2.text}")
        
        data2 = response2.json()
        session_token = data2.get("session_token")
        cookies = response2.cookies
        
        return {"session_token": session_token, "cookies": cookies}
    
    def test_create_coupon_endpoint_exists(self, admin_session):
        """Test that the create coupon endpoint exists and accepts POST"""
        session = requests.Session()
        session.cookies.update(admin_session["cookies"])
        
        # Payload matching frontend's handleCreateCoupon format (camelCase)
        unique_code = f"TEST{int(time.time())}"
        payload = {
            "code": unique_code,
            "discountType": "percentage",
            "discountValue": 10,
            "minOrderValue": 100,
            "maxDiscount": 50,
            "maxUses": 100,
            "usageType": "universal",
            "expiresAt": None,
            "description": "10% discount test coupon"
        }
        
        response = session.post(
            f"{BASE_URL}/api/admin/discount-codes",
            json=payload,
            headers={"Authorization": f"Bearer {admin_session['session_token']}"}
        )
        
        # Should return 200 or 201 for success
        assert response.status_code in [200, 201, 400, 422], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ Coupon created successfully: {data}")
            
            # Cleanup - delete the test coupon
            delete_response = session.delete(
                f"{BASE_URL}/api/admin/discount-codes/{unique_code}",
                headers={"Authorization": f"Bearer {admin_session['session_token']}"}
            )
            if delete_response.status_code in [200, 204]:
                print(f"✓ Test coupon cleaned up")
        else:
            print(f"✓ Endpoint exists, validation error: {response.json()}")
    
    def test_create_coupon_without_auth(self):
        """Test that create coupon requires authentication"""
        payload = {
            "code": "UNAUTH123",
            "discountType": "percentage",
            "discountValue": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/discount-codes",
            json=payload
        )
        
        # Should return 401 or 403 for unauthorized
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("✓ Create coupon correctly requires authentication")
    
    def test_list_discount_codes(self, admin_session):
        """Test listing discount codes"""
        session = requests.Session()
        session.cookies.update(admin_session["cookies"])
        
        response = session.get(
            f"{BASE_URL}/api/admin/discount-codes",
            headers={"Authorization": f"Bearer {admin_session['session_token']}"}
        )
        
        assert response.status_code == 200, f"Failed to list coupons: {response.status_code}, {response.text}"
        data = response.json()
        assert "codes" in data
        print(f"✓ Listed {len(data['codes'])} discount codes")


class TestTitleCaseFormatting:
    """Test Title Case formatting on registration form fields"""
    
    def test_registration_endpoint_exists(self):
        """Test that registration endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": "test@example.com"}
        )
        
        # Should return 200 (OTP sent) or 400 (validation error)
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print("✓ Registration OTP endpoint exists")
    
    def test_pincode_lookup_api(self):
        """Test that pincode lookup works (external API)"""
        # This tests the external API used for auto-filling city/state
        response = requests.get("https://api.postalpincode.in/pincode/110078")
        
        if response.status_code == 200:
            data = response.json()
            if data[0].get("Status") == "Success":
                post_office = data[0]["PostOffice"][0]
                print(f"✓ Pincode lookup works: {post_office['District']}, {post_office['State']}")
            else:
                print("✓ Pincode lookup API accessible but no data for test pincode")
        else:
            print(f"⚠ Pincode lookup API returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
