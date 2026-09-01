# BTL — Real Google OAuth (Firebase) + Vercel hosting

## Per-widget Text Style (this update)

Text Style controls now apply to **one widget at a time**, not all four
at once. In **Customize Layout**, tap a widget's name (Life Big Goals,
Life Rules, Daily Goals, or Entry Goals) in the reorder list — it
highlights with an amber border and a small text-icon, and the **Text
Style** panel below switches to editing just that widget (its label
shows next to "Text Style"). Font size / bold / font / color changes
now only affect the selected widget; pick a different one any time to
style it separately, and each widget remembers its own settings
independently (`state.layout.textStyles[widgetId]`).

## Text Style + Hide widgets (earlier update)

**Customize Layout** now has a **Text Style** panel (below the reorder
list) with a live preview and:
- **Font size** — A-/A+ stepper with an animated fill bar, 85%–160%,
  applied to each widget's own base sizes in JS (not a blanket CSS
  scale), so titles/items/subtasks keep their relative proportions
  instead of all flattening to one size.
- **Bold** — a spring-animated toggle switch.
- **Font** — Default (Inter), Poppins, Playfair Display, or Mono
  (JetBrains Mono), loaded via Google Fonts in `app/layout.jsx`.
- **Color** — 5 preset swatches + a custom color picker.

These apply to the free-text widgets: **Life Big Goals, Life Rules,
Daily Goals, Entry Goals**. A **Reset** button (only shown once you've
changed something) restores the defaults.

Every widget (except Analytics Summary, which already had its own
Pin/Unpin) now also has a **Visible / Hidden** eye toggle in the
reorder list, so you can hide any widget from the dashboard without
losing its position or size — toggle it back on any time.

Both settings live in `state.layout.textStyle` / `state.layout.hidden`
and are saved to Firestore per-user like the rest of the layout, so
they persist across devices. Built with `framer-motion` — the same
spring-entrance, whileHover/whileTap micro-interactions already used
throughout Customize Layout — no new npm installs required.

## Filter popup (earlier update)

Money Management now has a **Filter** button (next to Summary/Reset) that
opens a glass popup (Glassmorphism 2.0, spring entrance) with three
multi-select filter groups:
- **Show** — Earn Money / Spend Money (at least one always stays on)
- **Spend category** — all 9 categories, multi-select, with Select all /
  Clear shortcuts (dims out when Spend isn't in "Show")
- **Date range** — All time / Today / 7 / 14 / 30 Days, or a **Custom**
  From–To range

The popup keeps a live "N entries match" count as you toggle filters and
only commits on **Apply Filters**; a filtered view then replaces the
summary strip (Earned/Spent/Net/Entries) and Recent Activity with the
matching totals + a scrollable, image-aware results list, plus a
dismissible "Filtered view · …" chip summarising what's active. The
**Filter** button itself gets an accent badge showing how many filter
groups are active. Built with the same `filterMoneyEntries`/date-preset
helpers reused by both the popup's live preview and the applied view, so
they can never disagree.

## Money popup photos + Reset + Summary (earlier update)

- **Spend Money popup** now also has the optional "📷 Attach a photo"
  dropzone (receipt/bill photo), same as Earn Money already had — pick a
  category *and* optionally attach a photo, then note, then **Done**.
  Every entry's `image` field is stored regardless of type now, and the
  Recent Activity / Summary lists prefer the photo thumbnail over the
  category emoji when one's attached.
- **Money Management → Reset**: a **Reset** button in the header opens a
  glass password popup (same Glassmorphism 2.0 look, spring entrance +
  a shake animation on a wrong attempt). Only the password **`1000`** is
  accepted. On success it wipes `moneyEntries`, `moneyHistory`,
  `totalEarnLife` and `totalSpendLife` — nothing else in state (goals,
  streaks, memories) is touched — and shows a brief "reset ✓" toast.
- **Money Management → Summary**: a **Summary** button opens a large
  glass popup (same date-sidebar layout as the Memories modal) — pick a
  date on the left, see every earn/spend entry logged that day on the
  right with its photo or category icon, note, and ± amount, plus a
  day-total strip (Earned / Spent / Net). Tapping a photo opens the same
  full-screen lightbox used elsewhere in the app.

Built entirely with `framer-motion` (already a project dependency) —
no new npm installs required. `lottie-animations` / Magic UI / Zdog-style
libraries were considered per the workspace's animation skills, but
they're CDN/script-tag tools meant for marketing-site decoration, not a
great fit for small in-app popups; framer-motion's spring physics
(already used everywhere else here, including the hand-rolled tilt-hover
on Memories photos) keeps this update visually and technically
consistent with the rest of the codebase.


This turns your Claude-artifact dashboard into a real, deployable web app:
- **Real Google sign-in** via Firebase Authentication
- **Real database** via Firestore, locked down per-user with security rules
- **Hosting on Vercel** (Firebase here is only Auth + Database, not hosting —
  Next.js app itself deploys to Vercel like normal)

Your dashboard UI, colors, animations, goal/streak logic, analytics — all
unchanged. Only the login screen and the storage layer were swapped.

## Money popup + Money Management tab (this update)

Clicking **Add** next to Earn Money or Spend Money no longer commits the
amount straight away — it opens a glass popup (same Glassmorphism 2.0 /
Liquid Glass look as Memories/Settings, spring entrance animation):

- **Earn Money popup** — shows the amount, then only an optional
  "attach a photo" dropzone (no categories). Tap **Add Earning** to save.
- **Spend Money popup** — shows the amount, then an animated,
  staggered-entrance category grid: **Food, Health, Cloth, Friends,
  Traveling, Shopping, Bills, Entertainment, Other**. Pick one to enable
  **Done**. Both popups also have an optional one-line note field.

Every submission is logged to `state.moneyEntries` (date, type, amount,
category or photo, note) alongside the existing daily `moneyHistory`
aggregate, so nothing about the old totals/charts breaks.

**Analytics → Money Management**: the Analytics tab now shows a compact
"Money Management" nav card (with a live Earned/Spent preview) instead of
the full money chart inline. Tapping it opens a dedicated tab with:
- Summary strip — Total Earned, Total Spent, Net (life), Entries logged
- **Spend by category** — donut chart + ranked list with % share
- **Earn vs spend trend** — the same chart as before, now with a
  7 / 14 / 30-day range toggle
- **Recent activity** — a scrollable feed of every entry (category icon or
  attached photo thumbnail, note, ± amount), newest first

Built entirely with `framer-motion` and `recharts` (both already project
dependencies) — no new npm installs required. Considered
`locomotive-scroll` / `lottie-react` / `vanity-tilt` style libraries per
the workspace's animation skills, but those are script-tag/CDN tools
meant for scrollytelling marketing sites, not a great fit for a small
in-app popup — framer-motion's spring physics (already used everywhere
else in this dashboard) gives the same "professional, glassy, alive"
feel while staying consistent with the rest of the codebase.

## Memories upgrade (earlier update)

The "memor" button now opens a full **Memories** modal instead of a plain text log:

- **Sidebar timeline** — every date you have any activity for (goals, money, mood, photos, notes), newest first.
- **4 tabs per date**: Goals (exactly which Daily/Extry goals you completed that day), Money (earned/spent/net with animated bars), Photos (gallery with a lightweight 3D tilt-hover + full-screen lightbox + download), Notes (that day's saved notes + any memory entries, with an input to add more).
- Glassmorphism styling matches the existing Settings modal, with spring entrance animation, a sliding tab-underline, and staggered list reveals — all built with `framer-motion`, already a project dependency, so **no new npm installs are required**.

### State/data changes that power it
- New `state.dailyLogs[date]` map: `{ images: [dataUrl...], notes, completedGoals: { daily: [...], extry: [...] } }`.
- Toggling a goal now snapshots which goals were done that day into `dailyLogs`, not just the percentage.
- The "Image Upload" button now: (1) resizes/compresses photos client-side to a small JPEG before storing, and (2) keeps up to the last 6 photos **per day** in `dailyLogs`, instead of overwriting a single global `uploadedImage`. This keeps Firestore documents small.
- The daily notes textarea now also mirrors into `dailyLogs[today].notes` so it's visible later in Memories.
- Memory text entries can now be tagged to any date shown in the modal (not only "today").

⚠️ Firestore documents cap at ~1MB — storing many photos across many days as base64 will eventually add up. The compression (480px, JPEG ~0.72 quality) keeps each photo small, but if you use this heavily for months, consider moving images to Firebase Storage later and keeping only URLs in Firestore.

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

## ✨ Visual Style (2026 trends)
Direction for the dashboard's look and feel going forward:

- **Purposeful motion** — nothing should just "appear." Cards fold/slide into
  place, buttons soft-expand before releasing on click, and navigation
  elements glide with intent rather than snapping. See [Zeka Design's 2026
  UI/UX trends](https://www.zekagraphic.com/top-10-ui-ux-design-trends-2026/)
  for reference.
- **Soft glass/blur cards** for modals (memory modal, settings) — the
  "Glassmorphism 2.0" / Liquid Glass look, tuned for readability rather than
  pure decoration.
- **Status-aware loading states** — replace generic spinners with states
  that say what's actually happening, e.g. `Saving...` → `Saved ✓` with a
  quick pulse, instead of a bare loading indicator.
- **Customizable widget layout** — the dashboard is a drag-and-reorder,
  resize-and-pin grid of widgets, not a fixed layout. Open the **Layout**
  button in the header to reorder widgets (drag the grip handle), cycle
  each widget's size (Small → Medium → Large — this also controls width
  and height), and pin/unpin the Analytics Summary widget onto the
  dashboard. The arrangement is saved per-user to Firestore, same as the
  rest of the app's state, so it persists across devices and sessions.
  Implemented with `framer-motion`'s `Reorder` API and a 6-column CSS grid
  (`gridAutoFlow: "row dense"`) that reflows automatically as widgets are
  reordered or resized.

**Implementation:** use the animation/UI skills already available in this
workspace rather than hand-rolling motion code:
- `animated-component-libraries` — pre-built animated components (Magic UI /
  React Bits) for things like the glass modals and status pills
- `framer-motion-animator` / `motion-animator` — entrance/exit transitions,
  card fold/slide, button soft-expand, shared layout transitions, and the
  `Reorder` drag-to-reorder API used by the Layout editor
- `gsap-scrolltrigger` — scroll-driven reveals if the dashboard grows
  scrollable sections (e.g. analytics)
- `lightweight-3d-effects` — subtle tilt/parallax touches for hero or
  summary cards, if desired, without pulling in a full 3D engine

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
