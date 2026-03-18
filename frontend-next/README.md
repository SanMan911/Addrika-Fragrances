# Addrika - Next.js Frontend

Premium incense e-commerce platform built with Next.js 14.

## Features

- **Server-Side Rendering (SSR)** - Full SEO optimization
- **Static Site Generation (SSG)** - Pre-rendered product pages
- **Structured Data** - Product, Organization, Article schemas
- **Responsive Design** - Mobile-first approach

## Getting Started

### Development

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=https://your-api-url.com
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Self-hosted

```bash
yarn build
yarn start -p 3000
```

## Project Structure

```
app/
├── layout.js          # Root layout
├── page.js            # Homepage
├── products/[slug]/   # Product pages (SSG)
├── about-us/          # About page
├── our-story/         # Story page
├── blog/              # Blog pages
├── cart/              # Shopping cart
├── checkout/          # Checkout flow
├── login/             # Authentication
├── register/          # Registration
├── account/           # User account
└── wishlist/          # Wishlist

context/
├── CartContext.js     # Cart state management
├── AuthContext.js     # Authentication state
└── WishlistContext.js # Wishlist state

public/
├── sitemap.xml        # SEO sitemap
├── robots.txt         # Crawler rules
└── og-image.png       # Social sharing image
```

## SEO Features

- Dynamic meta tags per page
- Product structured data (JSON-LD)
- Organization schema
- Breadcrumb navigation
- Open Graph tags
- Twitter Cards

## License

© 2026 Centsibl Traders Private Limited
