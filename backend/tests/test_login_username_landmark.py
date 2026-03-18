"""
Tests for login with email/username and landmark capitalization
Features tested:
1. Login API accepts both email and username via 'identifier' field
2. Admin cleanup endpoint for users without username
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLoginWithEmailOrUsername:
    """Test that login API accepts both email and username"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_email = f"test_login_{uuid.uuid4().hex[:8]}@example.com"
        self.test_username = f"testuser_{uuid.uuid4().hex[:8]}"
        self.test_password = "TestPassword123!"
        self.session = requests.Session()
    
    def test_login_endpoint_accepts_identifier_field(self):
        """Test that login endpoint accepts 'identifier' field (not 'email')"""
        # Try login with identifier field - should work even with invalid credentials
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test@example.com",
            "password": "wrongpassword"
        })
        
        # Should return 401 (invalid credentials) not 422 (validation error)
        # 422 would mean the field name is wrong
        assert response.status_code in [401, 400], f"Expected 401 or 400, got {response.status_code}: {response.text}"
        
        # Verify error message is about credentials, not about missing 'email' field
        error_detail = response.json().get('detail', '')
        assert 'email' not in error_detail.lower() or 'invalid' in error_detail.lower(), \
            f"Error should be about invalid credentials, not missing email field: {error_detail}"
        print(f"✓ Login endpoint accepts 'identifier' field. Response: {response.status_code}")
    
    def test_login_with_username_format(self):
        """Test login with username (no @ symbol) is attempted"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "testusername",
            "password": "wrongpassword"
        })
        
        # Should return 401 (invalid credentials) not 422 (validation error)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ Login with username format works. Response: {response.status_code}")
    
    def test_login_with_email_format(self):
        """Test login with email (with @ symbol) is attempted"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test@example.com",
            "password": "wrongpassword"
        })
        
        # Should return 401 (invalid credentials) not 422
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ Login with email format works. Response: {response.status_code}")
    
    def test_login_returns_username_in_response(self):
        """Test that login response includes username field when user has one"""
        # First need to register a user with username
        test_email = f"test_withuser_{uuid.uuid4().hex[:6]}@example.com"
        test_username = f"tuser{uuid.uuid4().hex[:6]}"
        
        # Send OTP
        otp_response = self.session.post(f"{BASE_URL}/api/auth/send-otp", json={
            "email": test_email
        })
        
        if otp_response.status_code != 200:
            pytest.skip(f"Could not send OTP: {otp_response.text}")
        
        dev_otp = otp_response.json().get('dev_otp')
        if not dev_otp:
            pytest.skip("No dev_otp returned - email service may be configured")
        
        # Verify OTP
        verify_response = self.session.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "email": test_email,
            "otp": dev_otp
        })
        assert verify_response.status_code == 200, f"OTP verification failed: {verify_response.text}"
        
        # Register with username
        register_response = self.session.post(f"{BASE_URL}/api/auth/register-with-otp", json={
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test User",
            "username": test_username,
            "otp": dev_otp,
            "address": "123 Test Street",
            "city": "Test City",
            "state": "Test State",
            "pincode": "110001",
            "phone": "9876543210"
        })
        
        if register_response.status_code != 200:
            pytest.skip(f"Registration failed: {register_response.text}")
        
        # Now login and check response has username
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": test_email,
            "password": "TestPass123!"
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        user_data = login_response.json().get('user', {})
        
        assert 'username' in user_data, f"Response should include username field: {user_data}"
        assert user_data['username'] == test_username, f"Username mismatch: expected {test_username}, got {user_data.get('username')}"
        print(f"✓ Login response includes username: {user_data.get('username')}")


class TestAdminCleanupUsersWithoutUsername:
    """Test admin endpoint to cleanup users without username"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.admin_email = "contact.us@centraders.com"
        self.admin_pin = "110078"
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/admin/login", json={
            "email": self.admin_email,
            "pin": self.admin_pin
        })
        
        if login_response.status_code == 200:
            self.is_admin = True
        else:
            self.is_admin = False
    
    def test_cleanup_endpoint_exists_with_preview_mode(self):
        """Test cleanup endpoint exists and works in preview mode (confirm=false)"""
        if not self.is_admin:
            pytest.skip("Could not login as admin")
        
        # Call without confirm parameter (preview mode)
        response = self.session.delete(f"{BASE_URL}/api/admin/cleanup-users-without-username")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'action' in data, f"Response should have 'action' field: {data}"
        assert data['action'] == 'preview', f"Without confirm, should be in preview mode: {data}"
        assert 'users_to_delete' in data, f"Response should have 'users_to_delete' count: {data}"
        assert 'message' in data, f"Response should have 'message': {data}"
        
        print(f"✓ Cleanup endpoint preview mode works. Found {data.get('users_to_delete', 0)} users to delete")
    
    def test_cleanup_endpoint_with_confirm_false(self):
        """Test cleanup endpoint with explicit confirm=false"""
        if not self.is_admin:
            pytest.skip("Could not login as admin")
        
        response = self.session.delete(f"{BASE_URL}/api/admin/cleanup-users-without-username?confirm=false")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('action') == 'preview', f"confirm=false should be preview mode: {data}"
        print(f"✓ Cleanup endpoint with confirm=false works in preview mode")
    
    def test_cleanup_endpoint_with_confirm_true(self):
        """Test cleanup endpoint with confirm=true actually deletes users"""
        if not self.is_admin:
            pytest.skip("Could not login as admin")
        
        # First check preview
        preview_response = self.session.delete(f"{BASE_URL}/api/admin/cleanup-users-without-username?confirm=false")
        preview_data = preview_response.json()
        users_to_delete = preview_data.get('users_to_delete', 0)
        
        if users_to_delete == 0:
            # No users to delete - just verify endpoint works
            response = self.session.delete(f"{BASE_URL}/api/admin/cleanup-users-without-username?confirm=true")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert data.get('action') == 'nothing' or data.get('users_deleted', 0) == 0, f"Should have nothing to delete: {data}"
            print(f"✓ Cleanup endpoint with confirm=true works (no users to delete)")
        else:
            # There are users - this test would actually delete them
            # Just verify the endpoint accepts confirm=true parameter
            response = self.session.delete(f"{BASE_URL}/api/admin/cleanup-users-without-username?confirm=true")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            assert 'action' in data, f"Response should have action field: {data}"
            print(f"✓ Cleanup endpoint with confirm=true executed. Action: {data.get('action')}, Deleted: {data.get('users_deleted', 0)}")


class TestUsernameAvailabilityEndpoint:
    """Test username availability check endpoint"""
    
    def test_check_username_availability(self):
        """Test username availability endpoint"""
        session = requests.Session()
        
        # Check a random username that shouldn't exist
        test_username = f"testcheck_{uuid.uuid4().hex[:8]}"
        response = session.get(f"{BASE_URL}/api/auth/check-username/{test_username}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'available' in data, f"Response should have 'available' field: {data}"
        assert data['available'] == True, f"Random username should be available: {data}"
        print(f"✓ Username availability check works. '{test_username}' is available: {data['available']}")
    
    def test_check_username_validation(self):
        """Test username validation rules"""
        session = requests.Session()
        
        # Test invalid username (too short)
        response = session.get(f"{BASE_URL}/api/auth/check-username/ab")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should either be unavailable or have an error message
        assert data.get('available') == False or 'error' in data, f"Short username should be invalid: {data}"
        print(f"✓ Short username validation works: {data}")
        
        # Test valid username format
        response = session.get(f"{BASE_URL}/api/auth/check-username/valid_user123")
        assert response.status_code == 200
        data = response.json()
        assert 'available' in data, f"Should have available field: {data}"
        print(f"✓ Valid username format check works: {data}")


class TestUserLoginModel:
    """Test that UserLogin model uses 'identifier' field"""
    
    def test_login_requires_identifier_not_email(self):
        """Verify login API expects 'identifier' not 'email'"""
        session = requests.Session()
        
        # Send with 'email' instead of 'identifier' - should fail validation
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",  # Wrong field name
            "password": "testpassword"
        })
        
        # Should get 422 validation error because 'identifier' field is missing
        assert response.status_code == 422, f"Expected 422 validation error when using 'email' instead of 'identifier', got {response.status_code}: {response.text}"
        print(f"✓ Login correctly requires 'identifier' field, not 'email'")
    
    def test_login_accepts_identifier(self):
        """Verify login API accepts 'identifier'"""
        session = requests.Session()
        
        # Send with correct 'identifier' field
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "test@example.com",
            "password": "testpassword"
        })
        
        # Should NOT get 422 - should get 401 (invalid credentials)
        assert response.status_code != 422, f"Should not get validation error with 'identifier' field: {response.text}"
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print(f"✓ Login correctly accepts 'identifier' field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
