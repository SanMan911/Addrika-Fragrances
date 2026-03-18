"""
Test suite for User Addresses, Account Deletion, and Post-Order Address Update features
Tests:
- GET /api/user/addresses - List saved addresses
- POST /api/user/addresses - Create new address
- PUT /api/user/addresses/{address_id} - Update address
- DELETE /api/user/addresses/{address_id} - Delete address
- PUT /api/user/addresses/{address_id}/set-default - Set default address
- POST /api/user/delete-account - GDPR account deletion
- PUT /api/orders/{order_number}/update-address - Post-order address change
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review_request
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "newpass456"


class TestUserAddresses:
    """Tests for user address CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session before each test"""
        self.session = requests.Session()
        
        # Login as test user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        self.user_data = login_response.json()
        print(f"Logged in as: {self.user_data.get('user', {}).get('email')}")
        
        # Store created address IDs for cleanup
        self.created_addresses = []
        
        yield
        
        # Cleanup - delete test addresses
        for addr_id in self.created_addresses:
            try:
                self.session.delete(f"{BASE_URL}/api/user/addresses/{addr_id}")
            except:
                pass
    
    def test_get_addresses_authenticated(self):
        """GET /api/user/addresses - Should return list of addresses for authenticated user"""
        response = self.session.get(f"{BASE_URL}/api/user/addresses")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "addresses" in data, "Response should contain 'addresses' key"
        assert isinstance(data["addresses"], list), "Addresses should be a list"
        
        print(f"Found {len(data['addresses'])} saved addresses")
    
    def test_get_addresses_unauthenticated(self):
        """GET /api/user/addresses - Should return 401 for unauthenticated request"""
        new_session = requests.Session()
        response = new_session.get(f"{BASE_URL}/api/user/addresses")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_create_address_success(self):
        """POST /api/user/addresses - Should create a new address"""
        address_data = {
            "nickname": "TEST_Work_Office",
            "name": "Test User Work",
            "phone": "9876543210",
            "address_line1": "123 Test Building, Test Street",
            "address_line2": "Near Test Landmark",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "is_default": False
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/user/addresses",
            json=address_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "address" in data, "Response should contain 'address' key"
        assert "address_id" in data["address"], "Address should have address_id"
        assert data["address"]["nickname"] == address_data["nickname"]
        assert data["address"]["city"] == address_data["city"]
        assert data["address"]["pincode"] == address_data["pincode"]
        
        self.created_addresses.append(data["address"]["address_id"])
        print(f"Created address: {data['address']['address_id']}")
    
    def test_create_address_duplicate_nickname(self):
        """POST /api/user/addresses - Should reject duplicate nickname"""
        # First, create an address
        address1 = {
            "nickname": "TEST_Duplicate",
            "name": "Test User",
            "phone": "9876543210",
            "address_line1": "123 Test Street",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001"
        }
        
        response1 = self.session.post(f"{BASE_URL}/api/user/addresses", json=address1)
        if response1.status_code == 200:
            self.created_addresses.append(response1.json()["address"]["address_id"])
        
        # Try creating another with same nickname
        address2 = {
            "nickname": "TEST_Duplicate",  # Same nickname
            "name": "Different User",
            "phone": "1234567890",
            "address_line1": "456 Other Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001"
        }
        
        response2 = self.session.post(f"{BASE_URL}/api/user/addresses", json=address2)
        
        assert response2.status_code == 400, f"Expected 400 for duplicate nickname, got {response2.status_code}"
        assert "already exists" in response2.text.lower(), "Error should mention duplicate"
    
    def test_create_address_invalid_pincode(self):
        """POST /api/user/addresses - Should reject invalid pincode format"""
        address_data = {
            "nickname": "TEST_Invalid",
            "name": "Test User",
            "phone": "9876543210",
            "address_line1": "123 Test Street",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "12345"  # Invalid - should be 6 digits
        }
        
        response = self.session.post(f"{BASE_URL}/api/user/addresses", json=address_data)
        
        # Pydantic validation should reject this
        assert response.status_code == 422, f"Expected 422 for invalid pincode, got {response.status_code}"
    
    def test_update_address_success(self):
        """PUT /api/user/addresses/{address_id} - Should update existing address"""
        # First create an address
        create_data = {
            "nickname": "TEST_ToUpdate",
            "name": "Original Name",
            "phone": "9876543210",
            "address_line1": "Original Address",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/user/addresses", json=create_data)
        assert create_response.status_code == 200
        
        address_id = create_response.json()["address"]["address_id"]
        self.created_addresses.append(address_id)
        
        # Now update it
        update_data = {
            "name": "Updated Name",
            "phone": "1234567890",
            "address_line1": "Updated Address Line"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/user/addresses/{address_id}",
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data["address"]["name"] == "Updated Name"
        assert data["address"]["phone"] == "1234567890"
        assert data["address"]["nickname"] == "TEST_ToUpdate"  # Should remain unchanged
        
        print(f"Updated address: {address_id}")
    
    def test_delete_address_success(self):
        """DELETE /api/user/addresses/{address_id} - Should delete address"""
        # First create an address to delete
        create_data = {
            "nickname": "TEST_ToDelete",
            "name": "Delete Me",
            "phone": "9876543210",
            "address_line1": "123 Delete Street",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/user/addresses", json=create_data)
        assert create_response.status_code == 200
        
        address_id = create_response.json()["address"]["address_id"]
        
        # Delete the address
        delete_response = self.session.delete(f"{BASE_URL}/api/user/addresses/{address_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify it's deleted - should get 404
        get_response = self.session.get(f"{BASE_URL}/api/user/addresses")
        addresses = get_response.json().get("addresses", [])
        address_ids = [a["address_id"] for a in addresses]
        
        assert address_id not in address_ids, "Deleted address should not appear in list"
        print(f"Successfully deleted address: {address_id}")
    
    def test_delete_nonexistent_address(self):
        """DELETE /api/user/addresses/{address_id} - Should return 404 for nonexistent address"""
        response = self.session.delete(f"{BASE_URL}/api/user/addresses/nonexistent_id_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_set_default_address(self):
        """PUT /api/user/addresses/{address_id}/set-default - Should set address as default"""
        # Create a non-default address
        create_data = {
            "nickname": "TEST_SetDefault",
            "name": "Default Test",
            "phone": "9876543210",
            "address_line1": "123 Default Street",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110001",
            "is_default": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/user/addresses", json=create_data)
        assert create_response.status_code == 200
        
        address_id = create_response.json()["address"]["address_id"]
        self.created_addresses.append(address_id)
        
        # Set it as default
        set_default_response = self.session.put(
            f"{BASE_URL}/api/user/addresses/{address_id}/set-default"
        )
        
        assert set_default_response.status_code == 200, f"Expected 200, got {set_default_response.status_code}: {set_default_response.text}"
        
        # Verify it's now default
        get_response = self.session.get(f"{BASE_URL}/api/user/addresses")
        addresses = get_response.json().get("addresses", [])
        
        target_addr = next((a for a in addresses if a["address_id"] == address_id), None)
        assert target_addr is not None
        assert target_addr["is_default"] == True, "Address should be marked as default"
        
        print(f"Set address {address_id} as default")


class TestAccountDeletion:
    """Tests for GDPR-compliant account deletion"""
    
    def test_delete_account_wrong_confirmation(self):
        """POST /api/user/delete-account - Should reject wrong confirmation text"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        # Try to delete with wrong confirmation
        delete_response = session.post(
            f"{BASE_URL}/api/user/delete-account",
            json={
                "password": TEST_USER_PASSWORD,
                "confirm_text": "DELETE"  # Wrong - should be "DELETE MY ACCOUNT"
            }
        )
        
        assert delete_response.status_code == 400, f"Expected 400, got {delete_response.status_code}"
        assert "DELETE MY ACCOUNT" in delete_response.text
    
    def test_delete_account_wrong_password(self):
        """POST /api/user/delete-account - Should reject wrong password"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        # Try to delete with wrong password
        delete_response = session.post(
            f"{BASE_URL}/api/user/delete-account",
            json={
                "password": "wrongpassword123",
                "confirm_text": "DELETE MY ACCOUNT"
            }
        )
        
        assert delete_response.status_code == 400, f"Expected 400, got {delete_response.status_code}"
        assert "password" in delete_response.text.lower() or "incorrect" in delete_response.text.lower()
    
    def test_delete_account_unauthenticated(self):
        """POST /api/user/delete-account - Should require authentication"""
        session = requests.Session()
        
        delete_response = session.post(
            f"{BASE_URL}/api/user/delete-account",
            json={
                "password": "anything",
                "confirm_text": "DELETE MY ACCOUNT"
            }
        )
        
        assert delete_response.status_code == 401, f"Expected 401, got {delete_response.status_code}"


class TestPostOrderAddressUpdate:
    """Tests for updating shipping address after order placement"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login before tests"""
        self.session = requests.Session()
        
        # Login as test user
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        yield
    
    def test_update_order_address_not_found(self):
        """PUT /api/orders/{order_number}/update-address - Should return 404 for nonexistent order"""
        response = self.session.put(
            f"{BASE_URL}/api/orders/NONEXISTENT-ORDER-123/update-address",
            json={
                "name": "New Name",
                "phone": "9876543210",
                "address": "New Address Line",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_update_order_address_unauthenticated(self):
        """PUT /api/orders/{order_number}/update-address - Should require authentication"""
        new_session = requests.Session()
        
        response = new_session.put(
            f"{BASE_URL}/api/orders/SOME-ORDER/update-address",
            json={
                "name": "Test",
                "phone": "9876543210",
                "address": "Test Address",
                "city": "Delhi",
                "state": "Delhi",
                "pincode": "110001"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_update_order_address_missing_fields(self):
        """PUT /api/orders/{order_number}/update-address - Should validate required fields"""
        response = self.session.put(
            f"{BASE_URL}/api/orders/SOME-ORDER/update-address",
            json={
                "name": "Test"  # Missing other required fields
            }
        )
        
        # Should return 422 for validation error or 404 for order not found
        assert response.status_code in [404, 422], f"Expected 404/422, got {response.status_code}"


class TestProfileStats:
    """Tests for user profile statistics endpoint"""
    
    def test_get_profile_stats_authenticated(self):
        """GET /api/user/profile-stats - Should return stats for authenticated user"""
        session = requests.Session()
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        # Get stats
        stats_response = session.get(f"{BASE_URL}/api/user/profile-stats")
        
        assert stats_response.status_code == 200, f"Expected 200, got {stats_response.status_code}: {stats_response.text}"
        
        data = stats_response.json()
        assert "order_count" in data
        assert "address_count" in data
        assert "wishlist_count" in data
        
        print(f"Profile stats: orders={data['order_count']}, addresses={data['address_count']}, wishlist={data['wishlist_count']}")
    
    def test_get_profile_stats_unauthenticated(self):
        """GET /api/user/profile-stats - Should require authentication"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/user/profile-stats")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
