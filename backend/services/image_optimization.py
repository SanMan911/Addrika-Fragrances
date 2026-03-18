"""
Image optimization service for uploaded images.
Compresses and optimizes images before storage.
"""
import io
import base64
import logging
from typing import Optional, Tuple
from PIL import Image

logger = logging.getLogger(__name__)

# Configuration
MAX_IMAGE_SIZE = (1200, 1200)  # Max dimensions
THUMBNAIL_SIZE = (300, 300)
QUALITY_SETTINGS = {
    'high': 85,
    'medium': 75,
    'low': 60,
    'thumbnail': 70
}

def optimize_image(
    image_data: bytes,
    max_size: Tuple[int, int] = MAX_IMAGE_SIZE,
    quality: int = 80,
    format: str = 'WEBP',
    maintain_aspect: bool = True
) -> Tuple[bytes, str]:
    """
    Optimize an image by resizing and compressing.
    
    Args:
        image_data: Raw image bytes
        max_size: Maximum dimensions (width, height)
        quality: Compression quality (1-100)
        format: Output format (WEBP, JPEG, PNG)
        maintain_aspect: Keep aspect ratio when resizing
    
    Returns:
        Tuple of (optimized_bytes, mime_type)
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_data))
        
        # Convert RGBA to RGB for JPEG
        if img.mode == 'RGBA' and format.upper() == 'JPEG':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode != 'RGB' and format.upper() in ['JPEG', 'WEBP']:
            img = img.convert('RGB')
        
        # Resize if needed
        if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
            if maintain_aspect:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
            else:
                img = img.resize(max_size, Image.Resampling.LANCZOS)
        
        # Save optimized
        output = io.BytesIO()
        
        if format.upper() == 'WEBP':
            img.save(output, format='WEBP', quality=quality, method=6)
            mime_type = 'image/webp'
        elif format.upper() == 'PNG':
            img.save(output, format='PNG', optimize=True)
            mime_type = 'image/png'
        else:  # JPEG
            img.save(output, format='JPEG', quality=quality, optimize=True)
            mime_type = 'image/jpeg'
        
        optimized_data = output.getvalue()
        
        # Log compression ratio
        original_size = len(image_data)
        new_size = len(optimized_data)
        ratio = (1 - new_size / original_size) * 100 if original_size > 0 else 0
        logger.info(f"Image optimized: {original_size} -> {new_size} bytes ({ratio:.1f}% reduction)")
        
        return optimized_data, mime_type
        
    except Exception as e:
        logger.error(f"Image optimization failed: {str(e)}")
        raise


def optimize_base64_image(
    base64_string: str,
    max_size: Tuple[int, int] = MAX_IMAGE_SIZE,
    quality: int = 80,
    format: str = 'WEBP'
) -> str:
    """
    Optimize a base64 encoded image.
    
    Args:
        base64_string: Base64 image string (with or without data URI prefix)
        max_size: Maximum dimensions
        quality: Compression quality
        format: Output format
    
    Returns:
        Optimized base64 string with data URI prefix
    """
    try:
        # Extract base64 data
        if ',' in base64_string:
            header, data = base64_string.split(',', 1)
        else:
            data = base64_string
        
        # Decode
        image_bytes = base64.b64decode(data)
        
        # Optimize
        optimized_bytes, mime_type = optimize_image(
            image_bytes,
            max_size=max_size,
            quality=quality,
            format=format
        )
        
        # Encode back to base64
        optimized_b64 = base64.b64encode(optimized_bytes).decode('utf-8')
        
        return f"data:{mime_type};base64,{optimized_b64}"
        
    except Exception as e:
        logger.error(f"Base64 image optimization failed: {str(e)}")
        return base64_string  # Return original on failure


def create_thumbnail(
    image_data: bytes,
    size: Tuple[int, int] = THUMBNAIL_SIZE,
    quality: int = QUALITY_SETTINGS['thumbnail']
) -> Tuple[bytes, str]:
    """
    Create a thumbnail from image data.
    """
    return optimize_image(
        image_data,
        max_size=size,
        quality=quality,
        format='WEBP'
    )


def create_thumbnail_base64(
    base64_string: str,
    size: Tuple[int, int] = THUMBNAIL_SIZE
) -> str:
    """
    Create a thumbnail from base64 image.
    """
    return optimize_base64_image(
        base64_string,
        max_size=size,
        quality=QUALITY_SETTINGS['thumbnail'],
        format='WEBP'
    )


def get_image_dimensions(image_data: bytes) -> Tuple[int, int]:
    """Get image dimensions without fully loading it."""
    try:
        img = Image.open(io.BytesIO(image_data))
        return img.size
    except Exception:
        return (0, 0)


def is_valid_image(image_data: bytes) -> bool:
    """Check if data is a valid image."""
    try:
        img = Image.open(io.BytesIO(image_data))
        img.verify()
        return True
    except Exception:
        return False
