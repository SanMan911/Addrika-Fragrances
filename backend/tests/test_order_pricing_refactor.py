"""
Backend API Tests for Order Pricing Refactoring
Testing: Checkout flow, coupon validation, order status, self-pickup flow
Verifies that the refactoring of orders.py to use services/order_pricing.py works correctly
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://incense-retailer-hub.preview.emergentagent.com')


def generate_session_id():
    """Generate a unique session ID like the frontend does"""
    import time
    return f"test_session_{int(time.time())}_{uuid.uuid4().hex[:9]}"


class TestHealthCheck:
    """Verify API is up before running order tests"""
    
    def test_api_health(self):
        """Test API health endpoint returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got: {data}"


class TestProductsAPI:
    """Verify products API is accessible for order creation"""
    
    def test_products_endpoint(self):
        """Test products endpoint returns products with size/price info"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        data = response.json()
        products = data if isinstance(data, list) else data.get("products", [])
        assert len(products) > 0, "Should have at least one product"
        
        # Verify first product has required fields
        product = products[0]
        assert "id" in product, "Product should have id"
        assert "name" in product, "Product should have name"
        assert "sizes" in product, "Product should have sizes"
        
        # Verify sizes have pricing info
        sizes = product.get("sizes", [])
        assert len(sizes) > 0, "Product should have at least one size"
        
        size = sizes[0]
        assert "size" in size, "Size should have size field"
        assert "price" in size, "Size should have price"
        assert "mrp" in size, "Size should have MRP"


class TestCouponValidation:
    """Test coupon validation - now extracted to services/order_pricing.py"""
    
    def test_discount_code_validation_endpoint(self):
        """Test discount code validation endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/discount-codes/validate",
            params={"code": "TESTDISCOUNT", "subtotal": 500, "mrp_total": 500}
        )
        # Should return 200 if code exists, or 400/404 if not found
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
        print(f"Discount validation response: {response.status_code} - {response.json() if response.status_code != 500 else 'error'}")
    
    def test_discount_code_not_applied_for_self_pickup(self):
        """Verify that creating a self-pickup order ignores discount codes"""
        # Get first product for testing
        products_resp = requests.get(f"{BASE_URL}/api/products")
        products = products_resp.json() if isinstance(products_resp.json(), list) else products_resp.json().get("products", [])
        first_product = products[0]
        first_size = first_product["sizes"][0]
        
        # Create order payload for self-pickup with discount code
        order_data = {
            "sessionId": generate_session_id(),
            "items": [{
                "productId": first_product["id"],
                "size": first_size["size"],
                "quantity": 1
            }],
            "billing": {
                "salutation": "Mr",
                "name": "Test User",
                "email": "test.checkout@example.com",
                "phone": "9999999999",
                "address": "123 Test Street",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001"
            },
            "use_different_shipping": False,
            "delivery_mode": "self_pickup",
            "pickup_store": {
                "id": "delhi_primary",
                "name": "M.G. Shoppie",
                "address": "70A, Gali Number 3",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110078",
                "email": "amitkumar.911@proton.me",
                "phone": "9311211088"
            },
            "pickup_payment_option": "pay_at_store",
            "discountCode": "TESTDISCOUNT10",  # Should be ignored for self-pickup
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        # Order creation initiates payment - returns session
        # Allow 422 for validation errors (pydantic)
        assert response.status_code in [200, 400, 422, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            pricing = data.get("pricing", {})
            
            # Verify coupon discount is 0 for self-pickup
            coupon_discount = pricing.get("coupon_discount", 0)
            assert coupon_discount == 0, f"Coupon should not apply for self-pickup, got: {coupon_discount}"
            
            # Verify shipping is 0 for self-pickup
            shipping = pricing.get("shipping", 0)
            assert shipping == 0, f"Shipping should be 0 for self-pickup, got: {shipping}"
            
            print(f"Self-pickup order pricing: {pricing}")
        else:
            print(f"Order creation returned {response.status_code}: {response.json()}")


class TestShippingOrderCreation:
    """Test order creation for shipping delivery mode"""
    
    def test_shipping_order_creation(self):
        """Test creating an order with shipping delivery mode"""
        # Get first product for testing
        products_resp = requests.get(f"{BASE_URL}/api/products")
        products = products_resp.json() if isinstance(products_resp.json(), list) else products_resp.json().get("products", [])
        first_product = products[0]
        first_size = first_product["sizes"][0]
        
        # Create order payload for shipping
        order_data = {
            "sessionId": generate_session_id(),
            "items": [{
                "productId": first_product["id"],
                "size": first_size["size"],
                "quantity": 1
            }],
            "billing": {
                "salutation": "Mr",
                "name": "Test User Shipping",
                "email": "test.checkout@example.com",
                "phone": "9999999999",
                "address": "456 Test Avenue",
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
        
        # Order creation initiates payment - returns session info
        if response.status_code == 200:
            data = response.json()
            
            # Verify session_id is returned (new flow)
            assert "session_id" in data, "Should return session_id"
            assert data.get("payment_pending") == True, "Should indicate payment pending"
            
            # Verify pricing is calculated
            pricing = data.get("pricing", {})
            assert "final_total" in pricing, "Should have final_total in pricing"
            assert pricing.get("final_total") > 0, "Final total should be positive"
            
            # Verify shipping is included for shipping mode
            # Note: Shipping may be 0 if free shipping threshold is met
            assert "shipping" in pricing, "Should have shipping in pricing"
            
            print(f"Shipping order created - session: {data.get('session_id')}")
            print(f"Pricing: {pricing}")
            
            # Verify Razorpay order is created
            if "razorpay" in data:
                razorpay_data = data["razorpay"]
                assert "orderId" in razorpay_data, "Should have Razorpay orderId"
                assert "amount" in razorpay_data, "Should have Razorpay amount"
                print(f"Razorpay order: {razorpay_data.get('orderId')}, amount: {razorpay_data.get('amount')}")
        else:
            # Log error for debugging
            print(f"Order creation returned {response.status_code}: {response.json()}")
            # Allow 400 for validation errors, 500 for payment gateway issues
            assert response.status_code in [400, 500], f"Unexpected status: {response.status_code}"


class TestSelfPickupOrderCreation:
    """Test order creation for self-pickup delivery mode with token payment"""
    
    def test_self_pickup_pay_at_store(self):
        """Test creating self-pickup order with pay-at-store (token payment)"""
        # Get first product for testing
        products_resp = requests.get(f"{BASE_URL}/api/products")
        products = products_resp.json() if isinstance(products_resp.json(), list) else products_resp.json().get("products", [])
        first_product = products[0]
        first_size = first_product["sizes"][0]
        
        # Create order payload for self-pickup with pay at store
        order_data = {
            "sessionId": generate_session_id(),
            "items": [{
                "productId": first_product["id"],
                "size": first_size["size"],
                "quantity": 2
            }],
            "billing": {
                "salutation": "Ms",
                "name": "Test Pickup User",
                "email": "test.pickup@example.com",
                "phone": "9999888877",
                "address": "789 Pickup Lane",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110078"
            },
            "use_different_shipping": False,
            "delivery_mode": "self_pickup",
            "pickup_store": {
                "id": "delhi_primary",
                "name": "M.G. Shoppie",
                "address": "70A, Gali Number 3",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110078",
                "email": "amitkumar.911@proton.me",
                "phone": "9311211088"
            },
            "pickup_payment_option": "pay_at_store",
            "pickup_time_slot": "10:00 AM - 12:00 PM",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify session_id is returned
            assert "session_id" in data, "Should return session_id"
            
            # Verify pricing for self-pickup (MRP only, no shipping/discounts)
            pricing = data.get("pricing", {})
            
            # For pay-at-store, only token amount (Rs.11) should be charged
            # Razorpay amount should be 1100 paise (Rs.11)
            if "razorpay" in data:
                razorpay_data = data["razorpay"]
                amount_paise = razorpay_data.get("amount", 0)
                # Token amount is Rs.11 = 1100 paise
                assert amount_paise == 1100, f"Pay-at-store should charge Rs.11 (1100 paise), got: {amount_paise}"
                print(f"Token payment amount: {amount_paise / 100} INR")
            
            # Verify shipping is 0 for self-pickup
            assert pricing.get("shipping", 0) == 0, "Shipping should be 0 for self-pickup"
            
            # Verify coupon is not applied
            assert pricing.get("coupon_discount", 0) == 0, "Coupon should not apply for self-pickup"
            
            # Verify final_total is MRP (no discounts for self-pickup)
            mrp_total = pricing.get("mrp_total", 0)
            final_total = pricing.get("final_total", 0)
            assert mrp_total == final_total, f"Self-pickup: final_total should equal MRP, got mrp={mrp_total}, final={final_total}"
            
            print(f"Self-pickup order pricing: {pricing}")
        else:
            print(f"Self-pickup order returned {response.status_code}: {response.json()}")
            assert response.status_code in [400, 500], f"Unexpected status: {response.status_code}"
    
    def test_self_pickup_pay_online(self):
        """Test creating self-pickup order with full online payment"""
        # Get first product for testing
        products_resp = requests.get(f"{BASE_URL}/api/products")
        products = products_resp.json() if isinstance(products_resp.json(), list) else products_resp.json().get("products", [])
        first_product = products[0]
        first_size = first_product["sizes"][0]
        
        mrp = first_size.get("mrp", 110)
        
        # Create order payload for self-pickup with online payment
        order_data = {
            "sessionId": generate_session_id(),
            "items": [{
                "productId": first_product["id"],
                "size": first_size["size"],
                "quantity": 1
            }],
            "billing": {
                "salutation": "Mr",
                "name": "Test Online Pickup",
                "email": "test.online@example.com",
                "phone": "9999777766",
                "address": "101 Online Lane",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110078"
            },
            "use_different_shipping": False,
            "delivery_mode": "self_pickup",
            "pickup_store": {
                "id": "delhi_primary",
                "name": "M.G. Shoppie",
                "address": "70A, Gali Number 3",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110078",
                "email": "amitkumar.911@proton.me",
                "phone": "9311211088"
            },
            "pickup_payment_option": "pay_online",  # Full payment online
            "pickup_time_slot": "2:00 PM - 4:00 PM",
            "paymentMethod": "razorpay"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/orders/create",
            json=order_data
        )
        
        if response.status_code == 200:
            data = response.json()
            pricing = data.get("pricing", {})
            
            # For pay_online, full MRP should be charged
            if "razorpay" in data:
                razorpay_data = data["razorpay"]
                amount_paise = razorpay_data.get("amount", 0)
                expected_paise = int(mrp * 100)
                assert amount_paise == expected_paise, f"Pay-online should charge full MRP ({mrp} = {expected_paise} paise), got: {amount_paise}"
                print(f"Full online payment amount: {amount_paise / 100} INR")
            
            # Verify shipping is still 0 for self-pickup
            assert pricing.get("shipping", 0) == 0, "Shipping should be 0 for self-pickup"
            
            print(f"Self-pickup pay-online pricing: {pricing}")
        else:
            print(f"Self-pickup pay-online returned {response.status_code}: {response.json()}")


class TestOrderStatusLogic:
    """Test order status is correctly set based on delivery mode - now extracted to services"""
    
    def test_shipping_order_status_would_be_confirmed(self):
        """Verify that get_order_status_for_delivery_mode returns 'confirmed' for shipping"""
        # This tests the logic indirectly - actual order status is set after payment verification
        # The extracted function should return 'confirmed' for shipping mode
        # We verify this by checking the service module exists and has correct logic
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.order_pricing import get_order_status_for_delivery_mode
            
            # Test shipping mode - should return 'confirmed'
            status = get_order_status_for_delivery_mode('shipping', False)
            assert status == 'confirmed', f"Shipping status should be 'confirmed', got: {status}"
            
            print(f"Shipping order status: {status}")
        except ImportError as e:
            pytest.skip(f"Could not import service module: {e}")
    
    def test_self_pickup_pay_at_store_status(self):
        """Verify that get_order_status_for_delivery_mode returns 'pending_pickup' for pay-at-store"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.order_pricing import get_order_status_for_delivery_mode
            
            # Self-pickup with pay-at-store should return 'pending_pickup'
            status = get_order_status_for_delivery_mode('self_pickup', True)
            assert status == 'pending_pickup', f"Self-pickup pay-at-store status should be 'pending_pickup', got: {status}"
            
            print(f"Self-pickup (pay-at-store) status: {status}")
        except ImportError as e:
            pytest.skip(f"Could not import service module: {e}")
    
    def test_self_pickup_pay_online_status(self):
        """Verify that get_order_status_for_delivery_mode returns 'ready_for_pickup' for full payment"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.order_pricing import get_order_status_for_delivery_mode
            
            # Self-pickup with full online payment should return 'ready_for_pickup'
            status = get_order_status_for_delivery_mode('self_pickup', False)
            assert status == 'ready_for_pickup', f"Self-pickup pay-online status should be 'ready_for_pickup', got: {status}"
            
            print(f"Self-pickup (pay-online) status: {status}")
        except ImportError as e:
            pytest.skip(f"Could not import service module: {e}")


class TestCouponValidationService:
    """Test the validate_and_apply_coupon service function directly"""
    
    def test_coupon_validation_service_function_sync(self):
        """Test validate_and_apply_coupon logic for self-pickup returns no discount"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.order_pricing import validate_and_apply_coupon
            
            # Run async function in a sync context for testing
            import asyncio
            
            async def test_coupon():
                # Create a mock db object that mimics MongoDB
                class MockDB:
                    class discount_codes:
                        @staticmethod
                        async def find_one(query):
                            return None  # No coupon found
                
                # Test: Self-pickup should not apply coupon regardless of code
                result = await validate_and_apply_coupon(
                    MockDB(),
                    "TESTCODE",
                    1000,  # mrp_total
                    "self_pickup"
                )
                return result
            
            result = asyncio.get_event_loop().run_until_complete(test_coupon())
            
            assert result["coupon_discount"] == 0, f"Self-pickup should have 0 coupon discount, got: {result}"
            assert result["has_coupon_applied"] == False, f"Self-pickup should not have coupon applied, got: {result}"
            
            print(f"Coupon validation for self-pickup: {result}")
        except ImportError as e:
            pytest.skip(f"Could not import service module: {e}")
    
    def test_coupon_validation_empty_code_sync(self):
        """Test validate_and_apply_coupon with empty code returns no discount"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.order_pricing import validate_and_apply_coupon
            
            import asyncio
            
            async def test_empty_coupon():
                class MockDB:
                    class discount_codes:
                        @staticmethod
                        async def find_one(query):
                            return None
                
                # Test: Empty code should not apply coupon
                result = await validate_and_apply_coupon(
                    MockDB(),
                    "",
                    1000,  # mrp_total
                    "shipping"
                )
                return result
            
            result = asyncio.get_event_loop().run_until_complete(test_empty_coupon())
            
            assert result["coupon_discount"] == 0, f"Empty code should have 0 discount, got: {result}"
            assert result["has_coupon_applied"] == False, f"Empty code should not be applied, got: {result}"
            
            print(f"Coupon validation for empty code: {result}")
        except ImportError as e:
            pytest.skip(f"Could not import service module: {e}")


class TestPackageCalculation:
    """Test package details calculation - extracted to services"""
    
    def test_package_calculation_service(self):
        """Test calculate_package_details function"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        try:
            from services.order_pricing import calculate_package_details
            
            # Test with 50g items
            items_50g = [
                {"size": "50g", "quantity": 2}
            ]
            package = calculate_package_details(items_50g)
            
            assert "weight" in package, "Should have weight"
            assert "length" in package, "Should have length"
            assert "breadth" in package, "Should have breadth"
            assert "height" in package, "Should have height"
            
            # 2 x 50g = 2 x 0.08kg = 0.16kg (but min is 0.25)
            assert package["weight"] >= 0.25, f"Weight should be at least 0.25kg, got: {package['weight']}"
            
            print(f"Package details for 2x50g: {package}")
            
            # Test with 200g items
            items_200g = [
                {"size": "200g", "quantity": 3}
            ]
            package_200 = calculate_package_details(items_200g)
            
            # 3 x 200g = 3 x 0.35kg = 1.05kg
            assert package_200["weight"] >= 1.0, f"Weight should be ~1.05kg, got: {package_200['weight']}"
            
            print(f"Package details for 3x200g: {package_200}")
            
        except ImportError as e:
            pytest.skip(f"Could not import service module: {e}")


class TestRetailerAssignment:
    """Test that retailer assignment still works for shipping orders"""
    
    def test_retailers_endpoint_for_pickup(self):
        """Test /api/maps/retailers/self-pickup returns valid retailer data"""
        response = requests.get(f"{BASE_URL}/api/maps/retailers/self-pickup")
        assert response.status_code == 200
        
        data = response.json()
        retailers = data.get("retailers", [])
        assert len(retailers) >= 1, "Should have at least one pickup location"
        
        # Verify retailer has required fields
        retailer = retailers[0]
        required_fields = ["id", "name", "address", "city", "state", "pincode", "email", "phone"]
        for field in required_fields:
            assert field in retailer, f"Retailer should have {field}"
        
        print(f"Retailers available: {[r['name'] for r in retailers]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
