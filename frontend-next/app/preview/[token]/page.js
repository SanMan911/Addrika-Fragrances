'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight, Package } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

/**
 * Founding Retailer Early-Access landing page.
 * The batch-ready launch broadcast links here (`/preview/{signed-token}`).
 * We exchange the token for the SKU on the backend and show a private
 * preview of the product while it's hidden from the public catalog.
 */
export default function PreviewPage() {
  const params = useParams();
  const token = params?.token;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/preview/resolve/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Link expired');
        setProduct(data.product);
      } catch (e) {
        setErr(e.message || 'Preview link expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#0f1419] flex items-center justify-center p-6" data-testid="preview-expired">
        <div className="max-w-md text-center">
          <Sparkles size={40} className="text-[#D4AF37] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Preview link expired</h1>
          <p className="text-slate-400 mb-6">{err}</p>
          <Link href="/collection" className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline">
            Browse the public catalog <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const cheapestSize = (product?.sizes || []).reduce(
    (acc, s) => (!acc || Number(s.price) < Number(acc.price)) ? s : acc, null
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] via-[#0f1419] to-[#1a2332]" data-testid="preview-page">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold mb-6" data-testid="preview-badge">
          <Sparkles size={14} /> FOUNDING RETAILER EARLY ACCESS
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="rounded-2xl overflow-hidden border border-[#D4AF37]/20 bg-slate-800/50">
            {product?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={product.name} className="w-full h-auto object-cover" />
            ) : (
              <div className="aspect-square flex items-center justify-center text-slate-500">
                <Package size={80} />
              </div>
            )}
          </div>

          <div className="text-white">
            <h1 className="text-4xl font-bold mb-2" data-testid="preview-product-name">{product?.name}</h1>
            {product?.tagline && <p className="text-lg text-[#D4AF37] mb-4">{product.tagline}</p>}
            {product?.description && <p className="text-slate-300 mb-6">{product.description}</p>}

            {cheapestSize && (
              <div className="mb-6">
                <div className="text-xs text-slate-400 uppercase tracking-wider">From</div>
                <div className="text-3xl font-bold text-[#D4AF37]">{inr(cheapestSize.price)}</div>
              </div>
            )}

            {product?.sizes?.length > 0 && (
              <div className="space-y-2 mb-6">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Available sizes</div>
                {product.sizes.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <span className="text-white font-medium">{s.size}</span>
                    <span className="text-[#D4AF37]">{inr(s.price)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/retailer/b2b"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] hover:bg-[#c19f2e] text-[#1a2332] font-semibold"
                data-testid="preview-b2b-cta"
              >
                Order Wholesale <ArrowRight size={16} />
              </Link>
              <Link
                href="/collection"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-600 hover:border-[#D4AF37] text-white"
              >
                Public Catalog
              </Link>
            </div>

            <p className="text-xs text-slate-500 mt-6">
              This SKU is exclusive to our Founding Retailer network until it launches publicly. Share the link privately if you&apos;d like to loop in a partner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
