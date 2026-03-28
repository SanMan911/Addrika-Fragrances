import Link from 'next/link';
import Image from 'next/image';
import { Star, ChevronLeft, ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import ProductActions from './ProductActions';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ecommerce-nextjs-2.preview.emergentagent.com';

// Generate static params for all products (SSG)
export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_URL}/api/products`);
    const products = await res.json();
    return products.map((product) => ({
      slug: product.id,
    }));
  } catch (error) {
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
  
  return {
    title: `${product.name} - ${product.tagline}`,
    description: product.description,
    keywords: [product.name, ...product.notes, 'premium incense', 'agarbatti', 'addrika'].join(', '),
    openGraph: {
      title: `${product.name} | Addrika Premium Incense`,
      description: product.description,
      images: [{ url: product.image, width: 1200, height: 630, alt: product.name }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description,
      images: [product.image],
    },
  };
}

// Fetch single product
async function getProduct(slug) {
  try {
    const res = await fetch(`${API_URL}/api/products/${slug}`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    return null;
  }
}

// Fetch all products for related section
async function getAllProducts() {
  try {
    const res = await fetch(`${API_URL}/api/products`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

// Product structured data for SEO - Enhanced for LLM extraction
function ProductStructuredData({ product }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `${product.name} - Premium Zero Charcoal Incense Sticks`,
    "description": product.description,
    "image": product.image,
    "brand": {
      "@type": "Brand",
      "name": "Addrika Fragrances",
      "url": "https://centraders.com"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "Centsibl Traders Private Limited",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "IN"
      }
    },
    "countryOfOrigin": "India",
    "material": "Natural flower dust, pure essential oils, natural resins - 100% Charcoal-free",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "burnTime",
        "value": "PT50M",
        "unitText": "40-50 minutes extended burn"
      },
      {
        "@type": "PropertyValue",
        "name": "smokeEmission",
        "value": "Low",
        "description": "80% less smoke than traditional agarbatti"
      },
      {
        "@type": "PropertyValue",
        "name": "charcoalFree",
        "value": true,
        "description": "Zero charcoal - completely charcoal-free formula"
      },
      {
        "@type": "PropertyValue",
        "name": "ingredients",
        "value": "100% Natural - Pure essential oils, flower dust, natural resins"
      },
      {
        "@type": "PropertyValue",
        "name": "bambooCore",
        "value": false,
        "description": "Bambooless design for pure fragrance"
      },
      {
        "@type": "PropertyValue",
        "name": "suitableFor",
        "value": "Daily puja, meditation, yoga, aromatherapy, small apartments, indoor use"
      },
      {
        "@type": "PropertyValue",
        "name": "safeForIndoorUse",
        "value": true,
        "description": "Non-toxic, safe for indoor use with children and pets"
      }
    ],
    "category": "Premium Natural Incense Sticks",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "INR",
      "lowPrice": Math.min(...product.sizes.map(s => s.mrp)),
      "highPrice": Math.max(...product.sizes.map(s => s.mrp)),
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Centsibl Traders Private Limited"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "IN"
        }
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "reviewCount": product.reviews,
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": product.rating,
        "bestRating": "5"
      },
      "author": {
        "@type": "Person",
        "name": "Verified Buyer"
      },
      "reviewBody": `Premium quality ${product.name} incense with authentic fragrance. Low smoke, perfect for daily puja and meditation. The scent lasts for hours after burning.`
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Breadcrumb structured data
function BreadcrumbStructuredData({ product }) {
  const structuredData = {
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
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Related Product Card
function RelatedProductCard({ product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 bg-white"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-xs font-medium mb-1 text-[#D4AF37]">{product.tagline}</p>
          <h3 className="text-lg font-bold text-white">{product.name}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Star size={14} fill="#D4AF37" color="#D4AF37" />
            <span className="text-sm font-semibold text-[#2B3A4A]">{product.rating}</span>
            <span className="text-xs text-gray-500">({product.reviews})</span>
          </div>
          <span className="text-lg font-bold text-[#2B3A4A]">₹{product.sizes[0]?.mrp}</span>
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
    <>
      {/* Structured Data */}
      <ProductStructuredData product={product} />
      <BreadcrumbStructuredData product={product} />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#fragrances" className="hover:text-[#D4AF37] transition-colors">Fragrances</Link>
            <Link href="/our-story" className="hover:text-[#D4AF37] transition-colors">Our Story</Link>
            <Link href="/about-us" className="hover:text-[#D4AF37] transition-colors">About Us</Link>
            <Link href="/find-retailers" className="hover:text-[#D4AF37] transition-colors">Find Retailers</Link>
          </nav>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 mb-8 text-sm">
            <Link href="/" className="hover:text-[#D4AF37] transition-colors text-[#2B3A4A]">
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <Link href="/#fragrances" className="hover:text-[#D4AF37] transition-colors text-[#2B3A4A]">
              Fragrances
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">{product.name}</span>
          </nav>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </div>
            
            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2 text-[#D4AF37]">{product.tagline}</p>
                <h1 className="text-3xl sm:text-4xl font-bold mb-4 font-serif text-[#2B3A4A]">
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
                  <span className="text-sm text-gray-500">
                    {product.rating} ({product.reviews} reviews)
                  </span>
                </div>
                
                <p className="text-lg leading-relaxed text-gray-700">
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
                      className="px-3 py-1 rounded-full text-sm bg-[#D4AF37]/15 text-[#2B3A4A]"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Burn Time */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Burn Time:</span>
                <span className="font-semibold text-[#2B3A4A]">{product.burnTime}</span>
              </div>
              
              {/* Client-side Actions (Add to Cart, etc.) */}
              <ProductActions product={product} />
              
              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="font-semibold text-sm text-[#2B3A4A]">Free Shipping</p>
                  <p className="text-xs text-gray-500">Orders above ₹499</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-[#2B3A4A]">Natural Ingredients</p>
                  <p className="text-xs text-gray-500">100% Pure</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-[#2B3A4A]">Easy Returns</p>
                  <p className="text-xs text-gray-500">7-day policy</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16 pt-12 border-t border-gray-200">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[#2B3A4A]">
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
      <footer className="bg-[#2B3A4A] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
