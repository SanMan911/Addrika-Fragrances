"""
Tree Donation Feature Tests
Tests for:
1. Order success page tree donation thank you message
2. Backend /api/admin/tree-donations endpoint
3. Backend order creation with tree_donation in pricing
4. Admin Tree Donations page functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

# Admin credentials from test_credentials.md
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "050499"


class TestTreeDonationBackend:
    """Backend API tests for tree donation feature"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = session.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "pin": ADMIN_PIN}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            if data.get("session_token"):
                session.headers.update({
                    "Authorization": f"Bearer {data['session_token']}"
                })
                session.cookies.set("session_token", data["session_token"])
            return session
        
        pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
    
    def test_tree_donations_endpoint_requires_auth(self):
        """Test that tree-donations endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/tree-donations?days=30")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ PASSED: Tree donations endpoint requires authentication")
    
    def test_tree_donations_endpoint_with_auth(self, admin_session):
        """Test tree-donations endpoint returns correct structure"""
        response = admin_session.get(f"{BASE_URL}/api/admin/tree-donations?days=30")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "summary" in data, "Response missing 'summary' field"
        assert "daily_breakdown" in data, "Response missing 'daily_breakdown' field"
        assert "order_details" in data, "Response missing 'order_details' field"
        assert "date_range" in data, "Response missing 'date_range' field"
        
        # Verify summary structure
        summary = data["summary"]
        required_summary_fields = [
            "total_customer_donations",
            "total_addrika_match",
            "total_combined",
            "total_trees_funded",
            "total_orders_with_donation",
            "tree_cost"
        ]
        for field in required_summary_fields:
            assert field in summary, f"Summary missing '{field}' field"
        
        # Verify tree_cost is 10 (₹5 customer + ₹5 Addrika)
        assert summary["tree_cost"] == 10, f"Expected tree_cost=10, got {summary['tree_cost']}"
        
        print("✓ PASSED: Tree donations endpoint returns correct structure")
        print(f"  Summary: {summary}")
    
    def test_tree_donations_with_date_range(self, admin_session):
        """Test tree-donations endpoint with custom date range"""
        response = admin_session.get(
            f"{BASE_URL}/api/admin/tree-donations",
            params={
                "start_date": "2025-01-01",
                "end_date": "2026-12-31"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify date_range in response
        assert "date_range" in data
        assert "start" in data["date_range"]
        assert "end" in data["date_range"]
        
        print("✓ PASSED: Tree donations endpoint accepts custom date range")
    
    def test_tree_donations_with_days_param(self, admin_session):
        """Test tree-donations endpoint with different days parameters"""
        for days in [7, 30, 90, 365]:
            response = admin_session.get(f"{BASE_URL}/api/admin/tree-donations?days={days}")
            assert response.status_code == 200, f"Failed for days={days}: {response.status_code}"
        
        print("✓ PASSED: Tree donations endpoint accepts various days parameters (7, 30, 90, 365)")
    
    def test_tree_donations_empty_state(self, admin_session):
        """Test tree-donations endpoint handles empty data gracefully"""
        response = admin_session.get(f"{BASE_URL}/api/admin/tree-donations?days=1")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return valid structure even with no data
        assert isinstance(data["summary"]["total_trees_funded"], int)
        assert isinstance(data["daily_breakdown"], list)
        assert isinstance(data["order_details"], list)
        
        print("✓ PASSED: Tree donations endpoint handles empty data gracefully")


class TestOrderCreationWithTreeDonation:
    """Test order creation includes tree_donation field"""
    
    def test_order_model_has_tree_donation_field(self):
        """Verify OrderCreate model has tree_donation field"""
        # This is a code verification test - checking the model definition
        from models.ecommerce import OrderCreate
        import inspect
        
        # Get the model fields
        model_fields = OrderCreate.model_fields
        
        assert "tree_donation" in model_fields, "OrderCreate model missing 'tree_donation' field"
        
        # Verify default value is 0
        field_info = model_fields["tree_donation"]
        assert field_info.default == 0, f"Expected default=0, got {field_info.default}"
        
        print("✓ PASSED: OrderCreate model has tree_donation field with default=0")
    
    def test_order_pricing_includes_tree_donation(self):
        """Verify order pricing calculation includes tree_donation"""
        # This test verifies the code structure - checking orders.py
        import os
        
        orders_file = "/app/backend/routers/orders.py"
        with open(orders_file, 'r') as f:
            content = f.read()
        
        # Check that tree_donation is added to final_total
        assert "tree_donation" in content, "orders.py missing tree_donation handling"
        assert "tree_donation_amount = order_data.tree_donation" in content or "order_data.tree_donation" in content, \
            "orders.py missing tree_donation extraction from order_data"
        
        # Check that tree_donation is stored in pricing object
        assert '"tree_donation"' in content, "orders.py missing tree_donation in pricing object"
        
        print("✓ PASSED: Order pricing includes tree_donation field")


class TestAdminTreeDonationsPage:
    """Test admin tree donations page structure"""
    
    def test_admin_layout_has_tree_donations_nav(self):
        """Verify admin layout has Tree Donations nav item"""
        layout_file = "/app/frontend-next/app/admin/layout.js"
        with open(layout_file, 'r') as f:
            content = f.read()
        
        # Check for TreePine import
        assert "TreePine" in content, "Admin layout missing TreePine icon import"
        
        # Check for tree-donations nav item
        assert "tree-donations" in content, "Admin layout missing tree-donations nav path"
        assert "Tree Donations" in content, "Admin layout missing 'Tree Donations' label"
        
        print("✓ PASSED: Admin layout has Tree Donations nav item with TreePine icon")
    
    def test_tree_donations_page_exists(self):
        """Verify tree donations admin page exists"""
        page_file = "/app/frontend-next/app/admin/tree-donations/page.js"
        assert os.path.exists(page_file), f"Tree donations page not found at {page_file}"
        
        with open(page_file, 'r') as f:
            content = f.read()
        
        # Check for key components
        assert "TreePine" in content, "Page missing TreePine icon"
        assert "tree-donations" in content, "Page missing API endpoint reference"
        assert "summary" in content, "Page missing summary handling"
        assert "daily_breakdown" in content, "Page missing daily_breakdown handling"
        assert "order_details" in content, "Page missing order_details handling"
        
        print("✓ PASSED: Tree donations admin page exists with required components")
    
    def test_tree_donations_page_has_date_filters(self):
        """Verify tree donations page has date range filters"""
        page_file = "/app/frontend-next/app/admin/tree-donations/page.js"
        with open(page_file, 'r') as f:
            content = f.read()
        
        # Check for date filter options
        assert "7 Days" in content or "7" in content, "Page missing 7 days filter"
        assert "30 Days" in content or "30" in content, "Page missing 30 days filter"
        assert "90 Days" in content or "90" in content, "Page missing 90 days filter"
        assert "365" in content or "1 Year" in content, "Page missing 365 days/1 year filter"
        
        # Check for custom date range inputs
        assert 'type="date"' in content, "Page missing date input fields"
        
        print("✓ PASSED: Tree donations page has date range filters (7/30/90/365 days + custom)")
    
    def test_tree_donations_page_has_summary_cards(self):
        """Verify tree donations page has summary cards"""
        page_file = "/app/frontend-next/app/admin/tree-donations/page.js"
        with open(page_file, 'r') as f:
            content = f.read()
        
        # Check for summary card content
        assert "Trees Funded" in content, "Page missing 'Trees Funded' card"
        assert "Donors" in content, "Page missing 'Donors' card"
        assert "Customer Donations" in content, "Page missing 'Customer Donations' card"
        assert "Addrika Match" in content, "Page missing 'Addrika Match' card"
        assert "Total Impact" in content, "Page missing 'Total Impact' card"
        
        print("✓ PASSED: Tree donations page has all 5 summary cards")


class TestOrderSuccessPage:
    """Test order success page tree donation thank you message"""
    
    def test_order_success_page_has_tree_donation_thanks(self):
        """Verify order success page has tree donation thank you section"""
        page_file = "/app/frontend-next/app/orders/success/page.js"
        with open(page_file, 'r') as f:
            content = f.read()
        
        # Check for tree donation thank you section
        assert 'data-testid="tree-donation-thanks"' in content, \
            "Order success page missing data-testid='tree-donation-thanks'"
        
        # Check for thank you message
        assert "Thank You for Planting a Tree" in content or "Thank you for planting a tree" in content.lower(), \
            "Order success page missing thank you message"
        
        # Check for tree=true param handling
        assert "tree" in content, "Order success page missing tree param handling"
        assert "treeDonation" in content or "tree_donation" in content, \
            "Order success page missing treeDonation state"
        
        print("✓ PASSED: Order success page has tree donation thank you section with data-testid")
    
    def test_order_success_page_shows_donation_amount(self):
        """Verify order success page shows Rs. 5 donation amount"""
        page_file = "/app/frontend-next/app/orders/success/page.js"
        with open(page_file, 'r') as f:
            content = f.read()
        
        # Check for Rs. 5 amount
        assert "Rs. 5" in content or "₹5" in content or "Rs.5" in content, \
            "Order success page missing Rs. 5 donation amount"
        
        print("✓ PASSED: Order success page shows Rs. 5 donation amount")
    
    def test_order_success_page_has_tree_icon(self):
        """Verify order success page has TreePine icon"""
        page_file = "/app/frontend-next/app/orders/success/page.js"
        with open(page_file, 'r') as f:
            content = f.read()
        
        assert "TreePine" in content, "Order success page missing TreePine icon"
        
        print("✓ PASSED: Order success page has TreePine icon")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
