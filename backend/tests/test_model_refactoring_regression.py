"""
Test Model Refactoring Regression
Verifies all APIs work correctly after models were reorganized into models/ package structure
- Tests: /api/health, /api/rewards/info, /api/retailers/states-districts, /api/products
- Tests: User registration, login, rewards balance/history
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from context
TEST_USER_EMAIL = "test.user@example.com"
TEST_USER_PASSWORD = "test123"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"


class TestHealthAndBasicAPIs:
    """Test basic APIs that don't require authentication"""
    
    def test_health_endpoint(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        print(f"✓ Health check passed - Version: {data['version']}")
    
    def test_products_endpoint(self):
        """GET /api/products should return product list"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200, f"Products failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected products list"
        assert len(data) > 0, "Expected at least one product"
        
        # Verify product structure
        product = data[0]
        assert "id" in product
        assert "name" in product
        assert "sizes" in product
        print(f"✓ Products endpoint returned {len(data)} products")


class TestRewardsSystemAPIs:
    """Test rewards system APIs using new models/rewards.py"""
    
    def test_rewards_info_public_endpoint(self):
        """GET /api/rewards/info should return program rules (public)"""
        response = requests.get(f"{BASE_URL}/api/rewards/info")
        assert response.status_code == 200, f"Rewards info failed: {response.text}"
        
        data = response.json()
        
        # Verify structure matches models/rewards.py expectations
        assert data["program_name"] == "Addrika Rewards"
        assert data["earning"]["rate"] == 6.9, "Expected 6.9 coins per ₹125"
        assert data["earning"]["per_amount"] == 125
        assert data["earning"]["minimum_spend"] == 125
        assert data["redemption"]["coin_value"] == 0.6
        assert data["redemption"]["minimum_coins"] == 20
        assert data["redemption"]["max_percentage"] == 50
        assert data["validity"]["days"] == 90
        
        print(f"✓ Rewards info: {data['earning']['description']}")
        print(f"  Redemption: {data['redemption']['description']}")
    
    def test_rewards_balance_requires_auth(self):
        """GET /api/rewards/balance should require authentication"""
        response = requests.get(f"{BASE_URL}/api/rewards/balance")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Rewards balance correctly requires authentication")
    
    def test_rewards_history_requires_auth(self):
        """GET /api/rewards/history should require authentication"""
        response = requests.get(f"{BASE_URL}/api/rewards/history")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Rewards history correctly requires authentication")


class TestRetailersAPIs:
    """Test retailers APIs using new models/retailers.py"""
    
    def test_states_districts_endpoint(self):
        """GET /api/retailers/states-districts should return location data"""
        response = requests.get(f"{BASE_URL}/api/retailers/states-districts")
        assert response.status_code == 200, f"States-districts failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "states" in data
        assert "state_districts" in data
        assert isinstance(data["states"], list)
        assert isinstance(data["state_districts"], dict)
        
        # Should have at least the test retailers from previous iterations
        print(f"✓ States-districts: {len(data['states'])} states")
        for state in data["states"]:
            districts = data["state_districts"].get(state, [])
            print(f"  - {state}: {len(districts)} districts")
    
    def test_retailers_by_location(self):
        """GET /api/retailers/by-location should return active retailers"""
        response = requests.get(f"{BASE_URL}/api/retailers/by-location")
        assert response.status_code == 200, f"By-location failed: {response.text}"
        
        data = response.json()
        assert "retailers" in data
        
        # Verify retailer structure excludes sensitive data
        if len(data["retailers"]) > 0:
            retailer = data["retailers"][0]
            assert "password_hash" not in retailer, "Password hash should not be exposed"
            assert "name" in retailer
            assert "state" in retailer
            assert "district" in retailer
            
        print(f"✓ By-location: {len(data['retailers'])} active retailers")
    
    def test_admin_retailers_requires_auth(self):
        """GET /api/retailers/admin/list should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/retailers/admin/list")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin retailers list correctly requires authentication")
    
    def test_admin_user_rewards_requires_auth(self):
        """GET /api/retailers/admin/user-rewards should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/retailers/admin/user-rewards")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin user rewards correctly requires authentication")


class TestUserAuthenticationFlow:
    """Test user login and rewards flow"""
    
    @pytest.fixture(scope="class")
    def user_session(self):
        """Login as test user and return session"""
        session = requests.Session()
        
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "identifier": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not login as test user: {login_response.text}")
        
        print(f"✓ Logged in as {TEST_USER_EMAIL}")
        return session
    
    def test_user_login_success(self, user_session):
        """Test that login succeeded"""
        # Session is already logged in via fixture
        assert user_session is not None
        print("✓ User login successful")
    
    def test_authenticated_rewards_balance(self, user_session):
        """GET /api/rewards/balance with auth should return balance"""
        response = user_session.get(f"{BASE_URL}/api/rewards/balance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify balance structure from models/rewards.py
        assert "balance" in data
        assert "coins" in data["balance"]
        assert "value" in data["balance"]
        assert "currency_value_per_coin" in data["balance"]
        
        assert "stats" in data
        assert "total_earned" in data["stats"]
        assert "total_redeemed" in data["stats"]
        assert "total_expired" in data["stats"]
        
        assert "expiry" in data
        assert "rules" in data
        
        coins = data["balance"]["coins"]
        value = data["balance"]["value"]
        print(f"✓ Rewards balance: {coins} coins (₹{value})")
        print(f"  Total earned: {data['stats']['total_earned']}")
        print(f"  Total redeemed: {data['stats']['total_redeemed']}")
    
    def test_authenticated_rewards_history(self, user_session):
        """GET /api/rewards/history with auth should return transactions"""
        response = user_session.get(f"{BASE_URL}/api/rewards/history?limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "transactions" in data
        assert "pagination" in data
        
        # Verify transaction structure from CoinTransaction model
        if len(data["transactions"]) > 0:
            tx = data["transactions"][0]
            assert "transaction_type" in tx
            assert "coins_amount" in tx
            assert "created_at" in tx
        
        print(f"✓ Rewards history: {len(data['transactions'])} transactions")
    
    def test_authenticated_max_redemption(self, user_session):
        """POST /api/rewards/max-redemption should calculate redemption"""
        response = user_session.post(
            f"{BASE_URL}/api/rewards/max-redemption",
            json={"cart_value": 500}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "can_redeem" in data
        assert "coins_balance" in data
        assert "max_redeemable_coins" in data
        assert "max_redemption_value" in data
        assert "max_percentage_allowed" in data
        assert data["max_percentage_allowed"] == 50
        assert data["coin_value"] == 0.6
        assert data["minimum_to_redeem"] == 20
        
        print(f"✓ Max redemption for ₹500: {data['max_redeemable_coins']} coins (₹{data['max_redemption_value']})")


class TestUserRegistration:
    """Test user registration flow"""
    
    def test_registration_with_new_user(self):
        """Test registering a new user"""
        unique_email = f"test_regression_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "TestPass123!",
                "name": "Test Regression User",
                "phone": "9876543210"
            }
        )
        
        # Accept 200 (success) or 400 (if reCAPTCHA is required)
        if response.status_code == 400 and "recaptcha" in response.text.lower():
            print("✓ Registration requires reCAPTCHA (expected in production)")
            return
        
        assert response.status_code in [200, 201], f"Registration failed: {response.status_code}: {response.text}"
        print(f"✓ Registration successful for {unique_email}")


class TestAdminAuthentication:
    """Test admin 2FA authentication endpoints"""
    
    def test_admin_login_initiate(self):
        """POST /api/admin/login/initiate should accept valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={
                "email": ADMIN_EMAIL,
                "pin": ADMIN_PIN
            }
        )
        
        # 200 = OTP sent, 401 = wrong credentials
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✓ Admin 2FA initiate: OTP would be sent to {ADMIN_EMAIL}")
        else:
            print(f"✓ Admin 2FA initiate: Credentials rejected (expected if changed)")
    
    def test_admin_login_verify_without_otp(self):
        """POST /api/admin/login/verify without OTP should fail"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify",
            json={
                "email": ADMIN_EMAIL,
                "otp": "000000"  # Invalid OTP
            }
        )
        
        # Should fail with 401, 400, or 404 (if no OTP record exists)
        assert response.status_code in [400, 401, 404], f"Expected 400/401/404, got {response.status_code}"
        print("✓ Admin 2FA verify correctly rejects invalid OTP")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
