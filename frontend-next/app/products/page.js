import Header from '../../components/Header';
import Footer from '../../components/Footer';
import FragranceGridServer from '../../components/FragranceGridServer';
import BRAND from '../../lib/brand.config';

export const metadata = {
  title: `All Fragrances — Agarbatti, Dhoop & Bakhoor`,
  description: `Browse every ${BRAND.name} fragrance: charcoal-free agarbatti, bambooless dhoop and Arabian bakhoor. Ethically sourced, 60%+ less smoke. Ships across India.`,
  alternates: { canonical: `https://${BRAND.domain}/products` },
  openGraph: {
    title: `All ${BRAND.name} Fragrances`,
    description: 'Charcoal-free agarbatti, bambooless dhoop and Arabian bakhoor — the complete collection.',
    url: `https://${BRAND.domain}/products`,
  },
};

async function getProducts() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return [];
  try {
    const res = await fetch(`${backendUrl}/api/products`, { next: { revalidate: 60 }, headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <div className="min-h-screen" data-testid="products-page">
      <Header />
      <div className="pt-28 pb-4 px-4 text-center" style={{ background: 'var(--bg-primary, #0f1419)' }}>
        <p className="text-xs tracking-[3px] uppercase" style={{ color: BRAND.colors.gold }}>The complete collection</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mt-2" style={{ fontFamily: "'Playfair Display', serif", color: '#e8e6e3' }}>
          All Fragrances
        </h1>
        <p className="text-base md:text-lg mt-3 max-w-2xl mx-auto" style={{ color: 'rgba(232,230,227,0.7)' }}>
          Charcoal-free agarbatti, bambooless dhoop and Arabian bakhoor — pick a size, add to cart, and we ship across India.
        </p>
      </div>
      <FragranceGridServer initialProducts={products} />
      <Footer />
    </div>
  );
}
