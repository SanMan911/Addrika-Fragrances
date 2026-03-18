"""
Test Admin Order Management Features
- Admin Login
- Order Deletion (Force Delete)
- Purge All Orders
- Restore Order
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "contact.us@centraders.com",
                "pin": "110078"
            }
        )
        print(f"Admin login response status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert data.get("is_admin") == True
        return data.get("session_token")
    
    def test_admin_login_wrong_pin(self):
        """Test admin login with wrong PIN"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "contact.us@centraders.com",
                "pin": "wrongpin"
            }
        )
        print(f"Wrong PIN response status: {response.status_code}")
        assert response.status_code == 401


class TestOrderManagement:
    """Test order management features"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session token"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={
                "email": "contact.us@centraders.com",
                "pin": "110078"
            }
        )
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
    
    def test_get_orders(self, admin_session):
        """Test getting orders list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        print(f"Get orders response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        assert "total" in data
        print(f"Total orders: {data['total']}")
    
    def test_restore_order(self, admin_session):
        """Test restoring/creating an order via admin"""
        order_data = {
            "order_number": "TEST-API-ORDER-001",
            "razorpay_order_id": f"test_api_{os.urandom(4).hex()}",
            "items": [{
                "productId": "kesar-chandan",
                "name": "Kesar Chandan",
                "size": "50g",
                "quantity": 1,
                "price": 99,
                "mrp": 110,
                "weight": 50
            }],
            "billing": {
                "salutation": "Mr.",
                "name": "API Test Customer",
                "email": "apitest@example.com",
                "phone": "+919999999999",
                "address": "Test Address",
                "landmark": "Near Test",
                "city": "Test City",
                "state": "Delhi",
                "pincode": "110001"
            },
            "shipping": {
                "salutation": "Mr.",
                "name": "API Test Customer",
                "email": "apitest@example.com",
                "phone": "+919999999999",
                "address": "Test Address",
                "landmark": "Near Test",
                "city": "Test City",
                "state": "Delhi",
                "pincode": "110001"
            },
            "pricing": {
                "subtotal": 99,
                "bulk_discount": 0,
                "coupon_discount": 0,
                "shipping": 0,
                "final_total": 99
            },
            "payment_method": "razorpay",
            "payment_mode": "UPI",
            "payment_status": "paid",
            "order_status": "confirmed"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/orders/restore",
            json=order_data,
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        print(f"Restore order response: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("order_number") == "TEST-API-ORDER-001"
        assert "id" in data
    
    def test_delete_order_force(self, admin_session):
        """Test force deleting an order"""
        # First check if the order exists
        orders_response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        
        if orders_response.status_code == 200:
            orders = orders_response.json().get("orders", [])
            test_order = next((o for o in orders if o.get("orderNumber") == "TEST-API-ORDER-001" or o.get("order_number") == "TEST-API-ORDER-001"), None)
            
            if test_order:
                order_number = test_order.get("orderNumber") or test_order.get("order_number")
                
                # Force delete the order
                response = requests.delete(
                    f"{BASE_URL}/api/admin/orders/{order_number}?force=true",
                    headers={"Authorization": f"Bearer {admin_session}"}
                )
                print(f"Force delete response: {response.status_code}")
                print(f"Response: {response.json()}")
                
                assert response.status_code == 200
                data = response.json()
                assert data.get("forced") == True
            else:
                print("Test order not found, skipping delete test")
                pytest.skip("Test order not found")
    
    def test_purge_all_orders_without_confirmation(self, admin_session):
        """Test purge all orders fails without confirmation"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/orders/purge/all",
            json={},  # No confirmation
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        print(f"Purge without confirm response: {response.status_code}")
        
        # Should fail without proper confirmation
        assert response.status_code == 400
    
    def test_purge_all_orders_with_confirmation(self, admin_session):
        """Test purge all orders with proper confirmation"""
        # First create a test order
        order_data = {
            "order_number": "TEST-PURGE-ORDER-001",
            "razorpay_order_id": f"test_purge_{os.urandom(4).hex()}",
            "items": [{
                "productId": "kesar-chandan",
                "name": "Kesar Chandan",
                "size": "50g",
                "quantity": 1,
                "price": 99,
                "mrp": 110,
                "weight": 50
            }],
            "billing": {
                "name": "Purge Test",
                "email": "purgetest@example.com",
                "phone": "+919999999998",
                "address": "Test",
                "city": "Test",
                "state": "Delhi",
                "pincode": "110001"
            },
            "shipping": {
                "name": "Purge Test",
                "email": "purgetest@example.com",
                "phone": "+919999999998",
                "address": "Test",
                "city": "Test",
                "state": "Delhi",
                "pincode": "110001"
            },
            "pricing": {
                "subtotal": 99,
                "final_total": 99
            }
        }
        
        # Create the order
        create_response = requests.post(
            f"{BASE_URL}/api/admin/orders/restore",
            json=order_data,
            headers={"Authorization": f"Bearer {admin_session}"}
        )
        print(f"Create order for purge test: {create_response.status_code}")
        
        # Now purge all orders
        response = requests.delete(
            f"{BASE_URL}/api/admin/orders/purge/all",
            json={"confirm": "PURGE_ALL_ORDERS"},
            headers={
                "Authorization": f"Bearer {admin_session}",
                "Content-Type": "application/json"
            }
        )
        print(f"Purge all orders response: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert "deleted_count" in data
        print(f"Deleted count: {data['deleted_count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
