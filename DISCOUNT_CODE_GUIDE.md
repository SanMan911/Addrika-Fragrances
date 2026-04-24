# Discount Code Management Guide

## API Base URL
```
https://incense-retailer-hub.preview.emergentagent.com/api
```
(Replace with your production domain when deployed)

---

## 1️⃣ Generate ONE-TIME Discount Code (Auto-generated)

Use this for quality complaints or special one-time offers.

**Endpoint:** `POST /api/admin/discount-codes/generate`

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| discount_type | string | "percentage" | "percentage" or "fixed" |
| discount_value | number | 10 | Discount amount (% or ₹) |
| max_uses | number | 1 | Set to 1 for one-time codes |
| min_order_value | number | 0 | Minimum order value required |
| description | string | auto | Description for your reference |

**Example - Generate 10% one-time code:**
```bash
curl -X POST "https://YOUR-DOMAIN/api/admin/discount-codes/generate?discount_type=percentage&discount_value=10&max_uses=1&description=Quality%20complaint%20compensation"
```

**Response:**
```json
{
  "discountCode": {
    "code": "5L1Y3VJO",
    "discountType": "percentage",
    "discountValue": 10,
    "maxUses": 1
  }
}
```

---

## 2️⃣ Create CUSTOM/REUSABLE Discount Code

Use this for promotional campaigns, festivals, etc.

**Endpoint:** `POST /api/admin/discount-codes`

**Body (JSON):**
```json
{
  "code": "DIWALI20",
  "discountType": "percentage",
  "discountValue": 20,
  "maxUses": null,
  "minOrderValue": 1000,
  "description": "Diwali Festival - 20% off"
}
```

**Parameters:**
| Field | Type | Description |
|-------|------|-------------|
| code | string | Your custom code (will be uppercased) |
| discountType | string | "percentage" or "fixed" |
| discountValue | number | Discount amount |
| maxUses | number/null | null = unlimited uses |
| minOrderValue | number | Minimum cart value (0 = no minimum) |
| description | string | For your reference |

**Example - Create unlimited-use 20% code:**
```bash
curl -X POST "https://YOUR-DOMAIN/api/admin/discount-codes" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "DIWALI20",
    "discountType": "percentage",
    "discountValue": 20,
    "maxUses": null,
    "minOrderValue": 1000,
    "description": "Diwali Festival - 20% off on orders above Rs.1000"
  }'
```

---

## 3️⃣ List All Discount Codes

**Endpoint:** `GET /api/admin/discount-codes`

```bash
curl "https://YOUR-DOMAIN/api/admin/discount-codes"
```

---

## 4️⃣ Deactivate a Discount Code

**Endpoint:** `DELETE /api/admin/discount-codes/{code_id}`

```bash
curl -X DELETE "https://YOUR-DOMAIN/api/admin/discount-codes/{code_id}"
```

---

## How Codes Are Honored

1. Customer enters code at checkout
2. System validates:
   - Code exists and is active
   - Not expired
   - Usage limit not reached
   - Minimum order value met
3. Discount is applied to order total
4. When order is placed:
   - Code usage count increments
   - Usage is logged with order details
5. One-time codes become invalid after single use

---

## Example Scenarios

### Quality Complaint (One-time 10% off):
```bash
curl -X POST "https://YOUR-DOMAIN/api/admin/discount-codes/generate?discount_type=percentage&discount_value=10&max_uses=1"
```

### Festival Sale (Unlimited 15% off, min ₹500):
```bash
curl -X POST "https://YOUR-DOMAIN/api/admin/discount-codes" \
  -H "Content-Type: application/json" \
  -d '{"code":"HOLI15","discountType":"percentage","discountValue":15,"maxUses":null,"minOrderValue":500}'
```

### Flat ₹100 off (Limited to 50 uses):
```bash
curl -X POST "https://YOUR-DOMAIN/api/admin/discount-codes" \
  -H "Content-Type: application/json" \
  -d '{"code":"FLAT100","discountType":"fixed","discountValue":100,"maxUses":50,"minOrderValue":300}'
```

---

## Current Active Codes

| Code | Discount | Uses | Min Order | Status |
|------|----------|------|-----------|--------|
| WELCOME15 | 15% | Unlimited | ₹500 | ✅ Active |
| DIWALI20 | 20% | Unlimited | ₹1000 | ✅ Active |
| JJI4B9B5 | 10% | 0/1 | ₹0 | ✅ Active (One-time) |
| 5L1Y3VJO | 10% | 0/1 | ₹0 | ✅ Active (One-time) |
