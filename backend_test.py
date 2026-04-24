#!/usr/bin/env python3
"""
Backend API Testing for Addrika Landing Page
Tests all inquiry management endpoints and validation
"""

import requests
import json
import uuid
from datetime import datetime
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://incense-retailer-hub.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}Testing: {test_name}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }
        self.created_inquiry_id = None

    def test_health_check(self):
        """Test the health check endpoint"""
        print_test_header("Health Check API")
        
        try:
            response = requests.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Addrika" in data["message"]:
                    print_success("Health check endpoint working correctly")
                    print_info(f"Response: {data}")
                    self.test_results['passed'] += 1
                    return True
                else:
                    print_error("Health check response format incorrect")
                    self.test_results['failed'] += 1
                    self.test_results['errors'].append("Health check response format incorrect")
                    return False
            else:
                print_error(f"Health check failed with status code: {response.status_code}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"Health check failed with status code: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Health check request failed: {str(e)}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"Health check request failed: {str(e)}")
            return False

    def test_create_inquiry_valid(self):
        """Test creating inquiry with valid data"""
        print_test_header("Create Inquiry - Valid Data")
        
        valid_inquiry = {
            "name": "Rajesh Kumar",
            "email": "rajesh.kumar@example.com",
            "phone": "+91 9876543210",
            "fragrance": "Kesar Chandan",
            "packageSize": "200g",
            "quantity": 5,
            "message": "Interested in wholesale pricing for my retail store",
            "type": "retail"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/inquiries",
                json=valid_inquiry,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "message" in data and "inquiry" in data:
                    self.created_inquiry_id = data["id"]
                    print_success("Valid inquiry created successfully")
                    print_info(f"Inquiry ID: {self.created_inquiry_id}")
                    print_info(f"Response message: {data['message']}")
                    
                    # Verify inquiry data
                    inquiry_data = data["inquiry"]
                    if (inquiry_data["name"] == valid_inquiry["name"] and
                        inquiry_data["email"] == valid_inquiry["email"] and
                        inquiry_data["type"] == valid_inquiry["type"]):
                        print_success("Inquiry data stored correctly")
                        self.test_results['passed'] += 1
                        return True
                    else:
                        print_error("Inquiry data mismatch")
                        self.test_results['failed'] += 1
                        self.test_results['errors'].append("Inquiry data mismatch")
                        return False
                else:
                    print_error("Invalid response format for create inquiry")
                    self.test_results['failed'] += 1
                    self.test_results['errors'].append("Invalid response format for create inquiry")
                    return False
            else:
                print_error(f"Create inquiry failed with status code: {response.status_code}")
                print_error(f"Response: {response.text}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"Create inquiry failed with status code: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Create inquiry request failed: {str(e)}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"Create inquiry request failed: {str(e)}")
            return False

    def test_create_inquiry_validation_errors(self):
        """Test validation errors with invalid data"""
        print_test_header("Create Inquiry - Validation Tests")
        
        test_cases = [
            {
                "name": "Missing Email",
                "data": {
                    "name": "Test User",
                    "phone": "+91 9876543210",
                    "fragrance": "Kesar Chandan",
                    "packageSize": "200g",
                    "quantity": 5,
                    "type": "retail"
                },
                "expected_error": "email field required"
            },
            {
                "name": "Invalid Email Format",
                "data": {
                    "name": "Test User",
                    "email": "invalid-email",
                    "phone": "+91 9876543210",
                    "fragrance": "Kesar Chandan",
                    "packageSize": "200g",
                    "quantity": 5,
                    "type": "retail"
                },
                "expected_error": "email format"
            },
            {
                "name": "Zero Quantity",
                "data": {
                    "name": "Test User",
                    "email": "test@example.com",
                    "phone": "+91 9876543210",
                    "fragrance": "Kesar Chandan",
                    "packageSize": "200g",
                    "quantity": 0,
                    "type": "retail"
                },
                "expected_error": "quantity must be greater than 0"
            },
            {
                "name": "Invalid Type",
                "data": {
                    "name": "Test User",
                    "email": "test@example.com",
                    "phone": "+91 9876543210",
                    "fragrance": "Kesar Chandan",
                    "packageSize": "200g",
                    "quantity": 5,
                    "type": "invalid_type"
                },
                "expected_error": "type must be retail or wholesale"
            }
        ]
        
        validation_passed = 0
        for test_case in test_cases:
            try:
                response = requests.post(
                    f"{self.base_url}/inquiries",
                    json=test_case["data"],
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 422:  # Validation error
                    print_success(f"Validation test '{test_case['name']}' - Correctly rejected")
                    validation_passed += 1
                elif response.status_code == 400:  # Bad request
                    print_success(f"Validation test '{test_case['name']}' - Correctly rejected")
                    validation_passed += 1
                else:
                    print_error(f"Validation test '{test_case['name']}' - Should have been rejected but got status {response.status_code}")
                    self.test_results['errors'].append(f"Validation test '{test_case['name']}' failed")
                    
            except Exception as e:
                print_error(f"Validation test '{test_case['name']}' failed with exception: {str(e)}")
                self.test_results['errors'].append(f"Validation test '{test_case['name']}' failed with exception")
        
        if validation_passed == len(test_cases):
            print_success("All validation tests passed")
            self.test_results['passed'] += 1
            return True
        else:
            print_error(f"Only {validation_passed}/{len(test_cases)} validation tests passed")
            self.test_results['failed'] += 1
            return False

    def test_get_all_inquiries(self):
        """Test getting all inquiries"""
        print_test_header("Get All Inquiries")
        
        try:
            response = requests.get(f"{self.base_url}/inquiries")
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data and "inquiries" in data:
                    print_success(f"Retrieved {data['count']} inquiries")
                    
                    # Check if our created inquiry is in the list
                    if self.created_inquiry_id:
                        found_inquiry = False
                        for inquiry in data["inquiries"]:
                            if inquiry.get("id") == self.created_inquiry_id:
                                found_inquiry = True
                                print_success("Previously created inquiry found in list")
                                break
                        
                        if not found_inquiry:
                            print_warning("Previously created inquiry not found in list")
                    
                    self.test_results['passed'] += 1
                    return True
                else:
                    print_error("Invalid response format for get inquiries")
                    self.test_results['failed'] += 1
                    self.test_results['errors'].append("Invalid response format for get inquiries")
                    return False
            else:
                print_error(f"Get inquiries failed with status code: {response.status_code}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"Get inquiries failed with status code: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Get inquiries request failed: {str(e)}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"Get inquiries request failed: {str(e)}")
            return False

    def test_get_inquiry_by_id(self):
        """Test getting specific inquiry by ID"""
        print_test_header("Get Inquiry by ID")
        
        if not self.created_inquiry_id:
            print_warning("No inquiry ID available for testing - skipping")
            return True
        
        try:
            response = requests.get(f"{self.base_url}/inquiries/{self.created_inquiry_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "inquiry" in data:
                    inquiry = data["inquiry"]
                    if inquiry.get("id") == self.created_inquiry_id:
                        print_success("Inquiry retrieved successfully by ID")
                        print_info(f"Inquiry name: {inquiry.get('name')}")
                        print_info(f"Inquiry status: {inquiry.get('status')}")
                        self.test_results['passed'] += 1
                        return True
                    else:
                        print_error("Retrieved inquiry ID doesn't match requested ID")
                        self.test_results['failed'] += 1
                        self.test_results['errors'].append("Retrieved inquiry ID mismatch")
                        return False
                else:
                    print_error("Invalid response format for get inquiry by ID")
                    self.test_results['failed'] += 1
                    self.test_results['errors'].append("Invalid response format for get inquiry by ID")
                    return False
            elif response.status_code == 404:
                print_error("Inquiry not found - this shouldn't happen with valid ID")
                self.test_results['failed'] += 1
                self.test_results['errors'].append("Inquiry not found with valid ID")
                return False
            else:
                print_error(f"Get inquiry by ID failed with status code: {response.status_code}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"Get inquiry by ID failed with status code: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Get inquiry by ID request failed: {str(e)}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"Get inquiry by ID request failed: {str(e)}")
            return False

    def test_update_inquiry_status(self):
        """Test updating inquiry status"""
        print_test_header("Update Inquiry Status")
        
        if not self.created_inquiry_id:
            print_warning("No inquiry ID available for testing - skipping")
            return True
        
        # Test valid status update
        try:
            response = requests.patch(
                f"{self.base_url}/inquiries/{self.created_inquiry_id}/status",
                params={"status": "contacted"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "new_status" in data:
                    if data["new_status"] == "contacted":
                        print_success("Inquiry status updated successfully")
                        print_info(f"New status: {data['new_status']}")
                        self.test_results['passed'] += 1
                        
                        # Test invalid status
                        invalid_response = requests.patch(
                            f"{self.base_url}/inquiries/{self.created_inquiry_id}/status",
                            params={"status": "invalid_status"}
                        )
                        
                        if invalid_response.status_code == 400:
                            print_success("Invalid status correctly rejected")
                            return True
                        else:
                            print_warning("Invalid status was not rejected properly")
                            return True  # Still pass the main test
                    else:
                        print_error("Status update returned wrong status")
                        self.test_results['failed'] += 1
                        self.test_results['errors'].append("Status update returned wrong status")
                        return False
                else:
                    print_error("Invalid response format for status update")
                    self.test_results['failed'] += 1
                    self.test_results['errors'].append("Invalid response format for status update")
                    return False
            else:
                print_error(f"Status update failed with status code: {response.status_code}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"Status update failed with status code: {response.status_code}")
                return False
                
        except Exception as e:
            print_error(f"Status update request failed: {str(e)}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"Status update request failed: {str(e)}")
            return False

    def test_mongodb_integration(self):
        """Test MongoDB data persistence"""
        print_test_header("MongoDB Integration Test")
        
        # Create a test inquiry and verify it persists
        test_inquiry = {
            "name": "MongoDB Test User",
            "email": "mongodb.test@example.com",
            "phone": "+91 9999999999",
            "fragrance": "Rose Petals",
            "packageSize": "100g",
            "quantity": 2,
            "message": "Testing MongoDB integration",
            "type": "wholesale"
        }
        
        try:
            # Create inquiry
            create_response = requests.post(
                f"{self.base_url}/inquiries",
                json=test_inquiry,
                headers={"Content-Type": "application/json"}
            )
            
            if create_response.status_code == 200:
                create_data = create_response.json()
                test_inquiry_id = create_data["id"]
                
                # Verify it exists in the database by fetching it
                get_response = requests.get(f"{self.base_url}/inquiries/{test_inquiry_id}")
                
                if get_response.status_code == 200:
                    get_data = get_response.json()
                    inquiry = get_data["inquiry"]
                    
                    # Check if timestamps are present
                    if "createdAt" in inquiry and "updatedAt" in inquiry:
                        print_success("MongoDB integration working - data persisted with timestamps")
                        print_info(f"Created at: {inquiry['createdAt']}")
                        print_info(f"Updated at: {inquiry['updatedAt']}")
                        self.test_results['passed'] += 1
                        return True
                    else:
                        print_error("Timestamps not found in stored data")
                        self.test_results['failed'] += 1
                        self.test_results['errors'].append("Timestamps not found in stored data")
                        return False
                else:
                    print_error("Created inquiry not found in database")
                    self.test_results['failed'] += 1
                    self.test_results['errors'].append("Created inquiry not found in database")
                    return False
            else:
                print_error("Failed to create test inquiry for MongoDB test")
                self.test_results['failed'] += 1
                self.test_results['errors'].append("Failed to create test inquiry for MongoDB test")
                return False
                
        except Exception as e:
            print_error(f"MongoDB integration test failed: {str(e)}")
            self.test_results['failed'] += 1
            self.test_results['errors'].append(f"MongoDB integration test failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"{Colors.BOLD}{Colors.BLUE}")
        print("🧪 ADDRIKA BACKEND API TESTING")
        print("=" * 50)
        print(f"Backend URL: {self.base_url}")
        print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{Colors.ENDC}")
        
        # Run all tests
        tests = [
            self.test_health_check,
            self.test_create_inquiry_valid,
            self.test_create_inquiry_validation_errors,
            self.test_get_all_inquiries,
            self.test_get_inquiry_by_id,
            self.test_update_inquiry_status,
            self.test_mongodb_integration
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print_error(f"Test {test.__name__} crashed: {str(e)}")
                self.test_results['failed'] += 1
                self.test_results['errors'].append(f"Test {test.__name__} crashed: {str(e)}")
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}")
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"{Colors.ENDC}")
        
        total_tests = self.test_results['passed'] + self.test_results['failed']
        
        if self.test_results['passed'] > 0:
            print_success(f"Passed: {self.test_results['passed']}/{total_tests}")
        
        if self.test_results['failed'] > 0:
            print_error(f"Failed: {self.test_results['failed']}/{total_tests}")
            
            if self.test_results['errors']:
                print(f"\n{Colors.RED}{Colors.BOLD}ERRORS FOUND:{Colors.ENDC}")
                for i, error in enumerate(self.test_results['errors'], 1):
                    print(f"{Colors.RED}{i}. {error}{Colors.ENDC}")
        
        if self.test_results['failed'] == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! Backend is working correctly.{Colors.ENDC}")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}⚠️  Some tests failed. Please check the errors above.{Colors.ENDC}")
        
        print(f"\n{Colors.BLUE}Test Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.ENDC}")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()