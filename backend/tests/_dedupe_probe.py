# Probe: does checkout-intent dedupe ignore non-item fields (shipping/pincode)?
import requests
B = "http://localhost:8001"
tok = requests.post(f"{B}/api/retailer-auth/login", json={"gstin": "07AAAAA0000A1Z5", "password": "Test@12345"}).json()["token"]
h = {"Cookie": f"retailer_session={tok}"}
items = [{"product_id": "regal-rose-b2b", "quantity_boxes": 5}]
a = requests.post(f"{B}/api/retailer-dashboard/b2b/checkout-intent", headers=h,
                  json={"items": items, "include_shipping": False, "payment_percent": 80}).json()
b = requests.post(f"{B}/api/retailer-dashboard/b2b/checkout-intent", headers=h,
                  json={"items": items, "include_shipping": True, "delivery_pincode": "560001", "payment_percent": 80}).json()
c = requests.post(f"{B}/api/retailer-dashboard/b2b/calculate", headers=h,
                  json={"items": items, "include_shipping": True, "delivery_pincode": "560001"}).json()
print("A", a.get("intent_id"), a.get("grand_total"))
print("B (with shipping)", b.get("intent_id"), b.get("grand_total"), b.get("detail"))
print("calc with shipping grand_total", c.get("grand_total"), "shipping", c.get("shipping_charges"))
