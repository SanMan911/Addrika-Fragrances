"""
Test Bakhoor Products and Coming Soon Feature
Tests for:
1. GET /api/products returns 7 products including 2 with comingSoon=true
2. POST /api/cart/{session_id}/add returns 400 for coming-soon products
3. POST /api/cart/{session_id}/add succeeds for regular products
4. GET /api/admin/tree-donations endpoint exists (requires auth)
5. Bakhoor product prices are correct
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://kyc-verification-14.preview.emergentagent.com')

class TestProductsAPI:
    """Test products API endpoints"""
    
    def test_get_all_products_returns_7_products(self):
        """GET /api/products should return 7 products total"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        products = response.json()
        assert isinstance(products, list), "Response should be a list"
        assert len(products) == 7, f"Expected 7 products, got {len(products)}"
        print(f"✓ GET /api/products returns {len(products)} products")
    
    def test_products_include_two_coming_soon_bakhoor(self):
        """Products should include 2 items with comingSoon=true"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        coming_soon_products = [p for p in products if p.get('comingSoon') == True]
        
        assert len(coming_soon_products) == 2, f"Expected 2 coming soon products, got {len(coming_soon_products)}"
        
        # Verify the specific products
        coming_soon_ids = [p['id'] for p in coming_soon_products]
        assert 'grated-omani-bakhoor' in coming_soon_ids, "grated-omani-bakhoor should be coming soon"
        assert 'yemeni-bakhoor-chips' in coming_soon_ids, "yemeni-bakhoor-chips should be coming soon"
        
        print(f"✓ Found 2 coming soon products: {coming_soon_ids}")
    
    def test_grated_omani_bakhoor_details(self):
        """Verify Grated Omani Bakhoor product details"""
        response = requests.get(f"{BASE_URL}/api/products/grated-omani-bakhoor")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        product = response.json()
        assert product['id'] == 'grated-omani-bakhoor'
        assert product['name'] == 'Grated Omani Bakhoor'
        assert product['comingSoon'] == True, "Product should be marked as coming soon"
        assert product['type'] == 'bakhoor'
        assert product['category'] == 'bakhoor'
        
        # Verify price
        assert len(product['sizes']) >= 1
        size_50g = next((s for s in product['sizes'] if s['size'] == '50g'), None)
        assert size_50g is not None, "Should have 50g size"
        assert size_50g['mrp'] == 249, f"Expected MRP 249, got {size_50g['mrp']}"
        assert size_50g['price'] == 249, f"Expected price 249, got {size_50g['price']}"
        
        # Verify 0 reviews for coming soon
        assert product['rating'] == 0, "Coming soon product should have 0 rating"
        assert product['reviews'] == 0, "Coming soon product should have 0 reviews"
        
        print(f"✓ Grated Omani Bakhoor: ₹{size_50g['mrp']} MRP, comingSoon=True, 0 reviews")
    
    def test_yemeni_bakhoor_chips_details(self):
        """Verify Yemeni Bakhoor Chips product details"""
        response = requests.get(f"{BASE_URL}/api/products/yemeni-bakhoor-chips")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        product = response.json()
        assert product['id'] == 'yemeni-bakhoor-chips'
        assert product['name'] == 'Yemeni Bakhoor Chips'
        assert product['comingSoon'] == True, "Product should be marked as coming soon"
        assert product['type'] == 'bakhoor'
        assert product['category'] == 'bakhoor'
        
        # Verify price
        assert len(product['sizes']) >= 1
        size_40g = next((s for s in product['sizes'] if s['size'] == '40g'), None)
        assert size_40g is not None, "Should have 40g size"
        assert size_40g['mrp'] == 399, f"Expected MRP 399, got {size_40g['mrp']}"
        assert size_40g['price'] == 399, f"Expected price 399, got {size_40g['price']}"
        
        # Verify 0 reviews for coming soon
        assert product['rating'] == 0, "Coming soon product should have 0 rating"
        assert product['reviews'] == 0, "Coming soon product should have 0 reviews"
        
        print(f"✓ Yemeni Bakhoor Chips: ₹{size_40g['mrp']} MRP, comingSoon=True, 0 reviews")


class TestCartComingSoonBlock:
    """Test that coming soon products cannot be added to cart"""
    
    @pytest.fixture
    def session_id(self):
        """Generate unique session ID for cart tests"""
        return f"test-session-{uuid.uuid4().hex[:8]}"
    
    def test_cannot_add_grated_omani_bakhoor_to_cart(self, session_id):
        """POST /api/cart/{session_id}/add should return 400 for grated-omani-bakhoor"""
        payload = {
            "productId": "grated-omani-bakhoor",
            "name": "Grated Omani Bakhoor",
            "image": "test.jpg",
            "size": "50g",
            "mrp": 249,
            "price": 249,
            "quantity": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/cart/{session_id}/add", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert 'detail' in data, "Response should have detail field"
        assert 'coming soon' in data['detail'].lower(), f"Error should mention 'coming soon', got: {data['detail']}"
        
        print(f"✓ Cannot add grated-omani-bakhoor to cart: {data['detail']}")
    
    def test_cannot_add_yemeni_bakhoor_chips_to_cart(self, session_id):
        """POST /api/cart/{session_id}/add should return 400 for yemeni-bakhoor-chips"""
        payload = {
            "productId": "yemeni-bakhoor-chips",
            "name": "Yemeni Bakhoor Chips",
            "image": "test.jpg",
            "size": "40g",
            "mrp": 399,
            "price": 399,
            "quantity": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/cart/{session_id}/add", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert 'detail' in data, "Response should have detail field"
        assert 'coming soon' in data['detail'].lower(), f"Error should mention 'coming soon', got: {data['detail']}"
        
        print(f"✓ Cannot add yemeni-bakhoor-chips to cart: {data['detail']}")
    
    def test_can_add_regular_product_to_cart(self, session_id):
        """POST /api/cart/{session_id}/add should succeed for regular products like kesar-chandan"""
        payload = {
            "productId": "kesar-chandan",
            "name": "Kesar Chandan",
            "image": "test.jpg",
            "size": "50g",
            "mrp": 110,
            "price": 110,
            "quantity": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/cart/{session_id}/add", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        assert 'items' in data, "Response should have items field"
        assert len(data['items']) >= 1, "Cart should have at least 1 item"
        
        # Verify the item was added correctly
        added_item = next((item for item in data['items'] if item['productId'] == 'kesar-chandan'), None)
        assert added_item is not None, "kesar-chandan should be in cart"
        assert added_item['quantity'] == 1
        
        print(f"✓ Successfully added kesar-chandan to cart")
        
        # Cleanup - clear the cart
        requests.delete(f"{BASE_URL}/api/cart/{session_id}")


class TestTreeDonationsEndpoint:
    """Test admin tree donations endpoint"""
    
    def test_tree_donations_requires_auth(self):
        """GET /api/admin/tree-donations should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/tree-donations")
        
        # Should return 401 or 403 without authentication
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        print(f"✓ /api/admin/tree-donations requires authentication (status: {response.status_code})")
    
    def test_tree_donations_endpoint_exists(self):
        """Verify the tree-donations endpoint exists (not 404)"""
        response = requests.get(f"{BASE_URL}/api/admin/tree-donations")
        
        # Should NOT be 404 - endpoint should exist
        assert response.status_code != 404, "Tree donations endpoint should exist"
        
        print(f"✓ /api/admin/tree-donations endpoint exists")


class TestProductsDataIntegrity:
    """Test product data integrity"""
    
    def test_all_products_have_required_fields(self):
        """All products should have required fields"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        required_fields = ['id', 'name', 'type', 'category', 'description', 'image', 'sizes', 'rating', 'reviews']
        
        for product in products:
            for field in required_fields:
                assert field in product, f"Product {product.get('id', 'unknown')} missing field: {field}"
            
            # Verify sizes have required fields
            for size in product['sizes']:
                assert 'size' in size, f"Size missing 'size' field in {product['id']}"
                assert 'mrp' in size, f"Size missing 'mrp' field in {product['id']}"
                assert 'price' in size, f"Size missing 'price' field in {product['id']}"
        
        print(f"✓ All {len(products)} products have required fields")
    
    def test_coming_soon_bakhoor_products_have_correct_category(self):
        """Coming soon bakhoor products should have category='bakhoor' and type='bakhoor'"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        # Only check the actual bakhoor products (coming soon ones)
        bakhoor_products = [p for p in products if p.get('comingSoon') == True and p.get('category') == 'bakhoor']
        
        assert len(bakhoor_products) == 2, f"Expected 2 coming soon bakhoor products, got {len(bakhoor_products)}"
        
        for product in bakhoor_products:
            assert product['category'] == 'bakhoor', f"{product['id']} should have category='bakhoor'"
            assert product['type'] == 'bakhoor', f"{product['id']} should have type='bakhoor'"
        
        print(f"✓ All {len(bakhoor_products)} coming soon bakhoor products have correct category and type")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
