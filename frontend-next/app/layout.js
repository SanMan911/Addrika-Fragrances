import './globals.css';
import { Toaster } from 'sonner';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { WishlistProvider } from '../context/WishlistContext';
import { ThemeProvider } from '../context/ThemeContext';
import CartSidebar from '../components/CartSidebar';
import WhatsAppButton from '../components/WhatsAppButton';
import CookieConsentAndGA from '../components/CookieConsentAndGA';

export const metadata = {
  title: {
    default: 'Addrika - Premium Incense | Sacred Luxury in Every Scent',
    template: '%s | Addrika Premium Incense'
  },
  description: 'Addrika Fragrances by Centsibl Traders — India\'s premium charcoal-free incense brand. Shop luxury agarbatti (Kesar Chandan, Regal Rose, Oriental Oudh), bambooless dhoop, and authentic Arabian bakhoor (Omani & Yemeni). Over 60% less smoke, ethically sourced ingredients. Perfect for meditation, yoga, puja, and luxury home fragrance. Free shipping above ₹499.',
  keywords: ['addrika', 'addrika fragrances', 'premium incense', 'luxury incense sticks', 'incense sticks for meditation', 'agarbatti', 'charcoal-free incense', 'low smoke agarbatti', 'kesar chandan incense', 'regal rose incense', 'oriental oudh', 'bakhoor', 'arabian bakhoor', 'bambooless dhoop', 'meditation incense', 'yoga incense', 'puja agarbatti', 'luxury home fragrance india', 'ethical incense', 'premium agarbatti online', 'buy incense online india', 'natural incense sticks', 'best incense for meditation', 'incense gift set india'],
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
    siteName: 'Addrika Fragrances',
    title: 'Addrika Fragrances - Premium Charcoal-Free Incense | Agarbatti, Dhoop & Bakhoor',
    description: 'India\'s premium charcoal-free incense brand. Luxury agarbatti, bambooless dhoop & authentic Arabian bakhoor. Over 60% less smoke. Perfect for meditation, yoga & puja. Free shipping above ₹499.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Addrika Fragrances - Premium Charcoal-Free Incense, Agarbatti, Dhoop & Bakhoor',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Addrika Fragrances - Premium Incense for Meditation & Luxury',
    description: 'Charcoal-free agarbatti, bambooless dhoop & authentic Arabian bakhoor. Over 60% less smoke, ethically sourced. Shop now.',
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
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || '',
  },
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
        {/* Google tag (gtag.js) — direct injection per Google's setup instructions,
            loads on every page including admin/retailer. */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-9CBN63VGCK"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-9CBN63VGCK');
            `,
          }}
        />

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
              "alternateName": ["Addrika", "Addrika Fragrances", "Addrika Incense"],
              "url": "https://centraders.com",
              "logo": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png",
              "description": "Addrika is India's premium charcoal-free incense brand offering luxury agarbatti, bambooless dhoop, and authentic Arabian bakhoor. Ethically sourced ingredients, over 60% less smoke. Perfect for meditation, yoga, puja, and luxury home fragrance.",
              "foundingDate": "2022",
              "knowsAbout": [
                "Premium Incense Manufacturing",
                "Charcoal-Free Agarbatti",
                "Bambooless Dhoop",
                "Arabian Bakhoor",
                "Meditation Incense",
                "Luxury Home Fragrance",
                "Ethically Sourced Incense"
              ],
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
                "addressRegion": "India"
              },
              "contactPoint": [
                {
                  "@type": "ContactPoint",
                  "contactType": "customer service",
                  "email": "contact.us@centraders.com",
                  "availableLanguage": ["English", "Hindi"]
                },
                {
                  "@type": "ContactPoint",
                  "contactType": "sales",
                  "telephone": "+91-96672-69711",
                  "contactOption": "TollFree",
                  "availableLanguage": ["English", "Hindi"]
                }
              ],
              "sameAs": [
                "https://www.instagram.com/addrika.fragrances"
              ],
              "brand": {
                "@type": "Brand",
                "name": "Addrika",
                "alternateName": "Addrika Fragrances",
                "slogan": "Sacred Luxury in Every Scent",
                "logo": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png"
              }
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
              "alternateName": ["Addrika Fragrances", "Addrika Incense Store", "Centraders"],
              "url": "https://centraders.com",
              "description": "Shop premium charcoal-free incense sticks, bambooless dhoop, and authentic Arabian bakhoor from Addrika. Over 60% less smoke, ethically sourced, perfect for meditation and luxury home fragrance.",
              "inLanguage": "en-IN",
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
        
        {/* Structured Data - Online Store with Full Catalog */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Store",
              "name": "Addrika Incense Store",
              "alternateName": "Addrika Fragrances Online Store",
              "image": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png",
              "url": "https://centraders.com",
              "description": "Official online store for Addrika premium incense. Buy charcoal-free agarbatti, bambooless dhoop, and Arabian bakhoor with free shipping above ₹499 across India.",
              "priceRange": "₹110 - ₹399",
              "currenciesAccepted": "INR",
              "paymentAccepted": "UPI, Credit Card, Debit Card, Net Banking, Razorpay",
              "areaServed": {
                "@type": "Country",
                "name": "India"
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Addrika Premium Natural Incense Collection",
                "itemListElement": [
                  {
                    "@type": "OfferCatalog",
                    "name": "Premium Agarbatti (Incense Sticks)",
                    "itemListElement": [
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Kesar Chandan Premium Incense", "url": "https://centraders.com/products/kesar-chandan" } },
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Regal Rose Premium Incense", "url": "https://centraders.com/products/regal-rose" } },
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Oriental Oudh Premium Incense", "url": "https://centraders.com/products/oriental-oudh" } },
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Bold Bakhoor Premium Incense", "url": "https://centraders.com/products/bold-bakhoor" } },
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Royal Kewda Premium Incense", "url": "https://centraders.com/products/royal-kewda" } }
                    ]
                  },
                  {
                    "@type": "OfferCatalog",
                    "name": "Premium Bambooless Dhoop",
                    "itemListElement": [
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Mystical Meharishi Bambooless Dhoop", "url": "https://centraders.com/products/mystical-meharishi" } }
                    ]
                  },
                  {
                    "@type": "OfferCatalog",
                    "name": "Authentic Arabian Bakhoor",
                    "itemListElement": [
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Grated Omani Bakhoor", "url": "https://centraders.com/products/grated-omani-bakhoor" } },
                      { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Yemeni Bakhoor Chips", "url": "https://centraders.com/products/yemeni-bakhoor-chips" } }
                    ]
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
                <WhatsAppButton />
                <CookieConsentAndGA />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
