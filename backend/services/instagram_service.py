"""
Instagram Graph API Service
Fetches media from your Instagram Business/Creator account for website display.

Setup:
1. Create a Meta Developer App at https://developers.facebook.com
2. Add Instagram product → API setup with Instagram business login
3. Generate a long-lived token (60 days) for your business account
4. Add INSTAGRAM_ACCESS_TOKEN to backend/.env
5. Set up token refresh (tokens expire in 60 days)

Required Permission: instagram_business_basic
"""

import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Instagram Graph API base URL
INSTAGRAM_GRAPH_API = "https://graph.instagram.com"

# Get credentials from environment
INSTAGRAM_ACCESS_TOKEN = os.environ.get("INSTAGRAM_ACCESS_TOKEN")

# MongoDB connection for caching
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "addrika_db")


class InstagramService:
    """Service to fetch Instagram media for website display"""
    
    def __init__(self):
        self.access_token = INSTAGRAM_ACCESS_TOKEN
        self.db_client = None
        self.db = None
        self._user_id = None
        self._cache_duration = timedelta(hours=1)  # Cache posts for 1 hour
    
    async def _get_db(self):
        """Get database connection"""
        if self.db is None:
            self.db_client = AsyncIOMotorClient(MONGO_URL)
            self.db = self.db_client[DB_NAME]
        return self.db
    
    def is_configured(self) -> bool:
        """Check if Instagram token is configured"""
        return bool(self.access_token) and self.access_token != "your_token_here"
    
    async def get_user_info(self) -> Optional[Dict[str, Any]]:
        """
        Get Instagram user profile info.
        Returns user_id, username, account_type, media_count, etc.
        """
        if not self.is_configured():
            logger.warning("Instagram access token not configured")
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{INSTAGRAM_GRAPH_API}/me",
                    params={
                        "fields": "user_id,username,name,account_type,profile_picture_url,media_count,followers_count",
                        "access_token": self.access_token
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self._user_id = data.get("user_id")
                    return data
                else:
                    logger.error(f"Instagram API error: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Failed to get Instagram user info: {str(e)}")
            return None
    
    async def get_media(self, limit: int = 12) -> List[Dict[str, Any]]:
        """
        Fetch recent media posts from Instagram.
        
        Args:
            limit: Number of posts to fetch (max 25)
            
        Returns:
            List of media objects with id, caption, media_type, media_url, permalink, timestamp
        """
        if not self.is_configured():
            logger.warning("Instagram access token not configured")
            return []
        
        # Check cache first
        cached = await self._get_cached_media()
        if cached:
            return cached[:limit]
        
        try:
            # Get user ID if not already fetched
            if not self._user_id:
                user_info = await self.get_user_info()
                if not user_info:
                    return []
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{INSTAGRAM_GRAPH_API}/{self._user_id}/media",
                    params={
                        "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type}",
                        "limit": min(limit, 25),
                        "access_token": self.access_token
                    },
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    media_list = data.get("data", [])
                    
                    # Process and format media
                    formatted_media = []
                    for item in media_list:
                        formatted_item = {
                            "id": item.get("id"),
                            "caption": item.get("caption", ""),
                            "media_type": item.get("media_type"),  # IMAGE, VIDEO, CAROUSEL_ALBUM
                            "media_url": item.get("media_url"),
                            "thumbnail_url": item.get("thumbnail_url"),  # For videos
                            "permalink": item.get("permalink"),
                            "timestamp": item.get("timestamp"),
                        }
                        
                        # For carousel albums, get first image
                        if item.get("media_type") == "CAROUSEL_ALBUM" and item.get("children"):
                            children = item["children"].get("data", [])
                            if children:
                                formatted_item["media_url"] = children[0].get("media_url")
                        
                        # Use thumbnail for videos
                        if item.get("media_type") == "VIDEO" and item.get("thumbnail_url"):
                            formatted_item["display_url"] = item.get("thumbnail_url")
                        else:
                            formatted_item["display_url"] = formatted_item["media_url"]
                        
                        formatted_media.append(formatted_item)
                    
                    # Cache the results
                    await self._cache_media(formatted_media)
                    
                    return formatted_media
                else:
                    error_data = response.json() if response.text else {}
                    logger.error(f"Instagram API error: {response.status_code} - {error_data}")
                    return []
                    
        except Exception as e:
            logger.error(f"Failed to fetch Instagram media: {str(e)}")
            return []
    
    async def _get_cached_media(self) -> Optional[List[Dict]]:
        """Get cached media from database"""
        try:
            db = await self._get_db()
            cache = await db.instagram_cache.find_one({"type": "media"})
            
            if cache:
                cached_at = cache.get("cached_at")
                if cached_at and datetime.utcnow() - cached_at < self._cache_duration:
                    return cache.get("data", [])
            
            return None
        except Exception as e:
            logger.error(f"Cache read error: {str(e)}")
            return None
    
    async def _cache_media(self, media: List[Dict]):
        """Cache media to database"""
        try:
            db = await self._get_db()
            await db.instagram_cache.update_one(
                {"type": "media"},
                {
                    "$set": {
                        "data": media,
                        "cached_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
        except Exception as e:
            logger.error(f"Cache write error: {str(e)}")
    
    async def refresh_token(self) -> Optional[str]:
        """
        Refresh long-lived access token before it expires.
        Long-lived tokens are valid for 60 days.
        Call this periodically (e.g., every 50 days) to keep token valid.
        
        Returns:
            New access token if successful, None otherwise
        """
        if not self.is_configured():
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{INSTAGRAM_GRAPH_API}/refresh_access_token",
                    params={
                        "grant_type": "ig_refresh_token",
                        "access_token": self.access_token
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    new_token = data.get("access_token")
                    expires_in = data.get("expires_in")  # seconds
                    
                    logger.info(f"Instagram token refreshed. Expires in {expires_in // 86400} days")
                    
                    # Store the new token info in database
                    db = await self._get_db()
                    await db.instagram_tokens.update_one(
                        {"type": "access_token"},
                        {
                            "$set": {
                                "token": new_token,
                                "expires_in": expires_in,
                                "refreshed_at": datetime.utcnow(),
                                "expires_at": datetime.utcnow() + timedelta(seconds=expires_in)
                            }
                        },
                        upsert=True
                    )
                    
                    return new_token
                else:
                    logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            return None
    
    async def clear_cache(self):
        """Clear the media cache to force fresh fetch"""
        try:
            db = await self._get_db()
            await db.instagram_cache.delete_many({"type": "media"})
            logger.info("Instagram cache cleared")
        except Exception as e:
            logger.error(f"Cache clear error: {str(e)}")


# Singleton instance
instagram_service = InstagramService()


async def get_instagram_feed(limit: int = 9) -> Dict[str, Any]:
    """
    Main function to get Instagram feed for website display.
    
    Returns:
        {
            "configured": bool,
            "posts": [...],
            "username": str,
            "profile_url": str
        }
    """
    if not instagram_service.is_configured():
        return {
            "configured": False,
            "posts": [],
            "username": None,
            "profile_url": None,
            "message": "Instagram integration not configured. Add INSTAGRAM_ACCESS_TOKEN to .env"
        }
    
    # Get user info and media
    user_info = await instagram_service.get_user_info()
    media = await instagram_service.get_media(limit=limit)
    
    username = user_info.get("username") if user_info else None
    
    return {
        "configured": True,
        "posts": media,
        "username": username,
        "profile_url": f"https://instagram.com/{username}" if username else None,
        "followers_count": user_info.get("followers_count") if user_info else None,
        "media_count": user_info.get("media_count") if user_info else None
    }
