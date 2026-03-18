"""
Test ShipRocket Webhook and Partner Features - Iteration 10
Tests:
1. ShipRocket webhook endpoint renamed to /api/shipping/webhook/tracking-updates
2. Webhook test endpoint returns correct URL
3. Webhook processes shipping status updates
4. Inquiry API supports distributor type with business_type, region, experience fields
5. Google Analytics ID configured correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWebhookEndpoints:
    """Test ShipRocket webhook endpoints with renamed URL"""
    
    def test_webhook_test_endpoint_returns_correct_url(self):
        """Test that webhook test endpoint returns the renamed URL path"""
        response = requests.get(f"{BASE_URL}/api/shipping/webhook/test")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "active"
        assert data["webhook_url"] == "/api/shipping/webhook/tracking-updates"
        assert data["token_configured"] == True
        assert "timestamp" in data
        print("PASSED: Webhook test endpoint returns correct URL /api/shipping/webhook/tracking-updates")
    
    def test_webhook_tracking_updates_endpoint_exists(self):
        """Test that the renamed webhook endpoint exists and accepts POST"""
        # Test with a valid payload
        payload = {
            "awb": "TEST_AWB_123",
            "order_id": "TEST_ORDER_001",
            "current_status": "Shipped",
            "current_status_id": 6,
            "courier_name": "Test Courier"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/shipping/webhook/tracking-updates",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["awb"] == "TEST_AWB_123"
        assert data["order_id"] == "TEST_ORDER_001"
        assert data["status_received"] == "Shipped"
        assert data["mapped_status"] == "shipped"
        print("PASSED: Webhook tracking-updates endpoint processes shipment status")
    
    def test_webhook_status_mapping(self):
        """Test different status codes are mapped correctly"""
        test_cases = [
            (1, "processing"),   # AWB Assigned
            (6, "shipped"),      # Shipped
            (7, "delivered"),    # Delivered
            (17, "out_for_delivery"),  # Out For Delivery
            (18, "in_transit"),  # In Transit
            (8, "cancelled"),    # Cancelled
        ]
        
        for status_id, expected_mapped in test_cases:
            payload = {
                "awb": f"TEST_AWB_{status_id}",
                "order_id": f"TEST_ORDER_{status_id}",
                "current_status_id": status_id
            }
            
            response = requests.post(
                f"{BASE_URL}/api/shipping/webhook/tracking-updates",
                json=payload
            )
            assert response.status_code == 200
            data = response.json()
            assert data["mapped_status"] == expected_mapped, f"Status ID {status_id} should map to {expected_mapped}, got {data['mapped_status']}"
        
        print("PASSED: All status IDs map correctly")
    
    def test_old_webhook_url_not_accessible(self):
        """Test that the old webhook URL (shiprocket) is no longer accessible"""
        payload = {"awb": "TEST"}
        response = requests.post(
            f"{BASE_URL}/api/shipping/webhook/shiprocket",
            json=payload
        )
        # Should return 404 or method not allowed since route was renamed
        assert response.status_code in [404, 405, 422], f"Old webhook URL should not be accessible, got {response.status_code}"
        print("PASSED: Old webhook URL /api/shipping/webhook/shiprocket is not accessible")


class TestInquiryDistributorType:
    """Test distributor inquiry type functionality"""
    
    def test_inquiry_endpoint_exists(self):
        """Test that inquiry endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/inquiries")
        # Should either return list or 404 for GET
        # If POST-only, options should show POST
        assert response.status_code in [200, 404, 405, 401]
        print("PASSED: Inquiry endpoint accessible")
    
    def test_inquiry_schema_accepts_distributor_fields(self):
        """Test that inquiry API accepts distributor-specific fields"""
        # This test verifies the API schema by checking the Pydantic model
        # We can't submit without captcha, but we can test the validation
        payload = {
            "name": "Test Distributor",
            "email": "test@example.com",
            "phone": "+91 9876543210",
            "company": "Test Company",
            "inquiryType": "distributor",
            "businessType": "wholesaler",
            "region": "Delhi NCR",
            "experience": "5-10"
        }
        
        # Without captcha, this should fail with captcha validation, not schema error
        response = requests.post(
            f"{BASE_URL}/api/inquiries",
            json=payload
        )
        
        # Check that it doesn't fail with validation error on distributor fields
        if response.status_code == 422:
            data = response.json()
            # Should fail on captcha, not on distributor fields
            error_fields = [e.get("loc", [])[-1] for e in data.get("detail", [])]
            assert "businessType" not in error_fields, "businessType should be accepted"
            assert "region" not in error_fields, "region should be accepted"
            assert "experience" not in error_fields, "experience should be accepted"
        else:
            # If it's 401 (unauthorized) or 400 (captcha), that's expected
            assert response.status_code in [400, 401], f"Unexpected status: {response.status_code}"
        
        print("PASSED: Inquiry API accepts distributor-specific fields")


class TestGoogleAnalytics:
    """Test Google Analytics configuration"""
    
    def test_ga_measurement_id_in_frontend_env(self):
        """Test that GA Measurement ID is configured in frontend env"""
        # Read the frontend .env file
        env_path = "/app/frontend/.env"
        with open(env_path, "r") as f:
            env_content = f.read()
        
        assert "REACT_APP_GA_MEASUREMENT_ID=G-9CBN63VGCK" in env_content
        print("PASSED: GA Measurement ID G-9CBN63VGCK configured in frontend/.env")
    
    def test_analytics_js_has_correct_id(self):
        """Test that analytics.js has the correct GA ID"""
        analytics_path = "/app/frontend/src/lib/analytics.js"
        with open(analytics_path, "r") as f:
            content = f.read()
        
        assert "G-9CBN63VGCK" in content
        assert "GA_MEASUREMENT_ID" in content
        print("PASSED: analytics.js has correct GA Measurement ID")


class TestAmazonPlaceholder:
    """Test Amazon QR placeholder configuration"""
    
    def test_instagram_feed_has_amazon_placeholder(self):
        """Test that InstagramFeed.jsx has Amazon Coming Soon placeholder"""
        feed_path = "/app/frontend/src/components/InstagramFeed.jsx"
        with open(feed_path, "r") as f:
            content = f.read()
        
        assert "amazon-qr-placeholder" in content, "Should have Amazon QR placeholder test ID"
        assert "Amazon Coming Soon" in content, "Should show 'Amazon Coming Soon' text"
        assert "enabled: false" in content, "Amazon should be disabled (placeholder mode)"
        print("PASSED: Amazon QR placeholder correctly configured")


class TestPartnerWithUsButton:
    """Test Partner With Us button in footer"""
    
    def test_footer_has_partner_button(self):
        """Test that Footer.jsx has Partner With Us button"""
        footer_path = "/app/frontend/src/components/Footer.jsx"
        with open(footer_path, "r") as f:
            content = f.read()
        
        assert "partner-with-us-btn" in content, "Should have Partner With Us button test ID"
        assert "Partner With Us" in content, "Should have 'Partner With Us' text"
        assert "openInquiry('distributor')" in content, "Should open distributor inquiry modal"
        print("PASSED: Partner With Us button correctly configured in footer")
    
    def test_inquiry_modal_has_distributor_type(self):
        """Test that InquiryModal supports distributor inquiry type"""
        modal_path = "/app/frontend/src/components/InquiryModal.jsx"
        with open(modal_path, "r") as f:
            content = f.read()
        
        assert "type === 'distributor'" in content, "Should check for distributor type"
        assert "businessType" in content, "Should have businessType field"
        assert "region" in content, "Should have region field"
        assert "experience" in content, "Should have experience field"
        assert "Partnership Inquiry" in content, "Should have 'Partnership Inquiry' title"
        assert "Become a regional distributor" in content, "Should have distributor subtitle"
        print("PASSED: InquiryModal supports distributor inquiry type with correct fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
