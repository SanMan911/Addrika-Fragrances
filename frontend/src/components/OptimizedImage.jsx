/**
 * OptimizedImage - A reusable image component with built-in optimization
 * 
 * Features:
 * - Lazy loading for below-the-fold images
 * - Responsive srcset for different screen sizes
 * - WebP format support with fallback
 * - Loading skeleton/blur placeholder
 * - Error handling with fallback image
 * - Automatic aspect ratio preservation
 */
import React, { useState, useRef, useEffect } from 'react';

// Default placeholder for broken images
const FALLBACK_IMAGE = '/images/placeholder-product.png';

// Image optimization configuration
const IMAGE_CONFIG = {
  // Quality settings (0-100)
  quality: {
    thumbnail: 60,
    small: 70,
    medium: 80,
    large: 85,
    hero: 90
  },
  // Responsive breakpoints
  breakpoints: {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
  },
  // Default sizes for different use cases
  sizes: {
    thumbnail: '(max-width: 640px) 80px, 100px',
    card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
    hero: '100vw',
    gallery: '(max-width: 768px) 100vw, 50vw',
    product: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px'
  }
};

/**
 * Check if image URL is from a CDN that supports transformations
 */
const isTransformableCDN = (url) => {
  if (!url) return false;
  return url.includes('customer-assets.emergentagent.com') || 
         url.includes('unsplash.com') ||
         url.includes('cloudinary.com');
};

/**
 * Generate optimized URL for supported CDNs
 */
const getOptimizedUrl = (url, { width, quality = 80, format = 'auto' } = {}) => {
  if (!url) return FALLBACK_IMAGE;
  
  // Handle Unsplash URLs
  if (url.includes('unsplash.com')) {
    const baseUrl = url.split('?')[0];
    const params = new URLSearchParams();
    if (width) params.set('w', width);
    params.set('q', quality);
    params.set('fm', format === 'auto' ? 'webp' : format);
    params.set('fit', 'crop');
    return `${baseUrl}?${params.toString()}`;
  }
  
  // For other URLs, return as-is (rely on browser caching)
  return url;
};

/**
 * Generate srcset for responsive images
 */
const generateSrcSet = (url, widths = [320, 640, 768, 1024, 1280]) => {
  if (!url || !isTransformableCDN(url)) return undefined;
  
  return widths
    .map(w => `${getOptimizedUrl(url, { width: w })} ${w}w`)
    .join(', ');
};

/**
 * OptimizedImage Component
 */
const OptimizedImage = ({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  priority = false,
  sizes = IMAGE_CONFIG.sizes.card,
  objectFit = 'cover',
  placeholder = 'blur',
  fallbackSrc = FALLBACK_IMAGE,
  onLoad,
  onError,
  style = {},
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '200px', // Load images 200px before they enter viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, loading]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    if (fallbackSrc && e.target.src !== fallbackSrc) {
      e.target.src = fallbackSrc;
    }
    onError?.(e);
  };

  const optimizedSrc = hasError ? fallbackSrc : getOptimizedUrl(src, { width: width || 800 });
  const srcSet = !hasError ? generateSrcSet(src) : undefined;

  const containerStyle = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    ...style
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit,
    transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0,
    transform: isLoaded ? 'scale(1)' : 'scale(1.02)'
  };

  const placeholderStyle = {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#e5e7eb',
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 0 : 1
  };

  return (
    <div 
      ref={imgRef}
      className={className}
      style={containerStyle}
      {...props}
    >
      {/* Placeholder skeleton */}
      {placeholder === 'blur' && (
        <div 
          style={placeholderStyle}
          className="animate-pulse"
        />
      )}
      
      {/* Actual image */}
      {isInView && (
        <img
          src={optimizedSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt || ''}
          width={width}
          height={height}
          loading={priority ? 'eager' : loading}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          style={imageStyle}
        />
      )}
    </div>
  );
};

/**
 * ProductImage - Specialized image component for product cards
 */
export const ProductImage = ({ 
  src, 
  alt, 
  size = 'card',
  className = '',
  ...props 
}) => (
  <OptimizedImage
    src={src}
    alt={alt}
    sizes={IMAGE_CONFIG.sizes[size] || IMAGE_CONFIG.sizes.card}
    className={`${className}`}
    objectFit="contain"
    {...props}
  />
);

/**
 * HeroImage - Specialized image for hero sections (eager loading)
 */
export const HeroImage = ({ 
  src, 
  alt, 
  className = '',
  ...props 
}) => (
  <OptimizedImage
    src={src}
    alt={alt}
    priority={true}
    sizes={IMAGE_CONFIG.sizes.hero}
    className={className}
    objectFit="cover"
    {...props}
  />
);

/**
 * ThumbnailImage - Small images for carts, lists, etc.
 */
export const ThumbnailImage = ({ 
  src, 
  alt, 
  className = '',
  ...props 
}) => (
  <OptimizedImage
    src={src}
    alt={alt}
    sizes={IMAGE_CONFIG.sizes.thumbnail}
    className={className}
    objectFit="cover"
    {...props}
  />
);

/**
 * GalleryImage - For image galleries with zoom support
 */
export const GalleryImage = ({ 
  src, 
  alt, 
  className = '',
  onClick,
  ...props 
}) => (
  <OptimizedImage
    src={src}
    alt={alt}
    sizes={IMAGE_CONFIG.sizes.gallery}
    className={`cursor-pointer hover:opacity-90 transition-opacity ${className}`}
    objectFit="contain"
    onClick={onClick}
    {...props}
  />
);

// Export config for use elsewhere
export { IMAGE_CONFIG, getOptimizedUrl, generateSrcSet, isTransformableCDN };

export default OptimizedImage;
