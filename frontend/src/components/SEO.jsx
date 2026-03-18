/**
 * SEO Component - Dynamic meta tags and structured data for better crawlability
 */
import React from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';

// Default SEO values
const defaultSEO = {
  title: 'Addrika | Premium Incense Sticks - Sacred Luxury in Every Scent',
  description: 'Discover authentic arabic oud ambiance with Addrika\'s premium natural incense. Featuring Kesar Chandan, Regal Rose, Oriental Oudh & Bold Bakhoor - perfect for mindfulness practices and spiritual connection.',
  keywords: 'addrika, premium incense sticks, natural incense, agarbatti, kesar chandan, regal rose, oriental oudh, bold bakhoor, arabian incense, oud bakhoor, agarwood, wood of the gods, authentic arabic oudh fragrance, premium natural bhakhoor, long lasting fragrance, home aromatherapy, sacred spaces, mindfulness practices, tranquility, relaxation, spiritual connection, islamic scents, thoughtful islamic gift, centsibl traders',
  image: 'https://centraders.com/og-image.png',
  url: 'https://centraders.com',
  siteName: 'Addrika by Centsibl Traders'
};

// Organization structured data
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Centsibl Traders Private Limited",
  "alternateName": "Addrika",
  "url": "https://centraders.com",
  "logo": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png",
  "description": "Premium natural incense manufacturer offering authentic arabian fragrances",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "IN"
  },
  "sameAs": [
    "https://www.instagram.com/addrika.in"
  ]
};

// Product List structured data
const productListSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Addrika Premium Incense Collection",
  "description": "Four exquisite aromatic blends of premium natural incense",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Product",
        "name": "Kesar Chandan",
        "description": "Saffron Sandalwood premium incense with sacred luxury blend",
        "brand": { "@type": "Brand", "name": "Addrika" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": "110",
          "availability": "https://schema.org/InStock"
        }
      }
    },
    {
      "@type": "ListItem",
      "position": 2,
      "item": {
        "@type": "Product",
        "name": "Regal Rose",
        "description": "Pink Lotus & Ylang Ylang floral incense blend",
        "brand": { "@type": "Brand", "name": "Addrika" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": "110",
          "availability": "https://schema.org/InStock"
        }
      }
    },
    {
      "@type": "ListItem",
      "position": 3,
      "item": {
        "@type": "Product",
        "name": "Oriental Oudh",
        "description": "Premium Agarwood oud incense with authentic fragrance",
        "brand": { "@type": "Brand", "name": "Addrika" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": "402",
          "availability": "https://schema.org/InStock"
        }
      }
    },
    {
      "@type": "ListItem",
      "position": 4,
      "item": {
        "@type": "Product",
        "name": "Bold Bakhoor",
        "description": "Traditional essence maghreb bakhoor incense",
        "brand": { "@type": "Brand", "name": "Addrika" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "INR",
          "price": "110",
          "availability": "https://schema.org/InStock"
        }
      }
    }
  ]
};

// Website structured data
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Addrika",
  "url": "https://centraders.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://centraders.com/?search={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

// Breadcrumb structured data generator
const generateBreadcrumbSchema = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

/**
 * SEO Component
 * @param {Object} props - SEO properties
 * @param {string} props.title - Page title
 * @param {string} props.description - Meta description
 * @param {string} props.keywords - Meta keywords
 * @param {string} props.image - OG image URL
 * @param {string} props.url - Canonical URL
 * @param {string} props.type - OG type (website, product, article)
 * @param {Array} props.breadcrumbs - Breadcrumb items [{name, url}]
 * @param {Object} props.product - Product data for product pages
 */
export const SEO = ({ 
  title, 
  description, 
  keywords, 
  image, 
  url, 
  type = 'website',
  breadcrumbs,
  product,
  noIndex = false
}) => {
  const seo = {
    title: title || defaultSEO.title,
    description: description || defaultSEO.description,
    keywords: keywords || defaultSEO.keywords,
    image: image || defaultSEO.image,
    url: url || defaultSEO.url,
  };

  // Generate product schema if product data provided
  const productSchema = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.image,
    "brand": {
      "@type": "Brand",
      "name": "Addrika"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": product.price,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Centsibl Traders Private Limited"
      }
    },
    "aggregateRating": product.rating ? {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "reviewCount": product.reviewCount
    } : undefined
  } : null;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{seo.title}</title>
      <meta name="title" content={seo.title} />
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={seo.url} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:site_name" content={defaultSEO.siteName} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={seo.url} />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
      
      {/* Structured Data - Organization */}
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      
      {/* Structured Data - Website */}
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      
      {/* Structured Data - Product List (only on homepage) */}
      {type === 'website' && (
        <script type="application/ld+json">
          {JSON.stringify(productListSchema)}
        </script>
      )}
      
      {/* Structured Data - Product (for product pages) */}
      {productSchema && (
        <script type="application/ld+json">
          {JSON.stringify(productSchema)}
        </script>
      )}
      
      {/* Structured Data - Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(generateBreadcrumbSchema(breadcrumbs))}
        </script>
      )}
    </Helmet>
  );
};

// SEO Provider wrapper - use at app root
export const SEOProvider = ({ children }) => (
  <HelmetProvider>
    {children}
  </HelmetProvider>
);

export default SEO;
