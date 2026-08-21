# Vercel Redeploy Verification Checklist

> Use this after **every** production redeploy to confirm the JS chunks / redirects / images
> that ship with the latest commit are actually live on `www.centraders.com`.
> A `git push` to `main` triggers Vercel automatically, but the CDN may serve a stale
> version for up to ~5 minutes.

---

## 1. Confirm the correct commit landed

1. Open <https://vercel.com/dashboard>.
2. Find the **`addrika-frontend-next`** (or equivalent) project.
3. On the **Deployments** tab, verify the top row shows:
   - **Status**: `Ready` (green)
   - **Commit SHA**: matches `git rev-parse --short HEAD` from your local `main` branch
   - **Branch**: `main`
   - **Age**: within the last ~10 min
4. Click the deployment → **View Function Logs** → confirm no `[Error]` lines in the last 100 lines.

---

## 2. Verify the `/track-order` external redirect is live

The Track Order route now 308-redirects to `https://www.centraders.com/track-order`.

```bash
curl -sI https://www.centraders.com/track-order | head -3
```

Expected:
```
HTTP/2 308
location: https://www.centraders.com/track-order
```

Also check a nested path (should behave the same):
```bash
curl -sI https://www.centraders.com/track-order/ABC-123 | head -3
```

If you see `HTTP/2 200` instead of `308`, the deploy is stale — force a rebuild:
Vercel → project → **Deployments** → three-dot menu on latest → **Redeploy** → uncheck "Use existing build cache" → **Redeploy**.

---

## 3. Verify Header + Footer Track Order link points to Centraders

```bash
curl -s https://www.centraders.com/ | grep -oE 'href="https://www.centraders.com/track-order"[^>]*>[^<]*Track Order' | head -2
```

Expected: two matches (one from the header nav, one from the footer support column), each with
`target="_blank" rel="noopener noreferrer"`.

---

## 4. Verify the Mobile → Web cart deep-link chunk shipped

This is the JS bundle produced by `frontend-next/app/cart/CartClient.js` +
`context/CartContext.js` that hydrates `?cart=<base64>` from the mobile app.

```bash
# Open a shared cart link in a browser
open "https://www.centraders.com/cart?cart=$(echo -n '[{\"product_id\":\"kesar-chandan\",\"quantity\":1}]' | base64)"
```

Confirm:
- Cart page loads with **one item** (Kesar Chandan) already added.
- Browser console shows no `TypeError: mobile-share` errors.
- The URL `?cart=…` query param is stripped after hydration (clean URL).

If the cart is empty or throws — the chunk is stale. Redeploy without cache (step 2).

---

## 5. Verify Instagram feed pulls live product images (no 404s)

The homepage `InstagramFeed` component now fetches images from `/api/products` instead of the
old hard-coded 404 paths.

1. Open `https://www.centraders.com/` in an incognito window.
2. Scroll to the "Follow Our Journey" / Instagram section.
3. Open DevTools → **Network** tab → filter **Img** → reload.
4. All Instagram-feed thumbnails must return **200**, never 404.

---

## 6. Verify the brand-audit CI gate did NOT ship regressions

```bash
node scripts/brand-audit.js
```

Expected: `✓ brand-audit: 0 hardcoded "Addrika" references found across N scanned files.`
If it prints any hits, the build should have failed — investigate what merged.

---

## 7. Backend health check (from the deployed frontend's perspective)

```bash
curl -s https://www.centraders.com/api/app/config | jq '.brand.name, (.products | length)'
```

Expected:
- `"Addrika"`
- A non-zero integer (current product count).

If you see `404` or `502`, the `NEXT_PUBLIC_BACKEND_URL` Vercel env-var may be pointing at a
paused/undeployed backend. Fix in Vercel → **Settings → Environment Variables**.

---

## 8. Post-deploy smoke tests (5 min manual pass)

- [ ] Homepage renders, hero video plays, product carousel scrolls.
- [ ] Fragrances catalogue → click any product → PDP loads with image + price.
- [ ] "Track Order" link in the header opens `www.centraders.com/track-order` in a new tab.
- [ ] "Track Order" link in the footer opens `www.centraders.com/track-order` in a new tab.
- [ ] Cart icon → add-to-cart works.
- [ ] `/find-retailers` → Mappls map loads with markers.
- [ ] `/retailer/login` → login form renders (no server error).
- [ ] `/admin` → admin login form renders.

---

## 9. Roll-back plan

If any of the above fails and you need to revert:
1. Vercel → Deployments → find the last known-good deployment.
2. Three-dot menu → **Promote to Production**.
3. Confirm — takes ~30 seconds to become live.
4. File a bug in the internal tracker referencing the failed commit SHA.

---

_Last updated: Feb 2026 — after cart deep-link + brand-audit + track-order external redirect._
