"""
Backend tests for Admin features - Iteration 7
Tests:
- Admin login with new password 110078
- Admin stats/revenue tracking
- Purge endpoints for discounts and coupon usage
- Admin password change endpoint
- Inquiry creation with email notification
"""
import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PASSWORD = "110078"


class TestAdminLogin:
    """Test admin login with new password"""
    
    def test_admin_login_success(self):
        """Test admin login with password 110078"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "session_token" in data, "No session token returned"
        assert data.get("is_admin") == True, "is_admin should be True"
        assert "user" in data, "No user data returned"
        print(f"✅ Admin login successful with password {ADMIN_PASSWORD}")
    
    def test_admin_login_wrong_password(self):
        """Test admin login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": "wrong123"},
            timeout=10
        )
        assert response.status_code == 401, f"Should reject wrong password: {response.text}"
        print("✅ Wrong password correctly rejected")


class TestAdminStats:
    """Test admin statistics and revenue tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Setup login failed: {response.text}"
        self.cookies = response.cookies
    
    def test_get_admin_stats(self):
        """Test admin stats endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 200, f"Stats request failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "orders" in data, "Missing orders stats"
        assert "revenue" in data, "Missing revenue stats"
        assert "users" in data, "Missing users stats"
        assert "inquiries" in data, "Missing inquiries stats"
        
        # Verify revenue structure
        assert "total" in data["revenue"], "Missing total revenue"
        assert isinstance(data["revenue"]["total"], (int, float)), "Revenue total should be numeric"
        
        print(f"✅ Admin stats returned correctly. Revenue: ₹{data['revenue']['total']}")


class TestPurgeEndpoints:
    """Test purge endpoints for discounts and coupon usage"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Setup login failed: {response.text}"
        self.cookies = response.cookies
    
    def test_purge_discounts_without_confirmation(self):
        """Test purge discounts requires confirmation"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/discount-codes/purge/all",
            json={},
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 400, f"Should require confirmation: {response.text}"
        data = response.json()
        assert "PURGE_ALL_DISCOUNTS" in data.get("detail", ""), "Should mention confirmation string"
        print("✅ Purge discounts correctly requires confirmation")
    
    def test_purge_coupon_usage_without_confirmation(self):
        """Test purge coupon usage requires confirmation"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/discount-code-usage/purge/all",
            json={},
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 400, f"Should require confirmation: {response.text}"
        data = response.json()
        assert "PURGE_ALL_USAGE" in data.get("detail", ""), "Should mention confirmation string"
        print("✅ Purge coupon usage correctly requires confirmation")
    
    def test_purge_discounts_endpoint_exists(self):
        """Test that purge discounts endpoint is accessible"""
        # Just test that the endpoint is registered and requires auth
        response = requests.delete(
            f"{BASE_URL}/api/admin/discount-codes/purge/all",
            json={"confirm": "PURGE_ALL_DISCOUNTS"},
            cookies=self.cookies,
            timeout=10
        )
        # Should return 200 (successful purge) or other status but not 404
        assert response.status_code != 404, f"Endpoint not found: {response.text}"
        print(f"✅ Purge discounts endpoint exists (status: {response.status_code})")
    
    def test_purge_coupon_usage_endpoint_exists(self):
        """Test that purge coupon usage endpoint is accessible"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/discount-code-usage/purge/all",
            json={"confirm": "PURGE_ALL_USAGE"},
            cookies=self.cookies,
            timeout=10
        )
        # Should return 200 (successful purge) or other status but not 404
        assert response.status_code != 404, f"Endpoint not found: {response.text}"
        print(f"✅ Purge coupon usage endpoint exists (status: {response.status_code})")


class TestAdminPasswordChange:
    """Test admin password change endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Setup login failed: {response.text}"
        self.cookies = response.cookies
    
    def test_change_password_wrong_current(self):
        """Test change password fails with wrong current password"""
        response = requests.post(
            f"{BASE_URL}/api/admin/change-password",
            json={
                "currentPassword": "wrongcurrent",
                "newPassword": "newpassword",
                "confirmPassword": "newpassword"
            },
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 401, f"Should reject wrong current password: {response.text}"
        print("✅ Wrong current password correctly rejected")
    
    def test_change_password_mismatch(self):
        """Test change password fails when new passwords don't match"""
        response = requests.post(
            f"{BASE_URL}/api/admin/change-password",
            json={
                "currentPassword": ADMIN_PASSWORD,
                "newPassword": "newpassword1",
                "confirmPassword": "newpassword2"
            },
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 400, f"Should reject mismatched passwords: {response.text}"
        print("✅ Mismatched passwords correctly rejected")
    
    def test_change_password_too_short(self):
        """Test change password fails when new password is too short"""
        response = requests.post(
            f"{BASE_URL}/api/admin/change-password",
            json={
                "currentPassword": ADMIN_PASSWORD,
                "newPassword": "123",
                "confirmPassword": "123"
            },
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 400, f"Should reject short password: {response.text}"
        print("✅ Short password correctly rejected")
    
    def test_change_password_endpoint_exists(self):
        """Test that change password endpoint is accessible"""
        # We won't actually change the password in tests, just verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/admin/change-password",
            json={
                "currentPassword": ADMIN_PASSWORD,
                "newPassword": ADMIN_PASSWORD,  # Same password - should fail
                "confirmPassword": ADMIN_PASSWORD
            },
            cookies=self.cookies,
            timeout=10
        )
        # Should return 400 (same password) but not 404
        assert response.status_code != 404, f"Endpoint not found: {response.text}"
        print(f"✅ Password change endpoint exists (status: {response.status_code})")


class TestInquiryCreation:
    """Test inquiry creation and email notification"""
    
    def test_create_inquiry(self):
        """Test creating a new inquiry"""
        inquiry_data = {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "9876543210",
            "fragrance": "Kesar Chandan",
            "packageSize": "50g",
            "quantity": 10,
            "message": "This is a test inquiry for testing email notifications",
            "type": "wholesale"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/inquiries",
            json=inquiry_data,
            timeout=15
        )
        assert response.status_code == 200, f"Inquiry creation failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "No message in response"
        assert data["message"] == "Inquiry submitted successfully", "Unexpected message"
        assert "inquiry" in data, "No inquiry data returned"
        assert data["inquiry"]["email"] == inquiry_data["email"].lower(), "Email mismatch"
        
        print(f"✅ Inquiry created successfully: {data['inquiry'].get('inquiry_id', 'N/A')}")
    
    def test_get_inquiries(self):
        """Test retrieving inquiries"""
        response = requests.get(
            f"{BASE_URL}/api/inquiries",
            timeout=10
        )
        assert response.status_code == 200, f"Get inquiries failed: {response.text}"
        data = response.json()
        
        assert "inquiries" in data, "Missing inquiries array"
        assert "total" in data, "Missing total count"
        assert isinstance(data["inquiries"], list), "Inquiries should be a list"
        
        print(f"✅ Retrieved {data['total']} inquiries")


class TestDiscountCodeManagement:
    """Test discount code listing and management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookie"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Setup login failed: {response.text}"
        self.cookies = response.cookies
    
    def test_list_discount_codes(self):
        """Test listing discount codes"""
        response = requests.get(
            f"{BASE_URL}/api/admin/discount-codes",
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 200, f"List discounts failed: {response.text}"
        data = response.json()
        
        assert "codes" in data, "Missing codes array"
        assert isinstance(data["codes"], list), "Codes should be a list"
        
        print(f"✅ Retrieved {len(data['codes'])} discount codes")
    
    def test_get_discount_code_usage(self):
        """Test getting discount code usage logs"""
        response = requests.get(
            f"{BASE_URL}/api/admin/discount-code-usage",
            cookies=self.cookies,
            timeout=10
        )
        assert response.status_code == 200, f"Get usage failed: {response.text}"
        data = response.json()
        
        assert "usage_logs" in data, "Missing usage_logs array"
        assert "total" in data, "Missing total count"
        assert "stats" in data, "Missing stats"
        
        print(f"✅ Retrieved discount code usage data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
