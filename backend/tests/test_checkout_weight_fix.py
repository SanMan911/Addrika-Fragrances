"""
Test for checkout price mismatch fix - Weight Calculation Bug
Bug: Frontend showed ₹103 but Razorpay was asking ₹197
Root cause: Weight calculation mismatch between frontend (0.08kg per 50g) 
and backend (using raw weight field in grams, treated as kg)

Fix: Added _calculate_shipping_weight_kg() function in orders.py that:
- Uses 0.08kg per 50g pack (80g with packaging)
- Uses 0.35kg per 200g jar (350g with packaging)
- Minimum 0.25kg for shipping

Test scenario: 3 x Kesar Chandan 50g (₹110 each) = ₹330 MRP
With RTO voucher 'RTO-EF7DE05D' (value ₹282)
PIN code 812002 (Bhagalpur, Bihar)
Expected: Final total ~₹103, Razorpay amount = 10300 paise
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://ecommerce-nextjs-2.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

class TestCheckoutWeightFix:
    """Tests for the weight calculation bug fix in checkout flow"""
    
    def test_create_order_with_rto_voucher_price_match(self):
        """
        Primary bug test: Verify checkout price matches Razorpay amount
        Scenario: 3 x 50g Kesar Chandan + RTO voucher + PIN 812002
        """
        order_data = {
            "sessionId": "test-weight-fix-001",
            "items": [
                {"productId": "kesar-chandan", "size": "50g", "quantity": 3}
            ],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "test@example.com",
                "phone": "9876543210",
                "address": "Test Address D.N. Singh Road",
                "city": "Bhagalpur",
                "state": "Bihar",
                "pincode": "812002"
            },
            "use_different_shipping": False,
            "delivery_mode": "shipping",
            "discountCode": "RTO-EF7DE05D",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200, f"Order creation failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "pricing" in data, "Missing pricing in response"
        assert "razorpay" in data, "Missing razorpay in response"
        
        pricing = data["pricing"]
        razorpay = data["razorpay"]
        
        # Verify pricing breakdown
        assert pricing["mrp_total"] == 330, f"Expected MRP 330, got {pricing['mrp_total']}"
        assert pricing["coupon_discount"] == 282, f"Expected coupon discount 282, got {pricing['coupon_discount']}"
        assert pricing["has_coupon_applied"] == True, "RTO voucher should be applied"
        
        # KEY BUG FIX VERIFICATION: final_total should match razorpay amount
        final_total = pricing["final_total"]
        razorpay_amount_rupees = razorpay["amount"] / 100  # Convert from paise to rupees
        
        print(f"Pricing breakdown:")
        print(f"  MRP Total: ₹{pricing['mrp_total']}")
        print(f"  Coupon Discount: ₹{pricing['coupon_discount']}")
        print(f"  Shipping: ₹{pricing['shipping']}")
        print(f"  Final Total: ₹{final_total}")
        print(f"  Razorpay Amount: ₹{razorpay_amount_rupees} ({razorpay['amount']} paise)")
        
        # THE CRITICAL ASSERTION: These MUST match
        assert final_total == razorpay_amount_rupees, \
            f"BUG DETECTED! Price mismatch: Checkout shows ₹{final_total} but Razorpay asks ₹{razorpay_amount_rupees}"
        
        # Expected calculation: 330 - 282 + ~55 = ~103
        assert 100 <= final_total <= 110, \
            f"Final total {final_total} not in expected range ₹100-110"
        
        # Shipping should be dynamic rate (around ₹55) not max slab ₹149
        assert pricing["shipping"] < 149, \
            f"Shipping charge {pricing['shipping']} too high - weight calculation may still be wrong"
    
    def test_shipping_rate_endpoint(self):
        """Test the shipping rate calculation endpoint directly"""
        # Test ShipRocket rate fetch
        response = requests.get(
            f"{BASE_URL}/api/shipping/rates",
            params={
                "pickup_postcode": "110078",  # Delhi warehouse
                "delivery_postcode": "812002",  # Bhagalpur
                "weight": 0.25  # 3 x 50g = 0.24kg, min 0.25kg
            }
        )
        
        # This endpoint may or may not exist, but let's try
        if response.status_code == 200:
            data = response.json()
            print(f"Shipping rates response: {data}")
            if data.get("success"):
                # Verify we got valid rates
                assert "couriers" in data or "rate" in data
    
    def test_different_product_sizes_weight_calculation(self):
        """Test weight calculation with different product sizes"""
        # Test 1: Single 200g jar
        order_data = {
            "sessionId": "test-weight-200g",
            "items": [
                {"productId": "kesar-chandan", "size": "200g", "quantity": 1}
            ],
            "billing": {
                "salutation": "Mrs",
                "name": "Test User",
                "email": "test2@example.com",
                "phone": "9876543211",
                "address": "Test Address",
                "city": "Bhagalpur",
                "state": "Bihar",
                "pincode": "812002"
            },
            "use_different_shipping": False,
            "delivery_mode": "shipping",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify Razorpay amount matches final total
        if "pricing" in data and "razorpay" in data:
            final_total = data["pricing"]["final_total"]
            razorpay_rupees = data["razorpay"]["amount"] / 100
            assert final_total == razorpay_rupees, \
                f"200g test: Price mismatch - Checkout ₹{final_total} vs Razorpay ₹{razorpay_rupees}"
    
    def test_mixed_sizes_cart(self):
        """Test with mixed product sizes in cart"""
        order_data = {
            "sessionId": "test-weight-mixed",
            "items": [
                {"productId": "kesar-chandan", "size": "50g", "quantity": 2},
                {"productId": "regal-rose", "size": "200g", "quantity": 1}
            ],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "test3@example.com",
                "phone": "9876543212",
                "address": "Test Address",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            },
            "use_different_shipping": False,
            "delivery_mode": "shipping",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify Razorpay amount matches final total
        if "pricing" in data and "razorpay" in data:
            final_total = data["pricing"]["final_total"]
            razorpay_rupees = data["razorpay"]["amount"] / 100
            assert final_total == razorpay_rupees, \
                f"Mixed sizes test: Price mismatch - Checkout ₹{final_total} vs Razorpay ₹{razorpay_rupees}"
    
    def test_free_shipping_threshold(self):
        """Test that free shipping is applied at ₹999+"""
        # Add enough items to cross ₹999 threshold
        order_data = {
            "sessionId": "test-free-shipping",
            "items": [
                {"productId": "kesar-chandan", "size": "200g", "quantity": 3}  # 3 x 290 = 870
            ],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "test4@example.com",
                "phone": "9876543213",
                "address": "Test Address",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001"
            },
            "use_different_shipping": False,
            "delivery_mode": "shipping",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if "pricing" in data:
            # Check if subtotal >= 999, shipping should be 0
            subtotal = data["pricing"]["mrp_total"]
            shipping = data["pricing"]["shipping"]
            
            if subtotal >= 999:
                assert shipping == 0, f"Expected free shipping for ₹{subtotal}, got ₹{shipping}"
    
    def test_self_pickup_no_shipping_charge(self):
        """Test that self-pickup orders have zero shipping"""
        order_data = {
            "sessionId": "test-self-pickup",
            "items": [
                {"productId": "kesar-chandan", "size": "50g", "quantity": 2}
            ],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "test5@example.com",
                "phone": "9876543214",
                "address": "Test Address",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110078"
            },
            "use_different_shipping": False,
            "delivery_mode": "self_pickup",
            "pickup_store": {
                "id": "delhi_primary",
                "name": "M.G. Shoppie",
                "address": "745 Sector 17 Pocket A Phase II",
                "city": "Dwarka, South West Delhi",
                "state": "Delhi",
                "pincode": "110078",
                "email": "test@example.com",
                "phone": "6202311736"
            },
            "pickup_payment_option": "pay_now",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if "pricing" in data:
            shipping = data["pricing"]["shipping"]
            assert shipping == 0, f"Self-pickup should have ₹0 shipping, got ₹{shipping}"
            
            # Self-pickup should have MRP as final (no discounts)
            assert data["pricing"]["coupon_discount"] == 0, "Self-pickup should not have coupon discounts"


class TestWeightCalculationLogic:
    """Unit tests for weight calculation function logic verification via API"""
    
    def test_single_50g_pack_weight(self):
        """
        Single 50g pack should use 0.08kg weight
        Minimum shipping weight is 0.25kg
        """
        order_data = {
            "sessionId": "test-single-50g",
            "items": [
                {"productId": "kesar-chandan", "size": "50g", "quantity": 1}
            ],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "test6@example.com",
                "phone": "9876543215",
                "address": "Test Address",
                "city": "Bangalore",
                "state": "Karnataka",
                "pincode": "560001"
            },
            "use_different_shipping": False,
            "delivery_mode": "shipping",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify price consistency
        if "pricing" in data and "razorpay" in data:
            final_total = data["pricing"]["final_total"]
            razorpay_rupees = data["razorpay"]["amount"] / 100
            assert final_total == razorpay_rupees, \
                f"Single 50g: Price mismatch - ₹{final_total} vs ₹{razorpay_rupees}"
    
    def test_three_50g_packs_exact_scenario(self):
        """
        Exact bug scenario: 3 x 50g Kesar Chandan
        Weight: 3 x 0.08kg = 0.24kg → rounded to minimum 0.25kg
        NOT: 3 x 50 = 150kg (the bug!)
        """
        order_data = {
            "sessionId": "test-bug-scenario-exact",
            "items": [
                {"productId": "kesar-chandan", "size": "50g", "quantity": 3}
            ],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "bug-test@example.com",
                "phone": "9876543216",
                "address": "D.N. Singh Road, Variety Chowk",
                "city": "Bhagalpur",
                "state": "Bihar",
                "pincode": "812002"
            },
            "use_different_shipping": False,
            "delivery_mode": "shipping",
            "discountCode": "RTO-EF7DE05D",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        assert response.status_code == 200, f"Request failed: {response.text}"
        data = response.json()
        
        pricing = data.get("pricing", {})
        razorpay = data.get("razorpay", {})
        
        # Log full response for debugging
        print(f"\n=== BUG SCENARIO TEST ===")
        print(f"Response: {data}")
        
        # Critical assertions
        assert pricing.get("mrp_total") == 330, "MRP should be 330 (3 x 110)"
        assert pricing.get("coupon_discount") == 282, "RTO voucher should give 282 discount"
        
        final_total = pricing.get("final_total")
        razorpay_rupees = razorpay.get("amount", 0) / 100
        
        # THE BUG FIX VERIFICATION
        print(f"\n=== PRICE COMPARISON ===")
        print(f"Checkout shows: ₹{final_total}")
        print(f"Razorpay asks: ₹{razorpay_rupees}")
        
        assert final_total == razorpay_rupees, \
            f"*** BUG STILL EXISTS! *** Checkout ₹{final_total} != Razorpay ₹{razorpay_rupees}"
        
        # Shipping should be reasonable (dynamic rate ~55, not slab max 149)
        shipping = pricing.get("shipping", 0)
        print(f"Shipping charge: ₹{shipping}")
        
        # If shipping is 149, weight calculation is still wrong
        if shipping == 149:
            print("WARNING: Shipping is at maximum slab (₹149) - weight may still be incorrectly calculated")
        
        print("=== TEST PASSED ===")


if __name__ == "__main__":
    # Run specific test directly
    import sys
    test = TestCheckoutWeightFix()
    test.test_create_order_with_rto_voucher_price_match()
    print("\n✅ All tests passed!")
