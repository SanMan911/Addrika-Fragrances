import '../styles/globals.css';
import { Toaster } from 'sonner';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { WishlistProvider } from '../context/WishlistContext';

export const metadata = {
  title: {
    default: 'Addrika - Premium Natural Incense | Sacred Luxury in Every Scent',
    template: '%s | Addrika Premium Incense'
  },
  description: 'Discover Addrika premium natural incense sticks. Experience authentic Arabian fragrances - Kesar Chandan, Regal Rose, Oriental Oudh & Bold Bakhoor. Sacred luxury for mindful spaces.',
  keywords: ['addrika', 'premium incense', 'natural incense', 'agarbatti', 'kesar chandan', 'regal rose', 'oriental oudh', 'bold bakhoor', 'arabian incense'],
  authors: [{ name: 'Centsibl Traders Private Limited' }],
  creator: 'Centsibl Traders',
  metadataBase: new URL('https://centraders.com'),
  // Google Search Console verification - Replace YOUR_CODE with actual verification code
  // verification: {
  //   google: 'YOUR_GOOGLE_VERIFICATION_CODE',
  // },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://centraders.com',
    siteName: 'Addrika',
    title: 'Addrika - Premium Natural Incense',
    description: 'Sacred luxury in every scent. Premium natural incense from Centsibl Traders.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Addrika Premium Incense',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Addrika - Premium Natural Incense',
    description: 'Sacred luxury in every scent.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
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
              "description": "Premium natural incense manufacturer offering authentic arabian fragrances",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN"
              },
              "sameAs": ["https://www.instagram.com/addrika.in"]
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
              "name": "Addrika",
              "url": "https://centraders.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://centraders.com/?search={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>
      <body className="min-h-screen bg-white antialiased">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              {children}
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
