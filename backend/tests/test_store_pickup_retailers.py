"""
Store Pickup OTP and Retailer Management API Tests
Tests Phase 1B functionality:
- GET /api/retailers/states-districts - public endpoint for state/district dropdown
- GET /api/retailers/by-location - public endpoint for filtering retailers
- GET /api/retailers/recommend - public endpoint for PIN-based recommendation
- POST /api/store-pickup/verify-otp - OTP verification for pickup orders
- GET /api/retailers/admin/list - admin endpoint for retailer listing
- POST /api/retailers/admin/create - admin endpoint for creating retailers
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test.user@example.com"
TEST_USER_PASSWORD = "test123"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"


class TestRetailerPublicEndpoints:
    """Tests for public retailer lookup endpoints - no auth required"""
    
    def test_get_states_districts(self):
        """GET /api/retailers/states-districts - should return states with their districts"""
        response = requests.get(f"{BASE_URL}/api/retailers/states-districts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "states" in data, "Response missing 'states' key"
        assert "state_districts" in data, "Response missing 'state_districts' key"
        assert isinstance(data["states"], list), "states should be a list"
        assert isinstance(data["state_districts"], dict), "state_districts should be a dict"
        
        print(f"✓ Found {len(data['states'])} states: {data['states']}")
        for state in data['states']:
            districts = data['state_districts'].get(state, [])
            print(f"  - {state}: {len(districts)} districts ({districts})")
    
    def test_get_retailers_by_location_no_filter(self):
        """GET /api/retailers/by-location - returns active retailers"""
        response = requests.get(f"{BASE_URL}/api/retailers/by-location")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "retailers" in data, "Response missing 'retailers' key"
        assert isinstance(data["retailers"], list), "retailers should be a list"
        
        print(f"✓ Found {len(data['retailers'])} active retailers")
        for r in data['retailers'][:5]:  # Show first 5
            print(f"  - {r.get('name')} ({r.get('city')}, {r.get('state')})")
    
    def test_get_retailers_by_location_with_state_filter(self):
        """GET /api/retailers/by-location?state=X - filter by state"""
        # First get available states
        states_resp = requests.get(f"{BASE_URL}/api/retailers/states-districts")
        if states_resp.status_code != 200:
            pytest.skip("Could not fetch states")
        
        states = states_resp.json().get("states", [])
        if not states:
            pytest.skip("No states with retailers available")
        
        test_state = states[0]
        response = requests.get(f"{BASE_URL}/api/retailers/by-location?state={test_state}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        retailers = data.get("retailers", [])
        print(f"✓ Found {len(retailers)} retailers in {test_state}")
        
        # Verify all returned retailers are in the requested state
        for r in retailers:
            assert r.get('state', '').lower() == test_state.lower(), f"Retailer {r.get('name')} has state {r.get('state')}, expected {test_state}"
    
    def test_get_retailers_by_location_with_state_and_district(self):
        """GET /api/retailers/by-location?state=X&district=Y - filter by state and district"""
        # Get states and districts
        states_resp = requests.get(f"{BASE_URL}/api/retailers/states-districts")
        if states_resp.status_code != 200:
            pytest.skip("Could not fetch states")
        
        state_districts = states_resp.json().get("state_districts", {})
        if not state_districts:
            pytest.skip("No state_districts available")
        
        # Pick first state with districts
        for state, districts in state_districts.items():
            if districts:
                test_state = state
                test_district = districts[0]
                break
        else:
            pytest.skip("No state with districts found")
        
        response = requests.get(
            f"{BASE_URL}/api/retailers/by-location?state={test_state}&district={test_district}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        retailers = data.get("retailers", [])
        print(f"✓ Found {len(retailers)} retailers in {test_district}, {test_state}")
        
        # Verify all match
        for r in retailers:
            assert r.get('state', '').lower() == test_state.lower()
            assert r.get('district', '').lower() == test_district.lower()

    def test_get_recommended_retailer(self):
        """GET /api/retailers/recommend?pincode=XXXXXX - get nearest retailer"""
        # Test with Delhi pincode
        test_pincode = "110001"
        response = requests.get(f"{BASE_URL}/api/retailers/recommend?pincode={test_pincode}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "recommended" in data, "Response missing 'recommended' key"
        
        if data.get("recommended"):
            retailer = data["recommended"]
            print(f"✓ Recommended retailer: {retailer.get('name')}")
            print(f"  Location: {retailer.get('city')}, {retailer.get('state')}")
            print(f"  Distance: {data.get('distance_km')} km")
            print(f"  Reason: {data.get('reason')}")
            
            # Should have key fields
            assert retailer.get("name"), "Retailer missing name"
            assert retailer.get("address"), "Retailer missing address"
            assert retailer.get("state"), "Retailer missing state"
        else:
            print(f"✓ No recommended retailer. Reason: {data.get('reason')}")

    def test_get_recommended_retailer_different_pincodes(self):
        """Test recommendation with different pincodes"""
        test_pincodes = [
            ("110078", "Delhi"),  # Delhi
            ("400001", "Mumbai"),  # Mumbai
            ("560001", "Bangalore"),  # Bangalore
        ]
        
        for pincode, city in test_pincodes:
            response = requests.get(f"{BASE_URL}/api/retailers/recommend?pincode={pincode}")
            
            assert response.status_code == 200, f"Failed for pincode {pincode}"
            
            data = response.json()
            if data.get("recommended"):
                print(f"✓ {city} ({pincode}): Recommended {data['recommended'].get('name')} @ {data.get('distance_km')}km")
            else:
                print(f"✓ {city} ({pincode}): No recommendation - {data.get('reason')}")


class TestStorePickupOTP:
    """Tests for store pickup OTP verification"""
    
    def test_verify_otp_nonexistent_order(self):
        """POST /api/store-pickup/verify-otp - should fail for non-existent order"""
        payload = {
            "order_number": "TEST_NONEXISTENT_ORDER_12345",
            "otp_code": "123456",
            "retailer_id": "RTL_TEST001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/store-pickup/verify-otp",
            json=payload
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data or "message" in data, "Expected error detail/message"
        print(f"✓ Non-existent order returns 404: {data}")
    
    def test_verify_otp_missing_fields(self):
        """POST /api/store-pickup/verify-otp - validation for missing fields"""
        # Missing otp_code
        payload = {
            "order_number": "TEST_ORDER",
            "retailer_id": "RTL_TEST001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/store-pickup/verify-otp",
            json=payload
        )
        
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print(f"✓ Missing fields returns 422 validation error")


class TestRetailerAdminEndpoints:
    """Tests for admin retailer management endpoints - requires admin auth"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_session(self):
        """Setup admin session if possible"""
        self.session = requests.Session()
        self.admin_authenticated = False
        
        # Try to login as admin (without 2FA for now, just to check auth flow)
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/admin-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PIN}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            if data.get("requires_2fa"):
                print("Note: Admin login requires 2FA - some tests will skip")
            else:
                self.admin_authenticated = True
        
        yield
    
    def test_admin_list_retailers_without_auth(self):
        """GET /api/retailers/admin/list - should require admin auth"""
        response = requests.get(f"{BASE_URL}/api/retailers/admin/list")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Admin list retailers requires auth: {response.status_code}")
    
    def test_admin_create_retailer_without_auth(self):
        """POST /api/retailers/admin/create - should require admin auth"""
        payload = {
            "name": "Test Store",
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "9999999999",
            "password": "testpass123",
            "address": "123 Test Street",
            "city": "Test City",
            "district": "Test District",
            "state": "Test State",
            "pincode": "110001"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/retailers/admin/create",
            json=payload
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Admin create retailer requires auth: {response.status_code}")


class TestRetailerDataVerification:
    """Verify test retailers exist in database"""
    
    def test_verify_test_retailers_exist(self):
        """Check if 4 test retailers (Delhi, Mumbai, Bangalore) exist"""
        response = requests.get(f"{BASE_URL}/api/retailers/by-location")
        
        assert response.status_code == 200
        
        retailers = response.json().get("retailers", [])
        
        print(f"\n=== Current Retailers in Database ({len(retailers)}) ===")
        
        expected_cities = {"Delhi", "Mumbai", "Bangalore"}
        found_cities = set()
        
        for r in retailers:
            city = r.get('city', '')
            state = r.get('state', '')
            name = r.get('name', '')
            retailer_id = r.get('retailer_id', '')
            print(f"  - {name} | {city}, {state} | ID: {retailer_id}")
            found_cities.add(city)
        
        # Check if expected cities have retailers
        missing = expected_cities - found_cities
        if missing:
            print(f"\nNote: Retailers missing in cities: {missing}")
        else:
            print(f"\n✓ Found retailers in all expected cities: {expected_cities}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
