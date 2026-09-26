# AAROHMM External API — Field Sales Manager (FSM) & partner apps

Base URL: `https://<backend-host>/api/external/v1`
Auth: `X-API-Key: <key>` (or `Authorization: Bearer <key>`). Keys are minted in **Admin → API Keys**
(`/admin/api-keys`) and carry scopes. Use the "Field Sales Manager preset" for all five scopes.

| Scope | Grants |
| --- | --- |
| `stock:read` | `GET /stock`, `GET /stock/{sku}` |
| `catalog:read` | `GET /catalog` |
| `retailers:read` | `GET /retailers` |
| `orders:write` | `POST /orders`, `POST /orders/preview`, `POST /orders/{id}/cancel` |
| `orders:read` | `GET /orders`, `GET /orders/{id}` |

Every order placed here uses the **same engine** as the web portal and Aaroviah (`services/b2b_order_engine.py`):
pricing tiers, KYC gate, vouchers, rewards, Zoho sync, e-mails — and stock.

## Real-time stock model (all channels)

`b2b_products.stock_pieces` in MongoDB is the single source of truth for **both** D2C and B2B.

| Event | Stock effect |
| --- | --- |
| FSM order (`pay_later` or `razorpay_link`) placed | **Reserved immediately** (`order_placed`) |
| Web B2B credit order placed | Reserved immediately |
| Web B2B online (Razorpay checkout) order paid | Deducted at payment (`order_paid`) |
| D2C order paid | Deducted at payment |
| Any order cancelled | Released (`order_cancelled`) |
| Admin quick-adjust / restock | Applied instantly |

Each change: updates Mongo → refreshes the in-process catalogue cache → upserts the Supabase
`products_mirror` row (what the Aaroviah app reads) → fires **stock webhooks** (`stock.changed`,
`stock.low`, `stock.out`; signed with `X-Aarohmm-Signature`, configure in Admin → Stock Webhooks).
D2C checkout and B2B pricing both **block** quantities above live stock.

## Typical FSM flow

```http
GET /retailers?gstin=07AAAAA0000A1Z5          # or ?phone=98xxxxxxxx or ?q=Shop name
GET /catalog?orderable_only=true              # prices, carton math, live stock, max_order_boxes
POST /orders/preview                          # totals before the rep confirms with the retailer
POST /orders                                  # place — 201
GET /orders/{order_id}                        # status; pending payment links are re-checked with Razorpay
POST /orders/{order_id}/cancel                # releases reserved stock (unpaid orders only)
```

### `POST /orders` body

```json
{
  "retailer_id": "RTL_ABC123",            // or "gstin": "07AAAAA0000A1Z5"
  "items": [{ "product_id": "bold-bakhoor-b2b", "quantity_boxes": 1.5 }],
  "payment_mode": "pay_later",            // or "razorpay_link"
  "delivery_pincode": "110001",           // optional → Shiprocket quote added
  "include_shipping": true,
  "apply_cash_discount": false,
  "voucher_code": null,
  "notes": "Deliver Monday before noon",
  "placed_by": { "id": "fsm-17", "name": "Ravi Kumar", "phone": "98xxxxxxxx" },
  "client_ref": "fsm-17-2026-06-12-001"   // idempotency key — retries return the same order
}
```

`quantity_boxes` = cartons in multiples of 0.5. Response includes `order_id`, `grand_total`,
`stock_reserved`, and for `razorpay_link` the `payment_link_url` Razorpay also SMSes/e-mails the retailer.

### Payment confirmation

* `pay_later` → collected offline; admin records it in **Admin → B2B Orders → Mark paid**
  (cash / UPI / bank transfer / cheque). This runs rewards accrual, Zoho sync and the retailer e-mail.
* `razorpay_link` → auto-confirms when Razorpay reports payment. Configure the Razorpay webhook
  `payment_link.paid` → `https://<backend-host>/api/retailer-dashboard/b2b/razorpay/webhook`
  with secret `RAZORPAY_WEBHOOK_SECRET`. Without the webhook, `GET /orders/{id}` polls Razorpay on read.

### Errors

| Code | Meaning |
| --- | --- |
| 401 | missing/invalid key or missing scope |
| 403 | retailer inactive, or KYC incomplete (`{"error":"kyc_incomplete","missing":[...]}`) when the admin KYC gate is on |
| 404 | retailer / SKU / order not found |
| 400 | quantity not a multiple of 0.5, SKU out of stock, or quantity above live stock |
| 409 | duplicate/cancel conflicts (paid orders can only be cancelled by admin) |

Full OpenAPI schema: `https://<backend-host>/openapi.json` (Swagger UI at `/docs`).
