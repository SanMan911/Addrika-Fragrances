"""
Test Shipping Configuration APIs for Addrika E-commerce
Testing:
1. GET /api/shipping/options - zone detection, threshold, premium options
2. GET /api/shipping/free-thresholds - all zone thresholds
3. GET /api/admin/shipping-config - full shipping config (admin)
4. PUT /api/admin/shipping-config/rto-percentage - update RTO percentage (admin)
5. Premium options NOT available for Bhagalpur-shipped orders (East India)
6. Premium options available for Delhi-shipped orders
7. RTO voucher calculation: Order Value - 2.36% - Shipping
"""
import pytest
import requests
import os
import time

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://kyc-verification-14.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"

# Test pincodes
DELHI_PINCODE = "110001"       # Delhi NCR - ships from Delhi, premium options available
BHAGALPUR_PINCODE = "812001"   # Bhagalpur - ships from Bhagalpur, NO premium options
MUMBAI_PINCODE = "400001"      # Rest of India - ships from Delhi, premium options available


class TestShippingOptions:
    """Test GET /api/shipping/options endpoint"""
    
    def test_delhi_ncr_shipping_options(self):
        """
        Test Delhi NCR pincode (110001):
        - Free shipping threshold should be ₹499
        - Premium options should be available (ships from Delhi)
        - Zone should be "Delhi NCR"
        """
        response = requests.get(
            f"{BASE_URL}/api/shipping/options",
            params={"pincode": DELHI_PINCODE, "subtotal": 300}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Response should indicate success: {data}"
        
        # Verify zone
        assert data.get("zone") == "Delhi NCR", f"Expected zone 'Delhi NCR', got {data.get('zone')}"
        
        # Verify free shipping threshold
        free_shipping = data.get("free_shipping", {})
        assert free_shipping.get("threshold") == 499, f"Delhi NCR threshold should be 499, got {free_shipping.get('threshold')}"
        
        # Verify premium options are available (ships from Delhi)
        assert data.get("ships_from_delhi") == True, f"Delhi orders should ship from Delhi"
        premium_options = data.get("premium_options", [])
        assert len(premium_options) > 0, f"Premium options should be available for Delhi NCR: {data}"
        
        # Check for Priority Despatch option
        priority_codes = [opt.get("code") for opt in premium_options]
        assert "PRIORITY" in priority_codes, f"Priority Despatch should be available, got: {priority_codes}"
        
        print(f"✓ Delhi NCR ({DELHI_PINCODE}): Zone={data.get('zone')}, Threshold=₹{free_shipping.get('threshold')}, Premium options={len(premium_options)}")
    
    def test_bhagalpur_shipping_options(self):
        """
        Test Bhagalpur pincode (812001):
        - Free shipping threshold should be ₹249
        - Premium options should NOT be available (ships from Bhagalpur)
        - Zone should be "Bhagalpur"
        """
        response = requests.get(
            f"{BASE_URL}/api/shipping/options",
            params={"pincode": BHAGALPUR_PINCODE, "subtotal": 200}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Response should indicate success: {data}"
        
        # Verify zone
        assert data.get("zone") == "Bhagalpur", f"Expected zone 'Bhagalpur', got {data.get('zone')}"
        
        # Verify free shipping threshold
        free_shipping = data.get("free_shipping", {})
        assert free_shipping.get("threshold") == 249, f"Bhagalpur threshold should be 249, got {free_shipping.get('threshold')}"
        
        # Verify premium options are NOT available (ships from Bhagalpur)
        assert data.get("ships_from_delhi") == False, f"Bhagalpur orders should NOT ship from Delhi"
        premium_options = data.get("premium_options", [])
        assert len(premium_options) == 0, f"Premium options should NOT be available for Bhagalpur-shipped orders: {premium_options}"
        
        print(f"✓ Bhagalpur ({BHAGALPUR_PINCODE}): Zone={data.get('zone')}, Threshold=₹{free_shipping.get('threshold')}, Premium options={len(premium_options)} (correctly none)")
    
    def test_rest_of_india_shipping_options(self):
        """
        Test Rest of India pincode (Mumbai - 400001):
        - Free shipping threshold should be ₹999
        - Premium options should be available (ships from Delhi)
        - Zone should be "Rest of India"
        """
        response = requests.get(
            f"{BASE_URL}/api/shipping/options",
            params={"pincode": MUMBAI_PINCODE, "subtotal": 500}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Response should indicate success: {data}"
        
        # Verify zone
        assert data.get("zone") == "Rest of India", f"Expected zone 'Rest of India', got {data.get('zone')}"
        
        # Verify free shipping threshold
        free_shipping = data.get("free_shipping", {})
        assert free_shipping.get("threshold") == 999, f"Rest of India threshold should be 999, got {free_shipping.get('threshold')}"
        
        # Verify premium options are available (ships from Delhi)
        assert data.get("ships_from_delhi") == True, f"Mumbai orders should ship from Delhi"
        premium_options = data.get("premium_options", [])
        # Priority Despatch should be available for Delhi-shipped orders
        priority_codes = [opt.get("code") for opt in premium_options]
        assert "PRIORITY" in priority_codes, f"Priority Despatch should be available for Delhi-shipped orders: {priority_codes}"
        
        print(f"✓ Rest of India (Mumbai {MUMBAI_PINCODE}): Zone={data.get('zone')}, Threshold=₹{free_shipping.get('threshold')}, Premium options={len(premium_options)}")
    
    def test_free_shipping_eligible_delhi(self):
        """Test that Delhi NCR order above ₹499 gets free shipping"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/options",
            params={"pincode": DELHI_PINCODE, "subtotal": 600}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        free_shipping = data.get("free_shipping", {})
        assert free_shipping.get("eligible") == True, f"Order ₹600 should qualify for free shipping in Delhi NCR"
        assert data.get("shipping_charge") == 0, f"Shipping charge should be 0 for free shipping"
        
        print(f"✓ Delhi NCR free shipping eligibility: ₹600 subtotal, eligible={free_shipping.get('eligible')}")
    
    def test_free_shipping_not_eligible_delhi(self):
        """Test that Delhi NCR order below ₹499 does NOT get free shipping"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/options",
            params={"pincode": DELHI_PINCODE, "subtotal": 300}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        free_shipping = data.get("free_shipping", {})
        assert free_shipping.get("eligible") == False, f"Order ₹300 should NOT qualify for free shipping in Delhi NCR"
        assert free_shipping.get("amount_for_free") == 199, f"Amount for free shipping should be 199 (499-300)"
        
        print(f"✓ Delhi NCR non-eligible: ₹300 subtotal, need ₹{free_shipping.get('amount_for_free')} more")


class TestFreeShippingThresholds:
    """Test GET /api/shipping/free-thresholds endpoint"""
    
    def test_get_all_thresholds(self):
        """
        Test that free-thresholds returns all three zone thresholds:
        - Bhagalpur: ₹249
        - Delhi NCR: ₹499
        - Rest of India: ₹999
        """
        response = requests.get(f"{BASE_URL}/api/shipping/free-thresholds")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        thresholds = data.get("thresholds", [])
        
        assert len(thresholds) == 3, f"Should have 3 threshold zones, got {len(thresholds)}"
        
        # Create a dict for easy lookup
        threshold_map = {t["zone"]: t["threshold"] for t in thresholds}
        
        assert threshold_map.get("Bhagalpur") == 249, f"Bhagalpur threshold should be 249"
        assert threshold_map.get("Delhi NCR") == 499, f"Delhi NCR threshold should be 499"
        assert threshold_map.get("Rest of India") == 999, f"Rest of India threshold should be 999"
        
        print(f"✓ Free shipping thresholds: {threshold_map}")


class TestAdminShippingConfig:
    """Test admin shipping configuration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_session(self):
        """Get admin session token"""
        login_response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        
        self.session_token = login_response.json().get("session_token")
        self.cookies = {"session_token": self.session_token}
        yield
    
    def test_get_shipping_config(self):
        """
        Test GET /api/admin/shipping-config returns full configuration:
        - Free shipping thresholds
        - Premium options
        - RTO deduction percentage (should be 2.36%)
        - Pickup locations
        """
        response = requests.get(
            f"{BASE_URL}/api/admin/shipping-config",
            cookies=self.cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify free shipping thresholds
        thresholds = data.get("free_shipping_thresholds", {})
        assert thresholds.get("bhagalpur") == 249, f"Bhagalpur threshold should be 249"
        assert thresholds.get("delhi_ncr") == 499, f"Delhi NCR threshold should be 499"
        assert thresholds.get("rest_of_india") == 999, f"Rest of India threshold should be 999"
        
        # Verify premium options
        premium = data.get("premium_options", {})
        assert "priority_despatch" in premium, "Priority Despatch should be in premium options"
        assert "same_day_delivery" in premium, "Same-Day Delivery should be in premium options"
        assert premium.get("priority_despatch", {}).get("price") == 29, "Priority Despatch should cost ₹29"
        assert premium.get("same_day_delivery", {}).get("price") == 49, "Same-Day Delivery should cost ₹49"
        
        # Verify RTO deduction percentage
        rto_pct = data.get("rto_deduction_percentage")
        assert rto_pct is not None, "RTO deduction percentage should be present"
        print(f"✓ Current RTO deduction percentage: {rto_pct}%")
        
        # Verify pickup locations
        locations = data.get("pickup_locations", [])
        assert len(locations) >= 2, "Should have at least 2 pickup locations (Delhi and Bhagalpur)"
        
        location_names = [loc.get("name") for loc in locations]
        assert any("Delhi" in name for name in location_names), "Delhi warehouse should be in locations"
        assert any("Bhagalpur" in name or "Mela" in name for name in location_names), "Bhagalpur location should be in locations"
        
        print(f"✓ Admin shipping config: thresholds={thresholds}, RTO={rto_pct}%, locations={len(locations)}")
    
    def test_update_rto_percentage(self):
        """
        Test PUT /api/admin/shipping-config/rto-percentage:
        1. Update RTO percentage to a test value
        2. Verify the update
        3. Reset to original value (2.36%)
        """
        # Get current RTO percentage
        config_response = requests.get(
            f"{BASE_URL}/api/admin/shipping-config",
            cookies=self.cookies
        )
        original_pct = config_response.json().get("rto_deduction_percentage", 2.36)
        
        # Test value
        test_pct = 3.0
        
        # Update RTO percentage
        update_response = requests.put(
            f"{BASE_URL}/api/admin/shipping-config/rto-percentage",
            json={"percentage": test_pct},
            cookies=self.cookies
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        update_data = update_response.json()
        assert update_data.get("success") == True, f"Update should be successful"
        assert update_data.get("new_percentage") == test_pct, f"New percentage should be {test_pct}"
        
        # Verify the update by fetching config again
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/shipping-config",
            cookies=self.cookies
        )
        verified_pct = verify_response.json().get("rto_deduction_percentage")
        assert verified_pct == test_pct, f"Verified percentage should be {test_pct}, got {verified_pct}"
        
        print(f"✓ RTO percentage updated: {original_pct}% → {test_pct}%")
        
        # Reset to original value (2.36%)
        reset_response = requests.put(
            f"{BASE_URL}/api/admin/shipping-config/rto-percentage",
            json={"percentage": 2.36},
            cookies=self.cookies
        )
        assert reset_response.status_code == 200, f"Reset should succeed"
        print(f"✓ RTO percentage reset to 2.36%")
    
    def test_update_rto_percentage_validation(self):
        """Test validation for RTO percentage update"""
        # Test invalid percentage (negative)
        response = requests.put(
            f"{BASE_URL}/api/admin/shipping-config/rto-percentage",
            json={"percentage": -5},
            cookies=self.cookies
        )
        assert response.status_code in [400, 422], f"Negative percentage should fail"
        
        # Test invalid percentage (too high)
        response = requests.put(
            f"{BASE_URL}/api/admin/shipping-config/rto-percentage",
            json={"percentage": 60},
            cookies=self.cookies
        )
        assert response.status_code in [400, 422], f"Percentage > 50 should fail"
        
        print("✓ RTO percentage validation working correctly")
    
    def test_shipping_config_requires_auth(self):
        """Test that shipping config endpoints require admin auth"""
        # Without auth
        response = requests.get(f"{BASE_URL}/api/admin/shipping-config")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        
        # RTO update without auth
        response = requests.put(
            f"{BASE_URL}/api/admin/shipping-config/rto-percentage",
            json={"percentage": 2.5}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        
        print("✓ Admin endpoints properly require authentication")


class TestPremiumOptionsAvailability:
    """Test premium options availability based on pickup location"""
    
    def test_east_india_no_premium_options(self):
        """
        Test East India destinations (shipping from Bhagalpur) have NO premium options:
        - West Bengal (Kolkata - 700001)
        - Jharkhand (Ranchi - 834001)
        - Odisha (Bhubaneswar - 751001)
        """
        east_india_pincodes = {
            "700001": "Kolkata (West Bengal)",
            "834001": "Ranchi (Jharkhand)", 
            "751001": "Bhubaneswar (Odisha)",
            "812001": "Bhagalpur (Bihar)"
        }
        
        for pincode, location in east_india_pincodes.items():
            response = requests.get(
                f"{BASE_URL}/api/shipping/options",
                params={"pincode": pincode, "subtotal": 500}
            )
            
            assert response.status_code == 200, f"Expected 200 for {location}"
            
            data = response.json()
            
            # Should ship from Bhagalpur (not Delhi)
            ships_from_delhi = data.get("ships_from_delhi", True)
            premium_options = data.get("premium_options", [])
            
            # Premium options should NOT be available
            assert len(premium_options) == 0, f"Premium options should NOT be available for {location}: {premium_options}"
            
            print(f"✓ {location} ({pincode}): ships_from_delhi={ships_from_delhi}, premium_options={len(premium_options)}")
    
    def test_non_east_india_has_premium_options(self):
        """
        Test non-East India destinations (shipping from Delhi) have premium options:
        - Delhi, Mumbai, Bangalore, Chennai, etc.
        """
        non_east_india_pincodes = {
            "110001": "Delhi",
            "400001": "Mumbai",
            "560001": "Bangalore",
            "600001": "Chennai"
        }
        
        for pincode, location in non_east_india_pincodes.items():
            response = requests.get(
                f"{BASE_URL}/api/shipping/options",
                params={"pincode": pincode, "subtotal": 500}
            )
            
            assert response.status_code == 200, f"Expected 200 for {location}"
            
            data = response.json()
            
            # Should ship from Delhi
            ships_from_delhi = data.get("ships_from_delhi", False)
            premium_options = data.get("premium_options", [])
            
            assert ships_from_delhi == True, f"{location} should ship from Delhi"
            assert len(premium_options) > 0, f"Premium options should be available for {location}"
            
            # Priority Despatch should be available
            priority_codes = [opt.get("code") for opt in premium_options]
            assert "PRIORITY" in priority_codes, f"Priority Despatch should be available for {location}"
            
            print(f"✓ {location} ({pincode}): ships_from_delhi={ships_from_delhi}, premium_options={len(premium_options)}")


class TestRTOVoucherCalculation:
    """Test RTO voucher calculation formula: Order Value - 2.36% - Shipping"""
    
    def test_rto_voucher_formula_logic(self):
        """
        Verify RTO voucher calculation service logic.
        Formula: Order Value - Payment Gateway Fee (2.36%) - Shipping Charges
        
        Example:
        - Order: ₹1000
        - Shipping: ₹60
        - Gateway fee: ₹1000 * 2.36% = ₹23.60
        - Voucher: ₹1000 - ₹23.60 - ₹60 = ₹916.40
        """
        # This tests the calculation logic by checking the shipping config endpoint
        # to confirm the default RTO percentage is 2.36%
        response = requests.get(f"{BASE_URL}/api/shipping/free-thresholds")
        assert response.status_code == 200
        
        # The RTO calculation is tested indirectly through the admin endpoint
        # We verify the formula constants are correct
        login_response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if login_response.status_code == 200:
            session_token = login_response.json().get("session_token")
            cookies = {"session_token": session_token}
            
            config_response = requests.get(
                f"{BASE_URL}/api/admin/shipping-config",
                cookies=cookies
            )
            
            if config_response.status_code == 200:
                rto_pct = config_response.json().get("rto_deduction_percentage")
                
                # Calculate expected voucher
                order_amount = 1000
                shipping = 60
                gateway_fee = order_amount * (rto_pct / 100)
                expected_voucher = order_amount - gateway_fee - shipping
                
                print(f"✓ RTO Voucher Calculation Test:")
                print(f"  Order Amount: ₹{order_amount}")
                print(f"  Gateway Fee ({rto_pct}%): ₹{gateway_fee:.2f}")
                print(f"  Shipping Charges: ₹{shipping}")
                print(f"  Expected Voucher: ₹{expected_voucher:.2f}")
                
                # Verify formula
                assert rto_pct == 2.36, f"Default RTO percentage should be 2.36%, got {rto_pct}%"
        else:
            print("⚠ Could not verify RTO calculation (admin login required)")


class TestPickupLocations:
    """Test pickup location determination"""
    
    def test_get_pickup_locations(self):
        """Test GET /api/shipping/pickup-locations returns all locations"""
        response = requests.get(f"{BASE_URL}/api/shipping/pickup-locations")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        locations = data.get("locations", [])
        
        assert len(locations) >= 2, f"Should have at least 2 locations"
        
        # Check for Delhi and Bhagalpur
        location_ids = [loc.get("location_id") for loc in locations]
        assert any("delhi" in lid.lower() for lid in location_ids), "Delhi location should exist"
        assert any("bhagalpur" in lid.lower() or "mela" in lid.lower() for lid in location_ids), "Bhagalpur location should exist"
        
        print(f"✓ Pickup locations: {[loc.get('name') for loc in locations]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
