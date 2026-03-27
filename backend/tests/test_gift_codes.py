"""
Test Gift Codes System for Addrika E-commerce Platform
Tests Birthday (20%), Anniversary (15%), and Festival (10%) gift codes

Test Coverage:
- Gift code stats API for admin
- Birthday/Anniversary code validation (requires login)
- Festival code creation and validation
- Discount percentages verification
- Festival code deactivation
"""
import pytest
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://forgot-pass-4.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PASSWORD = "110078"


class TestGiftCodePublicAPI:
    """Test public gift code info endpoint"""
    
    def test_gift_codes_info_endpoint(self):
        """Test public /api/gift-codes/info returns correct discount percentages"""
        response = requests.get(f"{BASE_URL}/api/gift-codes/info")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify discount percentages
        assert data["birthday_code"] == "HAPPYBDAY", f"Expected HAPPYBDAY, got {data['birthday_code']}"
        assert data["anniversary_code"] == "ANNIVERSARY", f"Expected ANNIVERSARY, got {data['anniversary_code']}"
        assert data["birthday_discount"] == "20% OFF", f"Expected '20% OFF', got {data['birthday_discount']}"
        assert data["anniversary_discount"] == "15% OFF", f"Expected '15% OFF', got {data['anniversary_discount']}"
        assert data["festival_discount"] == "10% OFF", f"Expected '10% OFF', got {data['festival_discount']}"
        
        print(f"✅ Gift codes info verified: Birthday={data['birthday_discount']}, Anniversary={data['anniversary_discount']}, Festival={data['festival_discount']}")


class TestGiftCodeValidation:
    """Test gift code validation via discount API"""
    
    def test_birthday_code_without_login(self):
        """HAPPYBDAY code should require login"""
        response = requests.post(
            f"{BASE_URL}/api/discount-codes/validate",
            params={"code": "HAPPYBDAY", "subtotal": 500}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "login" in data.get("detail", "").lower(), f"Expected login required message, got: {data}"
        print("✅ HAPPYBDAY code correctly requires login")
    
    def test_anniversary_code_without_login(self):
        """ANNIVERSARY code should require login"""
        response = requests.post(
            f"{BASE_URL}/api/discount-codes/validate",
            params={"code": "ANNIVERSARY", "subtotal": 500}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        assert "login" in data.get("detail", "").lower(), f"Expected login required message, got: {data}"
        print("✅ ANNIVERSARY code correctly requires login")
    
    def test_minimum_cart_value_check(self):
        """Any coupon should require minimum cart value of ₹249"""
        response = requests.post(
            f"{BASE_URL}/api/discount-codes/validate",
            params={"code": "TESTCODE", "subtotal": 100}  # Below minimum
        )
        
        # Should fail with minimum cart value message (400) or invalid code (404)
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        if response.status_code == 400:
            data = response.json()
            assert "249" in data.get("detail", ""), f"Expected minimum cart value message, got: {data}"
        print("✅ Minimum cart value check working")


class TestAdminGiftCodeStats:
    """Test admin gift code stats endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token via admin login endpoint"""
        self.session = requests.Session()
        
        # Login as admin via /api/admin/login
        login_response = self.session.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        # Get session token from response
        login_data = login_response.json()
        self.session_token = login_data.get("session_token") or self.session.cookies.get('session_token')
        if self.session_token:
            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
        print(f"Admin logged in successfully")
    
    def test_admin_gift_code_stats(self):
        """Test GET /api/gift-codes/admin/stats returns expected data"""
        response = self.session.get(f"{BASE_URL}/api/gift-codes/admin/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "birthday_code" in data, "Missing birthday_code field"
        assert "anniversary_code" in data, "Missing anniversary_code field"
        assert "birthday_discount" in data, "Missing birthday_discount field"
        assert "anniversary_discount" in data, "Missing anniversary_discount field"
        assert "festival_discount" in data, "Missing festival_discount field"
        
        # Verify discount percentages
        assert data["birthday_discount"] == 20, f"Expected birthday_discount=20, got {data['birthday_discount']}"
        assert data["anniversary_discount"] == 15, f"Expected anniversary_discount=15, got {data['anniversary_discount']}"
        assert data["festival_discount"] == 10, f"Expected festival_discount=10, got {data['festival_discount']}"
        
        # Verify codes
        assert data["birthday_code"] == "HAPPYBDAY", f"Expected HAPPYBDAY, got {data['birthday_code']}"
        assert data["anniversary_code"] == "ANNIVERSARY", f"Expected ANNIVERSARY, got {data['anniversary_code']}"
        
        # Verify other expected fields exist
        assert "upcoming_birthdays_7d" in data, "Missing upcoming_birthdays_7d"
        assert "upcoming_anniversaries_7d" in data, "Missing upcoming_anniversaries_7d"
        assert "active_festival_codes" in data, "Missing active_festival_codes"
        
        print(f"✅ Admin gift code stats verified:")
        print(f"   - Birthday: {data['birthday_code']} = {data['birthday_discount']}%")
        print(f"   - Anniversary: {data['anniversary_code']} = {data['anniversary_discount']}%")
        print(f"   - Festival: {data['festival_discount']}%")
        print(f"   - Upcoming birthdays (7d): {data['upcoming_birthdays_7d']}")
        print(f"   - Upcoming anniversaries (7d): {data['upcoming_anniversaries_7d']}")
        print(f"   - Active festival codes: {len(data.get('active_festival_codes', []))}")


class TestFestivalCodeCRUD:
    """Test festival code creation and deactivation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin session token via admin login endpoint"""
        self.session = requests.Session()
        
        # Login as admin via /api/admin/login
        login_response = self.session.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        # Get session token from response
        login_data = login_response.json()
        self.session_token = login_data.get("session_token") or self.session.cookies.get('session_token')
        if self.session_token:
            self.session.headers.update({"Authorization": f"Bearer {self.session_token}"})
    
    def test_create_festival_code(self):
        """Test creating a festival code via admin API"""
        # Generate unique festival name with timestamp
        timestamp = int(time.time())
        festival_name = f"TestFest{timestamp}"
        
        today = datetime.now()
        start_date = today.strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = self.session.post(
            f"{BASE_URL}/api/gift-codes/admin/festivals/create-code",
            json={
                "festival_name": festival_name,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response
        assert "code" in data, "Missing code in response"
        assert "discount_percent" in data, "Missing discount_percent in response"
        assert data["discount_percent"] == 10, f"Expected festival discount 10%, got {data['discount_percent']}%"
        
        # Code format should be FESTIVALNAME2026
        expected_code_start = festival_name.upper().replace(" ", "")
        assert data["code"].startswith(expected_code_start), f"Expected code starting with {expected_code_start}, got {data['code']}"
        
        print(f"✅ Festival code created: {data['code']} = {data['discount_percent']}% OFF")
        
        # Store for cleanup/validation
        self.created_code = data["code"]
        
        return data["code"]
    
    def test_validate_festival_code(self):
        """Test validating a festival code returns 10% discount"""
        # First check if there are any active festival codes
        stats_response = self.session.get(f"{BASE_URL}/api/gift-codes/admin/stats")
        
        if stats_response.status_code != 200:
            pytest.skip("Could not fetch gift code stats")
        
        stats = stats_response.json()
        active_codes = stats.get("active_festival_codes", [])
        
        if not active_codes:
            # Create a new festival code for testing
            timestamp = int(time.time())
            festival_name = f"ValidTest{timestamp}"
            today = datetime.now()
            
            create_response = self.session.post(
                f"{BASE_URL}/api/gift-codes/admin/festivals/create-code",
                json={
                    "festival_name": festival_name,
                    "start_date": today.strftime("%Y-%m-%d"),
                    "end_date": (today + timedelta(days=30)).strftime("%Y-%m-%d")
                }
            )
            
            if create_response.status_code != 200:
                pytest.skip("Could not create festival code for validation test")
            
            test_code = create_response.json()["code"]
        else:
            test_code = active_codes[0]["code"]
        
        # Validate the code
        validate_response = requests.post(
            f"{BASE_URL}/api/discount-codes/validate",
            params={"code": test_code, "subtotal": 500}
        )
        
        assert validate_response.status_code == 200, f"Expected 200, got {validate_response.status_code}: {validate_response.text}"
        
        data = validate_response.json()
        
        assert data["valid"] == True, f"Expected valid=True, got {data['valid']}"
        assert data["discountType"] == "percentage", f"Expected discountType=percentage, got {data['discountType']}"
        assert data["discountValue"] == 10, f"Expected discountValue=10, got {data['discountValue']}"
        
        # 10% of 500 = 50
        assert data["discountAmount"] == 50, f"Expected discountAmount=50, got {data['discountAmount']}"
        
        print(f"✅ Festival code {test_code} validated: {data['discountValue']}% = ₹{data['discountAmount']} off")
    
    def test_get_active_festival_codes(self):
        """Test fetching active festival codes list"""
        response = self.session.get(f"{BASE_URL}/api/gift-codes/admin/festivals/active-codes")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "codes" in data, "Missing codes field in response"
        
        print(f"✅ Active festival codes: {len(data['codes'])} codes found")
        for code in data["codes"][:5]:  # Show first 5
            print(f"   - {code.get('code')}: {code.get('discount_percent', 10)}% (used: {code.get('times_used', 0)})")
    
    def test_deactivate_festival_code(self):
        """Test deactivating a festival code"""
        # First create a code to deactivate
        timestamp = int(time.time())
        festival_name = f"DeactTest{timestamp}"
        today = datetime.now()
        
        create_response = self.session.post(
            f"{BASE_URL}/api/gift-codes/admin/festivals/create-code",
            json={
                "festival_name": festival_name,
                "start_date": today.strftime("%Y-%m-%d"),
                "end_date": (today + timedelta(days=30)).strftime("%Y-%m-%d")
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create festival code for deactivation test")
        
        test_code = create_response.json()["code"]
        print(f"Created code for deactivation test: {test_code}")
        
        # Deactivate it
        deactivate_response = self.session.delete(
            f"{BASE_URL}/api/gift-codes/admin/festivals/deactivate/{test_code}"
        )
        
        assert deactivate_response.status_code == 200, f"Expected 200, got {deactivate_response.status_code}: {deactivate_response.text}"
        
        data = deactivate_response.json()
        assert "deactivated" in data.get("message", "").lower() or test_code in data.get("message", ""), \
            f"Expected deactivation confirmation, got: {data}"
        
        print(f"✅ Festival code {test_code} deactivated successfully")
        
        # Verify code no longer validates
        validate_response = requests.post(
            f"{BASE_URL}/api/discount-codes/validate",
            params={"code": test_code, "subtotal": 500}
        )
        
        # Should fail with 404 (not found) or 400 (expired/inactive)
        assert validate_response.status_code in [400, 404], \
            f"Deactivated code should fail validation, got {validate_response.status_code}"
        
        print(f"✅ Deactivated code correctly fails validation")


class TestGiftCodeConfiguration:
    """Verify gift code discount configuration constants"""
    
    def test_discount_percentages_from_config(self):
        """Verify discount percentages match requirements"""
        # This test verifies the public info endpoint which sources from service config
        response = requests.get(f"{BASE_URL}/api/gift-codes/info")
        
        assert response.status_code == 200
        data = response.json()
        
        # Birthday: 20% OFF
        assert "20%" in data["birthday_discount"], f"Birthday should be 20%, got {data['birthday_discount']}"
        
        # Anniversary: 15% OFF
        assert "15%" in data["anniversary_discount"], f"Anniversary should be 15%, got {data['anniversary_discount']}"
        
        # Festival: 10% OFF
        assert "10%" in data["festival_discount"], f"Festival should be 10%, got {data['festival_discount']}"
        
        print("✅ All discount percentages verified:")
        print(f"   - Birthday: {data['birthday_discount']} ✓")
        print(f"   - Anniversary: {data['anniversary_discount']} ✓")
        print(f"   - Festival: {data['festival_discount']} ✓")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
