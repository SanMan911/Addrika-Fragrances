"""Instagram Feed API Routes"""

from fastapi import APIRouter, Query
from services.instagram_service import get_instagram_feed, instagram_service

router = APIRouter(tags=["Instagram"])


@router.get("/instagram/feed")
async def get_feed(limit: int = Query(default=9, ge=1, le=25)):
    """
    Get Instagram feed for website display.
    
    Returns recent posts from the configured Instagram business account.
    Posts are cached for 1 hour to minimize API calls.
    
    No authentication required - this is public content for website visitors.
    """
    return await get_instagram_feed(limit=limit)


@router.get("/instagram/status")
async def get_status():
    """
    Check Instagram integration status.
    
    Returns whether the integration is configured and token status.
    """
    configured = instagram_service.is_configured()
    
    if not configured:
        return {
            "configured": False,
            "message": "Instagram access token not configured",
            "setup_instructions": {
                "step1": "Go to https://developers.facebook.com/apps/",
                "step2": "Create or select your app",
                "step3": "Add Instagram product → API setup with Instagram business login",
                "step4": "Generate token for your Instagram business account",
                "step5": "Add INSTAGRAM_ACCESS_TOKEN=your_token to backend/.env",
                "step6": "Restart the backend service"
            }
        }
    
    # Try to get user info to verify token works
    user_info = await instagram_service.get_user_info()
    
    if user_info:
        return {
            "configured": True,
            "token_valid": True,
            "username": user_info.get("username"),
            "account_type": user_info.get("account_type"),
            "media_count": user_info.get("media_count")
        }
    else:
        return {
            "configured": True,
            "token_valid": False,
            "message": "Token configured but may be expired or invalid. Try refreshing."
        }


@router.post("/instagram/refresh-token")
async def refresh_token():
    """
    Refresh the Instagram access token.
    
    Long-lived tokens expire in 60 days. Call this to extend validity.
    Should be called periodically (e.g., every 50 days).
    """
    if not instagram_service.is_configured():
        return {"success": False, "error": "Instagram not configured"}
    
    new_token = await instagram_service.refresh_token()
    
    if new_token:
        return {
            "success": True,
            "message": "Token refreshed successfully. Update INSTAGRAM_ACCESS_TOKEN in .env with the new token.",
            "new_token": new_token[:20] + "..." + new_token[-10:]  # Partial token for verification
        }
    else:
        return {
            "success": False,
            "error": "Failed to refresh token. It may have expired. Generate a new one from Meta Developer dashboard."
        }


@router.post("/instagram/clear-cache")
async def clear_cache():
    """
    Clear the Instagram media cache.
    
    Use this to force a fresh fetch of posts from Instagram.
    """
    await instagram_service.clear_cache()
    return {"success": True, "message": "Cache cleared. Next request will fetch fresh data."}
