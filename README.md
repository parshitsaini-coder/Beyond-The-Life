# BTL — Real Google OAuth (Firebase) + Vercel hosting

## ✨ Life Story — Today's Entry is now a liquid-glass popup (this update)
Redesigned `LifeStoryTab` in `components/BTLDashboard.jsx` per the marked-up
screenshots:
- **"hide" → "today" toggle** (top of the Life Story header, next to the
  title) now opens **Today's Entry as a floating popup** instead of
  showing/hiding it inline in the feed. Click it again (or the ✕ inside,
  or click outside, or press Escape) to close.
- The popup is **full liquid glass**: heavy `backdrop-filter: blur + saturate`,
  a translucent gradient fill, a soft top gloss "sheen" band and a frosted
  border/shadow — matching the reference glass-key look. It genie-opens
  and genie-closes out of the toggle button using the same SVG
  `feTurbulence`/`feDisplacementMap` liquid-warp filter + squeeze/scale
  animation that used to hide/show the inline card (`GenieFilterDefs`,
  reused as-is), just landing on a floating card instead of an inline one.
- It's sized and anchored to sit *inside* the journal area (not a
  full-screen modal) — bottom-right, overlapping the past-entries card,
  same as the layout you sketched.
- **Past-day entries** (every date except today) now render inside their
  own bounded **"past-day entry card"** — a bordered, rounded panel that
  **hugs just the entries themselves** (max-width 620px, height fits its
  content) instead of stretching to fill the whole tab body — fixed after
  the first pass made it span the entire empty area below. Scrolls
  independently, with an empty-state message when there are no past
  entries yet.
- **New in Theme (gear icon → "Today's Entry Card"):** two color pickers —
  **Card background** and **Card text** — control only the floating
  popup's own colors, independent from the Page Theme colors above it
  (which still only affect past-day entries). Both feed into the glass
  gradient/border/gloss tinting and the entry text itself, so picking a
  dark background (e.g. black) automatically gives a dark glass card with
  whatever text color you choose, not a white glass panel with a
  mismatched dark card inside it. Saved to `state.lifeStory.theme.todayCardBg`
  / `.todayCardTextColor`; defaults to white background + the normal dark
  text so nothing changes until you open Theme.
- `jump to date → Today` in the filters dropdown now opens the popup
  instead of trying to scroll to an inline block that no longer exists.
- The old `GenieHidable` inline hide/show component is no longer used
  (left in place, unreferenced) — replaced by `LifeStoryTodayGlassPopup`.

## 🧘 New — 7 more yoga poses added (this update)
7 more cards appended to `FITNESS_DATA.yoga` (now 20 total): Reclining
Single-Leg Stretch (Bedtime Pose), Pelvic Tilt Tabletop Pose,
Vasisthasana (Side Plank Pose), Supine Knee Bend Relaxation Pose,
Pavanmuktasana (Wind-Relieving Pose), Tucked Headstand Prep (Sirsasana
Variation), Sirsasana (Headstand Pose). 8 images were sent this round
but one was an exact duplicate of the already-added "Supported
Savasana (Knees Bent)" pose, so it was skipped.

## 🧘 2 more yoga poses added (earlier update)
2 more cards appended to `FITNESS_DATA.yoga` (now 13 total): High
Plank Pose (Full-Body Stretch), Savasana (Corpse Pose). Images added
to `public/yoga/`.

## 🧘 8 more yoga poses added (earlier update)
8 more cards appended to `FITNESS_DATA.yoga` (now 11 total): Ustrasana
(Camel Pose), Constructive Rest Pose, Makarasana (Crocodile Pose),
Virabhadrasana II (Warrior II), Marjaryasana (Cat Pose), Supported
Savasana (Knees Bent), Salamba Bhujangasana (Sphinx Pose), Phalakasana
(Plank Pose). Images added to `public/yoga/`. Same card shape as
before (`id`, `name`, `duration`, `gif`, `steps`, `benefits`).

## 🧘 Fitness → Yoga section populated (earlier update)
`FITNESS_DATA.yoga` was empty before (`yoga: []`, showing the "Yoga
jaldi aa rahe hain" placeholder) — 3 real-photo poses were added:
Ardha Halasana (Half Plow Pose), Navasana (Boat Pose), and Ardha
Sarvangasana (Half Shoulder Stand). Images live in a new
`public/yoga/` folder (kept separate from `public/fitness/` for
clarity). Same card shape as Exercise (`id`, `name`, `duration`,
`gif`, `steps`, `benefits`) — Fitness → Yoga tab now shows these
instead of the empty state.

## 🏋️ 13 more exercises added to Fitness → Exercise (earlier update)
13 more cards appended to `FITNESS_DATA.exerciseAlt`: Forearm Plank
(Fists), Banded Side-Lying Clamshell, Standing Overhead Reach Stretch,
Weighted Toe Reach (Dumbbell), Single-Leg Raise (Lying), Tabletop
Crunch Hold, Seated Single-Leg Stretch, Lying Single-Leg Raise (Hands
Behind Head), Banded Sumo Squat, Straight-Leg Toe Touch, V-Up (Toe
Touch), Prone Single-Leg Raise, Prone Full-Body Reach. 14 files were
sent this round but one was an exact duplicate upload (same GIF twice)
— it was only added once. Total exerciseAlt count is now 64.

## 🏋️ 7 more exercises added to Fitness → Exercise (earlier update)
7 more cards appended to `FITNESS_DATA.exerciseAlt` in
`components/BTLDashboard.jsx`: Figure-4 Stretch (Reclining Pigeon),
Boat Pose Hold (V-Sit), Bicycle Crunch, Scissor Kicks, Superman Reach,
Box Step-Up, Standing Mountain Pose (Posture Reset). Images live in
`public/fitness/` (one is a `.jpg`, rest `.gif` — `<img>` handles both
fine). Two of the images you sent this round (cat-cow-stretch,
seated-leg-extension-bench) were exact duplicates of ones already
added in the previous update, so they were skipped — not added twice.

## 🏋️ 14 more exercises added to Fitness → Exercise (earlier update)
14 new GIFs (mountain climber, standing knee drive, high knee march,
three-legged downward dog, standard plank hold, seated half-split
stretch, lying vertical leg raise, bodyweight squat with hands behind
head, straight-leg raise hold, spiderman plank crunch, dumbbell
pullover, standing wide-stance side bend, cat-cow stretch, seated leg
extension on a bench) were dropped into `public/fitness/` and appended
as new cards to `FITNESS_DATA.exerciseAlt` in
`components/BTLDashboard.jsx` — same shape as every existing card
(`id`, `name`, `duration`, `gif`, `steps`, `benefits`), so they show up
automatically in **Fitness → Exercise** (the "alt" list, toggled with
the swap button) with no other code changes. Exercise names/steps/
benefits were inferred from the GIF poses — say the word if any need
renaming or re-categorizing.

## 🏋️ 19 more exercises added to Fitness → Exercise (earlier update)
19 new GIFs (donkey kick, quadruped leg extension, straight-arm plank,
child's pose stretch, cross-arm crunch, plank knee raise, reclined
knee-bend rest, side-lying relaxation stretch, standing side leg raise,
kneeling forward reach stretch, side-lying knee tuck stretch, vertical
toe-reach crunch, standing march in place, boxer guard stance hold,
flutter kicks, high plank hold, push-up, jogging in place, standing high
knee raise) were dropped into `public/fitness/` and appended as new cards
to `FITNESS_DATA.exerciseAlt` in `components/BTLDashboard.jsx` — same
shape as every existing card (`id`, `name`, `duration`, `gif`, `steps`,
`benefits`), so they show up automatically in **Fitness → Exercise** (the
"alt" list, toggled with the swap button) with no other code changes.
Exercise names/steps/benefits were inferred from the GIF poses — say the
word if any need renaming or re-categorizing (e.g. into Yoga).

## 🎛️ "Background" tab in Settings (earlier update)

The Liquid Background (gradient wash + blobs + particles) is now fully
user-controllable from **Setting → Background**:

- **Colors** — all 4 hues it draws with (previously hardcoded amber/sky/
  coral/sage) are now 4 native color pickers. Changing one updates the
  gradient, the matching blob, and every particle tinted with that hue
  at once, since they all read from the same shared palette. A **Reset
  colors to default** button restores the original 4.
- **Animation speed** — a single 0.4x–3x slider controls how fast the
  blobs drift/morph, the gradient shifts, and the particles move (the
  click-triggered ripple effect is unaffected, since it's a one-shot
  reaction to a click, not a continuous loop). A **Reset speed to 1.0x**
  button restores the original pace.
- Both persist to Firestore on `state.liquidBg: { colors: string[4],
  speed: number }`, same as every other Setting. Old saved states
  without this field fall back to the original hardcoded colors/speed
  automatically — no migration step needed.
- Wave Effect (the old 3 scrolling SVG bands along the bottom edge) has
  been removed entirely from `LiquidBackground.jsx`, including its
  keyframe — it's no longer part of the layered system below.
- The Ripple 3D Effect (the click-triggered expanding wave-interference
  rings) has also been removed entirely — `RippleWaveCanvas`, its color
  constants, and its usage are all gone from `LiquidBackground.jsx`. The
  background is now 3 layers: Liquid Gradient, Liquid Blob, Particle
  Fluid — nothing spawns on click anymore.

## 🌊 "Liquid Background" system (earlier update)

The dashboard's old background was just 3 static blurred circles. It's now
a full animated liquid system, built as its own component
(`components/LiquidBackground.jsx`) and dropped in behind everything —
still `z-index: -1`, `pointer-events: none`, clipped by the dashboard's
own rounded panel, so it never affects layout or intercepts clicks meant
for widgets.

**Root-cause fix (this update):** the dashboard's outer panel only had
`position: relative` with no `z-index`, so it never established its own
CSS stacking context. That meant the `z-index: -1` LiquidBackground layer
wasn't confined *inside* this panel at all — it escaped to whatever
ancestor stacking context existed further up the tree and painted behind
that instead, invisible no matter how the colors/opacity were tuned. Fixed
by adding `zIndex: 0` + `isolation: "isolate"` to the outer panel
(`components/BTLDashboard.jsx`), which forces it to own its stacking
context so the liquid layer now correctly sits between the panel's own
background and its content. If a background layer like this ever again
"exists in the DOM with the right styles but is invisible," this is the
first thing to check — not opacity.

Five techniques, layered (Wave Effect was later removed — see the
"Background" tab section above):
- **Liquid Gradient** — a slow-shifting radial-gradient mesh (4 brand
  hues: amber, sky, coral, sage, now user-recolorable — see above) that
  drifts and rotates on a 26s loop (speed adjustable) — the base wash
  every other layer sits on top of.
- **Liquid Blob** — 4 organic blobs, merged into one melting "goo" mass
  via an SVG `feGaussianBlur` + `feColorMatrix` filter, each morphing its
  own `border-radius` on a 19–27s loop while drifting/scaling — so they
  split apart and re-merge continuously instead of just floating as flat
  circles.
- ~~**Wave Effect** — 3 translucent SVG wave bands along the bottom edge,
  each scrolling at a different speed/direction for a parallax feel.~~
  Removed.
- **Particle Fluid** — a `<canvas>` layer of ~28 soft glowing dots (14 on
  touch devices) that drift with gentle sine-based turbulence, are loosely
  drawn toward the cursor when nearby, and draw faint connective lines
  between neighbors for a "fluid mesh" look — a single shared
  `requestAnimationFrame` loop, torn down on unmount.
- ~~**Ripple 3D Effect** — every click/tap anywhere on the dashboard spawns
  a real wave-interference simulation instead of one fading circle: a
  single continuous radial gradient per ripple whose color stops *are*
  the sine wave and its exponential decay envelope (160 stops — the
  browser's own gradient interpolation renders it as one seamless,
  continuously-blended swell with no visible ring edges, the way an
  actual water ripple looks, not a stack of separate stroked circles),
  colors cycling teal → indigo per crest, drawn with additive
  (`"lighter"`) canvas blending — so when two ripples cross, they don't
  just overlap flatly, they add into a bright interference zone, the
  same look as a real water-ripple photograph. Canvas 2D, not WebGL —
  cheap enough to run continuously, capped at 4 concurrent ripple
  sources.~~ Removed.

Details:
- `LiquidBackground` takes `dark` (computed from the active Panel Theme's
  background via the existing `hexLuminance` helper) so blob/gradient
  opacity and blend mode (`multiply` on light presets, `screen` on dark
  ones) stay legible on every preset, light or dark or Glass.
- Ripple detection listens on the dashboard's own outer ref
  (`dashboardRootRef`, new) via `pointerdown` — no extra DOM wrapper, no
  interference with existing click handlers.
- `prefers-reduced-motion` freezes every animated layer to one still
  frame (gradient/blobs stop, particles render once with no cursor
  tracking, no ripples spawn) — matches the accessibility bar the rest of
  the app already holds itself to.
- `pointer: coarse` (phones/tablets) halves the particle count and skips
  the cursor-attraction math, since there's no persistent cursor there.
- Pure inline SVG + Canvas 2D + `framer-motion` — no new npm installs.
  Purely decorative, no new Firestore fields, no new app state.

### Follow-up tuning (this update)
Two rounds of visibility fixes on top of the initial build, then one
intensity dial-back once it was actually visible:
- All the gradient/blob/wave/particle alpha values were boosted noticeably
  (roughly +50–70%) after the first pass looked too faint against the
  cream/white base — the earlier values were tuned for a flashier dark
  mockup and read as almost invisible on the app's actual light theme.
- The **real bug** turned out to be a CSS stacking-context issue, not
  opacity at all: the dashboard's outer panel had `position: relative`
  but no `z-index`, so it never established its own stacking context —
  meaning the `z-index: -1` LiquidBackground layer wasn't confined
  *inside* the panel, it escaped to whatever ancestor stacking context
  existed further up and painted behind that instead, invisible no
  matter how the colors were tuned. Fixed with `zIndex: 0` +
  `isolation: "isolate"` on the outer panel div in
  `components/BTLDashboard.jsx`. If a background layer like this is ever
  "in the DOM with the right styles but invisible," check this first.
- Once actually visible, the first pass read as too vivid/saturated for
  a data-dense dashboard, so gradient/blob/wave/particle alpha were
  dialed back roughly 40% and the glass-card overlay opacity was nudged
  back up (46%→66% light / 38%→56% dark) for crisper text contrast —
  landing on a softer, still colorful wash instead of a loud one.

## ⏰ New — "Analog Clock & Alarm" widget (earlier update)

A new widget — add it from **Setting → Layout → Add widget → Analog
Clock & Alarm** (or it's already in the default layout on a fresh
install). It's a live analog clock face that doubles as a one-click
alarm setter, plus a matching "ring" popup and a ringtone picker.

- **Real analog clock** — hour, minute, and second hands driven by the
  actual system time (redrawn every second via `AnalogClockWidget`'s own
  `setInterval`), with a 12-number dial and a digital `HH:MM:SS AM/PM`
  readout underneath.
- **Hover-to-preview** — moving the mouse anywhere inside the dial
  computes the angle from center, converts it to a 12-hour-dial reading
  (`clockAngleToTime12`), and shows a small dark popup right next to the
  cursor with that time (e.g. `03:15 · double-click for alarm`).
- **Double-click to arm an alarm** — double-clicking commits that spot's
  time as a real alarm. Since a bare dial position is ambiguous between
  AM/PM, `nearestFutureTime()` picks whichever of the two is soonest
  from right now, so it always arms the *next* upcoming occurrence.
  Armed alarms show as small colored dots on the dial itself and as
  removable chips (tap the ✕) under the clock.
- **Alarms are daily-recurring** — because the dial can't distinguish
  today from tomorrow, an armed `"HH:MM"` simply fires every day the
  live clock reaches it, until it's removed from the widget's chip
  list. New `state.clockAlarms: { id, time }[]`.
- **The ring popup** — `AlarmRingModal`, a glassmorphism card (same
  recipe as Settings/Memories) with a warm pulsing radial-gradient wash
  behind a shaking `AlarmClock` icon, the fired time in large monospace
  text, the active ringtone's name, and a **Done** button to dismiss.
  Rendered at the dashboard's top level so it pops up over whatever tab
  you're on when an alarm fires.
- **Ringtones** — 4 built-in tones (**Classic Beep**, **Gentle Chime**,
  **Digital Pulse**, **Bell Toll**), all synthesized live with the Web
  Audio API (`playRingtoneCycle`/`startAlarmRingtone`) — no audio files
  bundled. The alarm loops its ringtone gapless for **up to 30 seconds**
  (`ALARM_MAX_RING_MS`) or until "Done" is tapped, whichever comes first.
- **Setting → Alarm** (new tab next to Theme) — pick which of the 4
  ringtones plays when an alarm fires, with a ▶ preview button on each
  option so you can hear it before committing. Selection is saved to
  `state.clockRingtone` like the rest of the app's settings.
- Pure `framer-motion` + inline SVG + Web Audio — no new npm installs,
  fits the existing per-user Firestore document (`clockAlarms` +
  `clockRingtone` are just two new fields on the same `btl_state/{uid}`
  doc everything else already lives in).

## 🌍 New — "Earthquake" jitter on checkbox tick (earlier update)

Ticking a checkbox (Daily Goals, Extry Goals, or Time Table) previously
only triggered a color flash / scale pop. Now the whole row around the
checkbox — the checkbox itself, the Time Table rail/line, and the
item's words — briefly "quakes": a fast, decaying left-right/up-down
jitter with a touch of rotation, scoped to roughly the area circled in
the reference screenshot around the checkbox.

- New shared `quakeAnimate(isCelebrating)` helper (next to `GoalChecklist`)
  returns a `framer-motion` keyframe `animate` object — 6-step decaying
  x/y/rotate jitter over ~0.45s — with the peak displacement derived
  from `QUAKE_UNIT` (14px, the checkbox's own width/height) so the shake
  reads as scaled to the checkbox, not an arbitrary wobble.
- Wired into the same `isCelebrating` flag both checklist types already
  use for their "just completed" flash/burst, so it fires automatically
  right when a box is ticked — no new state, no new Firestore fields.
- `GoalChecklist`'s draggable row content (`Daily Goals` / `Extry Goals`)
  and `TimeTableRow`'s content row (checkbox + rail + time + text) both
  now render as `motion.div` with this `animate` applied, so the quake
  sweeps through everything sitting in that row together.

## 💰 Fix — "Total Earn/Spend Money life" pills washed out on light backgrounds (earlier update)

The two header pills next to the logo (**Total Earn Money life** /
**Total Spend Money life**) used `opacity: 0.55` for their "coming soon"
disabled look, on top of an `Oval` whose default background already
matches the dashboard's own background color. On a light Panel Theme
preset, that combination made the pill nearly disappear into the page —
just a faint outline with washed-out green/red text (visible in the
screenshot).

- Both pills now get their own **fixed, always-visible tinted fill** —
  a translucent green wash + solid green border for Earn, translucent red
  wash + solid red border for Spend — instead of inheriting the page's
  own background. This reads clearly on every Panel Theme preset, light
  or dark, without needing per-preset special-casing.
- Dropped the blanket `opacity: 0.55` that was also fading the ₹ amount
  chip inside each pill; the `cursor: "not-allowed"` + "Coming soon"
  tooltip already communicate that these aren't clickable yet, so the
  numbers themselves stay fully legible.

## 🎯 Fix — ring/circle percentage text going invisible on dark presets (earlier update)

The Daily/Extry/Overall percentage rings inside the **Analytics Summary**
widget (and its live preview in Setting → Theme → Analytics Summary) were
reading their text color straight from the *global* dashboard theme
(`DashboardThemeCtx`) instead of from whatever background that specific
ring actually sits on. Under a dark/Glass preset, that global text color
is light — fine on the real dark dashboard, but the Settings preview
renders on a plain white/cream popup, so the percentage numbers came out
near-white-on-white and effectively disappeared (visible in the
screenshot: empty-looking Daily/Extry/Overall rings).

- `RingStat` now accepts an explicit `textColor` override (falls back to
  the dashboard context exactly as before if none is given, so the header
  rings — Daily Goal / Extry Goal / Goal up top — are unaffected).
- `AnalyticsSummaryMetric` now passes its already-computed, background-
  aware `safeTextColor` into `RingStat` for the ring case, the same value
  it already used for the streak/money metrics. Since that color is
  computed from the metric's actual `cardBg` (via `autoTextColor`), it's
  now correct in both places: dark and legible in the Settings preview
  (no `cardBg` there → falls back to the app's default dark text), and
  still auto-contrasted against whatever color the widget has on the real
  dashboard.

## 🪟 Fix — glass cards looked like flat/muted solid colors, not glass (earlier update)

Picking the new Glass preset (or any preset really) still rendered widgets
as a fairly flat, opaque-looking color patch instead of true frosted
glass — compare to the app's own `LifeStoryProfileSetup` "Start your Life
Story" popup, which already nailed the look. The difference was the
recipe, not the concept:

- `glassCardStyle()` (used by every widget/panel, see previous update) now
  matches that popup's exact recipe: **stronger blur** (16px → 24px) with
  a bigger **saturate boost** (150% → 190%), a **bright semi-opaque white
  edge highlight** border instead of a barely-there tinted one (this is
  the single biggest tell for "glass" vs. "muted color" — it's the rim
  light every real glass/frosted surface catches), and a **much bigger,
  softer lifted shadow** (8px/28px → 20px/50px) so the card visibly
  floats above the page instead of reading as a slightly-transparent flat
  fill sitting flush with the background.
- No other change needed — this one shared helper feeds every widget,
  the full-screen Analytics/Money/Focus Mode panels, and the Friend
  Celebration cards from the previous update, so all of them pick up the
  fix together.

## 🥂 New — full "Glass" Panel Theme + glassmorphism extended to every panel/widget (earlier update)

Previously, the frosted-glass ("Glassmorphism 2.0") treatment only applied
to 4 widgets — Daily Goals, Extry Goals, Time Table, Calendar. Everything
else (Life Big Goals, Life Rules, Earn Money/Notes, Analytics Summary, the
full Analytics screen, Money Management, and Focus Mode) still rendered as
a flat, opaque color card.

- **Every remaining panel/widget now renders through the same
  `glassCardStyle(cardBg)` helper** — semi-transparent fill + `backdrop-filter:
  blur(16px) saturate(150%)` + an auto light/dark border and shadow — so
  **no widget or full-screen panel anywhere shows a flat opaque color
  anymore**, on any Panel Theme preset (Ocean, Sunset, Forest, Berry,
  Midnight, Charcoal, Black & White). Converted: `TextList` (Life Big
  Goals / Life Rules), `EarnMoneyNotesCard`, `AnalyticsSummaryWidget`, the
  full-screen `AnalyticsTab`, `MoneyManagementScreen`, and Focus Mode's
  container (when it has a custom background). Their header strips now
  sit transparently on top of that same blurred card instead of drawing a
  second flat-colored bar.
- **New 8th Panel Theme preset — "Glass"** — sits in the same one-click
  **Panel Theme** row (Setting → 🎨 Theme) as the other 7. Instead of a
  flat tinted background, it pairs a deep indigo canvas (`#2b2f52`) with a
  pure-white `widgetBg` — since every card now renders through
  `glassCardStyle`, that white becomes true frosted glass floating over
  the indigo, the closest match in this stack to Apple's "Liquid Glass"
  language. Like every other preset, picking it writes into the exact
  same `bg`/`text`/`widgetBg` fields — no new theme schema.
- **Text stays perfectly legible everywhere** — this reuses the existing
  `autoTextColor`/`autoMutedColor` helpers unchanged (they already read
  whatever `cardBg` a widget has and flip between light/dark text based on
  its brightness), so every one of the newly-glassy cards keeps
  auto-contrast text exactly like the original 4 always did — nothing
  extra to configure, including under the new Glass preset itself.
- Also added real `backdrop-filter` blur to Friend Celebration's Invite,
  Your Friends, and VS-dashboard cards, which were already
  semi-transparent (`rgba(255,255,255,…)`) but previously had no blur
  behind them — they're now true frosted glass too, matching the chat
  popup, which already had it.
- Pure CSS — no new npm installs, no new Firestore fields.

## ✨ New — "system intelligence" micro-interactions on Daily Goals / Extry Goals (earlier update)

Two small but noticeable interactions on the **Daily Goals** and **Extry
Goals** cards (both use the same `GoalChecklist` component):

- **50%-subtask progress nudge** — the moment a goal's subtasks cross
  from under half done to half-or-more done (and it isn't fully done
  yet — that already has its own full "done" celebration flash), a
  small pill reading **"✨ Halfway there"** pops onto that row's
  top-right corner for about 1.5s, then fades. Tracked via a
  per-goal last-seen-ratio ref (`subtaskRatioRef`) inside
  `GoalChecklist`, compared each time the `items` prop updates — purely
  a UI nudge, doesn't touch stored state.
- **Swipe-to-complete on mobile** — on a touch device (phones/tablets,
  detected via `(pointer: coarse)` through the new `useIsTouchDevice()`
  hook), a goal row can now be **swiped right to mark it done**, or —
  if it's already done — **swiped left to undo**, in addition to the
  checkbox (which still works exactly as before, on every device). As
  you drag, a green check (or red undo) reveals behind the row with
  opacity tied to drag distance; release past ~60px to commit, short of
  that and it springs back. **Desktop mouse users see zero change** —
  drag is entirely disabled (`drag={false}`) unless a coarse pointer is
  detected, so no existing click/hover behavior on the row (icon
  picker, expand chevron, delete) is affected.
- Both are pure `framer-motion` + a bit of local state — no new npm
  installs, no new Firestore fields (the nudge and drag offset are
  transient UI state, not persisted).

## 🌫️ New — Glassmorphism 2.0 on Daily Goals / Extry Goals, Time Table & Calendar cards (earlier update)

The three checklist-style cards on the dashboard no longer render as a
flat, fully-opaque cream fill — they now use a frosted-glass look:
semi-transparent background + backdrop blur, a soft ambient shadow,
and a subtle inner highlight for depth.

- Applies to: **Daily Goals**, **Extry Goals** (both share the same
  `GoalChecklist` component), **Time Table**, and **Calendar**.
- New `glassCardStyle(cardBg)` helper (next to the existing
  `autoTextColor`/`autoMutedColor` helpers in `components/BTLDashboard.jsx`)
  takes whatever color is already sitting in that card's `cardBg` — the
  app's default cream, a per-widget custom color from Setting → Theme →
  Widgets, or a color written in by a Panel Theme preset — and renders
  it at ~55% opacity with `backdrop-filter: blur(16px) saturate(150%)`
  behind it, plus a shadow/border that automatically switches between a
  light-mode and dark-mode look based on that same color's brightness
  (reusing the existing `hexLuminance` check). **No new theme fields or
  settings needed** — same pattern as the auto-contrast text fix above.
- Pure CSS (`backdrop-filter`), no new npm installs. Support is ~97%
  across browsers; on the rare browser without it, the card just shows
  its semi-transparent color without the blur — still readable, just
  slightly less "frosted."

## 🖼️ New — browser tab / app icon added (earlier update)

The browser tab (favicon) and home-screen icon now show a custom "B"
monogram mark — dark badge, cream "B" wordmark, small orange spark
accent — matching the app's existing dark + orange color language.

- `app/icon.svg` — Next.js App Router auto-picks this up as the site
  favicon, no `<link>` tags or `layout.jsx` changes needed.
- `app/apple-icon.png` (180×180) — iOS "Add to Home Screen" icon,
  auto-detected the same way.
- `public/favicon.ico` — classic multi-size fallback (16/32/48/64px)
  for older browsers and bookmark bars.

## 🛠️ Fix — colors weren't legible on dark Panel Theme presets + 7th "Black & White" preset added (earlier update)

**Bug fix:** picking a darker Panel Theme preset (Midnight / Charcoal)
correctly changed every card's *background*, but a lot of body text —
the header's Daily/Extry/Overall goal-ring numbers, the Day Streak
area, Daily Goals / Extry Goals list text, Life Big Goals / Life
Rules list text, the Analytics Summary widget's numbers, Calendar day
numbers, and the "Today's Mood" label — was hardcoded to the app's
original dark brown/black text color. On a light preset that's
invisible-on-invisible... on a *dark* preset it went dark-text-on-
dark-card, which is what was making colors feel "not managed
properly."

- Every one of those spots now **auto-computes its own text color**
  from whatever background it's actually sitting on (its own widget
  color, or the Dashboard scope color for header elements) — light
  text on a dark card, dark text on a light card, automatically, with
  no extra setting to configure. This applies whether the color came
  from a Panel Theme preset, a per-widget custom color, or a manual
  pick in any of the Theme tabs (Dashboard / Analytics / Widgets /
  Analytics Summary / Money Management / Focus Mode / Friend
  Celebration) — all of them already write into the same `bg`/`text`
  fields this fix reads from, so no new theme fields were needed.
- **New 7th preset — "Black & White"** — pure black background, white
  text, near-black widget cards. Sits alongside the existing Ocean /
  Sunset / Forest / Berry / Midnight / Charcoal presets in the same
  one-click **Panel Theme** row at the top of Setting → 🎨 Theme.

## 🎨 New feature — 6 one-click "Panel Theme" presets in Setting → Theme (earlier update)

A new **Panel Theme** row now sits at the very top of **Setting → 🎨
Theme**, above the existing Dashboard / Analytics / Widgets / Money /
Focus Mode / Friend Celebration tabs.

- **6 ready-made color patterns** — Ocean, Sunset, Forest, Berry,
  Midnight, Charcoal — each shown as a round two-tone swatch button.
  Tapping one **instantly recolors the whole panel in one go**:
  Dashboard, Analytics, Money Management, Focus Mode, Friend
  Celebration (background + text color for all five) *and* every
  widget's background — all applied together, not one section at a
  time.
- The active preset gets a checkmark + highlighted ring so it's clear
  which one is currently applied, plus a **Reset** button next to the
  row that clears it back to the app's original look everywhere at
  once.
- This sits *on top of* the existing per-section Theme editors — they're
  untouched and still work exactly as before, so after picking a preset
  you can still open, say, "Money Management" and fine-tune just that
  one section's background/text/font further, or tweak a single
  widget's color in the Widgets tab.
- Stored as `state.theme.panelPreset` (which preset, if any, is active)
  alongside the existing per-scope `bg`/`text` values it writes into —
  saved to Firestore per-user like the rest of `state.theme`, so it
  persists across devices/sessions same as everything else in Settings.
- No new npm installs — reuses the same `framer-motion` swatch-button
  pattern already used throughout the Theme panel.

## 🎉 New feature — Friend Celebration (invite, VS dashboard, live chat, friend's Memories) (earlier update)

A new **red 👥 "Friend Celebration" icon** sits in the header, next to
Setting. Clicking it opens a **full-screen panel** — not a small modal —
with a dramatic **"VS" clash animation** (two avatars zoom in from either
side and collide with a flash + "VS" text) every single time it opens.

- **First screen (the "hub")** — your name/avatar up top, an **Invite a
  Friend** box (type their email → they must already have signed into
  BTL once), a live **Requests** list of anyone who's invited *you*
  (Accept ✓ / Decline ✕), your own pending **Sent** invites (cancelable),
  and a grid of **Your Friends** you can tap into.
- **Accepting a request** (by you, or by the person you invited) creates
  a `friendships/{uidA_uidB}` doc. If you're sitting on the hub when the
  *other* person accepts, the app **auto-jumps straight into the VS
  screen** with a fresh VS animation — no refresh needed.
- **The VS split-screen dashboard** (opened from "Your Friends", or
  automatically as above) shows **you vs. your friend side by side**:
  avatar, Total Earn/Total Spend chips, 5 small ring stats (Daily /
  Extry / Overall / Streak / Score), and read-only **Daily Goals** +
  **Extra Goals** lists for each of you, live from Firestore.
- **Chat button** (top center) opens a **glassmorphic chat popup**
  (blurred dark glass, colored message bubbles, spring pop-in) — real
  real-time messaging with your friend, stored per-friendship.
- **Memory button** on your friend's side opens the **exact same
  Memories modal** the rest of the app already uses (tabs for Goals /
  Money / Photos / Notes, date timeline) — just fed with your friend's
  live data instead of yours, and read-only (their notes box is hidden).
- Built entirely with `framer-motion` + `lucide-react` (both already
  dependencies) — **no new npm installs**.

**New files:** `lib/friendsStorage.js` (all the Firestore calls for
requests/friendships/chat) and `components/FriendCelebration.jsx` (the
whole UI). `components/BTLDashboard.jsx` only changed by: exporting
`MemoriesModal` (so the friend-memory view can reuse it), adding the
header icon + badge, and rendering `<FriendCelebration />` alongside the
other modals.

⚠️ **You must redeploy `firestore.rules`** for this to work — new rules
were added for `users_public`, `friend_requests`, `friendships`, and
`friend_chats/{id}/messages`, plus your own `btl_state/{uid}` read rule
was relaxed so an *accepted friend* (and only an accepted friend) can
read your dashboard data for the VS screen. Go to **Firestore Database →
Rules** in the Firebase console, paste the new `firestore.rules`, and
click **Publish** — the app will otherwise get permission-denied errors
on this feature (everything else keeps working as before).

## Header — brand title, streak badge, goal rings & avatar now animated (earlier update)

More header polish, same "alive not static" treatment as the icon
buttons:

- **"Byound The Life" brand pill** — a slow breathing scale loop plus a
  soft pulsing glow ring behind it, so the header's anchor point draws
  a little attention without being distracting.
- **Day Streak badge (the "001" circle)** — now has a looping orange
  glow pulse (streak/fire themed) and scales up slightly on hover.
- **Goal rings (Daily/Extry/Overall)** — the progress arc now animates
  in with a spring (instead of a flat CSS transition) whenever the
  percentage changes, the whole ring lifts + scales a touch on hover,
  and any ring that hits **100%** gets its own looping colored glow as
  a small celebration.
- **Profile avatar** — same soft pulsing glow ring + hover lift/scale
  as the other header buttons, so it matches the rest of the row.
- All built with `framer-motion` (`animate`/`whileHover` loops and
  spring transitions) — no new npm installs, no layout changes to
  anything these components are used in elsewhere (RingStat is shared
  by Analytics/Money summaries too, so those pick up the same
  animated-fill + 100%-glow behavior for free).

## Header — Focus Mode / Setting are now icon buttons + new Share Journey icon (earlier update)

- **Focus Mode** and **Setting** in the header no longer show as text
  pills — they're now small **circular icon-only buttons** (name shows
  as a native tooltip on hover, not as visible text), each with a
  soft **pulsing glow ring** looping behind the icon so they read as
  "alive" rather than flat static buttons. Lift + scale on hover,
  spring squash on tap — built with `framer-motion`, no new npm
  installs.
- **New "📤 Share Journey" icon** added right next to them — tapping it
  opens the same Share Your Journey card (Life Score, Earn/Spend,
  Today's Goals, Today's Notes) that was previously only reachable from
  the Analytics tab, so you can generate + download it straight from
  the main dashboard header now too.
- Internally, the Life Score formula used by that card was pulled out
  into a shared `computeLifeScore()` helper so both the Analytics tab
  and this new header button compute the exact same score — no
  duplicated logic, no drift between the two.

## Header — Total Earn/Spend pills stacked, amounts bold + highlighted (earlier update)

The **"Total Earn Money life"** and **"Total Spend Money life"** pills in
the top header used to sit inline in the same crowded row as
Goals/memor/life story. Now:

- They're **stacked one above the other** (Earned on top, Spent below)
  in their own small column, instead of squeezed sideways into the row.
- The **₹ amount itself** is now **bold** and sits in its own small
  rounded highlight chip — green tint for Earned, red tint for Spent —
  so the numbers are easy to spot at a glance instead of blending into
  the label text.
- Pure layout/styling change — same `state.totalEarnLife` /
  `state.totalSpendLife` values, same "Coming soon" tooltip, nothing
  else touched.

## Earn/Spend widget — "Done" button no longer wipes today's saved note (earlier update)

**Bug fix:** typing a note in the Earn/Spend widget and tapping **Done**
was instantly erasing it from `dailyLogs[today].notes` — the exact
field **Memories → Notes** reads from. So the note vanished the moment
you hit Done, and Memories always showed "Nothing written for this day
yet," even right after writing something.

- `Done` now only clears the widget's own draft textarea + photo
  preview (a fresh blank box, same as before), and **no longer touches
  `dailyLogs[day].notes`**. Whatever you typed stays saved for today,
  so it now shows up correctly in **Memories → that day → Notes**.
- If you keep typing a new note afterward (same day), it live-syncs and
  overwrites the saved note as normal — same behavior as before this
  fix, just without the accidental wipe on Done.
- The Share Your Journey card's "Today's Notes" box (previous update)
  already had a fallback to `dailyLogs[today].notes`, so it now shows
  the correct saved note after Done too.

## Share Your Journey card — Earn/Spend redone, notes replace the quote (earlier update)

Reworked the generated **Share Your Journey** image (Canvas 2D card):

- **Removed the old "Total Earned" stat pill** from the 4-stat row (it
  was cramped and only showed earnings, not spending).
- **New dedicated Earn & Spend panel** right below the Life Score ring:
  two proper side-by-side cards — 💰 **Earned Today** (green) and 💸
  **Spent Today** (red), sourced from `state.moneyHistory[today]` (the
  same per-day aggregate the Money Management trend chart already
  uses) — not the lifetime totals — plus a **Net Today ₹X** readout
  centered underneath.
- **Bottom quote box now shows today's notes instead.** The old
  hardcoded/`lifeRules` quote ("Wake up at 5 AM", etc.) is gone; that
  box now reads straight from `state.notes` (same field the Earn/Spend
  widget's notes textarea writes to), rendered in **bold black** text.
  If there's nothing written yet today, it shows a plain "No notes
  added today" placeholder instead.
- No schema changes, no new npm installs — still pure Canvas 2D reading
  fields the app already tracks.

## Earn/Spend widget — a "Done" button to clear today's notes + photo (earlier update)

Right below the notes box + photo upload square (the circled area) in
the Earn/Spend Money widget, a green **"Done — clear notes & photo"**
button now shows up as soon as either one has something in it.

- Tap it and both clear instantly — the notes textarea empties and the
  photo preview square goes back to the placeholder icon.
- It's saved right away through the same `update()`/Firestore sync
  path everything else in the app already uses, so it stays cleared
  after a refresh — this isn't just a local/visual reset.
- Doesn't touch anything in **Memories** — past photos there live in
  `dailyLogs[day].images` (a separate running list), untouched by this.
- The button fades in/out with its own tiny height animation (`framer-
  motion`, already a dependency) instead of just popping in — no new
  npm installs required.

## Share Your Journey — full pro upgrade: your name + today's goals list (earlier update)

The **Share Your Journey** card (Analytics tab → "📤 Share Journey") got a
complete overhaul:

- **Your name, front and center** — the card's headline is now
  `"{Your Name}'s Journey"`, pulled straight from your signed-in Google
  account (falls back to your Life Story profile name, then "My
  Journey" if neither is set).
- **Today's Goals — full breakdown.** A new section lists every goal
  from both Daily Goals and Extra Goals for today, split into two
  panels side by side:
  - **✅ Completed** — green check markers, with each goal's category
    color-dot next to it.
  - **⏳ Pending** — hollow red-tinted markers for what's still left.
  - A 4th stat pill ("📋 Today's Goals — X/Y") joined the existing
    Day Streak / Total Earned / Top Category row.
  - Long lists cap at 8 rows per side with a "+N more" so the image
    never gets absurdly tall; the card's height is computed dynamically
    off how many goals you actually have, so nothing ever gets cropped.
- **Pro-level modal, with animation:**
  - Spring pop-in/out on open and close, backdrop blur.
  - A live "{name} · X/Y goals done today" chip above the preview.
  - A shimmering skeleton while the card renders (instead of a bare
    "Generating…" line).
  - New **Copy** button (copies the PNG straight to your clipboard,
    next to Download/Share) — only shown on browsers that support it.
- Still pure Canvas 2D + `framer-motion` (both already in the project)
  — no new npm installs required.

## Life Story — hide today's entry with a macOS "genie" effect (earlier update)

A small **hide / show** toggle now sits right next to the "Life Story"
title in the header. Tap it and today's writing box gets sucked away
into that button with a macOS-dock-style **genie** minimize animation
— tap again and it unfurls back out from the same spot.

- Only **today's** box is affected — past entries stay exactly as they are.
- While hidden, a small dashed "Today's entry is hidden — tap to bring
  it back" pill sits in its place, so it's obvious it's just tucked
  away, not deleted.
- Built with an SVG `feTurbulence` + `feDisplacementMap` ripple filter
  (triggered via SMIL `beginElement()`) for the liquid "neck" warp,
  layered under `framer-motion`'s imperative `animate()` (already a
  project dependency) driving the bulge-then-pinch scale/translate
  toward the button. No new npm installs required.
- Note: the reference you linked (`alexwidua/genie`) is a Swift +
  Metal shader built for native iOS/macOS apps — it can't run inside a
  Next.js/React web page, so this recreates the same visual result
  using web-native primitives instead of porting that code directly.
- Nothing is saved to Firestore for this — it's a per-session UI
  toggle, so today's box shows again by default next time you open
  the app.

## Life Story — animated shimmer border (earlier update)

The old day-card border (`1px solid #ece7d8`) was almost invisible against
the cream background — barely showed where the writing box actually was.
Fixed by rebuilding it as a proper animated gradient border:

- A 2px gradient ring (orange → soft gold → blue → orange) now wraps
  every day card, clearly outlining it against the page background.
- The gradient **slowly shimmers/travels** around the border on a loop —
  faster on **today's** entry (5s) than on past entries (9s), so the box
  you're actively writing in draws a bit more attention.
- Today's card also carries a soft accent glow (`box-shadow`) so it reads
  as the "active" one at a glance.
- Built by animating `backgroundPosition` on a `background-size: 300%`
  gradient via `framer-motion`'s `animate` — not animating the `border`
  property directly, which the animation performance guidance for this
  stack calls out as expensive; this keeps it GPU-friendly. No new npm
  installs required.

## Life Story — select-to-format toolbar (earlier update)

Highlight any word or sentence inside **today's** entry and a small
floating toolbar pops up right above the selection — no need to open the
page-wide Theme settings for a one-off change:

- **Bold**, **Italic**, **Underline** buttons.
- **7 quick color swatches** + a full custom color wheel (native color
  picker) for that selection only.
- Works together with the page-wide Theme (font/size/bg) — this toolbar
  only touches the exact text you've selected, so you can bold one word
  and leave the rest alone.
- Formatting is written straight into the entry's saved HTML (same
  `dangerouslySetInnerHTML` already used to render past entries), so it
  shows up correctly the next time you open the app too.

Built with `document.execCommand` (`bold`/`italic`/`underline`/
`foreColor`) — the same approach this file already used for
paste-as-plain-text — applied only to the live selection, so no new npm
installs required.

## Life Story — page theme settings (earlier update)

A **theme** button now sits next to **filters** in the Life Story header.
Tapping it opens the same glass popover style as the rest of the app, with:

- **10 preset themes** — Classic, Midnight (black paper, white text),
  Sepia, Ocean, Sunset, Forest, Rose, Lavender, Slate, Pure Mono — each
  shown as an "Aa" swatch so you see the look before picking it.
- **Font** — 12 options (Default, System Sans, Georgia, Times New Roman,
  Garamond, Palatino, Bookman, Verdana, Trebuchet MS, Tahoma, Courier
  typewriter, Comic Sans), all web-safe stacks — no new npm installs or
  font files to load.
- **Text size** — an 11–22px slider.
- **Bold text** — a single on/off toggle applied to every entry.
- **Text color** and **page background color** — native color pickers, so
  any custom combination is reachable beyond the 10 presets (picking
  either one switches the preset indicator to "custom").
- **Reset to default** — one tap back to the app's normal cream/dark look.

Applies to the whole Life Story page background and every day's story
text (today's editable entry + all past entries). On dark presets like
Midnight, the day cards themselves also switch to a subtle light-on-dark
glass tint automatically, so text stays readable instead of dark-on-dark.

Saved at `state.lifeStory.theme` — same per-user Firestore sync as
everything else, so it persists across devices and sessions. Built with
`framer-motion` for the popover, matching the Jump-to-date popover
already in this tab — no new npm installs required.

**Bug fix (this update):** typing an entry, adding/removing a photo, or
setting up your Life Story profile was silently wiping the saved theme
back to default. Root cause: those four save paths each rebuilt the
`state.lifeStory` object from scratch and forgot to carry the `theme`
field along — so the very next keystroke after picking a theme reset it.
All four now preserve `theme` explicitly. Verified: pick a non-default
theme, type text, add a photo, remove a photo — theme stays exactly as
set in every case.

## Profile avatar + account popup (earlier update)

A round **profile avatar** now sits in the header's top-right cluster —
right where the plain sign-out icon used to sit on its own, next to the
Day Streak badge and the Daily/Extry/Overall goal rings. Tapping it fans
open a **Glassmorphism 2.0 popup** (same blur/border/shadow recipe as the
Memories and Money glass modals, spring entrance/exit) that drops down
from that same top-right corner, over the Earn/Spend Money and Analytics
Summary widgets underneath:

- **Signed in** — shows your Google photo (or a colored initial if you
  have none), display name, email, and a "Signed in with Google" badge,
  plus a **Sign out** button (moved here from the old standalone icon).
- **Not signed in** (edge case — `AuthGuard` already keeps signed-out
  users on `/login` before they ever reach `/dashboard`, but the popup
  handles it gracefully anyway) — shows a single **Continue with
  Google** button. Firebase's Google OAuth creates the account
  automatically the first time someone uses it, so one button covers
  both **login and signup** — no separate signup form is needed.
- Clicking anywhere outside the popup closes it.

Built entirely with `framer-motion` (already a project dependency) — no
new npm installs required.

## Memories — Money tab now shows "where it went" + photos (earlier update)
The **Memories → Money** tab for a day used to only show the Earned/Spent/
Net totals + two bars. It now also lists every individual earn/spend
entry logged that day, straight from `state.moneyEntries`:

- Green ⬆ for earnings, red ⬇ for spends, with the spend's category chip
  (🍔 Food, 🚗 Transport, etc.) so you can see exactly what the money was
  for — matches the category system already used in the Spend Money
  popup / Money Management tab.
- The note typed on that entry, if any.
- **The attached photo, if one was added** (earn or spend can both carry
  a photo via the existing drag-and-drop/tap-to-browse upload) — shown
  as a small thumbnail, tap to open in the same full-screen lightbox the
  Photos tab already uses (download button included).
- Rows fade/slide in with a staggered entrance, same glass-card style as
  the rest of the Memories modal.
- The **Money** tab's badge count now reflects the number of entries
  that day, not just "has money y/n".

No schema change — every entry already had `category`/`note`/`image` on
it (used by Money Management); this just surfaces them per-day inside
Memories too. No new npm installs required.

## Analytics tab — "Deep Analytics" (this update, 8 new pro widgets)

A new **🔬 Deep Analytics** section at the bottom of **Analytics & Insights**,
below the Money nav card. Every widget is computed from data that already
exists in `state` — nothing fabricated:

1. **Category performance** — animated bar per goal category (Health,
   Money, Career, Relations, Personal, Other), done/total + completion %.
2. **Priority performance** — same, split by High/Medium/Low priority.
3. **Best & toughest weekdays** — a bar chart of average completion by
   day of week (last 13 weeks of `completionHistory`), best day in green,
   toughest in red.
4. **Streak record** — current streak (`state.streak`) side-by-side with
   your longest-ever run of ≥70%-complete consecutive days, with a 🏆
   callout when you're on your all-time best.
5. **Mood distribution** — a donut of Happy/Neutral/Sad across every
   logged day in `moodLog`.
6. **Money velocity — last 14 days** — a combo chart (earn bars, spend
   bars, net line) from `moneyHistory`, plus the net change vs. the
   previous 14-day window.
7. **Subtask completion** — a radial progress ring over how many
   subtasks (across every goal) are checked off.
8. **Weekly momentum** — this week's average completion vs. last week's,
   with an up/down callout — the same comparison Smart Insights already
   makes in text, now as its own visual.

Every card fades/slides in with a staggered spring on open and lifts
slightly on hover; bars, the radial ring, and chart series animate in
rather than snapping into place. Colors are pulled from the app's own
palette (category colors, priority colors, `C.accent`/`C.blue`/`C.dark`)
so nothing clashes with the rest of the theme. Empty-state widgets (e.g.
no subtasks yet, fewer than 2 weeks of history) show a short explainer
instead of a blank/misleading chart. Built with `framer-motion` and the
`recharts` primitives already used elsewhere in this file — no new npm
installs required.

## Quick-nav floating button — Money Management shortcut (this update)
The quick-nav fan-out (bottom-right corner) now has a 6th button: a
**Money Management** shortcut with a wallet icon (orange, matching the
app's money accent color), jumping straight to that tab. Order is
memor → Focus Mode → Layout → Analytics → Money Management → Setting.

## Quick-nav floating button (earlier update)

A round arrow button now sits in the bottom-right corner of the
dashboard card (visible on every tab). Tap it and it fans out — one at a
time, staggered — into round icon buttons for **memor**, **Focus Mode**,
**Layout**, **Analytics**, and **Setting**; tap any one to jump straight
there. The **Layout** and **Analytics** buttons have been removed from
the top header bar (Focus Mode, memor and Setting remain there) since
the quick-nav button now covers them. Built with `framer-motion`, no new
npm installs required.

## Drag-and-drop image upload (this update)

Every image-attach spot in the app now also accepts **drag-and-drop**,
not just tap-to-browse:

- **Money Today's "Image Upload"** (the small square next to the notes
  box) — drag a photo straight onto it; it highlights green while
  dragging over.
- **Earn Money popup** — the "Attach a photo" dropzone now also accepts a
  dragged file (still optional).
- **Spend Money popup** — same, on the receipt/bill photo dropzone.

Dragging over any of these shows a green highlight and, where there's
helper text, it switches to "Drop to attach" while hovering. Dropping a
non-image file still shows the same "Please pick an image file" alert as
picking one manually. No new npm installs required — plain HTML5 drag-
and-drop events (`onDragOver`/`onDrop`) wired into the existing upload
logic, so behavior (resizing, compression, size limit) is identical
either way you attach a photo.

## Money Management — Earn Money not persisting (this update, real fix)

Found and fixed the actual root cause of **Earn Money silently not
saving**: every earn entry was being written with `category: undefined`.
Firestore's `setDoc()` **rejects the entire write** whenever any field —
even a nested one inside an array — is `undefined`. That meant:

- The earn amount briefly showed up in the browser tab (local state
  update), making it *look* like it worked.
- The save to Firestore silently failed (only logged to the browser
  console).
- Because saves resend the whole `state` document, **every save from
  that point on also failed** — including totals, goals, everything —
  until the page was refreshed and the unsaved earn entry was gone.

Fix: earn entries now simply omit the `category` field instead of
setting it to `undefined` (spend entries still get a real category
string, unaffected). Verified end-to-end — added an earning, forced a
save, reloaded the app fresh from the (mocked) database, and the total
now correctly survives the reload instead of reverting to ₹0.

## Money Management — Spend "Done" button bug fix (earlier update)

Fixed a real bug: in the **Spend Money** popup, tapping **Done** without
first picking a category did nothing — the button was silently disabled
with no explanation, so it looked like money simply wouldn't add. Now:

- **Done** stays clickable at all times.
- Tapping it without a category shows a clear red warning — **"⚠️ Ek
  category select karein, tabhi entry add hogi."** — with a shake
  animation and a red outline around the category grid, so it's obvious
  what's missing.
- Picking a category clears the warning immediately, and **Done** commits
  the entry exactly as before.

No new npm installs required for either fix.

## Money Management — per-element custom colors (this update)

Same idea as the Analytics element colors below, now for **Money
Management**. **Setting → 🎨 Theme → Money Management** is a new section
with two cards:

1. **Background/text (top card)** — same background color, text color,
   text size, bold and font controls every other scope (Dashboard,
   Analytics, Focus Mode) already has. Setting a **background color**
   here recolors the whole Money Management panel, header bar, and the
   Spend by category / Earn vs spend / Recent activity cards (they're
   transparent over the panel background, so they follow it automatically).
2. **Element colors (second card)** — one independent custom-color
   swatch for every distinctly-colored piece of the screen:

- Header title ("Money Management")
- Section headings ("🏷️ Spend by category", "📈 Earn vs spend", "🕒 Recent
  activity")
- "Total Earned" / "Total Spent" / "Net (life)" / "Entries logged"
  summary cards (each independent)
- "Earn vs spend" chart — Earned bars, Spent bars, and the Net trend
  line, each its own swatch
- Recent activity — the earn-entry icon/amount color and the spend
  amount color

As before, every field defaults to the built-in look until you pick a
color, one **Reset** restores them all, and it's stored in
`state.theme.moneyColors`, saved to Firestore per-user like the rest of
`state.theme`. Category colors in the donut chart / activity icons (e.g.
🍔 Food, 🚗 Transport) are left untouched since those already carry their
own per-category meaning — this only covers the screen's own accents.

## Analytics tab — per-element custom colors (earlier update)

**Setting → 🎨 Theme → Analytics** now has a second card, **Element
colors**, below the existing background/text/size/font/bold controls.
Every distinctly-colored piece of the **Analytics & Insights** panel now
gets its own independent custom-color swatch (pick a preset or use the
color wheel for any hex), instead of only the one shared "Text color":

- Header title ("Analytics & Insights")
- Life Score ring & score number
- Life Score caption
- "Average completion" / "Best day" / "Toughest day" icons & values (one
  swatch each)
- Stat captions (the small text under those three numbers)
- "🧠 Smart Insights" heading
- Smart Insight card accents (overrides the per-card auto color so every
  card matches)
- Section headings ("Daily goal completion…", "Mood trend…", "💰 Money")
- Heatmap squares — recolors the whole Less→More scale from one swatch
  (lighter tints are generated automatically from the color you pick)
- Mood trend line
- "Earned" label & amount
- "Spent" label & amount

Each swatch defaults to the built-in look (empty = unchanged) until you
pick a color, and a **Reset** button (only shown once something's been
changed) restores every one of them at once. Stored in
`state.theme.analyticsColors` and saved to Firestore per-user like the
rest of `state.theme`. Built with the same `ColorSwatchRow` / preset +
custom-picker pattern already used everywhere else in the Theme panel —
no new npm installs required.

## Calendar — text styling + "missed day" mark (earlier update)

Two additions to the Calendar widget:

- **Text Style now works on Calendar too.** In **Layout → Customize
  Layout**, "Calendar" is now tappable in the reorder list right alongside
  Big Goals/Life Rules/Daily·Entry Goals/Earn Money — select it and the
  Text Style panel below (font size, bold, font, color) applies to the
  widget's title, month label, weekday row, and every day number, exactly
  the same mechanism already used by the other free-text widgets.
- **Ended days that weren't finished get a "cut" mark.** Any date that has
  already passed (before today) and never reached 100% completion now
  gets a small red ✕ badge — same animated-draw treatment as the green
  checkmark (two strokes drawn in via `pathLength`), just red and crossed
  instead of a tick, so a glance at the month shows exactly which days
  were completed (✓, green) vs. which ended incomplete (✕, red, and
  slightly faded). Today and future dates are left unmarked since they
  haven't "ended" yet.

## Calendar widget (earlier update)

A new **Calendar** widget — add it like any other dashboard widget via
**Layout → Customize Layout** (drag to reorder, resize, hide/show), and
give it a background color from **Setting → 🎨 Theme → Widgets**, same as
every other tile.

- **One real month at a time** — Sun–Sat grid, correctly aligned to the
  weekday the 1st falls on, no placeholder/fake days.
- **Finished days get a check mark.** Any date already at 100% in
  `state.completionHistory` (the same data the Heatmap/Life Score already
  use) shows an animated green checkmark badge; a day that's partially
  done gets a soft amber fill so progress is visible at a glance.
- **Tiny prev/next controls sit right under the grid** — two small round
  chevron buttons plus a "Today" shortcut, so switching months doesn't
  take up widget space.
- **Smooth animation throughout**: switching months slides the whole grid
  in the direction you navigated (spring physics, not a snap-cut); each
  day cell pops in with a staggered spring entrance; the checkmark badge
  scales in and its tick is drawn stroke-by-stroke via an animated SVG
  path — all `framer-motion`, the same library used everywhere else in
  this dashboard, so it stays visually and technically consistent with
  the rest of the app. No new npm installs required.

*(Note: `animated-component-libraries` / `animejs` / `canvas-design` /
`ckmdesign-system` were considered per the workspace's animation/design
skills, but they're either CDN-script component kits meant for
marketing-site decoration, a general-purpose animation engine that would
duplicate what `framer-motion` already does here, or design-system/canvas
tooling for static art and slide decks — none are a better fit than
extending the same `framer-motion` primitives (spring layout transitions,
`AnimatePresence`, animated SVG `pathLength`) already powering every
other widget's motion in this codebase.)*

## Analytics Summary — customizable metrics, incl. money totals (earlier update)

The **Analytics Summary** dashboard widget (the ring-chart card with Daily
/ Extry / Overall / Day Streak) is no longer a fixed set — it's now fully
editable from **Setting → 🎨 Theme → Analytics Summary**:

- **Add or remove metrics.** Alongside the existing goal-completion rings
  (Daily/Extry/Overall) and Day Streak, you can now add the **money
  totals** — Total Earned, Total Spent, and Net Money — as metric tiles
  right inside the same widget. Anything not wanted can be removed with
  one tap; the widget shrinks/grows around what's left.
- **Reorder by dragging.** Active metrics are a `framer-motion`
  `Reorder.Group` list — drag the grip handle to change the order shown
  on the dashboard.
- **Live preview.** The Theme panel shows the exact same widget component
  used on the dashboard, so what you see while editing is exactly what
  you get.
- **Reset** restores the original Daily/Extry/Overall/Streak default.

Every add, remove, and reorder animates with the same spring physics
(`framer-motion` `AnimatePresence` + `layout` transitions) already used
throughout the app — tiles pop in/out and slide smoothly into the space
freed up by their neighbors, no new npm installs required. Stored in
`state.theme.analyticsSummary.metrics` (an ordered array of metric ids)
and saved to Firestore per-user like the rest of `state.theme`.

## Custom Theme — Dashboard / Analytics / Widgets / Focus Mode (earlier update)

**Setting → 🎨 Theme** is a new tab (next to Add Goles/Add extry/Add Big
Goal/Add Rule) with four independently-styleable sections, each with its
own live preview and a **Reset** button (only shown once you've changed
something):

- **Dashboard** — the overall dashboard's background color + text color
  (5 presets + a custom color picker each). Applies to the main dashboard
  background and every pill/label that doesn't already have its own
  explicit color (widget titles, nav pills, etc. — via a small React
  context so nothing that was deliberately colored before changes).
- **Analytics** — background color, text color, **text size** (85%–140%
  stepper, same A-/A+ control as Text Style), **bold**, and **font**
  (Default/Poppins/Playfair/Mono) for the whole Analytics & Insights tab.
- **Widgets** — a background color swatch (6 presets + custom) *and* a
  Small/Medium/Large size preset, per widget, for all six widgets (Life
  Big Goals, Life Rules, Daily Goals, Entry Goals, Earn Money/Notes,
  Analytics Summary). This is a quick alternative to dragging a corner in
  the Layout tab — both write to the same `state.layout.sizes`, so they
  never conflict.
- **Focus Mode** — background color, text color, text size, bold, and
  font for the Focus Mode screen (same controls as Analytics).

Everything lives in `state.theme` (`dashboard` / `analytics` / `focusMode`
/ `widgets`, each normalized with sane defaults via `normalizeTheme`) and
is saved to Firestore per-user like the rest of the app's state, so it
persists across devices. Built with the same `framer-motion` spring
entrances, swatch pickers and A-/A+ stepper already used by the existing
per-widget **Text Style** feature (below) — visually and technically
consistent, no new npm installs required.

*(Note: the pointer-heavy libraries listed in the initial ask —
`animated-component-libraries`, `animejs`, `aframe-webxr`, `barba-js` —
are meant for marketing-site scrollytelling / WebXR / page-routing
transitions and don't fit a small in-app settings panel; the existing
`framer-motion` (already a project dependency, already used everywhere in
this dashboard) covers every animation this feature needed. Nothing in
`ckmdesign-system` applied here either, since this project already has
its own token set (`C` / `FONT_OPTIONS` / `TEXT_COLOR_OPTIONS`) that this
update extends rather than replaces.)*

## Earn Money / Notes text style (earlier update)

The **Money Today** widget (Earn/Spend labels, notes box, "Today's
Mood" label) is now also selectable in the Text Style panel — tap its
name ("Earn Money / Notes") in the reorder list like any other widget,
and font size / bold / font / color apply to it independently, same
full logic as the other four text widgets. Amount inputs and the
Add/image-upload buttons are left untouched (they're controls, not
content), and the green "Earn"/red "Spend" label colors stay as the
default until you pick a custom color for that widget.

## Per-widget Text Style (earlier update)

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
