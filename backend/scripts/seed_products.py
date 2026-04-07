"""Seed script to populate products collection from hardcoded data"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

PRODUCTS_SEED = [
    {
        "id": "kesar-chandan",
        "name": "Kesar Chandan",
        "tagline": "Sacred Luxury Blend",
        "type": "agarbatti",
        "category": "agarbatti",
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
        "rating": 4.4,
        "reviews": 124,
        "comingSoon": False,
        "isActive": True,
    },
    {
        "id": "regal-rose",
        "name": "Regal Rose",
        "tagline": "Enchanting Floral Essence",
        "type": "agarbatti",
        "category": "agarbatti",
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
        "rating": 4.2,
        "reviews": 98,
        "comingSoon": False,
        "isActive": True,
    },
    {
        "id": "oriental-oudh",
        "name": "Oriental Oudh",
        "tagline": "Wood of the Gods",
        "type": "agarbatti",
        "category": "agarbatti",
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
        "rating": 4.5,
        "reviews": 156,
        "comingSoon": False,
        "isActive": True,
    },
    {
        "id": "bold-bakhoor",
        "name": "Bold Bakhoor",
        "tagline": "Traditional Essence",
        "type": "agarbatti",
        "category": "agarbatti",
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
        "rating": 4.1,
        "reviews": 87,
        "comingSoon": False,
        "isActive": True,
    },
    {
        "id": "mystical-meharishi",
        "name": "Mystical Meharishi",
        "tagline": "Bambooless Premium Dhoop",
        "type": "dhoop",
        "category": "dhoop",
        "bambooless": True,
        "description": "Experience the calming essence of Mystical Meharishi\u2014a bambooless premium dhoop with a uniquely light and soothing fragrance that gently fills your space. This artisanal blend creates a serene atmosphere perfect for meditation, relaxation, or unwinding after a long day. Each jar contains 100g of handcrafted dhoop sticks with an extra 25% FREE, plus a complimentary ceramic stand and safety matchbox (20 matches).",
        "notes": ["Light & Soothing", "Calming Essence", "Artisanal Blend"],
        "image": "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg",
        "burnTime": "25+ minutes (standard room temperature)",
        "sizes": [
            {"size": "125g", "sizeLabel": "100g + 25% Extra FREE", "mrp": 149, "price": 149, "weight": 175, "includes": ["Ceramic Stand", "Safety Matchbox (20 matches)"], "images": [
                "https://customer-assets.emergentagent.com/job_b8dea517-acc0-4dd1-9653-6404f629d64f/artifacts/4g68akgd_1000343235.jpg"
            ]}
        ],
        "rating": 4.3,
        "reviews": 42,
        "comingSoon": False,
        "isActive": True,
    },
    {
        "id": "grated-omani-bakhoor",
        "name": "Grated Omani Bakhoor",
        "tagline": "Traditional Arabian Luxury",
        "type": "bakhoor",
        "category": "bakhoor",
        "comingSoon": True,
        "description": "Immerse yourself in the rich, warm aroma of authentic Omani Bakhoor\u2014finely grated for a smooth, even burn. This premium bakhoor blend features aged oud chips infused with natural resins, musk, and floral extracts sourced from Oman's finest perfumers. Perfect for scenting your home, welcoming guests, or enhancing special occasions with an opulent, long-lasting fragrance that embodies Arabian hospitality.",
        "notes": ["Aged Oud", "Natural Resins", "Musk & Florals"],
        "image": "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/c15a934686343e84b679d1e8995844176bb7ed9247cdbcec7c33c8d52d441274.png",
        "burnTime": "30+ minutes on charcoal",
        "sizes": [
            {"size": "50g", "mrp": 249, "price": 249, "images": [
                "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/c15a934686343e84b679d1e8995844176bb7ed9247cdbcec7c33c8d52d441274.png"
            ]}
        ],
        "rating": 0,
        "reviews": 0,
        "isActive": True,
    },
    {
        "id": "yemeni-bakhoor-chips",
        "name": "Yemeni Bakhoor Chips",
        "tagline": "Exotic Handcrafted Fragrance",
        "type": "bakhoor",
        "category": "bakhoor",
        "comingSoon": True,
        "description": "Discover the exotic depth of Yemeni Bakhoor Chips\u2014hand-selected oud wood chips blended with rare Yemeni honey, saffron, and sandalwood oils. Each chip is carefully aged and infused using traditional methods passed down through generations. When heated, these chips release a rich, complex fragrance that lingers for hours, transforming any space into a haven of tranquility and sophistication.",
        "notes": ["Yemeni Oud", "Saffron & Honey", "Sandalwood"],
        "image": "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/dd9a7d855b4899a289beae6632de447a07a9612b171fe2d3fc85ff02e10b9713.png",
        "burnTime": "45+ minutes on charcoal",
        "sizes": [
            {"size": "40g", "mrp": 399, "price": 399, "images": [
                "https://static.prod-images.emergentagent.com/jobs/af48cbf1-bc52-4569-9f0b-819136e78a82/images/dd9a7d855b4899a289beae6632de447a07a9612b171fe2d3fc85ff02e10b9713.png"
            ]}
        ],
        "rating": 0,
        "reviews": 0,
        "isActive": True,
    }
]


async def seed_products():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Check if already seeded
    count = await db.products.count_documents({})
    if count > 0:
        print(f"Products collection already has {count} documents. Skipping seed.")
        client.close()
        return

    now = datetime.now(timezone.utc).isoformat()
    for p in PRODUCTS_SEED:
        p["created_at"] = now
        p["updated_at"] = now

    result = await db.products.insert_many(PRODUCTS_SEED)
    print(f"Seeded {len(result.inserted_ids)} products into MongoDB.")
    
    # Create index on id field
    await db.products.create_index("id", unique=True)
    print("Created unique index on products.id")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_products())
