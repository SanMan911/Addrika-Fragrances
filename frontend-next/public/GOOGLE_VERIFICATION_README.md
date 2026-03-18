# Google Search Console Verification

To verify your site with Google Search Console:

1. Go to https://search.google.com/search-console
2. Click "Add Property"
3. Select "URL prefix" and enter: https://centraders.com
4. Choose "HTML file" verification method
5. Download the file (e.g., google1234abcd.html)
6. Place the file in this folder (/app/frontend-next/public/)
7. Deploy your site
8. Click "Verify" in Search Console

## Alternative: HTML Meta Tag

If you prefer the meta tag method, add this to /app/frontend-next/app/layout.js in the <head>:

```jsx
<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
```

## After Verification

1. Go to "Sitemaps" in the left menu
2. Enter: sitemap.xml
3. Click "Submit"

Your sitemap is already at: /app/frontend-next/public/sitemap.xml
