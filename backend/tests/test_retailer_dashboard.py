"""
Retailer Dashboard API Tests
Phase 2: Testing retailer authentication, dashboard metrics, orders, grievances, and messaging
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test retailer credentials
TEST_RETAILER_EMAIL = "karolbagh@addrika.com"
TEST_RETAILER_PASSWORD = "retailer123"

# Admin credentials for admin API tests
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"


class TestRetailerAuth:
    """Test retailer authentication endpoints"""
    
    def test_retailer_login_success(self):
        """Test successful retailer login"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Token not returned"
        assert "retailer" in data, "Retailer data not returned"
        assert data["retailer"]["email"] == TEST_RETAILER_EMAIL.lower()
        assert "retailer_id" in data["retailer"]
        print(f"SUCCESS: Retailer login - {data['retailer']['name']}")
        return data["token"]
    
    def test_retailer_login_wrong_password(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Wrong password correctly rejected")
    
    def test_retailer_login_nonexistent_email(self):
        """Test login with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": "nonexistent@test.com", "password": "test123"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Non-existent email correctly rejected")
    
    def test_retailer_validate_session_with_token(self):
        """Test session validation with valid token"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        token = login_response.json()["token"]
        
        # Validate session
        response = requests.get(
            f"{BASE_URL}/api/retailer-auth/validate",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        data = response.json()
        assert data["valid"] == True, "Session should be valid"
        assert data["retailer"] is not None, "Retailer data should be returned"
        print("SUCCESS: Session validation with token works")
    
    def test_retailer_validate_session_without_token(self):
        """Test session validation without token"""
        response = requests.get(f"{BASE_URL}/api/retailer-auth/validate")
        
        assert response.status_code == 200, f"Validation failed: {response.text}"
        data = response.json()
        assert data["valid"] == False, "Session should be invalid without token"
        print("SUCCESS: Session correctly invalid without token")
    
    def test_retailer_get_profile(self):
        """Test getting retailer profile"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/retailer-auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        data = response.json()
        assert "retailer" in data, "Retailer data not returned"
        print(f"SUCCESS: Got retailer profile - {data['retailer']['name']}")


class TestRetailerDashboard:
    """Test retailer dashboard endpoints"""
    
    @pytest.fixture(autouse=True)
    def get_auth_token(self):
        """Get auth token for authenticated tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_performance_metrics(self):
        """Test fetching retailer performance metrics"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/performance",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Performance fetch failed: {response.text}"
        data = response.json()
        
        assert "metrics" in data, "Metrics not returned"
        metrics = data["metrics"]
        
        # Verify expected metric fields exist
        expected_fields = [
            "total_orders", "recent_orders_30d", "completed_orders",
            "pickups_completed", "pending_orders", "completion_rate",
            "total_revenue", "open_grievances", "unread_messages"
        ]
        for field in expected_fields:
            assert field in metrics, f"Missing metric field: {field}"
        
        print(f"SUCCESS: Performance metrics - {metrics['total_orders']} total orders, "
              f"{metrics['completion_rate']}% completion rate")
    
    def test_get_performance_metrics_unauthorized(self):
        """Test performance metrics without auth"""
        response = requests.get(f"{BASE_URL}/api/retailer-dashboard/performance")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Performance metrics correctly requires auth")


class TestRetailerOrders:
    """Test retailer orders endpoints"""
    
    @pytest.fixture(autouse=True)
    def get_auth_token(self):
        """Get auth token for authenticated tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_orders_list(self):
        """Test fetching retailer orders"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/orders",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Orders fetch failed: {response.text}"
        data = response.json()
        
        assert "orders" in data, "Orders list not returned"
        assert "status_counts" in data, "Status counts not returned"
        assert "pagination" in data, "Pagination not returned"
        
        print(f"SUCCESS: Orders list - {len(data['orders'])} orders, "
              f"status counts: {data['status_counts']}")
    
    def test_get_orders_filtered_by_status(self):
        """Test fetching orders filtered by status"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/orders?status=pending",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Filtered orders fetch failed: {response.text}"
        data = response.json()
        
        # All returned orders should have pending status
        for order in data["orders"]:
            assert order["order_status"] == "pending", f"Order status mismatch: {order['order_status']}"
        
        print(f"SUCCESS: Filtered orders - {len(data['orders'])} pending orders")
    
    def test_get_orders_unauthorized(self):
        """Test orders endpoint without auth"""
        response = requests.get(f"{BASE_URL}/api/retailer-dashboard/orders")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Orders endpoint correctly requires auth")


class TestRetailerGrievances:
    """Test retailer grievances endpoints"""
    
    @pytest.fixture(autouse=True)
    def get_auth_token(self):
        """Get auth token for authenticated tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_create_grievance(self):
        """Test creating a new grievance"""
        grievance_data = {
            "subject": "TEST_Automated Test Grievance",
            "description": "This is an automated test grievance created by pytest testing suite. Please ignore.",
            "category": "other",
            "priority": "low"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/grievances",
            headers=self.headers,
            json=grievance_data
        )
        
        assert response.status_code == 200, f"Grievance creation failed: {response.text}"
        data = response.json()
        
        assert "complaint_id" in data, "Complaint ID not returned"
        assert data["complaint_id"].startswith("CMP-"), "Invalid complaint ID format"
        
        print(f"SUCCESS: Created grievance - {data['complaint_id']}")
        return data["complaint_id"]
    
    def test_get_grievances_list(self):
        """Test fetching grievances list"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/grievances",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Grievances fetch failed: {response.text}"
        data = response.json()
        
        assert "grievances" in data, "Grievances list not returned"
        assert "pagination" in data, "Pagination not returned"
        
        print(f"SUCCESS: Grievances list - {len(data['grievances'])} grievances")
    
    def test_create_grievance_missing_fields(self):
        """Test grievance creation with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/grievances",
            headers=self.headers,
            json={"subject": "Test"}  # Missing description
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("SUCCESS: Grievance creation correctly rejects missing fields")
    
    def test_get_grievances_unauthorized(self):
        """Test grievances endpoint without auth"""
        response = requests.get(f"{BASE_URL}/api/retailer-dashboard/grievances")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Grievances endpoint correctly requires auth")


class TestRetailerMessaging:
    """Test retailer messaging endpoints"""
    
    @pytest.fixture(autouse=True)
    def get_auth_token(self):
        """Get auth token for authenticated tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_get_district_retailers(self):
        """Test getting list of retailers in same district"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/messages/retailers",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"District retailers fetch failed: {response.text}"
        data = response.json()
        
        assert "retailers" in data, "Retailers list not returned"
        print(f"SUCCESS: District retailers - {len(data['retailers'])} retailers found")
    
    def test_get_inbox(self):
        """Test getting inbox messages"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/messages/inbox",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Inbox fetch failed: {response.text}"
        data = response.json()
        
        assert "messages" in data, "Messages list not returned"
        assert "unread_count" in data, "Unread count not returned"
        assert "pagination" in data, "Pagination not returned"
        
        print(f"SUCCESS: Inbox - {len(data['messages'])} messages, {data['unread_count']} unread")
    
    def test_get_sent_messages(self):
        """Test getting sent messages"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/messages/sent",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Sent messages fetch failed: {response.text}"
        data = response.json()
        
        assert "messages" in data, "Messages list not returned"
        assert "pagination" in data, "Pagination not returned"
        
        print(f"SUCCESS: Sent messages - {len(data['messages'])} messages")
    
    def test_messaging_unauthorized(self):
        """Test messaging endpoint without auth"""
        response = requests.get(f"{BASE_URL}/api/retailer-dashboard/messages/inbox")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Messaging endpoint correctly requires auth")


class TestB2BEndpoints:
    """Test B2B ordering endpoints (placeholder)"""
    
    @pytest.fixture(autouse=True)
    def get_auth_token(self):
        """Get auth token for authenticated tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_get_b2b_products(self):
        """Test getting B2B products (placeholder)"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/b2b/products",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"B2B products fetch failed: {response.text}"
        data = response.json()
        
        assert "products" in data, "Products list not returned"
        assert "notice" in data, "Notice not returned (placeholder indicator)"
        
        print(f"SUCCESS: B2B products - {len(data['products'])} products, notice: {data['notice'][:50]}...")
    
    def test_create_b2b_order_placeholder(self):
        """Test B2B order creation (placeholder response)"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/b2b/orders",
            headers=self.headers,
            json={
                "items": [{"product_id": "test", "size": "50g", "quantity": 24}],
                "notes": "Test order"
            }
        )
        
        assert response.status_code == 200, f"B2B order failed: {response.text}"
        data = response.json()
        
        assert "status" in data, "Status not returned"
        assert data["status"] == "pending_pricing", "Expected pending_pricing status"
        
        print(f"SUCCESS: B2B order placeholder - status: {data['status']}")


class TestAdminRetailerEndpoints:
    """Test admin endpoints for retailer management"""
    
    @pytest.fixture(autouse=True)
    def get_admin_token(self):
        """Get admin auth token via 2FA flow"""
        # Initiate login
        init_response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if init_response.status_code != 200:
            pytest.skip("Admin 2FA initiation failed - skipping admin tests")
        
        # For testing, use dev bypass or skip
        # In real scenario, would need OTP from email
        self.headers = {}  # Would need authenticated session
    
    def test_admin_retailers_performance_requires_auth(self):
        """Test admin retailers performance endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/retailers/performance")
        
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Admin retailers performance correctly requires auth")
    
    def test_admin_retailers_grievances_requires_auth(self):
        """Test admin retailers grievances endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/retailers/grievances")
        
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Admin retailers grievances correctly requires auth")
    
    def test_admin_retailers_messages_requires_auth(self):
        """Test admin retailers messages endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/admin/retailers/messages")
        
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403, got {response.status_code}"
        print("SUCCESS: Admin retailers messages correctly requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
