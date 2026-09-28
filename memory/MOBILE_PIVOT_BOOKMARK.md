# MOBILE APP PIVOT BOOKMARK — 2026-06-27

**REVERT-TO POINT (start of mobile-app branch/fork):**
- Git commit: `d7a4e0c8bc522a2117173d162dc14fe291beda43` ("Render Deploy Blocker #2 Update (Iter 111)")
- All work complete at this point: Iter109 (PyPI-only deps), Iter110 (waitlist email notifications), Iter111 (watchfiles 1.0.5). Test reports: iteration_109/110/111.json all green.
- To revert: use the Emergent **rollback** feature to the checkpoint at this commit, or `git checkout d7a4e0c` state. Do NOT git reset in-session.

**PIVOT DIRECTIVE (user, 2026-06-27):**
- "Henceforth, at least for the time being, we will be working on the app unless and until stated otherwise."
- Mobile app = Expo SDK 51 at `/app/mobile` (Aarohmm, B2B-only, expo-router).
- User wants Supabase for AUTH and DATABASE instead of MongoDB on the mobile app.
- User wants a way to preview/publish the app (even temporary).

**Mobile architecture BEFORE pivot (for revert reference):**
- Auth: FastAPI JWT — `POST /api/retailer-auth/login` {gstin, password}, token in expo-secure-store (`lib/session.ts`).
- Reads: Supabase Postgres mirror via anon key (read-only, `lib/supabase.ts`).
- Writes: FastAPI → MongoDB (source of truth) → dual-write mirror to Supabase.
- app.json extra: supabaseUrl, supabaseAnonKey (publishable), apiBaseUrl (Render), webUrl, eas.projectId f152117c-57fb-4506-a44a-7c53d1043dd3.
- Screens: app/_layout.tsx, index, login, register, products, cart, order-placed.
- B2C code paths preserved but disabled (loginCustomer, /cart filters).
- EAS profiles in eas.json: development (dev client APK), preview, production.
- expo-web-browser pinned ~13.0.3 (SDK 51 compat — do NOT upgrade).
