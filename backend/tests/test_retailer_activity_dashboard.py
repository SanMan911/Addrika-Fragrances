"""
Test module for Retailer Activity Dashboard APIs
Covers:
- GET /api/admin/retailers/activity-dashboard - Summary stats
- GET /api/admin/retailers/{id}/activity - Retailer detail with monthly trends
- GET /api/admin/retailers/abandoned-carts - Abandoned cart list
- GET /api/admin/retailers/self-pickup-report - Leaderboard with star eligibility
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test admin session token provided by main agent
TEST_SESSION_TOKEN = "sess_test_2dfdd77a19f94b358b2dc99c911b40c9"


class TestRetailerActivityDashboard:
    """Test retailer activity dashboard endpoints with admin authentication"""

    @pytest.fixture(autouse=True, scope="class")
    def setup_admin_session(self, request):
        """Setup admin session with test token for all tests in this class"""
        session = requests.Session()
        # Set session cookie for auth
        session.cookies.set("session_token", TEST_SESSION_TOKEN)
        request.cls.session = session
        yield
        session.close()

    # ==================== Activity Dashboard Tests ====================
    
    def test_activity_dashboard_returns_200(self):
        """Test GET /api/admin/retailers/activity-dashboard returns 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Activity dashboard endpoint returned 200 OK")

    def test_activity_dashboard_has_required_fields(self):
        """Test dashboard response has all required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level required fields
        assert "retailers" in data, "Missing 'retailers' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "star_retailer_criteria" in data, "Missing 'star_retailer_criteria' field"
        assert "period" in data, "Missing 'period' field"
        
        print(f"Dashboard has all required fields")
        print(f"Total retailers: {len(data['retailers'])}")

    def test_activity_dashboard_summary_fields(self):
        """Test dashboard summary has correct fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert response.status_code == 200
        
        summary = response.json()["summary"]
        
        required_summary_fields = [
            "total_retailers",
            "active_retailers",
            "star_eligible_retailers",
            "abandoned_carts_30d",
            "abandoned_value_30d",
            "total_pickups_completed",
            "total_pickups_pending"
        ]
        
        for field in required_summary_fields:
            assert field in summary, f"Missing summary field: {field}"
        
        print(f"Summary stats: {summary}")

    def test_activity_dashboard_retailer_fields(self):
        """Test each retailer has correct activity fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert response.status_code == 200
        
        retailers = response.json()["retailers"]
        
        if len(retailers) > 0:
            retailer = retailers[0]
            
            required_retailer_fields = [
                "retailer_id", "business_name", "city", "state", "status",
                "abandoned_carts_30d", "abandoned_value_30d",
                "total_pickups", "completed_pickups", "pending_pickups",
                "total_items_picked", "pickup_revenue",
                "pickups_90d", "items_90d", "revenue_90d",
                "star_eligible", "performance_score", "rank"
            ]
            
            for field in required_retailer_fields:
                assert field in retailer, f"Missing retailer field: {field}"
            
            print(f"First retailer: {retailer['business_name']} - Rank {retailer['rank']}")
            print(f"Star eligible: {retailer['star_eligible']}, Items 90d: {retailer['items_90d']}")

    def test_star_retailer_criteria_is_50_items(self):
        """Test star retailer criteria is 50+ items in 90 days"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert response.status_code == 200
        
        criteria = response.json()["star_retailer_criteria"]
        assert criteria["min_items_90d"] == 50, f"Expected 50, got {criteria['min_items_90d']}"
        print(f"Star criteria verified: {criteria}")

    # ==================== Retailer Activity Detail Tests ====================

    def test_retailer_activity_detail_returns_200(self):
        """Test GET /api/admin/retailers/{id}/activity returns 200"""
        # First get a retailer ID from the dashboard
        dashboard = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert dashboard.status_code == 200
        
        retailers = dashboard.json()["retailers"]
        if len(retailers) == 0:
            pytest.skip("No retailers found in dashboard")
        
        retailer_id = retailers[0]["retailer_id"]
        
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/{retailer_id}/activity")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Retailer activity detail for {retailer_id} returned 200 OK")

    def test_retailer_activity_detail_has_required_fields(self):
        """Test retailer detail response has all required fields"""
        # First get a retailer ID
        dashboard = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        retailers = dashboard.json()["retailers"]
        if len(retailers) == 0:
            pytest.skip("No retailers found")
        
        retailer_id = retailers[0]["retailer_id"]
        
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/{retailer_id}/activity")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check top-level required fields
        assert "retailer" in data, "Missing 'retailer' field"
        assert "performance_90d" in data, "Missing 'performance_90d' field"
        assert "abandoned_carts" in data, "Missing 'abandoned_carts' field"
        assert "pickup_orders" in data, "Missing 'pickup_orders' field"
        assert "monthly_trends" in data, "Missing 'monthly_trends' field"
        
        print(f"Retailer detail has all required fields")

    def test_retailer_activity_detail_90d_performance(self):
        """Test 90-day performance has correct fields"""
        dashboard = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        retailers = dashboard.json()["retailers"]
        if len(retailers) == 0:
            pytest.skip("No retailers found")
        
        retailer_id = retailers[0]["retailer_id"]
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/{retailer_id}/activity")
        
        perf = response.json()["performance_90d"]
        
        assert "pickups_completed" in perf
        assert "items_fulfilled" in perf
        assert "revenue" in perf
        assert "star_eligible" in perf
        
        print(f"90-day performance: {perf}")

    def test_retailer_activity_detail_monthly_trends(self):
        """Test monthly trends returns 6 months of data"""
        dashboard = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        retailers = dashboard.json()["retailers"]
        if len(retailers) == 0:
            pytest.skip("No retailers found")
        
        retailer_id = retailers[0]["retailer_id"]
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/{retailer_id}/activity")
        
        trends = response.json()["monthly_trends"]
        
        assert len(trends) == 6, f"Expected 6 months, got {len(trends)}"
        
        for month in trends:
            assert "month" in month
            assert "pickups_completed" in month
            assert "abandoned_carts" in month
        
        print(f"Monthly trends: {[t['month'] for t in trends]}")

    def test_retailer_activity_detail_not_found(self):
        """Test 404 for non-existent retailer"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/non_existent_id_12345/activity")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent retailer correctly returns 404")

    # ==================== Abandoned Carts Tests ====================

    def test_abandoned_carts_returns_200(self):
        """Test GET /api/admin/retailers/abandoned-carts returns 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/abandoned-carts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Abandoned carts endpoint returned 200 OK")

    def test_abandoned_carts_has_required_fields(self):
        """Test abandoned carts response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/abandoned-carts")
        assert response.status_code == 200
        
        data = response.json()
        
        assert "carts" in data, "Missing 'carts' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "pagination" in data, "Missing 'pagination' field"
        
        # Check summary fields
        assert "total_abandoned" in data["summary"]
        assert "total_value" in data["summary"]
        
        # Check pagination fields
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "total_pages" in pagination
        
        print(f"Abandoned carts summary: {data['summary']}")

    def test_abandoned_carts_pagination(self):
        """Test abandoned carts pagination parameters"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/retailers/abandoned-carts",
            params={"page": 1, "limit": 10}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["limit"] == 10
        print(f"Pagination working: page {data['pagination']['page']}, limit {data['pagination']['limit']}")

    def test_abandoned_carts_filter_by_retailer(self):
        """Test abandoned carts filtered by retailer_id"""
        # Get a retailer ID first
        dashboard = self.session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        retailers = dashboard.json()["retailers"]
        if len(retailers) == 0:
            pytest.skip("No retailers found")
        
        retailer_id = retailers[0]["retailer_id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/retailers/abandoned-carts",
            params={"retailer_id": retailer_id}
        )
        assert response.status_code == 200
        print(f"Abandoned carts filtered by retailer {retailer_id} returned 200")

    # ==================== Self-Pickup Report Tests ====================

    def test_self_pickup_report_returns_200(self):
        """Test GET /api/admin/retailers/self-pickup-report returns 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/self-pickup-report")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Self-pickup report endpoint returned 200 OK")

    def test_self_pickup_report_has_required_fields(self):
        """Test self-pickup report has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/self-pickup-report")
        assert response.status_code == 200
        
        data = response.json()
        
        assert "period" in data, "Missing 'period' field"
        assert "period_label" in data, "Missing 'period_label' field"
        assert "report" in data, "Missing 'report' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "star_retailer_criteria" in data, "Missing 'star_retailer_criteria' field"
        
        print(f"Period: {data['period']} - {data['period_label']}")

    def test_self_pickup_report_summary_fields(self):
        """Test self-pickup report summary has correct fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/self-pickup-report")
        assert response.status_code == 200
        
        summary = response.json()["summary"]
        
        required_fields = [
            "total_retailers_with_pickups",
            "total_pickups",
            "total_items_fulfilled",
            "total_revenue",
            "star_eligible_retailers"
        ]
        
        for field in required_fields:
            assert field in summary, f"Missing summary field: {field}"
        
        print(f"Pickup report summary: {summary}")

    def test_self_pickup_report_period_filter_month(self):
        """Test self-pickup report with month period filter"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/retailers/self-pickup-report",
            params={"period": "month"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "month"
        assert "This Month" in data["period_label"]
        print(f"Month filter: {data['period_label']}")

    def test_self_pickup_report_period_filter_quarter(self):
        """Test self-pickup report with quarter period filter"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/retailers/self-pickup-report",
            params={"period": "quarter"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "quarter"
        assert "Quarter" in data["period_label"] or "90" in data["period_label"]
        print(f"Quarter filter: {data['period_label']}")

    def test_self_pickup_report_period_filter_year(self):
        """Test self-pickup report with year period filter"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/retailers/self-pickup-report",
            params={"period": "year"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "year"
        assert "Year" in data["period_label"]
        print(f"Year filter: {data['period_label']}")

    def test_self_pickup_report_period_filter_all(self):
        """Test self-pickup report with all-time period filter"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/retailers/self-pickup-report",
            params={"period": "all"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "all"
        assert "All Time" in data["period_label"]
        print(f"All-time filter: {data['period_label']}")

    def test_self_pickup_report_retailer_leaderboard_fields(self):
        """Test leaderboard retailer entries have correct fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/retailers/self-pickup-report")
        assert response.status_code == 200
        
        report = response.json()["report"]
        
        if len(report) > 0:
            retailer = report[0]
            
            required_fields = [
                "rank", "retailer_id", "business_name", "city", "state",
                "is_verified", "is_addrika_verified_partner",
                "pickup_count", "total_items", "total_revenue",
                "unique_customers", "star_eligible"
            ]
            
            for field in required_fields:
                assert field in retailer, f"Missing leaderboard field: {field}"
            
            print(f"Top retailer: {retailer['business_name']} - {retailer['total_items']} items, Star: {retailer['star_eligible']}")
        else:
            print("No retailers in pickup report (expected - no pickup orders in DB)")

    # ==================== Auth Tests ====================

    def test_activity_dashboard_requires_admin_auth(self):
        """Test dashboard endpoint requires admin authentication"""
        # Create unauthenticated session
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/admin/retailers/activity-dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Activity dashboard correctly requires admin auth")

    def test_abandoned_carts_requires_admin_auth(self):
        """Test abandoned carts endpoint requires admin authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/admin/retailers/abandoned-carts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Abandoned carts correctly requires admin auth")

    def test_self_pickup_report_requires_admin_auth(self):
        """Test self-pickup report requires admin authentication"""
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/admin/retailers/self-pickup-report")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Self-pickup report correctly requires admin auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
