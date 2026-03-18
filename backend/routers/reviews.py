"""Product reviews routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import uuid

from models.users import ReviewCreate
from dependencies import db, require_admin, require_auth

router = APIRouter(tags=["Reviews"])


@router.get("/products/{product_id}/reviews")
async def get_product_reviews(product_id: str):
    """Get approved reviews for a product"""
    reviews = await db.reviews.find({
        "product_id": product_id,
        "is_approved": True
    }).sort("created_at", -1).to_list(100)
    
    for review in reviews:
        review.pop("_id", None)
    
    # Calculate average rating
    if reviews:
        avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    else:
        avg_rating = 4.2  # Default rating
    
    return {
        "reviews": reviews,
        "total": len(reviews),
        "average_rating": round(avg_rating, 1)
    }


@router.post("/products/{product_id}/reviews")
async def create_review(
    product_id: str,
    review_data: ReviewCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Create a product review (requires verified purchase)"""
    user = await require_auth(request, session_token)
    
    # Check if user has purchased this product
    user_orders = await db.orders.find({
        "$or": [
            {"user_id": user['user_id']},
            {"shipping.email": user['email'].lower()}
        ],
        "payment_status": "completed"
    }).to_list(100)
    
    has_purchased = False
    for order in user_orders:
        for item in order.get("items", []):
            if item.get("productId") == product_id:
                has_purchased = True
                break
        if has_purchased:
            break
    
    if not has_purchased:
        raise HTTPException(
            status_code=403, 
            detail="You can only review products you have purchased"
        )
    
    # Check if user already reviewed this product
    existing_review = await db.reviews.find_one({
        "product_id": product_id,
        "user_id": user['user_id']
    })
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this product")
    
    review = {
        "review_id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": user['user_id'],
        "user_name": user.get('name', user['email'].split('@')[0]),
        "user_email": user['email'],
        "rating": review_data.rating,
        "title": review_data.title,
        "comment": review_data.comment,
        "is_approved": False,  # Requires admin approval
        "is_verified_purchase": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    
    return {
        "message": "Review submitted for approval",
        "review": review
    }


# Admin review routes
@router.get("/admin/reviews")
async def admin_get_reviews(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    status: Optional[str] = None
):
    """Get all reviews (admin)"""
    await require_admin(request, session_token)
    
    query = {}
    if status == "pending":
        query["is_approved"] = False
    elif status == "approved":
        query["is_approved"] = True
    
    reviews = await db.reviews.find(query).sort("created_at", -1).to_list(100)
    for review in reviews:
        review.pop("_id", None)
    
    return {"reviews": reviews}


@router.patch("/admin/reviews/{review_id}/status")
async def admin_update_review_status(
    review_id: str,
    approved: bool,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Approve or reject a review"""
    await require_admin(request, session_token)
    
    result = await db.reviews.update_one(
        {"review_id": review_id},
        {"$set": {
            "is_approved": approved,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return {
        "message": f"Review {'approved' if approved else 'rejected'}",
        "review_id": review_id
    }


@router.get("/reviews/order/{order_number}")
async def get_order_products_for_review(order_number: str, email: str):
    """Get products from an order that can be reviewed"""
    # Find the order
    order = await db.orders.find_one({
        "order_number": order_number,
        "shipping.email": email.lower()
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if order is delivered
    if order.get("order_status") != "delivered":
        raise HTTPException(status_code=400, detail="You can only review products from delivered orders")
    
    items = order.get("items", [])
    products_to_review = []
    
    for item in items:
        product_id = item.get("productId", "")
        # Check if already reviewed
        existing_review = await db.reviews.find_one({
            "product_id": product_id,
            "order_number": order_number
        })
        
        products_to_review.append({
            "productId": product_id,
            "name": item.get("name", ""),
            "size": item.get("size", ""),
            "image": item.get("image", ""),
            "already_reviewed": existing_review is not None
        })
    
    return {
        "order_number": order_number,
        "customer_name": order.get("shipping", {}).get("name", ""),
        "products": products_to_review
    }


@router.post("/reviews/order/{order_number}")
async def submit_order_review(
    order_number: str,
    review_data: ReviewCreate,
    email: str
):
    """Submit a review for a product from an order (no login required, uses order+email verification)"""
    # Find the order
    order = await db.orders.find_one({
        "order_number": order_number,
        "shipping.email": email.lower()
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or email doesn't match")
    
    # Check if order is delivered
    if order.get("order_status") != "delivered":
        raise HTTPException(status_code=400, detail="You can only review products from delivered orders")
    
    # Check if product is in the order
    product_in_order = False
    for item in order.get("items", []):
        if item.get("productId") == review_data.productId:
            product_in_order = True
            break
    
    if not product_in_order:
        raise HTTPException(status_code=403, detail="This product was not in your order")
    
    # Check if already reviewed
    existing_review = await db.reviews.find_one({
        "product_id": review_data.productId,
        "order_number": order_number
    })
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this product for this order")
    
    customer_name = order.get("shipping", {}).get("name", email.split('@')[0])
    
    review = {
        "review_id": str(uuid.uuid4()),
        "product_id": review_data.productId,
        "order_number": order_number,
        "user_email": email.lower(),
        "user_name": customer_name,
        "rating": review_data.rating,
        "title": review_data.title,
        "comment": review_data.comment,
        "is_approved": False,  # Requires admin approval
        "is_verified_purchase": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    
    return {
        "message": "Thank you! Your review has been submitted and is pending approval.",
        "review": review
    }
