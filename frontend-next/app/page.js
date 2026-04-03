import Header from '../components/Header';
import Hero from '../components/Hero';
import FragranceGridServer from '../components/FragranceGridServer';
import USPSection from '../components/USPSection';
import PackagingSection from '../components/PackagingSection';
import CSRSection from '../components/CSRSection';
import InstagramFeed from '../components/InstagramFeed';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Fetch products server-side for reliable initial load
async function getProducts() {
  try {
    // Use NEXT_PUBLIC_BACKEND_URL for server-side fetching (required for Vercel)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || API_URL;
    
    const response = await fetch(`${backendUrl}/api/products`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });
    
    if (!response.ok) {
      console.error('Failed to fetch products:', response.status);
      return [];
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export default async function HomePage() {
  // Fetch products server-side - always works reliably
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
