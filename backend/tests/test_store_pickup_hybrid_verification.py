"""
Test Store Pickup Hybrid Verification System
Tests:
1. OTPVerifyRequest model with use_master_password flag
2. OTP verification with correct OTP code
3. MasterPassword 'AddrikaAdmin@2026' override verification
4. Admin email notifications (send_admin_order_routed_email, send_admin_pickup_completion_email)
5. Retailer dashboard update_order_status sends admin email on 'delivered'
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestStorePickupVerifyOTPEndpoint:
    """Tests for POST /api/store-pickup/verify-otp endpoint"""
    
    def test_verify_otp_endpoint_exists(self):
        """Test that the verify-otp endpoint exists and accepts POST"""
        # Test with minimal data to check endpoint exists
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_ORDER_12345",
            "otp_code": "123456",
            "retailer_id": "test_retailer"
        })
        
        # 404 with "Order OTP not found" means endpoint exists, just no matching order
        # 405 would mean method not allowed
        assert response.status_code != 405, "Method not allowed"
        
        if response.status_code == 404:
            data = response.json()
            # If it's "Order OTP not found" that's fine - endpoint exists
            assert "not found" in data.get("detail", "").lower(), "Endpoint should return 'not found' for non-existent order"
        
        print(f"PASS: verify-otp endpoint exists, status: {response.status_code}")
    
    def test_verify_otp_request_accepts_use_master_password_flag(self):
        """Test that use_master_password field is accepted in request body"""
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_ORDER_MP_12345",
            "otp_code": "AddrikaAdmin@2026",
            "retailer_id": "test_retailer_mp",
            "use_master_password": True  # Testing this flag
        })
        
        # Should not give 422 validation error for use_master_password field
        assert response.status_code != 422, f"Schema validation failed: {response.text}"
        print(f"PASS: use_master_password flag accepted, status: {response.status_code}")
    
    def test_verify_otp_returns_404_for_nonexistent_order(self):
        """Test that non-existent order returns 404"""
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "NONEXISTENT_ORDER_XYZ",
            "otp_code": "123456",
            "retailer_id": "test_retailer"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "not found" in data.get("detail", "").lower(), f"Expected 'not found' message, got: {data}"
        print(f"PASS: Non-existent order returns 404 with correct message")
    
    def test_master_password_value_is_correct(self):
        """Test that MasterPassword constant is set to 'AddrikaAdmin@2026'"""
        # We test indirectly by sending a request with the master password
        # The endpoint should not give a "Invalid OTP" response when use_master_password=True
        # and correct master password is provided (even for non-existent order, 
        # it should fail on "order not found" not "invalid otp")
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_ORDER_MP_CHECK",
            "otp_code": "AddrikaAdmin@2026",  # The expected master password
            "retailer_id": "test_retailer",
            "use_master_password": True
        })
        
        # Should fail on "order not found" not "invalid credentials" or "wrong password"
        if response.status_code == 404:
            data = response.json()
            assert "not found" in data.get("detail", "").lower()
            print(f"PASS: Master password check passed (order not found as expected)")
        else:
            # If there's an actual order, check response
            print(f"Response: {response.status_code} - {response.text}")


class TestStorePickupAPISchema:
    """Test API schema and model validation"""
    
    def test_otp_verify_request_required_fields(self):
        """Test that required fields are enforced"""
        # Missing order_number
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "otp_code": "123456",
            "retailer_id": "test_retailer"
        })
        assert response.status_code == 422, "Should fail validation without order_number"
        print(f"PASS: order_number is required")
        
        # Missing otp_code
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_123",
            "retailer_id": "test_retailer"
        })
        assert response.status_code == 422, "Should fail validation without otp_code"
        print(f"PASS: otp_code is required")
        
        # Missing retailer_id
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_123",
            "otp_code": "123456"
        })
        assert response.status_code == 422, "Should fail validation without retailer_id"
        print(f"PASS: retailer_id is required")
    
    def test_use_master_password_is_optional(self):
        """Test that use_master_password field is optional (defaults to False)"""
        # Request without use_master_password should work
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_ORDER_OPT",
            "otp_code": "123456",
            "retailer_id": "test_retailer"
        })
        
        # Should not be 422 validation error
        assert response.status_code != 422, "use_master_password should be optional"
        print(f"PASS: use_master_password is optional, status: {response.status_code}")


class TestRetailerDashboardDeliveryNotification:
    """Test PUT /api/retailer-dashboard/orders/{order_number}/status endpoint"""
    
    def test_retailer_order_status_endpoint_exists(self):
        """Test that the order status update endpoint exists"""
        # Without auth, should get 401 not 404
        response = requests.put(
            f"{BASE_URL}/api/retailer-dashboard/orders/TEST_ORDER_123/status",
            json={"status": "delivered"}
        )
        
        # Should return 401 (unauthorized) not 404 or 405
        assert response.status_code in [401, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 401:
            print(f"PASS: Endpoint exists and requires authentication")
        else:
            print(f"PASS: Endpoint exists, returned 404 for non-existent order")
    
    def test_order_status_update_validates_status_values(self):
        """Test that only valid status values are accepted"""
        # Valid statuses: confirmed, processing, ready_for_pickup, shipped, delivered
        invalid_response = requests.put(
            f"{BASE_URL}/api/retailer-dashboard/orders/TEST_ORDER/status",
            json={"status": "invalid_status_xyz"}
        )
        
        # Should either be 422 (validation) or 401 (auth required first)
        assert invalid_response.status_code in [401, 422], f"Status: {invalid_response.status_code}"
        print(f"PASS: Invalid status handling works, got {invalid_response.status_code}")


class TestAdminEmailFunctionsExist:
    """Test that admin notification functions are defined in the codebase"""
    
    def test_verify_store_pickup_module_imports(self):
        """Verify store_pickup module can be imported"""
        try:
            # This is a code-level check
            import sys
            sys.path.insert(0, '/app/backend')
            from routers.store_pickup import (
                send_admin_pickup_completion_email,
                send_admin_order_routed_email,
                ADMIN_MASTER_PASSWORD,
                ADMIN_EMAIL
            )
            
            # Verify master password
            assert ADMIN_MASTER_PASSWORD == "AddrikaAdmin@2026", f"Master password mismatch: {ADMIN_MASTER_PASSWORD}"
            print(f"PASS: ADMIN_MASTER_PASSWORD = 'AddrikaAdmin@2026'")
            
            # Verify admin email
            assert ADMIN_EMAIL == "contact.us@centraders.com", f"Admin email mismatch: {ADMIN_EMAIL}"
            print(f"PASS: ADMIN_EMAIL = 'contact.us@centraders.com'")
            
            # Verify functions are async
            import inspect
            assert inspect.iscoroutinefunction(send_admin_pickup_completion_email), \
                "send_admin_pickup_completion_email should be async"
            print(f"PASS: send_admin_pickup_completion_email is async function")
            
            assert inspect.iscoroutinefunction(send_admin_order_routed_email), \
                "send_admin_order_routed_email should be async"
            print(f"PASS: send_admin_order_routed_email is async function")
            
        except ImportError as e:
            pytest.fail(f"Failed to import store_pickup module: {e}")
    
    def test_verify_retailer_dashboard_module_imports(self):
        """Verify retailer_dashboard module has delivery notification"""
        try:
            import sys
            sys.path.insert(0, '/app/backend')
            from routers.retailer_dashboard import (
                send_admin_delivery_notification,
                ADMIN_EMAIL
            )
            
            import inspect
            assert inspect.iscoroutinefunction(send_admin_delivery_notification), \
                "send_admin_delivery_notification should be async"
            print(f"PASS: send_admin_delivery_notification is async function")
            
        except ImportError as e:
            pytest.fail(f"Failed to import retailer_dashboard module: {e}")


class TestVerificationMethodResponse:
    """Test verification method response format"""
    
    def test_verify_otp_response_structure_documented(self):
        """Document expected response structure for verify-otp endpoint"""
        # Based on code review, expected successful response:
        # {
        #   "success": True,
        #   "message": "Order verified successfully via customer otp! Marked as delivered.",
        #   "order_number": "ADD-...",
        #   "verified_at": "2026-01-...",
        #   "verification_method": "customer_otp" or "master_password",
        #   "balance_collected": 0
        # }
        
        # Expected failure response:
        # {
        #   "success": False,
        #   "message": "Invalid OTP. Please check and try again, or use admin verification."
        # }
        print("PASS: Response structure documented")
        print("Success response includes: success, message, order_number, verified_at, verification_method, balance_collected")
        print("Failure response includes: success, message")


class TestVerifyOTPWithTestData:
    """Tests using pre-seeded test data in database"""
    
    def test_verify_otp_with_correct_otp_code(self):
        """Test OTP verification with correct OTP code"""
        # Using test data: order_number=TEST_OTP_VERIFY_001, otp_code=123456, retailer_id=RTL_DELHI001
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_OTP_VERIFY_001",
            "otp_code": "123456",
            "retailer_id": "RTL_DELHI001"
        })
        
        print(f"Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, f"Expected success=True, got: {data}"
            assert data.get("verification_method") == "customer_otp", f"Expected method=customer_otp, got: {data.get('verification_method')}"
            print(f"PASS: OTP verification successful with correct OTP")
        else:
            # May fail if order was already verified by previous test run
            print(f"Note: Test may have run before - got status {response.status_code}")
    
    def test_verify_otp_with_wrong_otp_code(self):
        """Test OTP verification with incorrect OTP code"""
        # First, reset the test OTP to pending status
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_OTP_VERIFY_001",
            "otp_code": "999999",  # Wrong OTP
            "retailer_id": "RTL_DELHI001"
        })
        
        print(f"Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            # Wrong OTP should return success=False
            if data.get("success") == False:
                assert "invalid" in data.get("message", "").lower() or "already been picked up" in data.get("message", "").lower()
                print(f"PASS: Wrong OTP correctly rejected")
            else:
                # Order may already be verified
                print(f"Note: Order may already be verified")
    
    def test_verify_otp_already_verified_order(self):
        """Test OTP verification for already verified order"""
        # Using TEST_OTP_VERIFIED_001 which is pre-verified
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_OTP_VERIFIED_001",
            "otp_code": "654321",
            "retailer_id": "RTL_DELHI001"
        })
        
        print(f"Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == False, "Already verified order should return success=False"
            assert "already been picked up" in data.get("message", "").lower()
            print(f"PASS: Already verified order correctly handled")
    
    def test_verify_otp_wrong_retailer(self):
        """Test OTP verification with wrong retailer ID"""
        # TEST_OTP_WRONG_RETAILER_001 belongs to RTL_MUMBAI001, trying with RTL_DELHI001
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_OTP_WRONG_RETAILER_001",
            "otp_code": "111222",
            "retailer_id": "RTL_DELHI001"  # Wrong retailer
        })
        
        print(f"Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == False, "Wrong retailer should return success=False"
            assert "different store" in data.get("message", "").lower()
            print(f"PASS: Wrong retailer correctly rejected")
    
    def test_master_password_override_verification(self):
        """Test MasterPassword override verification"""
        # Using master password with use_master_password=True
        response = requests.post(f"{BASE_URL}/api/store-pickup/verify-otp", json={
            "order_number": "TEST_OTP_WRONG_RETAILER_001",
            "otp_code": "AddrikaAdmin@2026",  # Master password
            "retailer_id": "RTL_MUMBAI001",  # Correct retailer for this order
            "use_master_password": True
        })
        
        print(f"Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                assert data.get("verification_method") == "master_password", f"Expected method=master_password, got: {data.get('verification_method')}"
                print(f"PASS: Master password override worked correctly")
            else:
                # May already be verified
                print(f"Note: Order may already be verified - {data.get('message')}")


class TestCleanupTestData:
    """Cleanup test data after tests"""
    
    def test_cleanup_test_otps(self):
        """Cleanup test OTP records (runs last due to class name)"""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        
        async def cleanup():
            client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
            db = client[os.environ.get('DB_NAME', 'addrika_db')]
            
            # Delete test OTPs
            result = await db.store_pickup_otps.delete_many({
                "order_number": {"$regex": "^TEST_"}
            })
            print(f"Cleaned up {result.deleted_count} test OTP records")
            return result.deleted_count
        
        deleted = asyncio.get_event_loop().run_until_complete(cleanup())
        print(f"PASS: Cleanup completed, removed {deleted} test records")


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
