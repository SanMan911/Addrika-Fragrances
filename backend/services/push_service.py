"""
Firebase Cloud Messaging (FCM) Push Notification Service

This service handles sending push notifications to users for order status updates.
"""

import os
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

# Firebase Admin SDK - will be initialized if credentials are available
firebase_app = None
messaging = None

# Check if Firebase is configured
FIREBASE_ENABLED = False
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', 'addrika-fragrances')

def init_firebase():
    """Initialize Firebase Admin SDK if credentials are available"""
    global firebase_app, messaging, FIREBASE_ENABLED
    
    if firebase_app is not None:
        return FIREBASE_ENABLED
    
    credentials_path = '/app/backend/secrets/firebase-admin.json'
    
    if not os.path.exists(credentials_path):
        logger.warning(
            "Firebase Admin credentials not found. "
            "Push notifications are disabled. "
            f"Please add credentials at: {credentials_path}"
        )
        return False
    
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging as fcm_messaging
        
        cred = credentials.Certificate(credentials_path)
        firebase_app = firebase_admin.initialize_app(cred)
        messaging = fcm_messaging
        FIREBASE_ENABLED = True
        logger.info("Firebase Admin SDK initialized successfully")
        return True
    except ImportError:
        logger.warning(
            "firebase-admin package not installed. "
            "Run: pip install firebase-admin"
        )
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return False


def is_firebase_enabled() -> bool:
    """Check if Firebase push notifications are enabled"""
    global FIREBASE_ENABLED
    if firebase_app is None:
        init_firebase()
    return FIREBASE_ENABLED


async def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    image_url: Optional[str] = None
) -> bool:
    """
    Send a push notification to a single device
    
    Args:
        token: FCM device token
        title: Notification title
        body: Notification body
        data: Optional data payload
        image_url: Optional image URL for rich notifications
    
    Returns:
        True if sent successfully, False otherwise
    """
    if not is_firebase_enabled():
        logger.warning("Push notification skipped - Firebase not configured")
        return False
    
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url
            ),
            data=data or {},
            token=token
        )
        
        response = messaging.send(message)
        logger.info(f"Push notification sent: {response}")
        return True
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False


async def send_push_to_multiple(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    image_url: Optional[str] = None
) -> dict:
    """
    Send push notification to multiple devices
    
    Returns:
        dict with success_count, failure_count, and failed_tokens
    """
    if not is_firebase_enabled():
        logger.warning("Push notifications skipped - Firebase not configured")
        return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}
    
    if not tokens:
        return {"success_count": 0, "failure_count": 0, "failed_tokens": []}
    
    try:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image_url
            ),
            data=data or {},
            tokens=tokens
        )
        
        response = messaging.send_multicast(message)
        
        failed_tokens = []
        if response.failure_count > 0:
            for idx, result in enumerate(response.responses):
                if not result.success:
                    failed_tokens.append(tokens[idx])
        
        logger.info(
            f"Push notifications sent: {response.success_count} success, "
            f"{response.failure_count} failures"
        )
        
        return {
            "success_count": response.success_count,
            "failure_count": response.failure_count,
            "failed_tokens": failed_tokens
        }
    except Exception as e:
        logger.error(f"Failed to send multicast push: {e}")
        return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}


async def send_order_status_push(
    db,
    order: dict,
    new_status: str
) -> bool:
    """
    Send push notification for order status change
    
    Args:
        db: Database instance
        order: Order document
        new_status: New order status
    """
    if not is_firebase_enabled():
        return False
    
    # Get user's FCM token
    user_email = order.get('shipping', {}).get('email')
    if not user_email:
        return False
    
    user = await db.users.find_one(
        {"email": user_email.lower(), "push_enabled": True},
        {"fcm_token": 1}
    )
    
    if not user or not user.get('fcm_token'):
        return False
    
    # Create notification content based on status
    order_number = order.get('order_number', 'Your order')
    status_messages = {
        'confirmed': {
            'title': 'Order Confirmed! ✓',
            'body': f'Great news! {order_number} has been confirmed and is being processed.'
        },
        'processing': {
            'title': 'Order Being Packed 📦',
            'body': f'{order_number} is being prepared for shipment.'
        },
        'shipped': {
            'title': 'Order Shipped! 🚚',
            'body': f'{order_number} is on its way! Track your package for live updates.'
        },
        'delivered': {
            'title': 'Order Delivered! 🎉',
            'body': f'{order_number} has been delivered. Enjoy your Addrika fragrances!'
        },
        'rto': {
            'title': 'Order Returned',
            'body': f'{order_number} is being returned. A voucher will be issued within 7 days.'
        },
        'cancelled': {
            'title': 'Order Cancelled',
            'body': f'{order_number} has been cancelled.'
        }
    }
    
    message = status_messages.get(new_status)
    if not message:
        return False
    
    # Send push notification
    return await send_push_notification(
        token=user['fcm_token'],
        title=message['title'],
        body=message['body'],
        data={
            'type': 'order_status',
            'order_number': order.get('order_number', ''),
            'status': new_status,
            'click_action': '/track-order'
        }
    )


# Initialize Firebase on module load (lazy)
# Actual initialization happens on first use
