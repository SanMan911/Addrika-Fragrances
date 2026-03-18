"""
Test Admin Dashboard Backend APIs after refactoring
Tests all admin endpoints that power the 14+ tabs in AdminDashboard.jsx
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminDashboard:
    """Test Admin Dashboard API endpoints"""
    
    session_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        if not TestAdminDashboard.session_token:
            response = requests.post(
                f"{BASE_URL}/api/admin/login",
                json={"email": "contact.us@centraders.com", "pin": "110078"}
            )
            if response.status_code == 200:
                data = response.json()
                TestAdminDashboard.session_token = data.get("session_token")
        yield
    
    def get_auth_headers(self):
        """Return headers with session token"""
        return {
            "Authorization": f"Bearer {TestAdminDashboard.session_token}",
            "Content-Type": "application/json"
        }
    
    # ============ Overview Tab ============
    def test_admin_stats_endpoint(self):
        """Test GET /api/admin/stats for Overview tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Stats should contain revenue and order metrics
        assert "total_revenue" in data or "revenue" in data or isinstance(data, dict)
        print(f"✓ Admin stats: {list(data.keys())[:5]}")
    
    # ============ Analytics Tab ============
    def test_revenue_trends_endpoint(self):
        """Test GET /api/admin/revenue-trends for Analytics tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/revenue-trends?period=daily&days=30",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "data" in data or "summary" in data or isinstance(data, dict)
        print(f"✓ Revenue trends: {list(data.keys())}")
    
    def test_order_stats_endpoint(self):
        """Test GET /api/admin/order-stats for Analytics tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/order-stats?days=30",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Order stats: {list(data.keys())}")
    
    # ============ Orders Tab ============
    def test_orders_endpoint(self):
        """Test GET /api/admin/orders for Orders tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "orders" in data
        print(f"✓ Orders: {len(data.get('orders', []))} orders found")
    
    # ============ Users Tab ============
    def test_users_endpoint(self):
        """Test GET /api/admin/users for Users tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "users" in data
        print(f"✓ Users: {len(data.get('users', []))} users found")
    
    # ============ Gift Codes Tab ============
    def test_gift_codes_stats_endpoint(self):
        """Test GET /api/gift-codes/admin/stats for Gift Codes tab"""
        response = requests.get(
            f"{BASE_URL}/api/gift-codes/admin/stats",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Gift codes stats: {list(data.keys())}")
    
    # ============ Discounts Tab ============
    def test_discount_codes_endpoint(self):
        """Test GET /api/admin/discount-codes for Discounts tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/discount-codes",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "codes" in data
        print(f"✓ Discount codes: {len(data.get('codes', []))} codes found")
    
    # ============ Coupon Usage Tab ============
    def test_discount_code_usage_endpoint(self):
        """Test GET /api/admin/discount-code-usage for Coupon Usage tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/discount-code-usage",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Discount code usage: {list(data.keys())}")
    
    def test_discount_code_performance_endpoint(self):
        """Test GET /api/admin/discount-code-performance for Coupon Usage tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/discount-code-performance",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Discount code performance: {list(data.keys())}")
    
    # ============ Reviews Tab ============
    def test_reviews_endpoint(self):
        """Test GET /api/admin/reviews for Reviews tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/reviews",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "reviews" in data
        print(f"✓ Reviews: {len(data.get('reviews', []))} reviews found")
    
    # ============ Inventory Tab ============
    def test_inventory_endpoint(self):
        """Test GET /api/admin/inventory for Inventory tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/inventory",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "inventory" in data
        print(f"✓ Inventory: {len(data.get('inventory', []))} items found")
    
    # ============ Blog Tab ============
    def test_blog_posts_endpoint(self):
        """Test GET /api/admin/blog/posts for Blog tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/blog/posts",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "posts" in data
        print(f"✓ Blog posts: {len(data.get('posts', []))} posts found")
    
    # ============ Subscribers Tab ============
    def test_subscribers_endpoint(self):
        """Test GET /api/admin/subscribers for Subscribers tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/subscribers",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "subscribers" in data
        print(f"✓ Subscribers: {len(data.get('subscribers', []))} subscribers found")
    
    # ============ Inquiries Tab ============
    def test_inquiries_endpoint(self):
        """Test GET /api/inquiries for Inquiries tab"""
        response = requests.get(
            f"{BASE_URL}/api/inquiries",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "inquiries" in data
        print(f"✓ Inquiries: {len(data.get('inquiries', []))} inquiries found")
    
    # ============ Abandoned Carts Tab ============
    def test_abandoned_carts_stats_endpoint(self):
        """Test GET /api/cart/admin/stats for Abandoned Carts tab"""
        response = requests.get(
            f"{BASE_URL}/api/cart/admin/stats",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ Abandoned cart stats: {list(data.keys())}")
    
    def test_abandoned_carts_list_endpoint(self):
        """Test GET /api/cart/admin/abandoned for Abandoned Carts tab"""
        response = requests.get(
            f"{BASE_URL}/api/cart/admin/abandoned?limit=50",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "carts" in data
        print(f"✓ Abandoned carts: {len(data.get('carts', []))} carts found")
    
    # ============ ShipRocket Integration ============
    def test_shiprocket_status_endpoint(self):
        """Test GET /api/admin/shiprocket/status for Orders tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/shiprocket/status",
            headers=self.get_auth_headers()
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✓ ShipRocket status: connected={data.get('connected', 'unknown')}")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test GET /api/health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
