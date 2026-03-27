# Next.js Migration (SIDE-LINED)

## Status: INACTIVE / PAUSED

This directory contains a partial Next.js migration of the main React application (`/app/frontend`).

**Important**: The user decided to **stick with the original React SPA** to preserve the premium UI design. This Next.js app is currently **not in use** and serves as a reference/backup for potential future migration.

## Why Side-Lined?
- The React app has a polished, premium UI that the user wants to preserve
- Next.js migration was started for SEO benefits but the React app has since been enhanced with:
  - Static structured data in index.html
  - react-helmet-async for dynamic SEO
  - Individual product pages with SEO
  - Updated sitemap.xml

## Current State (as of March 2026)
- Core pages migrated: Homepage, Product pages, About, Blog, FAQ, etc.
- **NOT migrated**: Checkout, Cart, Auth, Admin, Retailer portal
- **NOT in sync** with latest React app features (Password Recovery, etc.)

## If You Want to Resume Migration
1. The main React app (`/app/frontend`) is the source of truth
2. Port features incrementally from React to Next.js
3. Test thoroughly before switching deployments

## Primary Application
See `/app/frontend` for the active React application.
