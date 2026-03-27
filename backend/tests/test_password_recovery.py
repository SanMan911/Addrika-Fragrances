"""
Password Recovery Feature Tests
- User password recovery via mobile number (3-step flow)
- Admin PIN recovery via email (3-step flow)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserPasswordRecovery:
    """User password recovery via mobile number - 3 step flow"""
    
    def test_initiate_with_invalid_phone(self):
        """Step 1: Initiate with non-existent phone should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/initiate",
            json={"phone": "9999999999", "country_code": "+91"}
        )
        # Should return 404 for non-existent phone
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"✓ Non-existent phone returns 404: {data['detail']}")
    
    def test_initiate_with_empty_phone(self):
        """Step 1: Initiate with empty phone should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/initiate",
            json={"phone": "", "country_code": "+91"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Empty phone returns 400: {data['detail']}")
    
    def test_verify_otp_with_invalid_token(self):
        """Step 2: Verify OTP with invalid token should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/verify-otp",
            json={
                "phone": "9999999999",
                "otp": "123456",
                "recovery_token": "invalid_token_xyz"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Invalid recovery token returns 400: {data['detail']}")
    
    def test_reset_password_with_invalid_token(self):
        """Step 3: Reset password with invalid token should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/reset",
            json={
                "recovery_token": "invalid_token_xyz",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Invalid token for reset returns 400: {data['detail']}")


class TestAdminPinRecovery:
    """Admin PIN recovery via email - 3 step flow"""
    
    admin_email = "contact.us@centraders.com"
    master_password = "addrika_admin_override"  # Can be used as OTP
    recovery_token = None
    
    def test_initiate_with_valid_admin_email(self):
        """Step 1: Initiate with valid admin email should return 200"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": self.admin_email}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "recovery_token" in data
        assert "email_masked" in data
        assert "message" in data
        assert "expires_in_minutes" in data
        
        # Store token for next tests
        TestAdminPinRecovery.recovery_token = data["recovery_token"]
        
        print(f"✓ Admin recovery initiated: {data['message']}")
        print(f"  Email masked: {data['email_masked']}")
        print(f"  Expires in: {data['expires_in_minutes']} minutes")
    
    def test_initiate_with_invalid_admin_email(self):
        """Step 1: Initiate with non-admin email should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": "notadmin@example.com"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"✓ Non-admin email returns 404: {data['detail']}")
    
    def test_initiate_with_empty_email(self):
        """Step 1: Initiate with empty email should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": ""}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Empty email returns 400: {data['detail']}")
    
    def test_verify_otp_with_invalid_otp(self):
        """Step 2: Verify with wrong OTP should return 400"""
        # First initiate to get a fresh token
        init_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": self.admin_email}
        )
        assert init_response.status_code == 200
        token = init_response.json()["recovery_token"]
        
        # Try with wrong OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
            json={
                "recovery_token": token,
                "otp": "000000"  # Wrong OTP
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "Invalid OTP" in data["detail"]
        print(f"✓ Wrong OTP returns 400: {data['detail']}")
    
    def test_verify_otp_with_master_password(self):
        """Step 2: Verify with master password should return 200"""
        # First initiate to get a fresh token
        init_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": self.admin_email}
        )
        assert init_response.status_code == 200
        token = init_response.json()["recovery_token"]
        
        # Verify with master password
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
            json={
                "recovery_token": token,
                "otp": self.master_password
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "can_reset_pin" in data
        assert data["can_reset_pin"] == True
        
        # Store verified token for reset test
        TestAdminPinRecovery.recovery_token = token
        
        print(f"✓ Master password OTP verification: {data['message']}")
    
    def test_verify_otp_with_invalid_token(self):
        """Step 2: Verify with invalid token should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
            json={
                "recovery_token": "invalid_token_xyz",
                "otp": "123456"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Invalid token returns 400: {data['detail']}")
    
    def test_reset_pin_with_unverified_token(self):
        """Step 3: Reset with unverified token should return 400"""
        # Initiate but don't verify
        init_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": self.admin_email}
        )
        assert init_response.status_code == 200
        unverified_token = init_response.json()["recovery_token"]
        
        # Try to reset without verifying OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/reset",
            json={
                "recovery_token": unverified_token,
                "new_pin": "123456"
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Unverified token for reset returns 400: {data['detail']}")
    
    def test_reset_pin_with_short_pin(self):
        """Step 3: Reset with short PIN should return 400"""
        # First complete initiate and verify
        init_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": self.admin_email}
        )
        token = init_response.json()["recovery_token"]
        
        verify_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
            json={"recovery_token": token, "otp": self.master_password}
        )
        assert verify_response.status_code == 200
        
        # Try to reset with short PIN
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/reset",
            json={
                "recovery_token": token,
                "new_pin": "12"  # Too short
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Short PIN returns 400: {data['detail']}")
    
    def test_full_admin_recovery_flow(self):
        """Complete admin PIN recovery flow: initiate -> verify -> reset"""
        # Step 1: Initiate
        init_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": self.admin_email}
        )
        assert init_response.status_code == 200
        token = init_response.json()["recovery_token"]
        print(f"✓ Step 1 - Initiate: Got recovery token")
        
        # Step 2: Verify OTP (using master password)
        verify_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
            json={"recovery_token": token, "otp": self.master_password}
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["can_reset_pin"] == True
        print(f"✓ Step 2 - Verify OTP: OTP verified successfully")
        
        # Step 3: Reset PIN (reset back to original)
        reset_response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/reset",
            json={"recovery_token": token, "new_pin": "110078"}  # Reset to original
        )
        assert reset_response.status_code == 200
        data = reset_response.json()
        assert "message" in data
        assert "successfully" in data["message"].lower()
        print(f"✓ Step 3 - Reset PIN: {data['message']}")


class TestEndpointAvailability:
    """Test that all password recovery endpoints are available"""
    
    def test_user_initiate_endpoint_exists(self):
        """User forgot-password/initiate endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/initiate",
            json={"phone": "test"}
        )
        # 404 is valid response for "no account found" - endpoint exists
        # 405 would mean endpoint doesn't exist
        assert response.status_code in [400, 404, 422]  # Valid responses for bad input
        print(f"✓ /api/auth/forgot-password/initiate endpoint exists (status: {response.status_code})")
    
    def test_user_verify_endpoint_exists(self):
        """User forgot-password/verify-otp endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/verify-otp",
            json={"phone": "test", "otp": "test", "recovery_token": "test"}
        )
        assert response.status_code != 405  # 405 = Method Not Allowed = endpoint doesn't exist
        print(f"✓ /api/auth/forgot-password/verify-otp endpoint exists (status: {response.status_code})")
    
    def test_user_reset_endpoint_exists(self):
        """User forgot-password/reset endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password/reset",
            json={"recovery_token": "test", "new_password": "test"}
        )
        assert response.status_code != 405
        print(f"✓ /api/auth/forgot-password/reset endpoint exists (status: {response.status_code})")
    
    def test_admin_initiate_endpoint_exists(self):
        """Admin forgot-pin/initiate endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/initiate",
            json={"email": "test@test.com"}
        )
        # 404 is valid response for "no admin account found" - endpoint exists
        assert response.status_code in [400, 404, 422]  # Valid responses for bad input
        print(f"✓ /api/admin/forgot-pin/initiate endpoint exists (status: {response.status_code})")
    
    def test_admin_verify_endpoint_exists(self):
        """Admin forgot-pin/verify-otp endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/verify-otp",
            json={"recovery_token": "test", "otp": "test"}
        )
        assert response.status_code != 405
        print(f"✓ /api/admin/forgot-pin/verify-otp endpoint exists (status: {response.status_code})")
    
    def test_admin_reset_endpoint_exists(self):
        """Admin forgot-pin/reset endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/admin/forgot-pin/reset",
            json={"recovery_token": "test", "new_pin": "test"}
        )
        assert response.status_code != 405
        print(f"✓ /api/admin/forgot-pin/reset endpoint exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
