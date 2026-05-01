# Production Grandfather Migration — Playbook

> **Purpose**: Mark every existing retailer on the production Render/Atlas
> backend as KYC-complete so they aren't locked out by the newly-enabled
> `b2b_kyc_required_for_orders = true` gate. **Idempotent** — safe to re-run.

---

## TL;DR — one-liner (recommended)

Once you're logged into `https://centraders.com/admin` in your browser,
open the **browser DevTools → Console** on any admin page and paste:

```js
fetch('/api/admin/b2b/retailers/bulk-grandfather-kyc', {
  method: 'POST',
  credentials: 'include',
}).then(r => r.json()).then(console.log);
```

Press Enter. You'll see a result like:

```json
{ "matched": 2, "modified": 2, "grandfathered_at": "2026-05-01T14:23:11.123456+00:00" }
```

That's it. Every existing retailer is now flagged
`gst_verified=true · pan_verified=true · aadhaar_verified=true` +
`kyc_grandfathered_at=<timestamp>`.

---

## Alternative — command-line

If you prefer a shell, do this from the machine where you have
your admin session cookie:

1. Log into `https://centraders.com/admin` in your browser.
2. Open DevTools → Application/Storage → Cookies → copy the value of
   `session_token`.
3. Run:

```bash
curl -X POST "https://centraders.com/api/admin/b2b/retailers/bulk-grandfather-kyc" \
  -H "Cookie: session_token=<PASTE_HERE>" \
  -H "Content-Type: application/json"
```

You should see the same JSON result.

---

## Verifying it worked

1. Open **Admin → Settings → B2B Portal Settings** on production
   (`https://centraders.com/admin/settings/b2b`).
2. If there's a "Retailer KYC status" widget, all existing retailers
   should now show ✅ / Green across GST + PAN + Aadhaar.
3. Alternatively, have Mela Stores or M.G. Shoppie log into
   `centraders.com/retailer/b2b` — they should **not** see the
   amber KYC banner and should be able to place an order straight away.

---

## Safety net — dry-run first (optional)

If you'd like to see exactly how many retailers would be affected
*before* writing anything, first run this read-only probe via the
same DevTools console:

```js
fetch('/api/admin/retailers?status=all', { credentials: 'include' })
  .then(r => r.json())
  .then(d => {
    const all = d.retailers || [];
    const needsMigration = all.filter(r =>
      !(r.gst_verified && r.pan_verified && r.aadhaar_verified)
    );
    console.log(`Total retailers: ${all.length}`);
    console.log(`Would be grandfathered: ${needsMigration.length}`);
    console.table(needsMigration.map(r => ({
      name: r.business_name,
      gst: r.gst_verified, pan: r.pan_verified, aad: r.aadhaar_verified,
    })));
  });
```

The number after `Would be grandfathered:` is the expected `modified`
count from the real migration.

---

## Rolling it back (not recommended)

If for any reason you need to un-grandfather a retailer (e.g., they
need to re-verify their Aadhaar after a personal-details change):

```js
fetch('/api/admin/retailers/<retailer_id>/kyc/reset', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reset_fields: ['pan_verified', 'aadhaar_verified'] }),
}).then(r => r.json()).then(console.log);
```

> *Note: the reset endpoint is not built yet — only flag this if you
> actually need it; I'll add it when you do.*

---

## What the migration does under the hood

```python
# In backend/routers/admin/admin_b2b.py:258-295
await db.retailers.update_many(
    {"$or": [
        {"gst_verified":     {"$ne": True}},
        {"pan_verified":     {"$ne": True}},
        {"aadhaar_verified": {"$ne": True}},
    ]},
    {"$set": {
        "gst_verified":          True,
        "pan_verified":          True,
        "aadhaar_verified":      True,
        "kyc_grandfathered_at":  now_isoformat,
    }},
)
```

- Matches every retailer that is missing **at least one** of the three
  verification flags.
- Sets all three to `True` and stamps `kyc_grandfathered_at` (so you
  can always audit which retailers went through manual KYC vs. the
  one-time migration).
- **Idempotent**: re-running on an already-migrated DB matches 0 docs
  and does nothing.
