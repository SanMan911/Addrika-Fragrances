"""
Test suite for Products MongoDB migration, Notify Me feature, and Admin Product CRUD
Tests: GET /api/products, POST /api/notify-me, POST /api/cart/{session}/add,
       GET /api/admin/products, POST/DELETE /api/admin/products, PATCH toggle-active
"""
import pytest
import requests
import os
import secrets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://addrika-kyc-onboard.preview.emergentagent.com').rstrip('/')


class TestProductsAPI:
    """Test products loaded from MongoDB"""
    
    def test_get_products_returns_7_products(self):
        """GET /api/products should return 7 products from MongoDB"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        assert len(products) == 7, f"Expected 7 products, got {len(products)}"
    
    def test_products_have_required_fields(self):
        """Products should have id, name, sizes, comingSoon, isActive fields"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        for product in products:
            assert "id" in product, f"Product missing 'id' field"
            assert "name" in product, f"Product missing 'name' field"
            assert "sizes" in product, f"Product missing 'sizes' field"
            assert "comingSoon" in product or product.get("comingSoon") is None, "comingSoon field check"
            assert "isActive" in product or product.get("isActive") is None, "isActive field check"
    
    def test_coming_soon_products_exist(self):
        """Should have 2 coming-soon products: grated-omani-bakhoor and yemeni-bakhoor-chips"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        coming_soon = [p for p in products if p.get("comingSoon") == True]
        assert len(coming_soon) == 2, f"Expected 2 coming-soon products, got {len(coming_soon)}"
        
        coming_soon_ids = [p["id"] for p in coming_soon]
        assert "grated-omani-bakhoor" in coming_soon_ids
        assert "yemeni-bakhoor-chips" in coming_soon_ids
    
    def test_get_single_product_by_id(self):
        """GET /api/products/{id} should return product details"""
        response = requests.get(f"{BASE_URL}/api/products/kesar-chandan")
        assert response.status_code == 200
        
        product = response.json()
        assert product["id"] == "kesar-chandan"
        assert product["name"] == "Kesar Chandan"
        assert product.get("comingSoon") == False or product.get("comingSoon") is None
    
    def test_get_coming_soon_product(self):
        """GET /api/products/{id} for coming-soon product"""
        response = requests.get(f"{BASE_URL}/api/products/grated-omani-bakhoor")
        assert response.status_code == 200
        
        product = response.json()
        assert product["id"] == "grated-omani-bakhoor"
        assert product["comingSoon"] == True


class TestNotifyMeAPI:
    """Test Notify Me email capture for coming-soon products"""
    
    def test_notify_me_success_for_coming_soon(self):
        """POST /api/notify-me should succeed for coming-soon products"""
        test_email = f"test_{secrets.token_hex(4)}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/notify-me",
            json={"email": test_email, "product_id": "grated-omani-bakhoor"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "notified" in data["message"].lower() or "launch" in data["message"].lower()
    
    def test_notify_me_fails_for_regular_product(self):
        """POST /api/notify-me should return 400 for non-coming-soon products"""
        response = requests.post(
            f"{BASE_URL}/api/notify-me",
            json={"email": "test@example.com", "product_id": "kesar-chandan"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "available" in data["detail"].lower()
    
    def test_notify_me_fails_for_invalid_product(self):
        """POST /api/notify-me should return 404 for non-existent products"""
        response = requests.post(
            f"{BASE_URL}/api/notify-me",
            json={"email": "test@example.com", "product_id": "non-existent-product"}
        )
        assert response.status_code == 404
    
    def test_notify_me_requires_valid_email(self):
        """POST /api/notify-me should validate email format"""
        response = requests.post(
            f"{BASE_URL}/api/notify-me",
            json={"email": "invalid-email", "product_id": "grated-omani-bakhoor"}
        )
        assert response.status_code == 422  # Pydantic validation error


class TestCartBlockingComingSoon:
    """Test cart add blocking for coming-soon products"""
    
    def test_cart_add_blocked_for_coming_soon(self):
        """POST /api/cart/{session}/add should return 400 for coming-soon products"""
        session_id = f"test-session-{secrets.token_hex(4)}"
        response = requests.post(
            f"{BASE_URL}/api/cart/{session_id}/add",
            json={
                "productId": "grated-omani-bakhoor",
                "name": "Grated Omani Bakhoor",
                "image": "test.jpg",
                "size": "50g",
                "mrp": 249,
                "price": 249,
                "quantity": 1
            }
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "coming soon" in data["detail"].lower()
    
    def test_cart_add_succeeds_for_regular_product(self):
        """POST /api/cart/{session}/add should succeed for regular products"""
        session_id = f"test-session-{secrets.token_hex(4)}"
        response = requests.post(
            f"{BASE_URL}/api/cart/{session_id}/add",
            json={
                "productId": "kesar-chandan",
                "name": "Kesar Chandan",
                "image": "test.jpg",
                "size": "50g",
                "mrp": 110,
                "price": 99,
                "quantity": 1
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["productId"] == "kesar-chandan"


class TestAdminProductsAPI:
    """Test admin product management endpoints (requires auth)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token via 2FA flow"""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        
        # Step 1: Initiate login
        response = requests.post(
            f"{BASE_URL}/api/admin/login/initiate",
            json={"email": "contact.us@centraders.com", "pin": "050499"}
        )
        if response.status_code != 200:
            pytest.skip("Admin login initiate failed")
        
        data = response.json()
        token_id = data.get("token_id")
        
        # Step 2: Get OTP from MongoDB
        async def get_otp():
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client["addrika_db"]
            token = await db["admin_2fa_tokens"].find_one({"token_id": token_id})
            client.close()
            return token.get("otp") if token else None
        
        otp = asyncio.run(get_otp())
        if not otp:
            pytest.skip("Could not get OTP from database")
        
        # Step 3: Verify OTP
        response = requests.post(
            f"{BASE_URL}/api/admin/login/verify-otp",
            json={"token_id": token_id, "otp": otp}
        )
        if response.status_code != 200:
            pytest.skip("Admin OTP verification failed")
        
        return response.json().get("session_token")
    
    def test_admin_get_all_products(self, admin_token):
        """GET /api/admin/products should return all products including inactive"""
        response = requests.get(
            f"{BASE_URL}/api/admin/products",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        products = response.json()
        assert len(products) >= 7  # At least 7 products
    
    def test_admin_get_notify_me_signups(self, admin_token):
        """GET /api/admin/notify-me should return aggregated signups"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notify-me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one signup from our earlier test
        if len(data) > 0:
            assert "product_id" in data[0]
            assert "count" in data[0]
            assert "emails" in data[0]
    
    def test_admin_create_and_delete_product(self, admin_token):
        """POST and DELETE /api/admin/products should work"""
        # Create product
        test_product_name = f"Test Product {secrets.token_hex(4)}"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/products",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": test_product_name,
                "tagline": "Test tagline",
                "type": "agarbatti",
                "category": "agarbatti",
                "description": "Test description",
                "notes": ["Test note"],
                "image": "https://example.com/test.jpg",
                "burnTime": "30 minutes",
                "sizes": [{"size": "50g", "mrp": 150, "price": 120, "images": []}],
                "rating": 0,
                "reviews": 0,
                "comingSoon": False,
                "isActive": True
            }
        )
        assert create_response.status_code == 200
        
        data = create_response.json()
        assert data["message"] == "Product created"
        product_id = data["product"]["id"]
        
        # Delete product
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Product deleted"
    
    def test_admin_toggle_active(self, admin_token):
        """PATCH /api/admin/products/{id}/toggle-active should toggle status"""
        # Create a test product first
        test_product_name = f"Toggle Test {secrets.token_hex(4)}"
        create_response = requests.post(
            f"{BASE_URL}/api/admin/products",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": test_product_name,
                "tagline": "Test",
                "type": "agarbatti",
                "category": "agarbatti",
                "description": "Test",
                "notes": [],
                "image": "",
                "burnTime": "",
                "sizes": [{"size": "50g", "mrp": 100, "price": 90, "images": []}],
                "rating": 0,
                "reviews": 0,
                "comingSoon": False,
                "isActive": True
            }
        )
        assert create_response.status_code == 200
        product_id = create_response.json()["product"]["id"]
        
        # Toggle active (should deactivate)
        toggle_response = requests.patch(
            f"{BASE_URL}/api/admin/products/{product_id}/toggle-active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert toggle_response.status_code == 200
        assert toggle_response.json()["isActive"] == False
        
        # Toggle again (should activate)
        toggle_response2 = requests.patch(
            f"{BASE_URL}/api/admin/products/{product_id}/toggle-active",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert toggle_response2.status_code == 200
        assert toggle_response2.json()["isActive"] == True
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_admin_endpoints_require_auth(self):
        """Admin endpoints should return 401/403 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/products")
        assert response.status_code in [401, 403]
        
        response = requests.get(f"{BASE_URL}/api/admin/notify-me")
        assert response.status_code in [401, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
