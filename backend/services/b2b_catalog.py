"""
Shared B2B product catalog definition.
Kept as pure data so multiple routers (b2b_orders, admin_b2b_settings, etc.)
can import without circular dependencies.
"""

# B2B Price is 76.52% of MRP
B2B_DISCOUNT_RATE = 0.7652


def calculate_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B box price at 76.52% of MRP."""
    return round(units_per_box * mrp_per_unit * B2B_DISCOUNT_RATE)


def calculate_half_box_price(units_per_box: int, mrp_per_unit: float) -> int:
    """Calculate B2B half-box price at 76.52% of MRP."""
    return round((units_per_box / 2) * mrp_per_unit * B2B_DISCOUNT_RATE)


B2B_PRODUCTS = [
    {
        "id": "kesar-chandan-b2b",
        "product_id": "kesar-chandan",
        "name": "Kesar Chandan",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "kesar-chandan-200-b2b",
        "product_id": "kesar-chandan",
        "name": "Kesar Chandan",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "regal-rose-b2b",
        "product_id": "regal-rose",
        "name": "Regal Rose",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "regal-rose-200-b2b",
        "product_id": "regal-rose",
        "name": "Regal Rose",
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "oriental-oudh-b2b",
        "product_id": "oriental-oudh",
        "name": "Oriental Oudh",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "oriental-oudh-200-b2b",
        "product_id": "oriental-oudh",
        "name": "Oriental Oudh",
        "image": "https://images.unsplash.com/photo-1600369671738-fa4e8244d49d?w=400",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "bold-bakhoor-b2b",
        "product_id": "bold-bakhoor",
        "name": "Bold Bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900",
    },
    {
        "id": "bold-bakhoor-200-b2b",
        "product_id": "bold-bakhoor",
        "name": "Bold Bakhoor",
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 18,
        "hsn_code": "33074900",
    },
    {
        "id": "mogra-magic-b2b",
        "product_id": "mogra-magic",
        "name": "Mogra Magic",
        "image": "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
        "net_weight": "50g",
        "units_per_box": 12,
        "mrp_per_unit": 110,
        "price_per_box": calculate_box_price(12, 110),
        "price_per_half_box": calculate_half_box_price(12, 110),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
    {
        "id": "mogra-magic-200-b2b",
        "product_id": "mogra-magic",
        "name": "Mogra Magic",
        "image": "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=400",
        "net_weight": "200g",
        "units_per_box": 16,
        "mrp_per_unit": 402,
        "price_per_box": calculate_box_price(16, 402),
        "price_per_half_box": calculate_half_box_price(16, 402),
        "min_order": 0.5,
        "gst_rate": 5,
        "hsn_code": "33074100",
    },
]


def find_b2b_product(b2b_product_id: str):
    """Return the B2B product dict by id, or None."""
    for p in B2B_PRODUCTS:
        if p["id"] == b2b_product_id:
            return p
    return None
