"use client";
import { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext, Component } from "react";
import {
  Settings, X, Plus, Smile, Meh, Frown, Image as ImageIcon,
  LogOut, Trash2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Flame, Target, BookOpen,
  Repeat, RotateCcw, BarChart3, TrendingUp, TrendingDown, Award, Tag, Pencil,
  GripVertical, Pin, PinOff, LayoutGrid, RefreshCw, Maximize2, Move,
  CheckCircle2, Wallet, StickyNote, Camera, Sparkles, Download, ZoomIn, CalendarDays,
  ArrowUpCircle, ArrowDownCircle, PiggyBank, Receipt, ArrowLeft,
  Lock, AlertCircle, Eye, EyeOff, ListChecks, ShieldCheck, Filter,
  Type, Palette, Bold, Italic, Underline, Baseline, User, LogIn
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar, Area, Legend, PieChart, Pie, Cell } from "recharts";
import { motion, AnimatePresence, Reorder, animate } from "framer-motion";
import { useAuth, signOutUser, signInWithGoogle } from "@/lib/AuthContext";
import { loadStateFromFirestore, saveStateToFirestore } from "@/lib/btlStorage";

/* ============================================================
   BEYOND THE LIFE (BTL)  —  personal life-goals dashboard
   Single-file React artifact. Sections below are separated
   like independent "files" with clear headers so it stays
   easy to split apart later if you move this into a real repo.
   ============================================================ */

/* ---------------- COLORS / TOKENS ---------------- */
const C = {
  bg: "#fffcf2",
  text: "#403d39",
  dark: "#252422",
  accent: "#fca311",
  blue: "#98c1d9",
};

const STORAGE_KEY = "btl_state_v1";
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------------- CUSTOMIZABLE WIDGET LAYOUT ----------------
   2026 trend: user-controlled, rearrangeable + FREE-FORM resizable
   dashboards — like a desktop app, drag a widget's bottom-right corner
   to resize it to any size you want (not locked to 3 fixed presets).
   Each widget's size lives in state.layout.sizes[id] as { w, h }:
     - w = column span out of a GRID_COLS-column grid (integer, snapped
       while dragging so widgets always stay aligned to the grid)
     - h = height in px (free-form, clamped between MIN_WIDGET_H and
       MAX_WIDGET_H)
   Order is just an array of ids; dragging in the Layout editor
   reorders this array, and the grid auto-flows widgets into rows
   based on their span, so reordering + resizing both "just work"
   without manual row math. */
const WIDGETS = [
  { id: "bigGoals", label: "Life Big Goals" },
  { id: "lifeRules", label: "Life Rules" },
  { id: "dailyGoals", label: "Daily Goals" },
  { id: "extryGoals", label: "Extry Goals" },
  { id: "earnMoney", label: "Earn Money / Notes" },
  { id: "analyticsSummary", label: "Analytics Summary" },
  { id: "calendar", label: "Calendar" },
];
const GRID_COLS = 6;          // grid columns widget widths snap to
const MIN_WIDGET_H = 120;     // px — minimum free-form height
const MAX_WIDGET_H = 1200;    // px — maximum free-form height (raised so widgets can be stretched much taller)
const GRID_GAP = 12;          // px — gap between widgets, both axes
/* Masonry row unit: instead of one shared CSS-grid row per "row" of
   widgets (which forces every widget in that row band — even ones in
   completely different columns — to grow together whenever ANE widget
   in that band gets taller), the grid uses a very fine auto-row track
   (ROW_UNIT px) and each widget reserves `gridRow: span N` tracks based
   on its own height. Combined with `gridAutoFlow: "row dense"`, this
   makes columns stack independently — resizing one widget only pushes
   the widget(s) actually stacked below it in the same column(s), and
   never affects widgets in other columns. */
const ROW_UNIT = 8;           // px — finer = more precise stacking, coarser = fewer DOM row tracks
function rowSpanForHeight(h) {
  return Math.max(1, Math.ceil((h + GRID_GAP) / (ROW_UNIT + GRID_GAP)));
}
/* Legacy "sm" | "md" | "lg" strings from before free-form resize —
   kept only so ensureLayoutDefaults can migrate old saved layouts. */
const LEGACY_SIZE_SPAN = { sm: 2, md: 3, lg: 6 };
const LEGACY_SIZE_HEIGHT = { sm: 150, md: 215, lg: 260 };

/* ---- Text style controls (Customize Layout → Text Style) ----
   Applied to the free-text widgets (Life Big Goals, Life Rules, Daily
   Goals, Entry Goals): font size scale, color, font family, bold.
   `scale` multiplies each widget's own base font sizes in JS (not via
   CSS em-chains) so nested elements never compound unexpectedly. */
const TEXT_SCALE_MIN = 0.85;
const TEXT_SCALE_MAX = 1.6;
const TEXT_SCALE_STEP = 0.05;
const FONT_OPTIONS = [
  { id: "", label: "Default", stack: "Inter, system-ui, sans-serif", preview: "Aa" },
  { id: "poppins", label: "Poppins", stack: "'Poppins', Inter, system-ui, sans-serif", preview: "Aa" },
  { id: "playfair", label: "Playfair", stack: "'Playfair Display', Georgia, serif", preview: "Aa" },
  { id: "mono", label: "Mono", stack: "'JetBrains Mono', 'Courier New', monospace", preview: "Aa" },
];
const fontStackFor = (id) => (FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0]).stack;
const TEXT_COLOR_OPTIONS = [
  { id: "", label: "Default", swatch: C.text },
  { id: "#252422", label: "Charcoal", swatch: "#252422" },
  { id: "#fca311", label: "Amber", swatch: "#fca311" },
  { id: "#4a7c59", label: "Green", swatch: "#4a7c59" },
  { id: "#3d5a80", label: "Blue", swatch: "#3d5a80" },
  { id: "#c0392b", label: "Red", swatch: "#c0392b" },
];
/* ---- Analytics tab — per-element custom colors (this update) ----
   Every distinctly-colored piece of text/UI inside the Analytics &
   Insights panel (header, Life Score badge, stat icons, Smart
   Insights, section headings, heatmap, mood line, Earn/Spend) can now
   get its own override from Setting → Theme → Analytics, on top of
   the existing single "Text color" for the scope. Empty string ("")
   means "use the built-in default" for that element. */
const ANALYTICS_ELEMENT_COLOR_FIELDS = [
  { key: "header", label: "Header title (\"Analytics & Insights\")", defaultHex: "#252422" },
  { key: "lifeScoreRing", label: "Life Score ring & score number", defaultHex: "#fca311" },
  { key: "lifeScoreDesc", label: "Life Score caption", defaultHex: "#a39c86" },
  { key: "statAvgIcon", label: "\"Average completion\" icon & value", defaultHex: "#fca311" },
  { key: "statBestIcon", label: "\"Best day\" icon & value", defaultHex: "#4a7c59" },
  { key: "statToughIcon", label: "\"Toughest day\" icon & value", defaultHex: "#e07a5f" },
  { key: "statLabel", label: "Stat captions (under the numbers)", defaultHex: "#b3ac99" },
  { key: "smartHeader", label: "\"🧠 Smart Insights\" heading", defaultHex: "#252422" },
  { key: "smartAccent", label: "Smart Insight card accents", defaultHex: "#fca311" },
  { key: "sectionHeader", label: "Section headings (Daily goal completion / Mood trend / Money)", defaultHex: "#252422" },
  { key: "heatmap", label: "Heatmap squares", defaultHex: "#fca311" },
  { key: "moodLine", label: "Mood trend line", defaultHex: "#3d5a80" },
  { key: "earn", label: "\"Earned\" label & amount", defaultHex: "#4a7c59" },
  { key: "spend", label: "\"Spent\" label & amount", defaultHex: "#c0392b" },
];
function normalizeAnalyticsColors(t) {
  const src = t && typeof t === "object" ? t : {};
  const out = {};
  ANALYTICS_ELEMENT_COLOR_FIELDS.forEach((f) => { out[f.key] = typeof src[f.key] === "string" ? src[f.key] : ""; });
  return out;
}
/* Blends a hex color toward white by `amount` (0 = original, 1 = white) —
   used to build the heatmap's light-to-full color scale from a single
   custom "Heatmap" color instead of a fixed amber gradient. */
function tintHex(hex, amount) {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : "fca311";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const toHex = (c) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/* ---- Money Management tab — per-element custom colors (this update) ----
   Same idea as the Analytics element colors above, applied to the
   Money Management screen: every distinctly-colored stat card, chart
   series and activity-row accent gets its own override. */
const MONEY_ELEMENT_COLOR_FIELDS = [
  { key: "header", label: "Header title (\"Money Management\")", defaultHex: "#252422" },
  { key: "sectionHeader", label: "Section headings (Spend by category / Earn vs spend / Recent activity)", defaultHex: "#252422" },
  { key: "totalEarned", label: "\"Total Earned\" card", defaultHex: "#4a7c59" },
  { key: "totalSpent", label: "\"Total Spent\" card", defaultHex: "#c0392b" },
  { key: "net", label: "\"Net (life)\" card (positive)", defaultHex: "#fca311" },
  { key: "entries", label: "\"Entries logged\" card", defaultHex: "#3d5a80" },
  { key: "earnChart", label: "Earn vs spend — Earned bars", defaultHex: "#4a7c59" },
  { key: "spendChart", label: "Earn vs spend — Spent bars", defaultHex: "#e07a5f" },
  { key: "netLine", label: "Earn vs spend — Net trend line", defaultHex: "#fca311" },
  { key: "activityEarn", label: "Recent activity — earn rows", defaultHex: "#4a7c59" },
  { key: "activitySpend", label: "Recent activity — spend amounts", defaultHex: "#c0392b" },
];
function normalizeMoneyColors(t) {
  const src = t && typeof t === "object" ? t : {};
  const out = {};
  MONEY_ELEMENT_COLOR_FIELDS.forEach((f) => { out[f.key] = typeof src[f.key] === "string" ? src[f.key] : ""; });
  return out;
}

const DEFAULT_TEXT_STYLE = { scale: 1, color: "", font: "", bold: false };
/* Widgets whose free-text content can be individually styled — pick one
   in the Text Style panel (click its name in the reorder list) and only
   that widget's text changes; the others are untouched until selected. */
const TEXT_STYLE_WIDGET_IDS = ["bigGoals", "lifeRules", "dailyGoals", "extryGoals", "earnMoney", "calendar"];
function normalizeTextStyle(ts) {
  const t = ts && typeof ts === "object" ? ts : {};
  const scale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Number(t.scale) || 1));
  return {
    scale: Math.round(scale * 100) / 100,
    color: typeof t.color === "string" ? t.color : "",
    font: typeof t.font === "string" ? t.font : "",
    bold: !!t.bold,
  };
}
function normalizeTextStyles(map) {
  const src = map && typeof map === "object" ? map : {};
  const out = {};
  TEXT_STYLE_WIDGET_IDS.forEach((id) => { out[id] = normalizeTextStyle(src[id]); });
  return out;
}

/* ---- Custom Theme (Settings → 🎨 Theme) ----
   Four independently-styleable scopes, on top of the existing
   per-widget Text Style feature above:
     - dashboard : overall dashboard background + text color
     - analytics : Analytics tab background, text color, text size, font, bold
     - widgets   : per-widget background color (id -> { bg }); size is the
                   existing layout.sizes (drag in Layout tab, or the Small/
                   Medium/Large presets in the Widgets theme panel)
     - focusMode : Focus Mode background, text color, text size, font, bold
   Stored in state.theme and saved to Firestore per-user like everything
   else. Reuses TEXT_COLOR_OPTIONS / FONT_OPTIONS / fontStackFor from the
   Text Style feature so both systems stay visually consistent. */
const THEME_SCALE_MIN = 0.85;
const THEME_SCALE_MAX = 1.4;
const THEME_SCALE_STEP = 0.05;
const BG_COLOR_OPTIONS = [
  { id: "", label: "Default", swatch: C.bg },
  { id: "#ffffff", label: "White", swatch: "#ffffff" },
  { id: "#f4f1e8", label: "Cream", swatch: "#f4f1e8" },
  { id: "#eef2f6", label: "Mist", swatch: "#eef2f6" },
  { id: "#252422", label: "Charcoal", swatch: "#252422" },
  { id: "#0f172a", label: "Navy", swatch: "#0f172a" },
];
const WIDGET_COLOR_OPTIONS = [
  { id: "", label: "Default", swatch: "#ffffff" },
  { id: "#fff7ec", label: "Amber", swatch: "#fff7ec" },
  { id: "#eef6f0", label: "Mint", swatch: "#eef6f0" },
  { id: "#eef2f9", label: "Sky", swatch: "#eef2f9" },
  { id: "#fdeef0", label: "Blush", swatch: "#fdeef0" },
  { id: "#252422", label: "Dark", swatch: "#252422" },
];
const WIDGET_SIZE_PRESETS = {
  sm: { w: 2, h: 150 },
  md: { w: 3, h: 215 },
  lg: { w: 6, h: 320 },
};
function normalizeScopeTheme(t) {
  const src = t && typeof t === "object" ? t : {};
  const scale = Math.min(THEME_SCALE_MAX, Math.max(THEME_SCALE_MIN, Number(src.scale) || 1));
  return {
    bg: typeof src.bg === "string" ? src.bg : "",
    text: typeof src.text === "string" ? src.text : "",
    font: typeof src.font === "string" ? src.font : "",
    bold: !!src.bold,
    scale: Math.round(scale * 100) / 100,
  };
}
function normalizeWidgetThemes(map) {
  const src = map && typeof map === "object" ? map : {};
  const out = {};
  WIDGETS.forEach((w) => { out[w.id] = { bg: typeof src[w.id]?.bg === "string" ? src[w.id].bg : "" }; });
  return out;
}

/* ---- Analytics Summary — customizable metric set (this update) ----
   The Analytics Summary widget (and its Settings → Theme panel) no
   longer shows a hardcoded Daily/Extry/Overall/Streak set — it's an
   ordered list of metric ids picked from this catalog, so the money
   totals can be added alongside the goal rings, any metric can be
   removed, and the order can be dragged. Stored as
   state.theme.analyticsSummary.metrics (array of ids). */
const ANALYTICS_SUMMARY_METRICS = [
  { id: "daily", label: "Daily", type: "ring", color: C.accent },
  { id: "extry", label: "Extry", type: "ring", color: C.blue },
  { id: "overall", label: "Overall", type: "ring", color: C.dark },
  { id: "streak", label: "Day Streak", type: "stat", icon: Flame },
  { id: "earned", label: "Total Earned", type: "money", color: "#2e7d32", icon: ArrowUpCircle },
  { id: "spent", label: "Total Spent", type: "money", color: "#c0392b", icon: ArrowDownCircle },
  { id: "net", label: "Net Money", type: "money", color: C.dark, icon: Wallet },
];
const ANALYTICS_SUMMARY_DEFAULT_METRICS = ["daily", "extry", "overall", "streak"];
function analyticsSummaryMetricMeta(id) {
  return ANALYTICS_SUMMARY_METRICS.find((m) => m.id === id) || null;
}
function normalizeAnalyticsSummaryTheme(t) {
  const src = t && typeof t === "object" ? t : {};
  const validIds = ANALYTICS_SUMMARY_METRICS.map((m) => m.id);
  const seen = new Set();
  const raw = Array.isArray(src.metrics) ? src.metrics : null;
  const cleaned = (raw || []).filter((id) => {
    if (!validIds.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { metrics: cleaned.length ? cleaned : ANALYTICS_SUMMARY_DEFAULT_METRICS.slice() };
}
/* Computes the live value for every metric from current app state —
   shared by the dashboard widget and the Theme panel's live preview
   so they can never disagree. */
function computeAnalyticsSummaryValues(state) {
  const dailyPct = state.dailyGoals.length ? (state.dailyGoals.filter((g) => g.done).length / state.dailyGoals.length) * 100 : 0;
  const extryPct = state.extryGoals.length ? (state.extryGoals.filter((g) => g.done).length / state.extryGoals.length) * 100 : 0;
  const overallPct = (dailyPct + extryPct) / 2;
  const earned = state.totalEarnLife || 0;
  const spent = state.totalSpendLife || 0;
  return {
    daily: dailyPct, extry: extryPct, overall: overallPct,
    streak: state.streak || 0,
    earned, spent, net: earned - spent,
  };
}

function normalizeTheme(t) {
  const src = t && typeof t === "object" ? t : {};
  return {
    dashboard: normalizeScopeTheme(src.dashboard),
    analytics: normalizeScopeTheme(src.analytics),
    money: normalizeScopeTheme(src.money),
    focusMode: normalizeScopeTheme(src.focusMode),
    widgets: normalizeWidgetThemes(src.widgets),
    analyticsSummary: normalizeAnalyticsSummaryTheme(src.analyticsSummary),
    analyticsColors: normalizeAnalyticsColors(src.analyticsColors),
    moneyColors: normalizeMoneyColors(src.moneyColors),
  };
}
function defaultTheme() { return normalizeTheme({}); }
/* React context so deeply-nested atoms (Oval pills, widget titles, etc.)
   pick up the current Dashboard theme's bg/text without every component
   needing the prop threaded through — explicit inline `style` overrides
   passed to those components still win, so nothing already styled
   on purpose changes. */
const DashboardThemeCtx = createContext({ bg: C.bg, text: C.text });

const DEFAULT_LAYOUT = {
  order: WIDGETS.map((w) => w.id),
  sizes: {
    bigGoals: { w: 3, h: 172 }, lifeRules: { w: 3, h: 172 }, dailyGoals: { w: 3, h: 215 }, extryGoals: { w: 3, h: 215 },
    earnMoney: { w: 3, h: 240 }, analyticsSummary: { w: 6, h: 260 }, calendar: { w: 3, h: 300 },
  },
  pinned: { analyticsSummary: false },
  hidden: {},
  textStyles: {},
};
function defaultLayout() {
  return {
    order: DEFAULT_LAYOUT.order.slice(),
    sizes: Object.fromEntries(Object.entries(DEFAULT_LAYOUT.sizes).map(([k, v]) => [k, { ...v }])),
    pinned: { ...DEFAULT_LAYOUT.pinned },
    hidden: {},
    textStyles: {},
  };
}
/* Normalizes any stored size value into a valid { w, h } object:
   - accepts old "sm"|"md"|"lg" strings (pre-free-form-resize saves)
     and maps them through the legacy tables above
   - accepts { w, h } objects and clamps/rounds them into range, so a
     corrupted or hand-edited value can never break the grid layout */
function normalizeSize(size) {
  if (typeof size === "string") {
    return { w: LEGACY_SIZE_SPAN[size] || 3, h: LEGACY_SIZE_HEIGHT[size] || 215 };
  }
  if (size && typeof size === "object") {
    const w = Math.min(GRID_COLS, Math.max(1, Math.round(Number(size.w) || 3)));
    const h = Math.min(MAX_WIDGET_H, Math.max(MIN_WIDGET_H, Math.round(Number(size.h) || 215)));
    return { w, h };
  }
  return { w: 3, h: 215 };
}
/* Backfills missing fields on load — handles old saved states that
   predate this feature (string sizes get migrated to { w, h } via
   normalizeSize), and any new widgets added later. */
function ensureLayoutDefaults(s) {
  const layout = s.layout || {};
  const validIds = WIDGETS.map((w) => w.id);
  let order = Array.isArray(layout.order) && layout.order.length ? layout.order.slice() : DEFAULT_LAYOUT.order.slice();
  order = order.filter((id) => validIds.includes(id)); // drop retired widgets (e.g. the old standalone "mood" date-list widget)
  WIDGETS.forEach((w) => { if (!order.includes(w.id)) order.push(w.id); });
  const rawSizes = { ...DEFAULT_LAYOUT.sizes, ...(layout.sizes || {}) };
  const sizes = {};
  WIDGETS.forEach((w) => { sizes[w.id] = normalizeSize(rawSizes[w.id]); });
  const pinned = { ...DEFAULT_LAYOUT.pinned, ...(layout.pinned || {}) };
  const hidden = { ...(layout.hidden || {}) };
  // Migrate a pre-existing single global `textStyle` (old format) by
  // seeding every text widget with it once; new per-widget `textStyles`
  // takes priority if already present.
  const legacyGlobal = layout.textStyle && typeof layout.textStyle === "object" ? layout.textStyle : null;
  const rawTextStyles = layout.textStyles || (legacyGlobal ? Object.fromEntries(TEXT_STYLE_WIDGET_IDS.map((id) => [id, legacyGlobal])) : {});
  const textStyles = normalizeTextStyles(rawTextStyles);
  return { ...s, layout: { order, sizes, pinned, hidden, textStyles } };
}

/* ---------------- GOAL MANAGEMENT: categories & priorities ---------------- */
const CATEGORIES = [
  { key: "health", label: "Health", color: "#4a7c59" },
  { key: "money", label: "Money", color: C.accent },
  { key: "career", label: "Career", color: C.blue },
  { key: "relationships", label: "Relations", color: "#e07a5f" },
  { key: "personal", label: "Personal", color: "#f4d35e" },
  { key: "other", label: "Other", color: "#b3ac99" },
];
const catInfo = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

/* ---------------- MONEY MANAGEMENT: spend categories ----------------
   Shown as an animated chip grid inside the "Spend Money" popup, and
   used to break down spending in the Money Management tab. */
const SPEND_CATEGORIES = [
  { key: "food", label: "Food", emoji: "🍔", color: "#e07a5f" },
  { key: "health", label: "Health", emoji: "💊", color: "#4a7c59" },
  { key: "cloth", label: "Cloth", emoji: "👕", color: "#98c1d9" },
  { key: "friends", label: "Friends", emoji: "🧑‍🤝‍🧑", color: "#f4d35e" },
  { key: "travel", label: "Traveling", emoji: "✈️", color: "#fca311" },
  { key: "shopping", label: "Shopping", emoji: "🛍️", color: "#b083f0" },
  { key: "bills", label: "Bills", emoji: "🧾", color: "#6b8f9c" },
  { key: "entertainment", label: "Entertainment", emoji: "🎬", color: "#e8998d" },
  { key: "other", label: "Other", emoji: "🔖", color: "#b3ac99" },
];
const spendCatInfo = (key) => SPEND_CATEGORIES.find((c) => c.key === key) || SPEND_CATEGORIES[SPEND_CATEGORIES.length - 1];

const PRIORITIES = [
  { key: "high", label: "High", color: "#e07a5f" },
  { key: "medium", label: "Medium", color: C.accent },
  { key: "low", label: "Low", color: C.blue },
];
const prioInfo = (key) => PRIORITIES.find((p) => p.key === key) || PRIORITIES[1];

/* ---------------- GOAL ICONS (emoji) ---------------- */
const GOAL_EMOJIS = ["🎯","💪","🏋️","🧘","📚","💧","🥗","😴","💰","💼","❤️","🧠","✍️","🎨","🏃","🚭","📵","🙏","🧹","📅","☎️","🌱","🎵","🛏️"];

function ensureGoalDefaults(g) {
  return {
    id: g.id, text: g.text, done: !!g.done,
    category: g.category || "other",
    priority: g.priority || "medium",
    recurring: g.recurring !== undefined ? g.recurring : true,
    subtasks: g.subtasks || [],
    icon: g.icon || "",
  };
}

function makeDefaultState() {
  const mk = (arr) => arr.map((t, i) => ensureGoalDefaults({ id: `${Date.now()}-${i}-${Math.random()}`, text: t, done: false }));
  return {
    user: null,
    bigGoals: ["Become financially free", "Build a strong, healthy body", "Travel to 20 countries"],
    lifeRules: ["Wake up at 5 AM", "No phone before 9 AM", "Read 20 pages every day"],
    dailyGoals: mk(["Workout", "Meditate 10 min", "Read", "Drink 3L water", "Plan tomorrow", "No junk food", "Sleep by 11 PM", "Gratitude note"]),
    extryGoals: mk(["Learn something new", "Message a friend", "Save ₹100", "Fix one small thing", "Say no to a distraction", "Tidy workspace", "Review budget", "Reply pending messages"]),
    notes: "",
    earnToday: "",
    spendToday: "",
    totalEarnLife: 0,
    totalSpendLife: 0,
    moneyHistory: {},   // { "2026-08-30": { earn: 100, spend: 40 } }
    moneyEntries: [],   // [{ id, date, type: "earn"|"spend", amount, category (spend only), image (earn only, dataUrl), note, ts }] -- newest first, powers Money Management
    memories: [],
    moodLog: {},        // { "2026-08-30": "happy" | "neutral" | "sad" }
    completionHistory: {}, // { "2026-08-30": 62.5 }  -- % of daily+extry goals done that day
    dailyLogs: {},      // { "2026-08-30": { images: [dataUrl,...], notes: "", completedGoals: { daily: [text,...], extry: [text,...] } } }
                         // -- powers the Memories modal: per-day photos, notes & the exact goals finished that day
    streak: 0,
    lastCompletedDate: null,
    layout: defaultLayout(),
    theme: defaultTheme(),
  };
}

/* ---------------- IMAGE COMPRESSION ----------------
   Downscales any picked photo to a small JPEG data-URL before it ever
   touches state/Firestore, so Memories can keep several photos per day
   without blowing past Firestore's 1MB-per-document limit. */
function resizeImageDataUrl(file, maxDim = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- STORAGE HELPERS ----------------
   Previously window.storage (artifact-sandbox-only, private per Claude
   account). Now backed by Firebase Firestore + security rules — see
   lib/btlStorage.js and firestore.rules. These are thin wrappers that
   take the signed-in Firebase user, so the rest of this file barely
   had to change. */
async function loadState(user) {
  const s = await loadStateFromFirestore(user, makeDefaultState, ensureGoalDefaults);
  const withLayout = ensureLayoutDefaults(s);
  return { ...withLayout, theme: normalizeTheme(withLayout.theme) };
}
async function saveState(user, state) {
  return saveStateToFirestore(user, state);
}

/* ---------------- SMALL UI ATOMS ---------------- */
/* Purposeful motion: ovals/pills soft-expand while pressed (not shrink),
   then release back with a spring, and glide upward slightly on hover —
   used throughout as the nav / pill language. */
function Oval({ children, style, onClick, ...rest }) {
  const interactive = typeof onClick === "function";
  const dt = useContext(DashboardThemeCtx);
  return (
    <motion.div
      {...rest}
      onClick={onClick}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 1.07 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${dt.text}`, borderRadius: 999, padding: "4px 14px",
        fontSize: 14, fontWeight: 800, background: dt.bg, color: dt.text,
        whiteSpace: "nowrap", ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

/* Status-aware save indicator: "Saving..." -> "Saved ✓" pulse, replacing
   a generic spinner so the user always knows their data's state. */
function SaveStatus({ status }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 16, minWidth: 58 }}>
      <AnimatePresence mode="wait">
        {status === "saving" && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: "#a39c86" }}
          >
            <motion.span
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, display: "inline-block" }}
            />
            Saving...
          </motion.div>
        )}
        {status === "saved" && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: [1, 1.15, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, color: "#4a7c59" }}
          >
            Saved ✓
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RingStat({ pct, size = 54, label, sub, color = C.accent }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e9e4d3" strokeWidth={5} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 420ms cubic-bezier(.4,1.6,.4,1)" }}
        />
        <text x={size / 2} y={size / 2} transform={`rotate(90 ${size / 2} ${size / 2})`}
          textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill={C.dark}>
          {Math.round(pct)}%
        </text>
      </svg>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.dark, textAlign: "center", lineHeight: 1.1 }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color: "#8a8579" }}>{sub}</div>}
    </div>
  );
}

/* ---------------- SHINE / COMPLETE ANIMATION ---------------- */
function ShineOverlay({ active }) {
  if (!active) return null;
  return (
    <>
      <div className="btl-shine btl-shine-left" />
      <div className="btl-shine btl-shine-right" />
    </>
  );
}

/* ---------------- CONFETTI / MILESTONE CELEBRATION ---------------- */
const CONFETTI_COLORS = [C.accent, C.blue, C.dark, "#f4d35e", "#e07a5f"];
function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 48 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const duration = 1.6 + Math.random() * 1.2;
    const size = 6 + Math.random() * 6;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const rotate = Math.random() * 360;
    const round = Math.random() > 0.5;
    return { left, delay, duration, size, color, rotate, round, id: i };
  });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 70 }}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="btl-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function MilestoneBanner({ streak, visible }) {
  if (!visible) return null;
  return (
    <div className="btl-milestone-banner" style={{
      position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
      background: C.dark, color: "#fff", padding: "10px 20px", borderRadius: 999,
      fontSize: 14, fontWeight: 900, zIndex: 71, boxShadow: "0 8px 20px rgba(37,36,34,0.3)",
      display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
    }}>
      <Flame size={16} color={C.accent} /> {String(streak).padStart(3, "0")} Day Streak! Keep going 🎉
    </div>
  );
}

/* ---------------- PROFILE — avatar button + glass account popup (this update) ----------------
   A round profile avatar now sits in the header's top-right cluster, right where the plain
   sign-out icon used to be on its own. Tapping it fans open a Glassmorphism 2.0 popup —
   spring entrance, same blur/border/shadow recipe as the Memories/Money glass modals — anchored
   to that same top-right corner (dropping down over the Earn/Spend Money + Analytics Summary
   widgets underneath it), showing the signed-in Google account: photo, name, email, and Sign
   Out. If for any reason nobody's signed in yet (AuthGuard normally prevents this on
   /dashboard, but the popup handles it gracefully anyway), it shows a single "Continue with
   Google" button instead — Firebase's Google OAuth creates the account on first use, so one
   button covers both login and signup, no separate signup form needed. Built entirely with
   framer-motion (already a project dependency) — no new npm installs required. */
function ProfileAvatar({ user, size = 32 }) {
  const initial = (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase();
  return user?.photoURL ? (
    <img
      src={user.photoURL} alt={user.displayName || "Profile"} referrerPolicy="no-referrer"
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: C.accent, color: "#fff", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 800,
    }}>
      {initial}
    </div>
  );
}

function ProfileButton({ user, open, onToggle }) {
  return (
    <motion.button
      onClick={onToggle} title={user ? (user.displayName || "Profile") : "Sign in"}
      whileHover={{ y: -2 }} whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      style={{
        border: `2px solid ${open ? C.accent : "transparent"}`, borderRadius: "50%", padding: 0,
        background: "transparent", cursor: "pointer", lineHeight: 0, display: "flex",
      }}
    >
      {user ? <ProfileAvatar user={user} size={30} /> : (
        <div style={{
          width: 30, height: 30, borderRadius: "50%", background: "#e9e4d3", color: C.dark,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><User size={15} /></div>
      )}
    </motion.button>
  );
}

function ProfilePopup({ user, open, onClose, onSignOut, onSignIn }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* invisible click-outside catcher, closes the popup without touching anything under it */}
          <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0, width: 280, zIndex: 91,
              background: "rgba(255,252,242,0.8)",
              backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.65)", borderRadius: 16,
              boxShadow: "0 24px 60px rgba(37,36,34,0.28), inset 0 1px 0 rgba(255,255,255,0.6)",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)" }} />
            {user ? (
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <ProfileAvatar user={user} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 900, color: C.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.displayName || "Signed in"}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#8a8579", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.email}
                    </div>
                  </div>
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 700, color: "#4a7c59",
                  background: "rgba(74,124,89,0.12)", borderRadius: 999, padding: "4px 10px", width: "fit-content", marginBottom: 14,
                }}>
                  <ShieldCheck size={11} /> Signed in with Google
                </div>
                <motion.button
                  onClick={onSignOut} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    border: "1px solid rgba(192,57,43,0.35)", background: "rgba(255,255,255,0.55)", color: "#c0392b",
                    borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  <LogOut size={14} /> Sign out
                </motion.button>
              </div>
            ) : (
              <div style={{ padding: 18, textAlign: "center" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: C.dark, marginBottom: 4 }}>Not signed in</div>
                <div style={{ fontSize: 10.5, color: "#8a8579", marginBottom: 14, lineHeight: 1.4 }}>
                  Sign in with Google — new here? The same button creates your account too.
                </div>
                <motion.button
                  onClick={onSignIn} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    border: `1px solid ${C.dark}`, background: "#fff", color: C.dark,
                    borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  <LogIn size={14} /> Continue with Google
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- QUICK-NAV FAB (this update) ----------------
   Floating round arrow button, bottom-right corner of the dashboard
   card. Tap it and it fans out — left, one at a time with a staggered
   spring — into a row of round avatar/logo buttons for every top-nav
   shortcut (memor, Focus Mode, Layout, Analytics, Money Management,
   Setting), so they're reachable from one thumb-friendly spot instead of the full header
   row. Tap any avatar to jump straight there (closes itself after);
   tap the arrow again (it flips 180°) to fold them back away. Persists
   across every tab, not just the main dashboard. */
function QuickNavFab({ tab, setTab, focusMode, setFocusMode, setMemOpen, setSettingsOpen }) {
  const [open, setOpen] = useState(false);

  const items = [
    { key: "memor", label: "memor", icon: BookOpen, bg: C.blue, fg: C.dark, onClick: () => { setMemOpen(true); setOpen(false); } },
    { key: "lifeStory", label: "Life Story", icon: Pencil, bg: "#b083f0", fg: "#fff", onClick: () => { setTab("lifeStory"); setOpen(false); } },
    { key: "focus", label: "Focus Mode", icon: Target, bg: focusMode ? C.accent : "#fff", fg: focusMode ? "#fff" : C.dark, ring: !focusMode, onClick: () => { setFocusMode((v) => !v); setOpen(false); } },
    { key: "layout", label: "Layout", icon: LayoutGrid, bg: C.dark, fg: "#fff", onClick: () => { setTab("layout"); setOpen(false); } },
    { key: "analytics", label: "Analytics", icon: BarChart3, bg: C.dark, fg: "#fff", onClick: () => { setTab("analytics"); setOpen(false); } },
    { key: "money", label: "Money Management", icon: Wallet, bg: C.accent, fg: "#fff", onClick: () => { setTab("money"); setOpen(false); } },
    { key: "setting", label: "Setting", icon: Settings, bg: C.dark, fg: "#fff", onClick: () => { setSettingsOpen(true); setOpen(false); } },
  ];

  return (
    <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 72, display: "flex", alignItems: "center", gap: 8 }}>
      <AnimatePresence>
        {open && items.map((it, i) => (
          <motion.button
            key={it.key}
            title={it.label}
            onClick={it.onClick}
            initial={{ opacity: 0, scale: 0.3, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.3, x: 24, transition: { delay: 0 } }}
            transition={{ type: "spring", stiffness: 440, damping: 24, delay: i * 0.045 }}
            whileHover={{ y: -3, scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            style={{
              width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
              border: it.ring ? `1.5px solid ${C.text}` : "none",
              background: it.bg, color: it.fg,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: "0 3px 10px rgba(37,36,34,0.22)",
            }}
          >
            <it.icon size={15} />
          </motion.button>
        ))}
      </AnimatePresence>
      <motion.button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close quick nav" : "Quick nav"}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.88 }}
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        style={{
          width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
          background: C.dark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(37,36,34,0.32)",
        }}
      >
        <ChevronLeft size={18} />
      </motion.button>
    </div>
  );
}

/* ---------------- GOOGLE SIGN-IN (LOCAL MOCK) ---------------- */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.3 5.3C40.9 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  return (
    <div style={{
      height: "100%", minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{
        width: 300, background: "#fff", border: `1px solid #ece7d8`, borderRadius: 14,
        padding: "28px 24px", boxShadow: "0 8px 24px rgba(37,36,34,0.08)", textAlign: "center",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: C.accent }}>BTL</div>
        <h1 style={{ fontSize: 18, margin: "4px 0 2px", color: C.dark }}>Byound The Life</h1>
        <p style={{ fontSize: 11, color: "#8a8579", margin: "0 0 18px" }}>Sign in to load your goals & progress</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={{
            width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 12,
            border: `1px solid #ddd6c4`, borderRadius: 8, marginBottom: 10, outline: "none",
          }}
        />
        <button
          onClick={() => name.trim() && onLogin(name.trim())}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "9px 10px", fontSize: 12, fontWeight: 700, borderRadius: 8,
            border: `1px solid #ddd6c4`, background: "#fff", color: C.dark, cursor: "pointer",
          }}
        >
          <GoogleMark /> Continue with Google
        </button>
        <div style={{ fontSize: 9, color: "#b3ac99", marginTop: 10, lineHeight: 1.4 }}>
          Demo sign-in only — no real Google account data is read.
        </div>
      </div>
    </div>
  );
}

/* ---------------- READ-ONLY LIST (Life Big Goals / Life Rules) ----------------
   Adding/removing items now happens only from Settings, so this widget is a
   clean, fixed display card — no inline input row eating into the layout. */
function TextList({ title, items, textStyle, cardBg }) {
  const ts = normalizeTextStyle(textStyle);
  const itemFontSize = Math.round(13 * ts.scale);
  const titleFontSize = Math.round(15 * (1 + (ts.scale - 1) * 0.5)); // scale the pill title more gently so it never overflows
  const itemFontFamily = ts.font ? fontStackFor(ts.font) : undefined;
  const itemColor = ts.color || undefined;
  const itemWeight = ts.bold ? 800 : 700;
  return (
    <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      <Oval style={{
        display: "block", margin: "0 auto 8px", background: C.dark, color: C.bg, borderColor: C.dark,
        fontSize: titleFontSize, fontWeight: 900, fontFamily: itemFontFamily,
      }}>{title}</Oval>
      <div style={{
        border: `1px solid ${C.text}`, borderRadius: 8, flex: 1, overflowY: "auto", background: cardBg || "#fff",
      }} className="btl-scroll">
        {items.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, color: "#b3ac99", textAlign: "center" }}>
            Nothing yet — add one from Setting.
          </div>
        )}
        {items.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center",
            padding: "8px 10px", borderBottom: i < items.length - 1 ? "1px solid #f0ece0" : "none",
            fontSize: itemFontSize, fontWeight: itemWeight, color: itemColor, fontFamily: itemFontFamily,
          }}>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- DAILY / EXTRY GOAL CHECKLIST (pro: categories, priority, recurring, subtasks) ---------------- */
function GoalChecklist({ title, items, onToggle, onAdd, onRemove, onToggleSubtask, onAddSubtask, onSetIcon, accent, textStyle, cardBg }) {
  const ts = normalizeTextStyle(textStyle);
  const itemFontSize = Math.round(11 * ts.scale);
  const subFontSize = Math.round(10 * ts.scale);
  const itemFontFamily = ts.font ? fontStackFor(ts.font) : undefined;
  const itemColorOverride = ts.color || undefined;
  const itemWeight = ts.bold ? 700 : undefined;
  const [val, setVal] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [recurring, setRecurring] = useState(true);
  const [icon, setIcon] = useState("");
  const [openId, setOpenId] = useState(null);
  const [subVal, setSubVal] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [pickerFor, setPickerFor] = useState(null); // "new" | goal id | null

  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim(), { category, priority, recurring, icon });
    setVal(""); setIcon("");
  };

  const EmojiPicker = ({ onPick, onClose }) => (
    <div style={{
      position: "absolute", zIndex: 40, background: "#fff", border: "1px solid #ddd6c4", borderRadius: 8,
      padding: 6, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
      width: 150,
    }}>
      {GOAL_EMOJIS.map((e) => (
        <button key={e} onClick={() => { onPick(e); onClose(); }}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, padding: 2, borderRadius: 4 }}
          onMouseEnter={(ev) => ev.currentTarget.style.background = "#f0ece0"}
          onMouseLeave={(ev) => ev.currentTarget.style.background = "none"}
        >{e}</button>
      ))}
      <button onClick={() => { onPick(""); onClose(); }}
        style={{ gridColumn: "span 6", border: "none", background: "none", cursor: "pointer", fontSize: 9, color: "#a39c86", padding: "3px 0" }}>
        Clear icon
      </button>
    </div>
  );

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <Oval style={{ display: "block", margin: "0 auto 6px", background: C.dark, color: C.bg, borderColor: C.dark, flexShrink: 0 }}>{title}</Oval>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.text}`, borderRadius: 8, background: cardBg || "#fff" }} className="btl-scroll">
        {items.map((g) => {
          const cat = catInfo(g.category);
          const prio = prioInfo(g.priority);
          const isOpen = openId === g.id;
          const subDone = (g.subtasks || []).filter((s) => s.done).length;
          return (
            <div key={g.id} style={{ borderBottom: "1px solid #f0ece0", borderLeft: `3px solid ${cat.color}` }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 4px 6px 6px",
                textDecoration: g.done ? "line-through" : "none", color: g.done ? "#a39c86" : C.text,
              }}>
                <input
                  type="checkbox" checked={g.done} onChange={() => onToggle(g.id)}
                  className="btl-check" style={{ accentColor: accent, width: 14, height: 14, flexShrink: 0, cursor: "pointer" }}
                />
                <span style={{ position: "relative", flexShrink: 0 }}>
                  <span
                    onClick={() => setPickerFor(pickerFor === g.id ? null : g.id)}
                    title="Set icon" style={{ cursor: "pointer", fontSize: 12, width: 16, display: "inline-flex", justifyContent: "center" }}
                  >{g.icon || "＋"}</span>
                  {pickerFor === g.id && <EmojiPicker onPick={(e) => onSetIcon(g.id, e)} onClose={() => setPickerFor(null)} />}
                </span>
                <span
                  style={{
                    flex: 1, fontSize: itemFontSize, cursor: "pointer", fontFamily: itemFontFamily,
                    fontWeight: itemWeight, color: !g.done && itemColorOverride ? itemColorOverride : undefined,
                  }}
                  onClick={() => onToggle(g.id)}
                >{g.text}</span>
                <span title={`Priority: ${prio.label}`} style={{
                  fontSize: 8, fontWeight: 900, color: "#fff", background: prio.color,
                  borderRadius: 4, padding: "1px 4px", flexShrink: 0,
                }}>{prio.label[0]}</span>
                {g.recurring
                  ? <Repeat size={11} title="Recurring" style={{ color: "#a39c86", flexShrink: 0 }} />
                  : <RotateCcw size={11} title="One-time" style={{ color: "#d8d2bf", flexShrink: 0, opacity: 0.5 }} />}
                {(g.subtasks || []).length > 0 && (
                  <span style={{ fontSize: 8, color: "#a39c86", flexShrink: 0 }}>{subDone}/{g.subtasks.length}</span>
                )}
                <button onClick={() => setOpenId(isOpen ? null : g.id)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, flexShrink: 0, color: "#c9c2ac" }}>
                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <Trash2 size={11} style={{ color: "#d8d2bf", cursor: "pointer", flexShrink: 0 }} onClick={() => onRemove(g.id)} />
              </div>
              {isOpen && (
                <div style={{ padding: "2px 8px 8px 22px", background: "#fbf9f2" }}>
                  <div style={{ fontSize: 8, color: "#a39c86", marginBottom: 3 }}>
                    <Tag size={9} style={{ verticalAlign: -1, marginRight: 3 }} />{cat.label}
                  </div>
                  {(g.subtasks || []).map((s) => (
                    <label key={s.id} style={{
                      display: "flex", alignItems: "center", gap: 5, fontSize: subFontSize, padding: "2px 0", cursor: "pointer",
                      textDecoration: s.done ? "line-through" : "none", fontFamily: itemFontFamily, fontWeight: itemWeight,
                      color: s.done ? "#b3ac99" : (itemColorOverride || C.text),
                    }}>
                      <input type="checkbox" checked={s.done} onChange={() => onToggleSubtask(g.id, s.id)} style={{ width: 11, height: 11, accentColor: accent }} />
                      {s.text}
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <input
                      value={openId === g.id ? subVal : ""} onChange={(e) => setSubVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && subVal.trim()) { onAddSubtask(g.id, subVal.trim()); setSubVal(""); } }}
                      placeholder="Add sub-task..."
                      style={{ flex: 1, fontSize: 9, padding: "3px 6px", borderRadius: 5, border: "1px solid #ece7d8", outline: "none" }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 6, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setPickerFor(pickerFor === "new" ? null : "new")} title="Pick an icon"
              style={{ border: "1px solid #ddd6c4", background: "#fff", borderRadius: 6, width: 26, height: "100%", cursor: "pointer", fontSize: 12 }}>
              {icon || "🙂"}
            </button>
            {pickerFor === "new" && <EmojiPicker onPick={(e) => setIcon(e)} onClose={() => setPickerFor(null)} />}
          </span>
          <input
            value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Add item..."
            style={{ flex: 1, fontSize: 10, padding: "5px 7px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
          />
          <button onClick={() => setShowOptions((v) => !v)} title="Category / priority / recurring"
            style={{ border: "1px solid #ddd6c4", background: showOptions ? "#f0ece0" : "#fff", borderRadius: 6, padding: "0 7px", cursor: "pointer", fontSize: 10 }}>
            <Tag size={12} />
          </button>
          <button onClick={submit} style={{ border: "none", background: accent, color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer" }}>
            <Plus size={13} />
          </button>
        </div>
        {showOptions && (
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: 9, padding: "3px 4px", borderRadius: 5, border: "1px solid #ddd6c4" }}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ fontSize: 9, padding: "3px 4px", borderRadius: 5, border: "1px solid #ddd6c4" }}>
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label} priority</option>)}
            </select>
            <label style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} style={{ width: 11, height: 11 }} />
              Recurring
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- TODAY'S MOOD (compact — lives inside the Earn Money / Notes card) ---------------- */
function MoodBtn({ active, onClick, children, title }) {
  return (
    <button title={title} onClick={onClick} className="btl-mood-btn" style={{
      border: "none", background: active ? C.accent : "transparent", color: active ? "#fff" : "#b3ac99",
      borderRadius: 6, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", padding: 0,
    }}>
      {children}
    </button>
  );
}

/* ---------------- SETTINGS PANEL CONTENT (rendered inside the glass modal) ---------------- */
function SettingsTab({ state, addItem, removeItem, editItem, onClose, onThemeScopeChange, onThemeScopeReset, onWidgetThemeChange, onWidgetThemeReset, onWidgetSizePreset, onAnalyticsSummaryChange, onAnalyticsSummaryReset, onAnalyticsColorChange, onAnalyticsColorReset, onMoneyColorChange, onMoneyColorReset }) {
  const [mode, setMode] = useState(null); // "goal" | "extry" | "bigGoals" | "lifeRules" | "theme" | null
  const [val, setVal] = useState("");
  const [editing, setEditing] = useState(null); // { colKey, id } | null
  const [editVal, setEditVal] = useState("");

  const MODE_KEY = { goal: "dailyGoals", extry: "extryGoals", bigGoals: "bigGoals", lifeRules: "lifeRules" };
  const MODE_PLACEHOLDER = {
    goal: "New daily goal...", extry: "New entry goal...",
    bigGoals: "New life big goal...", lifeRules: "New life rule...",
  };

  const submit = () => {
    if (!val.trim() || !mode) return;
    addItem(MODE_KEY[mode], val.trim());
    setVal(""); setMode(null);
  };

  const startEdit = (colKey, id, text) => { setEditing({ colKey, id }); setEditVal(text); };
  const saveEdit = () => {
    if (!editing) return;
    if (editVal.trim()) editItem(editing.colKey, editing.id, editVal.trim());
    setEditing(null); setEditVal("");
  };

  return (
    <motion.div
      onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 10 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      style={{
        width: "min(92%, 900px)", maxHeight: "88%", background: "rgba(255,255,255,0.68)",
        backdropFilter: "blur(16px) saturate(160%)", WebkitBackdropFilter: "blur(16px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.6)", borderRadius: 14,
        boxShadow: "0 12px 36px rgba(37,36,34,0.18)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", flexWrap: "wrap",
        borderBottom: "1px solid rgba(64,61,57,0.15)", background: "rgba(255,252,242,0.5)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.dark }}>Setting</span>
        <Oval onClick={() => setMode("goal")} style={{ cursor: "pointer", background: mode === "goal" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "goal" ? "#fff" : C.text }}>Add Goles</Oval>
        <Oval onClick={() => setMode("extry")} style={{ cursor: "pointer", background: mode === "extry" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "extry" ? "#fff" : C.text }}>Add extry</Oval>
        <Oval onClick={() => setMode("bigGoals")} style={{ cursor: "pointer", background: mode === "bigGoals" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "bigGoals" ? "#fff" : C.text }}>Add Big Goal</Oval>
        <Oval onClick={() => setMode("lifeRules")} style={{ cursor: "pointer", background: mode === "lifeRules" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "lifeRules" ? "#fff" : C.text }}>Add Rule</Oval>
        <Oval onClick={() => setMode(mode === "theme" ? null : "theme")} style={{ cursor: "pointer", background: mode === "theme" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "theme" ? "#fff" : C.text }}><Palette size={11} style={{ marginRight: 4 }} />Theme</Oval>
        <div style={{ flex: 1 }} />
        <motion.span whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onClose} title="Close" style={{
          borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
        }}><X size={13} color={C.dark} /></motion.span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }} className="btl-scroll">
        {mode === "theme" ? (
          <ThemePanel
            state={state}
            theme={state.theme}
            layoutSizes={state.layout?.sizes}
            onScopeChange={onThemeScopeChange}
            onScopeReset={onThemeScopeReset}
            onWidgetChange={onWidgetThemeChange}
            onWidgetReset={onWidgetThemeReset}
            onWidgetSize={onWidgetSizePreset}
            onAnalyticsSummaryChange={onAnalyticsSummaryChange}
            onAnalyticsSummaryReset={onAnalyticsSummaryReset}
            onAnalyticsColorChange={onAnalyticsColorChange}
            onAnalyticsColorReset={onAnalyticsColorReset}
            onMoneyColorChange={onMoneyColorChange}
            onMoneyColorReset={onMoneyColorReset}
          />
        ) : (
          <>
            {mode && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <input
                  autoFocus value={val} onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={MODE_PLACEHOLDER[mode]}
                  style={{ flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none", background: "rgba(255,255,255,0.75)" }}
                />
                <button onClick={submit} style={{ border: "none", background: C.accent, color: "#fff", borderRadius: 6, padding: "0 10px", cursor: "pointer", fontSize: 11 }}>Add</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { key: "dailyGoals", label: "Daily Goals" },
                { key: "extryGoals", label: "Extry Goals" },
                { key: "bigGoals", label: "Life Big Goals", plain: true },
                { key: "lifeRules", label: "Life Rules", plain: true },
              ].map((col) => (
                <div key={col.key}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.dark, marginBottom: 4 }}>{col.label}</div>
                  <div style={{ border: "1px solid rgba(64,61,57,0.15)", borderRadius: 8, maxHeight: 150, overflowY: "auto", background: "rgba(255,255,255,0.5)" }} className="btl-scroll">
                    {(state[col.key] || []).map((item, i) => {
                      const id = col.plain ? i : item.id;
                      const text = col.plain ? item : item.text;
                      const isEditing = editing && editing.colKey === col.key && editing.id === id;
                      return (
                        <div key={id} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
                          padding: "4px 7px", fontSize: 10, borderBottom: "1px solid rgba(240,236,224,0.8)",
                        }}>
                          {isEditing ? (
                            <input
                              autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                              onBlur={saveEdit}
                              style={{ flex: 1, fontSize: 10, padding: "2px 5px", borderRadius: 4, border: "1px solid #ddd6c4", outline: "none" }}
                            />
                          ) : (
                            <span style={{ flex: 1 }}>{text}</span>
                          )}
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {!isEditing && <Pencil size={11} style={{ cursor: "pointer", color: "#a39c86" }} onClick={() => startEdit(col.key, id, text)} />}
                            <Trash2 size={11} style={{ cursor: "pointer", color: "#d8a29a" }} onClick={() => removeItem(col.key, id)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#b3ac99", padding: "6px 0", borderTop: "1px solid rgba(240,236,224,0.8)" }}>
        Setting Teb
      </div>
    </motion.div>
  );
}

/* ---------------- ANALYTICS: heatmap ---------------- */
/* ---------------- SHARE YOUR JOURNEY (downloadable card) ---------------- */
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function computeBestCategory(state) {
  const tally = {};
  [...(state.dailyGoals || []), ...(state.extryGoals || [])].forEach((g) => {
    const key = g.category || "other";
    tally[key] = tally[key] || { done: 0, total: 0 };
    tally[key].total++;
    if (g.done) tally[key].done++;
  });
  let best = null, bestRate = -1;
  Object.entries(tally).forEach(([key, v]) => {
    const rate = v.total ? v.done / v.total : 0;
    if (rate > bestRate) { bestRate = rate; best = key; }
  });
  return best ? catInfo(best) : null;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "", lines = [];
  words.forEach((w) => {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w + " "; }
    else line = test;
  });
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
}

function generateShareCard(state, lifeScore) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.bg);
  grad.addColorStop(1, "#fdf3e0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // decorative circle accents
  ctx.fillStyle = lifeScore.color + "22";
  ctx.beginPath(); ctx.arc(W - 60, 60, 220, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(40, H - 80, 180, 0, Math.PI * 2); ctx.fill();

  // header
  ctx.fillStyle = C.dark;
  ctx.font = "900 40px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Byound The Life", W / 2, 110);
  ctx.font = "600 20px Inter, sans-serif";
  ctx.fillStyle = "#a39c86";
  ctx.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), W / 2, 145);

  // Life score ring
  const cx = W / 2, cy = 400, R = 150;
  ctx.lineWidth = 22;
  ctx.strokeStyle = "#ece7d8";
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = lifeScore.color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * lifeScore.score) / 100);
  ctx.stroke();
  ctx.fillStyle = C.dark;
  ctx.font = "900 72px Inter, sans-serif";
  ctx.fillText(String(lifeScore.score), cx, cy + 22);
  ctx.font = "700 22px Inter, sans-serif";
  ctx.fillStyle = "#a39c86";
  ctx.fillText("LIFE SCORE", cx, cy + 58);
  ctx.font = "700 30px Inter, sans-serif";
  ctx.fillStyle = lifeScore.color;
  ctx.fillText(`${lifeScore.emoji} ${lifeScore.label}`, cx, cy + 210);

  // stat row
  const statY = 800;
  const stats = [
    { label: "Day Streak", value: String(state.streak || 0), emoji: "🔥" },
    { label: "Total Earned", value: `₹${state.totalEarnLife || 0}`, emoji: "💰" },
  ];
  const bestCat = computeBestCategory(state);
  if (bestCat) stats.push({ label: "Top Category", value: bestCat.label, emoji: "🏆" });

  const colW = W / stats.length;
  stats.forEach((s, i) => {
    const x = colW * i + colW / 2;
    ctx.font = "56px Inter, sans-serif";
    ctx.fillText(s.emoji, x, statY);
    ctx.font = "900 34px Inter, sans-serif";
    ctx.fillStyle = C.dark;
    ctx.fillText(s.value, x, statY + 55);
    ctx.font = "600 18px Inter, sans-serif";
    ctx.fillStyle = "#a39c86";
    ctx.fillText(s.label, x, statY + 84);
  });

  // divider + footer quote
  drawRoundedRect(ctx, 90, 980, W - 180, 200, 24);
  ctx.fillStyle = "#ffffffaa";
  ctx.fill();
  ctx.font = "italic 600 26px Inter, sans-serif";
  ctx.fillStyle = C.text;
  const quote = (state.lifeRules && state.lifeRules[0]) ? `"${state.lifeRules[0]}"` : "Small steps, every single day.";
  wrapText(ctx, quote, W / 2, 1070, W - 260, 34);

  ctx.font = "700 20px Inter, sans-serif";
  ctx.fillStyle = "#a39c86";
  ctx.fillText("Made with Byound The Life", W / 2, H - 50);

  return canvas.toDataURL("image/png");
}

function ShareJourneyModal({ state, lifeScore, onClose }) {
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    const url = generateShareCard(state, lifeScore);
    setImgUrl(url);
  }, [state, lifeScore]);

  const download = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `byound-the-life-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const share = async () => {
    if (!imgUrl || !navigator.share) return download();
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const file = new File([blob], "btl-journey.png", { type: "image/png" });
      await navigator.share({ files: [file], title: "My Byound The Life journey" });
    } catch (e) { /* user cancelled or unsupported; ignore */ }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(37,36,34,0.7)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 16, maxWidth: 360, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>Share Your Journey</span>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={16} color={C.dark} /></button>
        </div>
        {imgUrl
          ? <img src={imgUrl} alt="Your journey" style={{ width: "100%", borderRadius: 10, border: "1px solid #ece7d8" }} />
          : <div style={{ padding: 60, textAlign: "center", fontSize: 11, color: "#a39c86" }}>Generating…</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={download} style={{ flex: 1, border: `1px solid ${C.dark}`, background: "#fff", color: C.dark, borderRadius: 8, padding: "8px 0", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>Download</button>
          <button onClick={share} style={{ flex: 1, border: "none", background: C.accent, color: "#fff", borderRadius: 8, padding: "8px 0", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>Share</button>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ completionHistory, accentColor }) {
  const accent = accentColor || C.accent;
  const WEEKS = 12;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));
  // align to Sunday
  start.setDate(start.getDate() - start.getDay());

  const cols = [];
  let cursor = new Date(start);
  for (let w = 0; w < WEEKS + 1; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      col.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    cols.push(col);
  }

  const colorFor = (pct) => {
    if (pct === undefined) return tintHex(accent, 0.88);
    if (pct === 0) return tintHex(accent, 0.88);
    if (pct < 40) return tintHex(accent, 0.62);
    if (pct < 75) return tintHex(accent, 0.32);
    return accent;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 4 }} className="btl-scroll">
        {cols.map((col, ci) => (
          <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {col.map((d, di) => {
              const iso = d.toISOString().slice(0, 10);
              const isFuture = d > today;
              const pct = completionHistory[iso];
              return (
                <div key={di} title={`${iso}${pct !== undefined ? `: ${Math.round(pct)}%` : ""}`} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: isFuture ? "transparent" : colorFor(pct),
                  border: isFuture ? "1px dashed #ece7d8" : "none",
                }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#b3ac99", marginTop: 4 }}>
        Less
        {[tintHex(accent, 0.88), tintHex(accent, 0.62), tintHex(accent, 0.32), accent].map((c) => (
          <div key={c} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
        ))}
        More
      </div>
    </div>
  );
}

function moodToNum(m) { return m === "happy" ? 1 : m === "neutral" ? 0.5 : m === "sad" ? 0 : null; }

/* ---------------- ANALYTICS TAB — "Deep Analytics" pro widgets (this update) ----------------
   8 extra data-driven trackers rendered below the existing Money nav
   card: category & priority completion, best/toughest weekday, streak
   record, mood distribution, 14-day money velocity, subtask completion,
   and week-over-week momentum. Every number here comes from `state`
   that already exists (completionHistory, moodLog, dailyGoals/extryGoals,
   moneyHistory, streak) — nothing is fabricated. Card shell + entrance/
   hover motion via framer-motion (already used everywhere else in this
   file); charts via the recharts primitives already imported up top.
   Colors are pulled from the app's own palette (CATEGORIES / PRIORITIES
   / C), so nothing clashes with the rest of the theme. */
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ProCard({ title, icon: Icon, color, index, wide, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: index * 0.06 }}
      whileHover={{ y: -3, boxShadow: "0 14px 26px rgba(37,36,34,0.12)" }}
      style={{
        flex: wide ? "1 1 100%" : "1 1 260px", minWidth: wide ? undefined : 240,
        border: "1px solid #ece7d8", borderRadius: 10, padding: 12, boxSizing: "border-box",
        background: `linear-gradient(160deg, ${color}0d, transparent)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

function EmptyNote({ text }) {
  return <div style={{ fontSize: 9.5, color: "#b3ac99", padding: "8px 0" }}>{text}</div>;
}

function AnimatedBarRow({ label, pct, color, rightLabel, delay }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#7a7566", marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 800, color: C.dark }}>{rightLabel !== undefined ? rightLabel : `${pct}%`}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "#f0ece0", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20, delay: delay || 0 }}
          style={{ height: "100%", borderRadius: 999, background: color }}
        />
      </div>
    </div>
  );
}

function RadialMini({ pct, color, size = 54 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#f0ece0" strokeWidth={6} fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round"
        strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={900} fill={C.dark}>{pct}%</text>
    </svg>
  );
}

function DeepAnalyticsGrid({ state, ac }) {
  const categoryStats = useMemo(() => {
    const tally = {};
    CATEGORIES.forEach((c) => { tally[c.key] = { done: 0, total: 0 }; });
    [...(state.dailyGoals || []), ...(state.extryGoals || [])].forEach((g) => {
      const key = tally[g.category] ? g.category : "other";
      tally[key].total++; if (g.done) tally[key].done++;
    });
    return CATEGORIES.map((c) => ({ ...c, ...tally[c.key], rate: tally[c.key].total ? Math.round((tally[c.key].done / tally[c.key].total) * 100) : 0 })).filter((c) => c.total > 0);
  }, [state.dailyGoals, state.extryGoals]);

  const priorityStats = useMemo(() => {
    const tally = {};
    PRIORITIES.forEach((p) => { tally[p.key] = { done: 0, total: 0 }; });
    [...(state.dailyGoals || []), ...(state.extryGoals || [])].forEach((g) => {
      const key = tally[g.priority] ? g.priority : "medium";
      tally[key].total++; if (g.done) tally[key].done++;
    });
    return PRIORITIES.map((p) => ({ ...p, ...tally[p.key], rate: tally[p.key].total ? Math.round((tally[p.key].done / tally[p.key].total) * 100) : 0 }));
  }, [state.dailyGoals, state.extryGoals]);

  const weekdayStats = useMemo(() => {
    const entries = Object.entries(state.completionHistory || {});
    const byDow = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    entries.forEach(([iso, pct]) => {
      const dow = new Date(iso + "T00:00:00").getDay();
      byDow[dow].sum += pct; byDow[dow].n++;
    });
    const data = byDow.map((v, i) => ({ day: WEEKDAY_NAMES[i], avg: v.n ? Math.round(v.sum / v.n) : 0, n: v.n }));
    let bestI = -1, worstI = -1, bestV = -1, worstV = 101;
    data.forEach((d, i) => { if (d.n > 0) { if (d.avg > bestV) { bestV = d.avg; bestI = i; } if (d.avg < worstV) { worstV = d.avg; worstI = i; } } });
    return { data, bestI, worstI };
  }, [state.completionHistory]);

  // "Good day" threshold for streak purposes — same spirit as the Calendar
  // widget's checkmark, kept independent from the Heatmap's tint breakpoints.
  const streakStats = useMemo(() => {
    const hist = state.completionHistory || {};
    const dates = Object.keys(hist).sort();
    let longest = 0, run = 0, prevGood = null;
    dates.forEach((iso) => {
      const pct = hist[iso];
      const d = new Date(iso + "T00:00:00");
      if (pct >= 70) {
        run = prevGood && (d - prevGood) / 86400000 === 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
        prevGood = d;
      } else { run = 0; prevGood = null; }
    });
    return { longest, current: state.streak || 0 };
  }, [state.completionHistory, state.streak]);

  const moodDist = useMemo(() => {
    const vals = Object.values(state.moodLog || {});
    const total = vals.length;
    const counts = { happy: 0, neutral: 0, sad: 0 };
    vals.forEach((m) => { if (counts[m] !== undefined) counts[m]++; });
    return { total, counts };
  }, [state.moodLog]);

  const moneyVelocity = useMemo(() => {
    const hist = state.moneyHistory || {};
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const v = hist[iso] || { earn: 0, spend: 0 };
      days.push({ date: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }), earn: v.earn || 0, spend: v.spend || 0, net: (v.earn || 0) - (v.spend || 0) });
    }
    const thisSum = days.reduce((s, d) => s + d.net, 0);
    let prevSum = 0;
    for (let i = 27; i >= 14; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const v = hist[d.toISOString().slice(0, 10)];
      if (v) prevSum += (v.earn || 0) - (v.spend || 0);
    }
    return { days, thisSum, delta: thisSum - prevSum };
  }, [state.moneyHistory]);

  const subtaskStats = useMemo(() => {
    let done = 0, total = 0;
    [...(state.dailyGoals || []), ...(state.extryGoals || [])].forEach((g) => {
      (g.subtasks || []).forEach((s) => { total++; if (s.done) done++; });
    });
    return { done, total, rate: total ? Math.round((done / total) * 100) : 0 };
  }, [state.dailyGoals, state.extryGoals]);

  const momentum = useMemo(() => {
    const hist = state.completionHistory || {};
    const today = new Date();
    const isoOf = (d) => d.toISOString().slice(0, 10);
    let thisSum = 0, thisN = 0, lastSum = 0, lastN = 0;
    for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() - i); const v = hist[isoOf(d)]; if (v !== undefined) { thisSum += v; thisN++; } }
    for (let i = 7; i < 14; i++) { const d = new Date(today); d.setDate(d.getDate() - i); const v = hist[isoOf(d)]; if (v !== undefined) { lastSum += v; lastN++; } }
    return { thisAvg: thisN ? Math.round(thisSum / thisN) : 0, lastAvg: lastN ? Math.round(lastSum / lastN) : 0, hasData: thisN > 0 && lastN > 0 };
  }, [state.completionHistory]);

  const moodTotal = moodDist.total || 0;
  const moodPct = (k) => (moodTotal ? Math.round((moodDist.counts[k] / moodTotal) * 100) : 0);
  const MOOD_COLORS = { happy: "#4a7c59", neutral: C.blue, sad: "#e07a5f" };
  const moodPie = [
    { name: "Happy", value: moodDist.counts.happy, color: MOOD_COLORS.happy },
    { name: "Neutral", value: moodDist.counts.neutral, color: MOOD_COLORS.neutral },
    { name: "Sad", value: moodDist.counts.sad, color: MOOD_COLORS.sad },
  ].filter((s) => s.value > 0);

  const momentumDelta = momentum.thisAvg - momentum.lastAvg;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: ac.sectionHeader || C.dark, margin: "20px 0 8px" }}>🔬 Deep Analytics</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>

        <ProCard title="Category performance" icon={Tag} color={C.accent} index={0}>
          {categoryStats.length ? categoryStats.map((c, i) => (
            <AnimatedBarRow key={c.key} label={c.label} pct={c.rate} color={c.color} rightLabel={`${c.done}/${c.total} · ${c.rate}%`} delay={i * 0.05} />
          )) : <EmptyNote text="Add categories to your goals to see this breakdown." />}
        </ProCard>

        <ProCard title="Priority performance" icon={Award} color={C.blue} index={1}>
          {priorityStats.some((p) => p.total > 0) ? priorityStats.map((p, i) => (
            <AnimatedBarRow key={p.key} label={p.label} pct={p.rate} color={p.color} rightLabel={`${p.done}/${p.total} · ${p.rate}%`} delay={i * 0.05} />
          )) : <EmptyNote text="No priorities set on your goals yet." />}
        </ProCard>

        <ProCard title="Best & toughest weekdays" icon={CalendarDays} color="#4a7c59" index={2} wide>
          {weekdayStats.data.some((d) => d.n > 0) ? (
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekdayStats.data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#f0ece0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#b3ac99" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#b3ac99" }} width={28} />
                  <Tooltip formatter={(v, n, p) => [`${v}%`, p.payload.n ? `${p.payload.n} day(s)` : "No data"]} contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900}>
                    {weekdayStats.data.map((d, i) => (
                      <Cell key={i} fill={i === weekdayStats.bestI ? "#4a7c59" : i === weekdayStats.worstI ? "#e07a5f" : tintHex(C.accent, 0.35)} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyNote text="Log a few more days to see your weekday pattern." />}
        </ProCard>

        <ProCard title="Streak record" icon={Flame} color="#e07a5f" index={3}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-around", padding: "4px 0" }}>
            <div style={{ textAlign: "center" }}>
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
                style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{String(streakStats.current).padStart(3, "0")}</motion.div>
              <div style={{ fontSize: 9, color: "#b3ac99" }}>Current streak</div>
            </div>
            <div style={{ width: 1, height: 30, background: "#ece7d8" }} />
            <div style={{ textAlign: "center" }}>
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>{String(streakStats.longest).padStart(3, "0")}</motion.div>
              <div style={{ fontSize: 9, color: "#b3ac99" }}>Longest streak</div>
            </div>
          </div>
          {streakStats.current > 0 && streakStats.current >= streakStats.longest && (
            <div style={{ marginTop: 8, textAlign: "center", fontSize: 9.5, fontWeight: 800, color: "#4a7c59" }}>🏆 You're on your all-time best run!</div>
          )}
        </ProCard>

        <ProCard title="Mood distribution" icon={Smile} color="#4a7c59" index={4}>
          {moodPie.length ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 90, height: 90, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moodPie} dataKey="value" nameKey="name" innerRadius={26} outerRadius={42} paddingAngle={3} isAnimationActive animationDuration={800}>
                      {moodPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} day(s)`, n]} contentStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[["Happy", MOOD_COLORS.happy, moodPct("happy")], ["Neutral", MOOD_COLORS.neutral, moodPct("neutral")], ["Sad", MOOD_COLORS.sad, moodPct("sad")]].map(([label, color, pct]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, color: C.text }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    {label} · <b style={{ color: C.dark }}>{pct}%</b>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyNote text="Log your mood a few times to see this chart." />}
        </ProCard>

        <ProCard title="Money velocity — last 14 days" icon={PiggyBank} color={C.accent} index={5} wide>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={moneyVelocity.days} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#f0ece0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#b3ac99" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "#b3ac99" }} width={30} />
                <Tooltip contentStyle={{ fontSize: 10 }} />
                <Bar dataKey="earn" fill={tintHex("#4a7c59", 0.2)} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} />
                <Bar dataKey="spend" fill={tintHex("#e07a5f", 0.2)} radius={[3, 3, 0, 0]} isAnimationActive animationDuration={900} />
                <Line type="monotone" dataKey="net" stroke={C.dark} strokeWidth={2} dot={false} isAnimationActive animationDuration={1000} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: "right", fontSize: 9.5, marginTop: 4, color: moneyVelocity.delta >= 0 ? "#4a7c59" : "#e07a5f", fontWeight: 800 }}>
            {moneyVelocity.delta >= 0 ? "▲" : "▼"} ₹{Math.abs(Math.round(moneyVelocity.delta))} net vs. previous 14 days
          </div>
        </ProCard>

        <ProCard title="Subtask completion" icon={ListChecks} color={C.blue} index={6}>
          {subtaskStats.total ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <RadialMini pct={subtaskStats.rate} color={C.blue} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.dark }}>{subtaskStats.done}/{subtaskStats.total}</div>
                <div style={{ fontSize: 9, color: "#b3ac99" }}>Subtasks completed across all goals</div>
              </div>
            </div>
          ) : <EmptyNote text="Add subtasks to a goal to track this." />}
        </ProCard>

        <ProCard title="Weekly momentum" icon={momentumDelta >= 0 ? TrendingUp : TrendingDown} color={momentumDelta >= 0 ? "#4a7c59" : "#e07a5f"} index={7}>
          {momentum.hasData ? (
            <>
              <AnimatedBarRow label="Last week" pct={momentum.lastAvg} color={tintHex(C.dark, 0.4)} delay={0} />
              <AnimatedBarRow label="This week" pct={momentum.thisAvg} color={momentumDelta >= 0 ? "#4a7c59" : "#e07a5f"} delay={0.08} />
              <div style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: momentumDelta >= 0 ? "#4a7c59" : "#e07a5f", marginTop: 2 }}>
                {momentumDelta >= 0 ? "▲" : "▼"} {Math.abs(momentumDelta)}% {momentumDelta >= 0 ? "up" : "down"} vs last week
              </div>
            </>
          ) : <EmptyNote text="Keep logging — momentum needs 2 weeks of data." />}
        </ProCard>

      </div>
    </div>
  );
}

function AnalyticsTab({ state, onClose, onOpenMoneyManagement }) {
  const [showShare, setShowShare] = useState(false);
  const at = normalizeScopeTheme(state.theme?.analytics);
  const atFontFamily = at.font ? fontStackFor(at.font) : undefined;
  const ac = normalizeAnalyticsColors(state.theme?.analyticsColors);
  const moodData = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const v = moodToNum(state.moodLog[iso]);
      arr.push({ date: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }), mood: v === null ? null : v });
    }
    return arr;
  }, [state.moodLog]);

  const moneySummary = useMemo(() => {
    const earn = state.totalEarnLife || 0;
    const spend = state.totalSpendLife || 0;
    return { earn, spend, net: earn - spend };
  }, [state.totalEarnLife, state.totalSpendLife]);


  const insights = useMemo(() => {
    const entries = Object.entries(state.completionHistory || {});
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const avg = entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;
    return { best, worst, avg };
  }, [state.completionHistory]);

  const lifeScore = useMemo(() => {    const hist = state.completionHistory || {};
    const mood = state.moodLog || {};
    let compSum = 0, compN = 0, moodSum = 0, moodN = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (hist[iso] !== undefined) { compSum += hist[iso]; compN++; }
      const mv = moodToNum(mood[iso]);
      if (mv !== null) { moodSum += mv; moodN++; }
    }
    const compAvg = compN ? compSum / compN : 0;          // 0-100
    const moodAvg = moodN ? (moodSum / moodN) * 100 : 50;  // 0-100, default neutral
    const streakScore = Math.min((state.streak || 0) / 30, 1) * 100; // caps at 30-day streak

    const score = Math.round(compAvg * 0.5 + streakScore * 0.3 + moodAvg * 0.2);
    let label, emoji, color;
    if (score >= 85) { label = "Unstoppable"; emoji = "🔥"; color = "#e07a5f"; }
    else if (score >= 70) { label = "Solid Momentum"; emoji = "💪"; color = C.accent; }
    else if (score >= 50) { label = "Building Up"; emoji = "🌱"; color = "#4a7c59"; }
    else if (score >= 30) { label = "Finding Your Rhythm"; emoji = "🧭"; color = C.blue; }
    else { label = "Fresh Start"; emoji = "🌙"; color = "#8a8579"; }
    return { score, label, emoji, color: ac.lifeScoreRing || color };
  }, [state.completionHistory, state.moodLog, state.streak, ac.lifeScoreRing]);

  const smartInsights = useMemo(() => {
    const cards = [];
    const hist = state.completionHistory || {};
    const mood = state.moodLog || {};
    const entries = Object.entries(hist);

    // 1. Best day of the week (needs at least 4 dated entries)
    if (entries.length >= 4) {
      const byDow = {}; // 0-6 -> {sum, n}
      entries.forEach(([iso, pct]) => {
        const dow = new Date(iso + "T00:00:00").getDay();
        byDow[dow] = byDow[dow] || { sum: 0, n: 0 };
        byDow[dow].sum += pct; byDow[dow].n++;
      });
      let bestDow = null, bestAvg = -1;
      Object.entries(byDow).forEach(([dow, v]) => {
        const avg = v.sum / v.n;
        if (v.n >= 1 && avg > bestAvg) { bestAvg = avg; bestDow = dow; }
      });
      if (bestDow !== null) {
        const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        cards.push({
          icon: "📅", color: C.accent,
          text: `You're most consistent on ${names[bestDow]}s — averaging ${Math.round(bestAvg)}% completion.`,
        });
      }
    }

    // 2. Mood vs completion correlation
    const happyPcts = [], lowPcts = [];
    entries.forEach(([iso, pct]) => {
      const m = mood[iso];
      if (m === "happy") happyPcts.push(pct);
      else if (m === "sad") lowPcts.push(pct);
    });
    if (happyPcts.length >= 2 && lowPcts.length >= 2) {
      const happyAvg = happyPcts.reduce((a, b) => a + b, 0) / happyPcts.length;
      const lowAvg = lowPcts.reduce((a, b) => a + b, 0) / lowPcts.length;
      const diff = Math.round(happyAvg - lowAvg);
      if (Math.abs(diff) >= 10) {
        cards.push({
          icon: "😊", color: "#4a7c59",
          text: diff > 0
            ? `On days you feel happy, you complete ${diff}% more goals than on low-mood days.`
            : `Mood dips seem linked to higher completion here — worth a closer look at what's driving that.`,
        });
      }
    }

    // 3. Week-over-week trend
    const today = new Date();
    const isoOf = (d) => d.toISOString().slice(0, 10);
    let thisWeekSum = 0, thisWeekN = 0, lastWeekSum = 0, lastWeekN = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const v = hist[isoOf(d)];
      if (v !== undefined) { thisWeekSum += v; thisWeekN++; }
    }
    for (let i = 7; i < 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const v = hist[isoOf(d)];
      if (v !== undefined) { lastWeekSum += v; lastWeekN++; }
    }
    if (thisWeekN >= 2 && lastWeekN >= 2) {
      const thisAvg = thisWeekSum / thisWeekN, lastAvg = lastWeekSum / lastWeekN;
      const delta = Math.round(thisAvg - lastAvg);
      if (Math.abs(delta) >= 5) {
        cards.push({
          icon: delta > 0 ? "📈" : "📉", color: delta > 0 ? "#4a7c59" : "#e07a5f",
          text: delta > 0
            ? `Trending up — this week's completion is ${delta}% higher than last week.`
            : `This week is ${Math.abs(delta)}% behind last week — small resets happen, keep going.`,
        });
      }
    }

    // 4. Weakest category right now
    const tally = {};
    [...(state.dailyGoals || []), ...(state.extryGoals || [])].forEach((g) => {
      const key = g.category || "other";
      tally[key] = tally[key] || { done: 0, total: 0 };
      tally[key].total++;
      if (g.done) tally[key].done++;
    });
    let weakest = null, weakestRate = 2;
    Object.entries(tally).forEach(([key, v]) => {
      if (v.total < 1) return;
      const rate = v.done / v.total;
      if (rate < weakestRate) { weakestRate = rate; weakest = key; }
    });
    if (weakest && weakestRate < 0.5) {
      const cat = catInfo(weakest);
      cards.push({
        icon: "🎯", color: cat.color,
        text: `${cat.label} goals are lagging today (${Math.round(weakestRate * 100)}% done) — maybe tackle one of those next.`,
      });
    }

    return cards;
  }, [state.completionHistory, state.moodLog, state.dailyGoals, state.extryGoals]);

  return (
    <div style={{
      border: `1px solid ${C.text}`, borderRadius: 10, background: at.bg || "#fff",
      display: "flex", flexDirection: "column", height: "100%",
      color: at.text || undefined, fontFamily: atFontFamily, fontWeight: at.bold ? 600 : undefined,
      zoom: at.scale !== 1 ? at.scale : undefined,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        borderBottom: `1px solid ${C.text}`, background: at.bg || C.bg, borderRadius: "10px 10px 0 0",
      }}>
        <BarChart3 size={14} color={ac.header || C.dark} />
        <span style={{ fontSize: 13, fontWeight: 800, color: ac.header || C.dark }}>Analytics & Insights</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowShare(true)} style={{
          border: "none", borderRadius: 8, padding: "5px 10px", background: C.accent, color: "#fff",
          fontSize: 10, fontWeight: 800, cursor: "pointer", marginRight: 6,
        }}>📤 Share Journey</button>
        <button onClick={onClose} style={{
          border: "none", borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><X size={13} color={C.dark} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }} className="btl-scroll">
        {/* Life Score badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
          border: `1px solid ${lifeScore.color}`, borderRadius: 12, padding: "12px 16px",
          background: `linear-gradient(135deg, ${lifeScore.color}14, transparent)`,
        }}>
          <div style={{
            width: 62, height: 62, borderRadius: "50%", flexShrink: 0,
            border: `4px solid ${lifeScore.color}`, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "#fff",
          }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: lifeScore.color, lineHeight: 1 }}>{lifeScore.score}</span>
            <span style={{ fontSize: 7, color: "#a39c86", fontWeight: 700 }}>/ 100</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: ac.header || C.dark }}>{lifeScore.emoji} {lifeScore.label}</div>
            <div style={{ fontSize: 9, color: ac.lifeScoreDesc || "#a39c86", marginTop: 2 }}>Life Score — last 7 days completion, streak & mood combined</div>
          </div>
        </div>

        {/* insights row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <TrendingUp size={14} color={ac.statAvgIcon || C.accent} />
            <div style={{ fontSize: 16, fontWeight: 900, color: ac.statAvgIcon || C.dark }}>{insights ? `${Math.round(insights.avg)}%` : "—"}</div>
            <div style={{ fontSize: 9, color: ac.statLabel || "#b3ac99" }}>Average completion</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <Award size={14} color={ac.statBestIcon || "#4a7c59"} />
            <div style={{ fontSize: 12, fontWeight: 900, color: ac.statBestIcon || C.dark }}>{insights ? `${Math.round(insights.best[1])}%` : "—"}</div>
            <div style={{ fontSize: 9, color: ac.statLabel || "#b3ac99" }}>Best day{insights ? ` · ${insights.best[0]}` : ""}</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <Flame size={14} color={ac.statToughIcon || "#e07a5f"} />
            <div style={{ fontSize: 12, fontWeight: 900, color: ac.statToughIcon || C.dark }}>{insights ? `${Math.round(insights.worst[1])}%` : "—"}</div>
            <div style={{ fontSize: 9, color: ac.statLabel || "#b3ac99" }}>Toughest day{insights ? ` · ${insights.worst[0]}` : ""}</div>
          </div>
        </div>

        {/* Smart insight cards */}
        {smartInsights.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ac.smartHeader || C.dark, marginBottom: 6 }}>🧠 Smart Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {smartInsights.map((c, i) => {
                const cardColor = ac.smartAccent || c.color;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                    borderRadius: 8, background: `${cardColor}12`, border: `1px solid ${cardColor}33`,
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{c.icon}</span>
                    <span style={{ fontSize: 10.5, color: C.text, lineHeight: 1.4 }}>{c.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, color: ac.sectionHeader || C.dark, marginBottom: 6 }}>Daily goal completion — last 13 weeks</div>
        <Heatmap completionHistory={state.completionHistory || {}} accentColor={ac.heatmap} />

        <div style={{ fontSize: 11, fontWeight: 800, color: ac.sectionHeader || C.dark, margin: "18px 0 6px" }}>Mood trend — last 30 days</div>
        <div style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={moodData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#f0ece0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#b3ac99" }} interval={4} />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => v === 1 ? "🙂" : v === 0.5 ? "😐" : "🙁"} tick={{ fontSize: 10 }} width={24} />
              <Tooltip formatter={(v) => v === 1 ? "Happy" : v === 0.5 ? "Neutral" : v === 0 ? "Sad" : "No entry"} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="mood" stroke={ac.moodLine || C.blue} strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ---------- Money Management nav card — detailed money analytics live in their own tab ---------- */}
        <div style={{ fontSize: 11, fontWeight: 800, color: ac.sectionHeader || C.dark, margin: "20px 0 8px" }}>💰 Money</div>
        <motion.div
          onClick={onOpenMoneyManagement}
          whileHover={{ y: -3, boxShadow: "0 14px 30px rgba(37,36,34,0.14)" }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          style={{
            display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
            borderRadius: 14, padding: "14px 16px", marginBottom: 4,
            background: `linear-gradient(120deg, ${C.accent}14, #4a7c5910)`,
            border: `1px solid ${C.accent}40`,
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.accent}40`,
          }}>
            <Wallet size={20} color={C.accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: C.dark }}>Money Management</div>
            <div style={{ fontSize: 9.5, color: "#8a8579", marginTop: 1 }}>Category breakdown, earn vs spend trend & recent activity</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 8.5, color: ac.earn || "#6b8f77", fontWeight: 700 }}>Earned</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: ac.earn || "#4a7c59" }}>₹{moneySummary.earn.toFixed(0)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 8.5, color: ac.spend || "#c0776b", fontWeight: 700 }}>Spent</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: ac.spend || "#c0392b" }}>₹{moneySummary.spend.toFixed(0)}</div>
            </div>
          </div>
          <ChevronRight size={18} color="#a39c86" />
        </motion.div>

        <DeepAnalyticsGrid state={state} ac={ac} />
      </div>
      {showShare && <ShareJourneyModal state={state} lifeScore={lifeScore} onClose={() => setShowShare(false)} />}
    </div>
  );
}

/* ---------------- MONEY FILTER — shared filtering logic ----------------
   Used by both MoneyFilterModal (for the live "N entries match" preview)
   and MoneyManagementTab (to actually narrow the summary + activity
   list), so the popup's preview count and the applied result always
   agree. */
const DEFAULT_MONEY_FILTERS = { types: ["earn", "spend"], categories: [], dateRange: "all", from: "", to: "" };
const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "14d", label: "14 Days" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];
function moneyDateInRange(dateStr, filters) {
  if (filters.dateRange === "all") return true;
  if (filters.dateRange === "custom") {
    if (filters.from && dateStr < filters.from) return false;
    if (filters.to && dateStr > filters.to) return false;
    return true;
  }
  const days = { today: 0, "7d": 6, "14d": 13, "30d": 29 }[filters.dateRange] ?? 0;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateStr >= d.toISOString().slice(0, 10);
}
function filterMoneyEntries(entries, filters) {
  return entries.filter((e) => {
    if (!filters.types.includes(e.type)) return false;
    if (e.type === "spend" && filters.categories.length && !filters.categories.includes(e.category || "other")) return false;
    return moneyDateInRange(e.date, filters);
  });
}
/* Bug fix: Daily Goals / Extry Goals were staying ticked from the previous
   day because `done` lived directly on the goal object with nothing to
   clear it. This runs on load and once a minute after that; the moment the
   calendar date differs from `state.lastActiveDay` it unchecks every goal
   in both lists for the fresh day. completionHistory / dailyLogs for past
   days are untouched since those are separate snapshots taken on toggle. */
function rolloverDailyGoals(s) {
  if (!s) return s;
  const today = todayISO();
  if (s.lastActiveDay === today) return s;
  return {
    ...s,
    lastActiveDay: today,
    dailyGoals: (s.dailyGoals || []).map((g) => (g.done ? { ...g, done: false } : g)),
    extryGoals: (s.extryGoals || []).map((g) => (g.done ? { ...g, done: false } : g)),
  };
}

function isMoneyFilterActive(filters) {
  return filters.types.length !== 2 || filters.categories.length > 0 || filters.dateRange !== "all";
}

/* ---------------- DEEP MONEY INSIGHTS — 12 new pro-level widgets (this update) ----------------
   Everything below is derived purely from state.moneyEntries / state.moneyHistory /
   totalEarnLife / totalSpendLife — no schema change, nothing fabricated. Built with
   framer-motion + recharts (already project dependencies) for spring/stagger motion,
   animated counters and a hand-rolled mouse-tilt "3D" hero card. Deliberately not
   pulling in three.js / GSAP / anime.js / Lottie / A-Frame as brand-new npm installs
   for a finance widget grid — say the word if you'd like one of those added for a
   specific effect and I'll wire it in. */
function daysAgoISO(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

/* Animated count-up used across the widgets below for a "ticking" dashboard feel
   instead of numbers just snapping into place on mount / filter change. */
function CountUp({ value, decimals = 0, duration = 0.9 }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current, to = value;
    let raf; const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick); else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display.toFixed(decimals)}</>;
}

function SavingsGauge({ rate }) {
  const pct = Math.max(0, Math.min(100, rate));
  const r = 46, circumference = Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const color = rate >= 50 ? "#4a7c59" : rate >= 20 ? C.accent : rate >= 0 ? "#e07a5f" : "#c0392b";
  return (
    <div style={{ position: "relative", width: 120, height: 66, margin: "0 auto" }}>
      <svg width="120" height="66" viewBox="0 0 120 66">
        <path d="M 14 58 A 46 46 0 0 1 106 58" fill="none" stroke="#f0ece0" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d="M 14 58 A 46 46 0 0 1 106 58" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, textAlign: "center", fontSize: 19, fontWeight: 900, color }}>
        {rate >= 0 ? rate.toFixed(0) : 0}%
      </div>
    </div>
  );
}

function HealthScoreRing({ score, grade }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <RadialMini pct={Math.max(0, Math.min(100, score))} color={grade.color} size={64} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: grade.color }}>{score}<span style={{ fontSize: 10, color: "#a39c86", fontWeight: 700 }}>/100</span></div>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: grade.color }}>{grade.label}</div>
      </div>
    </div>
  );
}

function MonthDeltaStat({ label, cur, delta, color, good }) {
  const up = delta >= 0;
  const positiveIsGoodColor = good ? "#4a7c59" : "#c0392b";
  const negativeIsGoodColor = good ? "#c0392b" : "#4a7c59";
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 9, color: "#a39c86", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color }}>₹<CountUp value={cur} /></div>
      <div style={{ fontSize: 9, fontWeight: 800, color: up ? positiveIsGoodColor : negativeIsGoodColor, display: "flex", alignItems: "center", gap: 2 }}>
        {up ? "▲" : "▼"} {Math.abs(delta)}% vs last month
      </div>
    </div>
  );
}

function LeaderboardList({ title, rows, isEarn }) {
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#a39c86", marginBottom: 6 }}>{title}</div>
      {rows.length === 0 ? <EmptyNote text="Nothing logged yet." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {rows.map((e, i) => {
            const cat = !isEarn ? spendCatInfo(e.category) : null;
            return (
              <motion.div key={e.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
                <span>{medals[i]}</span>
                <span style={{ flex: 1, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isEarn ? (e.note || "Earning") : `${cat.emoji} ${cat.label}`}
                </span>
                <span style={{ fontWeight: 900, color: isEarn ? "#4a7c59" : "#c0392b" }}>₹{(e.amount || 0).toFixed(0)}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeepMoneyWidgets({ state, mc, entries, onOpenPhoto }) {
  const hist = state.moneyHistory || {};
  const totalEarn = state.totalEarnLife || 0;
  const totalSpend = state.totalSpendLife || 0;
  const netLife = totalEarn - totalSpend;

  const categoryTotals = useMemo(() => {
    const map = {};
    entries.filter((e) => e.type === "spend").forEach((e) => {
      const key = e.category || "other";
      map[key] = (map[key] || 0) + (e.amount || 0);
    });
    return SPEND_CATEGORIES.map((c) => ({ ...c, total: map[c.key] || 0 })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [entries]);
  const maxCatTotal = categoryTotals[0]?.total || 1;

  const savingsRate = totalEarn > 0 ? Math.max(-100, Math.min(100, (netLife / totalEarn) * 100)) : 0;

  const { moneyStreak, bestMoneyStreak, last90 } = useMemo(() => {
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const iso = daysAgoISO(i);
      const rec = hist[iso] || { earn: 0, spend: 0 };
      days.push({ iso, net: (rec.earn || 0) - (rec.spend || 0) });
    }
    let best = 0, run = 0;
    days.forEach((d) => { if (d.net >= 0) { run += 1; best = Math.max(best, run); } else { run = 0; } });
    let cur = 0;
    for (let i = days.length - 1; i >= 0; i--) { if (days[i].net >= 0) cur += 1; else break; }
    return { moneyStreak: cur, bestMoneyStreak: best, last90: days };
  }, [hist]);

  const diversityPct = Math.round((categoryTotals.length / SPEND_CATEGORIES.length) * 100);
  const savingsNorm = Math.max(0, Math.min(100, savingsRate));
  const streakNorm = Math.min(100, (moneyStreak / 30) * 100);
  const healthScore = Math.round(savingsNorm * 0.5 + streakNorm * 0.3 + diversityPct * 0.2);
  const healthGrade = healthScore >= 80 ? { label: "Excellent", color: "#4a7c59" }
    : healthScore >= 60 ? { label: "Good", color: "#6b8f77" }
    : healthScore >= 40 ? { label: "Fair", color: C.accent }
    : { label: "Needs attention", color: "#c0392b" };

  const monthCompare = useMemo(() => {
    const now = new Date();
    const curKey = now.toISOString().slice(0, 7);
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = prevD.toISOString().slice(0, 7);
    const sum = (key) => entries.filter((e) => e.date && e.date.startsWith(key)).reduce((acc, e) => {
      if (e.type === "earn") acc.earn += e.amount || 0; else acc.spend += e.amount || 0; return acc;
    }, { earn: 0, spend: 0 });
    const cur = sum(curKey), prev = sum(prevKey);
    const pct = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
    return { cur, prev, earnDelta: pct(cur.earn, prev.earn), spendDelta: pct(cur.spend, prev.spend), netDelta: pct(cur.earn - cur.spend, prev.earn - prev.spend) };
  }, [entries]);

  const burn = useMemo(() => {
    let total = 0;
    for (let i = 0; i < 30; i++) total += hist[daysAgoISO(i)]?.spend || 0;
    const avg = total / 30;
    return { avg, projected: avg * 30 };
  }, [hist]);

  const weekdayPattern = useMemo(() => {
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    last90.forEach((d) => {
      const dow = new Date(d.iso + "T00:00:00").getDay();
      const rec = hist[d.iso] || { spend: 0 };
      sums[dow] += rec.spend || 0; counts[dow] += 1;
    });
    return WEEKDAY_NAMES.map((label, i) => ({ label, avg: counts[i] ? sums[i] / counts[i] : 0 }));
  }, [hist, last90]);
  const maxWeekday = Math.max(...weekdayPattern.map((w) => w.avg), 1);
  const bestWeekday = weekdayPattern.reduce((a, b) => (b.avg < a.avg ? b : a));
  const worstWeekday = weekdayPattern.reduce((a, b) => (b.avg > a.avg ? b : a));

  const categorySparklines = useMemo(() => {
    return categoryTotals.slice(0, 6).map((c) => {
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const iso = daysAgoISO(i);
        const dayTotal = entries.filter((e) => e.type === "spend" && e.category === c.key && e.date === iso).reduce((s, e) => s + (e.amount || 0), 0);
        days.push({ day: iso, v: dayTotal });
      }
      return { ...c, days };
    });
  }, [categoryTotals, entries]);

  const topEarns = useMemo(() => [...entries].filter((e) => e.type === "earn").sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 5), [entries]);
  const topSpends = useMemo(() => [...entries].filter((e) => e.type === "spend").sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 5), [entries]);
  const photoEntries = useMemo(() => entries.filter((e) => e.image).slice(0, 12), [entries]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const rec = hist[iso];
      cells.push({ day: d, iso, net: rec ? (rec.earn || 0) - (rec.spend || 0) : null });
    }
    return cells;
  }, [hist]);

  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const handleTiltMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: py * -8, ry: px * 10 });
  };
  const resetTilt = () => setTilt({ rx: 0, ry: 0 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "22px 0 12px" }}>
        <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, transparent, #ece7d8)" }} />
        <span style={{ fontSize: 11, fontWeight: 900, color: mc.sectionHeader || C.dark }}>🔬 Deep Money Insights</span>
        <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, #ece7d8, transparent)" }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>

        <motion.div
          onMouseMove={handleTiltMove} onMouseLeave={resetTilt}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, rotateX: tilt.rx, rotateY: tilt.ry }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          style={{
            flex: "1 1 100%", borderRadius: 12, padding: 16, position: "relative", overflow: "hidden",
            background: `linear-gradient(135deg, ${C.dark}, #34322d)`, color: "#fff", perspective: 800, transformStyle: "preserve-3d",
            boxShadow: "0 14px 30px rgba(37,36,34,0.3)", boxSizing: "border-box",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${50 + tilt.ry * 2}% ${50 + tilt.rx * 2}%, rgba(252,163,17,0.22), transparent 60%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.75, display: "flex", alignItems: "center", gap: 5 }}><Sparkles size={12} /> Net worth (lifetime)</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4, color: netLife >= 0 ? "#8fd19e" : "#ef9a8d" }}>
                {netLife >= 0 ? "+" : "−"}₹<CountUp value={Math.abs(netLife)} />
              </div>
            </div>
            <div><div style={{ fontSize: 9, opacity: 0.6 }}>Earned</div><div style={{ fontSize: 14, fontWeight: 800, color: "#8fd19e" }}>₹<CountUp value={totalEarn} /></div></div>
            <div><div style={{ fontSize: 9, opacity: 0.6 }}>Spent</div><div style={{ fontSize: 14, fontWeight: 800, color: "#ef9a8d" }}>₹<CountUp value={totalSpend} /></div></div>
            <div><div style={{ fontSize: 9, opacity: 0.6 }}>Entries logged</div><div style={{ fontSize: 14, fontWeight: 800 }}><CountUp value={entries.length} /></div></div>
          </div>
        </motion.div>

        <ProCard title="Savings rate" icon={TrendingUp} color="#4a7c59" index={0}>
          <SavingsGauge rate={savingsRate} />
          <div style={{ fontSize: 9, color: "#a39c86", textAlign: "center", marginTop: 2 }}>
            {savingsRate >= 0 ? `You keep ${savingsRate.toFixed(0)}% of what you earn` : "Spending more than you earn"}
          </div>
        </ProCard>

        <ProCard title="Money Health Score" icon={Award} color={C.accent} index={1}>
          <HealthScoreRing score={healthScore} grade={healthGrade} />
        </ProCard>

        <ProCard title="Positive-day streak" icon={Flame} color="#e07a5f" index={2}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-around" }}>
            <div style={{ textAlign: "center" }}>
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>{moneyStreak}</motion.div>
              <div style={{ fontSize: 9, color: "#b3ac99" }}>Current</div>
            </div>
            <div style={{ width: 1, height: 30, background: "#ece7d8" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.dark }}>{bestMoneyStreak}</div>
              <div style={{ fontSize: 9, color: "#b3ac99" }}>Best ever</div>
            </div>
          </div>
          {moneyStreak > 0 && moneyStreak >= bestMoneyStreak && (
            <div style={{ marginTop: 8, fontSize: 9.5, fontWeight: 800, color: "#4a7c59", textAlign: "center" }}>🏆 All-time best run!</div>
          )}
        </ProCard>

        <ProCard title="This month vs last month" icon={CalendarDays} color={C.blue} index={3} wide>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <MonthDeltaStat label="Earned" cur={monthCompare.cur.earn} delta={monthCompare.earnDelta} color="#4a7c59" good />
            <MonthDeltaStat label="Spent" cur={monthCompare.cur.spend} delta={monthCompare.spendDelta} color="#c0392b" good={false} />
            <MonthDeltaStat label="Net" cur={monthCompare.cur.earn - monthCompare.cur.spend} delta={monthCompare.netDelta} color={C.dark} good />
          </div>
        </ProCard>

        <ProCard title="Daily burn rate" icon={TrendingDown} color="#c0392b" index={4}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#c0392b" }}>₹<CountUp value={burn.avg} /></div>
          <div style={{ fontSize: 9, color: "#a39c86" }}>avg/day, last 30 days</div>
          <div style={{ marginTop: 8, fontSize: 9.5, color: C.dark }}>Projected this month: <b>₹{burn.projected.toFixed(0)}</b></div>
        </ProCard>

        <ProCard title="Category race" icon={Tag} color="#b083f0" index={5} wide>
          {categoryTotals.length === 0 ? <EmptyNote text="No spend categories logged yet." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categoryTotals.map((c, i) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, width: 100, flexShrink: 0, color: C.text }}>{c.emoji} {c.label}</span>
                  <div style={{ flex: 1, height: 10, borderRadius: 6, background: "#f0ece0", overflow: "hidden" }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(c.total / maxCatTotal) * 100}%` }} transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }} style={{ height: "100%", borderRadius: 6, background: c.color }} />
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, width: 56, textAlign: "right", color: C.dark }}>₹{c.total.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </ProCard>

        <ProCard title="Spending by weekday" icon={CalendarDays} color="#6b8f9c" index={6} wide>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
            {weekdayPattern.map((w) => (
              <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <motion.div
                  initial={{ height: 0 }} animate={{ height: `${Math.max(4, (w.avg / maxWeekday) * 70)}px` }} transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{ width: "70%", borderRadius: 6, background: w.label === worstWeekday.label ? "#e07a5f" : w.label === bestWeekday.label ? "#4a7c59" : C.blue }}
                />
                <span style={{ fontSize: 8.5, color: "#a39c86" }}>{w.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8.5, color: "#a39c86", marginTop: 6 }}>
            <span style={{ color: "#4a7c59", fontWeight: 800 }}>{bestWeekday.label}</span> is easiest on your wallet · <span style={{ color: "#e07a5f", fontWeight: 800 }}>{worstWeekday.label}</span> costs the most
          </div>
        </ProCard>

        <ProCard title="Category trends (14D)" icon={TrendingUp} color="#f4d35e" index={7} wide>
          {categorySparklines.length === 0 ? <EmptyNote text="No categories to trend yet." /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10 }}>
              {categorySparklines.map((c) => (
                <div key={c.key} style={{ border: "1px solid #f0ece0", borderRadius: 8, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: C.dark, marginBottom: 2 }}>{c.emoji} {c.label}</div>
                  <div style={{ height: 34 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={c.days}>
                        <Line type="monotone" dataKey="v" stroke={c.color} strokeWidth={2} dot={false} isAnimationActive animationDuration={800} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ProCard>

        <ProCard title="Biggest entries" icon={Award} color="#e8998d" index={8} wide>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <LeaderboardList title="Top earnings" rows={topEarns} isEarn />
            <LeaderboardList title="Top spends" rows={topSpends} isEarn={false} />
          </div>
        </ProCard>

        <ProCard title="Money photo memories" icon={Camera} color="#98c1d9" index={9} wide>
          {photoEntries.length === 0 ? <EmptyNote text="Attach a photo to an earn/spend entry to see it here." /> : (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }} className="btl-scroll">
              {photoEntries.map((e, i) => (
                <motion.img
                  key={e.id || i} src={e.image} alt=""
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.08, y: -3 }} whileTap={{ scale: 0.95 }}
                  onClick={() => onOpenPhoto(e.image)}
                  style={{ width: 56, height: 56, borderRadius: 9, objectFit: "cover", flexShrink: 0, cursor: "pointer", border: "1px solid #ece7d8" }}
                />
              ))}
            </div>
          )}
        </ProCard>

        <ProCard title="This month's net-day grid" icon={CalendarDays} color="#4a7c59" index={10} wide>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, maxWidth: 260 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={d + i} style={{ fontSize: 8, color: "#a39c86", textAlign: "center" }}>{d}</div>)}
            {calendarDays.map((c, i) => c === null ? <div key={"e" + i} /> : (
              <motion.div
                key={c.iso}
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.008 }}
                title={c.net === null ? `${c.iso} — no activity` : `${c.iso}: ${c.net >= 0 ? "+" : "−"}₹${Math.abs(c.net).toFixed(0)}`}
                style={{
                  aspectRatio: "1", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700,
                  background: c.net === null ? "#f5f2e8" : c.net > 0 ? tintHex("#4a7c59", 0.25) : c.net < 0 ? tintHex("#c0392b", 0.25) : "#f0ece0",
                  color: c.net === null ? "#c9c4b3" : "#fff",
                }}
              >{c.day}</motion.div>
            ))}
          </div>
        </ProCard>

      </div>
    </div>
  );
}

/* ---------------- MONEY MANAGEMENT (dedicated tab — reached via the nav card in Analytics) ----------------
   Category breakdown (donut + ranked list), an earn-vs-spend trend chart
   with a 7/14/30-day range toggle, and a scrollable recent-activity feed
   built from state.moneyEntries (individual Add-money popup submissions). */
function MoneyManagementTab({ state, onClose, onResetData }) {
  const [range, setRange] = useState(14); // 7 | 14 | 30
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_MONEY_FILTERS);
  const [deepLightbox, setDeepLightbox] = useState(null);
  const mt = normalizeScopeTheme(state.theme?.money);
  const mtFontFamily = mt.font ? fontStackFor(mt.font) : undefined;
  const mc = normalizeMoneyColors(state.theme?.moneyColors);
  const filterActive = isMoneyFilterActive(filters);
  const activeFilterCount = (filters.types.length !== 2 ? 1 : 0) + (filters.categories.length > 0 ? 1 : 0) + (filters.dateRange !== "all" ? 1 : 0);

  const handleResetConfirm = () => {
    onResetData?.();
    setResetOpen(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2200);
  };

  const moneySummary = useMemo(() => {
    const earn = state.totalEarnLife || 0;
    const spend = state.totalSpendLife || 0;
    return { earn, spend, net: earn - spend };
  }, [state.totalEarnLife, state.totalSpendLife]);

  const moneyData = useMemo(() => {
    const hist = state.moneyHistory || {};
    const arr = [];
    let running = 0;
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const rec = hist[iso] || { earn: 0, spend: 0 };
      running += (rec.earn || 0) - (rec.spend || 0);
      arr.push({
        date: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
        earn: rec.earn || 0,
        spend: rec.spend || 0,
        net: running,
      });
    }
    return arr;
  }, [state.moneyHistory, range]);

  const entries = state.moneyEntries || [];

  const categoryTotals = useMemo(() => {
    const map = {};
    entries.filter((e) => e.type === "spend").forEach((e) => {
      const key = e.category || "other";
      map[key] = (map[key] || 0) + (e.amount || 0);
    });
    return SPEND_CATEGORIES.map((c) => ({ ...c, total: map[c.key] || 0 })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [entries]);

  const spendCatSum = categoryTotals.reduce((sum, c) => sum + c.total, 0);

  // When a filter is active, the summary strip + activity feed switch to
  // filtered entries (type / category / date); otherwise they show the
  // usual lifetime totals + latest 14, unchanged from before.
  const filteredEntries = useMemo(() => filterMoneyEntries(entries, filters), [entries, filters]);
  const filteredSummary = useMemo(() => {
    const earn = filteredEntries.filter((e) => e.type === "earn").reduce((s, e) => s + (e.amount || 0), 0);
    const spend = filteredEntries.filter((e) => e.type === "spend").reduce((s, e) => s + (e.amount || 0), 0);
    return { earn, spend, net: earn - spend };
  }, [filteredEntries]);
  const displaySummary = filterActive ? filteredSummary : moneySummary;
  const displayEntries = filterActive ? filteredEntries.slice(0, 60) : entries.slice(0, 14);
  const displayCount = filterActive ? filteredEntries.length : entries.length;

  return (
    <div style={{
      border: `1px solid ${C.text}`, borderRadius: 10, background: mt.bg || "#fff", display: "flex", flexDirection: "column", height: "100%", position: "relative",
      color: mt.text || undefined, fontFamily: mtFontFamily, fontWeight: mt.bold ? 600 : undefined,
      zoom: mt.scale !== 1 ? mt.scale : undefined,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${C.text}`, background: mt.bg || C.bg, borderRadius: "10px 10px 0 0", flexWrap: "wrap", rowGap: 6 }}>
        <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ArrowLeft size={15} color={C.dark} />
        </motion.div>
        <Wallet size={14} color={mc.header || C.dark} />
        <span style={{ fontSize: 13, fontWeight: 800, color: mc.header || C.dark }}>Money Management</span>
        <div style={{ flex: 1 }} />
        <motion.button
          onClick={() => setFilterOpen(true)}
          whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
          title="Filter by type, category & date"
          style={{
            position: "relative", border: `1px solid ${filterActive ? C.accent : C.text}`, borderRadius: 999, padding: "5px 11px",
            background: filterActive ? `${C.accent}18` : "#fff",
            display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 800, color: filterActive ? C.accent : C.dark,
          }}
        >
          <Filter size={12} /> Filter
          {filterActive && (
            <span style={{
              position: "absolute", top: -5, right: -5, width: 15, height: 15, borderRadius: "50%",
              background: C.accent, color: "#fff", fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 6px rgba(252,163,17,0.5)",
            }}>{activeFilterCount || "•"}</span>
          )}
        </motion.button>
        <motion.button
          onClick={() => setSummaryOpen(true)}
          whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
          title="Day-by-day breakdown with photos"
          style={{
            border: `1px solid ${C.text}`, borderRadius: 999, padding: "5px 11px", background: "#fff",
            display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 800, color: C.dark,
          }}
        ><ListChecks size={12} /> Summary</motion.button>
        <motion.button
          onClick={() => setResetOpen(true)}
          whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
          title="Reset all Money Management data"
          style={{
            border: "1px solid #c0392b40", borderRadius: 999, padding: "5px 11px", background: "#c0392b0f",
            display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 800, color: "#c0392b",
          }}
        ><RotateCcw size={12} /> Reset</motion.button>
        <button onClick={onClose} style={{
          border: "none", borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><X size={13} color={C.dark} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }} className="btl-scroll">
        {/* active-filter indicator strip */}
        <AnimatePresence>
          {filterActive && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: "auto", marginBottom: 12 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10,
                background: `${C.accent}14`, border: `1px solid ${C.accent}45`,
              }}>
                <Filter size={12} color={C.accent} />
                <span style={{ fontSize: 10, fontWeight: 800, color: C.dark }}>Filtered view</span>
                <span style={{ fontSize: 9.5, color: "#8a8579" }}>
                  {filters.types.length === 1 ? (filters.types[0] === "earn" ? "Earn only" : "Spend only") : "Earn + Spend"}
                  {filters.categories.length > 0 ? ` · ${filters.categories.length} categor${filters.categories.length > 1 ? "ies" : "y"}` : ""}
                  {filters.dateRange !== "all" ? ` · ${DATE_PRESETS.find((p) => p.key === filters.dateRange)?.label}` : ""}
                  {` · ${displayCount} match${displayCount === 1 ? "" : "es"}`}
                </span>
                <div style={{ marginLeft: "auto" }} />
                <motion.div
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                  onClick={() => setFilters(DEFAULT_MONEY_FILTERS)}
                  style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 9.5, fontWeight: 800, color: "#c0392b" }}
                ><X size={11} /> Clear</motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* summary strip */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px", background: `linear-gradient(135deg, ${mc.totalEarned || "#4a7c59"}18, transparent)`, border: `1px solid ${mc.totalEarned || "#4a7c59"}40` }}>
            <div style={{ fontSize: 9, color: mc.totalEarned || "#6b8f77", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><ArrowUpCircle size={11} /> {filterActive ? "Earned (filtered)" : "Total Earned"}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: mc.totalEarned || "#4a7c59" }}>₹{displaySummary.earn.toFixed(0)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px", background: `linear-gradient(135deg, ${mc.totalSpent || "#c0392b"}18, transparent)`, border: `1px solid ${mc.totalSpent || "#c0392b"}40` }}>
            <div style={{ fontSize: 9, color: mc.totalSpent || "#c0776b", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><ArrowDownCircle size={11} /> {filterActive ? "Spent (filtered)" : "Total Spent"}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: mc.totalSpent || "#c0392b" }}>₹{displaySummary.spend.toFixed(0)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px", background: `linear-gradient(135deg, ${displaySummary.net >= 0 ? (mc.net || C.accent) : "#c0392b"}18, transparent)`, border: `1px solid ${displaySummary.net >= 0 ? (mc.net || C.accent) : "#c0392b"}40` }}>
            <div style={{ fontSize: 9, color: "#a39c86", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><PiggyBank size={11} /> {filterActive ? "Net (filtered)" : "Net (life)"}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: displaySummary.net >= 0 ? (mc.net || C.accent) : "#c0392b" }}>
              {displaySummary.net >= 0 ? "+" : "−"}₹{Math.abs(displaySummary.net).toFixed(0)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px", background: `linear-gradient(135deg, ${mc.entries || "#98c1d9"}18, transparent)`, border: `1px solid ${mc.entries || "#98c1d9"}40` }}>
            <div style={{ fontSize: 9, color: "#7a9db0", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Receipt size={11} /> Entries logged</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: mc.entries || C.blue }}>{displayCount}</div>
          </div>
        </div>

        {/* category breakdown + trend, side by side */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {/* category donut */}
          <div style={{ flex: 1, minWidth: 240, border: "1px solid #ece7d8", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: mc.sectionHeader || C.dark, marginBottom: 6 }}>🏷️ Spend by category</div>
            {categoryTotals.length === 0 ? (
              <div style={{ fontSize: 10, color: "#a39c86", padding: "20px 0", textAlign: "center" }}>No spending logged yet — pick a category next time you add an expense.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryTotals} dataKey="total" nameKey="label" innerRadius={32} outerRadius={52} paddingAngle={2} strokeWidth={2} stroke="#fff">
                        {categoryTotals.map((c) => <Cell key={c.key} fill={c.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n, p) => [`₹${Number(v).toFixed(0)}`, p?.payload?.label]} contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #ece7d8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  {categoryTotals.slice(0, 6).map((c) => (
                    <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 9.5, flex: 1, color: C.text }}>{c.emoji} {c.label}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: C.dark }}>₹{c.total.toFixed(0)}</span>
                      <span style={{ fontSize: 8, color: "#a39c86", width: 30, textAlign: "right" }}>{spendCatSum ? Math.round((c.total / spendCatSum) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* trend chart */}
          <div style={{ flex: 1.4, minWidth: 260, border: "1px solid #ece7d8", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: mc.sectionHeader || C.dark }}>📈 Earn vs spend</div>
              <div style={{ display: "flex", gap: 4 }}>
                {[7, 14, 30].map((r) => (
                  <div key={r} onClick={() => setRange(r)} style={{
                    fontSize: 8.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, cursor: "pointer",
                    background: range === r ? C.dark : "#f0ece0", color: range === r ? "#fff" : "#8a8579",
                  }}>{r}D</div>
                ))}
              </div>
            </div>
            <div style={{ height: 178 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={moneyData} margin={{ top: 4, right: 10, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={mc.earnChart || "#4a7c59"} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={mc.earnChart || "#4a7c59"} stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={mc.spendChart || "#e07a5f"} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={mc.spendChart || "#e07a5f"} stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={mc.netLine || C.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={mc.netLine || C.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0ece0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#b3ac99" }} interval={Math.ceil(range / 7)} />
                  <YAxis tick={{ fontSize: 9, fill: "#b3ac99" }} width={34} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(v, key) => [`₹${Number(v).toFixed(0)}`, key === "earn" ? "Earned" : key === "spend" ? "Spent" : "Net"]}
                    labelStyle={{ fontSize: 10, fontWeight: 700 }} contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #ece7d8" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 9 }} formatter={(v) => v === "earn" ? "Earned" : v === "spend" ? "Spent" : "Net trend"} />
                  <Area type="monotone" dataKey="net" stroke={mc.netLine || C.accent} strokeWidth={2} fill="url(#netGrad)" dot={false} />
                  <Bar dataKey="earn" fill="url(#earnGrad)" radius={[4, 4, 0, 0]} barSize={range > 14 ? 4 : 9} />
                  <Bar dataKey="spend" fill="url(#spendGrad)" radius={[4, 4, 0, 0]} barSize={range > 14 ? 4 : 9} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* recent activity widget */}
        <div style={{ border: "1px solid #ece7d8", borderRadius: 12, padding: 12, maxHeight: filterActive ? 420 : undefined, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: mc.sectionHeader || C.dark, marginBottom: 8, flexShrink: 0 }}>{filterActive ? `🔎 Filtered results (${displayEntries.length})` : "🕒 Recent activity"}</div>
          {displayEntries.length === 0 ? (
            <div style={{ fontSize: 10, color: "#a39c86", padding: "10px 0", textAlign: "center" }}>
              {filterActive ? "No entries match these filters — try widening the date range or categories." : "Nothing logged yet — use Add on the dashboard to record your first entry."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: filterActive ? "auto" : "visible" }} className={filterActive ? "btl-scroll" : undefined}>
              {displayEntries.map((e, i) => {
                const isEarn = e.type === "earn";
                const cat = !isEarn ? spendCatInfo(e.category) : null;
                return (
                  <motion.div
                    key={e.id || i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.02 }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: i % 2 ? "transparent" : "#faf8f0" }}
                  >
                    {e.image ? (
                      <img src={e.image} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                    ) : isEarn ? (
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${mc.activityEarn || "#4a7c59"}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ArrowUpCircle size={14} color={mc.activityEarn || "#4a7c59"} /></div>
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${cat.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13 }}>{cat.emoji}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isEarn ? "Earning" : cat.label}{e.note ? ` · ${e.note}` : ""}
                      </div>
                      <div style={{ fontSize: 8.5, color: "#a39c86" }}>{e.date}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: isEarn ? (mc.activityEarn || "#4a7c59") : (mc.activitySpend || "#c0392b"), flexShrink: 0 }}>
                      {isEarn ? "+" : "−"}₹{(e.amount || 0).toFixed(0)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <DeepMoneyWidgets state={state} mc={mc} entries={entries} onOpenPhoto={setDeepLightbox} />
      </div>

      <AnimatePresence>{deepLightbox && <MemPhotoLightbox src={deepLightbox} onClose={() => setDeepLightbox(null)} />}</AnimatePresence>
      <AnimatePresence>{summaryOpen && <MoneySummaryModal state={state} onClose={() => setSummaryOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{resetOpen && <MoneyResetModal onClose={() => setResetOpen(false)} onConfirm={handleResetConfirm} />}</AnimatePresence>
      <AnimatePresence>
        {filterOpen && (
          <MoneyFilterModal
            entries={entries}
            filters={filters}
            onApply={(next) => setFilters(next)}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {resetDone && (
          <motion.div
            initial={{ opacity: 0, x: "-50%", y: -10, scale: 0.94 }} animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }} exit={{ opacity: 0, x: "-50%", y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            style={{
              position: "absolute", top: 12, left: "50%", zIndex: 95,
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999,
              background: "rgba(74,124,89,0.95)", color: "#fff", fontSize: 11, fontWeight: 800,
              boxShadow: "0 10px 26px rgba(74,124,89,0.35)",
            }}
          ><ShieldCheck size={13} /> Money Management data reset ✓</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- EARN MONEY / SPEND MONEY / NOTES / IMAGE (extracted as a widget) ----------------
   Clicking "Add" no longer commits directly — it opens the glass MoneyEntryModal
   popup (see below), which for Earn just offers an optional photo attach, and
   for Spend requires picking a category before it can be confirmed with "Done". */
function EarnMoneyNotesCard({ state, update, onOpenEarn, onOpenSpend, onImageFile, onImageDrop, fileRef, todayMood, onSetMood, textStyle, cardBg }) {
  const ts = normalizeTextStyle(textStyle);
  const [dashDragOver, setDashDragOver] = useState(false);
  const labelFontSize = Math.round(10 * ts.scale);
  const notesFontSize = Math.round(9 * ts.scale);
  const tsFontFamily = ts.font ? fontStackFor(ts.font) : undefined;
  const tsWeight = ts.bold ? 900 : 800;
  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 8, padding: 7, background: cardBg || "#fff", width: "100%", height: "100%", overflowY: "auto", boxSizing: "border-box", display: "flex", flexDirection: "column" }} className="btl-scroll">
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: tsWeight, fontSize: labelFontSize, marginBottom: 4, color: ts.color || "#4a7c59", fontFamily: tsFontFamily }}>Earn Money Today :-</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={state.earnToday} onChange={(e) => update((s) => { s.earnToday = e.target.value; return s; })}
              onKeyDown={(e) => e.key === "Enter" && onOpenEarn()}
              type="number" placeholder="₹ amount"
              style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
            />
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.92 }} onClick={onOpenEarn} style={{ border: "none", background: "#4a7c59", color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", fontSize: 9, flexShrink: 0 }}>Add</motion.button>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: tsWeight, fontSize: labelFontSize, marginBottom: 4, color: ts.color || "#c0392b", fontFamily: tsFontFamily }}>Spend Money Today :-</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={state.spendToday} onChange={(e) => update((s) => { s.spendToday = e.target.value; return s; })}
              onKeyDown={(e) => e.key === "Enter" && onOpenSpend()}
              type="number" placeholder="₹ amount"
              style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
            />
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.92 }} onClick={onOpenSpend} style={{ border: "none", background: "#c0392b", color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", fontSize: 9, flexShrink: 0 }}>Add</motion.button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <textarea
          value={state.notes} onChange={(e) => {
            const val = e.target.value;
            update((s) => {
              s.notes = val;
              const day = todayISO();
              const cur = s.dailyLogs?.[day] || {};
              s.dailyLogs = { ...(s.dailyLogs || {}), [day]: { ...cur, notes: val } };
              return s;
            });
          }}
          placeholder="notes"
          style={{
            flex: 1, minHeight: 44, maxHeight: 44, fontSize: notesFontSize, padding: 5, borderRadius: 6,
            border: "1px solid #ddd6c4", outline: "none", resize: "none",
            fontFamily: tsFontFamily, fontWeight: ts.bold ? 700 : undefined, color: ts.color || undefined,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDashDragOver(true); }}
            onDragLeave={() => setDashDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDashDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onImageDrop(file);
            }}
            style={{
              width: 44, height: 44, borderRadius: 6, cursor: "pointer",
              border: `1px dashed ${dashDragOver ? "#4a7c59" : "#ddd6c4"}`,
              background: dashDragOver ? "rgba(74,124,89,0.12)" : undefined,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}
          >
            {state.uploadedImage
              ? <img src={state.uploadedImage} alt="upload" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <ImageIcon size={16} color="#c9c2ac" />}
          </div>
          <Oval className="btl-oval-btn" onClick={() => fileRef.current?.click()} style={{ cursor: "pointer", fontSize: 8, padding: "2px 6px" }}>image Uplode</Oval>
          <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: "none" }} />
        </div>
      </div>

      {/* Today's Mood — replaces the old standalone multi-day "DATE" widget.
          Only today's mood lives here now, right in the card's own free space. */}
      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: "1px solid #f0ece0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: labelFontSize, fontWeight: tsWeight, color: ts.color || C.dark, fontFamily: tsFontFamily }}>Today's Mood :-</span>
        <div style={{ display: "flex", gap: 5 }}>
          <MoodBtn active={todayMood === "happy"} onClick={() => onSetMood("happy")} title="Happy"><Smile size={15} /></MoodBtn>
          <MoodBtn active={todayMood === "neutral"} onClick={() => onSetMood("neutral")} title="Neutral"><Meh size={15} /></MoodBtn>
          <MoodBtn active={todayMood === "sad"} onClick={() => onSetMood("sad")} title="Sad"><Frown size={15} /></MoodBtn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- MONEY ADD POPUP (Glassmorphism, opens on "Add" click) ----------------
   Earn -> amount is shown read-only + an optional photo attach (no categories).
   Spend -> amount is shown read-only + a required animated category grid,
   then "Done" commits it. Both share an optional note field. */
function MoneyEntryModal({ mode, amount, onClose, onConfirm }) {
  const isEarn = mode === "earn";
  const accent = isEarn ? "#4a7c59" : "#c0392b";
  const [category, setCategory] = useState(null);
  const [note, setNote] = useState("");
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [catError, setCatError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please pick an image file."); return; }
    setBusy(true);
    resizeImageDataUrl(file)
      .then((dataUrl) => { setImage(dataUrl); setBusy(false); })
      .catch(() => { alert("Couldn't read that image, try another one."); setBusy(false); });
  };
  const handleFile = (e) => {
    processFile(e.target.files?.[0]);
    e.target.value = "";
  };

  // Spend requires a category, but the button now stays clickable even
  // without one — clicking it shows a clear "pick a category first" error
  // (with a shake) instead of doing nothing, which was the actual bug:
  // users would tap Done, see no feedback, and assume Add was broken.
  const canConfirm = !busy;
  const handleConfirm = () => {
    if (busy) return;
    if (!isEarn && !category) { setCatError(true); return; }
    onConfirm({ image: image || null, category: isEarn ? null : category, note: note.trim() });
  };

  // Shared photo dropzone — used by both Earn (optional attach) and now
  // Spend (optional receipt/bill photo) so every money entry can carry
  // an image, same visual treatment either way.
  const photoDropzone = (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.dark, marginBottom: 6 }}>📷 Attach a photo (optional)</div>
      <motion.div
        whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
        style={{
          border: `1.5px dashed ${dragOver ? accent : image ? accent : "#ddd6c4"}`, borderRadius: 12, cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 6, padding: image ? 8 : 20, background: dragOver ? `${accent}14` : "rgba(255,255,255,0.5)",
        }}
      >
        {image ? (
          <img src={image} alt="attachment" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 8 }} />
        ) : busy ? (
          <span style={{ fontSize: 10, color: "#a39c86" }}>Reading photo…</span>
        ) : (
          <>
            <ImageIcon size={22} color="#c9c2ac" />
            <span style={{ fontSize: 9, color: "#a39c86", textAlign: "center" }}>{dragOver ? "Drop to attach" : isEarn ? "Tap or drag & drop an image with this earning" : "Tap or drag & drop a receipt / bill photo"}</span>
          </>
        )}
      </motion.div>
      {image && (
        <div onClick={() => setImage(null)} style={{ textAlign: "center", marginTop: 6, fontSize: 9, color: "#c0392b", cursor: "pointer", fontWeight: 700 }}>
          Remove photo
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{
        position: "absolute", inset: 0, background: "rgba(37,36,34,0.32)", zIndex: 75,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{
          width: "min(380px, 92vw)", maxHeight: "86vh", overflowY: "auto",
          background: "rgba(255,252,242,0.78)",
          backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.65)", borderRadius: 18,
          boxShadow: "0 30px 70px rgba(37,36,34,0.3), inset 0 1px 0 rgba(255,255,255,0.6)",
          padding: 18, position: "relative", boxSizing: "border-box",
        }}
        className="btl-scroll"
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: `${accent}18`, border: `1px solid ${accent}55`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {isEarn ? <ArrowUpCircle size={17} color={accent} /> : <ArrowDownCircle size={17} color={accent} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>{isEarn ? "Earn Money" : "Spend Money"}</div>
            <div style={{ fontSize: 9, color: "#8a8579" }}>{isEarn ? "Add today's income" : "Add today's expense"}</div>
          </div>
          <motion.div whileHover={{ scale: 1.15, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ marginLeft: "auto", cursor: "pointer", color: C.dark, flexShrink: 0 }}>
            <X size={16} />
          </motion.div>
        </div>

        <div style={{
          margin: "10px 0 14px", textAlign: "center", padding: "10px 0", borderRadius: 12,
          background: `${accent}12`, border: `1px solid ${accent}30`,
        }}>
          <div style={{ fontSize: 9, color: "#8a8579", fontWeight: 700 }}>{isEarn ? "Earning" : "Spending"}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: accent }}>₹{amount.toFixed(0)}</div>
        </div>

        {isEarn ? (
          photoDropzone
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: catError ? "#c0392b" : C.dark }}>
                Pick a category {!category && <span style={{ color: "#c0392b" }}>*</span>}
              </span>
            </div>
            <motion.div
              initial="hidden" animate={catError ? { x: [0, -6, 6, -4, 4, 0] } : "show"}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
              transition={catError ? { duration: 0.4 } : undefined}
              style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: catError ? 6 : 12,
                padding: 4, borderRadius: 12,
                border: catError ? "1.5px solid #c0392b" : "1.5px solid transparent",
              }}
            >
              {SPEND_CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <motion.div
                    key={c.key}
                    variants={{ hidden: { opacity: 0, y: 8, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }}
                    onClick={() => { setCategory(c.key); setCatError(false); }}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      padding: "9px 4px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${active ? c.color : "rgba(221,214,196,0.7)"}`,
                      background: active ? `${c.color}22` : "rgba(255,255,255,0.5)",
                    }}
                  >
                    <span style={{ fontSize: 17 }}>{c.emoji}</span>
                    <span style={{ fontSize: 8.5, fontWeight: active ? 900 : 700, color: active ? c.color : "#8a8579" }}>{c.label}</span>
                  </motion.div>
                );
              })}
            </motion.div>
            {catError && (
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "#c0392b", marginBottom: 10 }}>
                ⚠️ Ek category select karein, tabhi entry add hogi.
              </div>
            )}
            <div style={{ marginBottom: 12 }}>{photoDropzone}</div>
          </div>
        )}

        <textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Add a short note (optional)"
          style={{ width: "100%", minHeight: 38, maxHeight: 38, fontSize: 9.5, padding: 7, borderRadius: 8, border: "1px solid #ddd6c4", outline: "none", resize: "none", boxSizing: "border-box", marginBottom: 12, background: "rgba(255,255,255,0.6)" }}
        />

        <motion.button
          disabled={busy}
          onClick={handleConfirm}
          whileHover={!busy ? { y: -2 } : undefined}
          whileTap={!busy ? { scale: 0.96 } : undefined}
          style={{
            width: "100%", border: "none", borderRadius: 10, padding: "10px 0",
            background: busy ? "#ddd6c4" : accent, color: "#fff", fontSize: 12, fontWeight: 900,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {isEarn ? "Add Earning" : "Done"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- MONEY RESET — PASSWORD GATE (Glassmorphism 2.0 / Liquid Glass) ----------------
   Opens when "Reset" is tapped in Money Management. Wipes moneyEntries,
   moneyHistory and the life-time earn/spend totals — but only after the
   single supported password ("1000") is entered correctly. A wrong
   attempt shakes the card and shows an inline error instead of closing,
   so it can't be dismissed by accident. */
const RESET_PASSWORD = "1000";
function MoneyResetModal({ onClose, onConfirm }) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (pwd === RESET_PASSWORD) {
      setConfirming(true);
      // Tiny beat so the "verified" state is visible before the whole
      // popup unmounts — feels intentional rather than an instant snap.
      setTimeout(() => onConfirm(), 420);
    } else {
      setError(true);
      setShakeKey((k) => k + 1);
      setPwd("");
      inputRef.current?.focus();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{
        position: "absolute", inset: 0, background: "rgba(37,36,34,0.4)", zIndex: 85,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
      }}
      onClick={onClose}
    >
      <motion.div
        key={shakeKey}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={error
          ? { opacity: 1, scale: 1, y: 0, x: [0, -10, 10, -8, 8, -4, 4, 0] }
          : { opacity: 1, scale: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={error ? { x: { duration: 0.45, ease: "easeInOut" }, default: { type: "spring", stiffness: 320, damping: 26 } } : { type: "spring", stiffness: 320, damping: 26 }}
        style={{
          width: "min(340px, 90vw)",
          background: "rgba(255,252,242,0.8)",
          backdropFilter: "blur(24px) saturate(190%)", WebkitBackdropFilter: "blur(24px) saturate(190%)",
          border: `1px solid ${error ? "rgba(192,57,43,0.45)" : "rgba(255,255,255,0.65)"}`, borderRadius: 18,
          boxShadow: "0 30px 70px rgba(37,36,34,0.32), inset 0 1px 0 rgba(255,255,255,0.6)",
          padding: 20, position: "relative", boxSizing: "border-box",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 14 }}>
          <motion.div
            animate={confirming ? { scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] } : {}}
            style={{
              width: 46, height: 46, borderRadius: "50%", flexShrink: 0, marginBottom: 8,
              background: confirming ? "#4a7c5920" : "#c0392b18", border: `1px solid ${confirming ? "#4a7c5955" : "#c0392b45"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {confirming ? <ShieldCheck size={22} color="#4a7c59" /> : <Lock size={20} color="#c0392b" />}
          </motion.div>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>{confirming ? "Verified — resetting…" : "Reset Money Management"}</div>
          <div style={{ fontSize: 9.5, color: "#8a8579", marginTop: 2, maxWidth: 260 }}>
            {confirming ? "Clearing entries, history and totals." : "This wipes all Money Management data — earnings, spending, categories and totals. Enter the password to confirm."}
          </div>
        </div>

        {!confirming && (
          <>
            <div style={{ position: "relative", marginBottom: error ? 6 : 14 }}>
              <input
                ref={inputRef}
                type={show ? "text" : "password"}
                value={pwd}
                onChange={(e) => { setPwd(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Enter password"
                style={{
                  width: "100%", fontSize: 12, padding: "10px 34px 10px 12px", borderRadius: 10,
                  border: `1.5px solid ${error ? "#c0392b" : "#ddd6c4"}`, outline: "none", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.7)", color: C.dark, fontWeight: 700, letterSpacing: show ? 0 : 2,
                }}
              />
              <div onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#a39c86", display: "flex" }}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9.5, color: "#c0392b", fontWeight: 700, marginBottom: 12, overflow: "hidden" }}
                >
                  <AlertCircle size={12} /> Incorrect password — try again.
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: "flex", gap: 8, marginTop: error ? 0 : 4 }}>
              <motion.button
                onClick={onClose}
                whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                style={{ flex: 1, border: "1px solid #ddd6c4", background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "10px 0", fontSize: 11.5, fontWeight: 800, color: C.dark, cursor: "pointer" }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={submit}
                disabled={!pwd}
                whileHover={pwd ? { y: -1 } : undefined} whileTap={pwd ? { scale: 0.96 } : undefined}
                style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 11.5, fontWeight: 900, color: "#fff", cursor: pwd ? "pointer" : "not-allowed", background: pwd ? "#c0392b" : "#ddd6c4" }}
              >
                Reset
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ---------------- MONEY SUMMARY — day-by-day breakdown (large glass popup) ----------------
   Opened from Money Management's "Summary" button. Mirrors the Memories
   modal's date-sidebar layout, but focused purely on money: pick a date
   on the left, see every earn/spend entry logged that day on the right —
   amount, category or attached photo, and note — plus a day total strip.
   Reuses MemPhotoLightbox for full-screen photo viewing. */
function MoneySummaryModal({ state, onClose }) {
  const entries = state.moneyEntries || [];
  const dates = useMemo(() => {
    const set = new Set(entries.map((e) => e.date));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [entries]);
  const [selectedDate, setSelectedDate] = useState(dates[0] || todayISO());
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [dates.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayEntries = useMemo(() => entries.filter((e) => e.date === selectedDate), [entries, selectedDate]);
  const dayAgg = (state.moneyHistory && state.moneyHistory[selectedDate]) || { earn: 0, spend: 0 };
  const dayNet = (dayAgg.earn || 0) - (dayAgg.spend || 0);

  const handleRequestClose = () => {
    if (lightbox) { setLightbox(null); return; }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{
        position: "absolute", inset: 0, background: "rgba(37,36,34,0.32)", zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={handleRequestClose}>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          width: "min(960px, 95vw)", height: "min(640px, 88vh)",
          background: "rgba(255,252,242,0.72)",
          backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.65)", borderRadius: 20,
          boxShadow: "0 30px 80px rgba(37,36,34,0.28), inset 0 1px 0 rgba(255,255,255,0.6)",
          display: "flex", overflow: "hidden", position: "relative",
        }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)", zIndex: 1 }} />

        {/* ---------- SIDEBAR: date timeline ---------- */}
        <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.55)", display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.25)" }}>
          <div style={{ padding: "14px 14px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <ListChecks size={14} color={C.accent} />
            <span style={{ fontWeight: 900, fontSize: 13, color: C.dark }}>Summary</span>
            <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#9c9584", background: "rgba(255,255,255,0.6)", borderRadius: 999, padding: "2px 7px" }}>{dates.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px 10px" }} className="btl-scroll">
            {dates.length === 0 && (
              <div style={{ fontSize: 10, color: "#a39c88", padding: "10px 6px" }}>No money logged yet — use Add on the dashboard to record your first entry.</div>
            )}
            {dates.map((d, i) => {
              const agg = (state.moneyHistory && state.moneyHistory[d]) || { earn: 0, spend: 0 };
              const net = (agg.earn || 0) - (agg.spend || 0);
              const fmt = formatMemDate(d);
              const dayImgs = entries.filter((e) => e.date === d && e.image);
              return (
                <motion.div
                  key={d} onClick={() => setSelectedDate(d)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
                  whileHover={{ x: 2 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 10, cursor: "pointer",
                    marginBottom: 2, position: "relative",
                    background: d === selectedDate ? "rgba(255,255,255,0.85)" : "transparent",
                    boxShadow: d === selectedDate ? "0 3px 10px rgba(37,36,34,0.12)" : "none",
                  }}>
                  {d === selectedDate && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                      style={{ position: "absolute", inset: 0, borderRadius: 10, border: `1px solid ${C.accent}`, pointerEvents: "none" }} />
                  )}
                  <div style={{ width: 34, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: C.dark, lineHeight: 1 }}>{fmt.day}</div>
                    <div style={{ fontSize: 8, color: "#a39c88", textTransform: "uppercase" }}>{fmt.month}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: net >= 0 ? "#4a7c59" : "#c0392b" }}>{net >= 0 ? "+" : ""}₹{net.toFixed(0)} net</div>
                    <div style={{ fontSize: 8, color: "#a39c88" }}>{entries.filter((e) => e.date === d).length} {entries.filter((e) => e.date === d).length === 1 ? "entry" : "entries"}</div>
                  </div>
                  {dayImgs[0] && (
                    <img src={dayImgs[0].image} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.7)", flexShrink: 0 }} />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ---------- DETAIL PANE ---------- */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.55)", flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: C.dark }}>{formatMemDate(selectedDate).full}</div>
              <div style={{ fontSize: 10, color: "#8a8579" }}>{formatMemDate(selectedDate).weekday} · {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"} logged</div>
            </div>
            <motion.div whileHover={{ scale: 1.15, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={handleRequestClose} style={{ cursor: "pointer", color: C.dark }}>
              <X size={18} />
            </motion.div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px 18px" }} className="btl-scroll">
            {/* day total strip */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <MoneyStatCard label="Earned" value={dayAgg.earn || 0} color="#4a7c59" Icon={ArrowUpCircle} />
              <MoneyStatCard label="Spent" value={dayAgg.spend || 0} color="#c0392b" Icon={ArrowDownCircle} />
              <MoneyStatCard label="Net" value={dayNet} color={dayNet >= 0 ? "#4a7c59" : "#c0392b"} Icon={PiggyBank} />
            </div>

            {dayEntries.length === 0 ? (
              <MemEmptyState icon={Wallet} text="Nothing logged on this day." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayEntries.map((e, i) => {
                  const isEarn = e.type === "earn";
                  const cat = !isEarn ? spendCatInfo(e.category) : null;
                  return (
                    <motion.div
                      key={e.id || i}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 12,
                        background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)",
                      }}
                    >
                      {e.image ? (
                        <motion.img
                          src={e.image} alt="" onClick={() => setLightbox(e.image)}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                          style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, cursor: "zoom-in", border: "1px solid rgba(255,255,255,0.8)" }}
                        />
                      ) : (
                        <div style={{
                          width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          background: isEarn ? "#4a7c5918" : `${cat.color}22`, fontSize: isEarn ? undefined : 18,
                        }}>
                          {isEarn ? <ArrowUpCircle size={19} color="#4a7c59" /> : cat.emoji}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.dark }}>{isEarn ? "Earning" : cat.label}</div>
                        {e.note && <div style={{ fontSize: 9.5, color: "#8a8579", marginTop: 1 }}>{e.note}</div>}
                        <div style={{ fontSize: 8.5, color: "#a39c88", marginTop: 1 }}>{new Date(e.ts || Date.now()).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: isEarn ? "#4a7c59" : "#c0392b", flexShrink: 0 }}>
                        {isEarn ? "+" : "−"}₹{(e.amount || 0).toFixed(0)}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>{lightbox && <MemPhotoLightbox src={lightbox} onClose={() => setLightbox(null)} />}</AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- MONEY FILTER — glass popup (Glassmorphism 2.0 / Liquid Glass) ----------------
   Opened from Money Management's "Filter" button. Lets the person narrow
   the summary + activity list by:
     - Type: Earn Money / Spend Money (multi-select, at least one stays on)
     - Category: any of the 9 spend categories (multi-select, spend-only)
     - Date: quick presets or a custom From/To range
   Everything is staged in local `draft` state with a live "N entries
   match" count, and only committed to the parent (via onApply) when
   "Apply Filters" is tapped — Cancel/backdrop-click discards the draft. */
function MoneyFilterModal({ entries, filters, onApply, onClose }) {
  const [draft, setDraft] = useState({ ...filters, categories: [...filters.categories] });

  const toggleType = (t) => setDraft((d) => {
    const has = d.types.includes(t);
    if (has && d.types.length === 1) return d; // keep at least one type selected
    return { ...d, types: has ? d.types.filter((x) => x !== t) : [...d.types, t] };
  });
  const toggleCategory = (key) => setDraft((d) => ({
    ...d, categories: d.categories.includes(key) ? d.categories.filter((c) => c !== key) : [...d.categories, key],
  }));
  const setDateRange = (key) => setDraft((d) => ({ ...d, dateRange: key }));

  const matches = useMemo(() => filterMoneyEntries(entries, draft), [entries, draft]);
  const spendIncluded = draft.types.includes("spend");

  const handleApply = () => { onApply(draft); onClose(); };
  const handleClearAll = () => { onApply(DEFAULT_MONEY_FILTERS); onClose(); };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{
        position: "absolute", inset: 0, background: "rgba(37,36,34,0.36)", zIndex: 80,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{
          width: "min(460px, 92vw)", maxHeight: "86vh", display: "flex", flexDirection: "column",
          background: "rgba(255,252,242,0.8)",
          backdropFilter: "blur(24px) saturate(190%)", WebkitBackdropFilter: "blur(24px) saturate(190%)",
          border: "1px solid rgba(255,255,255,0.65)", borderRadius: 20,
          boxShadow: "0 30px 70px rgba(37,36,34,0.3), inset 0 1px 0 rgba(255,255,255,0.6)",
          position: "relative", boxSizing: "border-box", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)", zIndex: 1 }} />

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px", flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: `${C.accent}18`, border: `1px solid ${C.accent}55`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}><Filter size={16} color={C.accent} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>Filter Records</div>
            <div style={{ fontSize: 9, color: "#8a8579" }}>Narrow down by type, category & date</div>
          </div>
          <motion.div whileHover={{ scale: 1.15, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ marginLeft: "auto", cursor: "pointer", color: C.dark, flexShrink: 0 }}>
            <X size={16} />
          </motion.div>
        </div>

        {/* body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 4px" }} className="btl-scroll">
          {/* type */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.dark, marginBottom: 8 }}>Show</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ key: "earn", label: "Earn Money", Icon: ArrowUpCircle, color: "#4a7c59" }, { key: "spend", label: "Spend Money", Icon: ArrowDownCircle, color: "#c0392b" }].map((t) => {
                const active = draft.types.includes(t.key);
                return (
                  <motion.div
                    key={t.key} onClick={() => toggleType(t.key)}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 8px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${active ? t.color : "rgba(221,214,196,0.7)"}`,
                      background: active ? `${t.color}1c` : "rgba(255,255,255,0.5)",
                    }}
                  >
                    <t.Icon size={14} color={active ? t.color : "#a39c86"} />
                    <span style={{ fontSize: 10.5, fontWeight: active ? 900 : 700, color: active ? t.color : "#8a8579" }}>{t.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* category */}
          <div style={{ marginBottom: 16, opacity: spendIncluded ? 1 : 0.45, pointerEvents: spendIncluded ? "auto" : "none", transition: "opacity 160ms ease" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.dark }}>Spend category</div>
              <span style={{ fontSize: 8.5, color: "#a39c86", marginLeft: 6 }}>(spend entries only)</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span onClick={() => setDraft((d) => ({ ...d, categories: SPEND_CATEGORIES.map((c) => c.key) }))} style={{ fontSize: 9, fontWeight: 700, color: C.accent, cursor: "pointer" }}>Select all</span>
                <span onClick={() => setDraft((d) => ({ ...d, categories: [] }))} style={{ fontSize: 9, fontWeight: 700, color: "#a39c86", cursor: "pointer" }}>Clear</span>
              </div>
            </div>
            <motion.div
              initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.02 } } }}
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}
            >
              {SPEND_CATEGORIES.map((c) => {
                const active = draft.categories.includes(c.key);
                return (
                  <motion.div
                    key={c.key}
                    variants={{ hidden: { opacity: 0, y: 6, scale: 0.92 }, show: { opacity: 1, y: 0, scale: 1 } }}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }}
                    onClick={() => toggleCategory(c.key)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      padding: "8px 4px", borderRadius: 10, cursor: "pointer",
                      border: `1.5px solid ${active ? c.color : "rgba(221,214,196,0.7)"}`,
                      background: active ? `${c.color}22` : "rgba(255,255,255,0.5)",
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{c.emoji}</span>
                    <span style={{ fontSize: 8, fontWeight: active ? 900 : 700, color: active ? c.color : "#8a8579" }}>{c.label}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* date */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.dark, marginBottom: 8 }}>Date range</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DATE_PRESETS.map((p) => (
                <div key={p.key} onClick={() => setDateRange(p.key)} style={{
                  fontSize: 9.5, fontWeight: 800, padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                  background: draft.dateRange === p.key ? C.dark : "#f0ece0", color: draft.dateRange === p.key ? "#fff" : "#8a8579",
                }}>{p.label}</div>
              ))}
            </div>
            <AnimatePresence>
              {draft.dateRange === "custom" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 8.5, color: "#a39c86", marginBottom: 3, fontWeight: 700 }}>From</div>
                      <input type="date" value={draft.from} max={draft.to || undefined}
                        onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                        style={{ width: "100%", fontSize: 10.5, padding: "7px 8px", borderRadius: 8, border: "1px solid #ddd6c4", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.7)", color: C.dark }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 8.5, color: "#a39c86", marginBottom: 3, fontWeight: 700 }}>To</div>
                      <input type="date" value={draft.to} min={draft.from || undefined}
                        onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                        style={{ width: "100%", fontSize: 10.5, padding: "7px 8px", borderRadius: 8, border: "1px solid #ddd6c4", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.7)", color: C.dark }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", gap: 8, padding: "14px 20px 20px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.5)", marginTop: 8 }}>
          <motion.button
            onClick={handleClearAll}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
            style={{ border: "1px solid #ddd6c4", background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "10px 14px", fontSize: 11, fontWeight: 800, color: C.dark, cursor: "pointer" }}
          >
            Clear all
          </motion.button>
          <motion.button
            onClick={handleApply}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
            style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px 0", background: C.accent, color: "#fff", fontSize: 11.5, fontWeight: 900, cursor: "pointer" }}
          >
            Apply Filters · {matches.length} {matches.length === 1 ? "match" : "matches"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- CALENDAR WIDGET ----------------
   A real single-month calendar, drop-in as any other dashboard widget
   (draggable/resizable/hideable from the Layout tab, colorable from
   Theme → Widgets like the rest). Every day already logged as 100%
   complete in `state.completionHistory` gets an animated green
   checkmark badge; a partially-done day gets a soft amber fill.
   Month navigation is a pair of small chevrons + a "Today" link
   directly under the grid, with a spring slide transition between
   months (direction-aware) and a staggered pop-in for each day cell —
   all via framer-motion, already the project's animation library. */
const CALENDAR_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
function pad2(n) { return String(n).padStart(2, "0"); }
function localDateToISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function buildCalendarCells(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(startWeekday).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function CalendarDayCell({ day, iso, pct, isToday, isPast, index, fontSize, fontFamily, fontWeight, textColor }) {
  const done = typeof pct === "number" && pct >= 100;
  const partial = typeof pct === "number" && pct > 0 && pct < 100;
  const missed = isPast && !done; // day already ended without being finished — gets a "cut" mark
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.012, 0.3), type: "spring", stiffness: 420, damping: 24 }}
      whileHover={{ scale: 1.14, zIndex: 1 }}
      style={{
        position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 7, fontSize, fontWeight, fontFamily,
        background: done ? C.accent : partial ? "#fff3d6" : "transparent",
        color: done ? "#fff" : (textColor || C.text),
        boxShadow: isToday ? `inset 0 0 0 1.5px ${C.dark}` : "none",
        opacity: missed ? 0.62 : 1,
      }}
    >
      {day}
      {done && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 18, delay: Math.min(index * 0.012, 0.3) + 0.12 }}
          style={{
            position: "absolute", bottom: -3, right: -3, width: 11, height: 11, borderRadius: "50%",
            background: "#2e7d32", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 1.5px #fff",
          }}
        >
          <svg viewBox="0 0 20 20" width={7} height={7}>
            <motion.path
              d="M4 10.5 L8 14.5 L16 5.5" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.28, delay: Math.min(index * 0.012, 0.3) + 0.22 }}
            />
          </svg>
        </motion.div>
      )}
      {missed && (
        <motion.div
          initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 18, delay: Math.min(index * 0.012, 0.3) + 0.12 }}
          title="Day ended without finishing"
          style={{
            position: "absolute", bottom: -3, right: -3, width: 11, height: 11, borderRadius: "50%",
            background: "#c0392b", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 1.5px #fff",
          }}
        >
          <svg viewBox="0 0 20 20" width={7} height={7}>
            <motion.path
              d="M5 5 L15 15" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.012, 0.3) + 0.22 }}
            />
            <motion.path
              d="M15 5 L5 15" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.012, 0.3) + 0.32 }}
            />
          </svg>
        </motion.div>
      )}
    </motion.div>
  );
}
function CalendarWidget({ completionHistory, cardBg, textStyle }) {
  const ts = normalizeTextStyle(textStyle);
  const fontFamily = ts.font ? fontStackFor(ts.font) : undefined;
  const fontWeight = ts.bold ? 800 : 700;
  const textColor = ts.color || undefined;
  const titleFontSize = Math.round(11 * (1 + (ts.scale - 1) * 0.5));
  const monthFontSize = Math.round(9.5 * ts.scale);
  const weekdayFontSize = Math.round(8 * ts.scale);
  const dayFontSize = Math.round(9.5 * ts.scale);

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [dir, setDir] = useState(1);

  const goMonth = (delta) => {
    setDir(delta);
    setCursor((c) => {
      let m = c.month + delta, y = c.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  };
  const goToday = () => {
    setDir((today.getFullYear() > cursor.year || (today.getFullYear() === cursor.year && today.getMonth() > cursor.month)) ? 1 : -1);
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
  };

  const cells = useMemo(() => buildCalendarCells(cursor.year, cursor.month), [cursor]);
  const monthLabel = useMemo(() => new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }), [cursor]);
  const todayISO = localDateToISO(today);
  const todayMidnight = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()), [today]);
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const hist = completionHistory || {};

  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 8, padding: 10, background: cardBg || "#fff", width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: titleFontSize, fontWeight: 800, color: textColor || C.dark, fontFamily, display: "flex", alignItems: "center", gap: 5 }}><CalendarDays size={13} /> Calendar</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={monthLabel}
            initial={{ opacity: 0, x: dir >= 0 ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir >= 0 ? -8 : 8 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: monthFontSize, fontWeight: 800, color: textColor || "#8a8579", fontFamily }}
          >{monthLabel}</motion.span>
        </AnimatePresence>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, fontSize: weekdayFontSize, fontWeight: 800, color: textColor || "#b3ac99", fontFamily, textAlign: "center" }}>
        {CALENDAR_WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={`${cursor.year}-${cursor.month}`}
            custom={dir}
            initial={{ opacity: 0, x: dir >= 0 ? 26 : -26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir >= 0 ? -26 : 26 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, position: "absolute", inset: 0, alignContent: "start" }}
          >
            {cells.map((day, i) => {
              if (!day) return <div key={`blank-${i}`} />;
              const cellDate = new Date(cursor.year, cursor.month, day);
              const iso = localDateToISO(cellDate);
              return (
                <CalendarDayCell
                  key={iso} day={day} iso={iso} pct={hist[iso]} isToday={iso === todayISO}
                  isPast={cellDate < todayMidnight} index={i}
                  fontSize={dayFontSize} fontFamily={fontFamily} fontWeight={fontWeight} textColor={textColor}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* tiny prev/next month controls + Today shortcut, right under the grid */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, flexShrink: 0 }}>
        <motion.button
          whileHover={{ scale: 1.18 }} whileTap={{ scale: 0.85 }} onClick={() => goMonth(-1)} title="Previous month"
          style={{ border: "1px solid #ddd6c4", background: "#fff", borderRadius: "50%", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
        ><ChevronLeft size={8} color={C.dark} /></motion.button>
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={goToday} title="Jump to current month" disabled={isCurrentMonth}
          style={{ border: "none", background: "none", cursor: isCurrentMonth ? "default" : "pointer", padding: "0 2px", fontSize: 7.5, fontWeight: 800, color: isCurrentMonth ? "#d8d3c2" : "#8a8579" }}
        >Today</motion.button>
        <motion.button
          whileHover={{ scale: 1.18 }} whileTap={{ scale: 0.85 }} onClick={() => goMonth(1)} title="Next month"
          style={{ border: "1px solid #ddd6c4", background: "#fff", borderRadius: "50%", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
        ><ChevronRight size={8} color={C.dark} /></motion.button>
      </div>
    </div>
  );
}

/* ---------------- ANALYTICS SUMMARY (pinnable, customizable widget) ----------------
   Renders whichever metrics the user picked in Settings → Theme →
   Analytics Summary, in their chosen order — goal-completion rings,
   the day streak, and/or the money totals (Earned/Spent/Net). Each
   metric mounts/reorders/unmounts with a spring, via framer-motion's
   AnimatePresence + layout animations (popLayout mode keeps neighbors
   sliding smoothly into the freed/claimed space). */
function AnalyticsSummaryMetric({ meta, value }) {
  if (meta.type === "ring") {
    return <RingStat pct={value} label={meta.label} color={meta.color} />;
  }
  const Icon = meta.icon;
  const display = meta.type === "money"
    ? `${value < 0 ? "-" : ""}₹${Math.abs(Math.round(value))}`
    : String(Math.round(value)).padStart(3, "0");
  return (
    <div style={{ textAlign: "center", minWidth: 42 }}>
      <div style={{
        minWidth: 34, height: 34, borderRadius: meta.type === "money" ? 10 : "50%",
        background: meta.type === "money" ? "transparent" : C.dark,
        color: meta.type === "money" ? (meta.color || C.dark) : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
        fontSize: meta.type === "money" ? 12 : 12, fontWeight: 900, margin: "0 auto 2px", padding: "0 4px",
      }}>
        {meta.type === "money" && Icon && <Icon size={11} />}
        {display}
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#8a8579", whiteSpace: "nowrap" }}>{meta.label}</div>
    </div>
  );
}
function AnalyticsSummaryWidget({ state, onOpen, cardBg, metrics }) {
  const values = computeAnalyticsSummaryValues(state);
  const activeIds = metrics && metrics.length ? metrics : ANALYTICS_SUMMARY_DEFAULT_METRICS;
  const activeMetrics = activeIds.map(analyticsSummaryMetricMeta).filter(Boolean);
  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 8, padding: 10, background: cardBg || "#fff", width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark, display: "flex", alignItems: "center", gap: 5 }}><BarChart3 size={13} /> Analytics Summary</span>
        <Oval className="btl-oval-btn" onClick={onOpen} style={{ cursor: "pointer", fontSize: 9, padding: "2px 9px" }}>Open full <ChevronRight size={11} style={{ marginLeft: 2 }} /></Oval>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, flexWrap: "wrap", overflow: "hidden" }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {activeMetrics.map((meta) => (
            <motion.div
              key={meta.id} layout
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -10 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
            >
              <AnalyticsSummaryMetric meta={meta} value={values[meta.id]} />
            </motion.div>
          ))}
        </AnimatePresence>
        {!activeMetrics.length && (
          <span style={{ fontSize: 9, color: "#b3ac99", fontWeight: 700 }}>
            No metrics selected — pick some in Settings → Theme → Analytics Summary
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------- FREE-FORM RESIZE HANDLE ----------------
   Small "⋰"-style corner grip. Only rendered when the grid is in
   editable (Layout tab) mode. Pointer-driven — no extra drag library:
   pointerdown captures the pointer on the handle itself, pointermove
   computes the new width/height, pointerup commits it. */
function ResizeHandle({ onPointerDown, onPointerMove, onPointerUp }) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Drag to resize"
      style={{
        position: "absolute", right: 3, bottom: 3, width: 18, height: 18, zIndex: 5,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "nwse-resize", touchAction: "none",
        background: "rgba(255,255,255,0.92)", border: `1px solid ${C.text}`, borderRadius: 5,
        color: C.dark, boxShadow: "0 1px 4px rgba(37,36,34,0.15)",
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: "block", pointerEvents: "none" }}>
        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="9" y1="5" x2="5" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ---------------- FREE-FORM MOVE (REORDER) HANDLE ----------------
   Small grip in the top-left corner. Drag a widget over another one
   and drop to swap their order — pure pointer-event math, same
   pattern as the resize handle (no extra drag library). */
function MoveHandle({ onPointerDown, onPointerMove, onPointerUp, dragging }) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Drag to reorder"
      style={{
        position: "absolute", left: 3, top: 3, width: 20, height: 20, zIndex: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: dragging ? "grabbing" : "grab", touchAction: "none",
        background: "rgba(255,255,255,0.92)", border: `1px solid ${C.text}`, borderRadius: 5,
        color: C.dark, boxShadow: "0 1px 4px rgba(37,36,34,0.15)",
      }}
    >
      <Move size={11} style={{ pointerEvents: "none" }} />
    </div>
  );
}

/* ---------------- SINGLE RESIZABLE WIDGET TILE ----------------
   Wraps one widget in the grid. While `editable` (Layout tab), shows:
   - a corner ResizeHandle (bottom-right) you can drag: width snaps
     to the nearest grid column (out of GRID_COLS), height is
     free-form px clamped between MIN_WIDGET_H and MAX_WIDGET_H.
   - a MoveHandle (top-left) you can drag-and-drop directly onto
     another widget to reorder them (in addition to the reorder list
     above, in case the person would rather drag the actual widgets).
   Resize is live (the tile visibly grows/shrinks as you drag, other
   widgets reflow around it) and only commits to state.layout on
   pointerup, via onResize(id, {w,h}) / onDropOnto(draggedId, overId). */
function ResizableWidgetTile({ id, index, size, editable, gridRef, onResize, onDropOnto, children }) {
  const [liveSize, setLiveSize] = useState(null);  // live resize preview, null = not resizing
  const [dragPos, setDragPos] = useState(null);     // live reorder drag offset {x,y}, null = not dragging
  const resizeRef = useRef(null);
  const moveRef = useRef(null);
  const effective = liveSize || size;
  const interacting = !!liveSize || !!dragPos;

  /* ---- resize (bottom-right corner) ---- */
  const handleResizeDown = (e) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      startW: size.w, startH: size.h,
      containerWidth: rect.width,
    };
    setLiveSize({ ...size });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const handleResizeMove = (e) => {
    const d = resizeRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const deltaX = e.clientX - d.startX;
    const deltaY = e.clientY - d.startY;
    // Snap width to the nearest 1/GRID_COLS of the grid's pixel width.
    const rawFraction = d.startW / GRID_COLS + deltaX / d.containerWidth;
    const w = Math.min(GRID_COLS, Math.max(1, Math.round(rawFraction * GRID_COLS)));
    // Height stays free-form (px), just clamped to a sane range.
    const h = Math.min(MAX_WIDGET_H, Math.max(MIN_WIDGET_H, Math.round(d.startH + deltaY)));
    setLiveSize({ w, h });
  };
  const handleResizeUp = (e) => {
    const d = resizeRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    resizeRef.current = null;
    const final = liveSize || size;
    setLiveSize(null);
    onResize?.(id, final);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  /* ---- reorder (top-left corner — drag onto another widget to swap) ---- */
  const handleMoveDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    moveRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
    setDragPos({ x: 0, y: 0 });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const handleMoveMove = (e) => {
    const d = moveRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setDragPos({ x: e.clientX - d.startX, y: e.clientY - d.startY });
  };
  const handleMoveUp = (e) => {
    const d = moveRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    moveRef.current = null;
    const el = typeof document !== "undefined" ? document.elementFromPoint(e.clientX, e.clientY) : null;
    const overEl = el?.closest?.("[data-widget-id]");
    const overId = overEl?.getAttribute("data-widget-id");
    setDragPos(null);
    if (overId && overId !== id) onDropOnto?.(id, overId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <motion.div
      layout
      data-widget-id={id}
      initial={{ opacity: 0, y: 14, scaleY: 0.94 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      transition={interacting ? { duration: 0 } : { duration: 0.4, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      style={{
        gridColumn: `span ${effective.w}`, gridRow: `span ${rowSpanForHeight(effective.h)}`, height: effective.h,
        minWidth: 0, minHeight: 0, display: "flex", position: "relative", transformOrigin: "top center",
        outline: editable ? `1px dashed ${interacting ? C.accent : "rgba(64,61,57,0.25)"}` : "none",
        outlineOffset: 2, borderRadius: 8,
        x: dragPos ? dragPos.x : 0, y: dragPos ? dragPos.y : 0,
        zIndex: dragPos ? 30 : "auto",
        boxShadow: dragPos ? "0 14px 32px rgba(37,36,34,0.22)" : "none",
      }}
    >
      {children}
      {editable && (
        <>
          <MoveHandle onPointerDown={handleMoveDown} onPointerMove={handleMoveMove} onPointerUp={handleMoveUp} dragging={!!dragPos} />
          <ResizeHandle onPointerDown={handleResizeDown} onPointerMove={handleResizeMove} onPointerUp={handleResizeUp} />
        </>
      )}
    </motion.div>
  );
}

/* ---------------- CUSTOMIZABLE WIDGET GRID (drag-to-reorder + free-form resize) ----------------
   Reads state.layout.order / .sizes / .pinned and lays widgets out in
   a GRID_COLS-column CSS grid with row-dense auto-flow, so reordering
   the ids or changing a widget's size (column span + height) both
   just reflow naturally without any manual row math. Pass
   `editable` + `onResize` + `onReorder` to turn on the corner
   drag-to-resize / drag-and-drop-to-reorder handles (used in the
   Layout tab); omit them for the plain read-only dashboard view. */
function WidgetGrid({ layout, widgets, editable = false, onResize, onReorder }) {
  const gridRef = useRef(null);
  const visible = layout.order.filter((id) => {
    if (id === "analyticsSummary") return !!layout.pinned.analyticsSummary;
    return !(layout.hidden || {})[id];
  });

  const handleDropOnto = (draggedId, overId) => {
    if (!onReorder || draggedId === overId) return;
    const newOrder = layout.order.slice();
    const from = newOrder.indexOf(draggedId);
    const to = newOrder.indexOf(overId);
    if (from === -1 || to === -1) return;
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggedId);
    onReorder(newOrder);
  };

  return (
    <div
      ref={gridRef}
      style={{
        display: "grid", gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridAutoRows: `${ROW_UNIT}px`, gridAutoFlow: "row dense",
        gap: GRID_GAP, paddingBottom: 6,
      }}
    >
      {visible.map((id, i) => (
        <ResizableWidgetTile
          key={id}
          id={id}
          index={i}
          size={normalizeSize(layout.sizes[id])}
          editable={editable}
          gridRef={gridRef}
          onResize={onResize}
          onDropOnto={handleDropOnto}
        >
          {widgets[id]}
        </ResizableWidgetTile>
      ))}
    </div>
  );
}

/* ---------------- LAYOUT EDITOR (drag to reorder / pin, drag corners below to free-form resize) ---------------- */
function LayoutEditor({ layout, widgets, onChange, onReset, onClose }) {
  const [activeTextWidget, setActiveTextWidget] = useState(TEXT_STYLE_WIDGET_IDS[0]);
  const togglePin = (id) => onChange((l) => ({ ...l, pinned: { ...l.pinned, [id]: !l.pinned[id] } }));
  const toggleHidden = (id) => onChange((l) => ({ ...l, hidden: { ...(l.hidden || {}), [id]: !(l.hidden || {})[id] } }));
  const onWidgetResize = (id, size) => onChange((l) => ({ ...l, sizes: { ...l.sizes, [id]: normalizeSize(size) } }));
  const updateTextStyle = (patch) => onChange((l) => {
    const styles = normalizeTextStyles(l.textStyles);
    styles[activeTextWidget] = normalizeTextStyle({ ...styles[activeTextWidget], ...patch });
    return { ...l, textStyles: styles };
  });
  const resetTextStyle = () => onChange((l) => {
    const styles = normalizeTextStyles(l.textStyles);
    styles[activeTextWidget] = { ...DEFAULT_TEXT_STYLE };
    return { ...l, textStyles: styles };
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      style={{
        border: "1px solid rgba(255,255,255,0.6)", borderRadius: 14,
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(16px) saturate(160%)", WebkitBackdropFilter: "blur(16px) saturate(160%)",
        boxShadow: "0 12px 32px rgba(37,36,34,0.10)",
        display: "flex", flexDirection: "column", height: "100%",
      }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        borderBottom: "1px solid rgba(64,61,57,0.15)", background: "rgba(255,252,242,0.5)", borderRadius: "14px 14px 0 0",
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.dark, display: "flex", alignItems: "center", gap: 5 }}><LayoutGrid size={13} /> Customize Layout</span>
        <div style={{ flex: 1 }} />
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 1.06 }} onClick={onReset} title="Reset to default layout" style={{
          border: `1px solid ${C.text}`, background: C.bg, color: C.text, borderRadius: 999,
          padding: "3px 10px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10, fontWeight: 700,
        }}><RefreshCw size={11} /> Reset</motion.button>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 1.15 }} onClick={onClose} title="Done" style={{
          border: "none", borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><X size={13} color={C.dark} /></motion.button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }} className="btl-scroll">
        <div style={{ fontSize: 10, color: "#8a8579", marginBottom: 10, lineHeight: 1.4 }}>
          Drag <GripVertical size={10} style={{ verticalAlign: -1 }} /> to reorder widgets on your dashboard. Analytics
          Summary is hidden until you pin it.
        </div>
        <Reorder.Group
          axis="y" values={layout.order}
          onReorder={(newOrder) => onChange((l) => ({ ...l, order: newOrder }))}
          style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}
        >
          {layout.order.map((id) => {
            const w = WIDGETS.find((w) => w.id === id);
            if (!w) return null;
            const size = normalizeSize(layout.sizes[id]);
            const isAnalytics = id === "analyticsSummary";
            const isPinned = !!layout.pinned[id];
            const isHidden = !!(layout.hidden || {})[id];
            const shown = isAnalytics ? isPinned : !isHidden;
            const isTextStylable = TEXT_STYLE_WIDGET_IDS.includes(id);
            const isActiveText = isTextStylable && activeTextWidget === id;
            return (
              <Reorder.Item
                key={id} value={id}
                whileDrag={{ scale: 1.03, boxShadow: "0 10px 26px rgba(37,36,34,0.18)", cursor: "grabbing" }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: isActiveText ? "rgba(252,163,17,0.10)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${isActiveText ? C.accent : "#ece7d8"}`, borderRadius: 8,
                  listStyle: "none", opacity: shown ? 1 : 0.6,
                }}
              >
                <GripVertical size={14} style={{ color: "#b3ac99", cursor: "grab", flexShrink: 0 }} />
                {isTextStylable ? (
                  <motion.span
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTextWidget(id)}
                    title="Select to edit this widget's text style below"
                    style={{
                      fontSize: 11, fontWeight: 700, color: isActiveText ? C.accent : C.dark, flex: 1, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <Type size={10} style={{ opacity: isActiveText ? 1 : 0.35, flexShrink: 0 }} />
                    {w.label}
                  </motion.span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, flex: 1 }}>{w.label}</span>
                )}
                {isAnalytics ? (
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => togglePin(id)} title={isPinned ? "Unpin from dashboard" : "Pin to dashboard"} style={{
                    border: `1px solid ${isPinned ? C.accent : "#ddd6c4"}`, background: isPinned ? C.accent : "#fff",
                    color: isPinned ? "#fff" : "#8a8579", borderRadius: 999, padding: "3px 9px",
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
                  }}>
                    {isPinned ? <Pin size={11} /> : <PinOff size={11} />} {isPinned ? "Pinned" : "Not shown"}
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => toggleHidden(id)} title={isHidden ? "Show on dashboard" : "Hide from dashboard"} style={{
                    border: `1px solid ${isHidden ? "#ddd6c4" : C.accent}`, background: isHidden ? "#fff" : C.accent,
                    color: isHidden ? "#8a8579" : "#fff", borderRadius: 999, padding: "3px 9px",
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
                  }}>
                    {isHidden ? <EyeOff size={11} /> : <Eye size={11} />} {isHidden ? "Hidden" : "Visible"}
                  </motion.button>
                )}
                <span style={{
                  border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
                  padding: "3px 9px", fontSize: 9, fontWeight: 700, minWidth: 56, textAlign: "center",
                }}>{size.w}/{GRID_COLS} col · {size.h}px</span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <div style={{ fontSize: 10, color: "#8a8579", marginTop: 14, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 5 }}>
          <Type size={11} style={{ flexShrink: 0 }} />
          Tap a widget's name above (Big Goals, Life Rules, Daily/Entry Goals, Earn Money / Notes, Calendar) to select it, then style only that one below.
        </div>
        <TextStylePanel
          widgetLabel={WIDGETS.find((w) => w.id === activeTextWidget)?.label || ""}
          textStyle={(layout.textStyles || {})[activeTextWidget]}
          onChange={updateTextStyle}
          onReset={resetTextStyle}
        />

        <div style={{ fontSize: 10, color: "#8a8579", margin: "16px 0 8px", lineHeight: 1.4, display: "flex", alignItems: "center", gap: 5 }}>
          <Maximize2 size={11} style={{ flexShrink: 0 }} />
          Drag the <Move size={10} style={{ verticalAlign: -1 }} /> top-left grip and drop a widget onto another one to
          reorder them, or drag the ⋰ bottom-right corner to resize freely — width snaps to the grid, height is free-form (120–500px).
        </div>
        <WidgetGrid layout={layout} widgets={widgets} editable onResize={onWidgetResize} onReorder={(newOrder) => onChange((l) => ({ ...l, order: newOrder }))} />
      </div>
    </motion.div>
  );
}

/* ---------------- TEXT STYLE PANEL (font size / color / font / bold for widget text) ----------------
   Lives inside the Customize Layout tab. Click a widget's name in the
   reorder list above to make it "active"; this panel then edits only
   that widget's entry in state.layout.textStyles — each of the four
   text widgets (Life Big Goals, Life Rules, Daily Goals, Entry Goals)
   keeps its own independent size/color/font/bold, and switching the
   active widget switches which one these controls affect. Every widget
   applies its own scale to its own base sizes in JS (not a blanket CSS
   scale), so nested text never compounds the way a CSS em-chain would. */
function TextStylePanel({ widgetLabel, textStyle, onChange, onReset }) {
  const ts = normalizeTextStyle(textStyle);
  const scalePct = Math.round(ts.scale * 100);
  const isDefault = ts.scale === 1 && !ts.color && !ts.font && !ts.bold;
  const previewFamily = ts.font ? fontStackFor(ts.font) : "Inter, system-ui, sans-serif";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{
        marginTop: 14, border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        borderBottom: "1px solid #ece7d8", background: "rgba(255,252,242,0.6)",
      }}>
        <Type size={12} style={{ color: C.dark, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Text Style</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={widgetLabel}
            initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            style={{
              fontSize: 9, fontWeight: 700, color: C.accent, background: "rgba(252,163,17,0.14)",
              borderRadius: 999, padding: "2px 8px",
            }}
          >{widgetLabel}</motion.span>
        </AnimatePresence>
        <div style={{ flex: 1 }} />
        {!isDefault && (
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title={`Reset ${widgetLabel} text style`} style={{
            border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
            padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
          }}><RefreshCw size={10} /> Reset</motion.button>
        )}
      </div>

      <div style={{ padding: "10px 10px 12px" }}>
        {/* live preview */}
        <motion.div
          key={`${widgetLabel}-${scalePct}-${ts.color}-${ts.font}-${ts.bold}`}
          initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
          style={{
            border: "1px solid #ece7d8", borderRadius: 8, background: "#fff", padding: "10px 12px", marginBottom: 12,
          }}
        >
          <div style={{
            fontSize: Math.round(13 * ts.scale), fontWeight: ts.bold ? 800 : 700,
            color: ts.color || C.text, fontFamily: previewFamily, lineHeight: 1.4,
          }}>
            Become financially free
          </div>
          <div style={{ fontSize: 9, color: "#b3ac99", marginTop: 4 }}>Live preview — only {widgetLabel} will change</div>
        </motion.div>

        {/* font size */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <Baseline size={10} /> Font size
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}
              onClick={() => onChange({ scale: Math.max(TEXT_SCALE_MIN, Math.round((ts.scale - TEXT_SCALE_STEP) * 100) / 100) })}
              disabled={ts.scale <= TEXT_SCALE_MIN}
              title="Decrease text size"
              style={{
                border: `1px solid ${C.text}`, background: C.bg, color: C.text, borderRadius: 8, width: 26, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: ts.scale <= TEXT_SCALE_MIN ? "not-allowed" : "pointer",
                fontSize: 11, fontWeight: 900, opacity: ts.scale <= TEXT_SCALE_MIN ? 0.4 : 1, flexShrink: 0,
              }}
            >A-</motion.button>
            <div style={{ flex: 1, position: "relative", height: 6, background: "#ece7d8", borderRadius: 999 }}>
              <motion.div
                layout
                style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, background: C.accent,
                  width: `${((ts.scale - TEXT_SCALE_MIN) / (TEXT_SCALE_MAX - TEXT_SCALE_MIN)) * 100}%`,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
              />
            </div>
            <motion.button
              whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}
              onClick={() => onChange({ scale: Math.min(TEXT_SCALE_MAX, Math.round((ts.scale + TEXT_SCALE_STEP) * 100) / 100) })}
              disabled={ts.scale >= TEXT_SCALE_MAX}
              title="Increase text size"
              style={{
                border: `1px solid ${C.text}`, background: C.bg, color: C.text, borderRadius: 8, width: 26, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: ts.scale >= TEXT_SCALE_MAX ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 900, opacity: ts.scale >= TEXT_SCALE_MAX ? 0.4 : 1, flexShrink: 0,
              }}
            >A+</motion.button>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.dark, minWidth: 34, textAlign: "right", flexShrink: 0 }}>{scalePct}%</span>
          </div>
        </div>

        {/* bold */}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", display: "flex", alignItems: "center", gap: 4 }}>
            <Bold size={10} /> Bold text
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => onChange({ bold: !ts.bold })}
            title={ts.bold ? "Turn off bold" : "Turn on bold"}
            style={{
              border: "none", borderRadius: 999, width: 36, height: 20, padding: 2, cursor: "pointer",
              background: ts.bold ? C.accent : "#ddd6c4", display: "flex", justifyContent: ts.bold ? "flex-end" : "flex-start",
            }}
          >
            <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{
              width: 16, height: 16, borderRadius: "50%", background: "#fff", display: "block",
              boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            }} />
          </motion.button>
        </div>

        {/* font family */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <Type size={10} /> Font
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FONT_OPTIONS.map((f) => {
              const active = (ts.font || "") === f.id;
              return (
                <motion.button
                  key={f.id || "default"}
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
                  onClick={() => onChange({ font: f.id })}
                  title={f.label}
                  style={{
                    border: `1px solid ${active ? C.accent : "#ddd6c4"}`, background: active ? "#fff7ec" : "#fff",
                    color: active ? C.accent : C.text, borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 52,
                  }}
                >
                  <span style={{ fontFamily: f.stack, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{f.preview}</span>
                  <span style={{ fontSize: 8, fontWeight: 700 }}>{f.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* color */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <Palette size={10} /> Text color
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
            {TEXT_COLOR_OPTIONS.map((c) => {
              const active = (ts.color || "") === c.id;
              return (
                <motion.button
                  key={c.id || "default"}
                  whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                  onClick={() => onChange({ color: c.id })}
                  title={c.label}
                  style={{
                    width: 22, height: 22, borderRadius: "50%", cursor: "pointer", padding: 0,
                    background: c.id ? c.swatch : "#fff",
                    border: active ? `2px solid ${C.dark}` : "1px solid #ddd6c4",
                    boxShadow: active ? "0 0 0 2px rgba(37,36,34,0.12)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {!c.id && <X size={11} style={{ color: "#b3ac99" }} />}
                </motion.button>
              );
            })}
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }} title="Custom color">
              <span style={{
                width: 22, height: 22, borderRadius: "50%", overflow: "hidden", position: "relative",
                border: "1px solid #ddd6c4", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
                display: "inline-block",
              }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(ts.color) ? ts.color : "#403d39"}
                  onChange={(e) => onChange({ color: e.target.value })}
                  style={{ position: "absolute", inset: -4, width: 30, height: 30, border: "none", cursor: "pointer", opacity: 0.001 }}
                />
              </span>
              <span style={{ fontSize: 9, color: "#8a8579", fontWeight: 700 }}>Custom</span>
            </label>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   CUSTOM THEME (Settings → 🎨 Theme)
   Four scoped editors — Dashboard, Analytics, Widgets, Focus Mode —
   sharing the same swatch/stepper/toggle atoms as the Text Style panel
   above so the whole app feels like one design system. Dashboard only
   exposes background + text color (it's the app's overall chrome);
   Analytics and Focus Mode additionally get text size / font / bold,
   same controls as the per-widget Text Style feature; Widgets gets a
   background color swatch plus a Small/Medium/Large size preset per
   widget (fine-grained free-form resize is still available by dragging
   in the Layout tab — this is just a quick, no-drag alternative).
   ================================================================ */

/* Small circular swatch row, reused for both background and text color
   pickers across every scope — mirrors the "Text color" row already
   used in TextStylePanel above, generalized to take any option list. */
function ColorSwatchRow({ icon, label, options, value, onChange, defaultSwatchHex = "#403d39" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
        {options.map((c) => {
          const active = (value || "") === c.id;
          return (
            <motion.button
              key={c.id || "default"}
              whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
              onClick={() => onChange(c.id)}
              title={c.label}
              style={{
                width: 22, height: 22, borderRadius: "50%", cursor: "pointer", padding: 0,
                background: c.id ? c.swatch : "#fff",
                border: active ? `2px solid ${C.dark}` : "1px solid #ddd6c4",
                boxShadow: active ? "0 0 0 2px rgba(37,36,34,0.12)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {!c.id && <X size={11} style={{ color: "#b3ac99" }} />}
            </motion.button>
          );
        })}
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }} title="Custom color">
          <span style={{
            width: 22, height: 22, borderRadius: "50%", overflow: "hidden", position: "relative",
            border: "1px solid #ddd6c4", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
            display: "inline-block",
          }}>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : defaultSwatchHex}
              onChange={(e) => onChange(e.target.value)}
              style={{ position: "absolute", inset: -4, width: 30, height: 30, border: "none", cursor: "pointer", opacity: 0.001 }}
            />
          </span>
          <span style={{ fontSize: 9, color: "#8a8579", fontWeight: 700 }}>Custom</span>
        </label>
      </div>
    </div>
  );
}

/* One scope's full editor: preview card + background color + text color,
   and (for Analytics / Focus Mode) text size / bold / font too. */
function ScopeThemeEditor({ title, icon, value, onChange, onReset, includeTextControls }) {
  const v = normalizeScopeTheme(value);
  const isDefault = !v.bg && !v.text && (!includeTextControls || (!v.font && !v.bold && v.scale === 1));
  const previewFamily = v.font ? fontStackFor(v.font) : "Inter, system-ui, sans-serif";
  const scalePct = Math.round(v.scale * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        borderBottom: "1px solid #ece7d8", background: "rgba(255,252,242,0.6)",
      }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>{title}</span>
        <div style={{ flex: 1 }} />
        {!isDefault && (
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title={`Reset ${title} theme`} style={{
            border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
            padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
          }}><RefreshCw size={10} /> Reset</motion.button>
        )}
      </div>

      <div style={{ padding: "10px 10px 12px" }}>
        {/* live preview */}
        <motion.div
          key={`${title}-${v.bg}-${v.text}-${v.font}-${v.bold}-${scalePct}`}
          initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
          style={{
            border: "1px solid #ece7d8", borderRadius: 8, padding: "10px 12px", marginBottom: 12,
            background: v.bg || "#fff",
          }}
        >
          <div style={{
            fontSize: Math.round(13 * v.scale), fontWeight: v.bold ? 800 : 700,
            color: v.text || C.text, fontFamily: previewFamily, lineHeight: 1.4,
          }}>
            {title} preview
          </div>
          <div style={{ fontSize: 9, color: v.text ? v.text : "#b3ac99", opacity: v.text ? 0.7 : 1, marginTop: 4 }}>
            Only {title} will use this look
          </div>
        </motion.div>

        <ColorSwatchRow icon={<Palette size={10} />} label="Background color" options={BG_COLOR_OPTIONS} value={v.bg} onChange={(bg) => onChange({ bg })} defaultSwatchHex="#ffffff" />
        <ColorSwatchRow icon={<Baseline size={10} />} label="Text color" options={TEXT_COLOR_OPTIONS} value={v.text} onChange={(text) => onChange({ text })} />

        {includeTextControls && (
          <>
            {/* font size */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                <Baseline size={10} /> Text size
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <motion.button
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => onChange({ scale: Math.max(THEME_SCALE_MIN, Math.round((v.scale - THEME_SCALE_STEP) * 100) / 100) })}
                  disabled={v.scale <= THEME_SCALE_MIN}
                  title="Decrease text size"
                  style={{
                    border: `1px solid ${C.text}`, background: C.bg, color: C.text, borderRadius: 8, width: 26, height: 26,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: v.scale <= THEME_SCALE_MIN ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 900, opacity: v.scale <= THEME_SCALE_MIN ? 0.4 : 1, flexShrink: 0,
                  }}
                >A-</motion.button>
                <div style={{ flex: 1, position: "relative", height: 6, background: "#ece7d8", borderRadius: 999 }}>
                  <motion.div
                    layout
                    style={{
                      position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, background: C.accent,
                      width: `${((v.scale - THEME_SCALE_MIN) / (THEME_SCALE_MAX - THEME_SCALE_MIN)) * 100}%`,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  />
                </div>
                <motion.button
                  whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => onChange({ scale: Math.min(THEME_SCALE_MAX, Math.round((v.scale + THEME_SCALE_STEP) * 100) / 100) })}
                  disabled={v.scale >= THEME_SCALE_MAX}
                  title="Increase text size"
                  style={{
                    border: `1px solid ${C.text}`, background: C.bg, color: C.text, borderRadius: 8, width: 26, height: 26,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: v.scale >= THEME_SCALE_MAX ? "not-allowed" : "pointer",
                    fontSize: 12, fontWeight: 900, opacity: v.scale >= THEME_SCALE_MAX ? 0.4 : 1, flexShrink: 0,
                  }}
                >A+</motion.button>
                <span style={{ fontSize: 10, fontWeight: 800, color: C.dark, minWidth: 34, textAlign: "right", flexShrink: 0 }}>{scalePct}%</span>
              </div>
            </div>

            {/* bold */}
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", display: "flex", alignItems: "center", gap: 4 }}>
                <Bold size={10} /> Bold text
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => onChange({ bold: !v.bold })}
                title={v.bold ? "Turn off bold" : "Turn on bold"}
                style={{
                  border: "none", borderRadius: 999, width: 36, height: 20, padding: 2, cursor: "pointer",
                  background: v.bold ? C.accent : "#ddd6c4", display: "flex", justifyContent: v.bold ? "flex-end" : "flex-start",
                }}
              >
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} style={{
                  width: 16, height: 16, borderRadius: "50%", background: "#fff", display: "block",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                }} />
              </motion.button>
            </div>

            {/* font family */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
                <Type size={10} /> Font
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FONT_OPTIONS.map((f) => {
                  const active = (v.font || "") === f.id;
                  return (
                    <motion.button
                      key={f.id || "default"}
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
                      onClick={() => onChange({ font: f.id })}
                      title={f.label}
                      style={{
                        border: `1px solid ${active ? C.accent : "#ddd6c4"}`, background: active ? "#fff7ec" : "#fff",
                        color: active ? C.accent : C.text, borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 52,
                      }}
                    >
                      <span style={{ fontFamily: f.stack, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{f.preview}</span>
                      <span style={{ fontSize: 8, fontWeight: 700 }}>{f.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* Analytics tab — one custom color swatch per distinct colored element
   (header, Life Score badge, stat icons, Smart Insights, section
   headings, heatmap, mood line, Earn/Spend), on top of the scope-wide
   background/text/size/font/bold controls above. Every field defaults
   to "" (built-in look) until a color is picked. */
function AnalyticsColorsEditor({ value, onChange, onReset }) {
  const v = normalizeAnalyticsColors(value);
  const isDefault = ANALYTICS_ELEMENT_COLOR_FIELDS.every((f) => !v[f.key]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        borderBottom: "1px solid #ece7d8", background: "rgba(255,252,242,0.6)",
      }}>
        <Palette size={12} style={{ color: C.dark }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Element colors</span>
        <div style={{ flex: 1 }} />
        {!isDefault && (
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title="Reset element colors" style={{
            border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
            padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
          }}><RefreshCw size={10} /> Reset</motion.button>
        )}
      </div>
      <div style={{ padding: "10px 10px 12px" }}>
        <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 10, lineHeight: 1.4 }}>
          Pick a custom color for any piece of text or accent inside the Analytics &amp; Insights panel —
          each one below is independent of the others.
        </div>
        {ANALYTICS_ELEMENT_COLOR_FIELDS.map((f) => (
          <ColorSwatchRow
            key={f.key}
            icon={<Baseline size={10} />}
            label={f.label}
            options={TEXT_COLOR_OPTIONS}
            value={v[f.key]}
            onChange={(hex) => onChange(f.key, hex)}
            defaultSwatchHex={f.defaultHex}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* Same pattern as AnalyticsColorsEditor, for the Money Management tab. */
function MoneyColorsEditor({ value, onChange, onReset }) {
  const v = normalizeMoneyColors(value);
  const isDefault = MONEY_ELEMENT_COLOR_FIELDS.every((f) => !v[f.key]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        borderBottom: "1px solid #ece7d8", background: "rgba(255,252,242,0.6)",
      }}>
        <Palette size={12} style={{ color: C.dark }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Element colors</span>
        <div style={{ flex: 1 }} />
        {!isDefault && (
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title="Reset element colors" style={{
            border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
            padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
          }}><RefreshCw size={10} /> Reset</motion.button>
        )}
      </div>
      <div style={{ padding: "10px 10px 12px" }}>
        <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 10, lineHeight: 1.4 }}>
          Pick a custom color for any card, chart series or activity accent inside Money Management —
          each one below is independent of the others.
        </div>
        {MONEY_ELEMENT_COLOR_FIELDS.map((f) => (
          <ColorSwatchRow
            key={f.key}
            icon={<Baseline size={10} />}
            label={f.label}
            options={TEXT_COLOR_OPTIONS}
            value={v[f.key]}
            onChange={(hex) => onChange(f.key, hex)}
            defaultSwatchHex={f.defaultHex}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* Per-widget background color + Small/Medium/Large size preset list. */
function WidgetsThemeEditor({ widgetThemes, layoutSizes, onWidgetChange, onWidgetReset, onWidgetSize }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        borderBottom: "1px solid #ece7d8", background: "rgba(255,252,242,0.6)",
      }}>
        <LayoutGrid size={12} style={{ color: C.dark }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Widgets — color &amp; size</span>
      </div>
      <div style={{ padding: "6px 10px 10px" }}>
        <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 8, lineHeight: 1.5 }}>
          Pick a background color and a size preset per widget. For pixel-precise sizing, drag a widget's corner in the <b>Layout</b> tab instead.
        </div>
        {WIDGETS.map((w) => {
          const wt = widgetThemes?.[w.id] || { bg: "" };
          const size = normalizeSize(layoutSizes?.[w.id]);
          const sizeKey = size.w <= 2 ? "sm" : size.w >= 5 ? "lg" : "md";
          return (
            <div key={w.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
              borderBottom: "1px solid #f0ece0", flexWrap: "wrap",
            }}>
              <span style={{ flex: 1, minWidth: 90, fontSize: 10, fontWeight: 800, color: C.dark }}>{w.label}</span>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {WIDGET_COLOR_OPTIONS.map((c) => {
                  const active = (wt.bg || "") === c.id;
                  return (
                    <motion.button
                      key={c.id || "default"} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={() => onWidgetChange(w.id, { bg: c.id })} title={c.label}
                      style={{
                        width: 16, height: 16, borderRadius: "50%", padding: 0, cursor: "pointer",
                        background: c.id ? c.swatch : "#fff",
                        border: active ? `2px solid ${C.dark}` : "1px solid #ddd6c4",
                      }}
                    >{!c.id && <X size={9} style={{ color: "#b3ac99" }} />}</motion.button>
                  );
                })}
                <label style={{ cursor: "pointer" }} title="Custom color">
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%", display: "inline-block", position: "relative",
                    overflow: "hidden", border: "1px solid #ddd6c4",
                    background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
                  }}>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(wt.bg) ? wt.bg : "#ffffff"}
                      onChange={(e) => onWidgetChange(w.id, { bg: e.target.value })}
                      style={{ position: "absolute", inset: -6, width: 26, height: 26, border: "none", cursor: "pointer", opacity: 0.001 }}
                    />
                  </span>
                </label>
              </div>
              <select
                value={sizeKey}
                onChange={(e) => onWidgetSize(w.id, e.target.value)}
                style={{
                  fontSize: 9, fontWeight: 700, border: "1px solid #ddd6c4", borderRadius: 6,
                  padding: "3px 5px", background: "#fff", color: C.text, cursor: "pointer",
                }}
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
              {wt.bg && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => onWidgetReset(w.id)} title="Reset color" style={{
                  border: "none", background: "none", cursor: "pointer", color: "#b3ac99", display: "flex", alignItems: "center",
                }}><RefreshCw size={11} /></motion.button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* Analytics Summary — metric picker. A live preview (the exact same
   AnalyticsSummaryWidget rendered on the dashboard) sits on top, an
   Reorder.Group of active metrics (drag the grip to reorder, tap X to
   remove) below it, and a row of "+ add" pills for whatever's left —
   every add/remove/reorder ripples into the preview immediately via
   framer-motion layout animations. */
function AnalyticsSummaryThemeEditor({ state, metrics, onChange, onReset }) {
  const activeIds = metrics && metrics.length ? metrics : ANALYTICS_SUMMARY_DEFAULT_METRICS;
  const activeMetrics = activeIds.map(analyticsSummaryMetricMeta).filter(Boolean);
  const inactiveMetrics = ANALYTICS_SUMMARY_METRICS.filter((m) => !activeIds.includes(m.id));
  const isDefault = activeIds.length === ANALYTICS_SUMMARY_DEFAULT_METRICS.length
    && activeIds.every((id, i) => id === ANALYTICS_SUMMARY_DEFAULT_METRICS[i]);

  const handleReorder = (newOrder) => onChange(newOrder.map((m) => m.id));
  const handleRemove = (id) => onChange(activeIds.filter((x) => x !== id));
  const handleAdd = (id) => onChange([...activeIds, id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        borderBottom: "1px solid #ece7d8", background: "rgba(255,252,242,0.6)",
      }}>
        <BarChart3 size={12} style={{ color: C.dark }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Analytics Summary — metrics</span>
        <div style={{ flex: 1 }} />
        {!isDefault && (
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title="Reset Analytics Summary metrics" style={{
            border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
            padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
          }}><RefreshCw size={10} /> Reset</motion.button>
        )}
      </div>

      <div style={{ padding: "10px" }}>
        <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 10, lineHeight: 1.5 }}>
          Add or remove what shows in the Analytics Summary widget — goal-completion rings, streak, and now the money
          totals too. Drag the grip to reorder.
        </div>

        {/* Live preview — the exact widget shown on the dashboard */}
        <div style={{ height: 100, marginBottom: 12 }}>
          <AnalyticsSummaryWidget state={state} onOpen={() => {}} metrics={activeIds} />
        </div>

        {/* Active metrics — drag to reorder, X to remove */}
        <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", marginBottom: 5 }}>Showing ({activeMetrics.length})</div>
        {activeMetrics.length ? (
          <Reorder.Group axis="y" values={activeMetrics} onReorder={handleReorder} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            <AnimatePresence initial={false}>
              {activeMetrics.map((m) => (
                <Reorder.Item
                  key={m.id} value={m}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12, height: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  whileDrag={{ scale: 1.03, boxShadow: "0 4px 14px rgba(37,36,34,0.15)" }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                    border: "1px solid #ece7d8", borderRadius: 8, background: "#fff", cursor: "grab",
                  }}
                >
                  <GripVertical size={12} style={{ color: "#c7c1ae", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.dark, flex: 1 }}>{m.label}</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: "#8a8579", textTransform: "uppercase",
                    background: "#f4f1e8", borderRadius: 5, padding: "1px 5px",
                  }}>{m.type === "ring" ? "goal %" : m.type === "money" ? "money" : "streak"}</span>
                  <motion.button
                    whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                    onClick={() => handleRemove(m.id)} title={`Remove ${m.label}`}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#b3ac99", display: "flex", padding: 2 }}
                  ><X size={12} /></motion.button>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <div style={{ fontSize: 9, color: "#b3ac99", fontStyle: "italic", padding: "6px 2px" }}>Nothing selected — add a metric below.</div>
        )}

        {/* Inactive metrics — tap + to add */}
        {!!inactiveMetrics.length && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#8a8579", margin: "12px 0 5px" }}>Add a metric</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <AnimatePresence initial={false}>
                {inactiveMetrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <motion.button
                      key={m.id} layout
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ type: "spring", stiffness: 380, damping: 26 }}
                      whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }}
                      onClick={() => handleAdd(m.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9.5, fontWeight: 800,
                        padding: "5px 10px", borderRadius: 999, border: "1px dashed #ddd6c4",
                        background: "rgba(255,255,255,0.6)", color: C.text,
                      }}
                    ><Plus size={11} /> {Icon && <Icon size={11} style={{ color: m.color }} />} {m.label}</motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* Top-level Theme tab shown inside Settings — five sub-sections. */
function ThemePanel({ state, theme, layoutSizes, onScopeChange, onScopeReset, onWidgetChange, onWidgetReset, onWidgetSize, onAnalyticsSummaryChange, onAnalyticsSummaryReset, onAnalyticsColorChange, onAnalyticsColorReset, onMoneyColorChange, onMoneyColorReset }) {
  const [section, setSection] = useState("dashboard");
  const t = normalizeTheme(theme);
  const SECTIONS = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutGrid size={10} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={10} /> },
    { key: "widgets", label: "Widgets", icon: <Palette size={10} /> },
    { key: "analyticsSummary", label: "Analytics Summary", icon: <PiggyBank size={10} /> },
    { key: "money", label: "Money Management", icon: <Wallet size={10} /> },
    { key: "focusMode", label: "Focus Mode", icon: <Target size={10} /> },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {SECTIONS.map((s) => (
          <motion.button
            key={s.key} whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
            onClick={() => setSection(s.key)}
            style={{
              display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, fontWeight: 800,
              padding: "5px 11px", borderRadius: 999,
              border: `1px solid ${section === s.key ? C.accent : C.text}`,
              background: section === s.key ? C.accent : "rgba(255,255,255,0.6)",
              color: section === s.key ? "#fff" : C.text,
            }}
          >{s.icon} {s.label}</motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {section === "dashboard" && (
          <ScopeThemeEditor
            key="dashboard" title="Dashboard" icon={<LayoutGrid size={12} style={{ color: C.dark }} />}
            value={t.dashboard} onChange={(p) => onScopeChange("dashboard", p)} onReset={() => onScopeReset("dashboard")}
            includeTextControls={false}
          />
        )}
        {section === "analytics" && (
          <div key="analytics" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ScopeThemeEditor
              title="Analytics" icon={<BarChart3 size={12} style={{ color: C.dark }} />}
              value={t.analytics} onChange={(p) => onScopeChange("analytics", p)} onReset={() => onScopeReset("analytics")}
              includeTextControls={true}
            />
            <AnalyticsColorsEditor
              value={t.analyticsColors}
              onChange={(key, hex) => onAnalyticsColorChange(key, hex)}
              onReset={onAnalyticsColorReset}
            />
          </div>
        )}
        {section === "widgets" && (
          <WidgetsThemeEditor
            key="widgets" widgetThemes={t.widgets} layoutSizes={layoutSizes}
            onWidgetChange={onWidgetChange} onWidgetReset={onWidgetReset} onWidgetSize={onWidgetSize}
          />
        )}
        {section === "analyticsSummary" && (
          <AnalyticsSummaryThemeEditor
            key="analyticsSummary" state={state} metrics={t.analyticsSummary.metrics}
            onChange={onAnalyticsSummaryChange} onReset={onAnalyticsSummaryReset}
          />
        )}
        {section === "money" && (
          <div key="money" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ScopeThemeEditor
              title="Money Management" icon={<Wallet size={12} style={{ color: C.dark }} />}
              value={t.money} onChange={(p) => onScopeChange("money", p)} onReset={() => onScopeReset("money")}
              includeTextControls={true}
            />
            <MoneyColorsEditor
              value={t.moneyColors}
              onChange={(key, hex) => onMoneyColorChange(key, hex)}
              onReset={onMoneyColorReset}
            />
          </div>
        )}
        {section === "focusMode" && (
          <ScopeThemeEditor
            key="focusMode" title="Focus Mode" icon={<Target size={12} style={{ color: C.dark }} />}
            value={t.focusMode} onChange={(p) => onScopeChange("focusMode", p)} onReset={() => onScopeReset("focusMode")}
            includeTextControls={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================
   MEMORIES — a proper "memory book" popup.
   Click "memor" and see, per date: which goals you finished, how
   much you earned/spent, which photos you added and whatever notes
   you wrote — all in a tabbed, glassy, animated panel.
   ================================================================ */

function formatMemDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return {
    day: d.toLocaleDateString(undefined, { day: "2-digit" }),
    month: d.toLocaleDateString(undefined, { month: "short" }),
    weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
    full: d.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" }),
  };
}

function collectMemoryDates(state) {
  const set = new Set([
    ...Object.keys(state.completionHistory || {}),
    ...Object.keys(state.moneyHistory || {}),
    ...Object.keys(state.moodLog || {}),
    ...Object.keys(state.dailyLogs || {}),
    ...(state.memories || []).map((m) => m.date),
  ]);
  return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // newest first
}

function getMemDaySummary(state, date) {
  const log = (state.dailyLogs && state.dailyLogs[date]) || {};
  const money = (state.moneyHistory && state.moneyHistory[date]) || { earn: 0, spend: 0 };
  const pct = state.completionHistory ? state.completionHistory[date] : undefined;
  const mood = state.moodLog ? state.moodLog[date] : undefined;
  return {
    date, pct, mood,
    earn: money.earn || 0,
    spend: money.spend || 0,
    completedDaily: (log.completedGoals && log.completedGoals.daily) || [],
    completedExtry: (log.completedGoals && log.completedGoals.extry) || [],
    images: log.images || [],
    dayNotes: log.notes || "",
    memoryNotes: (state.memories || []).filter((m) => m.date === date),
  };
}

function MoodGlyph({ mood, size = 12 }) {
  if (mood === "happy") return <Smile size={size} color="#4a7c59" />;
  if (mood === "neutral") return <Meh size={size} color="#b08a3e" />;
  if (mood === "sad") return <Frown size={size} color="#c0392b" />;
  return null;
}

function MemEmptyState({ icon: Icon, text, compact }) {
  return (
    <div style={{ textAlign: "center", padding: compact ? "8px 0" : "36px 0", color: "#b3ac99" }}>
      <Icon size={compact ? 15 : 26} style={{ marginBottom: 6, opacity: 0.6 }} />
      <div style={{ fontSize: 10 }}>{text}</div>
    </div>
  );
}

function MemDateRow({ date, active, onClick, summary, index }) {
  const fmt = formatMemDate(date);
  const hasPhoto = summary.images.length > 0;
  const net = (summary.earn || 0) - (summary.spend || 0);
  const hasMoney = summary.earn > 0 || summary.spend > 0;
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 12) * 0.02 }}
      whileHover={{ x: 2 }}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 10, cursor: "pointer",
        marginBottom: 2, position: "relative",
        background: active ? "rgba(255,255,255,0.85)" : "transparent",
        boxShadow: active ? "0 3px 10px rgba(37,36,34,0.12)" : "none",
      }}>
      {active && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          style={{ position: "absolute", inset: 0, borderRadius: 10, border: `1px solid ${C.accent}`, pointerEvents: "none" }} />
      )}
      <div style={{ width: 34, textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: C.dark, lineHeight: 1 }}>{fmt.day}</div>
        <div style={{ fontSize: 8, color: "#a39c88", textTransform: "uppercase" }}>{fmt.month}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.dark, display: "flex", alignItems: "center", gap: 4 }}>
          {Math.round(summary.pct || 0)}% goals <MoodGlyph mood={summary.mood} size={10} />
        </div>
        {hasMoney && (
          <div style={{ fontSize: 8, color: net >= 0 ? "#4a7c59" : "#c0392b" }}>{net >= 0 ? "+" : ""}₹{net.toFixed(0)} net</div>
        )}
      </div>
      {hasPhoto && (
        <img src={summary.images[summary.images.length - 1]} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.7)", flexShrink: 0 }} />
      )}
    </motion.div>
  );
}

function GoalGroup({ title, color, items }) {
  if (!items.length) return null;
  return (
    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: "inline-block" }} />
        {title} ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((g, i) => (
          <motion.div key={g.id || i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: "6px 9px", border: "1px solid rgba(255,255,255,0.7)" }}>
            <CheckCircle2 size={13} color="#4a7c59" style={{ flexShrink: 0 }} />
            {g.icon && <span>{g.icon}</span>}
            <span style={{ color: C.dark, textDecoration: "line-through", textDecorationColor: "#c9c2ac" }}>{g.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
function MemGoalsPanel({ summary }) {
  if (!summary.completedDaily.length && !summary.completedExtry.length) {
    return <MemEmptyState icon={CheckCircle2} text="No goals were checked off on this day." />;
  }
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <GoalGroup title="Daily Goals" color={C.accent} items={summary.completedDaily} />
      <GoalGroup title="Extry Goals" color={C.blue} items={summary.completedExtry} />
    </div>
  );
}

function MoneyStatCard({ label, value, color, Icon }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}
      style={{ flex: 1, background: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, padding: 10, textAlign: "center" }}>
      <Icon size={14} color={color} style={{ marginBottom: 4 }} />
      <div style={{ fontSize: 15, fontWeight: 900, color }}>₹{value.toFixed(0)}</div>
      <div style={{ fontSize: 9, color: "#8a8579" }}>{label}</div>
    </motion.div>
  );
}
function BarRow({ label, value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 2 }}>{label}</div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.5)", overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
function MemMoneyEntryRow({ entry, index, onOpenPhoto }) {
  const isEarn = entry.type === "earn";
  const cat = !isEarn ? spendCatInfo(entry.category) : null;
  const color = isEarn ? "#4a7c59" : "#c0392b";
  const Icon = isEarn ? ArrowUpCircle : ArrowDownCircle;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      whileHover={{ x: 2, boxShadow: "0 6px 16px rgba(37,36,34,0.1)" }}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12,
        background: "rgba(255,255,255,0.62)", border: "1px solid rgba(255,255,255,0.7)",
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}18`,
      }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>
          {isEarn ? "Earning" : cat ? `${cat.emoji} ${cat.label}` : "Spend"}
        </div>
        {entry.note ? (
          <div style={{ fontSize: 9.5, color: "#8a8579", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.note}</div>
        ) : null}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 900, color, flexShrink: 0 }}>{isEarn ? "+" : "-"}₹{Number(entry.amount).toFixed(0)}</div>
      {entry.image ? (
        <motion.img
          src={entry.image} alt=""
          onClick={() => onOpenPhoto(entry.image)}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", cursor: "zoom-in", flexShrink: 0, border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 3px 8px rgba(37,36,34,0.16)" }}
        />
      ) : null}
    </motion.div>
  );
}

function MemMoneyPanel({ summary, entries, onOpenPhoto }) {
  const { earn, spend } = summary;
  if (!earn && !spend) return <MemEmptyState icon={Wallet} text="No money logged on this day." />;
  const max = Math.max(earn, spend, 1);
  const net = earn - spend;
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <MoneyStatCard label="Earned" value={earn} color="#4a7c59" Icon={TrendingUp} />
        <MoneyStatCard label="Spent" value={spend} color="#c0392b" Icon={TrendingDown} />
        <MoneyStatCard label="Net" value={net} color={net >= 0 ? "#4a7c59" : "#c0392b"} Icon={Wallet} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: entries.length ? 16 : 0 }}>
        <BarRow label="Earned" value={earn} max={max} color="#4a7c59" />
        <BarRow label="Spent" value={spend} max={max} color="#c0392b" />
      </div>
      {entries.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#8a8579", marginBottom: 6 }}>Where it went ({entries.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e, i) => <MemMoneyEntryRow key={e.id || i} entry={e} index={i} onOpenPhoto={onOpenPhoto} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* Lightweight pseudo-3D tilt: no extra 3D library needed — a live
   mousemove → rotateX/rotateY spring gives photos real depth + a
   glassy glare sweep, matching the rest of the app's "liquid glass" feel. */
function MemTiltPhoto({ src, onClick, index }) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  return (
    <motion.div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setTilt({ rx: py * -16, ry: px * 16 });
      }}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, rotateX: tilt.rx, rotateY: tilt.ry }}
      transition={{ rotateX: { type: "spring", stiffness: 260, damping: 18 }, rotateY: { type: "spring", stiffness: 260, damping: 18 }, opacity: { delay: index * 0.03 }, scale: { delay: index * 0.03 } }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: "relative", width: "100%", aspectRatio: "1", borderRadius: 12, overflow: "hidden",
        cursor: "zoom-in", boxShadow: "0 8px 20px rgba(37,36,34,0.18)",
        border: "1px solid rgba(255,255,255,0.65)",
      }}>
      <img src={src} alt="memory" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(140deg, rgba(255,255,255,0.35), transparent 45%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(37,36,34,0.55)", borderRadius: 6, padding: 3, display: "flex", pointerEvents: "none" }}>
        <ZoomIn size={11} color="#fff" />
      </div>
    </motion.div>
  );
}
function MemPhotosPanel({ summary, onOpen }) {
  if (!summary.images.length) return <MemEmptyState icon={Camera} text="No photos saved for this day yet." />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
      {summary.images.map((src, i) => (
        <MemTiltPhoto key={i} src={src} index={i} onClick={() => onOpen(src)} />
      ))}
    </div>
  );
}
function MemPhotoLightbox({ src, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, background: "rgba(20,19,17,0.8)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 20 }}
      onClick={onClose}>
      <motion.img
        src={src} alt="memory full"
        initial={{ scale: 0.85, opacity: 0, rotate: -1 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "84%", maxHeight: "80%", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }} />
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        <motion.a whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} href={src} download="btl-memory.jpg" onClick={(e) => e.stopPropagation()}
          style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, display: "flex", color: "#fff" }}><Download size={16} /></motion.a>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
          style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, display: "flex", color: "#fff", cursor: "pointer" }}><X size={16} /></motion.div>
      </div>
    </motion.div>
  );
}

function MemNotesPanel({ summary, memInput, setMemInput, onSubmit }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 200 }}>
      {summary.dayNotes && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#8a8579", marginBottom: 4 }}>Notes saved that day</div>
          <div style={{ fontSize: 11, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" }}>{summary.dayNotes}</div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#8a8579", marginBottom: 4 }}>Memories ({summary.memoryNotes.length})</div>
        {summary.memoryNotes.length === 0 && !summary.dayNotes && (
          <MemEmptyState icon={StickyNote} text="Nothing written for this day yet." compact />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {summary.memoryNotes.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              style={{ fontSize: 11, background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.7)" }}>
              {m.text}
            </motion.div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <input value={memInput} onChange={(e) => setMemInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Write a memory for this day..."
          style={{ flex: 1, fontSize: 11, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd6c4", background: "rgba(255,255,255,0.75)", outline: "none" }} />
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.93 }} onClick={onSubmit}
          style={{ border: "none", background: C.dark, color: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
          Add
        </motion.button>
      </div>
    </div>
  );
}

const MEM_TABS = [
  { key: "goals", label: "Goals", icon: CheckCircle2 },
  { key: "money", label: "Money", icon: Wallet },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "notes", label: "Notes", icon: StickyNote },
];

function MemoriesModal({ state, onAddMemory, onClose }) {
  const dates = useMemo(() => collectMemoryDates(state), [state.completionHistory, state.moneyHistory, state.moodLog, state.dailyLogs, state.memories]);
  const [selectedDate, setSelectedDate] = useState(dates[0] || todayISO());
  const [tabKey, setTabKey] = useState("goals");
  const [lightbox, setLightbox] = useState(null);
  const [memInput, setMemInput] = useState("");

  useEffect(() => {
    if (dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [dates.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => getMemDaySummary(state, selectedDate), [state, selectedDate]);
  const dayMoneyEntries = useMemo(
    () => (state.moneyEntries || []).filter((e) => e.date === selectedDate),
    [state.moneyEntries, selectedDate]
  );
  const fmt = formatMemDate(selectedDate);
  const counts = {
    goals: summary.completedDaily.length + summary.completedExtry.length,
    money: dayMoneyEntries.length || ((summary.earn || summary.spend) ? 1 : 0),
    photos: summary.images.length,
    notes: summary.memoryNotes.length + (summary.dayNotes ? 1 : 0),
  };

  const submitMemory = () => {
    if (!memInput.trim()) return;
    onAddMemory(selectedDate, memInput.trim());
    setMemInput("");
  };

  // Bug fix: closing used to be wired to the backdrop click AND the header
  // "X" both calling onClose() directly, regardless of whether the photo
  // lightbox was still open/mid-animation on top of it. If a user clicked
  // outside the card while a photo was open, the whole modal (and its
  // nested AnimatePresence for the lightbox) got yanked out of the DOM in
  // the middle of an animation — framer-motion never got to finish/clean
  // up that transition, which left the app in a broken, unresponsive state.
  // Fix: always close the lightbox first; only close the whole modal once
  // nothing is still animating on top of it.
  const handleRequestClose = () => {
    if (lightbox) { setLightbox(null); return; }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{
        position: "absolute", inset: 0, background: "rgba(37,36,34,0.32)", zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={handleRequestClose}>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{
          width: "min(960px, 95vw)", height: "min(640px, 88vh)",
          background: "rgba(255,252,242,0.72)",
          backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.65)", borderRadius: 20,
          boxShadow: "0 30px 80px rgba(37,36,34,0.28), inset 0 1px 0 rgba(255,255,255,0.6)",
          display: "flex", overflow: "hidden", position: "relative",
        }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)", zIndex: 1 }} />

      {/* ---------- SIDEBAR: date timeline ---------- */}
      <div style={{ width: 220, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.55)", display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.25)" }}>
        <div style={{ padding: "14px 14px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Sparkles size={14} color={C.accent} />
          <span style={{ fontWeight: 900, fontSize: 13, color: C.dark }}>Memories</span>
          <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "#9c9584", background: "rgba(255,255,255,0.6)", borderRadius: 999, padding: "2px 7px" }}>{dates.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px 10px" }} className="btl-scroll">
          {dates.length === 0 && (
            <div style={{ fontSize: 10, color: "#a39c88", padding: "10px 6px" }}>No memories yet — finish a goal, log money, or add a photo today.</div>
          )}
          {dates.map((d, i) => (
            <MemDateRow key={d} date={d} index={i} active={d === selectedDate} onClick={() => { setSelectedDate(d); setTabKey("goals"); }} summary={getMemDaySummary(state, d)} />
          ))}
        </div>
      </div>

      {/* ---------- DETAIL PANE ---------- */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.55)", flexShrink: 0 }}>
          <RingStat pct={summary.pct || 0} size={44} label="" sub="" color={C.accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: C.dark, display: "flex", alignItems: "center", gap: 6 }}>
              {fmt.full} <MoodGlyph mood={summary.mood} size={14} />
            </div>
            <div style={{ fontSize: 10, color: "#8a8579" }}>{fmt.weekday} · {Math.round(summary.pct || 0)}% of goals done</div>
          </div>
          <motion.div whileHover={{ scale: 1.15, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={handleRequestClose} style={{ cursor: "pointer", color: C.dark }}>
            <X size={18} />
          </motion.div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "8px 14px 0", flexShrink: 0 }}>
          {MEM_TABS.map((t) => {
            const Icon = t.icon;
            const active = tabKey === t.key;
            const count = counts[t.key];
            return (
              <div key={t.key} onClick={() => setTabKey(t.key)}
                style={{ position: "relative", padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Icon size={12} color={active ? C.dark : "#a39c88"} />
                <span style={{ fontSize: 10.5, fontWeight: 800, color: active ? C.dark : "#a39c88" }}>{t.label}</span>
                {count > 0 && (
                  <span style={{ fontSize: 8, fontWeight: 800, color: active ? "#fff" : C.dark, background: active ? C.accent : "rgba(64,61,57,0.12)", borderRadius: 999, padding: "1px 5px" }}>{count}</span>
                )}
                {active && (
                  <motion.div initial={{ opacity: 0, scaleX: 0.5 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.18 }}
                    style={{ position: "absolute", left: 8, right: 8, bottom: 0, height: 2, borderRadius: 2, background: C.accent, transformOrigin: "center" }} />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px 18px" }} className="btl-scroll">
          <motion.div key={tabKey + selectedDate} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
            {tabKey === "goals" && <MemGoalsPanel summary={summary} />}
            {tabKey === "money" && <MemMoneyPanel summary={summary} entries={dayMoneyEntries} onOpenPhoto={setLightbox} />}
            {tabKey === "photos" && <MemPhotosPanel summary={summary} onOpen={setLightbox} />}
            {tabKey === "notes" && <MemNotesPanel summary={summary} memInput={memInput} setMemInput={setMemInput} onSubmit={submitMemory} />}
          </motion.div>
        </div>
      </div>

        <AnimatePresence>{lightbox && <MemPhotoLightbox src={lightbox} onClose={() => setLightbox(null)} />}</AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ================================================================
   LIFE STORY — full-screen daily journal tab (this update)
   Data lives at state.lifeStory = { profile: {name,image}|null, entries: { "YYYY-MM-DD": { text, images:[dataUrl,...] } } }
   Built with framer-motion (already a project dependency) for every
   animation/glass effect here — no new npm installs for GSAP / Locomotive
   Scroll / Lottie / three.js etc. Say the word if you want one of those
   wired in for a specific effect elsewhere.
   ================================================================ */

/* 90 emoji so the "@" picker always clears the "80+" ask with room to spare. */
const LIFE_STORY_EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","🥰","😘","😎","🤩",
  "🥳","😇","🙂","😉","😌","😴","🤔","😅","😭","😢",
  "😡","😱","🥺","😤","🤯","😬","🙄","😏","😴","🤗",
  "👍","👎","👏","🙏","💪","🤝","🙌","👋","✌️","🤞",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💯",
  "🔥","✨","⭐","🌟","💫","🎉","🎊","🎈","🏆","🥇",
  "☀️","🌤️","⛅","🌧️","⛈️","🌈","🌙","🌊","🌸","🌻",
  "☕","🍵","🍕","🍔","🍎","🍫","🥗","🍰","🎂","🍿",
  "📚","✍️","💼","💻","📱","🎧","🎵","🎬","📷","🚗",
  "✈️","🏠","🏋️","🧘","🚶","🏃","🛌","💤","🎯","🚀",
];

/* Theme customization for the Life Story journal — settings gear next to
   "filters". Lives at state.lifeStory.theme = { fontFamily, fontSize,
   textColor, bgColor, presetId }. Defaults match the app's normal look
   (cream page, dark text) so nobody sees a change until they open Theme. */
const LIFE_STORY_DEFAULT_THEME = {
  presetId: "classic",
  fontFamily: "inherit",
  fontSize: 13,
  bold: false,
  textColor: C.text,
  bgColor: "linear-gradient(180deg, #fbf9f2, #f5f2e8)",
};

/* 10 curated presets — swatch shows page bg + text color together so it's
   obvious what you're picking. "Midnight" is the "black paper, white text"
   look asked for; the rest give real variety rather than near-duplicates. */
const LIFE_STORY_THEME_PRESETS = [
  { id: "classic", name: "Classic", bg: "linear-gradient(180deg, #fbf9f2, #f5f2e8)", text: C.text, swatchBg: "#f5f2e8" },
  { id: "midnight", name: "Midnight", bg: "linear-gradient(180deg, #1a1a1a, #0d0d0d)", text: "#f2f2f2", swatchBg: "#101010" },
  { id: "sepia", name: "Sepia", bg: "linear-gradient(180deg, #f4ecd8, #e9dcc0)", text: "#4a3826", swatchBg: "#e9dcc0" },
  { id: "ocean", name: "Ocean", bg: "linear-gradient(180deg, #eaf5fb, #d7ecf6)", text: "#0f3f56", swatchBg: "#d7ecf6" },
  { id: "sunset", name: "Sunset", bg: "linear-gradient(180deg, #fff1e6, #ffe0cc)", text: "#7a3410", swatchBg: "#ffe0cc" },
  { id: "forest", name: "Forest", bg: "linear-gradient(180deg, #eef6ee, #dcedd4)", text: "#1f4a2b", swatchBg: "#dcedd4" },
  { id: "rose", name: "Rose", bg: "linear-gradient(180deg, #fdeef2, #fbdce4)", text: "#7a1f3d", swatchBg: "#fbdce4" },
  { id: "lavender", name: "Lavender", bg: "linear-gradient(180deg, #f3eefc, #e6daf7)", text: "#3c2a63", swatchBg: "#e6daf7" },
  { id: "slate", name: "Slate", bg: "linear-gradient(180deg, #eceff2, #dde2e8)", text: "#2b3542", swatchBg: "#dde2e8" },
  { id: "mono", name: "Pure Mono", bg: "#ffffff", text: "#111111", swatchBg: "#ffffff" },
];

/* 12 fonts — a spread of web-safe serif/sans/mono/script stacks so no new
   font files need loading (no extra npm installs / <link> tags). */
const LIFE_STORY_FONTS = [
  { id: "inherit", label: "Default", stack: "inherit" },
  { id: "system", label: "System Sans", stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { id: "times", label: "Times New Roman", stack: "'Times New Roman', Times, serif" },
  { id: "garamond", label: "Garamond", stack: "Garamond, 'Palatino Linotype', serif" },
  { id: "palatino", label: "Palatino", stack: "'Palatino Linotype', Palatino, serif" },
  { id: "bookman", label: "Bookman", stack: "'Bookman Old Style', serif" },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "trebuchet", label: "Trebuchet MS", stack: "'Trebuchet MS', sans-serif" },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma, Geneva, sans-serif" },
  { id: "courier", label: "Courier (typewriter)", stack: "'Courier New', Courier, monospace" },
  { id: "comic", label: "Comic Sans", stack: "'Comic Sans MS', 'Comic Sans', cursive" },
];

/* Computes where a textarea's caret sits in pixels, relative to the
   textarea's own top-left corner — used to anchor the "@" mention
   popover right next to the cursor instead of a fixed spot. Standard
   mirror-div technique: clone the textarea's text-affecting styles onto
   an invisible div, drop a marker span at the caret, measure it. */
function getCaretCoordinates(el) {
  const div = document.createElement("div");
  const style = window.getComputedStyle(el);
  const props = [
    "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
    "textTransform", "wordSpacing", "textIndent",
  ];
  props.forEach((p) => { div.style[p] = style[p]; });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.width = el.clientWidth + "px";
  div.style.top = "0px";
  div.style.left = "-9999px";
  document.body.appendChild(div);
  const caretPos = el.selectionStart || 0;
  div.textContent = el.value.substring(0, caretPos);
  const span = document.createElement("span");
  span.textContent = el.value.substring(caretPos) || ".";
  div.appendChild(span);
  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft - el.scrollLeft;
  document.body.removeChild(div);
  return { top, left };
}

/* Glass "@" popover: emoji grid + add-photo shortcut, positioned right
   next to the caret. Framer-motion spring in/out for that "glassic" feel. */
function LifeStoryMentionPopover({ pos, onPickEmoji, onAddPhoto, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 6 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      style={{
        position: "absolute", top: pos.top, left: Math.min(pos.left, 300), zIndex: 60, width: 250,
        background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.8)", borderRadius: 14, boxShadow: "0 16px 40px rgba(37,36,34,0.28)", padding: 10,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <motion.button
        whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={onAddPhoto}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, border: "1px solid #ece7d8", background: "rgba(255,255,255,0.7)",
          borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 800, color: C.dark, cursor: "pointer", marginBottom: 8,
        }}
      ><Camera size={13} /> Add photo to today</motion.button>
      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 4 }}>EMOJI</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2, maxHeight: 150, overflowY: "auto" }}>
        {LIFE_STORY_EMOJIS.map((em, i) => (
          <motion.span
            key={i} whileHover={{ scale: 1.3 }} whileTap={{ scale: 0.9 }}
            onClick={() => onPickEmoji(em)}
            style={{ fontSize: 16, textAlign: "center", cursor: "pointer", borderRadius: 6, lineHeight: "26px" }}
          >{em}</motion.span>
        ))}
      </div>
    </motion.div>
  );
}

/* Floating selection toolbar — appears right above whatever text you
   highlight inside today's entry, so you can Bold / Italic / Underline
   or recolor just that word/sentence without opening the page-wide
   Theme settings. Uses document.execCommand, same approach already used
   for paste-as-plain-text above, applied only to the current selection. */
const SELECTION_TOOLBAR_COLORS = ["#403d39", "#e63946", "#fca311", "#2a9d8f", "#3d5a80", "#7b2cbf", "#ffffff"];

function LifeStorySelectionToolbar({ pos, onBold, onItalic, onUnderline, onColor, activeColorPickRef }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 6 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      style={{
        position: "absolute", top: pos.top, left: pos.left, transform: "translate(-50%, -100%)", zIndex: 70,
        display: "flex", alignItems: "center", gap: 4,
        background: "rgba(37,36,34,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, boxShadow: "0 10px 28px rgba(0,0,0,0.35)", padding: "5px 6px",
        whiteSpace: "nowrap",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onMouseDown={(e) => { e.preventDefault(); onBold(); }}
        style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      ><Bold size={12} /></motion.button>
      <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onMouseDown={(e) => { e.preventDefault(); onItalic(); }}
        style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      ><Italic size={12} /></motion.button>
      <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onMouseDown={(e) => { e.preventDefault(); onUnderline(); }}
        style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      ><Underline size={12} /></motion.button>

      <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.18)", margin: "0 2px" }} />

      {SELECTION_TOOLBAR_COLORS.map((c) => (
        <motion.span
          key={c} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onMouseDown={(e) => { e.preventDefault(); onColor(c); }}
          style={{ width: 15, height: 15, borderRadius: "50%", background: c, border: c === "#ffffff" ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}
        />
      ))}
      <label style={{ width: 15, height: 15, borderRadius: "50%", background: "conic-gradient(red,orange,yellow,green,blue,violet,red)", cursor: "pointer", display: "block", position: "relative" }}>
        <input
          ref={activeColorPickRef} type="color" onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => onColor(e.target.value)}
          style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }}
        />
      </label>
    </motion.div>
  );
}

/* Full-screen photo viewer for a story image — back button top-right,
   delete on the image itself, same dark-blur recipe as MemPhotoLightbox. */
function LifeStoryLightbox({ src, onClose, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(20,19,17,0.86)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "86%", maxHeight: "82%" }}
      >
        <img src={src} alt="story" style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", display: "block" }} />
        <motion.button
          whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
          onClick={() => { onDelete(); onClose(); }}
          title="Delete this photo"
          style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(192,57,43,0.85)", border: "none", borderRadius: 8, padding: 8, color: "#fff", cursor: "pointer", display: "flex" }}
        ><Trash2 size={15} /></motion.button>
      </motion.div>
      <motion.div
        whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose}
        style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, color: "#fff", cursor: "pointer", display: "flex" }}
      ><X size={16} /></motion.div>
    </motion.div>
  );
}

/* First-time-use popup: name + avatar upload, glassmorphism entrance. */
function LifeStoryProfileSetup({ onSave }) {
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const fileRef = useRef(null);
  const pickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeImageDataUrl(file, 360, 0.8).then(setImage).catch(() => alert("Couldn't read that image, try another one."));
    e.target.value = "";
  };
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,19,17,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 10 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        style={{
          width: 320, background: "rgba(255,255,255,0.75)", backdropFilter: "blur(24px) saturate(190%)", WebkitBackdropFilter: "blur(24px) saturate(190%)",
          border: "1px solid rgba(255,255,255,0.85)", borderRadius: 20, boxShadow: "0 30px 70px rgba(37,36,34,0.35)", padding: 24, textAlign: "center",
        }}
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 300 }} style={{ fontSize: 30, marginBottom: 4 }}>📖</motion.div>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>Start your Life Story</div>
        <div style={{ fontSize: 10.5, color: "#8a8579", marginTop: 3, marginBottom: 16 }}>A little profile before your first entry — you can change this later.</div>

        <motion.div
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => fileRef.current?.click()}
          style={{
            width: 84, height: 84, borderRadius: "50%", margin: "0 auto 14px", cursor: "pointer", position: "relative",
            background: image ? `url(${image}) center/cover` : "rgba(255,255,255,0.6)",
            border: `2px dashed ${image ? "transparent" : C.text}`, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {!image && <User size={26} color="#a39c86" />}
          <div style={{ position: "absolute", bottom: -2, right: -2, background: C.dark, borderRadius: "50%", padding: 6, display: "flex", boxShadow: "0 3px 8px rgba(0,0,0,0.3)" }}>
            <Camera size={12} color="#fff" />
          </div>
        </motion.div>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />

        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
          style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd6c4", background: "rgba(255,255,255,0.8)", outline: "none", marginBottom: 14, textAlign: "center", fontWeight: 700, color: C.dark }}
        />

        <motion.button
          whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), image })}
          style={{
            width: "100%", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 13, fontWeight: 900,
            background: name.trim() ? C.dark : "#cfc9b8", color: "#fff", cursor: name.trim() ? "pointer" : "not-allowed",
          }}
        >Start Writing →</motion.button>
      </motion.div>
    </motion.div>
  );
}

function formatStoryDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

/* One day's block in the feed: date pill + card. Only the entry for
   `isToday` is editable — everything before it is a settled, read-only
   page of the journal. */
/* Builds the actual DOM node for an inline photo chip — a small clickable
   camera glyph sized to match the surrounding text (font-size: 1em), so it
   sits inline exactly where "@" was typed instead of floating below. */
function buildStoryChipNode(idx) {
  const span = document.createElement("span");
  span.setAttribute("data-story-chip", "1");
  span.setAttribute("data-idx", String(idx));
  span.setAttribute("contenteditable", "false");
  span.style.cssText = "display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:1em;line-height:1;vertical-align:-0.15em;padding:0 1px;user-select:none;";
  span.textContent = "📷";
  return span;
}

/* Removes the "@" that triggered the popover, then inserts `node` right at
   the caret and leaves the cursor immediately after it so typing continues
   naturally on the same line. */
function insertAtCaretRemovingTrigger(editableEl, node) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let range = sel.getRangeAt(0).cloneRange();
  if (!editableEl.contains(range.startContainer)) return false;
  range.collapse(true);
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    range.setStart(range.startContainer, range.startOffset - 1);
    range.deleteContents();
  }
  range.insertNode(node);
  const spacer = document.createTextNode("\u00A0");
  node.after(spacer);
  range = document.createRange();
  range.setStartAfter(spacer);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  editableEl.focus();
  return true;
}

/* One day's block in the feed: date pill + card. Only the entry for
   `isToday` is editable — everything before it is a settled, read-only
   page of the journal. Story text is a contentEditable div (not a plain
   textarea) so an inline 📷 chip can sit exactly where you typed "@" and
   still be clickable to open that photo — nothing gets pushed below the
   text or shown as a separate thumbnail strip. */
function LifeStoryDayBlock({ iso, entry, isToday, theme, onChangeHtml, onAddImage, onRemoveImage, blockRef }) {
  const t = theme || LIFE_STORY_DEFAULT_THEME;
  const isDark = /^#/.test(t.textColor) && (() => {
    const hex = t.textColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  })();
  const [mention, setMention] = useState(null); // { top, left } | null
  const [selToolbar, setSelToolbar] = useState(null); // { top, left } | null
  const fileRef = useRef(null);
  const editableRef = useRef(null);
  const savedRangeRef = useRef(null);
  const selRangeRef = useRef(null); // last non-collapsed selection, for the color-picker (native picker steals focus)
  const colorInputRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // index into images
  const images = entry?.images || [];
  const initialHtml = useRef(entry?.html || "");

  useEffect(() => {
    if (editableRef.current) editableRef.current.innerHTML = initialHtml.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shows the floating Bold/Italic/Underline/Color toolbar right above
  // whatever's highlighted inside today's entry. Ignores selections
  // outside this block (e.g. dragging over other day cards).
  const updateSelectionToolbar = () => {
    if (!isToday) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editableRef.current || !editableRef.current.contains(sel.anchorNode)) {
      setSelToolbar(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { setSelToolbar(null); return; }
    const parentRect = editableRef.current.getBoundingClientRect();
    selRangeRef.current = range.cloneRange();
    setSelToolbar({ top: rect.top - parentRect.top - 10, left: rect.left - parentRect.left + rect.width / 2 });
  };

  useEffect(() => {
    if (!isToday) return;
    document.addEventListener("selectionchange", updateSelectionToolbar);
    return () => document.removeEventListener("selectionchange", updateSelectionToolbar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);

  const restoreSelectionRange = () => {
    if (!selRangeRef.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(selRangeRef.current);
  };

  const runCmd = (cmd, val) => {
    restoreSelectionRange();
    document.execCommand(cmd, false, val);
    onChangeHtml(editableRef.current.innerHTML);
    updateSelectionToolbar();
  };
  const applyBold = () => runCmd("bold");
  const applyItalic = () => runCmd("italic");
  const applyUnderline = () => runCmd("underline");
  const applyColor = (color) => runCmd("foreColor", color);

  const caretRectRelativeToEditable = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    const parentRect = editableRef.current.getBoundingClientRect();
    return { top: rect.top - parentRect.top + rect.height, left: rect.left - parentRect.left };
  };

  const handleInput = () => {
    onChangeHtml(editableRef.current.innerHTML);
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editableRef.current.contains(sel.anchorNode)) {
      const probe = document.createRange();
      probe.selectNodeContents(editableRef.current);
      probe.setEnd(sel.focusNode, sel.focusOffset);
      const textBefore = probe.toString();
      if (textBefore.endsWith("@")) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        const pos = caretRectRelativeToEditable();
        if (pos) setMention(pos);
      } else if (mention) {
        setMention(null);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const pickEmoji = (em) => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    insertAtCaretRemovingTrigger(editableRef.current, document.createTextNode(em));
    setMention(null);
    onChangeHtml(editableRef.current.innerHTML);
  };

  const openAddPhoto = () => { setMention(null); fileRef.current?.click(); };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) { alert("Please pick an image file."); return; }
    const idx = images.length;
    resizeImageDataUrl(file, 640, 0.75).then((dataUrl) => {
      onAddImage(dataUrl);
      if (savedRangeRef.current) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
      insertAtCaretRemovingTrigger(editableRef.current, buildStoryChipNode(idx));
      onChangeHtml(editableRef.current.innerHTML);
    }).catch(() => alert("Couldn't read that image, try another one."));
  };

  const handleChipClick = (e) => {
    const chip = e.target.closest("[data-story-chip]");
    if (chip) setLightbox(Number(chip.dataset.idx));
  };

  return (
    <div ref={blockRef} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, color: isToday ? "#fff" : C.dark,
          background: isToday ? C.accent : "rgba(255,255,255,0.75)", border: `1px solid ${isToday ? C.accent : "#ece7d8"}`,
          borderRadius: 999, padding: "5px 14px", boxShadow: isToday ? "0 4px 14px rgba(252,163,17,0.35)" : "none",
        }}>
          <CalendarDays size={11} /> {formatStoryDate(iso)} {isToday && "· Today"}
        </span>
      </div>

      <motion.div
        style={{
          position: "relative", borderRadius: 18, padding: 2, backgroundSize: "300% 300%",
          background: isDark
            ? "linear-gradient(120deg, #fca311, rgba(255,255,255,0.25), #fca311, #98c1d9, #fca311)"
            : "linear-gradient(120deg, #fca311, #ffe3b8, #fca311, #98c1d9, #fca311)",
          boxShadow: isToday ? "0 6px 22px rgba(252,163,17,0.28)" : "0 2px 10px rgba(37,36,34,0.06)",
        }}
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: isToday ? 5 : 9, repeat: Infinity, ease: "linear" }}
      >
        <div style={{ position: "relative", background: isDark ? "rgba(20,20,20,0.94)" : "rgba(255,255,255,0.92)", borderRadius: 16, padding: 14 }}>
          {isToday ? (
            <div
              ref={editableRef}
              className="life-story-editable"
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onPaste={handlePaste}
              onClick={handleChipClick}
              data-placeholder="Write today's story... type @ for emoji & photos"
              style={{ width: "100%", minHeight: 76, outline: "none", fontSize: t.fontSize, fontWeight: t.bold ? 700 : 400, lineHeight: 1.6, color: t.textColor, fontFamily: t.fontFamily, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            />
          ) : entry?.html ? (
            <div
              onClick={handleChipClick}
              style={{ fontSize: t.fontSize, fontWeight: t.bold ? 700 : 400, lineHeight: 1.6, color: t.textColor, fontFamily: t.fontFamily, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              dangerouslySetInnerHTML={{ __html: entry.html }}
            />
          ) : (
            <div style={{ fontSize: t.fontSize, color: isDark ? "#6b6b6b" : "#c9c4b3", fontStyle: "italic", fontFamily: t.fontFamily }}>No story written this day.</div>
          )}

          <AnimatePresence>
            {mention && (
              <LifeStoryMentionPopover pos={mention} onPickEmoji={pickEmoji} onAddPhoto={openAddPhoto} onClose={() => setMention(null)} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {selToolbar && (
              <LifeStorySelectionToolbar pos={selToolbar} onBold={applyBold} onItalic={applyItalic} onUnderline={applyUnderline} onColor={applyColor} activeColorPickRef={colorInputRef} />
            )}
          </AnimatePresence>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </div>
      </motion.div>

      <AnimatePresence>
        {lightbox !== null && (
          <LifeStoryLightbox src={images[lightbox]} onClose={() => setLightbox(null)} onDelete={() => { onRemoveImage(lightbox); setLightbox(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* Glass settings popover — Theme presets, Font, Size, Text color, Page
   background color. Same blur/border/shadow recipe as the other Life
   Story glass popups. Custom color inputs (native <input type="color">)
   sit next to swatch presets so any color is reachable, not just the 10
   curated themes. */
function LifeStoryThemeSettings({ theme, onChange, onClose }) {
  const set = (patch) => onChange({ ...theme, presetId: "custom", ...patch });
  const applyPreset = (p) => onChange({ presetId: p.id, fontFamily: theme.fontFamily, fontSize: theme.fontSize, bold: theme.bold, textColor: p.text, bgColor: p.bg });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{
        position: "absolute", top: "115%", right: 0, width: 250, maxHeight: 380, overflowY: "auto", zIndex: 50,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.85)", borderRadius: 12, boxShadow: "0 16px 40px rgba(37,36,34,0.25)", padding: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86" }}>PAGE THEME</div>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ cursor: "pointer", color: "#a39c86" }}>
          <X size={12} />
        </motion.div>
      </div>

      {/* Preset swatches */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 10 }}>
        {LIFE_STORY_THEME_PRESETS.map((p) => (
          <motion.div
            key={p.id} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={() => applyPreset(p)}
            title={p.name}
            style={{
              width: "100%", aspectRatio: "1", borderRadius: 8, cursor: "pointer", background: p.swatchBg,
              border: theme.presetId === p.id ? `2px solid ${C.accent}` : "1px solid rgba(0,0,0,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: theme.presetId === p.id ? "0 0 0 2px rgba(252,163,17,0.25)" : "none",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: p.text }}>Aa</span>
          </motion.div>
        ))}
      </div>

      {/* Font family */}
      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <Type size={10} /> FONT
      </div>
      <select
        value={theme.fontFamily}
        onChange={(e) => set({ fontFamily: e.target.value })}
        style={{ width: "100%", fontSize: 11, fontWeight: 700, color: C.dark, padding: "6px 8px", borderRadius: 8, border: "1px solid #ece7d8", background: "#fff", marginBottom: 10, cursor: "pointer" }}
      >
        {LIFE_STORY_FONTS.map((f) => (
          <option key={f.id} value={f.stack} style={{ fontFamily: f.stack }}>{f.label}</option>
        ))}
      </select>

      {/* Text size */}
      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <Baseline size={10} /> TEXT SIZE — {theme.fontSize}px
      </div>
      <input
        type="range" min={11} max={22} step={1} value={theme.fontSize}
        onChange={(e) => set({ fontSize: Number(e.target.value) })}
        style={{ width: "100%", marginBottom: 10, accentColor: C.accent }}
      />

      {/* Bold toggle */}
      <motion.div
        whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
        onClick={() => set({ bold: !theme.bold })}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10, cursor: "pointer",
          fontSize: 11, fontWeight: 800, color: theme.bold ? "#fff" : C.dark,
          background: theme.bold ? C.accent : "#fff", border: `1px solid ${theme.bold ? C.accent : "#ece7d8"}`,
          borderRadius: 999, padding: "6px 0",
        }}
      ><Bold size={12} /> Bold text {theme.bold ? "On" : "Off"}</motion.div>

      {/* Text color + Background color */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Palette size={10} /> TEXT COLOR
          </div>
          <input
            type="color" value={/^#/.test(theme.textColor) ? theme.textColor : "#403d39"}
            onChange={(e) => set({ textColor: e.target.value })}
            style={{ width: "100%", height: 28, borderRadius: 8, border: "1px solid #ece7d8", cursor: "pointer", padding: 2, background: "#fff" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Palette size={10} /> PAGE BG
          </div>
          <input
            type="color" value={/^#[0-9a-fA-F]{6}$/.test(theme.bgColor) ? theme.bgColor : "#fbf9f2"}
            onChange={(e) => set({ bgColor: e.target.value })}
            style={{ width: "100%", height: 28, borderRadius: 8, border: "1px solid #ece7d8", cursor: "pointer", padding: 2, background: "#fff" }}
          />
        </div>
      </div>

      <motion.div
        whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
        onClick={() => onChange(LIFE_STORY_DEFAULT_THEME)}
        style={{ marginTop: 10, textAlign: "center", fontSize: 10, fontWeight: 800, color: C.dark, border: "1px solid #ece7d8", borderRadius: 999, padding: "6px 0", cursor: "pointer", background: "#fff" }}
      >
        Reset to default
      </motion.div>
    </motion.div>
  );
}

/* ---------------- GENIE HIDE/SHOW EFFECT ----------------
   Hides/restores today's Life Story box with a macOS-dock-style
   "genie" animation — the box gets sucked into (and re-emerges from)
   the header's toggle button.

   Note: alexwidua/genie is a Swift + Metal shader built for iOS/macOS
   native apps, so it can't run inside a Next.js/React web page. This
   recreates the same *look* using only web primitives already safe
   for this stack:
     - an SVG <feTurbulence> + <feDisplacementMap> filter (classic
       "liquid ripple" trick), triggered via SMIL beginElement() so it
       fires exactly when the animation starts, and
     - framer-motion's imperative `animate()` (already a project
       dependency — no new npm installs) driving the squeeze/scale/
       translate toward the button, with a bulge-then-pinch curve so
       it reads as an elastic "neck" instead of a flat scale-down.
   Works in Chrome, Firefox and Safari. */
function GenieFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="ls-genie-warp" x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0001 0.01" numOctaves="1" seed="6" result="ls-genie-noise">
            <animate id="ls-genie-turb-anim" attributeName="baseFrequency" begin="indefinite" fill="freeze" dur="0.62s" values="0.0001 0.01;0.0001 0.16;0.0001 0.02" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="ls-genie-noise" scale="0" xChannelSelector="R" yChannelSelector="G">
            <animate id="ls-genie-disp-anim" attributeName="scale" begin="indefinite" fill="freeze" dur="0.62s" values="0;70;0" />
          </feDisplacementMap>
        </filter>
      </defs>
    </svg>
  );
}

function GenieHidable({ hidden, onHiddenChange, toggleRef, children, placeholderLabel }) {
  const wrapRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | animating
  const prevHiddenRef = useRef(hidden);

  const measureAndAnimate = (dir) => {
    const el = wrapRef.current;
    const btn = toggleRef.current;
    if (!el || !btn) { if (dir === "hide") onHiddenChange(true); setPhase("idle"); return; }

    const elRect = el.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    // Anchor the shrink/grow point to wherever the button actually sits
    // above the card, so the "neck" always points the right way.
    const originXPct = Math.min(100, Math.max(0, ((btnRect.left + btnRect.width / 2) - elRect.left) / Math.max(1, elRect.width) * 100));
    const dx = (btnRect.left + btnRect.width / 2) - (elRect.left + elRect.width / 2);
    const dy = (btnRect.top + btnRect.height / 2) - elRect.top;

    el.style.transformOrigin = `${originXPct}% 0%`;
    el.style.filter = "url(#ls-genie-warp)";
    try {
      document.getElementById("ls-genie-turb-anim")?.beginElement();
      document.getElementById("ls-genie-disp-anim")?.beginElement();
    } catch (e) { /* SMIL restart can throw on rapid re-clicks in some engines; the transform animation still plays fine without it */ }

    if (dir === "hide") {
      animate(el, {
        x: [0, dx * 0.45, dx],
        y: [0, dy * 0.55, dy],
        scaleX: [1, 1.18, 0.035],
        scaleY: [1, 0.72, 0.05],
        opacity: [1, 1, 0],
      }, {
        duration: 0.62, times: [0, 0.42, 1], ease: "easeInOut",
        onComplete: () => {
          el.style.filter = ""; el.style.transform = ""; el.style.opacity = "";
          onHiddenChange(true);
          setPhase("idle");
        },
      });
    } else {
      // Start pinned/collapsed at the button, then unfurl outward —
      // the mirror image of the hide animation.
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.035, 0.05)`;
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        animate(el, {
          x: [dx, dx * 0.45, 0],
          y: [dy, dy * 0.55, 0],
          scaleX: [0.035, 1.18, 1],
          scaleY: [0.05, 0.72, 1],
          opacity: [0, 1, 1],
        }, {
          duration: 0.62, times: [0, 0.58, 1], ease: "easeOut",
          onComplete: () => {
            el.style.filter = ""; el.style.transform = ""; el.style.opacity = "";
            setPhase("idle");
          },
        });
      });
    }
  };

  const handleToggleClick = () => {
    if (phase === "animating") return;
    setPhase("animating");
    if (!hidden) measureAndAnimate("hide");
    else onHiddenChange(false); // mounts the real box again; entrance plays in the effect below
  };

  useEffect(() => {
    if (prevHiddenRef.current === true && hidden === false && phase === "animating") {
      // Box just remounted for a "show" — wait a couple frames so layout
      // is settled, then play the emerge animation from the button.
      requestAnimationFrame(() => requestAnimationFrame(() => measureAndAnimate("show")));
    }
    prevHiddenRef.current = hidden;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  // Exposes the toggle to the header button, which lives outside this
  // component (and doubles as the genie's target point).
  useEffect(() => {
    if (toggleRef.current) toggleRef.current.__genieToggle = handleToggleClick;
  });

  if (hidden) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        onClick={handleToggleClick}
        whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
          border: `1px dashed ${C.accent}`, borderRadius: 14, padding: "10px 14px", marginBottom: 20,
          background: "rgba(252,163,17,0.08)", color: C.accent, fontSize: 11, fontWeight: 800,
        }}
      >
        <Sparkles size={12} /> {placeholderLabel} — tap to bring it back
      </motion.div>
    );
  }

  return <div ref={wrapRef}>{children}</div>;
}

function LifeStoryTab({ state, update, onClose }) {
  const story = state.lifeStory || { profile: null, entries: {} };
  const entries = story.entries || {};
  const theme = { ...LIFE_STORY_DEFAULT_THEME, ...(story.theme || {}) };
  const today = todayISO();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [todayHidden, setTodayHidden] = useState(false);
  const feedRef = useRef(null);
  const blockRefs = useRef({});
  const hideToggleRef = useRef(null);

  const dates = useMemo(() => {
    const keys = new Set(Object.keys(entries));
    keys.add(today);
    return [...keys].sort(); // ascending — oldest at top, today at bottom
  }, [entries, today]);

  useEffect(() => {
    // land on today's entry when the tab opens, like a chat scrolled to latest
    requestAnimationFrame(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }); });
  }, []);

  const setProfile = (profile) => update((s) => ({ ...s, lifeStory: { profile, entries: s.lifeStory?.entries || {}, theme: s.lifeStory?.theme } }));
  const setTheme = (nextTheme) => update((s) => ({ ...s, lifeStory: { profile: s.lifeStory?.profile || null, entries: s.lifeStory?.entries || {}, theme: nextTheme } }));
  const setEntryHtml = (iso) => (html) => update((s) => ({
    ...s, lifeStory: { profile: s.lifeStory?.profile || null, theme: s.lifeStory?.theme, entries: { ...(s.lifeStory?.entries || {}), [iso]: { ...(s.lifeStory?.entries?.[iso] || {}), html } } },
  }));
  // dataUrl arrives already resized (LifeStoryDayBlock does the resizing) —
  // indices must stay stable forever since inline 📷 chips reference them.
  const addImage = (iso) => (dataUrl) => update((s) => {
    const cur = s.lifeStory?.entries?.[iso] || {};
    const images = [...(cur.images || []), dataUrl];
    return { ...s, lifeStory: { profile: s.lifeStory?.profile || null, theme: s.lifeStory?.theme, entries: { ...(s.lifeStory?.entries || {}), [iso]: { ...cur, images } } } };
  });
  // Nulls the slot instead of splicing (keeps every other chip's index
  // valid) and strips that one chip out of the saved HTML.
  const removeImage = (iso) => (idx) => update((s) => {
    const cur = s.lifeStory?.entries?.[iso] || {};
    const images = (cur.images || []).map((img, i) => (i === idx ? null : img));
    let html = cur.html || "";
    if (typeof document !== "undefined") {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const chip = tmp.querySelector(`[data-story-chip][data-idx="${idx}"]`);
      if (chip) chip.remove();
      html = tmp.innerHTML;
    }
    return { ...s, lifeStory: { profile: s.lifeStory?.profile || null, theme: s.lifeStory?.theme, entries: { ...(s.lifeStory?.entries || {}), [iso]: { ...cur, images, html } } } };
  });

  const jumpTo = (iso) => {
    setJumpOpen(false);
    blockRefs.current[iso]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 10, background: "#fff", display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${C.text}`, borderRadius: "10px 10px 0 0", flexWrap: "wrap", rowGap: 6 }}>
        <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ArrowLeft size={15} color={C.dark} />
        </motion.div>
        <Pencil size={14} color={C.dark} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>Life Story</span>

        <motion.button
          ref={hideToggleRef}
          whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }}
          onClick={() => hideToggleRef.current?.__genieToggle?.()}
          title={todayHidden ? "Show today's entry" : "Hide today's entry"}
          style={{
            border: `1px solid ${todayHidden ? C.accent : C.text}`, borderRadius: 999, padding: "4px 9px", background: todayHidden ? "#fff7ea" : "#fff",
            display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, fontWeight: 800, color: todayHidden ? C.accent : C.dark,
          }}
        >
          {todayHidden ? <EyeOff size={11} /> : <Eye size={11} />} {todayHidden ? "show" : "hide"}
        </motion.button>

        <div style={{ flex: 1 }} />

        <div style={{ position: "relative" }}>
          <motion.button
            whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={() => setJumpOpen((v) => !v)}
            style={{ border: `1px solid ${C.text}`, borderRadius: 999, padding: "5px 11px", background: "#fff", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 800, color: C.dark }}
          ><Filter size={12} /> filters</motion.button>
          <AnimatePresence>
            {jumpOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                style={{
                  position: "absolute", top: "115%", right: 0, width: 190, maxHeight: 240, overflowY: "auto", zIndex: 50,
                  background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,0.85)", borderRadius: 12, boxShadow: "0 16px 40px rgba(37,36,34,0.25)", padding: 6,
                }}
              >
                <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", padding: "4px 6px" }}>JUMP TO DATE</div>
                {[...dates].reverse().map((iso) => (
                  <div key={iso} onClick={() => jumpTo(iso)}
                    style={{ fontSize: 10.5, fontWeight: 700, color: C.dark, padding: "6px 8px", borderRadius: 8, cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >{iso === today ? "Today" : formatStoryDate(iso)}</div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ position: "relative" }}>
          <motion.button
            whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={() => setThemeOpen((v) => !v)}
            style={{ border: `1px solid ${C.text}`, borderRadius: 999, padding: "5px 11px", background: "#fff", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 800, color: C.dark }}
          ><Settings size={12} /> theme</motion.button>
          <AnimatePresence>
            {themeOpen && (
              <LifeStoryThemeSettings theme={theme} onChange={setTheme} onClose={() => setThemeOpen(false)} />
            )}
          </AnimatePresence>
        </div>

        {story.profile && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: story.profile.image ? `url(${story.profile.image}) center/cover` : C.dark, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800 }}>
              {!story.profile.image && story.profile.name?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>{story.profile.name}</span>
          </div>
        )}
        <motion.div whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ cursor: "pointer", color: C.dark }}>
          <X size={16} />
        </motion.div>
      </div>

      <GenieFilterDefs />
      <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: 16, background: theme.bgColor }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          {dates.map((iso) => {
            const block = (
              <LifeStoryDayBlock
                key={iso} iso={iso} entry={entries[iso]} isToday={iso === today} theme={theme}
                onChangeHtml={setEntryHtml(iso)} onAddImage={addImage(iso)} onRemoveImage={removeImage(iso)}
                blockRef={(el) => { blockRefs.current[iso] = el; }}
              />
            );
            return iso === today ? (
              <GenieHidable key="today-genie" hidden={todayHidden} onHiddenChange={setTodayHidden} toggleRef={hideToggleRef} placeholderLabel="Today's entry is hidden">
                {block}
              </GenieHidable>
            ) : block;
          })}
        </div>
      </div>

      <AnimatePresence>{!story.profile && <LifeStoryProfileSetup onSave={setProfile} />}</AnimatePresence>
    </div>
  );
}

function BTLDashboardInner() {
  const { user: fbUser } = useAuth();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [shine, setShine] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState(null);
  const [memOpen, setMemOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moneyModal, setMoneyModal] = useState(null); // { mode: "earn"|"spend", amount } | null
  const [focusMode, setFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved"
  const fileRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!fbUser) return;
    loadState(fbUser).then((s) => { setState(rolloverDailyGoals(s)); loaded.current = true; });
  }, [fbUser]);

  // Bug fix: goals ticked "kal" (yesterday) were staying ticked forever —
  // Daily/Extry Goals are meant to be filled fresh every day. This checks
  // once per minute (cheap, no-op most of the time) whether the calendar
  // date has rolled over since the state was last touched, and if so
  // unchecks every Daily/Extry goal for the new day without touching
  // streak, completionHistory, or anything already logged for past days.
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => (s ? rolloverDailyGoals(s) : s));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!state || !loaded.current || !fbUser) return;
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveState(fbUser, state).then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1600);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [state, fbUser]);

  const update = useCallback((fn) => setState((s) => fn({ ...s })), []);

  if (!state) {
    return <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif", color: C.text }}>Loading BTL…</div>;
  }

  const dailyPct = state.dailyGoals.length ? (state.dailyGoals.filter((g) => g.done).length / state.dailyGoals.length) * 100 : 0;
  const extryPct = state.extryGoals.length ? (state.extryGoals.filter((g) => g.done).length / state.extryGoals.length) * 100 : 0;
  const overallPct = (dailyPct + extryPct) / 2;

  const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100];
  function isMilestone(n) { return MILESTONES.includes(n) || (n > 100 && n % 50 === 0); }

  function checkFullCompletion(next) {
    const allDone = next.dailyGoals.length && next.dailyGoals.every((g) => g.done) &&
      next.extryGoals.length && next.extryGoals.every((g) => g.done);
    if (allDone && next.lastCompletedDate !== todayISO()) {
      next.lastCompletedDate = todayISO();
      next.streak = (next.streak || 0) + 1;
      setShine(true);
      setTimeout(() => setShine(false), 1600);
      if (isMilestone(next.streak)) {
        setConfetti(true);
        setMilestoneStreak(next.streak);
        setTimeout(() => { setConfetti(false); setMilestoneStreak(null); }, 2600);
      }
    }
    return next;
  }

  const recordCompletionHistory = (s) => {
    const total = s.dailyGoals.length + s.extryGoals.length;
    const doneDaily = s.dailyGoals.filter((g) => g.done);
    const doneExtry = s.extryGoals.filter((g) => g.done);
    const done = doneDaily.length + doneExtry.length;
    const pct = total ? (done / total) * 100 : 0;
    const day = todayISO();
    s.completionHistory = { ...s.completionHistory, [day]: pct };
    // snapshot exactly which goals were ticked off today — this is what
    // lets the Memories modal show "what you actually finished" per date
    s.dailyLogs = {
      ...(s.dailyLogs || {}),
      [day]: {
        ...(s.dailyLogs?.[day] || {}),
        completedGoals: {
          daily: doneDaily.map((g) => ({ id: g.id, text: g.text, icon: g.icon || "" })),
          extry: doneExtry.map((g) => ({ id: g.id, text: g.text, icon: g.icon || "" })),
        },
      },
    };
    return s;
  };

  const toggleGoal = (listKey) => (id) => update((s) => {
    s[listKey] = s[listKey].map((g) => g.id === id ? { ...g, done: !g.done } : g);
    recordCompletionHistory(s);
    return checkFullCompletion(s);
  });
  const addGoal = (listKey) => (text, meta = {}) => update((s) => {
    s[listKey] = [...s[listKey], ensureGoalDefaults({ id: `${Date.now()}-${Math.random()}`, text, done: false, ...meta })];
    return s;
  });
  const removeGoal = (listKey) => (id) => update((s) => {
    s[listKey] = s[listKey].filter((g) => g.id !== id);
    return s;
  });
  const toggleSubtask = (listKey) => (goalId, subId) => update((s) => {
    s[listKey] = s[listKey].map((g) => g.id === goalId
      ? { ...g, subtasks: g.subtasks.map((st) => st.id === subId ? { ...st, done: !st.done } : st) }
      : g);
    return s;
  });
  const addSubtask = (listKey) => (goalId, text) => update((s) => {
    s[listKey] = s[listKey].map((g) => g.id === goalId
      ? { ...g, subtasks: [...(g.subtasks || []), { id: `${Date.now()}-${Math.random()}`, text, done: false }] }
      : g);
    return s;
  });
  const setGoalIcon = (listKey) => (goalId, icon) => update((s) => {
    s[listKey] = s[listKey].map((g) => g.id === goalId ? { ...g, icon } : g);
    return s;
  });

  const addPlain = (listKey, text) => update((s) => { s[listKey] = [...s[listKey], text]; return s; });
  const removePlain = (listKey, idx) => update((s) => { s[listKey] = s[listKey].filter((_, i) => i !== idx); return s; });
  const editPlain = (listKey, idx, text) => update((s) => { s[listKey] = s[listKey].map((t, i) => i === idx ? text : t); return s; });
  const editGoalText = (listKey, id, text) => update((s) => { s[listKey] = s[listKey].map((g) => g.id === id ? { ...g, text } : g); return s; });

  const settingsAdd = (listKey, text) => {
    if (listKey === "bigGoals" || listKey === "lifeRules") addPlain(listKey, text);
    else addGoal(listKey)(text);
  };
  const settingsRemove = (listKey, idOrIdx) => {
    if (listKey === "bigGoals" || listKey === "lifeRules") removePlain(listKey, idOrIdx);
    else removeGoal(listKey)(idOrIdx);
  };
  const settingsEdit = (listKey, idOrIdx, text) => {
    if (listKey === "bigGoals" || listKey === "lifeRules") editPlain(listKey, idOrIdx, text);
    else editGoalText(listKey, idOrIdx, text);
  };

  const setMood = (date, mood) => update((s) => { s.moodLog = { ...s.moodLog, [date]: mood }; return s; });
  const addMemory = (date, text) => update((s) => { s.memories = [{ date, text }, ...s.memories]; return s; });

  // Clicking "Add" opens the glass MoneyEntryModal popup instead of committing
  // straight away — earn asks for an optional photo, spend requires a category.
  const openMoneyModal = (mode) => {
    const raw = mode === "earn" ? state.earnToday : state.spendToday;
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) { alert("Pehle ek valid amount likhein."); return; }
    setMoneyModal({ mode, amount: v });
  };

  // Fired by the popup's "Add Earning" / "Done" button — commits the totals,
  // the day's aggregate history (for the trend chart), and logs the individual
  // entry into moneyEntries (category/image/note) so Money Management can
  // show a category breakdown and a recent-activity feed.
  const commitMoney = ({ image, category, note }) => {
    if (!moneyModal) return;
    const { mode, amount } = moneyModal;
    update((s) => {
      const day = todayISO();
      const entry = {
        id: `${Date.now()}-${Math.random()}`, date: day, type: mode, amount,
        // IMPORTANT: never write `undefined` into a Firestore document —
        // the SDK rejects the entire save (silently failing every future
        // save too, since the whole state doc is re-sent each time).
        // Earn entries simply omit `category` instead of setting it to undefined.
        ...(mode === "spend" ? { category: category || "other" } : {}),
        image: image || null,
        note: note || "", ts: Date.now(),
      };
      s.moneyEntries = [entry, ...(s.moneyEntries || [])].slice(0, 300);
      const cur = (s.moneyHistory && s.moneyHistory[day]) || { earn: 0, spend: 0 };
      if (mode === "earn") {
        s.totalEarnLife = (s.totalEarnLife || 0) + amount;
        s.moneyHistory = { ...(s.moneyHistory || {}), [day]: { ...cur, earn: cur.earn + amount } };
        s.earnToday = "";
      } else {
        s.totalSpendLife = (s.totalSpendLife || 0) + amount;
        s.moneyHistory = { ...(s.moneyHistory || {}), [day]: { ...cur, spend: cur.spend + amount } };
        s.spendToday = "";
      }
      return s;
    });
    setMoneyModal(null);
  };

  // Fired only after the password gate in MoneyResetModal accepts "1000".
  // Wipes every trace of Money Management data — individual entries, the
  // daily aggregate history that powers the trend chart, and the
  // lifetime earn/spend totals shown in the header ovals — without
  // touching goals, streaks, memories or anything else in state.
  const resetMoneyData = () => update((s) => {
    s.moneyEntries = [];
    s.moneyHistory = {};
    s.totalEarnLife = 0;
    s.totalSpendLife = 0;
    return s;
  });

  // Takes a File directly (used by both the hidden <input onChange> and
  // drag-and-drop onDrop handlers) so both paths share the same logic.
  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please pick an image file."); return; }
    if (file.size > 12_000_000) { alert("Please pick an image under ~12MB."); return; }
    resizeImageDataUrl(file).then((dataUrl) => {
      update((s) => {
        s.uploadedImage = dataUrl;
        const day = todayISO();
        const cur = s.dailyLogs?.[day] || {};
        // keep the last 6 photos per day — plenty for a memory, small enough for Firestore
        const images = [...(cur.images || []), dataUrl].slice(-6);
        s.dailyLogs = { ...(s.dailyLogs || {}), [day]: { ...cur, images } };
        return s;
      });
    }).catch(() => alert("Couldn't read that image, try another one."));
  };
  const onImageFile = (e) => {
    processImageFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const updateLayout = (fn) => update((s) => { s.layout = fn(s.layout); return s; });
  const resetLayout = () => update((s) => { s.layout = defaultLayout(); return s; });

  /* ---- Theme (Settings → 🎨 Theme) handlers ---- */
  const setThemeScope = (scope, patch) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme[scope] = normalizeScopeTheme({ ...theme[scope], ...patch });
    s.theme = theme;
    return s;
  });
  const resetThemeScope = (scope) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme[scope] = normalizeScopeTheme({});
    s.theme = theme;
    return s;
  });
  const setWidgetTheme = (id, patch) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.widgets = { ...theme.widgets, [id]: { ...theme.widgets[id], ...patch } };
    s.theme = theme;
    return s;
  });
  const resetWidgetTheme = (id) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.widgets = { ...theme.widgets, [id]: { bg: "" } };
    s.theme = theme;
    return s;
  });
  const setWidgetSizePreset = (id, presetKey) => update((s) => {
    const preset = WIDGET_SIZE_PRESETS[presetKey] || WIDGET_SIZE_PRESETS.md;
    s.layout = { ...s.layout, sizes: { ...s.layout.sizes, [id]: { ...preset } } };
    return s;
  });
  const setAnalyticsSummaryMetrics = (metricIds) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.analyticsSummary = normalizeAnalyticsSummaryTheme({ metrics: metricIds });
    s.theme = theme;
    return s;
  });
  const resetAnalyticsSummaryMetrics = () => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.analyticsSummary = normalizeAnalyticsSummaryTheme({});
    s.theme = theme;
    return s;
  });
  const setAnalyticsColor = (key, hex) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.analyticsColors = { ...theme.analyticsColors, [key]: hex };
    s.theme = theme;
    return s;
  });
  const resetAnalyticsColors = () => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.analyticsColors = normalizeAnalyticsColors({});
    s.theme = theme;
    return s;
  });
  const setMoneyColor = (key, hex) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.moneyColors = { ...theme.moneyColors, [key]: hex };
    s.theme = theme;
    return s;
  });
  const resetMoneyColors = () => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.moneyColors = normalizeMoneyColors({});
    s.theme = theme;
    return s;
  });

  const theme = normalizeTheme(state.theme);
  const dashTheme = { bg: theme.dashboard.bg || C.bg, text: theme.dashboard.text || C.text };
  const fm = theme.focusMode;
  const fmFontFamily = fm.font ? fontStackFor(fm.font) : undefined;

  /* Shared widget content map — used by both the plain dashboard grid
     and the live resizable preview inside the Layout tab, so dragging
     a corner handle resizes the exact same widget the user sees on
     their normal dashboard. */
  const widgetsMap = {
    bigGoals: <TextList title="Life Big Goals" items={state.bigGoals} textStyle={state.layout.textStyles?.bigGoals} cardBg={theme.widgets.bigGoals?.bg} />,
    lifeRules: <TextList title="Life Rules" items={state.lifeRules} textStyle={state.layout.textStyles?.lifeRules} cardBg={theme.widgets.lifeRules?.bg} />,
    dailyGoals: <GoalChecklist title="Daily Goals" items={state.dailyGoals} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} textStyle={state.layout.textStyles?.dailyGoals} cardBg={theme.widgets.dailyGoals?.bg} />,
    extryGoals: <GoalChecklist title="Extry Goals" items={state.extryGoals} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} textStyle={state.layout.textStyles?.extryGoals} cardBg={theme.widgets.extryGoals?.bg} />,
    earnMoney: <EarnMoneyNotesCard state={state} update={update} onOpenEarn={() => openMoneyModal("earn")} onOpenSpend={() => openMoneyModal("spend")} onImageFile={onImageFile} onImageDrop={processImageFile} fileRef={fileRef} todayMood={state.moodLog?.[todayISO()]} onSetMood={(m) => setMood(todayISO(), m)} textStyle={state.layout.textStyles?.earnMoney} cardBg={theme.widgets.earnMoney?.bg} />,
    analyticsSummary: <AnalyticsSummaryWidget state={state} onOpen={() => setTab("analytics")} cardBg={theme.widgets.analyticsSummary?.bg} metrics={theme.analyticsSummary.metrics} />,
    calendar: <CalendarWidget completionHistory={state.completionHistory} cardBg={theme.widgets.calendar?.bg} textStyle={state.layout.textStyles?.calendar} />,
  };

  return (
    <DashboardThemeCtx.Provider value={dashTheme}>
    <div style={{
      fontFamily: "Inter, system-ui, sans-serif", background: dashTheme.bg, color: dashTheme.text,
      height: "100%", maxHeight: "100%", borderRadius: 14, padding: 14, position: "relative", overflow: "hidden",
      border: `1px solid #ece7d8`, fontSize: 11, boxSizing: "border-box",
      display: "flex", flexDirection: "column",
      zoom: "80%", // <-- shrinks the WHOLE dashboard (text, buttons, spacing, icons). Change to "70%" for smaller, "90%" for bigger.
    }}>
      <style>{`
        .btl-scroll::-webkit-scrollbar { width: 6px; }
        .btl-scroll::-webkit-scrollbar-thumb { background: #ddd6c4; border-radius: 4px; }
        .btl-check { transition: transform 120ms ease; }
        .btl-check:active { transform: scale(1.3); }
        .btl-mood-btn { transition: transform 120ms ease, background 150ms ease; }
        .btl-mood-btn:hover { transform: scale(1.18); }
        .btl-oval-btn { transition: transform 100ms ease, box-shadow 150ms ease; }
        .btl-oval-btn:active { transform: scale(0.94); }
        .life-story-editable:empty:before { content: attr(data-placeholder); color: #c9c4b3; font-style: italic; }
        .life-story-editable [data-story-chip] { transition: transform 120ms ease; }
        .life-story-editable [data-story-chip]:hover { transform: scale(1.25); }
        @keyframes btlShineLeft {
          0% { transform: translateX(-100%); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateX(120vw); opacity: 0; }
        }
        @keyframes btlShineRight {
          0% { transform: translateX(100%); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateX(-120vw); opacity: 0; }
        }
        .btl-shine { position: absolute; top: 0; bottom: 0; width: 40%; pointer-events: none; z-index: 50; }
        .btl-shine-left { left: 0; background: linear-gradient(100deg, transparent, rgba(252,163,17,0.55), transparent); animation: btlShineLeft 1.4s ease-out; }
        .btl-shine-right { right: 0; background: linear-gradient(260deg, transparent, rgba(152,193,217,0.55), transparent); animation: btlShineRight 1.4s ease-out; }
        @keyframes btlConfettiFall {
          0% { top: -10px; opacity: 1; }
          100% { top: 105%; opacity: 0.9; }
        }
        .btl-confetti-piece { position: absolute; top: -10px; animation-name: btlConfettiFall; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards; }
        @keyframes btlMilestonePop {
          0% { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.85); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.05); }
          25% { transform: translateX(-50%) translateY(0) scale(1); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.95); }
        }
        .btl-milestone-banner { animation: btlMilestonePop 2.6s ease forwards; }
        input, textarea, button { font-family: inherit; }
      `}</style>

      <ShineOverlay active={shine} />
      <Confetti active={confetti} />
      <MilestoneBanner streak={milestoneStreak} visible={!!milestoneStreak} />
      <QuickNavFab
        tab={tab} setTab={setTab}
        focusMode={focusMode} setFocusMode={setFocusMode}
        setMemOpen={setMemOpen} setSettingsOpen={setSettingsOpen}
      />

      {tab === "layout" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LayoutEditor layout={state.layout} widgets={widgetsMap} onChange={updateLayout} onReset={resetLayout} onClose={() => setTab("dashboard")} />
        </div>
      ) : tab === "analytics" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <AnalyticsTab state={state} onClose={() => setTab("dashboard")} onOpenMoneyManagement={() => setTab("money")} />
        </div>
      ) : tab === "money" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <MoneyManagementTab state={state} onClose={() => setTab("analytics")} onResetData={resetMoneyData} />
        </div>
      ) : tab === "lifeStory" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LifeStoryTab state={state} update={update} onClose={() => setTab("dashboard")} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* ---------- HEADER ---------- */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8, flexShrink: 0 }}>
            <Oval style={{ background: C.dark, color: C.bg, borderColor: C.dark, fontSize: 16, fontWeight: 900 }}>Byound The Life</Oval>
            <Oval title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>Goals</Oval>
            <Oval title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>Total Earn Money life :- ₹{state.totalEarnLife.toFixed(0)}</Oval>
            <Oval title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed", borderColor: "#c0392b", color: "#c0392b" }}>Total Spend Money life :- ₹{(state.totalSpendLife || 0).toFixed(0)}</Oval>
            <Oval className="btl-oval-btn" onClick={() => setMemOpen(true)} style={{ cursor: "pointer", background: C.blue, borderColor: C.blue, color: C.dark }}><BookOpen size={11} style={{ marginRight: 4 }} />memor</Oval>
            <Oval className="btl-oval-btn" onClick={() => setTab("lifeStory")} style={{ cursor: "pointer", background: "#b083f0", borderColor: "#b083f0", color: "#fff" }}><Pencil size={11} style={{ marginRight: 4 }} />life story</Oval>
            <motion.button
              onClick={() => setFocusMode((v) => !v)} title="Hide everything except today's incomplete goals"
              whileHover={{ y: -2 }} whileTap={{ scale: 1.07 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{
                border: `1px solid ${focusMode ? C.accent : dashTheme.text}`, background: focusMode ? C.accent : dashTheme.bg, color: focusMode ? "#fff" : dashTheme.text,
                borderRadius: 999, padding: "4px 14px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}><Target size={14} /> Focus Mode</motion.button>
            <motion.button
              onClick={() => setSettingsOpen(true)}
              whileHover={{ y: -2 }} whileTap={{ scale: 1.07 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{
                border: `1px solid ${dashTheme.text}`, background: dashTheme.bg, color: dashTheme.text, borderRadius: 999, padding: "4px 14px",
                display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}><Settings size={14} /> Setting</motion.button>


            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SaveStatus status={saveStatus} />
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", background: C.dark, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
                }}>{String(state.streak).padStart(3, "0")}</div>
              </div>
              <RingStat pct={dailyPct} label="Daily Goal" sub="Staytus" color={C.accent} />
              <RingStat pct={extryPct} label="Extry Goal" sub="Staytus" color={C.blue} />
              <RingStat pct={overallPct} label="Goal" color={C.dark} />
              <div style={{ position: "relative" }}>
                <ProfileButton user={fbUser} open={profileOpen} onToggle={() => setProfileOpen((v) => !v)} />
                <ProfilePopup
                  user={fbUser} open={profileOpen} onClose={() => setProfileOpen(false)}
                  onSignOut={() => { signOutUser(); setProfileOpen(false); }}
                  onSignIn={() => { signInWithGoogle(); setProfileOpen(false); }}
                />
              </div>
            </div>
          </div>

          {focusMode ? (
            <div style={{
              flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
              background: fm.bg || undefined, color: fm.text || undefined,
              fontFamily: fmFontFamily, fontWeight: fm.bold ? 600 : undefined,
              zoom: fm.scale !== 1 ? fm.scale : undefined,
              borderRadius: fm.bg ? 10 : 0, padding: fm.bg ? 10 : 0, boxSizing: "border-box",
            }}>
              {/* ---------- FOCUS MODE ---------- */}
              <Oval style={{ display: "block", width: "fit-content", margin: "0 auto 8px", background: C.accent, color: "#fff", borderColor: C.accent, fontSize: 12, flexShrink: 0 }}>
                FOCUS MODE — TODAY'S REMAINING GOALS
              </Oval>
              <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
                <GoalChecklist title="Daily Goals" items={state.dailyGoals.filter((g) => !g.done)} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} cardBg={theme.widgets.dailyGoals?.bg} />
                <GoalChecklist title="Extry Goals" items={state.extryGoals.filter((g) => !g.done)} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} cardBg={theme.widgets.extryGoals?.bg} />
              </div>
              {state.dailyGoals.filter((g) => !g.done).length === 0 && state.extryGoals.filter((g) => !g.done).length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: fm.text || "#a39c86", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  🎉 Sab kuch done! Focus Mode se bahar aane ke liye button dabao.
                </div>
              )}
            </div>
          ) : (
            /* ---------- CUSTOMIZABLE DASHBOARD (reorder/resize via the Layout tab; read-only here) ---------- */
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className="btl-scroll">
              <WidgetGrid layout={state.layout} widgets={widgetsMap} />
            </div>
          )}
        </div>
      )}

      {/* ---------- SETTINGS MODAL (Glassmorphism 2.0 / Liquid Glass — same style as Memories) ---------- */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{
              position: "absolute", inset: 0, background: "rgba(37,36,34,0.28)", zIndex: 65,
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
            }} onClick={() => setSettingsOpen(false)}>
            <SettingsTab
              state={state} addItem={settingsAdd} removeItem={settingsRemove} editItem={settingsEdit} onClose={() => setSettingsOpen(false)}
              onThemeScopeChange={setThemeScope} onThemeScopeReset={resetThemeScope}
              onWidgetThemeChange={setWidgetTheme} onWidgetThemeReset={resetWidgetTheme}
              onWidgetSizePreset={setWidgetSizePreset}
              onAnalyticsSummaryChange={setAnalyticsSummaryMetrics} onAnalyticsSummaryReset={resetAnalyticsSummaryMetrics}
              onAnalyticsColorChange={setAnalyticsColor} onAnalyticsColorReset={resetAnalyticsColors}
              onMoneyColorChange={setMoneyColor} onMoneyColorReset={resetMoneyColors}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- MEMORIES MODAL (Glassmorphism 2.0 / Liquid Glass — full journal, tabbed) ---------- */}
      <AnimatePresence>
        {memOpen && <MemoriesModal state={state} onAddMemory={addMemory} onClose={() => setMemOpen(false)} />}
      </AnimatePresence>

      {/* ---------- MONEY ADD POPUP (Earn: optional photo · Spend: required category → Done) ---------- */}
      <AnimatePresence>
        {moneyModal && (
          <MoneyEntryModal
            mode={moneyModal.mode}
            amount={moneyModal.amount}
            onClose={() => setMoneyModal(null)}
            onConfirm={commitMoney}
          />
        )}
      </AnimatePresence>
    </div>
    </DashboardThemeCtx.Provider>
  );
}

/* ----------------------------------------------------------------
   ERROR BOUNDARY — a defensive safety net.
   Previously, any uncaught runtime error anywhere in the tree (e.g. a
   third-party animation library hitting an edge case) would leave
   React's event system dead: the DOM would still be visible, but
   nothing would respond to clicks anymore, with no way to recover
   short of a full page reload. This catches that instead of letting
   the whole dashboard go silently unresponsive, and offers a one-click
   recovery so the person never gets stuck.
   ---------------------------------------------------------------- */
class BTLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("BTL dashboard crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: "Inter, system-ui, sans-serif", height: "100%", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          background: C.bg, color: C.dark, borderRadius: 14, padding: 24, textAlign: "center",
        }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Something went wrong.</div>
          <div style={{ fontSize: 11, color: "#8a8579", maxWidth: 320 }}>
            A part of the dashboard hit an unexpected error. Your data is safe — tap below to reload this view.
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ border: "none", background: C.dark, color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            Reload dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BTLErrorBoundary>
      <BTLDashboardInner />
    </BTLErrorBoundary>
  );
}
