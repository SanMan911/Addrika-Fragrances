"""
Test suite for Username-related features:
1. Username field in registration
2. Username availability check API
3. Blocked username validation
4. Forgot Username feature
5. Admin registration logs and notifications
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://title-case-forms.preview.emergentagent.com').rstrip('/')


def generate_random_string(length=8):
    """Generate random alphanumeric string"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


class TestUsernameAvailabilityCheck:
    """Test /api/auth/check-username/{username} endpoint"""
    
    def test_check_username_available(self):
        """Test checking an available username"""
        random_username = f"TestUser{generate_random_string()}"
        response = requests.get(f"{BASE_URL}/api/auth/check-username/{random_username}")
        
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert data["available"] == True
        print(f"✓ Username '{random_username}' is available")
    
    def test_check_username_too_short(self):
        """Test username validation - too short"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/ab")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "error" in data
        assert "at least 3 characters" in data["error"].lower()
        print(f"✓ Short username rejected: {data['error']}")
    
    def test_check_username_starts_with_number(self):
        """Test username validation - starts with number"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/123user")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "error" in data
        assert "cannot start with a number" in data["error"].lower()
        print(f"✓ Username starting with number rejected: {data['error']}")
    
    def test_check_username_invalid_characters(self):
        """Test username validation - invalid characters"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/user@name")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "error" in data
        print(f"✓ Username with invalid chars rejected: {data['error']}")


class TestBlockedUsernames:
    """Test blocked username validation (SanMan911, 911SanMan, SanMan)"""
    
    def test_blocked_username_sanman911(self):
        """Test that 'SanMan911' is blocked"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/SanMan911")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "not available" in data.get("error", "").lower()
        print("✓ 'SanMan911' is blocked")
    
    def test_blocked_username_911sanman(self):
        """Test that '911SanMan' is blocked (starts with number anyway)"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/911SanMan")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        # Either blocked or invalid due to starting with number
        print(f"✓ '911SanMan' is blocked/invalid: {data.get('error', 'not available')}")
    
    def test_blocked_username_sanman(self):
        """Test that 'SanMan' is blocked"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/SanMan")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "not available" in data.get("error", "").lower()
        print("✓ 'SanMan' is blocked")
    
    def test_blocked_username_case_insensitive(self):
        """Test that blocked usernames are case-insensitive"""
        # Test lowercase version
        response = requests.get(f"{BASE_URL}/api/auth/check-username/sanman911")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        print("✓ 'sanman911' (lowercase) is also blocked")
        
        # Test mixed case
        response2 = requests.get(f"{BASE_URL}/api/auth/check-username/SANMAN")
        data2 = response2.json()
        assert data2["available"] == False
        print("✓ 'SANMAN' (uppercase) is also blocked")


class TestForgotUsername:
    """Test /api/auth/forgot-username endpoint"""
    
    def test_forgot_username_invalid_phone(self):
        """Test forgot username with non-existent phone"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-username",
            json={"phone": "9999999999", "country_code": "+91"}
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "no account found" in data.get("detail", "").lower()
        print("✓ Non-existent phone returns 404")
    
    def test_forgot_username_empty_phone(self):
        """Test forgot username with empty phone"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-username",
            json={"phone": "", "country_code": "+91"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "required" in data.get("detail", "").lower()
        print("✓ Empty phone returns 400")


class TestAdminRegistrationLogs:
    """Test admin registration logs and notifications endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        # Admin login with PIN
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        
        if response.status_code != 200:
            pytest.skip("Admin login failed - skipping admin tests")
        
        data = response.json()
        # Check if 2FA is required
        if data.get("requires_2fa"):
            # Use master password as OTP
            verify_response = requests.post(
                f"{BASE_URL}/api/admin/verify-2fa",
                json={
                    "email": "contact.us@centraders.com",
                    "otp": "addrika_admin_override"
                }
            )
            if verify_response.status_code == 200:
                return verify_response.cookies.get("session_token")
            pytest.skip("Admin 2FA verification failed")
        
        return response.cookies.get("session_token")
    
    def test_registration_logs_endpoint_exists(self, admin_session):
        """Test that registration logs endpoint exists"""
        cookies = {"session_token": admin_session} if admin_session else {}
        response = requests.get(
            f"{BASE_URL}/api/admin/registration-logs",
            cookies=cookies
        )
        
        # Should return 200 or 401 (if auth required)
        assert response.status_code in [200, 401]
        if response.status_code == 200:
            data = response.json()
            assert "logs" in data
            assert "unread_count" in data
            print(f"✓ Registration logs endpoint works - {len(data['logs'])} logs, {data['unread_count']} unread")
    
    def test_notifications_count_endpoint_exists(self, admin_session):
        """Test that notifications count endpoint exists"""
        cookies = {"session_token": admin_session} if admin_session else {}
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/count",
            cookies=cookies
        )
        
        assert response.status_code in [200, 401]
        if response.status_code == 200:
            data = response.json()
            assert "unread_registrations" in data
            assert "total_unread" in data
            print(f"✓ Notifications count endpoint works - {data['total_unread']} unread")


class TestLoginWithUsername:
    """Test login with username instead of email"""
    
    def test_login_endpoint_accepts_identifier(self):
        """Test that login endpoint accepts identifier field"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "nonexistent_user", "password": "wrongpass"}
        )
        
        # Should return 401 (invalid credentials) not 422 (validation error)
        assert response.status_code == 401
        print("✓ Login endpoint accepts 'identifier' field")
    
    def test_login_with_email_format(self):
        """Test login with email format identifier"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "test@example.com", "password": "wrongpass"}
        )
        
        assert response.status_code == 401
        print("✓ Login with email format works (returns 401 for wrong credentials)")


class TestRegistrationWithUsername:
    """Test registration flow with username field"""
    
    def test_send_otp_endpoint(self):
        """Test OTP sending endpoint"""
        test_email = f"test_{generate_random_string()}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": test_email}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # In dev mode, OTP might be returned
        if "dev_otp" in data:
            print(f"✓ OTP sent (dev mode): {data['dev_otp']}")
        else:
            print("✓ OTP sent to email")
    
    def test_registration_requires_username(self):
        """Test that registration validates username"""
        # First send OTP
        test_email = f"test_{generate_random_string()}@example.com"
        otp_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"email": test_email}
        )
        
        if otp_response.status_code != 200:
            pytest.skip("OTP sending failed")
        
        otp_data = otp_response.json()
        otp = otp_data.get("dev_otp", "123456")
        
        # Verify OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"email": test_email, "otp": otp}
        )
        
        if verify_response.status_code != 200:
            pytest.skip("OTP verification failed")
        
        # Try registration with blocked username
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register-with-otp",
            json={
                "email": test_email,
                "password": "Test@123",
                "name": "Test User",
                "username": "SanMan911",  # Blocked username
                "phone": "9876543210",
                "country_code": "+91",
                "otp": otp,
                "address": "123 Test Street",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001"
            }
        )
        
        assert register_response.status_code == 400
        data = register_response.json()
        assert "not available" in data.get("detail", "").lower()
        print("✓ Registration rejects blocked username")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
