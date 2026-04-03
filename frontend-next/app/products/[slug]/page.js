import Link from 'next/link';
import Image from 'next/image';
import { Star, ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import ProductActions from './ProductActions';
import ProductGallery from './ProductGallery';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';

// For server-side fetches, we need an absolute URL
// NEXT_PUBLIC_BACKEND_URL is the actual backend server
// NEXT_PUBLIC_API_URL can be empty for client-side relative URLs with rewrites
const getServerApiUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
};

// Generate static params for all products (SSG)
export async function generateStaticParams() {
  try {
    const apiUrl = getServerApiUrl();
    const res = await fetch(`${apiUrl}/api/products`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const products = await res.json();
    return products.map((product) => ({
      slug: product.id,
    }));
  } catch (error) {
    console.error('Failed to generate static params:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  const product = await getProduct(params.slug);
  
  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }
  
  const lowestPrice = Math.min(...product.sizes.map(s => s.price));
  
  return {
    title: `${product.name} - ${product.tagline} | Buy Online`,
    description: `${product.description} Available in multiple sizes starting from ₹${lowestPrice}. Zero charcoal, low smoke, 100% natural. Free shipping above ₹499.`,
    keywords: [product.name, ...product.notes, 'premium incense', 'agarbatti', 'addrika', 'buy online', 'zero charcoal', 'low smoke'].join(', '),
    alternates: {
      canonical: `https://centraders.com/products/${params.slug}`,
    },
    openGraph: {
      title: `${product.name} | Addrika Premium Incense - Buy Online`,
      description: `${product.description} Starting from ₹${lowestPrice}.`,
      images: [{ url: product.image, width: 1200, height: 630, alt: `${product.name} - Addrika Premium Incense` }],
      type: 'website',
      url: `https://centraders.com/products/${params.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | Addrika`,
      description: `${product.tagline}. Starting ₹${lowestPrice}. Zero charcoal, low smoke.`,
      images: [product.image],
    },
  };
}

// Fetch single product
async function getProduct(slug) {
  try {
    const apiUrl = getServerApiUrl();
    const res = await fetch(`${apiUrl}/api/products/${slug}`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return null;
  }
}

// Fetch all products for related section
async function getAllProducts() {
  try {
    const apiUrl = getServerApiUrl();
    const res = await fetch(`${apiUrl}/api/products`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

// Product structured data for SEO
function ProductStructuredData({ product }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": product.sizes?.map(s => s.images?.[0]).filter(Boolean) || [product.image],
    "description": product.description,
    "sku": product.id,
    "url": `https://centraders.com/products/${product.id}`,
    "brand": {
      "@type": "Brand",
      "name": "Addrika"
    },
    "category": product.category === 'dhoop' ? "Incense > Premium Dhoop" : "Incense > Premium Agarbatti",
    "material": product.category === 'dhoop' ? "Natural herbs, Essential oils, Bambooless" : "Natural herbs, Essential oils, Bamboo core",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Charcoal Content",
        "value": "Zero Charcoal (Charcoal-Free)"
      },
      {
        "@type": "PropertyValue",
        "name": "Burn Time",
        "value": product.burnTime || (product.category === 'dhoop' ? "20-30 minutes" : "40-50 minutes")
      },
      {
        "@type": "PropertyValue",
        "name": "Smoke Level",
        "value": "Low Smoke (80% less than traditional)"
      },
      {
        "@type": "PropertyValue",
        "name": "Suitable For",
        "value": "Daily Puja, Meditation, Yoga, Aromatherapy, Home Fragrance"
      }
    ],
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "INR",
      "lowPrice": Math.min(...product.sizes.map(s => s.price)),
      "highPrice": Math.max(...product.sizes.map(s => s.price)),
      "offerCount": product.sizes.length,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Centsibl Traders Private Limited",
        "url": "https://centraders.com"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "reviewCount": product.reviews,
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  // Breadcrumb structured data
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://centraders.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Fragrances",
        "item": "https://centraders.com/#fragrances"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": product.name,
        "item": `https://centraders.com/products/${product.id}`
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
    </>
  );
}

// Related Product Card - Dark Theme
function RelatedProductCard({ product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2"
      style={{ 
        background: 'linear-gradient(165deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)'
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#16213e] via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-xs font-medium mb-1 text-[#D4AF37]">{product.tagline}</p>
          <h3 className="text-lg font-bold text-white">{product.name}</h3>
        </div>
      </div>
      <div className="p-4" style={{ background: 'linear-gradient(180deg, rgba(22,33,62,0.95) 0%, rgba(26,26,46,1) 100%)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Star size={14} fill="#D4AF37" color="#D4AF37" />
            <span className="text-sm font-semibold text-white">{product.rating}</span>
            <span className="text-xs text-gray-400">({product.reviews})</span>
          </div>
          <span className="text-lg font-bold text-[#D4AF37]">₹{product.sizes[0]?.price}</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-[#D4AF37]">
          View Details
          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

// Main Product Page (Server Component)
export default async function ProductPage({ params }) {
  const [product, allProducts] = await Promise.all([
    getProduct(params.slug),
    getAllProducts()
  ]);
  
  if (!product) {
    notFound();
  }
  
  const relatedProducts = allProducts.filter(p => p.id !== params.slug).slice(0, 3);
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      {/* Structured Data */}
      <ProductStructuredData product={product} />
      
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 mb-8 text-sm">
            <Link href="/" className="hover:text-[#D4AF37] transition-colors text-gray-300">
              Home
            </Link>
            <span className="text-gray-600">/</span>
            <Link href="/#fragrances" className="hover:text-[#D4AF37] transition-colors text-gray-300">
              Fragrances
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-[#D4AF37]">{product.name}</span>
          </nav>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Image Gallery - Dynamic based on selected size */}
            <ProductGallery product={product} />
            
            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2 text-[#D4AF37]">{product.tagline}</p>
                <h1 
                  className="text-3xl sm:text-4xl font-bold mb-4 text-white"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {product.name}
                </h1>
                
                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={18}
                        fill={i < Math.floor(product.rating) ? '#D4AF37' : 'transparent'}
                        color="#D4AF37"
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-400">
                    {product.rating} ({product.reviews} reviews)
                  </span>
                </div>
                
                <p className="text-lg leading-relaxed text-gray-300">
                  {product.description}
                </p>
              </div>
              
              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide text-gray-500">
                  Fragrance Notes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.notes?.map((note, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{ 
                        background: 'rgba(212,175,55,0.15)',
                        color: '#D4AF37',
                        border: '1px solid rgba(212,175,55,0.3)'
                      }}
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Burn Time */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Burn Time:</span>
                <span className="font-semibold text-[#D4AF37]">{product.burnTime}</span>
              </div>
              
              {/* Client-side Actions (Add to Cart, etc.) */}
              <ProductActions product={product} />
              
              {/* Trust Badges */}
              <div 
                className="grid grid-cols-3 gap-4 pt-6 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <div className="text-center">
                  <p className="font-semibold text-sm text-white">Free Shipping</p>
                  <p className="text-xs text-gray-500">Orders above ₹499</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-white">Natural Ingredients</p>
                  <p className="text-xs text-gray-500">100% Pure</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-white">Easy Returns</p>
                  <p className="text-xs text-gray-500">7-day policy</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div 
              className="mt-16 pt-12 border-t"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 
                    className="text-2xl sm:text-3xl font-bold text-white"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    You May Also Like
                  </h2>
                  <p className="text-sm mt-1 text-gray-500">
                    Explore more premium fragrances from our collection
                  </p>
                </div>
                <Link
                  href="/#fragrances"
                  className="hidden sm:flex items-center gap-1 text-sm font-medium text-[#D4AF37] hover:opacity-70 transition-opacity"
                >
                  View All
                  <ArrowRight size={16} />
                </Link>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedProducts.map((relatedProduct) => (
                  <RelatedProductCard key={relatedProduct.id} product={relatedProduct} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
