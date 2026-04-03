import Header from '../components/Header';
import Hero from '../components/Hero';
import FragranceGridServer from '../components/FragranceGridServer';
import USPSection from '../components/USPSection';
import PackagingSection from '../components/PackagingSection';
import CSRSection from '../components/CSRSection';
import InstagramFeed from '../components/InstagramFeed';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';

// Fetch products server-side for reliable initial load
// IMPORTANT: Set NEXT_PUBLIC_BACKEND_URL in Vercel Environment Variables
async function getProducts() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  
  if (!backendUrl) {
    console.warn('NEXT_PUBLIC_BACKEND_URL not set. Products will not load.');
    return [];
  }
  
  const backendUrls = [backendUrl].filter(Boolean);

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
