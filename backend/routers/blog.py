"""Blog routes"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Cookie
from typing import Optional
from datetime import datetime, timezone
import re

from models.content import BlogPostCreate
from services.email_service import send_blog_notification
from dependencies import db, require_admin

router = APIRouter(tags=["Blog"])


def slugify(text: str) -> str:
    """Create URL-friendly slug from text"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


# Public blog routes
@router.get("/blog/posts")
async def get_blog_posts(skip: int = 0, limit: int = 10, tag: Optional[str] = None):
    """Get published blog posts"""
    query = {"is_published": True}
    if tag:
        query["tags"] = tag
    
    posts = await db.blog_posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        post.pop("_id", None)
    
    total = await db.blog_posts.count_documents(query)
    
    return {"posts": posts, "total": total}


@router.get("/blog/posts/{slug}")
async def get_blog_post(slug: str):
    """Get a single blog post by slug"""
    post = await db.blog_posts.find_one({"slug": slug, "is_published": True})
    
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    # Increment views
    await db.blog_posts.update_one(
        {"slug": slug},
        {"$inc": {"views": 1}}
    )
    
    post.pop("_id", None)
    return post


# Admin blog routes
@router.get("/admin/blog/posts")
async def admin_get_blog_posts(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get all blog posts (admin)"""
    await require_admin(request, session_token)
    
    posts = await db.blog_posts.find({}).sort("created_at", -1).to_list(100)
    for post in posts:
        post.pop("_id", None)
    
    return {"posts": posts}


@router.post("/admin/blog/posts")
async def admin_create_blog_post(
    post_data: BlogPostCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Create a new blog post"""
    await require_admin(request, session_token)
    
    # Generate slug
    slug = slugify(post_data.title)
    
    # Ensure unique slug
    existing = await db.blog_posts.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    
    post = {
        "slug": slug,
        "title": post_data.title,
        "content": post_data.content,
        "excerpt": post_data.excerpt or post_data.content[:200] + "...",
        "author": post_data.author,
        "tags": post_data.tags or [],
        "featured_image": post_data.featured_image,
        "is_published": post_data.is_published,
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.blog_posts.insert_one(post)
    
    # Notify subscribers if published
    if post_data.is_published:
        subscribers = await db.subscribers.find({"is_active": True}).to_list(1000)
        for subscriber in subscribers:
            try:
                background_tasks.add_task(
                    send_blog_notification,
                    subscriber["email"],
                    subscriber.get("name", "Subscriber"),
                    post_data.title,
                    slug
                )
            except Exception as e:
                print(f"Failed to queue blog notification: {e}")
    
    post.pop("_id", None)
    return {"message": "Blog post created", "post": post}


@router.patch("/admin/blog/posts/{slug}")
async def admin_update_blog_post(
    slug: str,
    post_data: BlogPostCreate,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Update a blog post"""
    await require_admin(request, session_token)
    
    existing = await db.blog_posts.find_one({"slug": slug})
    if not existing:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    update_data = {
        "title": post_data.title,
        "content": post_data.content,
        "excerpt": post_data.excerpt or post_data.content[:200] + "...",
        "author": post_data.author,
        "tags": post_data.tags or [],
        "featured_image": post_data.featured_image,
        "is_published": post_data.is_published,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update slug if title changed
    new_slug = slugify(post_data.title)
    if new_slug != slug:
        # Check if new slug exists
        slug_exists = await db.blog_posts.find_one({"slug": new_slug})
        if not slug_exists:
            update_data["slug"] = new_slug
    
    await db.blog_posts.update_one({"slug": slug}, {"$set": update_data})
    
    updated_post = await db.blog_posts.find_one({"slug": update_data.get("slug", slug)})
    updated_post.pop("_id", None)
    
    return {"message": "Blog post updated", "post": updated_post}


@router.delete("/admin/blog/posts/{slug}")
async def admin_delete_blog_post(
    slug: str,
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Delete a blog post"""
    await require_admin(request, session_token)
    
    result = await db.blog_posts.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    return {"message": "Blog post deleted"}
