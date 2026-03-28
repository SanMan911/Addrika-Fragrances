import Link from 'next/link';
import Image from 'next/image';
import { Star, ShoppingCart, ArrowRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ecommerce-nextjs-2.preview.emergentagent.com';

// Server-side data fetching - This runs on the server
async function getProducts() {
  try {
    const res = await fetch(`${API_URL}/api/products`, {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

// Product ItemList structured data for SEO
function ProductsStructuredData({ products }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Addrika Premium Incense Collection",
    "description": "Four exquisite aromatic blends of premium natural incense sticks",
    "itemListElement": products.map((product, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Product",
        "name": product.name,
        "description": product.description,
        "image": product.image,
        "brand": { "@type": "Brand", "name": "Addrika" },
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "INR",
          "lowPrice": Math.min(...product.sizes.map(s => s.mrp)),
          "highPrice": Math.max(...product.sizes.map(s => s.mrp)),
          "availability": "https://schema.org/InStock"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": product.rating,
          "reviewCount": product.reviews
        }
      }
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Product Card Component
function ProductCard({ product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 bg-white"
    >
      {/* Product Image */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Overlay Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <p className="text-xs font-medium mb-1 text-[#D4AF37]">
            {product.tagline}
          </p>
          <h3 className="text-2xl font-bold font-serif mb-2 drop-shadow-lg">
            {product.name}
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Star size={14} fill="#D4AF37" color="#D4AF37" />
              <span className="text-sm font-semibold">{product.rating}</span>
            </div>
            <span className="text-xs opacity-75">({product.reviews} reviews)</span>
          </div>
          <p className="text-sm opacity-90 line-clamp-2">
            {product.description}
          </p>
        </div>
      </div>
      
      {/* Price & CTA */}
      <div className="p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500">Starting from</span>
            <p className="text-2xl font-bold text-[#2B3A4A]">
              ₹{product.sizes[0]?.mrp}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[#D4AF37] font-medium group-hover:translate-x-1 transition-transform">
            View Details
            <ArrowRight size={16} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// Homepage Component (Server Component by default in App Router)
export default async function HomePage() {
  const products = await getProducts();
  
  return (
    <>
      {/* Structured Data for Products */}
      <ProductsStructuredData products={products} />
      
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center bg-gradient-to-br from-[#2B3A4A] to-[#1a252f]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('/pattern.svg')] bg-repeat opacity-10" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <p className="text-[#D4AF37] text-sm font-medium tracking-widest uppercase mb-4 animate-fade-in">
            Premium Natural Incense
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white font-serif mb-6 animate-slide-up">
            Sacred Luxury in Every Scent
          </h1>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto animate-fade-in">
            Experience the timeless art of fragrance with Addrika&apos;s handcrafted incense collection. 
            Each stick is a journey into serenity.
          </p>
          <Link
            href="#fragrances"
            className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
          >
            <ShoppingCart size={20} />
            Explore Collection
          </Link>
        </div>
      </section>
      
      {/* Products Section */}
      <section id="fragrances" className="py-20 px-4 bg-[#F5F0E8]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2B3A4A] font-serif mb-4">
              Our Signature Collection
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Four exquisite aromatic blends, each crafted to transform your space into a sanctuary of peace and mindfulness.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
      
      {/* Trust Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-[#D4AF37] mb-2">100%</p>
              <p className="text-sm text-gray-600">Natural Ingredients</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#D4AF37] mb-2">40-50 Min</p>
              <p className="text-sm text-gray-600">Burn Time</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#D4AF37] mb-2">Free</p>
              <p className="text-sm text-gray-600">Shipping ₹499+</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#D4AF37] mb-2">7 Days</p>
              <p className="text-sm text-gray-600">Easy Returns</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-[#D4AF37] mb-4">Addrika</h3>
              <p className="text-sm text-gray-400">
                Sacred luxury in every scent. Premium natural incense from Centsibl Traders Private Limited.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/#fragrances" className="hover:text-white transition-colors">Fragrances</Link></li>
                <li><Link href="/our-story" className="hover:text-white transition-colors">Our Story</Link></li>
                <li><Link href="/about-us" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/find-retailers" className="hover:text-white transition-colors">Find Retailers</Link></li>
                <li><Link href="/shipping-returns" className="hover:text-white transition-colors">Shipping & Returns</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <p className="text-sm text-gray-400">contact.us@centraders.com</p>
              <p className="text-sm text-gray-400 mt-2">(+91) 9667-269-711</p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
