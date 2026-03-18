"""
Test suite for Admin Analytics endpoints:
- GET /api/admin/revenue-trends
- GET /api/admin/order-stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"

@pytest.fixture(scope="module")
def session():
    """Create a session that persists cookies"""
    return requests.Session()

@pytest.fixture(scope="module")
def admin_token(session):
    """Authenticate as admin and get session token"""
    response = session.post(
        f"{BASE_URL}/api/admin/login",
        json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert data.get("is_admin") == True
    return data.get("session_token")


class TestRevenueTrendsAPI:
    """Tests for /api/admin/revenue-trends endpoint"""
    
    def test_revenue_trends_requires_auth(self, session):
        """Test that endpoint requires authentication"""
        # Create new session without auth
        response = requests.get(f"{BASE_URL}/api/admin/revenue-trends")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
    
    def test_revenue_trends_daily(self, session, admin_token):
        """Test revenue trends with daily period"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(
            f"{BASE_URL}/api/admin/revenue-trends",
            params={"period": "daily", "days": 30}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "data" in data, "Response should have 'data' field"
        assert "summary" in data, "Response should have 'summary' field"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_revenue" in summary, "Summary should have total_revenue"
        assert "total_orders" in summary, "Summary should have total_orders"
        assert "avg_order_value" in summary, "Summary should have avg_order_value"
        assert "growth_percentage" in summary, "Summary should have growth_percentage"
        assert "period" in summary, "Summary should have period"
        assert summary["period"] == "daily"
        
        print(f"Daily revenue trends - Total Revenue: ₹{summary['total_revenue']}, Orders: {summary['total_orders']}")
    
    def test_revenue_trends_weekly(self, session, admin_token):
        """Test revenue trends with weekly period"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(
            f"{BASE_URL}/api/admin/revenue-trends",
            params={"period": "weekly", "days": 90}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert data["summary"]["period"] == "weekly"
        print(f"Weekly revenue trends - Data points: {len(data['data'])}")
    
    def test_revenue_trends_monthly(self, session, admin_token):
        """Test revenue trends with monthly period"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(
            f"{BASE_URL}/api/admin/revenue-trends",
            params={"period": "monthly", "days": 365}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        assert data["summary"]["period"] == "monthly"
        print(f"Monthly revenue trends - Data points: {len(data['data'])}")
    
    def test_revenue_trends_data_format(self, session, admin_token):
        """Test that data points have correct format"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(
            f"{BASE_URL}/api/admin/revenue-trends",
            params={"period": "daily", "days": 30}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data["data"]) > 0:
            point = data["data"][0]
            assert "date" in point, "Data point should have 'date'"
            assert "label" in point, "Data point should have 'label'"
            assert "revenue" in point, "Data point should have 'revenue'"
            assert "orders" in point, "Data point should have 'orders'"
            assert "avg_order" in point, "Data point should have 'avg_order'"
            print(f"Data point format verified: {point}")
    
    def test_revenue_trends_different_days(self, session, admin_token):
        """Test different days parameter values"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        for days in [7, 30, 90, 180, 365]:
            response = session.get(
                f"{BASE_URL}/api/admin/revenue-trends",
                params={"period": "daily", "days": days}
            )
            assert response.status_code == 200, f"Failed for days={days}: {response.text}"
            data = response.json()
            assert data["summary"]["days_analyzed"] == days
            print(f"Days={days} - returned {len(data['data'])} data points")


class TestOrderStatsAPI:
    """Tests for /api/admin/order-stats endpoint"""
    
    def test_order_stats_requires_auth(self, session):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/order-stats")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
    
    def test_order_stats_default(self, session, admin_token):
        """Test order stats with default parameters"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(f"{BASE_URL}/api/admin/order-stats")
        assert response.status_code == 200, f"Request failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "status_distribution" in data, "Response should have 'status_distribution'"
        assert "payment_distribution" in data, "Response should have 'payment_distribution'"
        assert "period_days" in data, "Response should have 'period_days'"
        
        print(f"Order stats - Status distribution: {data['status_distribution']}")
        print(f"Order stats - Payment distribution: {data['payment_distribution']}")
    
    def test_order_stats_with_days(self, session, admin_token):
        """Test order stats with custom days parameter"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        for days in [7, 30, 90]:
            response = session.get(
                f"{BASE_URL}/api/admin/order-stats",
                params={"days": days}
            )
            assert response.status_code == 200, f"Failed for days={days}: {response.text}"
            data = response.json()
            assert data["period_days"] == days
            print(f"Days={days} - Status counts: {sum(v['count'] for v in data['status_distribution'].values() if isinstance(v, dict))}")
    
    def test_order_stats_status_distribution_format(self, session, admin_token):
        """Test that status distribution has correct format"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(f"{BASE_URL}/api/admin/order-stats")
        assert response.status_code == 200
        
        data = response.json()
        status_dist = data["status_distribution"]
        
        # If there are statuses, verify format
        for status, info in status_dist.items():
            assert "count" in info, f"Status {status} should have 'count'"
            assert "revenue" in info, f"Status {status} should have 'revenue'"
            assert isinstance(info["count"], int), f"Count should be integer for {status}"
            assert isinstance(info["revenue"], (int, float)), f"Revenue should be numeric for {status}"
        
        print(f"Status distribution verified: {list(status_dist.keys())}")
    
    def test_order_stats_payment_distribution_format(self, session, admin_token):
        """Test that payment distribution has correct format"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = session.get(f"{BASE_URL}/api/admin/order-stats")
        assert response.status_code == 200
        
        data = response.json()
        payment_dist = data["payment_distribution"]
        
        # If there are payment methods, verify format
        for method, info in payment_dist.items():
            assert "count" in info, f"Payment method {method} should have 'count'"
            assert "revenue" in info, f"Payment method {method} should have 'revenue'"
        
        print(f"Payment distribution verified: {list(payment_dist.keys())}")


class TestAnalyticsIntegration:
    """Integration tests for analytics endpoints"""
    
    def test_analytics_tab_data_flow(self, session, admin_token):
        """Test complete analytics data flow as used by frontend"""
        session.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # 1. Fetch revenue trends (daily, 30 days)
        trends_response = session.get(
            f"{BASE_URL}/api/admin/revenue-trends",
            params={"period": "daily", "days": 30}
        )
        assert trends_response.status_code == 200
        trends_data = trends_response.json()
        
        # 2. Fetch order stats (30 days)
        stats_response = session.get(
            f"{BASE_URL}/api/admin/order-stats",
            params={"days": 30}
        )
        assert stats_response.status_code == 200
        stats_data = stats_response.json()
        
        # 3. Verify data consistency
        print("\n=== Analytics Integration Test Results ===")
        print(f"Revenue Trends - Total Revenue: ₹{trends_data['summary']['total_revenue']}")
        print(f"Revenue Trends - Total Orders: {trends_data['summary']['total_orders']}")
        print(f"Revenue Trends - Avg Order Value: ₹{trends_data['summary']['avg_order_value']}")
        print(f"Revenue Trends - Growth: {trends_data['summary']['growth_percentage']}%")
        print(f"Revenue Trends - Data points: {len(trends_data['data'])}")
        print(f"Order Stats - Period Days: {stats_data['period_days']}")
        print(f"Order Stats - Status Types: {list(stats_data['status_distribution'].keys())}")
        print(f"Order Stats - Payment Methods: {list(stats_data['payment_distribution'].keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
