"""
Wishlist API Tests for Addrika
Tests wishlist CRUD operations and shareable wishlist features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test.checkout@example.com"
TEST_PASSWORD = "TestPass123!"

# Test product data
TEST_PRODUCT = {
    "productId": "loban",
    "name": "Loban Natural Incense",
    "size": "200g",
    "price": 220.0,
    "mrp": 220.0,
    "image": "/images/products/loban-200g.jpg"
}

TEST_PRODUCT_2 = {
    "productId": "chandan",
    "name": "Chandan (Sandalwood) Natural Incense",
    "size": "200g",
    "price": 220.0,
    "mrp": 220.0,
    "image": "/images/products/chandan-200g.jpg"
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def authenticated_client(api_client):
    """Session with authentication cookie"""
    # Login to get session cookie - uses identifier field (email or username)
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.text}")
    
    return api_client


@pytest.fixture(autouse=True)
def cleanup_wishlist(authenticated_client):
    """Clear wishlist before and after each test"""
    # Clear before test
    authenticated_client.post(f"{BASE_URL}/api/wishlist/clear")
    
    yield
    
    # Clear after test
    authenticated_client.post(f"{BASE_URL}/api/wishlist/clear")


class TestWishlistUnauthenticated:
    """Test wishlist endpoints without authentication"""
    
    def test_get_wishlist_unauthenticated(self, api_client):
        """GET /api/wishlist should return 401 for unauthenticated users"""
        # Create a new session without auth
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.get(f"{BASE_URL}/api/wishlist")
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "login" in data["detail"].lower()
    
    def test_add_to_wishlist_unauthenticated(self, api_client):
        """POST /api/wishlist/add should return 401 for unauthenticated users"""
        # Create a new session without auth
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "login" in data["detail"].lower()


class TestWishlistCRUD:
    """Test wishlist CRUD operations"""
    
    def test_get_empty_wishlist(self, authenticated_client):
        """GET /api/wishlist should return empty list for new wishlist"""
        response = authenticated_client.get(f"{BASE_URL}/api/wishlist")
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) == 0
        assert data.get("is_shared") == False
    
    def test_add_item_to_wishlist(self, authenticated_client):
        """POST /api/wishlist/add should add item to wishlist"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "items" in data
        assert len(data["items"]) == 1
        
        # Verify item data
        added_item = data["items"][0]
        assert added_item["productId"] == TEST_PRODUCT["productId"]
        assert added_item["name"] == TEST_PRODUCT["name"]
        assert added_item["size"] == TEST_PRODUCT["size"]
        assert added_item["price"] == TEST_PRODUCT["price"]
    
    def test_add_duplicate_item(self, authenticated_client):
        """Adding same item twice should not create duplicate"""
        # Add first time
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        # Add second time
        response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "already in wishlist" in data.get("message", "").lower() or len(data["items"]) == 1
    
    def test_add_multiple_items(self, authenticated_client):
        """Should be able to add multiple different items"""
        # Add first item
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        # Add second item
        response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT_2}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
    
    def test_get_wishlist_with_items(self, authenticated_client):
        """GET /api/wishlist should return all added items"""
        # Add items
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT_2}
        )
        
        # Get wishlist
        response = authenticated_client.get(f"{BASE_URL}/api/wishlist")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
    
    def test_remove_item_from_wishlist(self, authenticated_client):
        """DELETE /api/wishlist/remove/:productId/:size should remove item"""
        # Add item first
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        # Remove item
        response = authenticated_client.delete(
            f"{BASE_URL}/api/wishlist/remove/{TEST_PRODUCT['productId']}/{TEST_PRODUCT['size']}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert len(data["items"]) == 0
    
    def test_remove_nonexistent_item(self, authenticated_client):
        """Removing non-existent item should return 404"""
        # First add an item to create the wishlist
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        # Try removing a non-existent item
        response = authenticated_client.delete(
            f"{BASE_URL}/api/wishlist/remove/nonexistent/50g"
        )
        
        # Should return 404 - item not found
        assert response.status_code == 404
    
    def test_clear_wishlist(self, authenticated_client):
        """POST /api/wishlist/clear should remove all items"""
        # Add items
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT_2}
        )
        
        # Clear wishlist
        response = authenticated_client.post(f"{BASE_URL}/api/wishlist/clear")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 0


class TestWishlistSharing:
    """Test wishlist sharing functionality"""
    
    def test_share_wishlist(self, authenticated_client):
        """POST /api/wishlist/share should generate share code"""
        # Add item first
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        
        # Share wishlist
        response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/share",
            json={"message": "My favorite incense!", "recipient_name": "Mom"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "share_code" in data
        assert len(data["share_code"]) == 8
        assert "share_url" in data
    
    def test_share_empty_wishlist(self, authenticated_client):
        """Sharing empty wishlist should return 400"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/share",
            json={}
        )
        
        # Should fail as wishlist is empty
        assert response.status_code in [400, 404]
    
    def test_get_shared_wishlist(self, authenticated_client):
        """GET /api/wishlist/shared/:code should return wishlist (public endpoint)"""
        # Add item and share
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        share_response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/share",
            json={"message": "Test message"}
        )
        share_code = share_response.json()["share_code"]
        
        # Create unauthenticated session to test public access
        public_session = requests.Session()
        public_session.headers.update({"Content-Type": "application/json"})
        
        # Get shared wishlist
        response = public_session.get(f"{BASE_URL}/api/wishlist/shared/{share_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "owner_name" in data
        assert "can_purchase" in data
        assert data["can_purchase"] == True
        assert len(data["items"]) == 1
        assert data["items"][0]["productId"] == TEST_PRODUCT["productId"]
    
    def test_get_nonexistent_shared_wishlist(self):
        """GET /api/wishlist/shared with invalid code should return 404"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/wishlist/shared/INVALID1")
        
        assert response.status_code == 404
    
    def test_unshare_wishlist(self, authenticated_client):
        """DELETE /api/wishlist/share should disable sharing"""
        # Add item and share
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        share_response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/share",
            json={}
        )
        share_code = share_response.json()["share_code"]
        
        # Unshare
        response = authenticated_client.delete(f"{BASE_URL}/api/wishlist/share")
        
        assert response.status_code == 200
        
        # Try to access shared wishlist - should fail
        public_session = requests.Session()
        public_session.headers.update({"Content-Type": "application/json"})
        
        response = public_session.get(f"{BASE_URL}/api/wishlist/shared/{share_code}")
        
        assert response.status_code == 404
    
    def test_shared_wishlist_checkout(self, authenticated_client):
        """POST /api/wishlist/shared/:code/checkout should return checkout data"""
        # Add items and share
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT}
        )
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": TEST_PRODUCT_2}
        )
        share_response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/share",
            json={"message": "Gift wishlist!"}
        )
        share_code = share_response.json()["share_code"]
        
        # Create unauthenticated session
        public_session = requests.Session()
        public_session.headers.update({"Content-Type": "application/json"})
        
        # Checkout
        response = public_session.post(f"{BASE_URL}/api/wishlist/shared/{share_code}/checkout")
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "owner_name" in data
        assert "mrp_total" in data
        assert "is_gift" in data
        assert data["is_gift"] == True
        assert len(data["items"]) == 2
        # Total should be sum of both items MRP
        expected_total = TEST_PRODUCT["mrp"] + TEST_PRODUCT_2["mrp"]
        assert data["mrp_total"] == expected_total


class TestWishlistWithDifferentSizes:
    """Test wishlist with same product different sizes"""
    
    def test_add_same_product_different_sizes(self, authenticated_client):
        """Same product with different sizes should be separate wishlist items"""
        # Add 200g
        authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": {**TEST_PRODUCT, "size": "200g"}}
        )
        
        # Add 400g
        response = authenticated_client.post(
            f"{BASE_URL}/api/wishlist/add",
            json={"item": {**TEST_PRODUCT, "size": "400g"}}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        
        sizes = [item["size"] for item in data["items"]]
        assert "200g" in sizes
        assert "400g" in sizes
