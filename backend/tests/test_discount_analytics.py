"""
Test Discount Code Analytics and Management Features
- Delete coupon with confirmation
- Toggle coupon active/inactive status
- Analytics: discount-code-performance endpoint
- Analytics: discount-code-usage endpoint
- Per-coupon usage history
"""
import pytest
import requests
import os
import time
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://addrika-kyc-onboard.preview.emergentagent.com')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'addrika_db')

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


def get_otp_from_db(token_id: str) -> str:
    """Fetch OTP from MongoDB for testing"""
    async def _get_otp():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        token = await db.admin_2fa_tokens.find_one({"token_id": token_id})
        client.close()
        return token.get("otp") if token else None
    
    return asyncio.get_event_loop().run_until_complete(_get_otp())


def get_admin_session():
    """Get admin session token via 2FA flow with OTP from DB"""
    session = requests.Session()
    
    # Step 1: Initiate login
    initiate_res = session.post(f"{BASE_URL}/api/admin/login/initiate", json={
        "email": ADMIN_EMAIL,
        "pin": ADMIN_PIN
    })
    
    if initiate_res.status_code != 200:
        return None, f"Admin login initiate failed: {initiate_res.status_code} - {initiate_res.text}"
    
    data = initiate_res.json()
    token_id = data.get("token_id")
    
    if not token_id:
        return None, "No token_id received from login initiate"
    
    # Get OTP from MongoDB
    otp = get_otp_from_db(token_id)
    
    if not otp:
        return None, "Could not retrieve OTP from database"
    
    # Step 2: Verify OTP
    verify_res = session.post(f"{BASE_URL}/api/admin/login/verify-otp", json={
        "token_id": token_id,
        "otp": otp
    })
    
    if verify_res.status_code != 200:
        return None, f"Admin OTP verification failed: {verify_res.status_code} - {verify_res.text}"
    
    return session, None


class TestAdminAuth:
    """Admin authentication for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        session, error = get_admin_session()
        if error:
            pytest.skip(error)
        return session
    
    def test_admin_login_works(self, admin_session):
        """Verify admin session is valid"""
        assert admin_session is not None
        print("Admin session established successfully")


class TestDiscountCodePerformance:
    """Test discount code performance analytics endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        session, error = get_admin_session()
        if error:
            pytest.skip(error)
        return session
    
    def test_get_discount_code_performance(self, admin_session):
        """Test GET /api/admin/discount-code-performance returns correct structure"""
        res = admin_session.get(f"{BASE_URL}/api/admin/discount-code-performance")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        
        # Verify response structure
        assert "performance" in data, "Response should have 'performance' key"
        assert "summary" in data, "Response should have 'summary' key"
        
        # Verify summary structure
        summary = data["summary"]
        expected_summary_keys = [
            "total_codes_used",
            "total_orders_with_discount",
            "total_discount_given",
            "total_cart_value",
            "total_customers"
        ]
        for key in expected_summary_keys:
            assert key in summary, f"Summary should have '{key}' key"
        
        print(f"Performance data: {len(data['performance'])} codes")
        print(f"Summary: {summary}")
    
    def test_get_discount_code_usage(self, admin_session):
        """Test GET /api/admin/discount-code-usage returns correct structure"""
        res = admin_session.get(f"{BASE_URL}/api/admin/discount-code-usage?limit=100")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        
        # Verify response structure
        assert "usage_logs" in data, "Response should have 'usage_logs' key"
        assert "total" in data, "Response should have 'total' key"
        assert "stats" in data, "Response should have 'stats' key"
        
        # Verify stats structure
        stats = data["stats"]
        expected_stats_keys = ["total_discount_amount", "total_uses", "unique_users"]
        for key in expected_stats_keys:
            assert key in stats, f"Stats should have '{key}' key"
        
        print(f"Usage logs: {len(data['usage_logs'])} entries")
        print(f"Stats: {stats}")
    
    def test_get_discount_code_usage_by_code(self, admin_session):
        """Test GET /api/admin/discount-code-usage with code filter"""
        # First get list of codes
        codes_res = admin_session.get(f"{BASE_URL}/api/admin/discount-codes")
        
        if codes_res.status_code != 200:
            pytest.skip("Could not fetch discount codes")
        
        codes_data = codes_res.json()
        codes = codes_data.get("codes", [])
        
        if not codes:
            pytest.skip("No discount codes available to test")
        
        # Test with first code
        test_code = codes[0]["code"]
        res = admin_session.get(f"{BASE_URL}/api/admin/discount-code-usage?code={test_code}&limit=100")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "usage_logs" in data
        
        # All logs should be for the specified code
        for log in data["usage_logs"]:
            assert log["code"] == test_code, f"Log code {log['code']} should match filter {test_code}"
        
        print(f"Usage logs for {test_code}: {len(data['usage_logs'])} entries")


class TestDiscountCodeCRUD:
    """Test discount code CRUD operations including delete and toggle"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        session, error = get_admin_session()
        if error:
            pytest.skip(error)
        return session
    
    def test_create_coupon(self, admin_session):
        """Test creating a new coupon"""
        test_code = f"TEST{int(time.time()) % 100000}"  # Keep under 20 chars
        
        payload = {
            "code": test_code,
            "discountType": "percentage",
            "discountValue": 15,
            "minOrderValue": 500,
            "maxDiscount": 200,
            "maxUses": 100,
            "usageType": "universal",
            "expiresAt": None,
            "description": "Test coupon for analytics testing"
        }
        
        res = admin_session.post(f"{BASE_URL}/api/admin/discount-codes", json=payload)
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "code" in data, "Response should have 'code' key"
        assert data["code"]["code"] == test_code.upper()
        
        print(f"Created coupon: {test_code}")
        
        # Store for cleanup
        return test_code.upper()
    
    def test_toggle_coupon_status(self, admin_session):
        """Test toggling coupon active/inactive status"""
        # First get list of codes
        codes_res = admin_session.get(f"{BASE_URL}/api/admin/discount-codes")
        
        if codes_res.status_code != 200:
            pytest.skip("Could not fetch discount codes")
        
        codes_data = codes_res.json()
        codes = codes_data.get("codes", [])
        
        if not codes:
            pytest.skip("No discount codes available to test")
        
        # Find a test code or use first available
        test_coupon = None
        for code in codes:
            if code["code"].startswith("TEST_"):
                test_coupon = code
                break
        
        if not test_coupon:
            test_coupon = codes[0]
        
        original_status = test_coupon.get("is_active", True)
        coupon_id = test_coupon.get("_id") or test_coupon.get("code")
        
        # Toggle status
        res = admin_session.patch(f"{BASE_URL}/api/admin/discount-codes/{coupon_id}/toggle")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "is_active" in data, "Response should have 'is_active' key"
        assert data["is_active"] != original_status, "Status should be toggled"
        
        print(f"Toggled coupon {test_coupon['code']}: {original_status} -> {data['is_active']}")
        
        # Toggle back to original
        admin_session.patch(f"{BASE_URL}/api/admin/discount-codes/{coupon_id}/toggle")
    
    def test_delete_coupon(self, admin_session):
        """Test deleting a coupon"""
        # Create a test coupon to delete
        test_code = f"TESTDEL{int(time.time()) % 10000}"  # Keep under 20 chars
        
        create_payload = {
            "code": test_code,
            "discountType": "percentage",
            "discountValue": 10,
            "minOrderValue": 0,
            "maxDiscount": None,
            "maxUses": None,
            "usageType": "universal",
            "expiresAt": None,
            "description": "Test coupon for deletion"
        }
        
        create_res = admin_session.post(f"{BASE_URL}/api/admin/discount-codes", json=create_payload)
        
        if create_res.status_code != 200:
            pytest.skip(f"Could not create test coupon: {create_res.text}")
        
        created_data = create_res.json()
        coupon_id = created_data["code"].get("_id") or test_code.upper()
        
        # Delete the coupon
        delete_res = admin_session.delete(f"{BASE_URL}/api/admin/discount-codes/{coupon_id}")
        
        assert delete_res.status_code == 200, f"Expected 200, got {delete_res.status_code}: {delete_res.text}"
        
        data = delete_res.json()
        assert "message" in data
        assert "deleted" in data["message"].lower()
        
        print(f"Deleted coupon: {test_code}")
        
        # Verify deletion - should not find the code
        codes_res = admin_session.get(f"{BASE_URL}/api/admin/discount-codes")
        codes = codes_res.json().get("codes", [])
        
        for code in codes:
            assert code["code"] != test_code.upper(), "Deleted coupon should not appear in list"
    
    def test_list_discount_codes(self, admin_session):
        """Test listing all discount codes"""
        res = admin_session.get(f"{BASE_URL}/api/admin/discount-codes")
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        
        data = res.json()
        assert "codes" in data, "Response should have 'codes' key"
        
        # Verify code structure
        if data["codes"]:
            code = data["codes"][0]
            expected_keys = ["code", "discount_type", "discount_value", "is_active"]
            for key in expected_keys:
                assert key in code, f"Code should have '{key}' key"
        
        print(f"Listed {len(data['codes'])} discount codes")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token via 2FA flow"""
        session, error = get_admin_session()
        if error:
            pytest.skip(error)
        return session
    
    def test_cleanup_test_coupons(self, admin_session):
        """Clean up TEST_ prefixed coupons"""
        codes_res = admin_session.get(f"{BASE_URL}/api/admin/discount-codes")
        
        if codes_res.status_code != 200:
            pytest.skip("Could not fetch discount codes for cleanup")
        
        codes = codes_res.json().get("codes", [])
        deleted_count = 0
        
        for code in codes:
            if code["code"].startswith("TEST_"):
                coupon_id = code.get("_id") or code["code"]
                delete_res = admin_session.delete(f"{BASE_URL}/api/admin/discount-codes/{coupon_id}")
                if delete_res.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test coupons")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
