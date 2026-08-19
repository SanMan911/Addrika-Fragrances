# Ship Mobile Alpha — Aaroviah APK build via EAS

You now have everything on the Emergent side:
- `mobile/app.json` — brand identity: name "Aaroviah", bundle IDs `com.centraders.aaroviah`, scheme `aaroviah`, extra: `eas.projectId`, plus **hard-coded fallback values** for Supabase URL, anon key, API base URL and web URL (so the APK still boots even if you skip step 4)
- `mobile/eas.json` — build profiles: `development` (dev client), `preview` (internal APK) and `production` (Play Store AAB), all env-driven
- `mobile/assets/icon.png` + `adaptive-icon.png` + `splash.png` — the golden-lotus assets you sent
- `mobile/lib/{session,cart,web,brand}.ts` — login-gated flow + AsyncStorage cart + web-checkout hand-off + WhatsApp cart share

> ### ⚠️ If your APK opens then crashes on tap — this is the fix
> EAS cloud builds **do not read `mobile/.env`**. They only see values from `eas.json → env` (which resolves EAS secrets at build time) or `app.json → expo.extra`. Your first APK shipped with empty API URLs → the very first `fetch('/api/…')` crashed the app on the login screen tap.
>
> **The `app.json` in this repo now hard-codes the four public URLs** (the Supabase anon key is public-safe by design — it's protected by Postgres RLS), so any fresh `eas build` from this branch produces a working APK regardless of whether you've set the EAS secrets. Step 4 is still recommended for future rotation.
>
> **Preview build API endpoint**: `https://addrika-fragrances-backend.onrender.com` (production Render backend, HTTPS, publicly reachable). Do **not** point mobile at the ephemeral `*.preview.emergentagent.com` — that URL rotates when the container restarts.

> ### ⚠️ If EAS says `slug 'aaroviah-mobile' does not match 'addrika-mobile'` — this is why
> The local `app.json` was renamed from **Addrika → Aaroviah** during the mobile rebrand (slug: `aaroviah-mobile`). But the Expo project tied to `projectId f152117c-57fb-4506-a44a-7c53d1043dd3` was originally created under the old slug `addrika-mobile`, so EAS refuses the build.
>
> Pick **one** of the two fixes below:
>
> **Fix A — rename the Expo project (recommended, keeps projectId & any build history)**
> 1. Open [expo.dev/accounts/{you}/projects/addrika-mobile/settings](https://expo.dev)
> 2. Under **General → Slug**, change `addrika-mobile` → `aaroviah-mobile`
> 3. Also update the **Name** field to `Aaroviah` while you're there
> 4. Save
> 5. Re-run `eas build --profile preview --platform android` — no local changes needed
>
> **Fix B — start fresh on Expo (creates a new project, discards old builds)**
> 1. In `mobile/app.json`, clear the projectId:
>    ```json
>    "eas": { "projectId": "" }
>    ```
> 2. Run `eas init` → it will prompt: *"Create a project @<you>/aaroviah-mobile?"* → **Y**
> 3. It writes the fresh projectId back into `app.json`
> 4. Commit that (via the **Save to GitHub** button in Emergent, or manually: `git add mobile/app.json && git commit && git push`)
> 5. Optional: delete the orphaned `addrika-mobile` project from expo.dev
> 6. Run `eas build --profile preview --platform android`

> ### ⚠️ If Gradle fails with `Plugin 'expo-module-gradle-plugin' was not found` or `Could not get unknown property release for SoftwareComponent container` — this is why
> An Expo native module has drifted to a version from a newer SDK than your project is on (SDK 51). The `expo-module-gradle-plugin` was introduced in SDK 52+, so pulling in any package that expects it on a SDK-51 project breaks the whole Android build.
>
> **Fix**: run `npx expo-doctor@latest` from `mobile/`. If any line says `expected version: ...`, run the auto-installer:
> ```powershell
> npx expo install --check
> ```
> then re-run `npx expo-doctor@latest` and confirm `17/17 checks passed`. Commit the updated `mobile/package.json` + `mobile/yarn.lock` and rerun `eas build`.
>
> This session's fix (already in the repo): `expo-web-browser` was pinned to `^57.0.2` (SDK 54+ range). Downgraded to `~13.0.3` to match SDK 51. Doctor now clean.

> ### ⚠️ If the APK opens but login says `Network request failed` — this is why
> `eas.json` previously declared `env: { EXPO_PUBLIC_API_BASE_URL: "$EXPO_PUBLIC_API_BASE_URL", ... }`. That `$VAR` syntax is a template for EAS secrets. If you never ran `eas secret:create`, EAS interpolates the **literal string** `"$EXPO_PUBLIC_API_BASE_URL"` into `process.env` inside the APK. `fetch("$EXPO_PUBLIC_API_BASE_URL/api/auth/login")` then chokes on the URL parser → "Network request failed".
>
> **Fix applied**: the `env` block was removed from all three build profiles in `eas.json`. All four URLs are now sourced exclusively from `app.json → expo.extra`, which is hard-coded to production values in this repo. Additionally, the runtime clients (`lib/{api,supabase,web}.ts`) now reject any candidate that isn't a real `https://…` URL, so even if a stray unresolved template string ever leaks back in, the `app.json` fallback still wins.
>
> **If you later want EAS secrets** (for rotation without editing `app.json`), re-add the `env` block AND set the matching secrets first — never one without the other.

## What you'll do on your Windows machine

Time: ~15 minutes for `eas init`, then ~15-25 minutes for the first cloud build.

### 1. Pull the latest from GitHub

Open PowerShell in your mobile project folder:

```powershell
git pull origin "SupaBase Kickoff"
cd mobile
yarn install
```

### 2. Log in to Expo (one-time)

If you don't have an Expo account yet: create a free one at [expo.dev/signup](https://expo.dev/signup). No card needed for internal/preview builds.

```powershell
npx expo login
```

Enter your Expo username + password when prompted.

### 3. Install EAS CLI + link the project (one-time)

```powershell
npm install -g eas-cli
eas whoami          # confirms you're logged in
eas init            # asks: "Would you like to create a project for @<you>/aaroviah-mobile?" → Y
```

`eas init` writes the real `projectId` back into `app.json → expo.extra.eas.projectId`. **Commit that change** so future builds don't re-prompt:

```powershell
git add app.json
git commit -m "chore: attach EAS projectId"
git push origin "SupaBase Kickoff"
```

### 4. Set the four build-time secrets on Expo (optional — recommended for rotation)

The four `EXPO_PUBLIC_*` values are already baked into `app.json → expo.extra`, so a fresh build works out-of-the-box. Setting them as EAS secrets is optional — it lets you rotate any of them later without editing `app.json`. If you skip this step, jump straight to step 5.

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL      --value "https://qzzwaqwgzvrdecheunpn.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_dUgl8KWxj4dArmssOQZpFw_9vd2CtR4"
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL      --value "https://addrika-fragrances-backend.onrender.com"
eas secret:create --scope project --name EXPO_PUBLIC_WEB_URL           --value "https://www.centraders.com"
```

⚠️ Never paste the Supabase **service_role** key — the app is read-only on Supabase and must use the **anon (publishable)** key.

Verify:

```powershell
eas secret:list
```

### 5. Kick off the preview APK build

```powershell
eas build --profile preview --platform android
```

You'll be asked:
- **"Generate a new Android Keystore?"** → **Y** (Expo stores it for you, safe for internal alpha)
- **"Would you like to auto-increment versionCode?"** → **Y**

Expo uploads the code and queues a cloud build. Watch progress in the terminal (or at `https://expo.dev/accounts/<you>/projects/aaroviah-mobile/builds`).

### 6. Download + install the APK

When the build finishes, the terminal prints a URL like:

```
https://expo.dev/artifacts/eas/<hash>.apk
```

Options for getting it onto a phone:

1. **Direct**: on the phone, open the URL, download, tap the file to install (enable "Install from unknown sources" once for your browser).
2. **Share link**: `eas build:list` → copy the URL and WhatsApp it to your alpha retailer.
3. **QR code**: the Expo dashboard build page has a scannable QR that opens the APK URL.

### 7. First-launch sanity check

Open the app on the device:
- Splash: gold lotus on navy → home hero shows **Aaroviah**
- "Sign in" screen → Customer / Retailer tabs
- Login as customer (`test.user@example.com` / `Test@123`) → home shows welcome + "Browse Products →"
- Tap **Browse Products** → catalogue list (9 real B2C items via Supabase)
- Add one → tap "Your Cart" → tap **Complete Order on centraders.com →** → opens web checkout with the cart pre-filled

If any of that misbehaves, tell me exactly what and I'll patch — the mobile shell is small enough that fixes turn around in one iteration.

### 8. When you're ready for the Play Store

Run:

```powershell
eas build --profile production --platform android
```

That produces an `.aab` (app bundle) instead of an APK, ready to upload to Play Console. We'll wire `eas submit --platform android` once you've got the Play Console account + service account key.

---

## What I can help with from here

- Fix any tap-target / layout issue you spot on the physical device
- Add features (product detail screen, order history, coupons, deep links)
- Wire push notifications through `expo-notifications` when you're ready
- Set up over-the-air (OTA) updates via `eas update` — ship JS-only fixes without a new APK

Ping me with a screenshot the moment anything looks off.
