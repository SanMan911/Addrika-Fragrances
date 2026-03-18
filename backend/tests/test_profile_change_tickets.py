"""
Test Profile Change Ticket System
Tests retailer profile change request endpoints and admin review endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - using existing retailer from database
RETAILER_EMAIL = "karolbagh@addrika.com"
RETAILER_PASSWORD = "retailer123"
ADMIN_EMAIL = "contact.us@centraders.com"
ADMIN_PIN = "110078"


class TestRetailerProfileChangeTickets:
    """Tests for retailer profile change ticket endpoints"""
    
    @pytest.fixture(scope="class")
    def retailer_session(self):
        """Get retailer session token via login"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Retailer login failed: {response.status_code} - {response.text}")
        
        data = response.json()
        token = data.get('token')
        
        if not token:
            pytest.skip("No token received from retailer login")
        
        return token
    
    def test_create_profile_change_ticket_name_address(self, retailer_session):
        """Test creating a name/address change ticket"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "name_address",
                "description": "I would like to update our business registered address to our new location.",
                "new_value": "123 New Street, Mumbai 400001"
            },
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "ticket_id" in data
        assert data["ticket_id"].startswith("PCT-")
        assert data["status"] == "pending"
        assert "message" in data
        print(f"Created ticket: {data['ticket_id']}")
    
    def test_create_profile_change_ticket_gst(self, retailer_session):
        """Test creating a GST change ticket"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "gst",
                "description": "Need to update GST number due to business restructuring.",
                "new_value": "27AAAAA0000A1Z5"
            },
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "ticket_id" in data
        assert data["change_type"] == "Change in GST"
        print(f"Created GST ticket: {data['ticket_id']}")
    
    def test_create_profile_change_ticket_spoc(self, retailer_session):
        """Test creating a SPOC change ticket"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "spoc",
                "description": "Our SPOC has changed. Please update contact person to Mr. New Contact.",
                "new_value": "Mr. New Contact - 9876543210"
            },
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "ticket_id" in data
        print(f"Created SPOC ticket: {data['ticket_id']}")
    
    def test_create_profile_change_ticket_other(self, retailer_session):
        """Test creating an 'other' type ticket"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "other",
                "description": "Need to update our bank account details for payment processing."
            },
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "ticket_id" in data
        print(f"Created other ticket: {data['ticket_id']}")
    
    def test_create_ticket_invalid_type(self, retailer_session):
        """Test that invalid change type is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "invalid_type",
                "description": "This should fail validation"
            },
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_create_ticket_short_description(self, retailer_session):
        """Test that short description is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "name_address",
                "description": "too short"  # Less than 10 chars
            },
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_list_profile_change_tickets(self, retailer_session):
        """Test listing retailer's profile change tickets"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-requests",
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "tickets" in data
        assert "status_counts" in data
        assert "pagination" in data
        
        # Check status counts has expected keys
        assert "pending" in data["status_counts"]
        assert "under_review" in data["status_counts"]
        assert "approved" in data["status_counts"]
        assert "rejected" in data["status_counts"]
        
        # Check pagination structure
        assert "page" in data["pagination"]
        assert "total" in data["pagination"]
        
        print(f"Found {len(data['tickets'])} tickets, status counts: {data['status_counts']}")
    
    def test_list_tickets_with_status_filter(self, retailer_session):
        """Test filtering tickets by status"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-requests?status=pending",
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All tickets should be pending
        for ticket in data["tickets"]:
            assert ticket["status"] == "pending"
    
    def test_get_ticket_detail(self, retailer_session):
        """Test getting specific ticket details"""
        # First get a ticket ID
        list_response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-requests",
            cookies={"retailer_session": retailer_session}
        )
        
        if list_response.status_code != 200 or not list_response.json().get("tickets"):
            pytest.skip("No tickets found to test detail endpoint")
        
        ticket_id = list_response.json()["tickets"][0]["ticket_id"]
        
        # Get detail
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-requests/{ticket_id}",
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "ticket" in data
        assert data["ticket"]["ticket_id"] == ticket_id
        assert "description" in data["ticket"]
        assert "status" in data["ticket"]
        print(f"Ticket detail: {data['ticket']['ticket_id']} - {data['ticket']['status']}")
    
    def test_get_ticket_not_found(self, retailer_session):
        """Test getting non-existent ticket"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-requests/PCT-NOTEXIST",
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 404
    
    def test_unauthenticated_access(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-requests"
        )
        
        assert response.status_code == 401


class TestAdminProfileChangeTickets:
    """Tests for admin profile change ticket review endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get admin session - creates direct DB session for testing"""
        import asyncio
        import secrets
        from datetime import datetime, timezone, timedelta
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except ImportError:
            pytest.skip("motor not available for admin session creation")
        
        async def create_session():
            client = AsyncIOMotorClient('mongodb://localhost:27017')
            db = client['addrika_db']
            
            # Create a direct admin session for testing
            session_token = secrets.token_urlsafe(32)
            session = {
                'session_id': f'admin_sess_test_{secrets.token_hex(8)}',
                'email': ADMIN_EMAIL,
                'session_token': session_token,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
            }
            
            await db.admin_sessions.insert_one(session)
            return session_token
        
        try:
            token = asyncio.run(create_session())
            return token
        except Exception as e:
            pytest.skip(f"Could not create admin session: {e}")
    
    def test_admin_list_all_tickets(self, admin_session):
        """Test admin listing all profile change tickets"""
        response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets",
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "tickets" in data
        assert "status_counts" in data
        assert "pagination" in data
        
        print(f"Admin sees {data['pagination']['total']} total tickets")
    
    def test_admin_filter_by_status(self, admin_session):
        """Test admin filtering tickets by status"""
        response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets?status=pending",
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All tickets should be pending
        for ticket in data["tickets"]:
            assert ticket["status"] == "pending"
    
    def test_admin_get_ticket_detail(self, admin_session):
        """Test admin getting specific ticket details with retailer info"""
        # First get a ticket ID
        list_response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets",
            cookies={"session_token": admin_session}
        )
        
        if list_response.status_code != 200 or not list_response.json().get("tickets"):
            pytest.skip("No tickets found for admin detail test")
        
        ticket_id = list_response.json()["tickets"][0]["ticket_id"]
        
        # Get detail
        response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/{ticket_id}",
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "ticket" in data
        assert "retailer" in data  # Admin should get retailer info too
        print(f"Admin ticket detail: {data['ticket']['ticket_id']} from retailer {data['retailer']['retailer_id']}")
    
    def test_admin_update_ticket_under_review(self, admin_session):
        """Test admin setting ticket to under_review"""
        # Get a pending ticket
        list_response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets?status=pending",
            cookies={"session_token": admin_session}
        )
        
        if list_response.status_code != 200 or not list_response.json().get("tickets"):
            pytest.skip("No pending tickets to test status update")
        
        ticket_id = list_response.json()["tickets"][0]["ticket_id"]
        
        # Update status
        response = requests.put(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/{ticket_id}",
            json={
                "status": "under_review",
                "admin_notes": "Reviewing the submitted documents."
            },
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["new_status"] == "under_review"
        print(f"Ticket {ticket_id} set to under_review")
    
    def test_admin_approve_ticket(self, admin_session):
        """Test admin approving a ticket"""
        # Get an under_review ticket
        list_response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets?status=under_review",
            cookies={"session_token": admin_session}
        )
        
        if list_response.status_code != 200 or not list_response.json().get("tickets"):
            pytest.skip("No under_review tickets to test approval")
        
        ticket_id = list_response.json()["tickets"][0]["ticket_id"]
        
        # Approve
        response = requests.put(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/{ticket_id}",
            json={
                "status": "approved",
                "admin_notes": "Change approved. Profile will be updated shortly."
            },
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["new_status"] == "approved"
        print(f"Ticket {ticket_id} approved")
    
    def test_admin_reject_ticket(self, admin_session):
        """Test admin rejecting a ticket"""
        # Create a new ticket first via retailer
        retailer_response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD}
        )
        
        if retailer_response.status_code != 200:
            pytest.skip("Cannot login retailer for test ticket creation")
        
        retailer_token = retailer_response.json().get('token')
        
        # Create a ticket to reject
        create_response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile-change-request",
            json={
                "change_type": "other",
                "description": "TEST_REJECTION: This ticket is created for testing rejection flow."
            },
            cookies={"retailer_session": retailer_token}
        )
        
        if create_response.status_code != 200:
            pytest.skip("Cannot create ticket for rejection test")
        
        ticket_id = create_response.json()["ticket_id"]
        
        # Now reject as admin
        response = requests.put(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/{ticket_id}",
            json={
                "status": "rejected",
                "admin_notes": "Insufficient documentation provided."
            },
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["new_status"] == "rejected"
        print(f"Ticket {ticket_id} rejected")
    
    def test_admin_invalid_status_update(self, admin_session):
        """Test that invalid status update is rejected"""
        # Get any ticket
        list_response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets",
            cookies={"session_token": admin_session}
        )
        
        if list_response.status_code != 200 or not list_response.json().get("tickets"):
            pytest.skip("No tickets for invalid status test")
        
        ticket_id = list_response.json()["tickets"][0]["ticket_id"]
        
        # Try invalid status
        response = requests.put(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets/{ticket_id}",
            json={
                "status": "invalid_status",
                "admin_notes": "This should fail"
            },
            cookies={"session_token": admin_session}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_admin_unauthenticated(self):
        """Test admin endpoints require authentication"""
        response = requests.get(
            f"{BASE_URL}/api/retailers/admin/profile-change-tickets"
        )
        
        assert response.status_code == 401


class TestProfileImageSelfService:
    """Tests for profile image upload (the only self-service profile change)"""
    
    @pytest.fixture(scope="class")
    def retailer_session(self):
        """Get retailer session token via login"""
        response = requests.post(
            f"{BASE_URL}/api/retailer-auth/login",
            json={"email": RETAILER_EMAIL, "password": RETAILER_PASSWORD}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Retailer login failed: {response.status_code}")
        
        return response.json().get('token')
    
    def test_profile_image_upload(self, retailer_session):
        """Test uploading profile image"""
        # Create a tiny valid PNG (1x1 pixel)
        import base64
        # Minimal 1x1 PNG
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {
            'image': ('test.png', png_data, 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile/image",
            files=files,
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "updated_at" in data
        print("Profile image uploaded successfully")
    
    def test_profile_image_delete(self, retailer_session):
        """Test removing profile image"""
        response = requests.delete(
            f"{BASE_URL}/api/retailer-dashboard/profile/image",
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        print("Profile image removed successfully")
    
    def test_profile_image_too_large(self, retailer_session):
        """Test that oversized images are rejected"""
        # Create 3MB of data (larger than 2MB limit)
        large_data = b'x' * (3 * 1024 * 1024)
        
        files = {
            'image': ('large.png', large_data, 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile/image",
            files=files,
            cookies={"retailer_session": retailer_session}
        )
        
        assert response.status_code == 400
    
    def test_profile_image_unauthenticated(self):
        """Test profile image upload requires auth"""
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {
            'image': ('test.png', png_data, 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/retailer-dashboard/profile/image",
            files=files
        )
        
        assert response.status_code == 401
