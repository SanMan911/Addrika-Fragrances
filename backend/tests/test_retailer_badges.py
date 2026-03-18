"""
Retailer Badges API Tests
Tests the GET /api/retailer-dashboard/badges endpoint for badge timeline feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test retailer credentials (same as test_retailer_dashboard.py)
TEST_RETAILER_EMAIL = "karolbagh@addrika.com"
TEST_RETAILER_PASSWORD = "retailer123"


class TestRetailerBadges:
    """Test retailer badges endpoint"""
    
    @pytest.fixture(autouse=True)
    def get_auth_token(self):
        """Get auth token for authenticated tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": TEST_RETAILER_EMAIL, "password": TEST_RETAILER_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_badges_returns_expected_structure(self):
        """Test that badges endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/badges",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Badges fetch failed: {response.text}"
        data = response.json()
        
        # Verify top-level structure
        assert "current_badges" in data, "current_badges not returned"
        assert "badge_history" in data, "badge_history not returned"
        assert "stats" in data, "stats not returned"
        assert "member_since" in data, "member_since not returned"
        
        # Verify current_badges is a list
        assert isinstance(data["current_badges"], list), "current_badges should be a list"
        
        # Verify badge_history is a list
        assert isinstance(data["badge_history"], list), "badge_history should be a list"
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_badges_earned" in stats, "total_badges_earned missing from stats"
        assert "current_active_badges" in stats, "current_active_badges missing from stats"
        assert "partner_duration_days" in stats, "partner_duration_days missing from stats"
        
        print(f"SUCCESS: Badges endpoint returns correct structure")
        print(f"  - Current badges: {len(data['current_badges'])}")
        print(f"  - Badge history events: {len(data['badge_history'])}")
        print(f"  - Stats: {data['stats']}")
    
    def test_badges_endpoint_requires_authentication(self):
        """Test that badges endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/retailer-dashboard/badges")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert data.get("detail") == "Not authenticated", f"Unexpected error: {data}"
        print("SUCCESS: Badges endpoint correctly requires authentication")
    
    def test_badges_endpoint_returns_badge_details(self):
        """Test that current badges have expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/badges",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are current badges, verify their structure
        if len(data["current_badges"]) > 0:
            badge = data["current_badges"][0]
            
            # Required fields for all badges
            assert "type" in badge, "Badge missing 'type' field"
            assert "name" in badge, "Badge missing 'name' field"
            assert "description" in badge, "Badge missing 'description' field"
            assert "icon" in badge, "Badge missing 'icon' field"
            assert "color" in badge, "Badge missing 'color' field"
            assert "active" in badge, "Badge missing 'active' field"
            
            # Verify active status
            assert badge["active"] == True, "Current badge should be active"
            
            # Verify color is a valid hex color
            assert badge["color"].startswith("#"), f"Invalid color format: {badge['color']}"
            
            print(f"SUCCESS: Badge has correct structure - {badge['name']}")
        else:
            print("SKIPPED: No current badges to validate structure")
    
    def test_stats_values_are_valid(self):
        """Test that stats contain valid numeric values"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/badges",
            headers=self.headers
        )
        
        assert response.status_code == 200
        stats = response.json()["stats"]
        
        # total_badges_earned should be >= 0
        assert isinstance(stats["total_badges_earned"], int), "total_badges_earned should be int"
        assert stats["total_badges_earned"] >= 0, "total_badges_earned should be >= 0"
        
        # current_active_badges should be >= 0
        assert isinstance(stats["current_active_badges"], int), "current_active_badges should be int"
        assert stats["current_active_badges"] >= 0, "current_active_badges should be >= 0"
        
        # partner_duration_days can be None or a positive int
        if stats["partner_duration_days"] is not None:
            assert isinstance(stats["partner_duration_days"], int), "partner_duration_days should be int"
            assert stats["partner_duration_days"] >= 0, "partner_duration_days should be >= 0"
        
        print(f"SUCCESS: Stats values are valid - earned: {stats['total_badges_earned']}, "
              f"active: {stats['current_active_badges']}, partner_days: {stats['partner_duration_days']}")
    
    def test_badge_types_are_valid(self):
        """Test that badge types are from expected set"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/badges",
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        valid_badge_types = {
            "verified_partner",
            "label",
            "gst_verified",
            "account_verified"
        }
        
        for badge in data["current_badges"]:
            assert badge["type"] in valid_badge_types, f"Invalid badge type: {badge['type']}"
        
        print(f"SUCCESS: All {len(data['current_badges'])} badges have valid types")
    
    def test_invalid_token_returns_401(self):
        """Test that invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/badges",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid token correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
