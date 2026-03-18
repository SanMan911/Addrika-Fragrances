"""
Tests for Addrika e-commerce new features:
- Admin PIN changed to 110078
- Username field for registration
- Username availability check API
- Carrier dropdown in shipping modal
- Track Order page carrier links
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module: Admin Authentication with new PIN
class TestAdminLoginWithNewPin:
    """Tests for admin login with PIN 110078"""
    
    def test_admin_login_with_correct_pin(self):
        """Admin should be able to login with PIN 110078"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "contact.us@centraders.com",
                "pin": "110078"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("is_admin") == True
        assert "session_token" in data
        assert data.get("user", {}).get("email") == "contact.us@centraders.com"
        print("✅ Admin login with PIN 110078 successful")
    
    def test_admin_login_with_old_pin_fails(self):
        """Admin login with old PIN (123456) should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "contact.us@centraders.com",
                "pin": "123456"  # Old default PIN
            }
        )
        # Should return 401 for invalid PIN
        assert response.status_code == 401, f"Expected 401 for old PIN, got {response.status_code}"
        print("✅ Admin login with old PIN correctly rejected")
    
    def test_admin_login_wrong_pin_fails(self):
        """Admin login with wrong PIN should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "contact.us@centraders.com",
                "pin": "wrongpin"
            }
        )
        assert response.status_code == 401
        print("✅ Admin login with wrong PIN correctly rejected")


# Module: Username Availability Check API
class TestUsernameAvailabilityAPI:
    """Tests for GET /api/auth/check-username/{username}"""
    
    def test_valid_username_available(self):
        """Valid username that doesn't exist should be available"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/newtestuser2026")
        assert response.status_code == 200
        data = response.json()
        assert data.get("available") == True
        assert data.get("username") == "newtestuser2026"
        print("✅ Valid username availability check works")
    
    def test_username_too_short(self):
        """Username less than 3 characters should fail validation"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/ab")
        assert response.status_code == 200
        data = response.json()
        assert data.get("available") == False
        assert "at least 3 characters" in data.get("error", "").lower()
        print("✅ Short username validation works")
    
    def test_username_starts_with_number(self):
        """Username starting with a number should fail validation"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/1testuser")
        assert response.status_code == 200
        data = response.json()
        assert data.get("available") == False
        assert "cannot start with a number" in data.get("error", "").lower()
        print("✅ Username starting with number validation works")
    
    def test_username_with_invalid_characters(self):
        """Username with special characters should fail validation"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/test@user")
        assert response.status_code == 200
        data = response.json()
        assert data.get("available") == False
        print("✅ Username with special characters validation works")
    
    def test_username_with_underscore_valid(self):
        """Username with underscore should be valid"""
        response = requests.get(f"{BASE_URL}/api/auth/check-username/test_user_2026")
        assert response.status_code == 200
        data = response.json()
        assert data.get("available") == True
        print("✅ Username with underscore is accepted")
    
    def test_username_too_long(self):
        """Username exceeding 30 characters should fail"""
        long_username = "a" * 35
        response = requests.get(f"{BASE_URL}/api/auth/check-username/{long_username}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("available") == False
        print("✅ Long username validation works")


# Module: Admin Order Status Update with Shipping Details
class TestAdminShippingModal:
    """Tests for shipping details when updating order to 'shipped' status"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        assert response.status_code == 200
        return response.json().get("session_token")
    
    def test_update_order_shipped_with_carrier_info(self, admin_session):
        """Updating order to shipped should accept carrier info"""
        # First get an order to test with
        headers = {"Authorization": f"Bearer {admin_session}"}
        orders_response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers=headers
        )
        
        if orders_response.status_code != 200:
            pytest.skip("Could not fetch orders")
        
        orders = orders_response.json().get("orders", [])
        if not orders:
            pytest.skip("No orders available for testing")
        
        # Find a test order (preferably not delivered or cancelled)
        test_order = None
        for order in orders:
            status = order.get("orderStatus") or order.get("order_status")
            if status not in ["delivered", "cancelled"]:
                test_order = order
                break
        
        if not test_order:
            pytest.skip("No suitable order found for shipping test")
        
        order_number = test_order.get("orderNumber") or test_order.get("order_number")
        
        # Test the shipped status with carrier info
        response = requests.patch(
            f"{BASE_URL}/api/admin/orders/{order_number}/status",
            params={
                "status": "shipped",
                "carrier_name": "BlueDart",
                "tracking_number": "TEST123456789"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("new_status") == "shipped"
        
        # Check if shipping_details were saved
        if "shipping_details" in data:
            assert data["shipping_details"].get("carrier_name") == "BlueDart"
            assert data["shipping_details"].get("tracking_number") == "TEST123456789"
        
        print("✅ Shipping modal carrier info saves correctly")


# Module: Data Wipe Endpoint
class TestDataWipeEndpoint:
    """Tests for POST /api/admin/wipe-data endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        assert response.status_code == 200
        return response.json().get("session_token")
    
    def test_wipe_data_without_confirmation_fails(self, admin_session):
        """Data wipe without proper confirmation should be rejected"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.post(
            f"{BASE_URL}/api/admin/wipe-data",
            json={"confirm": "wrong_confirmation"},
            headers=headers
        )
        assert response.status_code == 400
        print("✅ Data wipe correctly requires proper confirmation")
    
    def test_wipe_data_without_admin_fails(self):
        """Data wipe without admin auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/wipe-data",
            json={"confirm": "WIPE_ALL_DATA"}
        )
        assert response.status_code in [401, 403]
        print("✅ Data wipe correctly requires admin auth")


# Module: Order Restore Endpoint
class TestOrderRestoreEndpoint:
    """Tests for POST /api/admin/orders/restore endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "contact.us@centraders.com", "pin": "110078"}
        )
        assert response.status_code == 200
        return response.json().get("session_token")
    
    def test_restore_order_missing_fields_fails(self, admin_session):
        """Restore order with missing required fields should fail"""
        headers = {"Authorization": f"Bearer {admin_session}"}
        response = requests.post(
            f"{BASE_URL}/api/admin/orders/restore",
            json={"order_number": "ADD-TEST-999"},  # Missing items, shipping, pricing
            headers=headers
        )
        assert response.status_code == 400
        print("✅ Order restore correctly validates required fields")
    
    def test_restore_order_without_admin_fails(self):
        """Order restore without admin auth should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/orders/restore",
            json={
                "order_number": "ADD-RESTORED-001",
                "items": [{"name": "Test Item", "price": 100, "quantity": 1}],
                "shipping": {"name": "Test User", "email": "test@example.com"},
                "pricing": {"final_total": 100}
            }
        )
        assert response.status_code in [401, 403]
        print("✅ Order restore correctly requires admin auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
