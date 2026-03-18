"""
Badge Notification Service for Addrika
Sends congratulatory emails when retailers receive badges/labels
"""
import logging
from datetime import datetime, timezone
from services.email_service import send_email

logger = logging.getLogger(__name__)


# Badge display names and descriptions
BADGE_INFO = {
    'is_addrika_verified_partner': {
        'name': 'Addrika Verified Partner',
        'emoji': '🏆',
        'color': '#d4af37',
        'description': 'You have been recognized as a trusted and verified partner of Addrika.',
        'benefits': [
            'Priority product allocations during high-demand periods',
            'Early access to new product launches',
            'Featured listing in our retailer directory',
            'Exclusive partner-only promotions'
        ]
    }
}

LABEL_INFO = {
    'top_retailer_month': {
        'name': 'Top Retailer of the Month',
        'emoji': '👑',
        'color': '#f59e0b',
        'description': 'Outstanding performance! You are our top-performing retailer this month.'
    },
    'top_retailer_quarter': {
        'name': 'Top Retailer of the Quarter',
        'emoji': '👑',
        'color': '#d97706',
        'description': 'Exceptional achievement! You have been our best performer this quarter.'
    },
    'star_retailer_month': {
        'name': 'Star Retailer of the Month',
        'emoji': '⭐',
        'color': '#8b5cf6',
        'description': 'Stellar performance! You shine as our star retailer this month.'
    },
    'star_retailer_quarter': {
        'name': 'Star Retailer of the Quarter',
        'emoji': '⭐',
        'color': '#7c3aed',
        'description': 'Remarkable achievement! You have been a star performer this quarter.'
    },
    'rising_star': {
        'name': 'Rising Star',
        'emoji': '🌟',
        'color': '#3b82f6',
        'description': 'Impressive growth! You are recognized as a rising star in our network.'
    },
    'best_performer': {
        'name': 'Best Performer',
        'emoji': '🎯',
        'color': '#10b981',
        'description': 'Excellence recognized! You are one of our best-performing partners.'
    }
}


def get_verified_partner_email_html(retailer: dict) -> str:
    """Generate HTML email for Addrika Verified Partner badge"""
    business_name = retailer.get('business_name', 'Partner')
    spoc_name = retailer.get('spoc', {}).get('name', business_name)
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header with Gold Gradient -->
            <tr>
                <td style="background: linear-gradient(135deg, #1e3a52 0%, #2d4a6a 50%, #1e3a52 100%); padding: 40px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 32px; font-weight: bold;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 2px;">VERIFIED PARTNER PROGRAM</p>
                </td>
            </tr>
            
            <!-- Badge Announcement -->
            <tr>
                <td style="padding: 50px 30px; text-align: center;">
                    <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #d4af37 0%, #f5d77e 50%, #d4af37 100%); border-radius: 50%; margin: 0 auto 25px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 40px rgba(212, 175, 55, 0.4);">
                        <span style="font-size: 50px;">🏆</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 15px 0; font-size: 28px;">Congratulations!</h2>
                    <p style="color: #666; font-size: 16px; margin: 0;">
                        Dear <strong>{spoc_name}</strong>,<br><br>
                        <strong style="color: #d4af37;">{business_name}</strong> has been recognized as an
                    </p>
                </td>
            </tr>
            
            <!-- Badge Card -->
            <tr>
                <td style="padding: 0 30px;">
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px solid #d4af37; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 8px 30px rgba(212, 175, 55, 0.2);">
                        <p style="color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 10px 0;">Official Badge</p>
                        <h3 style="color: #1e3a52; font-size: 24px; margin: 0; font-weight: bold;">
                            🏆 ADDRIKA VERIFIED PARTNER
                        </h3>
                        <p style="color: #78350f; margin: 15px 0 0 0; font-size: 14px;">
                            A trusted and verified retail partner of Addrika
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Benefits Section -->
            <tr>
                <td style="padding: 40px 30px;">
                    <h3 style="color: #1e3a52; margin: 0 0 20px 0;">Your Partner Benefits:</h3>
                    <div style="background-color: #f9f7f4; border-radius: 12px; padding: 25px;">
                        <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                            <span style="color: #d4af37; font-size: 20px; margin-right: 15px;">✓</span>
                            <p style="color: #333; margin: 0;"><strong>Priority Allocations</strong> - Get products first during high-demand periods</p>
                        </div>
                        <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                            <span style="color: #d4af37; font-size: 20px; margin-right: 15px;">✓</span>
                            <p style="color: #333; margin: 0;"><strong>Early Access</strong> - Be the first to know about new launches</p>
                        </div>
                        <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                            <span style="color: #d4af37; font-size: 20px; margin-right: 15px;">✓</span>
                            <p style="color: #333; margin: 0;"><strong>Featured Listing</strong> - Prominent placement in our retailer directory</p>
                        </div>
                        <div style="display: flex; align-items: flex-start;">
                            <span style="color: #d4af37; font-size: 20px; margin-right: 15px;">✓</span>
                            <p style="color: #333; margin: 0;"><strong>Exclusive Promotions</strong> - Partner-only offers and discounts</p>
                        </div>
                    </div>
                </td>
            </tr>
            
            <!-- Display Badge Note -->
            <tr>
                <td style="padding: 0 30px 40px;">
                    <div style="background-color: #dcfce7; padding: 20px; border-radius: 12px; border: 1px solid #22c55e;">
                        <p style="color: #166534; margin: 0; font-weight: bold;">📋 Display Your Badge!</p>
                        <p style="color: #166534; margin: 10px 0 0 0; font-size: 14px;">
                            You can proudly display the "Addrika Verified Partner" badge at your store. 
                            A printable certificate will be sent to you separately.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- CTA Button -->
            <tr>
                <td style="padding: 0 30px 40px; text-align: center;">
                    <a href="https://centraders.com/retailer/dashboard" style="display: inline-block; background: linear-gradient(135deg, #1e3a52 0%, #2d4a6a 100%); color: white; padding: 18px 45px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(30, 58, 82, 0.3);">
                        View Your Dashboard
                    </a>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold; font-size: 18px;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 13px;">Elegance in Every Scent</p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        Thank you for being a valued partner.<br>
                        Questions? Contact us at contact.us@centraders.com
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_retailer_label_email_html(retailer: dict, label_key: str, label_period: str = None) -> str:
    """Generate HTML email for retailer labels (Top/Star Retailer, etc.)"""
    label_info = LABEL_INFO.get(label_key, {})
    business_name = retailer.get('business_name', 'Partner')
    spoc_name = retailer.get('spoc', {}).get('name', business_name)
    
    label_name = label_info.get('name', 'Award')
    label_emoji = label_info.get('emoji', '🏆')
    label_color = label_info.get('color', '#d4af37')
    label_description = label_info.get('description', 'Congratulations on this achievement!')
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
                <td style="background: linear-gradient(135deg, #1e3a52 0%, #2d4a6a 50%, #1e3a52 100%); padding: 40px; text-align: center;">
                    <h1 style="color: #d4af37; margin: 0; font-size: 32px; font-weight: bold;">ADDRIKA</h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 2px;">RETAILER RECOGNITION</p>
                </td>
            </tr>
            
            <!-- Award Announcement -->
            <tr>
                <td style="padding: 50px 30px; text-align: center;">
                    <div style="width: 100px; height: 100px; background: linear-gradient(135deg, {label_color} 0%, {label_color}99 100%); border-radius: 50%; margin: 0 auto 25px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 40px {label_color}66;">
                        <span style="font-size: 50px;">{label_emoji}</span>
                    </div>
                    <h2 style="color: #1e3a52; margin: 0 0 15px 0; font-size: 28px;">Congratulations!</h2>
                    <p style="color: #666; font-size: 16px; margin: 0;">
                        Dear <strong>{spoc_name}</strong>,<br><br>
                        We are thrilled to recognize <strong style="color: {label_color};">{business_name}</strong>
                    </p>
                </td>
            </tr>
            
            <!-- Award Card -->
            <tr>
                <td style="padding: 0 30px;">
                    <div style="background: linear-gradient(135deg, #ffffff 0%, #f9f9f9 100%); border: 3px solid {label_color}; border-radius: 16px; padding: 35px; text-align: center; box-shadow: 0 8px 30px {label_color}33;">
                        <p style="color: {label_color}; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 15px 0;">🎉 Award Certificate</p>
                        <h3 style="color: #1e3a52; font-size: 26px; margin: 0; font-weight: bold;">
                            {label_emoji} {label_name}
                        </h3>
                        {f'<p style="color: {label_color}; font-size: 16px; margin: 15px 0 0 0; font-weight: bold;">{label_period}</p>' if label_period else ''}
                        <p style="color: #666; margin: 20px 0 0 0; font-size: 14px; line-height: 1.6;">
                            {label_description}
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- Achievement Stats -->
            <tr>
                <td style="padding: 40px 30px;">
                    <div style="background-color: #f9f7f4; border-radius: 12px; padding: 25px; text-align: center;">
                        <p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">This recognition is based on your</p>
                        <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
                            <div style="padding: 10px;">
                                <p style="font-size: 28px; color: {label_color}; margin: 0; font-weight: bold;">📈</p>
                                <p style="color: #333; margin: 5px 0 0 0; font-size: 12px;">Order Volume</p>
                            </div>
                            <div style="padding: 10px;">
                                <p style="font-size: 28px; color: {label_color}; margin: 0; font-weight: bold;">✅</p>
                                <p style="color: #333; margin: 5px 0 0 0; font-size: 12px;">Completion Rate</p>
                            </div>
                            <div style="padding: 10px;">
                                <p style="font-size: 28px; color: {label_color}; margin: 0; font-weight: bold;">⭐</p>
                                <p style="color: #333; margin: 5px 0 0 0; font-size: 12px;">Customer Satisfaction</p>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
            
            <!-- Share Your Achievement -->
            <tr>
                <td style="padding: 0 30px 40px;">
                    <div style="background-color: #e0f2fe; padding: 20px; border-radius: 12px; border: 1px solid #0ea5e9;">
                        <p style="color: #0369a1; margin: 0; font-weight: bold;">📢 Share Your Achievement!</p>
                        <p style="color: #0369a1; margin: 10px 0 0 0; font-size: 14px;">
                            Feel free to share this recognition with your customers and on social media. 
                            A badge image for display has been attached to this email.
                        </p>
                    </div>
                </td>
            </tr>
            
            <!-- CTA Button -->
            <tr>
                <td style="padding: 0 30px 40px; text-align: center;">
                    <a href="https://centraders.com/retailer/dashboard" style="display: inline-block; background: linear-gradient(135deg, #1e3a52 0%, #2d4a6a 100%); color: white; padding: 18px 45px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(30, 58, 82, 0.3);">
                        View Performance Analytics
                    </a>
                </td>
            </tr>
            
            <!-- Footer -->
            <tr>
                <td style="background-color: #1e3a52; padding: 30px; text-align: center;">
                    <p style="color: #d4af37; margin: 0 0 10px 0; font-weight: bold; font-size: 18px;">ADDRIKA</p>
                    <p style="color: #ffffff; margin: 0; font-size: 13px;">Elegance in Every Scent</p>
                    <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                        Keep up the amazing work!<br>
                        Questions? Contact us at contact.us@centraders.com
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


async def send_verified_partner_notification(retailer: dict) -> bool:
    """Send Addrika Verified Partner badge notification email"""
    email = retailer.get('email')
    if not email:
        logger.warning(f"No email for retailer {retailer.get('retailer_id')}, skipping badge notification")
        return False
    
    business_name = retailer.get('business_name', 'Partner')
    html = get_verified_partner_email_html(retailer)
    
    result = await send_email(
        to_email=email,
        subject=f"🏆 Congratulations! {business_name} is now an Addrika Verified Partner",
        html_content=html
    )
    
    if result:
        logger.info(f"Verified Partner notification sent to {email} for {business_name}")
    else:
        logger.error(f"Failed to send Verified Partner notification to {email}")
    
    return result


async def send_retailer_label_notification(retailer: dict, label_key: str, label_period: str = None) -> bool:
    """Send retailer label (Top/Star Retailer) notification email"""
    email = retailer.get('email')
    if not email:
        logger.warning(f"No email for retailer {retailer.get('retailer_id')}, skipping label notification")
        return False
    
    label_info = LABEL_INFO.get(label_key)
    if not label_info:
        logger.warning(f"Unknown label key: {label_key}")
        return False
    
    business_name = retailer.get('business_name', 'Partner')
    label_name = label_info.get('name', 'Award')
    label_emoji = label_info.get('emoji', '🏆')
    
    html = get_retailer_label_email_html(retailer, label_key, label_period)
    
    period_suffix = f" - {label_period}" if label_period else ""
    result = await send_email(
        to_email=email,
        subject=f"{label_emoji} Congratulations! {business_name} - {label_name}{period_suffix}",
        html_content=html
    )
    
    if result:
        logger.info(f"Label notification ({label_key}) sent to {email} for {business_name}")
    else:
        logger.error(f"Failed to send label notification to {email}")
    
    return result


async def send_badge_removed_notification(retailer: dict, badge_type: str) -> bool:
    """Send notification when a badge is removed (optional - for transparency)"""
    # This is optional - you may not want to notify when badges are removed
    # Keeping it simple for now - just log it
    logger.info(f"Badge {badge_type} removed from retailer {retailer.get('retailer_id')}")
    return True
