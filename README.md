# BTL — Real Google OAuth (Firebase) + Vercel hosting

This turns your Claude-artifact dashboard into a real, deployable web app:
- **Real Google sign-in** via Firebase Authentication
- **Real database** via Firestore, locked down per-user with security rules
- **Hosting on Vercel** (Firebase here is only Auth + Database, not hosting —
  Next.js app itself deploys to Vercel like normal)

Your dashboard UI, colors, animations, goal/streak logic, analytics — all
unchanged. Only the login screen and the storage layer were swapped.

## What changed vs. btl_dashboard.jsx

| Old (artifact) | New (this project) |
|---|---|
| Demo login (name only) | `app/login/page.jsx` — real "Sign in with Google" popup |
| `window.storage` (one shared key, per-Claude-account only) | Firestore doc `btl_state/{uid}` — one document per real user |
| `loadState()` / `saveState()` took no args | Now take the signed-in Firebase `user`, call `lib/btlStorage.js` |
| Nothing enforced auth | `components/AuthGuard.jsx` redirects signed-out users to `/login` |

Everything else in `components/BTLDashboard.jsx` — `GoalChecklist`, `Heatmap`,
`AnalyticsTab`, `SettingsTab`, confetti/shine animations, `CATEGORIES`/
`PRIORITIES` — is untouched.

## Setup steps

### 1. Create a Firebase project
1. Go to https://console.firebase.google.com/ → Add project.
2. Once created: **Build → Authentication → Get started → Sign-in method**
   → enable **Google**.
3. **Build → Firestore Database → Create database** → start in production
   mode (rules below lock it down properly).
4. In **Project settings (gear icon) → General → Your apps** → click the
   `</>` web icon to register a web app → copy the config values shown
   (`apiKey`, `authDomain`, etc.) into your `.env.local` (step 4 below).

### 2. Deploy Firestore security rules
Open **Firestore Database → Rules** in the Firebase console, paste the
contents of `firestore.rules` from this project, and click **Publish**.
This ensures a user can only ever read/write their own `btl_state/{uid}`
document — nobody else's data is reachable, even via the client SDK.

### 3. Authorize your domains (important for Vercel)
Firebase only allows Google sign-in popups from domains you've explicitly
authorized. Go to **Authentication → Settings → Authorized domains** and add:
- `localhost` (usually there by default, for local dev)
- your Vercel domain once deployed, e.g. `btl.vercel.app`
- any custom domain you attach later

If you skip this, Google sign-in will fail on your live Vercel URL with an
`auth/unauthorized-domain` error.

### 4. Configure this project
Your real Firebase config values are already filled into `.env.local` in
this project. If you ever need to regenerate it: `cp .env.local.example
.env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*` values from step 1.4.

**Note on the API key:** Firebase's web `apiKey` is not a secret — it just
identifies your project to Google's servers; actual access control happens
via the Firestore security rules in step 2, plus Authorized domains in step
3. Still, `.env.local` is git-ignored by default here so you don't
accidentally commit it — add the real values again as Environment Variables
in Vercel (step 6) instead.

### 5. Run locally
```bash
npm install
npm run dev
```
Visit `http://localhost:3000` — you land on `/login`, click "Sign in with
Google", and land on `/dashboard` with data now saved to Firestore.

### 6. Deploy to Vercel
1. Push this folder to a GitHub repo (`.env.local` won't be included —
   it's git-ignored).
2. Go to https://vercel.com → New Project → import the repo.
3. In the project's **Environment Variables**, add:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDXsMSWKzunsIHBLDDcXhhp_2VlqAxi_0Q
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=beyound-the-life.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=beyound-the-life
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=beyound-the-life.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=835441355372
   NEXT_PUBLIC_FIREBASE_APP_ID=1:835441355372:web:94f745fd717dc55be00649
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-NB91LN3N57
   ```
4. Deploy.
5. Back in Firebase console (step 3 above), add your live
   `*.vercel.app` domain (or custom domain) to **Authorized domains** —
   sign-in won't work until you do this.

## Data migration (optional)
To bring over what's in your artifact's `window.storage`, open the current
artifact and in its browser console run:
```js
const s = await window.storage.get("btl_state_v1", false);
console.log(s.value); // copy this JSON
```
Then, after signing into the new app once (so your Firestore document
exists), go to **Firestore Database → Data → btl_state → your uid**, and
edit the fields to match, or use the Firebase console's "Import" if you
prefer working from the raw JSON.

## Next steps from the roadmap this unblocks
With Firebase in place, these become notably easier since they're already
part of the same platform:
- **Push notifications** — Firebase Cloud Messaging plugs in directly for
  reminders/streak-break alerts (no separate service needed)
- **PWA** — add a manifest + service worker; Firebase Hosting or Vercel both
  serve it fine
- **Multi-device sync** — already working via this migration
- **Social/leaderboard** — a `streak` leaderboard becomes a Firestore query
  against a separate `leaderboard` collection with relaxed read rules
- **Mobile app (Capacitor/React Native)** — Firebase Auth + Firestore SDKs
  exist natively for both, so most of this backend carries over directly

Say the word and I'll scaffold whichever of these you want next.
