"""
Backend API tests for January 2026 features:
- Royal Kewda product
- Customer reviews for Bakhoor products
- llms.txt and llms-full.txt static files
- Product ratings verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://incense-retailer-hub.preview.emergentagent.com')


class TestRoyalKewdaProduct:
    """Tests for the new Royal Kewda product"""
    
    def test_royal_kewda_exists(self):
        """Royal Kewda product should exist and be accessible"""
        response = requests.get(f"{BASE_URL}/api/products/royal-kewda")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        product = response.json()
        assert product["id"] == "royal-kewda"
        assert product["name"] == "Royal Kewda"
        print("✓ Royal Kewda product exists")
    
    def test_royal_kewda_price_and_size(self):
        """Royal Kewda should have 50g size at ₹110"""
        response = requests.get(f"{BASE_URL}/api/products/royal-kewda")
        assert response.status_code == 200
        
        product = response.json()
        sizes = product.get("sizes", [])
        assert len(sizes) >= 1, "Royal Kewda should have at least one size"
        
        # Check 50g size
        size_50g = next((s for s in sizes if s["size"] == "50g"), None)
        assert size_50g is not None, "50g size should exist"
        assert size_50g["price"] == 110, f"Expected price 110, got {size_50g['price']}"
        assert size_50g["mrp"] == 110, f"Expected MRP 110, got {size_50g['mrp']}"
        print("✓ Royal Kewda has correct 50g size at ₹110")
    
    def test_royal_kewda_fragrance_notes(self):
        """Royal Kewda should have correct fragrance notes"""
        response = requests.get(f"{BASE_URL}/api/products/royal-kewda")
        assert response.status_code == 200
        
        product = response.json()
        notes = product.get("notes", [])
        
        expected_notes = ["Kewda", "Jasmine", "White Musk"]
        for note in expected_notes:
            assert note in notes, f"Expected note '{note}' not found in {notes}"
        print(f"✓ Royal Kewda has correct fragrance notes: {notes}")
    
    def test_royal_kewda_is_available(self):
        """Royal Kewda should be available (not coming soon)"""
        response = requests.get(f"{BASE_URL}/api/products/royal-kewda")
        assert response.status_code == 200
        
        product = response.json()
        assert product.get("comingSoon") == False, "Royal Kewda should not be coming soon"
        assert product.get("isActive") == True, "Royal Kewda should be active"
        print("✓ Royal Kewda is available (not coming soon)")
    
    def test_royal_kewda_no_reviews(self):
        """Royal Kewda should have 0 reviews (new product)"""
        response = requests.get(f"{BASE_URL}/api/products/royal-kewda")
        assert response.status_code == 200
        
        product = response.json()
        assert product.get("rating") == 0, f"Expected rating 0, got {product.get('rating')}"
        assert product.get("reviews") == 0, f"Expected 0 reviews, got {product.get('reviews')}"
        assert "customerReviews" not in product or len(product.get("customerReviews", [])) == 0
        print("✓ Royal Kewda has 0 reviews (new product)")


class TestBakhoorCustomerReviews:
    """Tests for customer reviews on Bakhoor products"""
    
    def test_grated_omani_has_reviews(self):
        """Grated Omani Bakhoor should have customer reviews"""
        response = requests.get(f"{BASE_URL}/api/products/grated-omani-bakhoor")
        assert response.status_code == 200
        
        product = response.json()
        assert "customerReviews" in product, "customerReviews field should exist"
        reviews = product["customerReviews"]
        assert len(reviews) == 7, f"Expected 7 reviews, got {len(reviews)}"
        print(f"✓ Grated Omani Bakhoor has {len(reviews)} customer reviews")
    
    def test_grated_omani_rating(self):
        """Grated Omani Bakhoor should have 4.9 rating with 7 reviews"""
        response = requests.get(f"{BASE_URL}/api/products/grated-omani-bakhoor")
        assert response.status_code == 200
        
        product = response.json()
        assert product.get("rating") == 4.9, f"Expected rating 4.9, got {product.get('rating')}"
        assert product.get("reviews") == 7, f"Expected 7 reviews, got {product.get('reviews')}"
        print("✓ Grated Omani Bakhoor has 4.9 rating with 7 reviews")
    
    def test_grated_omani_review_structure(self):
        """Customer reviews should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/products/grated-omani-bakhoor")
        assert response.status_code == 200
        
        product = response.json()
        reviews = product.get("customerReviews", [])
        
        for review in reviews:
            assert "name" in review, "Review should have name"
            assert "rating" in review, "Review should have rating"
            assert "date" in review, "Review should have date"
            assert "text" in review, "Review should have text"
            assert "verified" in review, "Review should have verified flag"
            assert 1 <= review["rating"] <= 5, f"Rating should be 1-5, got {review['rating']}"
        print("✓ All Grated Omani reviews have correct structure")
    
    def test_yemeni_bakhoor_has_reviews(self):
        """Yemeni Bakhoor Chips should have customer reviews"""
        response = requests.get(f"{BASE_URL}/api/products/yemeni-bakhoor-chips")
        assert response.status_code == 200
        
        product = response.json()
        assert "customerReviews" in product, "customerReviews field should exist"
        reviews = product["customerReviews"]
        assert len(reviews) == 5, f"Expected 5 reviews, got {len(reviews)}"
        print(f"✓ Yemeni Bakhoor Chips has {len(reviews)} customer reviews")
    
    def test_yemeni_bakhoor_rating(self):
        """Yemeni Bakhoor Chips should have 4.8 rating with 5 reviews"""
        response = requests.get(f"{BASE_URL}/api/products/yemeni-bakhoor-chips")
        assert response.status_code == 200
        
        product = response.json()
        assert product.get("rating") == 4.8, f"Expected rating 4.8, got {product.get('rating')}"
        assert product.get("reviews") == 5, f"Expected 5 reviews, got {product.get('reviews')}"
        print("✓ Yemeni Bakhoor Chips has 4.8 rating with 5 reviews")
    
    def test_kesar_chandan_no_customer_reviews(self):
        """Kesar Chandan should NOT have customerReviews field"""
        response = requests.get(f"{BASE_URL}/api/products/kesar-chandan")
        assert response.status_code == 200
        
        product = response.json()
        has_reviews = "customerReviews" in product and len(product.get("customerReviews", [])) > 0
        assert not has_reviews, "Kesar Chandan should not have customerReviews"
        print("✓ Kesar Chandan does not have customerReviews (as expected)")


class TestLLMsTextFiles:
    """Tests for AI SEO/GEO llms.txt files"""
    
    def test_llms_txt_accessible(self):
        """llms.txt should be accessible"""
        response = requests.get(f"{BASE_URL}/llms.txt")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ llms.txt is accessible")
    
    def test_llms_txt_content(self):
        """llms.txt should contain Addrika brand info"""
        response = requests.get(f"{BASE_URL}/llms.txt")
        assert response.status_code == 200
        
        content = response.text
        assert "Addrika" in content, "llms.txt should mention Addrika"
        assert "Centsibl Traders" in content, "llms.txt should mention Centsibl Traders"
        assert "Royal Kewda" in content, "llms.txt should mention Royal Kewda"
        assert "Grated Omani Bakhoor" in content, "llms.txt should mention Grated Omani Bakhoor"
        print("✓ llms.txt contains correct brand and product info")
    
    def test_llms_full_txt_accessible(self):
        """llms-full.txt should be accessible"""
        response = requests.get(f"{BASE_URL}/llms-full.txt")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ llms-full.txt is accessible")
    
    def test_llms_full_txt_content(self):
        """llms-full.txt should contain full product documentation"""
        response = requests.get(f"{BASE_URL}/llms-full.txt")
        assert response.status_code == 200
        
        content = response.text
        assert "Addrika" in content, "llms-full.txt should mention Addrika"
        assert "Royal Kewda" in content, "llms-full.txt should mention Royal Kewda"
        assert "Kesar Chandan" in content, "llms-full.txt should mention Kesar Chandan"
        assert "meditation" in content.lower(), "llms-full.txt should mention meditation"
        print("✓ llms-full.txt contains full product documentation")


class TestProductsListAndRatings:
    """Tests for products list and ratings"""
    
    def test_all_products_count(self):
        """Should have 10 products total"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        # Filter active products (not coming soon)
        active_products = [p for p in products if not p.get("comingSoon", False)]
        print(f"Total products: {len(products)}, Active: {len(active_products)}")
        assert len(products) >= 10, f"Expected at least 10 products, got {len(products)}"
        print(f"✓ Products list has {len(products)} products")
    
    def test_royal_kewda_in_products_list(self):
        """Royal Kewda should be in the products list"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        royal_kewda = next((p for p in products if p["id"] == "royal-kewda"), None)
        assert royal_kewda is not None, "Royal Kewda should be in products list"
        print("✓ Royal Kewda is in the products list")
    
    def test_bakhoor_ratings_in_list(self):
        """Bakhoor products should have correct ratings in list"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        
        # Check Grated Omani
        omani = next((p for p in products if p["id"] == "grated-omani-bakhoor"), None)
        assert omani is not None, "Grated Omani should be in list"
        assert omani.get("rating") == 4.9, f"Grated Omani rating should be 4.9, got {omani.get('rating')}"
        assert omani.get("reviews") == 7, f"Grated Omani reviews should be 7, got {omani.get('reviews')}"
        
        # Check Yemeni
        yemeni = next((p for p in products if p["id"] == "yemeni-bakhoor-chips"), None)
        assert yemeni is not None, "Yemeni Bakhoor should be in list"
        assert yemeni.get("rating") == 4.8, f"Yemeni rating should be 4.8, got {yemeni.get('rating')}"
        assert yemeni.get("reviews") == 5, f"Yemeni reviews should be 5, got {yemeni.get('reviews')}"
        
        # Check Royal Kewda (0 reviews)
        kewda = next((p for p in products if p["id"] == "royal-kewda"), None)
        assert kewda is not None, "Royal Kewda should be in list"
        assert kewda.get("rating") == 0, f"Royal Kewda rating should be 0, got {kewda.get('rating')}"
        assert kewda.get("reviews") == 0, f"Royal Kewda reviews should be 0, got {kewda.get('reviews')}"
        
        print("✓ All Bakhoor ratings are correct in products list")


class TestAddToCartRoyalKewda:
    """Test Add to Cart functionality for Royal Kewda"""
    
    def test_add_royal_kewda_to_cart(self):
        """Should be able to add Royal Kewda to cart"""
        session_id = "test-session-royal-kewda-jan2026"
        
        # Clear cart first
        requests.delete(f"{BASE_URL}/api/cart/{session_id}")
        
        # Get Royal Kewda product details first
        product_response = requests.get(f"{BASE_URL}/api/products/royal-kewda")
        assert product_response.status_code == 200
        product = product_response.json()
        
        # Add Royal Kewda to cart with full CartItem fields
        response = requests.post(
            f"{BASE_URL}/api/cart/{session_id}/add",
            json={
                "productId": "royal-kewda",
                "name": product["name"],
                "image": product["image"],
                "size": "50g",
                "mrp": 110,
                "price": 110,
                "quantity": 1
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        cart = response.json()
        assert len(cart.get("items", [])) == 1, "Cart should have 1 item"
        
        item = cart["items"][0]
        assert item["productId"] == "royal-kewda"
        assert item["size"] == "50g"
        assert item["price"] == 110
        assert item["quantity"] == 1
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cart/{session_id}")
        print("✓ Royal Kewda can be added to cart successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
