import './globals.css';
import { Toaster } from 'sonner';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { WishlistProvider } from '../context/WishlistContext';
import { ThemeProvider } from '../context/ThemeContext';
import CartSidebar from '../components/CartSidebar';

export const metadata = {
  title: {
    default: 'Addrika - Premium Incense | Sacred Luxury in Every Scent',
    template: '%s | Addrika Premium Incense'
  },
  description: 'Discover Addrika premium incense sticks. Experience authentic Arabian fragrances - Kesar Chandan, Regal Rose, Oriental Oudh & Bold Bakhoor. Zero charcoal, low smoke, ethically sourced ingredients. Sacred luxury for mindful spaces.',
  keywords: ['addrika', 'premium incense', 'incense sticks', 'agarbatti', 'kesar chandan', 'regal rose', 'oriental oudh', 'bold bakhoor', 'arabian incense', 'zero charcoal incense', 'low smoke agarbatti', 'dhoop', 'bambooless incense', 'ethical incense'],
  authors: [{ name: 'Centsibl Traders Private Limited', url: 'https://centraders.com' }],
  creator: 'Centsibl Traders',
  publisher: 'Centsibl Traders Private Limited',
  metadataBase: new URL('https://centraders.com'),
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://centraders.com',
    siteName: 'Addrika',
    title: 'Addrika - Premium Incense | Zero Charcoal, Low Smoke',
    description: 'Sacred luxury in every scent. Premium incense from Centsibl Traders. Charcoal-free, 60%+ less smoke, ethically sourced.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Addrika Premium Incense - Zero Charcoal, Low Smoke',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Addrika - Premium Incense',
    description: 'Sacred luxury in every scent. Zero charcoal, low smoke, ethically sourced.',
    images: ['/og-image.png'],
    creator: '@addrika_incense',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'ecommerce',
  classification: 'Shopping > Home & Garden > Home Fragrance > Incense',
};

// Viewport configuration (separated from metadata in Next.js 14+)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#D4AF37' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1419' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external resources for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Favicon */}
        <link rel="icon" href="/images/logos/addrika-logo-gold-cropped.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/pwa-icons/icon-192x192.png" />
        
        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Centsibl Traders Private Limited",
              "alternateName": "Addrika",
              "url": "https://centraders.com",
              "logo": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png",
              "description": "Premium incense manufacturer offering authentic arabian fragrances. Zero charcoal, low smoke, ethically sourced ingredients.",
              "foundingDate": "2022",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
                "addressRegion": "India"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "email": "contact.us@centraders.com"
              },
              "sameAs": [
                "https://www.instagram.com/addrika.fragrances"
              ]
            })
          }}
        />
        
        {/* Structured Data - WebSite with Search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Addrika - Premium Natural Incense",
              "alternateName": "Addrika Fragrances",
              "url": "https://centraders.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://centraders.com/?search={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        
        {/* Structured Data - Local Business */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Store",
              "name": "Addrika Incense Store",
              "image": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png",
              "url": "https://centraders.com",
              "priceRange": "₹₹",
              "servesCuisine": "N/A",
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Premium Natural Incense",
                "itemListElement": [
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Product",
                      "name": "Kesar Chandan Premium Incense"
                    }
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Product",
                      "name": "Regal Rose Premium Incense"
                    }
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Product",
                      "name": "Oriental Oudh Premium Incense"
                    }
                  },
                  {
                    "@type": "Offer",
                    "itemOffered": {
                      "@type": "Product",
                      "name": "Bold Bakhoor Premium Incense"
                    }
                  }
                ]
              }
            })
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-[#0f1419] antialiased">
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                {children}
                <CartSidebar />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
