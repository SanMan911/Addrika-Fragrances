"""
Test Admin Routes after Backend Refactoring
Tests all admin endpoints from the refactored modular admin router structure:
- admin_auth.py: Authentication routes (2FA login flow)
- admin_orders.py: Order management routes
- admin_discounts.py: Discount code management
- admin_users.py: User management
- admin_analytics.py: Analytics and revenue trends
- admin_shiprocket.py: ShipRocket integration
- admin_retailers.py: Retailer management
- admin_maintenance.py: Database maintenance

Admin credentials: contact.us@centraders.com / 110078
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Global session token for authenticated tests
admin_session_token = None
admin_2fa_token_id = None


class TestAdminAuth:
    """Test Admin Authentication endpoints (admin_auth.py)"""
    
    def test_01_admin_login_initiate(self):
        """Test POST /api/admin/login/initiate - Step 1 of 2FA flow"""
        global admin_2fa_token_id
        
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response contains required fields
        assert "token_id" in data, "Response should contain token_id"
        assert "email_masked" in data, "Response should contain email_masked"
        assert "message" in data, "Response should contain message"
        
        admin_2fa_token_id = data["token_id"]
        print(f"✓ Admin 2FA initiate: token_id received, email masked as {data['email_masked']}")
    
    def test_02_admin_login_initiate_wrong_pin(self):
        """Test POST /api/admin/login/initiate with wrong PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "contact.us@centraders.com", "pin": "999999"}
        )
        
        assert response.status_code == 401, f"Expected 401 for wrong PIN, got {response.status_code}"
        data = response.json()
        assert "Invalid PIN" in data.get("detail", ""), "Should indicate invalid PIN"
        print("✓ Admin 2FA with wrong PIN rejected correctly")
    
    def test_03_admin_login_initiate_non_admin_email(self):
        """Test POST /api/admin/login/initiate with non-admin email"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "random@example.com", "pin": "123456"}
        )
        
        assert response.status_code == 403, f"Expected 403 for non-admin email, got {response.status_code}"
        data = response.json()
        assert "Not an admin" in data.get("detail", ""), "Should indicate not an admin"
        print("✓ Non-admin email rejected correctly")
    
    def test_04_admin_login_initiate_missing_fields(self):
        """Test POST /api/admin/login/initiate with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "contact.us@centraders.com"}  # Missing pin
        )
        
        assert response.status_code == 400, f"Expected 400 for missing PIN, got {response.status_code}"
        print("✓ Missing fields handled correctly")
    
    def test_05_admin_verify_otp_invalid_token(self):
        """Test POST /api/admin/login/verify-otp with invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": "invalid_token_12345", "otp": "123456"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}"
        print("✓ Invalid token rejected correctly")
    
    def test_06_admin_verify_otp_missing_fields(self):
        """Test POST /api/admin/login/verify-otp with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": "some_token"}  # Missing OTP
        )
        
        assert response.status_code == 400, f"Expected 400 for missing OTP, got {response.status_code}"
        print("✓ Missing OTP handled correctly")
    
    def test_07_admin_legacy_login_redirects(self):
        """Test POST /api/admin/login (legacy endpoint) returns 400 with 2FA message"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        
        assert response.status_code == 400, f"Expected 400 for legacy login, got {response.status_code}"
        data = response.json()
        assert "2FA" in data.get("detail", ""), "Should mention 2FA flow"
        print("✓ Legacy login endpoint correctly redirects to 2FA")
    
    def test_08_admin_check_without_auth(self):
        """Test GET /api/admin/check without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/check")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("is_admin") == False, "Should return is_admin: false without auth"
        print("✓ Admin check returns false without auth")


class TestAdminStats:
    """Test Admin Stats endpoint (admin_auth.py - GET /stats)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - try to get a session token"""
        global admin_session_token
        if not admin_session_token:
            # For testing, we'll skip auth-required tests or use mock
            pass
        yield
    
    def test_admin_stats_without_auth(self):
        """Test GET /api/admin/stats without authentication - should fail"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        
        # Should return 401 or 403 without authentication
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin stats correctly requires authentication")


class TestAdminOrders:
    """Test Admin Order endpoints (admin_orders.py)"""
    
    def test_admin_orders_without_auth(self):
        """Test GET /api/admin/orders without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin orders correctly requires authentication")
    
    def test_admin_orders_with_status_filter(self):
        """Test GET /api/admin/orders with status parameter (without auth - should fail)"""
        response = requests.get(f"{BASE_URL}/api/admin/orders?status=pending")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin orders with filter correctly requires authentication")


class TestAdminDiscounts:
    """Test Admin Discount Code endpoints (admin_discounts.py)"""
    
    def test_discount_codes_without_auth(self):
        """Test GET /api/admin/discount-codes without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/discount-codes")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Discount codes correctly requires authentication")
    
    def test_discount_code_usage_without_auth(self):
        """Test GET /api/admin/discount-code-usage without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/discount-code-usage")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Discount code usage correctly requires authentication")
    
    def test_discount_code_performance_without_auth(self):
        """Test GET /api/admin/discount-code-performance without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/discount-code-performance")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Discount code performance correctly requires authentication")


class TestAdminAnalytics:
    """Test Admin Analytics endpoints (admin_analytics.py)"""
    
    def test_revenue_trends_without_auth(self):
        """Test GET /api/admin/revenue-trends without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/revenue-trends")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Revenue trends correctly requires authentication")
    
    def test_order_stats_without_auth(self):
        """Test GET /api/admin/order-stats without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/order-stats")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Order stats correctly requires authentication")


class TestAdminShipRocket:
    """Test Admin ShipRocket endpoints (admin_shiprocket.py)"""
    
    def test_shiprocket_status_without_auth(self):
        """Test GET /api/admin/shiprocket/status without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/shiprocket/status")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ ShipRocket status correctly requires authentication")
    
    def test_shipping_config_without_auth(self):
        """Test GET /api/admin/shipping-config without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/shipping-config")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Shipping config correctly requires authentication")


class TestAdminRetailers:
    """Test Admin Retailer endpoints (admin_retailers.py)"""
    
    def test_retailers_performance_without_auth(self):
        """Test GET /api/admin/retailers/performance without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/retailers/performance")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Retailers performance correctly requires authentication")
    
    def test_retailers_leaderboard_without_auth(self):
        """Test GET /api/admin/retailers/leaderboard without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/retailers/leaderboard")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Retailers leaderboard correctly requires authentication")
    
    def test_retailers_grievances_without_auth(self):
        """Test GET /api/admin/retailers/grievances without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/retailers/grievances")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Retailers grievances correctly requires authentication")


class TestAdminMaintenance:
    """Test Admin Database Maintenance endpoints (admin_maintenance.py)"""
    
    def test_database_stats_without_auth(self):
        """Test GET /api/admin/database/stats without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/database/stats")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Database stats correctly requires authentication")
    
    def test_activity_summary_without_auth(self):
        """Test GET /api/admin/activity-summary without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/activity-summary")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Activity summary correctly requires authentication")


class TestHealthAndPublic:
    """Test public endpoints to verify server is running"""
    
    def test_health_endpoint(self):
        """Test GET /api/health"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", "Health status should be 'healthy'"
        print(f"✓ Health check: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
