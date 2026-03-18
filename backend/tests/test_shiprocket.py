"""
Test ShipRocket Shipping API Integration
Tests for shipping rates, weight calculation, and pincode verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestShipRocketIntegration:
    """Test real ShipRocket API integration"""
    
    def test_quick_shipping_rate_success(self):
        """Test GET /api/shipping/rates/quick returns real ShipRocket rates"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/rates/quick",
            params={"pincode": "110001", "weight": 0.25}
        )
        assert response.status_code == 200
        
        data = response.json()
        print(f"Shipping rate response: {data}")
        
        # Should return success with real rates
        assert data.get("success") == True, f"Expected success=True, got {data}"
        assert "shipping_charge" in data
        assert "courier_name" in data
        assert "etd" in data
        assert data.get("currency") == "INR"
        
        # Verify it's a real rate, not fallback (fallback returns success=False)
        assert data.get("courier_name") != "Standard", "Got fallback rate, not real ShipRocket rate"
        print(f"✓ Real ShipRocket rate: ₹{data['shipping_charge']} via {data['courier_name']}, ETD: {data['etd']}")
    
    def test_quick_shipping_rate_weight_80g(self):
        """Test shipping rate for 50g packet (80g shipping weight)"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/rates/quick",
            params={"pincode": "110001", "weight": 0.08}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ 80g rate: ₹{data['shipping_charge']} via {data['courier_name']}")
    
    def test_quick_shipping_rate_weight_350g(self):
        """Test shipping rate for 200g jar (350g shipping weight)"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/rates/quick",
            params={"pincode": "110001", "weight": 0.35}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ 350g rate: ₹{data['shipping_charge']} via {data['courier_name']}")
    
    def test_pincode_serviceability(self):
        """Test pincode check endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/check-pincode",
            params={"pincode": "110001"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "serviceable" in data
        assert "city" in data or data.get("serviceable") == True
        print(f"✓ Pincode 110001 serviceable: {data.get('serviceable')}, city: {data.get('city')}")
    
    def test_supported_countries(self):
        """Test supported countries endpoint"""
        response = requests.get(f"{BASE_URL}/api/shipping/countries")
        assert response.status_code == 200
        
        data = response.json()
        assert "popular" in data
        assert "all" in data
        assert len(data["popular"]) > 0
        print(f"✓ Got {len(data['popular'])} popular countries and {len(data['all'])} total countries")
    
    def test_invalid_pincode_format(self):
        """Test invalid pincode returns error"""
        response = requests.get(
            f"{BASE_URL}/api/shipping/rates/quick",
            params={"pincode": "1234", "weight": 0.25}
        )
        assert response.status_code == 422  # Validation error for too short pincode
    
    def test_pickup_pincode_is_delhi(self):
        """Verify pickup pincode is 110078 (Delhi)"""
        # This is indirect test - if shipping works, it uses the configured pincode
        response = requests.get(
            f"{BASE_URL}/api/shipping/rates/quick",
            params={"pincode": "110078", "weight": 0.25}  # Same as pickup
        )
        assert response.status_code == 200
        data = response.json()
        # Local delivery should have lower rates
        print(f"✓ Same pincode delivery rate: ₹{data.get('shipping_charge')}")

class TestShippingRatesEndpoint:
    """Test POST /api/shipping/rates endpoint"""
    
    def test_domestic_shipping_rates(self):
        """Test domestic shipping rates with full details"""
        response = requests.post(
            f"{BASE_URL}/api/shipping/rates",
            json={
                "delivery_pincode": "560001",  # Bangalore
                "weight": 0.25,
                "country": "IN"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "couriers" in data
        assert "currency" in data
        print(f"✓ Got {len(data.get('couriers', []))} courier options for Bangalore")
        
        if data.get("success") and data.get("couriers"):
            # Verify courier data structure
            courier = data["couriers"][0]
            assert "courier_name" in courier
            assert "rate" in courier
            assert "etd" in courier


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
