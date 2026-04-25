"""
Test Admin Registration Logs and Notifications endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://addrika-kyc-onboard.preview.emergentagent.com').rstrip('/')


class TestAdminEndpoints:
    """Test admin registration logs and notifications"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session with 2FA"""
        # Step 1: Admin login
        login_response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        login_data = login_response.json()
        
        # Step 2: 2FA verification with master password
        if login_data.get("requires_2fa"):
            verify_response = requests.post(
                f"{BASE_URL}/api/admin/verify-2fa",
                json={
                    "email": "contact.us@centraders.com",
                    "otp": "addrika_admin_override"
                }
            )
            
            if verify_response.status_code != 200:
                pytest.skip(f"Admin 2FA failed: {verify_response.text}")
            
            return verify_response.cookies.get("session_token")
        
        return login_response.cookies.get("session_token")
    
    def test_registration_logs_endpoint(self, admin_session):
        """Test GET /api/admin/registration-logs"""
        cookies = {"session_token": admin_session}
        response = requests.get(
            f"{BASE_URL}/api/admin/registration-logs",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "logs" in data
        assert "total" in data
        assert "unread_count" in data
        assert isinstance(data["logs"], list)
        assert isinstance(data["unread_count"], int)
        
        print(f"✓ Registration logs: {data['total']} total, {data['unread_count']} unread")
        
        # Verify log structure if any exist
        if data["logs"]:
            log = data["logs"][0]
            assert "user_id" in log or "email" in log
            print(f"✓ Sample log: {log.get('email', 'N/A')}")
    
    def test_registration_logs_unread_only(self, admin_session):
        """Test GET /api/admin/registration-logs?unread_only=true"""
        cookies = {"session_token": admin_session}
        response = requests.get(
            f"{BASE_URL}/api/admin/registration-logs?unread_only=true",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        print(f"✓ Unread logs filter works: {len(data['logs'])} unread logs")
    
    def test_notifications_count_endpoint(self, admin_session):
        """Test GET /api/admin/notifications/count"""
        cookies = {"session_token": admin_session}
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/count",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "unread_registrations" in data
        assert "total_unread" in data
        assert isinstance(data["unread_registrations"], int)
        assert isinstance(data["total_unread"], int)
        
        print(f"✓ Notifications count: {data['total_unread']} total unread")
    
    def test_mark_read_endpoint(self, admin_session):
        """Test POST /api/admin/registration-logs/mark-read"""
        cookies = {"session_token": admin_session}
        response = requests.post(
            f"{BASE_URL}/api/admin/registration-logs/mark-read",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "marked_count" in data
        print(f"✓ Mark read: {data['marked_count']} notifications marked as read")
    
    def test_endpoints_require_auth(self):
        """Test that endpoints require authentication"""
        # Test without session token
        response = requests.get(f"{BASE_URL}/api/admin/registration-logs")
        assert response.status_code in [401, 403]
        print("✓ Registration logs requires auth")
        
        response = requests.get(f"{BASE_URL}/api/admin/notifications/count")
        assert response.status_code in [401, 403]
        print("✓ Notifications count requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
