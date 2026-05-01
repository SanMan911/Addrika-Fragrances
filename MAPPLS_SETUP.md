# 🗺️ Mappls Setup — One-Page Cheat-Sheet

> **Sacred reference doc.** Don't move or rename until Mappls is fully live in production. Last updated: Apr 30, 2026.

This is the single, complete walkthrough for getting our Mappls (MapMyIndia) key
and plugging it into all four places. The instant you finish all four, the map
on `/find-retailers` flips from OpenStreetMap to **Survey-of-India compliant
Mappls tiles** (PoK & Aksai Chin shown as part of India), and any new retailer
without explicit coordinates will be auto-geocoded by Mappls.

---

## 🔑 Step 1 — Get the Mappls key (free tier, ~5 min)

1. Sign up at **<https://apis.mappls.com>** — use the same email Centsibl
   Traders is registered under so the business profile auto-matches.
2. After verifying your email → **Dashboard → Console → Create Project**.
3. Name it `Addrika Web` (anything works). Project type: **Web**.
4. Open the project. Click **Generate REST API Key** AND **Generate Map SDK
   Key**. On the free tier, Mappls usually returns a **single key value** that
   works for both — copy that one value.
5. Under **Restrictions / Allowed Origins**, add:
   - `https://centraders.com`
   - `https://*.preview.emergentagent.com`
   - `http://localhost:3000` *(optional, for local dev)*
6. **Free-tier limits**: 10,000 map loads/month + 5,000 geocoding calls/month.
   More than enough for our traffic.

---

## 📋 Step 2 — Punch the same key value into 4 places

| # | Location | Variable name | Effect |
|---|----------|---------------|--------|
| 1 | `frontend-next/.env.local` *(preview)* | `NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY` | Preview map tiles → Mappls |
| 2 | `backend/.env` *(preview)* | `MAPPLS_REST_API_KEY` | Preview retailer geocoding |
| 3 | **Vercel** dashboard *(production)* | `NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY` | centraders.com map tiles → Mappls |
| 4 | **Render** dashboard *(production)* | `MAPPLS_REST_API_KEY` | centraders.com geocoding |

### 🖥️ Preview (do this first to verify everything works)

Easiest path: **paste the key into chat** and the agent will write it into both
`/app/frontend-next/.env.local` and `/app/backend/.env`, restart both services,
and confirm the `OSM` badge top-left of the map flips to `MAPPLS · INDIA`.

If you want to do it manually:
```bash
# Backend
sed -i 's/^MAPPLS_REST_API_KEY=.*/MAPPLS_REST_API_KEY=YOUR_KEY_HERE/' /app/backend/.env
# Frontend
sed -i 's/^NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY=.*/NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY=YOUR_KEY_HERE/' /app/frontend-next/.env.local
# Restart
sudo supervisorctl restart backend
cd /app/frontend && yarn build && sudo supervisorctl restart frontend
```

### 🌐 Vercel (production frontend)

1. Go to **<https://vercel.com/dashboard>** → your `centraders` project.
2. **Settings → Environment Variables → Add New**.
3. **Name**: `NEXT_PUBLIC_MAPPLS_MAP_SDK_KEY` · **Value**: `<your_key>`
4. **Environments**: tick **Production, Preview, Development** (all three).
5. Click **Save**.
6. Go to the **Deployments** tab → top-most deployment → **⋯ menu → Redeploy**.
   This forces a fresh build that picks up the new env var.

### ☁️ Render (production backend)

1. Go to **<https://dashboard.render.com>** → your `addrika-backend` service.
2. **Environment** tab → **Add Environment Variable**.
3. **Key**: `MAPPLS_REST_API_KEY` · **Value**: `<your_key>` → **Save**.
4. Render will auto-redeploy in ~60 seconds (watch the **Logs** tab).

---

## ✅ Step 3 — Verify it's live

Open **<https://centraders.com/find-retailers>**:

- The badge in the **top-left of the map** reads **`MAPPLS · INDIA`** instead of `OSM`.
- Map tiles look subtly different (Mappls labels, sometimes in regional scripts at high zoom).
- Zoom into Kashmir → **PoK and Aksai Chin are inside India's boundary**, no
  "Pakistan" / "China" labels shown over those regions.
- Add a new retailer in admin **without** lat/lng → it should auto-pin within
  ~1 second of clicking save (Mappls geocoded the address).

If the badge stays on **`OSM`**, something didn't take. Common causes:
| Symptom | Cause | Fix |
|---------|-------|-----|
| Badge stays `OSM` after redeploy | Domain not whitelisted in Mappls | Step 1.5 — add `centraders.com` to Restrictions |
| Map tiles 401/403 in browser dev tools | Wrong key or key expired | Re-copy from Mappls dashboard, redeploy |
| Vercel still serving old build | Forgot to redeploy | Vercel → Deployments → ⋯ → Redeploy |
| New retailer has no pin | `MAPPLS_REST_API_KEY` missing on Render | Step 2 row #4 |
| Free-tier exhausted (10k loads) | Heavy traffic month | Upgrade to Mappls paid tier or add CDN caching |

---

## 🔁 Rotation policy

- Rotate the key every **90 days** for security hygiene.
- When rotating: generate a new key in Mappls dashboard → update all 4 places
  → wait 2 minutes for the old key to drain → revoke the old key.

---

## 📞 Support

- Mappls support: <support@mappls.com> (24h response on free tier).
- Status page: <https://status.mappls.com>.
- API docs: <https://apis.mappls.com/console/#/products>.

---

**TL;DR**: Sign up → Create project → Whitelist domains → Copy key → Paste into
4 env vars → Redeploy Vercel + Render → Confirm `MAPPLS · INDIA` badge.
