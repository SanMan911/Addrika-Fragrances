# Ship Mobile Alpha — Aaroviah APK build via EAS

You now have everything on the Emergent side:
- `mobile/app.json` — brand identity: name "Aaroviah", bundle IDs `com.centraders.aaroviah`, scheme `aaroviah`, extra: `eas.projectId` placeholder
- `mobile/eas.json` — build profiles: `preview` (internal APK) and `production` (Play Store AAB), all env-driven
- `mobile/assets/icon.png` + `adaptive-icon.png` + `splash.png` — the golden-lotus assets you sent
- `mobile/lib/{session,cart,web,brand}.ts` — login-gated flow + AsyncStorage cart + web-checkout hand-off

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

### 4. Set the four build-time secrets on Expo

The APK needs to know your Supabase URL/anon key, backend base URL, and web URL. Set them once per profile:

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL      --value "https://<your-project-ref>.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<publishable anon key — starts with eyJ...>"
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL      --value "https://<your-backend>.onrender.com"
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
