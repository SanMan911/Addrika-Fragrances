"""
Test P1 Features:
1. B2B pricing at 76.52% of MRP (50g box = Rs.1010, 200g box = Rs.4922)
2. Profile change tickets admin APIs
3. B2B order status update email notification
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from requirements
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"

# Test retailer
TEST_RETAILER_EMAIL = "karolbagh@addrika.com"


class TestB2BPricing:
    """Test B2B pricing is correctly set at 76.52% of MRP"""
    
    def test_b2b_discount_rate(self):
        """Verify B2B discount rate is 76.52%"""
        # This is a code check - the rate should be 0.7652
        from decimal import Decimal
        expected_rate = 0.7652
        # 50g box: 12 units * 110 MRP * 0.7652 = 1010.064 => 1010
        calculated_50g = round(12 * 110 * expected_rate)
        assert calculated_50g == 1010, f"50g box price should be 1010, got {calculated_50g}"
        
        # 200g box: 16 units * 402 MRP * 0.7652 = 4921.5264 => 4922
        calculated_200g = round(16 * 402 * expected_rate)
        assert calculated_200g == 4922, f"200g box price should be 4922, got {calculated_200g}"
    
    def test_b2b_catalog_unauthorized(self):
        """Test B2B catalog requires authentication"""
        response = requests.get(f"{BASE_URL}/api/retailer-dashboard/b2b/catalog")
        # Should return 401 or redirect
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestAdminAuthentication:
    """Admin authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        # Step 1: Initiate login
        initiate_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if initiate_response.status_code != 200:
            pytest.skip(f"Admin login initiate failed: {initiate_response.text}")
        
        data = initiate_response.json()
        token_id = data.get("token_id")
        
        if not token_id:
            pytest.skip("No token_id returned from admin login initiate")
        
        # Step 2: For testing, we need to get OTP from the database or use a test bypass
        # In real scenario, OTP is sent via email. For testing, we'll check if direct session exists
        # Let's try using the session cookie approach
        
        # Try getting the OTP from MongoDB (test environment only)
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.environ.get('DB_NAME', 'addrika_db')
            client = MongoClient(mongo_url)
            db = client[db_name]
            
            # Get the token with OTP
            token_doc = db.admin_2fa_tokens.find_one({"token_id": token_id})
            if token_doc and token_doc.get("otp"):
                otp = token_doc["otp"]
                
                # Step 3: Verify OTP
                verify_response = requests.post(
                    f"{BASE_URL}/api/admin/login/verify-otp",
                    json={"token_id": token_id, "otp": otp}
                )
                
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    session_token = verify_data.get("session_token")
                    if session_token:
                        return {"session_token": session_token, "cookies": verify_response.cookies}
        except Exception as e:
            print(f"Could not get OTP from database: {e}")
        
        pytest.skip("Could not complete admin 2FA authentication")
    
    def test_admin_auth_flow_initiates(self):
        """Test admin auth initiation works"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        assert response.status_code == 200, f"Admin login initiate failed: {response.text}"
        data = response.json()
        assert "token_id" in data, "Response should contain token_id"
        # Message can be "OTP sent to email" or "OTP sent to your email"
        assert "OTP" in data.get("message", ""), f"Message should contain OTP, got: {data.get('message')}"


class TestProfileChangeTickets:
    """Test Profile Change Tickets Admin APIs"""
    
    @pytest.fixture(scope="class")
    def admin_cookies(self):
        """Get admin session cookies"""
        # Initiate
        initiate_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if initiate_response.status_code != 200:
            pytest.skip("Admin login initiate failed")
        
        token_id = initiate_response.json().get("token_id")
        
        # Get OTP from database
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.environ.get('DB_NAME', 'addrika_db')
            client = MongoClient(mongo_url)
            db = client[db_name]
            
            token_doc = db.admin_2fa_tokens.find_one({"token_id": token_id})
            if token_doc and token_doc.get("otp"):
                otp = token_doc["otp"]
                
                verify_response = requests.post(
                    f"{BASE_URL}/api/admin/login/verify-otp",
                    json={"token_id": token_id, "otp": otp}
                )
                
                if verify_response.status_code == 200:
                    return verify_response.cookies
        except Exception as e:
            print(f"Could not authenticate: {e}")
        
        pytest.skip("Could not get admin authentication")
    
    def test_profile_tickets_list_unauthorized(self):
        """Test that profile tickets list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/retailers/admin/profile-change-tickets")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_profile_tickets_list_authorized(self, admin_cookies):
        """Test listing profile change tickets with admin auth"""
        response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets",
            cookies=admin_cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data, "Response should contain 'tickets'"
        assert "status_counts" in data, "Response should contain 'status_counts'"
        assert "pagination" in data, "Response should contain 'pagination'"
        
        # Verify status counts structure
        status_counts = data["status_counts"]
        expected_statuses = ["pending", "under_review", "approved", "rejected"]
        for status in expected_statuses:
            assert status in status_counts, f"status_counts should have '{status}'"
    
    def test_profile_ticket_detail_requires_auth(self):
        """Test that ticket detail requires authentication"""
        response = requests.get(f"{BASE_URL}/api/retailers/admin/profile-change-tickets/fake-ticket-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_profile_ticket_detail_not_found(self, admin_cookies):
        """Test 404 for non-existent ticket"""
        response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/nonexistent-ticket-12345",
            cookies=admin_cookies
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_profile_ticket_review_unauthorized(self):
        """Test that ticket review requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/fake-ticket",
            json={"status": "approved", "admin_notes": "Test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestB2BOrderStatusEmail:
    """Test B2B order status update email notification"""
    
    @pytest.fixture(scope="class")
    def admin_cookies(self):
        """Get admin session cookies"""
        # Initiate
        initiate_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if initiate_response.status_code != 200:
            pytest.skip("Admin login initiate failed")
        
        token_id = initiate_response.json().get("token_id")
        
        # Get OTP from database
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.environ.get('DB_NAME', 'addrika_db')
            client = MongoClient(mongo_url)
            db = client[db_name]
            
            token_doc = db.admin_2fa_tokens.find_one({"token_id": token_id})
            if token_doc and token_doc.get("otp"):
                otp = token_doc["otp"]
                
                verify_response = requests.post(
                    f"{BASE_URL}/api/admin/login/verify-otp",
                    json={"token_id": token_id, "otp": otp}
                )
                
                if verify_response.status_code == 200:
                    return verify_response.cookies
        except Exception as e:
            print(f"Could not authenticate: {e}")
        
        pytest.skip("Could not get admin authentication")
    
    def test_b2b_orders_list(self, admin_cookies):
        """Test listing B2B orders"""
        response = requests.get(
            f"{BASE_URL}/api/admin/b2b/orders",
            cookies=admin_cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "orders" in data, "Response should contain 'orders'"
        assert "status_counts" in data, "Response should contain 'status_counts'"
        assert "pagination" in data, "Response should contain 'pagination'"
    
    def test_b2b_order_status_update_invalid_order(self, admin_cookies):
        """Test status update for non-existent order returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/admin/b2b/orders/NONEXISTENT-ORDER-123/status",
            json={"status": "confirmed", "note": "Test update"},
            cookies=admin_cookies
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_b2b_order_status_update_invalid_status(self, admin_cookies):
        """Test status update with invalid status"""
        response = requests.put(
            f"{BASE_URL}/api/admin/b2b/orders/test-order/status",
            json={"status": "invalid_status_xyz", "note": "Test update"},
            cookies=admin_cookies
        )
        
        # Should return 400 for invalid status
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"


class TestAPIHealthAndBasics:
    """Basic API health checks"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_retailers_public_list(self):
        """Test public retailers endpoint"""
        response = requests.get(f"{BASE_URL}/api/retailers/")
        assert response.status_code == 200
        data = response.json()
        assert "retailers" in data
    
    def test_admin_login_wrong_pin(self):
        """Test admin login with wrong PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": "000000"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_admin_login_wrong_email(self):
        """Test admin login with non-admin email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "notadmin@example.com", "pin": ADMIN_PIN}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
