# Addrika Next.js Deployment Guide

## Quick Start: Deploy to Vercel

### Step 1: Push Code to GitHub

First, you need your Next.js code in a GitHub repository.

**Option A: Use Emergent's "Save to GitHub" feature**
- Click the "Save to GitHub" button in the Emergent chat
- This will create/update a repository with your code

**Option B: Manual push**
```bash
cd frontend-next
git init
git add .
git commit -m "Initial Next.js app"
git remote add origin https://github.com/YOUR_USERNAME/addrika-nextjs.git
git push -u origin main
```

---

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login with GitHub
2. Click **"Add New Project"**
3. Select your GitHub repository (addrika-nextjs or wherever you pushed the code)
4. Vercel will auto-detect it's a Next.js app

---

### Step 3: Configure Environment Variables

**CRITICAL**: Before deploying, add this environment variable:

| Variable Name | Value |
|---------------|-------|
| `NEXT_PUBLIC_API_URL` | `https://natural-dhoop-store.preview.emergentagent.com` |

**How to add:**
1. In Vercel project settings, go to **Settings → Environment Variables**
2. Add: `NEXT_PUBLIC_API_URL` = `https://natural-dhoop-store.preview.emergentagent.com`
3. Select all environments (Production, Preview, Development)
4. Click **Save**

---

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll get a URL like: `addrika-xxxxx.vercel.app`

---

### Step 5: Connect Your Domain (centraders.com)

1. In Vercel, go to **Settings → Domains**
2. Add `centraders.com`
3. Vercel will show you DNS records to add

**DNS Records to Add (at your domain registrar):**

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

4. Wait for DNS propagation (5-30 minutes)
5. Vercel will auto-provision SSL certificate

---

## Important Notes

### Backend API
Your backend is currently running on Emergent's preview environment:
- URL: `https://natural-dhoop-store.preview.emergentagent.com`
- This handles: Products, Orders, Auth, etc.

**For production**, you may want to deploy backend separately to:
- **Railway** (recommended, easy)
- **Render**
- **DigitalOcean App Platform**
- **AWS/GCP**

### What's Deployed

The Next.js frontend includes:
- ✅ Homepage with products
- ✅ Individual product pages (SSG)
- ✅ SEO content pages (FAQ, Our Quality, Ingredients, etc.)
- ✅ Static pages (About, Contact, etc.)
- ✅ Cart, Wishlist, Auth pages

### Vercel Free Tier Limits
- 100GB bandwidth/month
- Unlimited deployments
- Custom domains included
- SSL included

This should be plenty for most small-medium traffic sites.

---

## Troubleshooting

### "Build Failed"
- Check Vercel build logs
- Ensure `NEXT_PUBLIC_API_URL` is set

### "API calls failing"
- Verify the backend URL is accessible
- Check browser console for CORS errors

### "Domain not working"
- DNS propagation can take up to 48 hours
- Verify DNS records are correct
- Check Vercel domain status page

---

## Post-Deployment Checklist

- [ ] Verify site loads at your Vercel URL
- [ ] Verify products load correctly
- [ ] Test add to cart functionality
- [ ] Connect custom domain
- [ ] Verify SSL certificate is active
- [ ] Set up Google Search Console
- [ ] Submit sitemap: `https://centraders.com/sitemap.xml`
