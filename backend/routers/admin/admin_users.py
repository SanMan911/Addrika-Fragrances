"""Admin user management routes"""
from fastapi import APIRouter, HTTPException, Request, Cookie, Depends
from typing import Optional
from datetime import datetime, timezone

from dependencies import db, require_admin

router = APIRouter(tags=["Admin Users"])


@router.get("/users")
async def admin_get_users(request: Request, session_token: Optional[str] = Cookie(None)):
    """Get all registered users"""
    await require_admin(request, session_token)
    
    users = await db.users.find({}).sort("created_at", -1).to_list(500)
    
    # Normalize and clean user data
    normalized = []
    for user in users:
        normalized.append({
            "id": user.get("user_id", str(user.get("_id", ""))),
            "email": user.get("email"),
            "name": user.get("name"),
            "username": user.get("username"),
            "phone": user.get("phone"),
            "salutation": user.get("salutation"),
            "authProvider": user.get("auth_provider", "email"),
            "isVerified": user.get("is_verified", False),
            "createdAt": user.get("created_at"),
            "picture": user.get("picture")
        })
    
    return {"users": normalized, "total": len(normalized)}


@router.get("/registration-logs")
async def get_registration_logs(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    limit: int = 50,
    unread_only: bool = False
):
    """Get registration logs for admin notifications"""
    await require_admin(request, session_token)
    
    query = {}
    if unread_only:
        query["read_by_admin"] = False
    
    logs = await db.registration_logs.find(query).sort("registered_at", -1).limit(limit).to_list(limit)
    
    # Count unread notifications
    unread_count = await db.registration_logs.count_documents({"read_by_admin": False})
    
    normalized = []
    for log in logs:
        normalized.append({
            "id": str(log.get("_id")),
            "user_id": log.get("user_id"),
            "email": log.get("email"),
            "name": log.get("name"),
            "username": log.get("username"),
            "phone": log.get("phone"),
            "registered_at": log.get("registered_at"),
            "read_by_admin": log.get("read_by_admin", False)
        })
    
    return {
        "logs": normalized,
        "total": len(normalized),
        "unread_count": unread_count
    }


@router.post("/registration-logs/mark-read")
async def mark_registration_logs_read(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Mark all registration logs as read"""
    await require_admin(request, session_token)
    
    result = await db.registration_logs.update_many(
        {"read_by_admin": False},
        {"$set": {"read_by_admin": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": "Notifications marked as read",
        "marked_count": result.modified_count
    }


@router.get("/notifications/count")
async def get_admin_notification_count(
    request: Request,
    session_token: Optional[str] = Cookie(None)
):
    """Get count of unread admin notifications"""
    await require_admin(request, session_token)
    
    unread_registrations = await db.registration_logs.count_documents({"read_by_admin": False})
    
    return {
        "unread_registrations": unread_registrations,
        "total_unread": unread_registrations
    }



@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """Delete a specific user by ID (admin only)"""
    from bson import ObjectId
    from bson.errors import InvalidId
    
    try:
        user = None
        mongo_id = None
        
        # Try to find by MongoDB ObjectId first
        try:
            mongo_id = ObjectId(user_id)
            user = await db.users.find_one({"_id": mongo_id})
        except InvalidId:
            # Not a valid ObjectId, try user_id field
            pass
        
        # If not found by _id, try user_id field
        if not user:
            user = await db.users.find_one({"user_id": user_id})
            if user:
                mongo_id = user["_id"]
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_email = user.get("email", "Unknown")
        user_id_field = user.get("user_id", str(mongo_id))
        
        # Delete user sessions (try both _id string and user_id)
        await db.user_sessions.delete_many({"user_id": {"$in": [user_id, user_id_field, str(mongo_id)]}})
        await db.sessions.delete_many({"user_id": {"$in": [user_id, user_id_field, str(mongo_id)]}})
        
        # Delete discount usage records
        await db.discount_usage.delete_many({"user_id": {"$in": [user_id, user_id_field, str(mongo_id)]}})
        
        # Delete the user
        result = await db.users.delete_one({"_id": mongo_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "message": f"User {user_email} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")


@router.delete("/cleanup-users-without-username")
async def cleanup_users_without_username(
    request: Request,
    confirm: bool = False,
    session_token: Optional[str] = Cookie(None)
):
    """Delete all users who don't have a username set (admin only)"""
    await require_admin(request, session_token)
    
    # Find users without username
    users_without_username = await db.users.find({
        "$or": [
            {"username": None},
            {"username": ""},
            {"username": {"$exists": False}}
        ]
    }).to_list(1000)
    
    count = len(users_without_username)
    user_emails = [u.get('email', 'N/A') for u in users_without_username]
    user_ids = [u.get('user_id') for u in users_without_username]
    
    if not confirm:
        # Preview mode - just show what would be deleted
        return {
            "action": "preview",
            "users_to_delete": count,
            "user_emails": user_emails[:20],  # Show first 20 emails
            "message": f"Found {count} users without username. Set confirm=true to delete them."
        }
    
    # Actually delete users
    if count > 0:
        result = await db.users.delete_many({
            "$or": [
                {"username": None},
                {"username": ""},
                {"username": {"$exists": False}}
            ]
        })
        
        # Also delete their sessions
        if user_ids:
            await db.sessions.delete_many({"user_id": {"$in": user_ids}})
        
        return {
            "action": "deleted",
            "users_deleted": result.deleted_count,
            "user_emails": user_emails[:20],
            "message": f"Successfully deleted {result.deleted_count} users without username."
        }
    
    return {
        "action": "nothing",
        "users_deleted": 0,
        "message": "No users without username found."
    }


@router.delete("/cleanup-google-users")
async def cleanup_google_login_users(
    request: Request,
    confirm: bool = False,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """
    Delete all users who registered via Google social login.
    This allows them to re-register with the same email using email/password.
    
    Query params:
    - confirm=false (default): Preview mode - shows users that would be deleted
    - confirm=true: Actually delete the users
    """
    # Find all Google login users
    google_users = await db.users.find({"auth_provider": "google"}).to_list(500)
    
    if not google_users:
        return {
            "action": "nothing",
            "users_found": 0,
            "message": "No Google login users found."
        }
    
    user_emails = [u.get("email") for u in google_users]
    user_ids = [str(u.get("_id")) for u in google_users]
    
    if not confirm:
        # Preview mode - just show what would be deleted
        return {
            "action": "preview",
            "users_found": len(google_users),
            "users_to_delete": [
                {
                    "email": u.get("email"),
                    "name": u.get("name"),
                    "created_at": str(u.get("created_at"))
                }
                for u in google_users
            ],
            "message": f"Found {len(google_users)} Google login user(s). Add ?confirm=true to delete them."
        }
    
    # Actually delete users and their related data
    try:
        # Delete user sessions
        await db.user_sessions.delete_many({"user_id": {"$in": user_ids}})
        await db.sessions.delete_many({"user_id": {"$in": user_ids}})
        
        # Delete discount usage records for these users
        await db.discount_usage.delete_many({"user_id": {"$in": user_ids}})
        
        # Delete the users themselves
        result = await db.users.delete_many({"auth_provider": "google"})
        
        return {
            "action": "deleted",
            "users_deleted": result.deleted_count,
            "deleted_emails": user_emails,
            "message": f"Successfully deleted {result.deleted_count} Google login user(s). They can now re-register with email/password."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting users: {str(e)}")


@router.post("/users/verify-with-phone")
async def verify_users_with_phone(
    request: Request,
    confirm: bool = False,
    delete_others: bool = False,
    session_token: Optional[str] = Cookie(None),
    admin: dict = Depends(require_admin)
):
    """
    Mark all users with valid phone numbers as 'verified' and optionally delete those without.
    
    Query params:
    - confirm=false (default): Preview mode - shows what would happen
    - confirm=true: Actually perform the verification
    - delete_others=true: Also delete users without phone numbers
    """
    # Find users with valid phone numbers (non-empty, numeric)
    all_users = await db.users.find({}).to_list(1000)
    
    users_with_phone = []
    users_without_phone = []
    
    for user in all_users:
        phone = user.get("phone", "")
        # Check if phone is valid (non-empty and has at least 10 digits)
        if phone and len(str(phone).replace("+", "").replace("-", "").replace(" ", "")) >= 10:
            users_with_phone.append(user)
        else:
            users_without_phone.append(user)
    
    if not confirm:
        # Preview mode
        return {
            "action": "preview",
            "users_with_phone": len(users_with_phone),
            "users_without_phone": len(users_without_phone),
            "users_to_verify": [
                {
                    "email": u.get("email"),
                    "name": u.get("name"),
                    "phone": u.get("phone"),
                    "already_verified": u.get("is_verified", False)
                }
                for u in users_with_phone[:20]  # Show first 20
            ],
            "users_to_delete": [
                {
                    "email": u.get("email"),
                    "name": u.get("name"),
                    "phone": u.get("phone", "N/A")
                }
                for u in users_without_phone[:20]  # Show first 20
            ] if delete_others else [],
            "message": f"Found {len(users_with_phone)} users with phone numbers to verify. {len(users_without_phone)} users without phone. Add ?confirm=true to proceed."
        }
    
    # Actually perform the operations
    try:
        # Mark users with phone as verified
        verified_count = 0
        for user in users_with_phone:
            if not user.get("is_verified", False):
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"is_verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
                )
                verified_count += 1
        
        # Delete users without phone if requested
        deleted_count = 0
        deleted_emails = []
        
        if delete_others and users_without_phone:
            user_ids = [str(u["_id"]) for u in users_without_phone]
            deleted_emails = [u.get("email") for u in users_without_phone]
            
            # Delete sessions
            await db.user_sessions.delete_many({"user_id": {"$in": user_ids}})
            await db.sessions.delete_many({"user_id": {"$in": user_ids}})
            
            # Delete discount usage
            await db.discount_usage.delete_many({"user_id": {"$in": user_ids}})
            
            # Delete users
            for user in users_without_phone:
                await db.users.delete_one({"_id": user["_id"]})
                deleted_count += 1
        
        return {
            "action": "completed",
            "users_verified": verified_count,
            "already_verified": len(users_with_phone) - verified_count,
            "users_deleted": deleted_count,
            "deleted_emails": deleted_emails[:20] if deleted_emails else [],
            "message": f"Verified {verified_count} user(s). {deleted_count} user(s) without phone deleted."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing users: {str(e)}")
