"""Products and cart routes — reads from MongoDB with in-memory cache"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional

from models.ecommerce import CartItem
from dependencies import db

router = APIRouter(tags=["Products"])

# In-memory product cache — populated from MongoDB on startup and after admin CRUD
PRODUCTS: list[dict] = []

# Default product catalog — used to auto-seed an empty database
_DEFAULT_PRODUCTS = [
    {
        "id": "kesar-chandan", "name": "Kesar Chandan", "tagline": "Sacred Luxury Blend",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "A sacred luxury blend combining the divine warmth of saffron and nutmeg with pure sandalwood. This natural incense promotes tranquility, enhancing focus during mindfulness practices while creating an authentic aromatic ambiance.",
        "notes": ["Saffron", "Sandalwood", "Nutmeg"],
        "image": "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/kuzvgiue_KC_50%20gms_1.jpg",
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0a7ncpnf_KC_50%20gms_2.jpg"
            ]},
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/42b0wrdd_KC_200%20gms_1.jpg",
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/0q2xrv3z_KC_200%20gms_2.jpg",
                "https://customer-assets.emergentagent.com/job_premium-incense-2/artifacts/e3twm0ue_KC_200%20gms_3.jpg"
            ]}
        ],
        "rating": 4.4, "reviews": 124,
    },
    {
        "id": "regal-rose", "name": "Regal Rose", "tagline": "Enchanting Floral Essence",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "An exquisite aromatic blend featuring rose intertwined with enchanting and enduring scents of pink lotus and ylang ylang. Premium natural ingredients create a mesmerizing scent\u2014pure aromatic bliss for home aromatherapy.",
        "notes": ["Rose", "Pink Lotus", "Ylang Ylang"],
        "image": "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/7m9n9evq_Rose%20Packet%20%231.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/mmyk8kqb_Rose%20Packet%20%232.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/s9f85jos_Rose%20Packet%20%233.png"
            ]},
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/uyj26i1d_RR%20jar%201%201200px.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/m8u8mwug_RR%20jar%202%201200px.png",
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/bk5g54p5_RR%203%201200px.png"
            ]}
        ],
        "rating": 4.2, "reviews": 98,
    },
    {
        "id": "oriental-oudh", "name": "Oriental Oudh", "tagline": "Wood of the Gods",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "Experience authentic oudh fragrance\u2014the legendary wood of the gods. This premium scent features rich agarwood with warming notes of amber, creating an authentic oud ambiance with long lasting fragrance.",
        "notes": ["Agarwood", "Amber", "Vanilla"],
        "image": "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/svoqkq58_Architectural%20Oudh%20Shot.png",
                "https://customer-assets.emergentagent.com/job_a97378cd-15ad-4008-ac7f-564e8862eb85/artifacts/kwkdwh49_Dramatic%20Velvet%20Luxury.png"
            ]}
        ],
        "rating": 4.5, "reviews": 156,
    },
    {
        "id": "bold-bakhoor", "name": "Bold Bakhoor", "tagline": "Traditional Essence",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "A bold and aromatic blend of premium natural bhakhoor featuring oud bakhoor with traditional maghreb spiritual cleansing properties. This incense creates a heady scent with divine essence\u2014perfect as a thoughtful gift.",
        "notes": ["Oud Bakhoor", "Musk", "Amber"],
        "image": "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/w49zefo9_Bakhoor%20Packet%20%231.png",
                "https://customer-assets.emergentagent.com/job_434d883a-a02c-48ab-b964-a5cf2e94edda/artifacts/of3dxgh8_Bakhoor%20Packet%20%232.png"
            ]},
            {"size": "200g", "mrp": 402, "price": 402, "images": [
                "https://customer-assets.emergentagent.com/job_32618d6c-b353-4dca-9dd0-4057e45012d0/artifacts/p83sa6kl_bb%20jar%201%201200px.png"
            ]}
        ],
        "rating": 4.1, "reviews": 87,
    },
    {
        "id": "mystical-meharishi", "name": "Mystical Meharishi", "tagline": "Bambooless Premium Dhoop",
        "type": "dhoop", "category": "dhoop", "bambooless": True, "comingSoon": False, "isActive": True,
        "description": "Experience the calming essence of Mystical Meharishi\u2014a bambooless premium dhoop with a uniquely light and soothing fragrance that gently fills your space. This artisanal blend creates a serene atmosphere perfect for meditation, relaxation, or unwinding after a long day. Each jar contains 100g of handcrafted dhoop sticks with an extra 25% FREE, plus a complimentary ceramic stand and safety matchbox (20 matches).",
        "notes": ["Light & Soothing", "Calming Essence", "Artisanal Blend"],
        "image": "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg",
        "burnTime": "25+ minutes (standard room temperature)",
        "sizes": [
            {"size": "125g", "sizeLabel": "100g + 25% Extra FREE", "mrp": 149, "price": 149, "weight": 175,
             "includes": ["Ceramic Stand", "Safety Matchbox (20 matches)"],
             "images": ["https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg"]}
        ],
        "rating": 4.3, "reviews": 42,
    },
    {
        "id": "grated-omani-bakhoor", "name": "Grated Omani Bakhoor", "tagline": "Traditional Arabian Luxury",
        "type": "bakhoor", "category": "bakhoor", "comingSoon": False, "isActive": True,
        "description": "Immerse yourself in the rich, warm aroma of authentic Omani Bakhoor\u2014finely grated for a smooth, even burn. This premium bakhoor blend features aged oud chips infused with natural resins, musk, and floral extracts sourced from Oman\u2019s finest perfumers. Perfect for scenting your home, welcoming guests, or enhancing special occasions with an opulent, long-lasting fragrance that embodies Arabian hospitality.",
        "notes": ["Aged Oud", "Natural Resins", "Musk & Florals"],
        "image": "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/eqgfgt6l_1775558274726~2.png",
        "burnTime": "",
        "sizes": [
            {"size": "20g", "mrp": 249, "price": 249, "weight": 60, "images": [
                "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/eqgfgt6l_1775558274726~2.png",
                "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/qhr0ez3q_1775558450373~2.png",
                "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/ti83mjpn_Subtle%20Gold%20Gradient.png"
            ]}
        ],
        "rating": 4.9, "reviews": 7,
        "customerReviews": [
            {"name": "Arjun M.", "rating": 5, "date": "2026-03-28", "text": "The aroma fills my entire living room within minutes. Authentic Omani quality that I haven\u2019t found anywhere else online.", "verified": True},
            {"name": "Priya S.", "rating": 5, "date": "2026-03-25", "text": "Perfect for special occasions. Guests always ask what fragrance I\u2019m using. The grated form burns so evenly.", "verified": True},
            {"name": "Khalid R.", "rating": 5, "date": "2026-03-22", "text": "Reminds me of my family home in Muscat. Pure nostalgia in every chip. Will order again.", "verified": True},
            {"name": "Sneha D.", "rating": 5, "date": "2026-04-01", "text": "Ordered for Eid celebrations and it was perfect. Rich, warm scent that lingers for hours.", "verified": True},
            {"name": "Vikram T.", "rating": 4, "date": "2026-03-30", "text": "Beautiful fragrance, though the pouch could be slightly larger for the price. Still a solid buy.", "verified": True},
            {"name": "Meera K.", "rating": 5, "date": "2026-04-03", "text": "Excellent quality bakhoor at a very fair price. The resin and musk notes are divine.", "verified": True},
            {"name": "Rohan P.", "rating": 5, "date": "2026-04-05", "text": "Gifted this to my mother and she absolutely loved it. Premium packaging too.", "verified": True},
        ],
    },
    {
        "id": "yemeni-bakhoor-chips", "name": "Yemeni Bakhoor Chips", "tagline": "Exotic Handcrafted Fragrance",
        "type": "bakhoor", "category": "bakhoor", "comingSoon": False, "isActive": True,
        "description": "Discover the exotic depth of Yemeni Bakhoor Chips\u2014hand-selected oud wood chips blended with rare Yemeni honey, saffron, and sandalwood oils. Each chip is carefully aged and infused using traditional methods passed down through generations. When heated, these chips release a rich, complex fragrance that lingers for hours, transforming any space into a haven of tranquility and sophistication.",
        "notes": ["Yemeni Oud", "Saffron & Honey", "Sandalwood"],
        "image": "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/qhiw57tk_1775558078557~2.png",
        "burnTime": "",
        "sizes": [
            {"size": "20g", "mrp": 399, "price": 399, "weight": 60, "images": [
                "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/qhiw57tk_1775558078557~2.png",
                "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/7h7la1j0_1775558838323~2.png",
                "https://customer-assets.emergentagent.com/job_af48cbf1-bc52-4569-9f0b-819136e78a82/artifacts/2vfe27zm_1775558604718~2.png"
            ]}
        ],
        "rating": 4.8, "reviews": 5,
        "customerReviews": [
            {"name": "Aisha N.", "rating": 5, "date": "2026-03-26", "text": "The depth of this fragrance is unmatched. True Yemeni craftsmanship\u2014each chip releases a complex, layered scent.", "verified": True},
            {"name": "Sameer J.", "rating": 5, "date": "2026-03-29", "text": "Worth every rupee. The saffron and honey notes come through beautifully when heated.", "verified": True},
            {"name": "Fatima B.", "rating": 5, "date": "2026-04-02", "text": "Perfect for meditation and unwinding after work. The sandalwood base note is so calming.", "verified": True},
            {"name": "Karthik V.", "rating": 4, "date": "2026-03-31", "text": "Lovely fragrance but chips burn a bit quickly. Still highly recommend for the quality.", "verified": True},
            {"name": "Nadia H.", "rating": 5, "date": "2026-04-04", "text": "Gift this to anyone who appreciates authentic Arabian bakhoor. My husband was thrilled!", "verified": True},
        ],
    },
    {
        "id": "bilvapatra-fragrance", "name": "Belpatra", "tagline": "Sacred Bael Leaf Essence",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": True, "isActive": True,
        "description": "Experience the divine fragrance of Belpatra\u2014a sacred blend inspired by the revered bael leaf, offered in traditional worship to Lord Shiva. This premium agarbatti captures the essence of spiritual devotion with earthy, herbal notes blended with subtle floral undertones. Each stick creates a purifying atmosphere that elevates your daily rituals and meditation practices.",
        "notes": ["Bael Leaf", "Sacred Herbs", "Subtle Florals"],
        "image": "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/82eb095d8e73cc34f8daa37d10cebfc02578fa81cd77d69238cc06a2fa3c22c6.png",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/82eb095d8e73cc34f8daa37d10cebfc02578fa81cd77d69238cc06a2fa3c22c6.png"
            ]}
        ],
        "rating": 0, "reviews": 0,
    },
    {
        "id": "royal-kewda", "name": "Royal Kewda", "tagline": "Exotic Floral Paradise",
        "type": "agarbatti", "category": "agarbatti", "comingSoon": False, "isActive": True,
        "description": "Indulge in the captivating aroma of Royal Kewda\u2014a premium agarbatti inspired by the rare and intoxicating pandanus flower, treasured for centuries in Indian perfumery. This exotic blend weaves together sweet floral kewda with delicate hints of jasmine and white musk, creating a lush, long-lasting fragrance that transforms any space into a floral sanctuary. Perfect for daily rituals, evening relaxation, or gifting to someone who appreciates rare botanical scents.",
        "notes": ["Kewda", "Jasmine", "White Musk"],
        "image": "https://images.unsplash.com/photo-1627769916425-74c2344a3439?w=800&q=80",
        "burnTime": "40+ minutes",
        "sizes": [
            {"size": "50g", "mrp": 110, "price": 110, "images": [
                "https://images.unsplash.com/photo-1627769916425-74c2344a3439?w=800&q=80",
                "https://images.unsplash.com/photo-1613750255797-7d4f877615df?w=800&q=80"
            ]}
        ],
        "rating": 0, "reviews": 0,
    }
]


async def _seed_default_products():
    """Auto-seed the products collection when it's empty (first deploy / fresh database)."""
    import logging
    logger = logging.getLogger(__name__)
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for p in _DEFAULT_PRODUCTS:
        doc = {**p, "created_at": now, "updated_at": now}
        docs.append(doc)
    try:
        await db.products.insert_many(docs)
        await db.products.create_index("id", unique=True)
        logger.info(f"Auto-seeded {len(docs)} products into MongoDB")
    except Exception as e:
        logger.error(f"Auto-seed failed: {e}")


async def _migrate_products():
    """Apply any pending data migrations to existing products."""
    import logging
    logger = logging.getLogger(__name__)

    # Migration: Bakhoor sizes 50g/40g → 20g with weight=60, remove burnTime
    migrations = [
        {
            "filter": {"id": "grated-omani-bakhoor", "sizes.size": {"$ne": "20g"}},
            "update": {"$set": {
                "sizes": _DEFAULT_PRODUCTS[5]["sizes"],
                "image": _DEFAULT_PRODUCTS[5]["image"],
                "burnTime": "",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
        {
            "filter": {"id": "yemeni-bakhoor-chips", "sizes.size": {"$ne": "20g"}},
            "update": {"$set": {
                "sizes": _DEFAULT_PRODUCTS[6]["sizes"],
                "image": _DEFAULT_PRODUCTS[6]["image"],
                "burnTime": "",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    ]

    # Migration: Update Grated Omani images from placeholder to real product photos
    img_migrations = [
        {
            "filter": {"id": "grated-omani-bakhoor", "image": {"$regex": "static.prod-images"}},
            "update": {"$set": {
                "image": _DEFAULT_PRODUCTS[5]["image"],
                "sizes": _DEFAULT_PRODUCTS[5]["sizes"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    ]

    # Migration: Make both Bakhoor variants available (remove comingSoon)
    launch_migrations = [
        {
            "filter": {"id": "grated-omani-bakhoor", "comingSoon": True},
            "update": {"$set": {"comingSoon": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
        },
        {
            "filter": {"id": "yemeni-bakhoor-chips", "comingSoon": True},
            "update": {"$set": {
                "comingSoon": False,
                "image": _DEFAULT_PRODUCTS[6]["image"],
                "sizes": _DEFAULT_PRODUCTS[6]["sizes"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    ]

    # Migration: Add new Coming Soon products if they don't exist
    new_products = [
        {"id": "bilvapatra-fragrance", "data": _DEFAULT_PRODUCTS[7]},
        {"id": "royal-kewda", "data": _DEFAULT_PRODUCTS[8]},
    ]
    for np in new_products:
        exists = await db.products.find_one({"id": np["id"]})
        if not exists:
            doc = {**np["data"], "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
            await db.products.insert_one(doc)
            logger.info(f"Added new product: {np['id']}")

    # Migration (Iter82): Delete 8" Bambooless Dhoop everywhere and rename
    # `bilvapatra-fragrance` display name to "Belpatra" (slug stays for URL
    # stability so old shares/links keep working).
    try:
        # 1. Hard-delete bambooless dhoop (b2c + linked b2b SKUs + Supabase
        # mirror). ALWAYS attempt the Supabase delete — orphans can slip
        # in via racy backfills or manual pytest runs, so we treat this as
        # a self-healing tombstone that runs on every boot.
        bambooless_slug = "bambooless-dhoop-8inch"
        await db.products.delete_many({"id": bambooless_slug})
        b2b_ids = [
            r["id"]
            for r in await db.b2b_products.find(
                {"product_id": bambooless_slug}, {"_id": 0, "id": 1}
            ).to_list(20)
        ]
        await db.b2b_products.delete_many({"product_id": bambooless_slug})
        try:
            from services.supabase_sync import mirror_product_delete
            mirror_product_delete(bambooless_slug)
            # Belt-and-braces: try common size variants too, even if not in Mongo.
            for size in ("50g", "100g", "150g", "200g", "500g", "1kg"):
                mirror_product_delete(f"{bambooless_slug}-{size}-b2b")
            for sid in b2b_ids:
                mirror_product_delete(sid)
        except Exception:  # noqa: BLE001
            pass
        logger.info(
            "Iter82 tombstone: purged %s + %d linked b2b SKUs",
            bambooless_slug, len(b2b_ids),
        )

        # 2. Rename display name (all touch-points that reference this slug).
        # Guarded independently of the b2c name so the b2b propagation
        # still runs on re-boot even if the b2c doc is already renamed.
        b2c_doc = await db.products.find_one({"id": "bilvapatra-fragrance"}, {"_id": 0})
        if b2c_doc:
            if b2c_doc.get("name") != "Belpatra":
                await db.products.update_one(
                    {"id": "bilvapatra-fragrance"},
                    {"$set": {
                        "name": "Belpatra",
                        "description": _DEFAULT_PRODUCTS[7]["description"],
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                b2c_doc["name"] = "Belpatra"
                b2c_doc["description"] = _DEFAULT_PRODUCTS[7]["description"]

            # Propagate name to any derived B2B SKUs (auto-mirrored via
            # product_sync.build_b2b_sku, which copies b2c product['name']).
            stale = await db.b2b_products.find_one(
                {"product_id": "bilvapatra-fragrance", "name": {"$ne": "Belpatra"}},
                {"_id": 0, "id": 1},
            )
            if stale:
                try:
                    from services.product_sync import mirror_b2c_product
                    await mirror_b2c_product(db, b2c_doc)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Iter82 B2B rename propagation failed: %s", exc)

            # Re-mirror B2C row so Supabase reflects the new name (hydrate
            # stock from linked B2B SKUs first — otherwise the raw Mongo
            # doc has no sizes[].stock and would null the mirror column).
            try:
                from services.product_sync import enrich_b2c_products_with_stock
                b2b_rows = await db.b2b_products.find(
                    {"product_id": "bilvapatra-fragrance"}, {"_id": 0}
                ).to_list(20)
                enrich_b2c_products_with_stock([b2c_doc], b2b_rows)
                from services.supabase_sync import mirror_product_upsert
                mirror_product_upsert(b2c_doc, channel="b2c")
            except Exception:  # noqa: BLE001
                pass
            logger.info("Iter82 migration: bilvapatra-fragrance → Belpatra (+ B2B SKUs)")

        # 3. Purge legacy mogra-magic orphan mirror rows (pre-iter82)
        try:
            from services.supabase_sync import mirror_product_delete
            for orphan_id in ("mogra-magic", "mogra-magic-b2b", "mogra-magic-200-b2b"):
                mirror_product_delete(orphan_id)
        except Exception:  # noqa: BLE001
            pass
    except Exception as exc:  # noqa: BLE001
        logger.warning("Iter82 rename/delete migration failed: %s", exc)

    # Migration: Add initial ratings/reviews for Bakhoor products (recently launched)
    rating_migrations = [
        {
            "filter": {"id": "grated-omani-bakhoor", "rating": {"$in": [0, None]}},
            "update": {"$set": {"rating": 4.9, "reviews": 7, "updated_at": datetime.now(timezone.utc).isoformat()}},
        },
        {
            "filter": {"id": "yemeni-bakhoor-chips", "rating": {"$in": [0, None]}},
            "update": {"$set": {"rating": 4.8, "reviews": 5, "updated_at": datetime.now(timezone.utc).isoformat()}},
        },
    ]

    # Migration: Add customer reviews for Bakhoor products
    review_migrations = [
        {
            "filter": {"id": "grated-omani-bakhoor", "$or": [{"customerReviews": {"$exists": False}}, {"customerReviews": {"$size": 0}}]},
            "update": {"$set": {
                "customerReviews": _DEFAULT_PRODUCTS[5].get("customerReviews", []),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
        {
            "filter": {"id": "yemeni-bakhoor-chips", "$or": [{"customerReviews": {"$exists": False}}, {"customerReviews": {"$size": 0}}]},
            "update": {"$set": {
                "customerReviews": _DEFAULT_PRODUCTS[6].get("customerReviews", []),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        },
    ]

    for m in migrations + img_migrations + launch_migrations + rating_migrations + review_migrations:
        try:
            result = await db.products.update_one(m["filter"], m["update"])
            if result.modified_count > 0:
                logger.info(f"Migrated product matching {m['filter']}")
        except Exception as e:
            logger.error(f"Migration failed for {m['filter']}: {e}")


async def refresh_products_cache():
    """Reload products from MongoDB into the module-level cache.
    Auto-seeds if empty, runs migrations on existing data.
    """
    import logging
    logger = logging.getLogger(__name__)
    global PRODUCTS
    try:
        count = await db.products.count_documents({})
        logger.info(f"Products in DB: {count}")
        if count == 0:
            await _seed_default_products()
        else:
            await _migrate_products()
        cursor = db.products.find({}, {"_id": 0})
        PRODUCTS[:] = await cursor.to_list(length=500)
        logger.info(f"Products cache loaded: {len(PRODUCTS)} items")
    except Exception as e:
        logger.error(f"refresh_products_cache failed: {e}")
        # Fallback: use defaults if DB is unreachable
        if not PRODUCTS:
            PRODUCTS[:] = [{k: v for k, v in p.items()} for p in _DEFAULT_PRODUCTS]
            logger.warning(f"Using {len(PRODUCTS)} default products as fallback")


async def ensure_products_loaded():
    """Ensure cache is populated (lazy init for first request)."""
    if not PRODUCTS:
        await refresh_products_cache()


@router.get("/products")
async def get_products(preview: Optional[str] = None):
    """Get all active products with unified stock from the B2B inventory pool.

    Founding Retailer Early-Access: SKUs with `early_access_until > now` are
    hidden from the public list. A valid `preview` token (as generated by
    `services.product_launch.sign_preview_token`) reveals the matching SKU.
    """
    await ensure_products_loaded()
    from services.product_launch import (
        is_in_early_access, verify_preview_token, early_access_hint,
    )
    preview_pid = verify_preview_token(preview) if preview else None

    result = []
    hints = []
    for p in PRODUCTS:
        if not p.get("isActive", True):
            continue
        if is_in_early_access(p):
            # SKU is in the hidden window — only surface if the caller has a
            # valid preview token that matches this exact product_id.
            if preview_pid == p["id"]:
                result.append(p)
            else:
                hints.append(early_access_hint(p))
            continue
        result.append(p)

    try:
        from services.product_sync import enrich_b2c_products_with_stock
        b2b_rows = await db.b2b_products.find({}, {"_id": 0}).to_list(500)
        enrich_b2c_products_with_stock(result, b2b_rows)
    except Exception:
        pass

    # If any early-access hints exist, stitch them onto the tail so the
    # storefront can render "🌸 Coming soon" placeholders. Retailers with
    # a preview token still see the full product.
    for h in hints:
        result.append({
            "id": h["product_id"],
            "name": h["name"],
            "coming_soon": True,
            "available_from": h["available_from"],
            "teaser": h["message"],
            "isActive": True,
            "sizes": [],
        })
    return result


@router.get("/products/{product_id}")
async def get_product(product_id: str, preview: Optional[str] = None):
    """Get a single product by ID with unified stock enrichment.
    Founding Retailer Early-Access respected: hidden SKU returns 404 unless
    a valid `preview` token for this product is supplied."""
    await ensure_products_loaded()
    from services.product_launch import is_in_early_access, verify_preview_token
    for product in PRODUCTS:
        if product["id"] == product_id:
            if is_in_early_access(product):
                if verify_preview_token(preview) != product_id:
                    raise HTTPException(status_code=404, detail="Product not found")
            try:
                from services.product_sync import enrich_b2c_products_with_stock
                b2b_rows = await db.b2b_products.find(
                    {"product_id": product_id}, {"_id": 0}
                ).to_list(50)
                enrich_b2c_products_with_stock([product], b2b_rows)
            except Exception:
                pass
            return product
    raise HTTPException(status_code=404, detail="Product not found")


@router.get("/preview/resolve/{token}")
async def resolve_preview_token(token: str):
    """Frontend calls this from the /preview/{token} landing page to
    exchange a signed token for the product to spotlight."""
    from services.product_launch import verify_preview_token
    pid = verify_preview_token(token)
    if not pid:
        raise HTTPException(status_code=404, detail="Preview link expired or invalid.")
    await ensure_products_loaded()
    for product in PRODUCTS:
        if product["id"] == pid:
            try:
                from services.product_sync import enrich_b2c_products_with_stock
                b2b_rows = await db.b2b_products.find(
                    {"product_id": pid}, {"_id": 0}
                ).to_list(50)
                enrich_b2c_products_with_stock([product], b2b_rows)
            except Exception:
                pass
            return {"product": product, "product_id": pid}
    raise HTTPException(status_code=404, detail="Product not found.")


def calculate_pricing(items: list, city: str = None, pincode: str = None):
    """Calculate order pricing with weight-based shipping and zone-based free shipping"""
    from services.shipping_config import get_free_shipping_threshold

    subtotal = 0
    mrp_total = 0
    total_weight = 0  # in grams

    for item in items:
        product = next((p for p in PRODUCTS if p["id"] == item.get("productId")), None)
        if product:
            size_info = next((s for s in product["sizes"] if s["size"] == item.get("size")), None)
            if size_info:
                quantity = item.get("quantity", 1)
                subtotal += size_info["price"] * quantity
                mrp_total += size_info["mrp"] * quantity

                # Weight calculation
                if "weight" in size_info:
                    item_weight = size_info["weight"]
                elif item.get("size") == "20g":
                    item_weight = 60
                elif item.get("size") == "50g":
                    item_weight = 70
                elif item.get("size") == "125g":
                    item_weight = 175
                else:
                    item_weight = 270
                total_weight += item_weight * quantity

    # Bulk discount
    bulk_discount = 0
    bulk_discount_percent = 0
    if subtotal > 4999:
        bulk_discount_percent = 10
        bulk_discount = subtotal * 0.10
    elif subtotal > 2499:
        bulk_discount_percent = 5
        bulk_discount = subtotal * 0.05

    # Shipping
    if pincode:
        threshold_info = get_free_shipping_threshold(pincode)
        free_shipping_threshold = threshold_info.get("threshold")
        free_shipping_available = threshold_info.get("free_shipping_available", False)

        if free_shipping_available and free_shipping_threshold is not None and subtotal >= free_shipping_threshold:
            shipping = 0
        else:
            shipping_units = -(-total_weight // 250)
            shipping = shipping_units * 30
    else:
        if subtotal >= 2999:
            shipping = 0
        else:
            shipping_units = -(-total_weight // 250)
            shipping = shipping_units * 30

    discount_from_mrp = mrp_total - subtotal
    final_total = subtotal - bulk_discount + shipping

    return {
        "mrp_total": round(mrp_total, 2),
        "subtotal": round(subtotal, 2),
        "discount_from_mrp": round(discount_from_mrp, 2),
        "bulk_discount": round(bulk_discount, 2),
        "bulk_discount_percent": bulk_discount_percent,
        "shipping": round(shipping, 2),
        "total_weight_grams": total_weight,
        "total": round(final_total, 2)
    }


# ===================== Cart Routes =====================

@router.get("/cart/{session_id}")
async def get_cart(session_id: str):
    """Get cart for a session"""
    await ensure_products_loaded()
    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        return {
            "session_id": session_id,
            "items": [],
            "pricing": calculate_pricing([])
        }

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart.get("items", []))
    return cart


@router.post("/cart/{session_id}/add")
async def add_to_cart(session_id: str, item: CartItem):
    """Add item to cart"""
    await ensure_products_loaded()

    product = next((p for p in PRODUCTS if p["id"] == item.productId), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.get("comingSoon"):
        raise HTTPException(status_code=400, detail="This product is coming soon and cannot be added to cart yet")

    size_info = next((s for s in product["sizes"] if s["size"] == item.size), None)
    if not size_info:
        raise HTTPException(status_code=400, detail="Invalid size")

    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        cart = {
            "session_id": session_id,
            "items": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

    existing_item = None
    for i, cart_item in enumerate(cart.get("items", [])):
        if cart_item["productId"] == item.productId and cart_item["size"] == item.size:
            existing_item = i
            break

    if existing_item is not None:
        cart["items"][existing_item]["quantity"] += item.quantity
    else:
        cart["items"].append({
            "productId": item.productId,
            "name": product["name"],
            "size": item.size,
            "price": size_info["price"],
            "mrp": size_info["mrp"],
            "quantity": item.quantity,
            "image": product["image"]
        })

    cart["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.carts.update_one(
        {"session_id": session_id},
        {"$set": cart},
        upsert=True
    )

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart["items"])
    return cart


@router.put("/cart/{session_id}/item/{productId}/{size}")
async def update_cart_item(session_id: str, productId: str, size: str, quantity: int):
    """Update cart item quantity"""
    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    item_found = False
    for i, item in enumerate(cart.get("items", [])):
        if item["productId"] == productId and item["size"] == size:
            if quantity <= 0:
                cart["items"].pop(i)
            else:
                cart["items"][i]["quantity"] = quantity
            item_found = True
            break

    if not item_found:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    cart["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.carts.update_one(
        {"session_id": session_id},
        {"$set": cart}
    )

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart["items"])
    return cart


@router.delete("/cart/{session_id}/item/{productId}/{size}")
async def remove_from_cart(session_id: str, productId: str, size: str):
    """Remove item from cart"""
    cart = await db.carts.find_one({"session_id": session_id})

    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    original_length = len(cart.get("items", []))
    cart["items"] = [
        item for item in cart.get("items", [])
        if not (item["productId"] == productId and item["size"] == size)
    ]

    if len(cart["items"]) == original_length:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    cart["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.carts.update_one(
        {"session_id": session_id},
        {"$set": cart}
    )

    cart.pop("_id", None)
    cart["pricing"] = calculate_pricing(cart["items"])
    return cart


@router.delete("/cart/{session_id}")
async def clear_cart(session_id: str):
    """Clear all items from cart"""
    await db.carts.delete_one({"session_id": session_id})

    return {
        "session_id": session_id,
        "items": [],
        "pricing": calculate_pricing([]),
        "message": "Cart cleared"
    }



# ---------------------------------------------------------------------------
# Product image proxy — pulled from Emergent object storage.
# Kept public so <img src="/api/products/asset/{id}"> just works from any
# surface (storefront, brochure, retailer catalog).
# ---------------------------------------------------------------------------
@router.get("/products/asset/{asset_id}")
async def get_product_asset(asset_id: str):
    from services.object_storage import get_object

    record = await db.product_assets.find_one(
        {"id": asset_id, "is_deleted": False}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Asset not found")
    fetched = await get_object(record["storage_path"])
    if not fetched:
        raise HTTPException(status_code=502, detail="Failed to fetch asset")
    data, ctype = fetched
    return Response(
        content=data,
        media_type=record.get("content_type") or ctype,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
