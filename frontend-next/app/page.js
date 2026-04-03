import Header from '../components/Header';
import Hero from '../components/Hero';
import FragranceGridServer from '../components/FragranceGridServer';
import USPSection from '../components/USPSection';
import PackagingSection from '../components/PackagingSection';
import CSRSection from '../components/CSRSection';
import InstagramFeed from '../components/InstagramFeed';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';

// Production backend URL - hardcoded as fallback for Vercel
const PRODUCTION_BACKEND = 'https://product-size-sync.preview.emergentagent.com';

// Fetch products server-side for reliable initial load
async function getProducts() {
  // Try multiple backend URLs in order of preference
  const backendUrls = [
    process.env.NEXT_PUBLIC_BACKEND_URL,
    PRODUCTION_BACKEND,
  ].filter(Boolean);

  for (const backendUrl of backendUrls) {
    try {
      const response = await fetch(`${backendUrl}/api/products`, {
        next: { revalidate: 60 }, // Revalidate every minute
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const products = await response.json();
        if (Array.isArray(products) && products.length > 0) {
          return products;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch from ${backendUrl}:`, error.message);
    }
  }
  
  return [];
}

export default async function HomePage() {
  // Fetch products server-side
  const products = await getProducts();
  
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <FragranceGridServer initialProducts={products} />
      <USPSection />
      <PackagingSection />
      <CSRSection />
      <InstagramFeed />
      <CTASection />
      <Footer />
    </div>
  );
}
