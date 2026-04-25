"""
Test Admin 2FA (Two-Factor Authentication) for Admin Login
Tests: /admin/login/initiate and /admin/login/verify-otp endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://b2b-portal-preview-1.preview.emergentagent.com').rstrip('/')

class TestAdmin2FA:
    """Admin Two-Factor Authentication Tests"""
    
    # Test credentials
    ADMIN_EMAIL = "contact.us@centraders.com"
    ADMIN_PIN = "110078"
    
    def test_initiate_login_success(self):
        """Step 1: Admin can initiate login with valid email+PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": self.ADMIN_PIN}
        )
        
        print(f"Initiate login response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "token_id" in data, "Response should contain token_id"
        assert "email_masked" in data, "Response should contain email_masked"
        assert "message" in data, "Response should contain message"
        
        # Validate masked email format (e.g., "con***@centraders.com")
        assert "***" in data["email_masked"], "Email should be masked"
        assert "@" in data["email_masked"], "Masked email should contain @"
        
        # Store token_id for subsequent tests
        return data["token_id"]
    
    def test_initiate_login_missing_fields(self):
        """Initiate should fail if email or PIN is missing"""
        # Missing email
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"pin": self.ADMIN_PIN}
        )
        assert response.status_code == 400
        print(f"Missing email response: {response.json()}")
        
        # Missing PIN
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL}
        )
        assert response.status_code == 400
        print(f"Missing PIN response: {response.json()}")
    
    def test_initiate_login_non_admin_email(self):
        """Initiate should fail for non-admin email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "user@example.com", "pin": "123456"}
        )
        
        print(f"Non-admin email response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 403
        assert "not an admin" in response.json().get("detail", "").lower()
    
    def test_initiate_login_wrong_pin(self):
        """Initiate should fail with incorrect PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": "000000"}
        )
        
        print(f"Wrong PIN response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 401
        assert "invalid pin" in response.json().get("detail", "").lower()
    
    def test_verify_otp_invalid_token(self):
        """Verify should fail with invalid token_id"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": "invalid_token_12345", "otp": "123456"}
        )
        
        print(f"Invalid token response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 400
        assert "invalid" in response.json().get("detail", "").lower() or "expired" in response.json().get("detail", "").lower()
    
    def test_verify_otp_missing_fields(self):
        """Verify should fail if token_id or OTP is missing"""
        # Missing token_id
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"otp": "123456"}
        )
        assert response.status_code == 400
        print(f"Missing token_id response: {response.json()}")
        
        # Missing OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": "some_token"}
        )
        assert response.status_code == 400
        print(f"Missing OTP response: {response.json()}")
    
    def test_verify_otp_wrong_otp(self):
        """Verify should fail with wrong OTP and show remaining attempts"""
        # First initiate to get a valid token
        init_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": self.ADMIN_PIN}
        )
        assert init_response.status_code == 200
        token_id = init_response.json()["token_id"]
        
        # Try with wrong OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": token_id, "otp": "000000"}
        )
        
        print(f"Wrong OTP response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 401
        detail = response.json().get("detail", "")
        assert "invalid otp" in detail.lower()
        assert "attempt" in detail.lower(), "Should show remaining attempts"
    
    def test_verify_otp_max_attempts(self):
        """Should block after 3 failed OTP attempts"""
        # Initiate login
        init_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": self.ADMIN_PIN}
        )
        assert init_response.status_code == 200
        token_id = init_response.json()["token_id"]
        
        # Try 3 wrong OTPs - each returns 401 with decreasing attempts
        for i in range(3):
            response = requests.post(
                f"{BASE_URL}/api/admin/login/verify-otp",
                json={"token_id": token_id, "otp": f"{i}{i}{i}{i}{i}{i}"}
            )
            print(f"Attempt {i+1}: {response.status_code} - {response.json().get('detail', '')}")
            
            assert response.status_code == 401, f"Attempt {i+1} should be 401"
            detail = response.json().get("detail", "").lower()
            assert "invalid otp" in detail
            expected_remaining = 2 - i
            assert f"{expected_remaining} attempt" in detail, f"Should show {expected_remaining} attempts remaining"
        
        # 4th attempt should fail with 400 (session deleted after 3 failed attempts)
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": token_id, "otp": "999999"}
        )
        print(f"4th attempt: {response.status_code} - {response.json().get('detail', '')}")
        assert response.status_code == 400
        detail = response.json().get("detail", "").lower()
        assert "too many" in detail or "invalid" in detail or "expired" in detail, "Should show appropriate error message"
    
    def test_full_2fa_flow_initiate_and_check_token(self):
        """Full 2FA flow: initiate returns valid token structure"""
        # Step 1: Initiate
        init_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": self.ADMIN_PIN}
        )
        
        assert init_response.status_code == 200
        data = init_response.json()
        
        print("Full 2FA flow test:")
        print(f"Token ID received: {data.get('token_id', 'MISSING')[:20]}...")
        print(f"Email masked: {data.get('email_masked', 'MISSING')}")
        print(f"Message: {data.get('message', 'MISSING')}")
        
        # Validate all expected fields
        assert len(data["token_id"]) > 20, "Token should be sufficiently long"
        assert data["email_masked"].startswith("con"), "Masked email should start correctly"
        assert "OTP" in data["message"] or "otp" in data["message"].lower() or "sent" in data["message"].lower()
    
    def test_back_to_login_resets_flow(self):
        """After going back to login, user can reinitiate 2FA"""
        # First initiate
        init1 = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": self.ADMIN_PIN}
        )
        assert init1.status_code == 200
        token1 = init1.json()["token_id"]
        
        # Second initiate (simulates going back and restarting)
        init2 = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": self.ADMIN_EMAIL, "pin": self.ADMIN_PIN}
        )
        assert init2.status_code == 200
        token2 = init2.json()["token_id"]
        
        # Tokens should be different
        assert token1 != token2, "New initiate should generate new token"
        print(f"Token 1: {token1[:20]}...")
        print(f"Token 2: {token2[:20]}...")


class TestAdminLegacyLogin:
    """Test legacy admin login is disabled"""
    
    def test_legacy_login_disabled(self):
        """Legacy /admin/login should redirect to 2FA flow"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        
        print(f"Legacy login response: {response.status_code}")
        print(f"Response body: {response.json()}")
        
        assert response.status_code == 400
        assert "2FA" in response.json().get("detail", "") or "two" in response.json().get("detail", "").lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
