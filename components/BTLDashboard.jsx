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
  Type, Palette, Bold, Italic, Underline, Baseline, User, LogIn,
  Users, Clock, PieChart as PieChartIcon, Bell, BellOff, Square,
  AlarmClock, Volume2, Play, Waves, Gauge,
  Dumbbell, Info, Timer, Flower2, Wind,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar, Area, Legend, PieChart, Pie, Cell } from "recharts";
import { motion, AnimatePresence, Reorder, animate, useDragControls } from "framer-motion";
import { createPortal } from "react-dom";
import { useAuth, signOutUser, signInWithGoogle } from "@/lib/AuthContext";
import { loadStateFromFirestore, saveStateToFirestore } from "@/lib/btlStorage";
import { ensurePublicProfile, useIncomingFriendRequestCount } from "@/lib/friendsStorage";
import FriendCelebration from "@/components/FriendCelebration";
import BTLLoadingScreen from "@/components/BTLLoadingScreen";
import LiquidBackground, { LIQUID_BG_DEFAULT_COLORS } from "@/components/LiquidBackground";

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
     - w = width as a percentage of the grid's own width (1–100, whole
       numbers), clamped to MIN_WIDGET_W..GRID_COLS. This is a fine,
       100-unit grid (`repeat(GRID_COLS, 1fr)`), so horizontal resize
       feels just as free-form/continuous as vertical resize does —
       every drag pixel moves the width by roughly 1%, not in big
       fixed-fraction jumps — while still staying responsive (widths
       are always a % of the container, so they reflow correctly on
       any screen size).
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
  { id: "timeTable", label: "Time Table" },
  { id: "earnMoney", label: "Earn Money / Notes" },
  { id: "analyticsSummary", label: "Analytics Summary" },
  { id: "calendar", label: "Calendar" },
  { id: "clock", label: "Analog Clock & Alarm" },
  { id: "focusTimer", label: "Focus Timer" },
];
const GRID_COLS = 100;        // fine-grained width grid (1–100 = % of container) — free-form, continuous horizontal resize
const OLD_GRID_COLS = 6;      // pre-update width resolution, kept only so normalizeSize can rescale old saved layouts
const MIN_WIDGET_W = 15;      // % — minimum free-form width, so a widget can't be dragged down to an unusable sliver
const DEFAULT_WIDGET_W = 50;  // % — fallback width (equivalent to the old default of "3 / 6 columns")
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
   kept only so ensureLayoutDefaults can migrate old saved layouts.
   Values are already expressed on the current 1–100 (%) width scale. */
const LEGACY_SIZE_SPAN = { sm: 33, md: 50, lg: 100 };
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
export const fontStackFor = (id) => (FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0]).stack;
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
  { key: "chartAxis", label: "Chart grid & axis lines (Mood trend / Weekdays / Money velocity)", defaultHex: "#b3ac99" },
  { key: "weekdayBest", label: "Best & toughest weekdays — best day bar", defaultHex: "#4a7c59" },
  { key: "weekdayWorst", label: "Best & toughest weekdays — toughest day bar", defaultHex: "#e07a5f" },
  { key: "weekdayOther", label: "Best & toughest weekdays — other day bars", defaultHex: "#fca311" },
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
/* ---- Auto contrast-safe text (this update) ----
   Every widget/section can get any custom background color from the
   Theme panel (including the new dark Panel Theme presets), but a lot
   of body text was hardcoded to the app's default dark brown (C.text /
   C.dark) — invisible on a dark card. These two helpers compute the
   background's brightness and flip body text to light or dark
   automatically, so text always stays readable no matter what color
   (or preset) is picked, without needing a separate "text color" field
   for every single widget. */
function hexLuminance(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) return 1; // unknown/empty -> assume light card
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function autoTextColor(bg, opts) {
  const dark = (opts && opts.dark) || C.text;
  const light = (opts && opts.light) || "#f1ede0";
  if (!bg) return dark; // default "#fff"/no custom bg -> keep the original dark body text
  return hexLuminance(bg) < 0.5 ? light : dark;
}
function autoMutedColor(bg) {
  return hexLuminance(bg || "#fff") < 0.5 ? "#b7b2a2" : "#8a8579";
}

/* ---- Glassmorphism 2.0 widget cards (this update) ----
   Daily Goals / Extry Goals, Time Table, and Calendar cards now get a
   frosted-glass look instead of a flat opaque fill. Reads from the
   exact same `cardBg` these cards already used (default cream, a
   per-widget custom color from the Widgets theme tab, or whatever a
   Panel Theme preset wrote into it) — no new theme field needed, it
   just renders that color semi-transparent with a blur behind it
   instead of solid. */
function hexToRgba(hex, alpha) {
  const safe = typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#fffdf7";
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
/* ---- Glass recipe tuned to match the app's own reference (this update) ----
   The "Start your Life Story" popup (LifeStoryProfileSetup, below) already
   nails the exact frosted look we want everywhere else: high blur (24px)
   + strong saturate boost, a bright semi-opaque white EDGE highlight
   (not just a faint tinted border) to sell the "glass rim", and a big
   soft lifted shadow so the card visibly floats instead of just sitting
   as a slightly-see-through flat patch. The old recipe here (16px blur,
   a near-invisible border, a small shadow) read as "muted flat color"
   rather than glass once it sat over a real page background — this
   brings every widget/panel in line with that reference. */
/* ---- Liquid Glass — manageable blur/opacity/softness (this update) ----
   `glassCardStyle()` is called from ~15 places across the file with just
   (cardBg, borderColor) — threading new props through every call site
   would be a huge, risky diff. Instead, the active Liquid Glass tuning
   knobs (blur px, frost opacity, neumorphic soft-shadow) are stashed in
   this module-level variable by the top-level BTLDashboard render (see
   `ACTIVE_GLASS_OPTS = ...` below, set once per render before any card
   below it in the tree calls glassCardStyle) — same "read a fresh
   module var during this render pass" trick already used elsewhere in
   this file. Every other preset leaves it null and gets the exact old
   behavior, byte-for-byte. */
let ACTIVE_GLASS_OPTS = null;
function glassCardStyle(cardBg, borderColor) {
  const isDark = hexLuminance(cardBg || "#fffdf7") < 0.5;
  const opts = ACTIVE_GLASS_OPTS;
  const blurPx = opts && Number.isFinite(opts.blur) ? opts.blur : 20;
  const alpha = opts && Number.isFinite(opts.opacity) ? opts.opacity : (isDark ? 0.56 : 0.66);
  const soft = !!(opts && opts.soft);
  const style = {
    background: hexToRgba(cardBg || "#fffdf7", alpha),
    backdropFilter: `blur(${blurPx}px) saturate(200%)`,
    WebkitBackdropFilter: `blur(${blurPx}px) saturate(200%)`,
    border: `1px solid ${borderColor || (isDark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.85)")}`,
  };
  /* Soft mode layers the reference moodboard's dual light/dark
     neumorphic shadow (light source top-left) UNDER the same glass
     blur/fill above — so it stays real frosted glass, just with the
     embossed, "pressed into a soft surface" edge from the reference
     image instead of a single floating drop-shadow. Only offered on
     light cards; dark cards keep the normal lifted-glass shadow since
     a light-on-dark neumorphic pair would look inverted/wrong. */
  style.boxShadow = soft && !isDark
    ? "9px 9px 18px rgba(163,177,198,0.5), -9px -9px 18px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,0.7)"
    : isDark
      ? "0 20px 50px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.10)"
      : "0 20px 50px rgba(37,36,34,0.22), inset 0 1px 0 rgba(255,255,255,0.65)";
  return style;
}

/* ---- Swipe-to-complete on mobile (this update) ----
   Detects a coarse/touch pointer (phones & tablets) so the swipe
   gesture on goal rows below only activates on mobile — desktop mouse
   users keep the existing checkbox/click behavior completely
   untouched, with no risk of the drag gesture eating clicks. */
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(pointer: coarse)");
      setIsTouch(mq.matches);
      const handler = (e) => setIsTouch(e.matches);
      if (mq.addEventListener) mq.addEventListener("change", handler); else mq.addListener(handler);
      return () => { if (mq.removeEventListener) mq.removeEventListener("change", handler); else mq.removeListener(handler); };
    } catch (e) { /* ignore — assume desktop/mouse */ }
  }, []);
  return isTouch;
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
  { key: "chartAxis", label: "Chart grid & axis lines (Earn vs spend)", defaultHex: "#b3ac99" },
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
const TEXT_STYLE_WIDGET_IDS = ["bigGoals", "lifeRules", "dailyGoals", "extryGoals", "timeTable", "earnMoney", "calendar"];
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
  sm: { w: 33, h: 150 },
  md: { w: 50, h: 215 },
  lg: { w: 100, h: 320 },
};
/* ---- One-click Panel Theme presets (this update) ----
   6 ready-made color patterns. Clicking one applies its bg + text pair
   across every scoped surface (Dashboard, Analytics, Money Management,
   Focus Mode, Friend Celebration) AND every widget's background, all in
   a single update — a fast alternative to tuning each scope by hand in
   the sections below (which still work exactly as before, and clicking
   any of their swatches afterward just fine-tunes on top of the preset). */
const PANEL_THEME_PRESETS = [
  { id: "ocean", label: "Ocean", bg: "#eef2f9", text: "#1b2a4a", widgetBg: "#eef6fb", swatch: "linear-gradient(135deg, #eef2f9 50%, #6a93b8 50%)" },
  { id: "sunset", label: "Sunset", bg: "#fff3e6", text: "#7a2e0e", widgetBg: "#fff7ec", swatch: "linear-gradient(135deg, #fff3e6 50%, #fca311 50%)" },
  { id: "forest", label: "Forest", bg: "#eef6f0", text: "#1f3d2b", widgetBg: "#eef6f0", swatch: "linear-gradient(135deg, #eef6f0 50%, #4c9a6a 50%)" },
  { id: "berry", label: "Berry", bg: "#fdeef0", text: "#5c1a2b", widgetBg: "#fdeef0", swatch: "linear-gradient(135deg, #fdeef0 50%, #d0577f 50%)" },
  { id: "midnight", label: "Midnight", bg: "#0f172a", text: "#e7ecf5", widgetBg: "#1b2436", swatch: "linear-gradient(135deg, #0f172a 50%, #3a4a6b 50%)" },
  { id: "charcoal", label: "Charcoal", bg: "#252422", text: "#f2ede0", widgetBg: "#33312d", swatch: "linear-gradient(135deg, #252422 50%, #6b675c 50%)" },
  { id: "mono", label: "Black & White", bg: "#000000", text: "#ffffff", widgetBg: "#141414", swatch: "linear-gradient(135deg, #000000 50%, #ffffff 50%)" },
  /* "Glass" — the odd one out: instead of a flat tinted bg, this pairs a
     deep indigo backdrop with a pure-white `widgetBg`. Every widget/panel
     card already renders its cardBg through `glassCardStyle()` (see
     below), so a white widgetBg here becomes true frosted white glass —
     ~55% opacity + blur — floating over the indigo canvas, with
     `autoTextColor`/`autoMutedColor` (unchanged) still doing their normal
     job of picking readable text for whatever ends up behind it. No card
     anywhere renders as a flat opaque fill under this preset. */
  { id: "glass", label: "Glass", bg: "#2b2f52", text: "#f5f3ff", widgetBg: "#ffffff", swatch: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.35) 45%, #2b2f52 100%)" },
  /* "Liquid Glass" (this update) — the soft, light, Apple-style liquid-glass
     material from the reference moodboard: a very light neutral canvas
     (instead of Glass's moody indigo) so every widget's existing frosted
     `glassCardStyle()` card reads as pale, airy, blurred glass sitting on
     top of the colorful animated LiquidBackground blobs, exactly like the
     reference's soft off-white panels over a subtly tinted backdrop. Text
     stays near-black (matching the reference's dark labels on light glass)
     and the swatch previews the same white-to-glass sheen. No new card
     rendering logic needed — this preset alone is enough to turn the
     dashboard's *existing* shared blur/translucency/shine mechanism into
     this exact look; fine-tune bg/widget colors afterward in the sections
     below if you want to nudge the tint. */
  { id: "liquidGlass", label: "Liquid Glass", bg: "#eef1f5", text: "#1c1c1e", widgetBg: "#f7f8fa", swatch: "linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(238,241,245,0.65) 55%, #c7cdd8 100%)" },
];
export function normalizeScopeTheme(t) {
  const src = t && typeof t === "object" ? t : {};
  const scale = Math.min(THEME_SCALE_MAX, Math.max(THEME_SCALE_MIN, Number(src.scale) || 1));
  return {
    bg: typeof src.bg === "string" ? src.bg : "",
    text: typeof src.text === "string" ? src.text : "",
    border: typeof src.border === "string" ? src.border : "",
    font: typeof src.font === "string" ? src.font : "",
    bold: !!src.bold,
    scale: Math.round(scale * 100) / 100,
  };
}
/* Liquid Glass fine-tune knobs — only meaningful while panelPreset ===
   "liquidGlass", but always normalized/stored so it round-trips through
   Firestore cleanly. `opacity: null` / `blur` at default means "auto"
   (same numbers glassCardStyle() always used). */
function normalizeLiquidGlassOptions(o) {
  const src = o && typeof o === "object" ? o : {};
  const blurNum = Number(src.blur);
  const opacityNum = Number(src.opacity);
  return {
    blur: Number.isFinite(blurNum) ? Math.min(40, Math.max(4, blurNum)) : 20,
    opacity: Number.isFinite(opacityNum) ? Math.min(0.95, Math.max(0.2, opacityNum)) : null,
    soft: !!src.soft,
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
/* ---- Analytics Summary widget — per-metric custom colors (this update) ----
   One override per metric ring/badge/value (Daily, Extry, Overall, Day
   Streak, Total Earned, Total Spent, Net Money), plus a shared field for
   every metric's label + percentage/value text — same pattern as the
   Analytics & Money element-color editors above. Empty string ("") means
   "use the built-in default" for that element. */
const ANALYTICS_SUMMARY_ELEMENT_COLOR_FIELDS = [
  { key: "daily", label: "Daily ring", defaultHex: C.accent },
  { key: "extry", label: "Extry ring", defaultHex: C.blue },
  { key: "overall", label: "Overall ring", defaultHex: C.dark },
  { key: "streak", label: "Day Streak badge", defaultHex: C.dark },
  { key: "earned", label: "Total Earned value", defaultHex: "#2e7d32" },
  { key: "spent", label: "Total Spent value", defaultHex: "#c0392b" },
  { key: "net", label: "Net Money value", defaultHex: C.dark },
  { key: "text", label: "Labels & percentage/value text", defaultHex: "#252422" },
];
function normalizeAnalyticsSummaryColors(t) {
  const src = t && typeof t === "object" ? t : {};
  const out = {};
  ANALYTICS_SUMMARY_ELEMENT_COLOR_FIELDS.forEach((f) => { out[f.key] = typeof src[f.key] === "string" ? src[f.key] : ""; });
  return out;
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
    friendCelebration: normalizeScopeTheme(src.friendCelebration),
    widgets: normalizeWidgetThemes(src.widgets),
    analyticsSummary: normalizeAnalyticsSummaryTheme(src.analyticsSummary),
    analyticsSummaryColors: normalizeAnalyticsSummaryColors(src.analyticsSummaryColors),
    analyticsColors: normalizeAnalyticsColors(src.analyticsColors),
    moneyColors: normalizeMoneyColors(src.moneyColors),
    panelPreset: typeof src.panelPreset === "string" ? src.panelPreset : "",
    liquidGlassOptions: normalizeLiquidGlassOptions(src.liquidGlassOptions),
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
    bigGoals: { w: 50, h: 172 }, lifeRules: { w: 50, h: 172 }, dailyGoals: { w: 50, h: 215 }, extryGoals: { w: 50, h: 215 },
    timeTable: { w: 50, h: 260 },
    earnMoney: { w: 50, h: 240 }, analyticsSummary: { w: 100, h: 260 }, calendar: { w: 50, h: 300 },
    clock: { w: 33, h: 320 },
    focusTimer: { w: 33, h: 340 },
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
     corrupted or hand-edited value can never break the grid layout
   - migrates old free-form saves too: before this update, `w` was a
     1–6 column span (out of a 6-column grid). Since the new free-form
     width scale's minimum (MIN_WIDGET_W) is well above 6, any stored
     value that small is unambiguously in the old scale — it gets
     rescaled onto the new 1–100 (%) scale instead of collapsing every
     existing widget down to a razor-thin sliver. */
function normalizeSize(size) {
  if (typeof size === "string") {
    return { w: LEGACY_SIZE_SPAN[size] || DEFAULT_WIDGET_W, h: LEGACY_SIZE_HEIGHT[size] || 215 };
  }
  if (size && typeof size === "object") {
    let rawW = Number(size.w);
    if (!Number.isFinite(rawW) || rawW <= 0) rawW = DEFAULT_WIDGET_W;
    if (rawW <= OLD_GRID_COLS) rawW = (rawW / OLD_GRID_COLS) * GRID_COLS; // migrate pre-update column span → %
    const w = Math.min(GRID_COLS, Math.max(MIN_WIDGET_W, Math.round(rawW)));
    const h = Math.min(MAX_WIDGET_H, Math.max(MIN_WIDGET_H, Math.round(Number(size.h) || 215)));
    return { w, h };
  }
  return { w: DEFAULT_WIDGET_W, h: 215 };
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
const GOAL_EMOJIS = [
  "🎯","💪","🏋️","🧘","📚","💧","🥗","😴","💰","💼","❤️","🧠","✍️","🎨","🏃","🚭","📵","🙏","🧹","📅","☎️","🌱","🎵","🛏️",
  // fitness / goal-tracking additions
  "🚴","🏊","🤸","🥊","⚽","🏀","🎾","🥇","🏆","📈","✅","🔥","⏰","🍎","🧃","🚶","🧗","🎓","📖","🧘‍♀️",
];

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

/* ---------------- TIME TABLE: item shape ----------------
   Simple time-of-day checklist rows: { time: "HH:MM" (24h, sorts and
   compares as plain strings), text, done, icon }. Kept deliberately
   lighter than GoalChecklist's item (no category/priority/subtasks) —
   this widget's whole point is "what happens at what time", not goal
   tracking. */
/* ---------------- TIME TABLE: category palette (this update) ----------------
   Powers both the little colored dot on each row and the new time-block
   breakdown pie chart (how many hours today went to Study vs Work vs Rest
   etc). Same "key + label + color" shape as CATEGORIES/SPEND_CATEGORIES
   above, kept as its own list since a day's schedule buckets don't map
   1:1 onto goal categories or spend categories. */
const TIME_CATEGORIES = [
  { key: "study", label: "Study", emoji: "📚", color: C.blue },
  { key: "work", label: "Work", emoji: "💼", color: C.accent },
  { key: "health", label: "Health", emoji: "💪", color: "#4a7c59" },
  { key: "rest", label: "Rest", emoji: "🛌", color: "#b083f0" },
  { key: "personal", label: "Personal", emoji: "🧑", color: "#f4d35e" },
  { key: "sleep", label: "Sleep", emoji: "😴", color: "#5c6bc0" },
  { key: "meals", label: "Meals", emoji: "🍽️", color: "#e07a5f" },
  { key: "commute", label: "Commute", emoji: "🚗", color: "#457b9d" },
  { key: "exercise", label: "Exercise", emoji: "🏋️", color: "#e63946" },
  { key: "family", label: "Family", emoji: "👨‍👩‍👧", color: "#f77f00" },
  { key: "social", label: "Social", emoji: "🎉", color: "#ff6f91" },
  { key: "chores", label: "Chores", emoji: "🧹", color: "#8d99ae" },
  { key: "finance", label: "Finance", emoji: "💰", color: "#2a9d8f" },
  { key: "hobby", label: "Hobby", emoji: "🎨", color: "#9d4edd" },
  { key: "meeting", label: "Meeting", emoji: "🗓️", color: "#219ebc" },
  { key: "other", label: "Other", emoji: "🔖", color: "#b3ac99" },
];
const timeCatInfo = (key) => TIME_CATEGORIES.find((c) => c.key === key) || TIME_CATEGORIES[TIME_CATEGORIES.length - 1];

/* ---------------- CUSTOM CATEGORY DROPDOWN (this update) ----------------
   Replaces the native <select> on the Time Table "add item" row — a plain
   OS-chrome popup with no room for the category's own emoji/color or any
   motion. Same portal + viewport-aware-flip + outside-click/scroll/resize
   pattern as EmojiPickerPortal above, so it behaves identically (never
   gets clipped by a widget's overflow:hidden, never gets stranded). */
function CategoryPickerPanel({ anchorRect, categories, value, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleDismiss = () => onClose();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [onClose]);

  if (!anchorRect || typeof document === "undefined") return null;

  const PANEL_W = 150;
  const PANEL_H = Math.min(260, categories.length * 34 + 10);
  const GAP = 6;
  const vw = window.innerWidth, vh = window.innerHeight;

  let left = anchorRect.left;
  if (left + PANEL_W > vw - 8) left = vw - PANEL_W - 8;
  if (left < 8) left = 8;
  const spaceBelow = vh - anchorRect.bottom;
  const openUp = spaceBelow < PANEL_H + GAP && anchorRect.top > PANEL_H + GAP;
  const top = openUp ? Math.max(8, anchorRect.top - PANEL_H - GAP) : anchorRect.bottom + GAP;

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: openUp ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: openUp ? 4 : -4 }}
      transition={{ type: "spring", stiffness: 440, damping: 30 }}
      style={{
        position: "fixed", top, left, width: PANEL_W, maxHeight: PANEL_H, overflowY: "auto", zIndex: 9999,
        borderRadius: 12, padding: 5,
        background: "rgba(255,253,247,0.94)", backdropFilter: "blur(18px) saturate(190%)", WebkitBackdropFilter: "blur(18px) saturate(190%)",
        border: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 16px 38px rgba(37,36,34,0.24)",
      }}
      className="btl-scroll"
    >
      {categories.map((c) => (
        <motion.div
          key={c.key}
          onClick={() => { onPick(c.key); onClose(); }}
          whileHover={{ x: 2, backgroundColor: hexToRgba(c.color, 0.14) }}
          style={{
            display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, padding: "7px 8px",
            borderRadius: 8, cursor: "pointer", color: C.text,
            background: c.key === value ? hexToRgba(c.color, 0.16) : "transparent",
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>{c.emoji}</span>
          <span style={{ flex: 1 }}>{c.label}</span>
          {c.key === value && <CheckCircle2 size={13} color={c.color} />}
        </motion.div>
      ))}
    </motion.div>,
    document.body
  );
}

function CategoryDropdown({ value, onChange, categories, accent }) {
  const [anchor, setAnchor] = useState(null); // DOMRect | null — open state doubles as "is anchor set"
  const current = categories.find((c) => c.key === value) || categories[categories.length - 1];

  return (
    <>
      <motion.button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, padding: "5px 8px",
          borderRadius: 7, border: `1px solid ${anchor ? accent : "#ddd6c4"}`, background: "#fff", cursor: "pointer",
          color: C.text, whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, lineHeight: 1 }}>{current.emoji}</span>
        <span>{current.label}</span>
        <motion.span animate={{ rotate: anchor ? 180 : 0 }} transition={{ duration: 0.18 }} style={{ display: "inline-flex", opacity: 0.55 }}>
          <ChevronDown size={11} />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {anchor && (
          <CategoryPickerPanel
            anchorRect={anchor} categories={categories} value={value}
            onPick={onChange} onClose={() => setAnchor(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------- CUSTOM TIME PICKER (this update) ----------------
   Replaces the native <input type="time"> on the same row — Chrome/Edge
   render that as a bare unstyled text box with a tiny grey clock glyph,
   totally off-brand next to the rest of the app. This is a small glass
   popover with scrollable hour/minute wheels + an AM/PM toggle; it still
   writes back the exact same "HH:MM" 24h string the rest of the app
   already stores in state.timeTable, so nothing downstream changes. */
function TimeWheelColumn({ items, value, onSelect, accent, fmt }) {
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-v="${value}"]`);
    if (el) el.scrollIntoView({ block: "center" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={listRef} className="btl-scroll" style={{ width: 42, maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((n) => (
        <motion.div
          key={n}
          data-v={n}
          onClick={() => onSelect(n)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          style={{
            textAlign: "center", fontSize: 12, fontWeight: 800, padding: "5px 0", borderRadius: 7, cursor: "pointer",
            background: n === value ? hexToRgba(accent, 0.18) : "transparent",
            color: n === value ? accent : C.text,
          }}
        >{fmt(n)}</motion.div>
      ))}
    </div>
  );
}

function TimePickerPanel({ anchorRect, value, onPick, onClose, accent }) {
  const ref = useRef(null);
  const [hh24, mm] = (value || "09:00").split(":").map(Number);
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  const isPM = hh24 >= 12;
  const commit = (h12, m, pm) => {
    let h24 = h12 % 12; if (pm) h24 += 12;
    onPick(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const handleDismiss = () => onClose();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [onClose]);

  if (!anchorRect || typeof document === "undefined") return null;

  const PANEL_W = 176;
  const PANEL_H = 196;
  const GAP = 6;
  const vw = window.innerWidth, vh = window.innerHeight;

  let left = anchorRect.left;
  if (left + PANEL_W > vw - 8) left = vw - PANEL_W - 8;
  if (left < 8) left = 8;
  const spaceBelow = vh - anchorRect.bottom;
  const openUp = spaceBelow < PANEL_H + GAP && anchorRect.top > PANEL_H + GAP;
  const top = openUp ? Math.max(8, anchorRect.top - PANEL_H - GAP) : anchorRect.bottom + GAP;

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94, y: openUp ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: openUp ? 4 : -4 }}
      transition={{ type: "spring", stiffness: 440, damping: 30 }}
      style={{
        position: "fixed", top, left, width: PANEL_W, zIndex: 9999,
        borderRadius: 12, padding: 8, display: "flex", gap: 6,
        background: "rgba(255,253,247,0.94)", backdropFilter: "blur(18px) saturate(190%)", WebkitBackdropFilter: "blur(18px) saturate(190%)",
        border: "1px solid rgba(255,255,255,0.65)", boxShadow: "0 16px 38px rgba(37,36,34,0.24)",
      }}
    >
      <TimeWheelColumn items={Array.from({ length: 12 }, (_, i) => i + 1)} value={hh12} onSelect={(h) => commit(h, mm, isPM)} accent={accent} fmt={(n) => String(n).padStart(2, "0")} />
      <TimeWheelColumn items={Array.from({ length: 60 }, (_, i) => i)} value={mm} onSelect={(m) => commit(hh12, m, isPM)} accent={accent} fmt={(n) => String(n).padStart(2, "0")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "center", flexShrink: 0 }}>
        {["AM", "PM"].map((p) => (
          <motion.button
            key={p} type="button"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
            onClick={() => commit(hh12, mm, p === "PM")}
            style={{
              border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer",
              background: (p === "PM") === isPM ? accent : "rgba(0,0,0,0.06)",
              color: (p === "PM") === isPM ? "#fff" : C.text,
            }}
          >{p}</motion.button>
        ))}
      </div>
    </motion.div>,
    document.body
  );
}

function TimePicker({ value, onChange, accent }) {
  const [anchor, setAnchor] = useState(null);
  const [hh24, mm] = (value || "09:00").split(":").map(Number);
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  const isPM = hh24 >= 12;

  return (
    <>
      <motion.button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "5px 8px",
          borderRadius: 7, border: `1px solid ${anchor ? accent : "#ddd6c4"}`, background: "#fff", cursor: "pointer",
          color: C.text, width: 88, flexShrink: 0,
        }}
      >
        <Clock size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
        <span>{String(hh12).padStart(2, "0")}:{String(mm).padStart(2, "0")} {isPM ? "PM" : "AM"}</span>
      </motion.button>
      <AnimatePresence>
        {anchor && (
          <TimePickerPanel anchorRect={anchor} value={value} onPick={onChange} onClose={() => setAnchor(null)} accent={accent} />
        )}
      </AnimatePresence>
    </>
  );
}

function ensureTimeItemDefaults(t) {
  return {
    id: t.id,
    time: typeof t.time === "string" && /^\d{2}:\d{2}$/.test(t.time) ? t.time : "09:00",
    text: t.text || "",
    done: !!t.done,
    icon: t.icon || "",
    category: TIME_CATEGORIES.some((c) => c.key === t.category) ? t.category : "other",
    // Repeats every day (rolloverDailyGoals unchecks it at the next date
    // change) when true; a one-off event that keeps whatever `done` state
    // it's left in when false. Defaults true since a schedule is usually
    // meant to repeat — flip it off per-row from the 🔁 icon on the row.
    recurring: t.recurring !== undefined ? !!t.recurring : true,
  };
}

function makeDefaultState() {
  const mk = (arr) => arr.map((t, i) => ensureGoalDefaults({ id: `${Date.now()}-${i}-${Math.random()}`, text: t, done: false }));
  const mkTime = (arr) => arr.map((t, i) => ensureTimeItemDefaults({ id: `${Date.now()}-tt-${i}-${Math.random()}`, time: t.time, text: t.text, category: t.category, done: false }));
  return {
    user: null,
    bigGoals: ["Become financially free", "Build a strong, healthy body", "Travel to 20 countries"],
    lifeRules: ["Wake up at 5 AM", "No phone before 9 AM", "Read 20 pages every day"],
    dailyGoals: mk(["Workout", "Meditate 10 min", "Read", "Drink 3L water", "Plan tomorrow", "No junk food", "Sleep by 11 PM", "Gratitude note"]),
    extryGoals: mk(["Learn something new", "Message a friend", "Save ₹100", "Fix one small thing", "Say no to a distraction", "Tidy workspace", "Review budget", "Reply pending messages"]),
    timeTable: mkTime([
      { time: "05:00", text: "Wake up", category: "personal" },
      { time: "05:30", text: "Workout", category: "health" },
      { time: "07:00", text: "Breakfast", category: "personal" },
      { time: "09:00", text: "Deep work", category: "work" },
      { time: "13:00", text: "Lunch", category: "personal" },
      { time: "18:00", text: "Read 20 pages", category: "study" },
      { time: "22:30", text: "Sleep", category: "rest" },
    ]),
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
    // Per-widget streaks & history (this update) — same idea as the global
    // streak/completionHistory above, but tracked independently per checklist
    // widget so "Time Table" or "Extry Goals" can each show their own 🔥 N and
    // their own 8-week heatmap instead of only the combined daily+extry one.
    widgetStreaks: { dailyGoals: 0, extryGoals: 0, timeTable: 0 },
    widgetLastCompletedDate: {}, // { dailyGoals: "2026-08-30", ... }
    widgetHistory: { dailyGoals: {}, extryGoals: {}, timeTable: {} }, // { dailyGoals: { "2026-08-30": 62.5 }, ... }
    // Analog Clock widget (this update) — alarms set by double-clicking a
    // spot on the clock face. { id, time: "HH:MM" (24h), label }[]. Fires
    // daily whenever the live clock reaches `time` (see the alarm-check
    // loop in BTLDashboardInner) until removed from the widget.
    clockAlarms: [],
    // Which of the 4 built-in ALARM_RINGTONES (see below) plays when an
    // alarm fires — changeable from Setting → Alarm.
    clockRingtone: "classic",
    // Focus Timer widget (this update) — per-category stopwatches (Screen
    // time / Social media / Deep work / Study by default, plus any custom
    // ones added from the widget's "add" popup). `active` holds the single
    // currently-running category as { categoryId, startTs }, or null; every
    // stop banks the elapsed seconds into `history[todayISO][categoryId]`,
    // which is what powers both the widget's own today-breakdown donut and
    // the Focus Time section in Analytics (trend + all-time breakdown).
    focusTimer: { categories: FOCUS_TIMER_DEFAULT_CATEGORIES.map((c) => ({ ...c })), active: null, history: {} },
    // Liquid Background settings (this update) — Setting → Background lets
    // the user recolor all 4 hues used by the gradient/blobs/particles,
    // dial the overall animation speed, and now flip the whole thing off.
    // Colors are hex (converted to the rgba "r,g,b" triples
    // LiquidBackground.jsx needs internally); speed is a plain multiplier,
    // 1 = original speed; enabled is the on/off switch — true by default so
    // existing installs keep looking exactly as they did before this field
    // existed.
    liquidBg: { colors: [...LIQUID_BG_DEFAULT_COLORS], speed: 1, enabled: true },
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
  if (s) {
    s.timeTable = (s.timeTable || []).map(ensureTimeItemDefaults);
    s.widgetStreaks = { dailyGoals: 0, extryGoals: 0, timeTable: 0, ...(s.widgetStreaks || {}) };
    s.widgetHistory = { dailyGoals: {}, extryGoals: {}, timeTable: {}, ...(s.widgetHistory || {}) };
    s.widgetLastCompletedDate = s.widgetLastCompletedDate || {};
    s.clockAlarms = Array.isArray(s.clockAlarms) ? s.clockAlarms : [];
    s.clockRingtone = ALARM_RINGTONES.some((r) => r.id === s.clockRingtone) ? s.clockRingtone : "classic";
    s.focusTimer = normalizeFocusTimer(s.focusTimer);
    // liquidBg sanitize — old saved states won't have this field at all,
    // and a stored color could in theory be a bad/empty string, so each of
    // the 4 slots falls back to its own default hex independently.
    const savedColors = (s.liquidBg && Array.isArray(s.liquidBg.colors)) ? s.liquidBg.colors : [];
    s.liquidBg = {
      colors: LIQUID_BG_DEFAULT_COLORS.map((def, i) => (/^#[0-9a-fA-F]{6}$/.test(savedColors[i]) ? savedColors[i] : def)),
      speed: Number.isFinite(s.liquidBg?.speed) && s.liquidBg.speed > 0 ? Math.min(3, Math.max(0.4, s.liquidBg.speed)) : 1,
      // enabled sanitize — old saved states won't have this field at all;
      // default to true (on) so nobody's existing background silently
      // disappears just because they saved state before this toggle existed.
      enabled: typeof s.liquidBg?.enabled === "boolean" ? s.liquidBg.enabled : true,
    };
  }
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

/* Icon-only header action button — used for Focus Mode / Setting / Share
   Journey. Circular, no visible label (title attr gives the name on
   hover instead), with a soft looping glow ring pulsing behind the icon
   so these read as "alive" buttons rather than flat static icons. */
function GlowIconButton({ icon: Icon, label, active, color, onClick, filled }) {
  const bg = active || filled ? color : "#fff";
  const fg = active || filled ? "#fff" : color;
  return (
    <motion.button
      onClick={onClick}
      title={label}
      aria-label={label}
      whileHover={{ y: -3, scale: 1.08 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 420, damping: 20 }}
      style={{
        position: "relative", width: 34, height: 34, borderRadius: "50%",
        border: `1.5px solid ${color}`, background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, padding: 0,
      }}
    >
      <motion.span
        aria-hidden
        animate={{ boxShadow: [`0 0 0px 0px ${color}00`, `0 0 9px 2px ${color}66`, `0 0 0px 0px ${color}00`] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: -3, borderRadius: "50%", pointerEvents: "none" }}
      />
      <Icon size={15} />
    </motion.button>
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

function RingStat({ pct, size = 54, label, sub, color = C.accent, textColor }) {
  const dt = useContext(DashboardThemeCtx);
  const safeTextColor = textColor || dt.text || C.dark;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circ - (clamped / 100) * circ;
  const isFull = clamped >= 100;
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.07 }}
      transition={{ type: "spring", stiffness: 380, damping: 20 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "default" }}
    >
      <motion.svg
        width={size} height={size} style={{ transform: "rotate(-90deg)" }}
        animate={isFull
          ? { filter: [`drop-shadow(0 0 0px ${color}00)`, `drop-shadow(0 0 6px ${color}aa)`, `drop-shadow(0 0 0px ${color}00)`] }
          : undefined}
        transition={isFull ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e9e4d3" strokeWidth={5} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5} fill="none"
          strokeDasharray={circ} strokeLinecap="round"
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
        <text x={size / 2} y={size / 2} transform={`rotate(90 ${size / 2} ${size / 2})`}
          textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill={safeTextColor}>
          {Math.round(pct)}%
        </text>
      </motion.svg>
      <div style={{ fontSize: 9, fontWeight: 700, color: safeTextColor, textAlign: "center", lineHeight: 1.1 }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color: safeTextColor, opacity: 0.65 }}>{sub}</div>}
    </motion.div>
  );
}

/* ---------------- DAY STREAK BADGE — "pro max" 3D medal ----------------
   A metallic coin-style badge with real depth: CSS 3D transforms (perspective +
   preserve-3d) give it a tilt that follows the cursor, a rotating conic-gradient
   rim simulates a spinning metal edge, an orbiting flame flickers behind the
   number, tiny sparks drift around it, a diagonal shine sweeps across the face
   on a loop, and the streak number does a 3D flip-roll whenever it changes.
   Everything here is framer-motion + CSS — no new dependencies. */
function DayStreakBadge({ streak, accent = C.accent, dark = C.dark }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const sparks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        angle: (360 / 6) * i,
        delay: i * 0.28,
        dist: 20 + (i % 2) * 4,
      })),
    []
  );

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -28, y: px * 28 });
  };
  const handleLeave = () => {
    setHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  const streakStr = String(streak).padStart(3, "0");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div
        style={{ perspective: 500, width: 36, height: 36, position: "relative" }}
        onMouseMove={handleMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={handleLeave}
      >
        {/* Ambient pulsing halo */}
        <motion.span
          aria-hidden
          animate={{
            boxShadow: [
              `0 0 0px 0px ${accent}00`,
              `0 0 14px 3px ${accent}90`,
              `0 0 0px 0px ${accent}00`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -4, borderRadius: "50%", pointerEvents: "none" }}
        />

        {/* Drifting sparks */}
        {sparks.map((s) => (
          <motion.span
            key={s.id}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
              x: [0, Math.cos((s.angle * Math.PI) / 180) * s.dist],
              y: [0, Math.sin((s.angle * Math.PI) / 180) * s.dist],
              scale: [0.3, 1, 0.3],
            }}
            transition={{ duration: 2.4, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
            style={{
              position: "absolute", top: "50%", left: "50%", width: 3, height: 3, borderRadius: "50%",
              background: accent, marginTop: -1.5, marginLeft: -1.5, pointerEvents: "none",
            }}
          />
        ))}

        {/* Spinning conic rim (simulated brushed-metal edge) */}
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", inset: 0, borderRadius: "50%", padding: 2,
            background: `conic-gradient(from 0deg, ${accent}, #fff4, ${dark}, ${accent})`,
          }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: dark }} />
        </motion.div>

        {/* Tilting coin face */}
        <motion.div
          title="Day Streak"
          animate={{
            rotateX: tilt.x,
            rotateY: tilt.y,
            scale: hovering ? 1.14 : 1,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          style={{
            position: "absolute", inset: 3, borderRadius: "50%", transformStyle: "preserve-3d",
            background: `radial-gradient(circle at 35% 30%, ${accent}dd, ${dark} 70%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", cursor: "default",
          }}
        >
          {/* Flickering flame, tucked just behind the number */}
          <motion.span
            aria-hidden
            animate={{ opacity: [0.25, 0.55, 0.3], scale: [0.9, 1.08, 0.95], rotate: [-4, 4, -4] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", top: -3, color: "#ffd27a", filter: "blur(0.3px)" }}
          >
            <Flame size={13} fill="#ffb347" />
          </motion.span>

          {/* Flip-roll number readout */}
          <div style={{ position: "relative", height: 12, display: "flex", alignItems: "center", perspective: 200 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={streakStr}
                initial={{ rotateX: 90, opacity: 0, y: -4 }}
                animate={{ rotateX: 0, opacity: 1, y: 0 }}
                exit={{ rotateX: -90, opacity: 0, y: 4 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{
                  fontSize: 10.5, fontWeight: 900, color: "#fff", letterSpacing: 0.3,
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)", display: "inline-block",
                }}
              >
                {streakStr}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Diagonal shine sweep */}
          <motion.span
            aria-hidden
            animate={{ x: ["-120%", "220%"] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
            style={{
              position: "absolute", top: -10, bottom: -10, width: "35%",
              background: "linear-gradient(75deg, transparent, rgba(255,255,255,0.45), transparent)",
              transform: "skewX(-20deg)", pointerEvents: "none",
            }}
          />
        </motion.div>
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: dark, opacity: 0.65, letterSpacing: 0.3 }}>Streak</div>
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
      whileHover={{ y: -2, scale: 1.06 }} whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      style={{
        position: "relative",
        border: `2px solid ${open ? C.accent : "transparent"}`, borderRadius: "50%", padding: 0,
        background: "transparent", cursor: "pointer", lineHeight: 0, display: "flex",
      }}
    >
      <motion.span
        aria-hidden
        animate={{ boxShadow: [`0 0 0px 0px ${C.blue}00`, `0 0 8px 2px ${C.blue}60`, `0 0 0px 0px ${C.blue}00`] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: -3, borderRadius: "50%", pointerEvents: "none" }}
      />
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
    { key: "fitness", label: "Fitness", icon: Dumbbell, bg: "#e85d4c", fg: "#fff", onClick: () => { setTab("fitness"); setOpen(false); } },
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
        border: `1px solid ${C.text}`, borderRadius: 8, flex: 1, overflowY: "auto", ...glassCardStyle(cardBg),
      }} className="btl-scroll">
        {items.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, color: autoMutedColor(cardBg), textAlign: "center" }}>
            Nothing yet — add one from Setting.
          </div>
        )}
        {items.map((t, i) => (
          <div key={i} className="btl-goal-row" style={{
            display: "flex", alignItems: "center",
            padding: "8px 10px", borderBottom: i < items.length - 1 ? "1px solid #f0ece0" : "none",
            fontSize: itemFontSize, fontWeight: itemWeight, color: itemColor || autoTextColor(cardBg), fontFamily: itemFontFamily,
          }}>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- DAILY / EXTRY GOAL CHECKLIST (pro: categories, priority, recurring, subtasks) ---------------- */
/* ---------------- EMOJI PICKER — portal-rendered, viewport-aware ----------------
   Fix: the old picker was position:absolute inside the scrollable goal list,
   so for rows near the bottom (e.g. the last item) it got clipped by the
   list's own overflow — it barely peeked out, cut in half. This version
   renders through a React portal straight onto <body>, is positioned with
   the trigger's real on-screen coordinates (position: fixed), flips itself
   upward automatically when there isn't enough room below, and closes
   itself on outside-click, scroll, or resize so it never gets stranded. */
function EmojiPickerPortal({ anchorRect, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleDismiss = () => onClose();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [onClose]);

  if (!anchorRect || typeof document === "undefined") return null;

  const PICKER_W = 168;
  const PICKER_H = 196;
  const GAP = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.left;
  if (left + PICKER_W > vw - 8) left = vw - PICKER_W - 8;
  if (left < 8) left = 8;

  const spaceBelow = vh - anchorRect.bottom;
  const openUp = spaceBelow < PICKER_H + GAP && anchorRect.top > PICKER_H + GAP;
  const top = openUp ? Math.max(8, anchorRect.top - PICKER_H - GAP) : anchorRect.bottom + GAP;

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9, y: openUp ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      style={{
        position: "fixed", top, left, zIndex: 9999, background: "#fff", border: "1px solid #ddd6c4",
        borderRadius: 8, padding: 6, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2,
        boxShadow: "0 12px 28px rgba(0,0,0,0.2)", width: PICKER_W, maxHeight: "min(70vh, 260px)", overflowY: "auto",
      }}
      className="btl-scroll"
    >
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
    </motion.div>,
    document.body
  );
}

/* ---------------- Checkbox-tick "earthquake" jitter (this update) ----------------
   When a checkbox is ticked, the row around it — checkbox, dot/rail, and
   the item's words — should visibly "quake" for a beat instead of just
   fading in a flash. Amplitude is derived from the checkbox's own size
   (14px) so the shake reads as coming from that exact spot, not an
   arbitrary wobble. Shared by GoalChecklist (Daily/Extry Goals) and
   TimeTable, since both already drive their per-row "just completed"
   state through the same `isCelebrating` flag. Settles out (decaying
   amplitude) rather than stopping abruptly. */
const QUAKE_UNIT = 14; // matches the checkbox's width/height
function quakeAnimate(isCelebrating) {
  if (!isCelebrating) return { x: 0, y: 0, rotate: 0 };
  const a = QUAKE_UNIT * 0.26; // ~3.6px peak displacement, scaled to checkbox size
  return {
    x: [0, -a, a * 0.85, -a * 0.6, a * 0.35, -a * 0.15, 0],
    y: [0, a * 0.4, -a * 0.3, a * 0.2, -a * 0.1, a * 0.05, 0],
    rotate: [0, -1.1, 1, -0.6, 0.3, -0.1, 0],
    transition: { duration: 0.45, ease: "easeInOut", times: [0, 0.18, 0.36, 0.54, 0.7, 0.85, 1] },
  };
}

function GoalChecklist({ title, items, onToggle, onAdd, onRemove, onToggleSubtask, onAddSubtask, onSetIcon, accent, textStyle, cardBg, streak = 0, history = {} }) {
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
  const [picker, setPicker] = useState(null); // { id: "new" | goal id, rect: DOMRect } | null
  const [celebrateId, setCelebrateId] = useState(null); // goal id currently flashing "done" celebration
  const [showHeat, setShowHeat] = useState(false);

  // ---- Progress nudge at 50% subtasks (this update) ----
  // Tracks each goal's last-seen subtask completion ratio; the moment a
  // goal crosses from <50% to >=50% (and isn't fully done yet — that
  // already gets its own full "done" celebration), a small "Halfway
  // there" pill flashes on that row for a second and a half.
  const subtaskRatioRef = useRef({});
  const [nudgeId, setNudgeId] = useState(null);
  useEffect(() => {
    (items || []).forEach((g) => {
      const total = (g.subtasks || []).length;
      if (total === 0) return;
      const done = g.subtasks.filter((s) => s.done).length;
      const ratio = done / total;
      const prevRatio = subtaskRatioRef.current[g.id] ?? 0;
      if (prevRatio < 0.5 && ratio >= 0.5 && ratio < 1) {
        setNudgeId(g.id);
        setTimeout(() => setNudgeId((cur) => (cur === g.id ? null : cur)), 1600);
      }
      subtaskRatioRef.current[g.id] = ratio;
    });
  }, [items]);

  // ---- Swipe-to-complete on mobile (this update) ----
  // Alongside the checkbox (still there, still works everywhere), a
  // touch device can swipe a goal row right to complete it or, if
  // already done, swipe it left to undo — dragX tracks each row's
  // live drag offset (keyed by goal id) purely for the reveal-behind
  // background below; the actual toggle only commits past a ~60px
  // threshold on release, and desktop mouse users never see this
  // (isTouch stays false, drag is disabled entirely).
  const isTouch = useIsTouchDevice();
  const [dragX, setDragX] = useState({});

  const handleToggle = (id, wasDone) => {
    onToggle(id);
    if (!wasDone) {
      setCelebrateId(id);
      setTimeout(() => setCelebrateId((c) => (c === id ? null : c)), 700);
    }
  };

  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim(), { category, priority, recurring, icon });
    setVal(""); setIcon("");
  };

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <ChecklistHeader title={title} streak={streak} accent={accent} showHeat={showHeat} onToggleHeat={() => setShowHeat((v) => !v)} />
      <AnimatePresence initial={false}>
        {showHeat && <WidgetHeatmapPanel history={history} accent={accent} />}
      </AnimatePresence>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 8, ...glassCardStyle(cardBg) }} className="btl-scroll">
        <AnimatePresence initial={false}>
          {items.map((g) => {
            const cat = catInfo(g.category);
            const prio = prioInfo(g.priority);
            const isOpen = openId === g.id;
            const subDone = (g.subtasks || []).filter((s) => s.done).length;
            const isCelebrating = celebrateId === g.id;
            const dx = dragX[g.id] || 0;
            return (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, x: 80, height: 0, transition: { duration: 0.22, ease: "easeIn" } }}
                transition={{ type: "spring", stiffness: 480, damping: 32 }}
                className="btl-goal-row"
                style={{ borderBottom: "1px solid #f0ece0", borderLeft: `3px solid ${cat.color}`, position: "relative", overflow: "hidden" }}
              >
                <AnimatePresence>
                  {isCelebrating && (
                    <motion.div
                      key="celebrate-flash"
                      initial={{ opacity: 0.35 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      style={{ position: "absolute", inset: 0, background: cat.color, pointerEvents: "none" }}
                    />
                  )}
                </AnimatePresence>
                {isTouch && dx !== 0 && (
                  <div style={{
                    position: "absolute", inset: 0, zIndex: 0, display: "flex", alignItems: "center", pointerEvents: "none",
                    justifyContent: dx > 0 ? "flex-start" : "flex-end", paddingLeft: 16, paddingRight: 16,
                    background: dx > 0 ? "rgba(74,124,89,0.18)" : "rgba(192,57,43,0.14)",
                    opacity: Math.min(Math.abs(dx) / 60, 1),
                  }}>
                    {dx > 0
                      ? <CheckCircle2 size={16} style={{ color: "#4a7c59" }} />
                      : <RotateCcw size={16} style={{ color: "#c0392b" }} />}
                  </div>
                )}
                <AnimatePresence>
                  {nudgeId === g.id && (
                    <motion.div
                      key="halfway-nudge"
                      initial={{ opacity: 0, y: -4, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.9 }}
                      transition={{ duration: 0.25 }}
                      style={{
                        position: "absolute", top: 3, right: 4, zIndex: 2, pointerEvents: "none",
                        fontSize: 8, fontWeight: 800, color: "#fff", background: accent,
                        borderRadius: 20, padding: "2px 7px", display: "flex", alignItems: "center", gap: 3,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                      }}
                    >
                      <Sparkles size={9} /> Halfway there
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div
                  drag={isTouch ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDrag={(e, info) => setDragX((prev) => ({ ...prev, [g.id]: info.offset.x }))}
                  onDragEnd={(e, info) => {
                    const offset = info.offset.x;
                    setDragX((prev) => ({ ...prev, [g.id]: 0 }));
                    if (!g.done && offset > 60) handleToggle(g.id, g.done);
                    else if (g.done && offset < -60) handleToggle(g.id, g.done);
                  }}
                  animate={quakeAnimate(isCelebrating)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 4px 6px 6px", position: "relative", zIndex: 1,
                    color: g.done ? autoMutedColor(cardBg) : autoTextColor(cardBg),
                    touchAction: isTouch ? "pan-y" : undefined,
                  }}>
                  <motion.input
                    type="checkbox" checked={g.done} onChange={() => handleToggle(g.id, g.done)}
                    className="btl-check" style={{ accentColor: accent, width: 14, height: 14, flexShrink: 0, cursor: "pointer" }}
                    whileTap={{ scale: 0.8 }}
                    animate={isCelebrating ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                  <span style={{ position: "relative", flexShrink: 0 }}>
                    <motion.span
                      whileHover={{ scale: 1.2, rotate: 8 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => setPicker(picker?.id === g.id ? null : { id: g.id, rect: e.currentTarget.getBoundingClientRect() })}
                      title="Set icon" style={{ cursor: "pointer", fontSize: 12, width: 16, display: "inline-flex", justifyContent: "center" }}
                    >{g.icon || "＋"}</motion.span>
                    <AnimatePresence>
                      {picker?.id === g.id && (
                        <EmojiPickerPortal anchorRect={picker.rect} onPick={(e) => onSetIcon(g.id, e)} onClose={() => setPicker(null)} />
                      )}
                    </AnimatePresence>
                  </span>
                  <motion.span
                    style={{
                      flex: 1, fontSize: itemFontSize, cursor: "pointer", fontFamily: itemFontFamily,
                      fontWeight: itemWeight, color: !g.done && itemColorOverride ? itemColorOverride : undefined,
                      display: "inline-block",
                    }}
                    animate={{
                      textDecoration: g.done ? "line-through" : "none",
                      opacity: g.done ? 0.65 : 1,
                      scale: isCelebrating ? [1, 1.06, 1] : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleToggle(g.id, g.done)}
                  >{g.text}</motion.span>
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
                  <motion.button
                    onClick={() => setOpenId(isOpen ? null : g.id)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 0, flexShrink: 0, color: "#c9c2ac" }}
                  >
                    <ChevronDown size={12} />
                  </motion.button>
                  <motion.span
                    whileHover={{ scale: 1.2, rotate: -10, color: "#e07a5f" }}
                    whileTap={{ scale: 0.85 }}
                    style={{ display: "inline-flex", flexShrink: 0 }}
                  >
                    <Trash2 size={11} style={{ color: "#d8d2bf", cursor: "pointer" }} onClick={() => onRemove(g.id)} />
                  </motion.span>
                </motion.div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="subtasks"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ padding: "2px 8px 8px 22px", background: "#fbf9f2" }}>
                        <div style={{ fontSize: 8, color: "#a39c86", marginBottom: 3 }}>
                          <Tag size={9} style={{ verticalAlign: -1, marginRight: 3 }} />{cat.label}
                        </div>
                        <AnimatePresence initial={false}>
                          {(g.subtasks || []).map((s) => (
                            <motion.label
                              key={s.id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 8 }}
                              transition={{ duration: 0.2 }}
                              style={{
                                display: "flex", alignItems: "center", gap: 5, fontSize: subFontSize, padding: "2px 0", cursor: "pointer",
                                textDecoration: s.done ? "line-through" : "none", fontFamily: itemFontFamily, fontWeight: itemWeight,
                                color: s.done ? autoMutedColor(cardBg) : (itemColorOverride || autoTextColor(cardBg)),
                              }}
                            >
                              <motion.input
                                type="checkbox" checked={s.done} onChange={() => onToggleSubtask(g.id, s.id)}
                                whileTap={{ scale: 0.8 }}
                                style={{ width: 11, height: 11, accentColor: accent }}
                              />
                              {s.text}
                            </motion.label>
                          ))}
                        </AnimatePresence>
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <input
                            value={openId === g.id ? subVal : ""} onChange={(e) => setSubVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && subVal.trim()) { onAddSubtask(g.id, subVal.trim()); setSubVal(""); } }}
                            placeholder="Add sub-task..."
                            style={{ flex: 1, fontSize: 9, padding: "3px 6px", borderRadius: 5, border: "1px solid #ece7d8", outline: "none" }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div style={{ marginTop: 6, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={(e) => setPicker(picker?.id === "new" ? null : { id: "new", rect: e.currentTarget.getBoundingClientRect() })} title="Pick an icon"
              style={{ border: "1px solid #ddd6c4", background: "#fff", borderRadius: 6, width: 26, height: "100%", cursor: "pointer", fontSize: 12 }}>
              {icon || "🙂"}
            </button>
            <AnimatePresence>
              {picker?.id === "new" && (
                <EmojiPickerPortal anchorRect={picker.rect} onPick={(e) => setIcon(e)} onClose={() => setPicker(null)} />
              )}
            </AnimatePresence>
          </span>
          <input
            value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Add item..."
            style={{ flex: 1, fontSize: 10, padding: "5px 7px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
          />
          <motion.button
            onClick={() => setShowOptions((v) => !v)} title="Category / priority / recurring"
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            style={{ border: "1px solid #ddd6c4", background: showOptions ? "#f0ece0" : "#fff", borderRadius: 6, padding: "0 7px", cursor: "pointer", fontSize: 10 }}>
            <Tag size={12} />
          </motion.button>
          <motion.button
            onClick={submit}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.85, rotate: 90 }}
            style={{ border: "none", background: accent, color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer" }}>
            <Plus size={13} />
          </motion.button>
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

/* ---------------- TIME TABLE (this update) ----------------
   A scheduled, time-of-day checklist — "05:00 Wake up", "07:00
   Breakfast", etc — auto-sorted by time, with a live "NOW" pulse on
   the next upcoming slot so it reads like a real daily timetable
   instead of just another goal list. Shares the tick / strike-through
   / celebration language of GoalChecklist for visual consistency, plus
   its own small check-burst (hand-built with framer-motion — SVG ring
   draw + radiating dots — so it needs no extra runtime asset). */
function formatTime12(hhmm) {
  if (typeof hhmm !== "string" || !hhmm.includes(":")) return hhmm || "";
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return hhmm;
  const m = (mStr || "00").padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/* ---------------- TIME TABLE: reminder chime (this update) ----------------
   Two-tone beep built straight from the Web Audio API — no MP3/asset file
   to bundle, so "sound on NOW slot" works the instant this ships. Wrapped
   in try/catch: silently does nothing on a browser/tab where audio isn't
   allowed yet (autoplay policies) instead of throwing. */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.4);
    o.stop(ctx.currentTime + 0.6);
    o.onended = () => ctx.close();
  } catch (e) { /* audio not available — fine, notification still fires */ }
}

/* ================================================================
   ANALOG CLOCK & ALARM (this update)
   A live analog clock face — hour/minute/second hands driven by the
   real system time, redrawn every second — that doubles as a quick
   alarm setter: hover anywhere on the dial and a small popup shows
   the time at that exact angle; double-click there to arm an alarm
   for it. When the live clock reaches an armed alarm's time, a glass
   "Liquid Glass" popup pulses onto the dashboard (see AlarmRingModal)
   with a selectable ringtone that rings for up to 30s or until
   dismissed via "Done". All 4 ringtones are synthesized live with the
   Web Audio API (same technique as the Time Table chime above) — no
   audio files to bundle, and instantly available offline.
   ================================================================ */
const ALARM_RINGTONES = [
  { id: "classic", label: "Classic Beep" },
  { id: "chime", label: "Gentle Chime" },
  { id: "digital", label: "Digital Pulse" },
  { id: "bell", label: "Bell Toll" },
];
function ringtoneLabel(id) { return (ALARM_RINGTONES.find((r) => r.id === id) || ALARM_RINGTONES[0]).label; }

/* Schedules one oscillator note with a short attack/decay envelope so
   nothing clicks/pops — shared by every ringtone below. */
function playAlarmTone(ctx, { freq, start, dur, type = "sine", peak = 0.18, glideTo }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + start + dur);
  g.gain.value = 0.0001;
  o.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + Math.min(0.03, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.03);
}
/* Plays one full cycle of the given ringtone id on a shared AudioContext
   and returns the cycle's duration in ms, so a caller can schedule the
   next repeat back-to-back for a smooth, gapless loop. */
function playRingtoneCycle(ctx, id) {
  if (id === "chime") {
    [523.25, 659.25, 783.99].forEach((f, i) => playAlarmTone(ctx, { freq: f, start: i * 0.18, dur: 0.32, type: "triangle", peak: 0.16 }));
    return 900;
  }
  if (id === "digital") {
    [0, 0.16, 0.32].forEach((start) => playAlarmTone(ctx, { freq: 1180, start, dur: 0.11, type: "square", peak: 0.1 }));
    return 700;
  }
  if (id === "bell") {
    playAlarmTone(ctx, { freq: 660, start: 0, dur: 1.1, type: "sine", peak: 0.17 });
    playAlarmTone(ctx, { freq: 1320, start: 0, dur: 0.7, type: "sine", peak: 0.06 });
    return 1300;
  }
  // "classic" (default) — two quick descending beeps
  playAlarmTone(ctx, { freq: 880, start: 0, dur: 0.3, type: "sine", peak: 0.18, glideTo: 660 });
  playAlarmTone(ctx, { freq: 880, start: 0.38, dur: 0.3, type: "sine", peak: 0.18, glideTo: 660 });
  return 850;
}
/* One-shot preview — used by the ▶ button in Setting → Alarm. Own
   short-lived AudioContext that closes itself once the cycle ends. */
function previewRingtone(id) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const dur = playRingtoneCycle(ctx, id);
    setTimeout(() => ctx.close(), dur + 200);
  } catch (e) { /* audio not available — preview silently no-ops */ }
}
const ALARM_MAX_RING_MS = 30 * 1000; // "alarm 30 second tak" — hard ceiling even if never dismissed
/* Loops a ringtone (gapless repeats) until stop() is called or
   ALARM_MAX_RING_MS elapses. Returns stop(). Used while the
   AlarmRingModal is on screen (see the effect in BTLDashboardInner). */
function startAlarmRingtone(id) {
  let stopped = false, ctx = null, timer = null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) ctx = new AudioCtx();
  } catch (e) { /* ignore — alarm still shows visually even if audio is blocked */ }
  const tick = () => {
    if (stopped || !ctx) return;
    const dur = playRingtoneCycle(ctx, id);
    timer = setTimeout(tick, dur);
  };
  if (ctx) tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (ctx) { try { ctx.close(); } catch (e) { /* already closed */ } }
  };
}

/* ---- Clock-face angle <-> time math ---- 0deg = 12 o'clock, clockwise. */
function clockAngleToTime12(angleDeg) {
  const totalMin = (angleDeg / 360) * 12 * 60; // 0..720 across the 12h dial
  const hh12 = Math.floor(totalMin / 60) % 12; // 0..11 (0 == "12")
  const mm = Math.round(totalMin % 60) % 60;
  return { hh12, mm };
}
/* A bare dial reading (e.g. "3:00") is ambiguous between AM and PM —
   this picks whichever real 24h time is soonest from now, so
   double-clicking always arms the *next* occurrence of that spot. */
function nearestFutureTime(hh12, mm, now) {
  const candidates = [hh12, (hh12 + 12) % 24];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = candidates[0], bestDelta = Infinity;
  candidates.forEach((h) => {
    let delta = (h * 60 + mm) - nowMin;
    if (delta < 0) delta += 24 * 60;
    if (delta < bestDelta) { bestDelta = delta; best = h; }
  });
  return { hh: best, mm };
}

/* ---- The widget itself ---- */
function AnalogClockWidget({ alarms = [], ringtoneId, onSetAlarm, onRemoveAlarm, cardBg, accent }) {
  const [now, setNow] = useState(() => new Date());
  const [hover, setHover] = useState(null);   // { x, y, hh12, mm } | null
  const [justSet, setJustSet] = useState(null); // "HH:MM" (24h) confirmation flash
  const svgRef = useRef(null);

  // ---- Real-time tick: a plain 1s interval updates `now`, which every
  // hand's position is computed straight from on each render (see below).
  // Also force an immediate resync when the tab/window regains focus, since
  // a backgrounded tab's timers get throttled and can lag behind briefly. */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const resync = () => { if (document.visibilityState === "visible") setNow(new Date()); };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
  }, []);

  const sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours();
  const secAngle = sec * 6;
  const minAngle = min * 6 + sec * 0.1;
  const hrAngle = (hr % 12) * 30 + min * 0.5;
  const CX = 100, CY = 100, R = 88;

  // ---- Hand endpoints computed directly, in plain trig, from `now` on
  // every render — no framer-motion "animate"/rotate + CSS transform-origin
  // in between. That indirection was the actual freeze: it hands control of
  // the on-screen position to a separate animation-state object that only
  // *starts* moving when framer-motion's own effect notices the target
  // changed, and a re-render elsewhere (Firestore autosave, drag state,
  // etc.) landing at the wrong moment could leave that animation never
  // kicked off, so the needle just sat at its last position while the
  // digital readout kept ticking. Plotting (x,y) straight from the angle
  // every render removes that middle-man entirely — the hand is always
  // exactly where `now` says it should be, full stop. */
  const handPoint = (angleDeg, r) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + Math.sin(rad) * r, y: CY - Math.cos(rad) * r };
  };
  const hrTip = handPoint(hrAngle, 42);
  const minTip = handPoint(minAngle, 62);
  const secTip = handPoint(secAngle, 76);
  const secTail = handPoint(secAngle + 180, 14);

  const angleFromEvent = (e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 200;
    const y = ((e.clientY - rect.top) / rect.height) * 200;
    const dx = x - CX, dy = y - CY;
    const dist = Math.hypot(dx, dy);
    if (dist > R + 4 || dist < 8) return null; // ignore outside the dial / dead center
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    return angle;
  };
  const handleMove = (e) => {
    const angle = angleFromEvent(e);
    if (angle == null) { setHover(null); return; }
    const { hh12, mm } = clockAngleToTime12(angle);
    const rect = svgRef.current.getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, hh12, mm });
  };
  const handleDoubleClick = (e) => {
    const angle = angleFromEvent(e);
    if (angle == null) return;
    const { hh12, mm } = clockAngleToTime12(angle);
    const { hh, mm: mm2 } = nearestFutureTime(hh12, mm, now);
    const time = `${String(hh).padStart(2, "0")}:${String(mm2).padStart(2, "0")}`;
    if (!alarms.some((a) => a.time === time)) onSetAlarm(time);
    setJustSet(time);
    setTimeout(() => setJustSet((v) => (v === time ? null : v)), 1200);
  };

  const digital = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const textColor = autoTextColor(cardBg);
  const mutedColor = autoMutedColor(cardBg);

  return (
    <div style={{ borderRadius: 8, padding: 10, width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6, overflow: "hidden", ...glassCardStyle(cardBg) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: 5 }}>
          <AlarmClock size={13} /> Clock & Alarm
        </span>
        {alarms.length > 0 && (
          <span style={{ fontSize: 9, fontWeight: 800, color: mutedColor, display: "flex", alignItems: "center", gap: 3 }}>
            <Bell size={10} /> {alarms.length}
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 0, position: "relative" }}>
        {/* ---- Tight 150×150 wrapper around the dial (this update) ----
            Previously the hover tooltip/flash were positioned "absolute"
            against the outer flex column above — which is wider than the
            150×150 <svg> itself (it stretches to center the dial). Since
            `hover.x/y` are measured relative to the SVG's own box (see
            handleMove below), that mismatch let the tooltip land anywhere
            up to the full widget width away from the actual cursor once
            offset math was applied — occasionally rendering it clipped
            against the widget's edge, disconnected from the dial. Giving
            the dial its own exactly-sized relative wrapper makes hover.x/y
            map 1:1 onto CSS left/top here, so the tooltip always renders
            exactly where the cursor is on the dial — never off to a side. */}
        <div style={{ position: "relative", width: 150, height: 150 }}>
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          width="150" height="150"
          style={{ cursor: "crosshair", touchAction: "none", overflow: "visible" }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onDoubleClick={handleDoubleClick}
        >
          <circle cx={CX} cy={CY} r={R} fill={hexToRgba(cardBg || "#fffdf7", 0.35)} stroke={mutedColor} strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const isMajor = i % 3 === 0;
            const r1 = isMajor ? R - 12 : R - 7;
            const x1 = CX + Math.sin(a) * r1, y1 = CY - Math.cos(a) * r1;
            const x2 = CX + Math.sin(a) * (R - 2), y2 = CY - Math.cos(a) * (R - 2);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={textColor} strokeWidth={isMajor ? 2 : 1} opacity={isMajor ? 0.8 : 0.4} strokeLinecap="round" />;
          })}
          {Array.from({ length: 12 }).map((_, i) => {
            const num = i === 0 ? 12 : i;
            const a = (i * 30 * Math.PI) / 180;
            const r1 = R - 22;
            const x = CX + Math.sin(a) * r1, y = CY - Math.cos(a) * r1;
            return <text key={i} x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="800" fill={textColor} opacity={0.75}>{num}</text>;
          })}
          {alarms.map((a) => {
            const [ah, am] = a.time.split(":").map(Number);
            const dialAngle = (ah % 12) * 30 + am * 0.5;
            const rad = (dialAngle * Math.PI) / 180;
            const r1 = R - 4;
            const x = CX + Math.sin(rad) * r1, y = CY - Math.cos(rad) * r1;
            return <circle key={a.id} cx={x} cy={y} r="4" fill={accent} stroke="#fff" strokeWidth="1" />;
          })}
          <line x1={CX} y1={CY} x2={hrTip.x} y2={hrTip.y} stroke={textColor} strokeWidth="4.5" strokeLinecap="round" />
          <line x1={CX} y1={CY} x2={minTip.x} y2={minTip.y} stroke={textColor} strokeWidth="3" strokeLinecap="round" />
          <line x1={secTail.x} y1={secTail.y} x2={secTip.x} y2={secTip.y} stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx={CX} cy={CY} r="4.5" fill={accent} stroke={textColor} strokeWidth="1" />
        </svg>

        {hover && (() => {
          // ---- Cursor-anchored tooltip (this update) — always horizontally
          // centered right on the cursor, exactly where you're pointing on
          // the dial, and only clamped just enough at the very edges so the
          // box itself doesn't spill outside the 150×150 dial area. It never
          // jumps to the opposite side anymore — same spot, every time.
          const HALF_W = 46; // ≈ half the tooltip's own width, for edge clamping
          const left = Math.min(Math.max(hover.x, HALF_W), 150 - HALF_W);
          const top = Math.max(hover.y - 26, 2); // sits just above the cursor
          return (
            <div style={{
              position: "absolute", left, top, transform: "translate(-50%, 0)",
              pointerEvents: "none", zIndex: 3,
              background: C.dark, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 6, padding: "3px 7px",
              whiteSpace: "nowrap", boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
            }}>
              {String(hover.hh12 === 0 ? 12 : hover.hh12).padStart(2, "0")}:{String(hover.mm).padStart(2, "0")} · double-click for alarm
            </div>
          );
        })()}

        <AnimatePresence>
          {justSet && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
              style={{
                position: "absolute", left: "50%", bottom: 2, transform: "translateX(-50%)", zIndex: 4, display: "flex", alignItems: "center", gap: 4,
                background: "#4a9d5f", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "3px 9px",
              }}
            ><CheckCircle2 size={11} /> Alarm set for {formatTime12(justSet)}</motion.div>
          )}
        </AnimatePresence>
        </div>

        <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 15, fontWeight: 800, color: textColor, letterSpacing: 0.5 }}>
          {digital}
        </div>
      </div>

      {alarms.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flexShrink: 0, maxHeight: 46, overflowY: "auto" }} className="btl-scroll">
          <AnimatePresence>
            {alarms.map((a) => (
              <motion.span
                key={a.id}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800,
                  background: hexToRgba(accent, 0.16), color: textColor, border: `1px solid ${hexToRgba(accent, 0.4)}`,
                  borderRadius: 999, padding: "2px 6px 2px 8px",
                }}
              >
                <Bell size={9} /> {formatTime12(a.time)}
                <span onClick={() => onRemoveAlarm(a.id)} title="Remove alarm" style={{ cursor: "pointer", display: "inline-flex", opacity: 0.7 }}>
                  <X size={10} />
                </span>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   FOCUS TIMER WIDGET (this update)
   A stopwatch-per-category tracker — "Screen time / Social media /
   Deep work / Study" by default, plus any custom categories the user
   adds via the glass "add" popup. Only one category can run at a
   time (starting a new one auto-stops whichever was running); elapsed
   seconds accumulate into state.focusTimer.history[todayISO][catId]
   so Analytics can chart trend + category breakdown, same convention
   as widgetHistory elsewhere in this file. The in-progress session
   only stores { categoryId, startTs } (a plain epoch ms), so the
   running timer survives a reload/tab-close — elapsed is always
   `now - startTs` plus whatever was already banked today, never a
   separately-ticking piece of state that could drift or freeze.
   ================================================================ */
const FOCUS_TIMER_PALETTE = ["#e07a5f", "#9d4edd", "#4a7c59", C.blue, "#fca311", "#e63946", "#2a9d8f", "#f77f00", "#5c6bc0", "#ff6f91"];
const FOCUS_TIMER_DEFAULT_CATEGORIES = [
  { id: "screenTime", label: "Screen time", color: "#e07a5f" },
  { id: "socialMedia", label: "Social media", color: "#9d4edd" },
  { id: "deepWork", label: "Deep work", color: "#4a7c59" },
  { id: "study", label: "Study", color: C.blue },
];
function normalizeFocusTimer(ft) {
  const raw = ft && typeof ft === "object" ? ft : {};
  const categories = Array.isArray(raw.categories) && raw.categories.length
    ? raw.categories
      .filter((c) => c && typeof c === "object" && c.id && c.label)
      .map((c) => ({ id: String(c.id), label: String(c.label).slice(0, 24), color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : C.accent }))
    : FOCUS_TIMER_DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  const validIds = categories.map((c) => c.id);
  const active = raw.active && typeof raw.active === "object" && validIds.includes(raw.active.categoryId) && Number.isFinite(raw.active.startTs)
    ? { categoryId: raw.active.categoryId, startTs: raw.active.startTs }
    : null;
  const history = raw.history && typeof raw.history === "object" ? raw.history : {};
  return { categories, active, history };
}
function formatFocusDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
/* Seconds banked today for one category — banked history plus, if that
   category is the one currently running, the live in-progress elapsed. */
function focusSecondsToday(focusTimer, categoryId, now = Date.now()) {
  const day = todayISO();
  const banked = (focusTimer.history?.[day]?.[categoryId]) || 0;
  const live = focusTimer.active?.categoryId === categoryId ? Math.max(0, Math.floor((now - focusTimer.active.startTs) / 1000)) : 0;
  return banked + live;
}
/* Category breakdown for a given day-range (today only, or last N days),
   drawn as a donut — same visual language as TimeBreakdownPanel above. */
function computeFocusBreakdown(focusTimer, days = 1) {
  const totals = {};
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayHist = focusTimer.history?.[iso] || {};
    Object.entries(dayHist).forEach(([catId, secs]) => { totals[catId] = (totals[catId] || 0) + secs; });
  }
  if (focusTimer.active) {
    const liveSecs = Math.max(0, Math.floor((Date.now() - focusTimer.active.startTs) / 1000));
    totals[focusTimer.active.categoryId] = (totals[focusTimer.active.categoryId] || 0) + liveSecs;
  }
  return Object.entries(totals)
    .map(([catId, secs]) => {
      const cat = focusTimer.categories.find((c) => c.id === catId) || { label: "Removed category", color: "#b3ac99" };
      return { key: catId, label: cat.label, color: cat.color, minutes: +(secs / 60).toFixed(1) };
    })
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}
/* Total focused minutes per day, last N days — powers the Analytics trend chart. */
function computeFocusDailyTotals(focusTimer, days = 14) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayHist = focusTimer.history?.[iso] || {};
    let secs = Object.values(dayHist).reduce((a, b) => a + b, 0);
    if (i === 0 && focusTimer.active) secs += Math.max(0, Math.floor((Date.now() - focusTimer.active.startTs) / 1000));
    out.push({ date: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }), minutes: +(secs / 60).toFixed(1) });
  }
  return out;
}

/* ---- Glass popup for naming + coloring a new timer category ---- */
function AddFocusCategoryModal({ onAdd, onClose, usedColors }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(FOCUS_TIMER_PALETTE.find((c) => !usedColors.includes(c)) || FOCUS_TIMER_PALETTE[0]);
  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, color);
    onClose();
  };
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(37,36,34,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 300, borderRadius: 16, padding: 18,
          background: "rgba(255,253,247,0.72)", backdropFilter: "blur(22px) saturate(200%)", WebkitBackdropFilter: "blur(22px) saturate(200%)",
          border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 24px 60px rgba(37,36,34,0.32), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: C.dark, display: "flex", alignItems: "center", gap: 6 }}>
            <Gauge size={14} color={C.accent} /> New timer
          </span>
          <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}>
            <X size={15} color={C.dark} />
          </motion.button>
        </div>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="e.g. Reading, Gym, Coding…"
          style={{
            width: "100%", boxSizing: "border-box", border: `1px solid rgba(64,61,57,0.2)`, borderRadius: 9,
            padding: "9px 10px", fontSize: 12, fontWeight: 600, color: C.dark, background: "rgba(255,255,255,0.6)",
            outline: "none", marginBottom: 12,
          }}
        />
        <div style={{ fontSize: 9, fontWeight: 800, color: "#8a8579", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Color</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {FOCUS_TIMER_PALETTE.map((c) => (
            <motion.button
              key={c} onClick={() => setColor(c)} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              style={{
                width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
                border: color === c ? `2px solid ${C.dark}` : "2px solid rgba(255,255,255,0.7)",
                boxShadow: color === c ? "0 0 0 2px rgba(255,255,255,0.9)" : "none",
              }}
            />
          ))}
        </div>
        <motion.button
          whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={submit} disabled={!label.trim()}
          style={{
            width: "100%", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 12, fontWeight: 800,
            cursor: label.trim() ? "pointer" : "not-allowed", background: label.trim() ? C.accent : "#ddd6c4", color: "#fff",
          }}
        >Add timer</motion.button>
      </motion.div>
    </motion.div>
  );
}

function FocusTimerWidget({ focusTimer, onToggle, onAddCategory, onRemoveCategory, cardBg, accent }) {
  const [, forceTick] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Re-render once a second only while a category is actively running,
  // so the live "elapsed" readout ticks — idle state costs nothing.
  useEffect(() => {
    if (!focusTimer.active) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [focusTimer.active?.categoryId, focusTimer.active?.startTs]);

  const textColor = autoTextColor(cardBg);
  const mutedColor = autoMutedColor(cardBg);
  const todayTotal = focusTimer.categories.reduce((sum, c) => sum + focusSecondsToday(focusTimer, c.id), 0);
  const breakdown = useMemo(() => computeFocusBreakdown(focusTimer, 1), [focusTimer.active?.categoryId, focusTimer.active?.startTs, focusTimer.history, showBreakdown]);

  return (
    <div style={{ borderRadius: 8, padding: 10, width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden", ...glassCardStyle(cardBg) }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Oval style={{ display: "block", margin: 0, background: C.dark, color: C.bg, borderColor: C.dark }}>Timer</Oval>
        <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
          <motion.button
            onClick={() => setShowBreakdown((v) => !v)}
            whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }}
            title="Show today's breakdown"
            style={{
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 20, height: 20, borderRadius: 999, background: showBreakdown ? accent : "rgba(0,0,0,0.06)", color: showBreakdown ? "#fff" : mutedColor,
            }}
          ><PieChartIcon size={11} /></motion.button>
          <Oval onClick={() => setShowAdd(true)} style={{ padding: "3px 12px", fontSize: 12, background: hexToRgba(cardBg || "#fffdf7", 0.5), color: textColor, borderColor: mutedColor }}>
            add
          </Oval>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: mutedColor, flexShrink: 0 }}>
        Focused today: <span style={{ color: textColor, fontWeight: 900 }}>{formatFocusDuration(todayTotal)}</span>
      </div>

      <AnimatePresence>
        {showBreakdown && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} style={{ overflow: "hidden", flexShrink: 0 }}>
            <div style={{ padding: "6px 8px", background: "rgba(0,0,0,0.03)", borderRadius: 6 }}>
              {breakdown.length === 0 ? (
                <div style={{ fontSize: 9.5, color: mutedColor, textAlign: "center", padding: "6px 0" }}>Start a timer to see today's split.</div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 54, height: 54, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={breakdown} dataKey="minutes" nameKey="label" innerRadius={15} outerRadius={26} paddingAngle={2} strokeWidth={1} stroke="#fff">
                          {breakdown.map((c) => <Cell key={c.key} fill={c.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n, p) => [`${v}m`, p?.payload?.label]} contentStyle={{ fontSize: 9, borderRadius: 8, border: "1px solid #ece7d8" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    {breakdown.map((c) => (
                      <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 8.5, flex: 1, color: textColor }}>{c.label}</span>
                        <span style={{ fontSize: 8.5, fontWeight: 800, color: accent }}>{c.minutes}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="btl-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        <AnimatePresence initial={false}>
          {focusTimer.categories.map((cat) => {
            const running = focusTimer.active?.categoryId === cat.id;
            const secs = focusSecondsToday(focusTimer, cat.id);
            return (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, borderRadius: 9, padding: "7px 9px", flexShrink: 0,
                  background: running ? hexToRgba(cat.color, 0.16) : "rgba(0,0,0,0.03)",
                  border: `1px solid ${running ? hexToRgba(cat.color, 0.45) : "transparent"}`,
                }}
              >
                <motion.span
                  animate={running ? { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
                  transition={running ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : undefined}
                  style={{ width: 9, height: 9, borderRadius: "50%", background: cat.color, flexShrink: 0 }}
                />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: textColor, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace", fontSize: 10.5, fontWeight: 800, color: running ? cat.color : mutedColor }}>
                  {formatFocusDuration(secs)}
                </span>
                <motion.button
                  onClick={() => onToggle(cat.id)}
                  whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }}
                  title={running ? "Pause" : "Start"}
                  style={{
                    border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: running ? cat.color : hexToRgba(cat.color, 0.18), color: running ? "#fff" : cat.color,
                  }}
                >
                  {running ? <Square size={9} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                </motion.button>
                <span
                  onClick={() => onRemoveCategory(cat.id)}
                  title="Remove timer"
                  style={{ cursor: "pointer", display: "inline-flex", opacity: 0.45, flexShrink: 0 }}
                ><X size={11} color={mutedColor} /></span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {focusTimer.categories.length === 0 && (
          <div style={{ fontSize: 9.5, color: mutedColor, textAlign: "center", padding: "12px 0" }}>Tap "add" to create your first timer.</div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddFocusCategoryModal
            onAdd={onAddCategory}
            onClose={() => setShowAdd(false)}
            usedColors={focusTimer.categories.map((c) => c.color)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---- The "ring" popup — glassmorphism + a warm pulsing wash + a
   shaking bell, so it reads as an alarm rather than a generic modal. ---- */
function AlarmRingModal({ alarm, ringtoneId, onDismiss }) {
  if (!alarm) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(37,36,34,0.35)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 10 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={{
          width: "min(88%, 320px)", borderRadius: 20, padding: "26px 22px", textAlign: "center", position: "relative", overflow: "hidden",
          background: "rgba(255,255,255,0.72)", backdropFilter: "blur(24px) saturate(190%)", WebkitBackdropFilter: "blur(24px) saturate(190%)",
          border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 24px 60px rgba(37,36,34,0.35), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        <motion.div
          animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -40, zIndex: 0, borderRadius: "50%", background: `radial-gradient(circle, ${hexToRgba(C.accent, 0.5)}, transparent 70%)` }}
        />
        <motion.div
          animate={{ rotate: [0, -14, 14, -10, 10, -4, 4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.3, ease: "easeInOut" }}
          style={{ position: "relative", zIndex: 1, display: "inline-flex", color: C.accent, marginBottom: 6 }}
        >
          <AlarmClock size={40} />
        </motion.div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 11, fontWeight: 800, color: "#8a8579", marginBottom: 2 }}>Alarm</div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 30, fontWeight: 900, color: C.dark, fontFamily: "'JetBrains Mono', 'Courier New', monospace", marginBottom: 4 }}>
          {formatTime12(alarm.time)}
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 10, fontWeight: 700, color: "#a39c86", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Volume2 size={11} /> {ringtoneLabel(ringtoneId)}
        </div>
        <motion.button
          onClick={onDismiss}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
          style={{
            position: "relative", zIndex: 1, border: "none", background: C.dark, color: "#fff",
            fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "9px 28px", cursor: "pointer",
          }}
        >Done</motion.button>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- TIME TABLE: drag-to-reschedule time math (this update) ----------------
   Dragging a row to a new spot in the list (via Reorder.Group below) drops
   it between two neighbors; these turn that new position into an actual
   "HH:MM" so the row's clock time — not just its on-screen order — follows
   the drag. */
function clampMinutes(total) { return Math.max(0, Math.min(23 * 60 + 59, total)); }
function minutesOf(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
function timeFromMinutes(total) {
  const t = clampMinutes(total);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function addMinutesToTime(hhmm, delta) { return timeFromMinutes(minutesOf(hhmm) + delta); }
function midpointTime(t1, t2) {
  let a = minutesOf(t1), b = minutesOf(t2);
  if (b <= a) b += 24 * 60;
  return timeFromMinutes(Math.round((a + b) / 2));
}

function TimeCheckBurst() {
  const dots = Array.from({ length: 6 });
  return (
    <motion.div
      initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", left: 3, top: "50%", width: 26, height: 26, marginTop: -13, pointerEvents: "none", zIndex: 2 }}
    >
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 12, y: 12, scale: 1 }}
            animate={{ opacity: 0, x: 12 + Math.cos(angle) * 15, y: 12 + Math.sin(angle) * 15, scale: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: "#4a9d5f" }}
          />
        );
      })}
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: "absolute", inset: 0 }}>
        <motion.circle
          cx="13" cy="13" r="11" fill="none" stroke="#4a9d5f" strokeWidth="2"
          initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <motion.path
          d="M7 13.5 L11 17.5 L19 8.5" fill="none" stroke="#4a9d5f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.25, 0.8, 1] }}
        />
      </svg>
    </motion.div>
  );
}

/* ---------------- TIME TABLE: animated vertical status rail (this update) ----------------
   Upgrades the old plain drag-grip icon + flat category dot into a real
   connected timeline down the left edge of the list: a vertical line
   runs through every row (each row contributes its own top-half +
   bottom-half segment, so consecutive rows join into one continuous
   line without any manual position math), with a status dot per row —
     - done      → filled green, a checkmark draws in with a little pop
     - now       → the live slot: pulsing glow + a radiating ring that
                   expands and fades on loop, plus a soft "breathing"
                   shimmer on the line segment just below it (time
                   visibly flowing forward from "now")
     - overdue   → soft red pulse (missed, still calling for attention)
     - future    → a plain hollow outline, line continues as a faint
                   dashed track
   The line itself is solid/colored through everything already passed
   (done rows + the live "now" row) and fades to a dashed line for
   what's still ahead, so the rail reads as "how far into the day you
   are" at a single glance — not just per-row status. It's also still
   the drag-to-reschedule handle (pointerdown anywhere on the rail
   starts the drag, same as the old grip icon did). Pure framer-motion
   + CSS — no new npm installs, matches the rest of this app's motion
   language. */
function TimeTableRailDot({ status, accent, isCelebrating }) {
  const STATUS_COLOR = { done: "#4a9d5f", now: accent, overdue: "#e07a5f", future: "#c9c2ac" };
  const color = STATUS_COLOR[status] || STATUS_COLOR.future;
  const filled = status === "done" || status === "now" || status === "overdue";
  return (
    <div style={{ position: "relative", width: 11, height: 11, flexShrink: 0 }}>
      {status === "now" && (
        <motion.span
          style={{ position: "absolute", inset: -5, borderRadius: "50%", border: `2px solid ${accent}`, pointerEvents: "none" }}
          animate={{ scale: [1, 2.1, 2.1], opacity: [0.55, 0, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <motion.span
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: filled ? color : "#fff",
          border: `2px solid ${color}`,
          boxShadow: status === "now" ? `0 0 8px ${hexToRgba(accent, 0.65)}` : status === "overdue" ? `0 0 6px ${hexToRgba("#e07a5f", 0.45)}` : "none",
        }}
        animate={
          status === "now" ? { scale: [1, 1.22, 1] }
          : isCelebrating ? { scale: [1, 1.5, 1] }
          : status === "overdue" ? { scale: [1, 1.12, 1] }
          : { scale: 1 }
        }
        transition={{
          duration: status === "now" ? 1.6 : status === "overdue" ? 1.4 : 0.35,
          repeat: (status === "now" || status === "overdue") ? Infinity : 0,
          ease: "easeInOut",
        }}
      />
      {status === "done" && (
        <svg width="11" height="11" viewBox="0 0 11 11" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <motion.path
            d="M2.6 5.7 L4.5 7.6 L8.4 3.4" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.3, delay: 0.05 }}
          />
        </svg>
      )}
    </div>
  );
}
function TimeTableRail({ status, isFirst, isLast, accent, isCelebrating, onPointerDown }) {
  const passed = status === "done" || status === "now" || status === "overdue";
  const solidColor = status === "done" ? "#4a9d5f" : status === "now" ? accent : status === "overdue" ? "#e07a5f" : "#ddd6c4";
  const dashed = "repeating-linear-gradient(180deg, #ddd6c4 0 3px, transparent 3px 6px)";
  const segBase = { width: 2, flex: 1, borderRadius: 2 };
  return (
    <div
      onPointerDown={onPointerDown}
      title="Drag to reschedule"
      style={{ position: "relative", width: 18, alignSelf: "stretch", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", cursor: "grab", touchAction: "none" }}
    >
      <div style={{ ...segBase, background: isFirst ? "transparent" : passed ? solidColor : dashed, opacity: isFirst ? 0 : passed ? 0.85 : 0.6 }} />
      <TimeTableRailDot status={status} accent={accent} isCelebrating={isCelebrating} />
      <motion.div
        style={{ ...segBase, background: isLast ? "transparent" : status === "done" ? "#4a9d5f" : status === "now" ? accent : dashed, opacity: isLast ? 0 : (status === "done" || status === "now") ? 0.85 : 0.6 }}
        animate={status === "now" ? { opacity: [0.35, 0.9, 0.35] } : {}}
        transition={{ duration: 1.6, repeat: status === "now" ? Infinity : 0, ease: "easeInOut" }}
      />
    </div>
  );
}

/* Single row of the Time Table — split out from the main component so each
   row can own its own useDragControls() (Reorder.Item needs one drag
   controller per row; hooks can't be created inside a .map()). Dragging the
   grip handle up/down reorders the row, and TimeTable's onReorder below
   turns that new position into a real new "HH:MM" via midpointTime(). */
function TimeTableRow({ t, isUpcoming, isOverdue, isCelebrating, isFirst, isLast, accent, cardBg, itemFontSize, itemFontFamily, itemColorOverride, itemWeight, onToggle, onRemove, onToggleRecurring }) {
  const dragControls = useDragControls();
  const cat = timeCatInfo(t.category);
  const status = t.done ? "done" : isUpcoming ? "now" : isOverdue ? "overdue" : "future";
  return (
    <Reorder.Item
      value={t}
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{
        opacity: 1, y: 0, height: "auto",
        boxShadow: isUpcoming && !t.done
          ? [`0 0 0 0 ${hexToRgba(accent, 0)}`, `0 0 10px 1px ${hexToRgba(accent, 0.25)}`, `0 0 0 0 ${hexToRgba(accent, 0)}`]
          : "0 0 0 0 rgba(0,0,0,0)",
      }}
      exit={{ opacity: 0, x: 80, height: 0, transition: { duration: 0.22, ease: "easeIn" } }}
      transition={{
        height: { type: "spring", stiffness: 480, damping: 32 }, opacity: { duration: 0.3 }, y: { type: "spring", stiffness: 480, damping: 32 },
        boxShadow: { duration: 2.2, repeat: isUpcoming && !t.done ? Infinity : 0, ease: "easeInOut" },
      }}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 22px rgba(37,36,34,0.16)", cursor: "grabbing", zIndex: 5 }}
      style={{
        borderBottom: "1px solid #f0ece0",
        borderLeft: `3px solid ${t.done ? "#c7dfc9" : isUpcoming ? accent : isOverdue ? "#e07a5f" : "#ddd6c4"}`,
        position: "relative", overflow: "hidden", listStyle: "none", background: cardBg || "#fff",
      }}
    >
      <AnimatePresence>{isCelebrating && <TimeCheckBurst />}</AnimatePresence>
      <motion.div
        animate={quakeAnimate(isCelebrating)}
        style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 4px 6px 2px", position: "relative",
          color: t.done ? autoMutedColor(cardBg) : autoTextColor(cardBg),
        }}>
        <TimeTableRail
          status={status} isFirst={isFirst} isLast={isLast} accent={accent} isCelebrating={isCelebrating}
          onPointerDown={(e) => dragControls.start(e)}
        />
        <motion.input
          type="checkbox" checked={t.done} onChange={() => onToggle(t.id, t.done)}
          className="btl-check" style={{ accentColor: accent, width: 14, height: 14, flexShrink: 0, cursor: "pointer" }}
          whileTap={{ scale: 0.8 }}
          animate={isCelebrating ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
        <span title={cat.label} style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
        <motion.span
          animate={isUpcoming && !t.done ? { boxShadow: ["0 0 0 0 rgba(252,163,17,0.45)", "0 0 0 5px rgba(252,163,17,0)"] } : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
          transition={{ duration: 1.6, repeat: isUpcoming && !t.done ? Infinity : 0, ease: "easeOut" }}
          style={{
            fontSize: 9, fontWeight: 800, flexShrink: 0, borderRadius: 999, padding: "2px 6px", minWidth: 58, textAlign: "center",
            color: t.done ? "#a39c86" : isUpcoming ? "#fff" : "#8a8579",
            background: isUpcoming && !t.done ? accent : "rgba(0,0,0,0.05)",
          }}
        >{formatTime12(t.time)}</motion.span>
        <motion.span
          style={{
            flex: 1, fontSize: itemFontSize, cursor: "pointer", fontFamily: itemFontFamily,
            fontWeight: itemWeight, color: !t.done && itemColorOverride ? itemColorOverride : undefined,
            display: "inline-block", minWidth: 0,
          }}
          animate={{
            textDecoration: t.done ? "line-through" : "none",
            opacity: t.done ? 0.65 : 1,
            scale: isCelebrating ? [1, 1.06, 1] : 1,
          }}
          transition={{ duration: 0.3 }}
          onClick={() => onToggle(t.id, t.done)}
        >{t.text}</motion.span>
        {isUpcoming && !t.done && (
          <span style={{ fontSize: 8, fontWeight: 900, color: accent, flexShrink: 0 }}>NOW</span>
        )}
        <motion.span
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.85 }}
          title={t.recurring ? "Repeats daily — click to make one-off" : "One-off — click to repeat daily"}
          style={{ display: "inline-flex", flexShrink: 0, cursor: "pointer", color: t.recurring ? accent : "#d8d2bf" }}
          onClick={() => onToggleRecurring(t.id)}
        >
          <Repeat size={11} />
        </motion.span>
        <motion.span
          whileHover={{ scale: 1.2, rotate: -10, color: "#e07a5f" }}
          whileTap={{ scale: 0.85 }}
          style={{ display: "inline-flex", flexShrink: 0 }}
        >
          <Trash2 size={11} style={{ color: "#d8d2bf", cursor: "pointer" }} onClick={() => onRemove(t.id)} />
        </motion.span>
      </motion.div>
    </Reorder.Item>
  );
}

function TimeTable({ items, onToggle, onAdd, onRemove, onReschedule, onToggleRecurring, accent, textStyle, cardBg, streak = 0, history = {} }) {
  const ts = normalizeTextStyle(textStyle);
  const itemFontSize = Math.round(11 * ts.scale);
  const itemFontFamily = ts.font ? fontStackFor(ts.font) : undefined;
  const itemColorOverride = ts.color || undefined;
  const itemWeight = ts.bold ? 700 : undefined;

  const [time, setTime] = useState("09:00");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("other");
  const [repeatNew, setRepeatNew] = useState(true);
  const [celebrateId, setCelebrateId] = useState(null);
  const [showHeat, setShowHeat] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Reminder on/off is a per-browser preference (notification permission is
  // per-browser too), so it lives in localStorage rather than Firestore —
  // survives reloads without needing a sync round-trip.
  const [notifyOn, setNotifyOn] = useState(false);
  const notifiedRef = useRef(new Set());
  const [nowStr, setNowStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    try { setNotifyOn(localStorage.getItem("btl_timetable_notify") === "1"); } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowStr(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // Reminder: whenever the clock (nowStr, ticking every 30s above) reaches
  // a slot's time, fire a browser notification + chime once. notifiedRef
  // is keyed by day+id so it won't repeat on the same day, and clears
  // itself once the tab reaches a fresh day.
  useEffect(() => {
    if (!notifyOn) return;
    const today = todayISO();
    for (const s of Array.from(notifiedRef.current)) {
      if (!s.startsWith(today)) notifiedRef.current.delete(s);
    }
    (items || []).forEach((it) => {
      if (it.done || it.time !== nowStr) return;
      const key = `${today}-${it.id}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      playChime();
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("⏰ " + it.text, { body: `It's ${formatTime12(it.time)} — time table reminder`, tag: key });
        }
      } catch (e) { /* ignore */ }
    });
  }, [nowStr, notifyOn, items]);

  const toggleNotify = () => {
    const next = !notifyOn;
    setNotifyOn(next);
    try { localStorage.setItem("btl_timetable_notify", next ? "1" : "0"); } catch (e) { /* ignore */ }
    if (next && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const sorted = [...(items || [])].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const upcoming = sorted.find((t) => !t.done && (t.time || "") >= nowStr);
  const upcomingId = upcoming ? upcoming.id : null;

  const handleToggle = (id, wasDone) => {
    onToggle(id);
    if (!wasDone) {
      setCelebrateId(id);
      setTimeout(() => setCelebrateId((c) => (c === id ? null : c)), 600);
    }
  };

  // Drag-to-reschedule: Reorder.Group hands back the full row in its new
  // visual order. Find the one row whose position actually moved, then
  // recompute *its* time from its new neighbors' times (their times are
  // untouched) so the clock time follows the drop position.
  const handleReorder = (newOrder) => {
    const oldIds = sorted.map((x) => x.id);
    const newIds = newOrder.map((x) => x.id);
    let idx = -1;
    for (let i = 0; i < newIds.length; i++) {
      if (newIds[i] !== oldIds[i]) { idx = i; break; }
    }
    if (idx === -1) return;
    const moved = newOrder[idx];
    const prev = newOrder[idx - 1];
    const next = newOrder[idx + 1];
    let newTime;
    if (prev && next) newTime = midpointTime(prev.time, next.time);
    else if (next) newTime = addMinutesToTime(next.time, -15);
    else if (prev) newTime = addMinutesToTime(prev.time, 15);
    if (newTime && newTime !== moved.time) onReschedule(moved.id, newTime);
  };

  const submit = () => {
    if (!text.trim()) return;
    onAdd(time, text.trim(), category, repeatNew);
    setText("");
  };

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <ChecklistHeader
        title={<><Clock size={11} style={{ marginRight: 3, verticalAlign: -1 }} />Time Table</>}
        streak={streak} accent={accent} showHeat={showHeat} onToggleHeat={() => setShowHeat((v) => !v)}
        extraToggles={[
          { icon: notifyOn ? <Bell size={10} /> : <BellOff size={10} />, active: notifyOn, onClick: toggleNotify, title: notifyOn ? "Reminders on — click to mute" : "Get notified when a slot starts" },
          { icon: <PieChartIcon size={10} />, active: showBreakdown, onClick: () => setShowBreakdown((v) => !v), title: "Where today's hours go" },
        ]}
      />
      <AnimatePresence initial={false}>
        {showHeat && <WidgetHeatmapPanel history={history} accent={accent} />}
        {showBreakdown && <TimeBreakdownPanel items={items} accent={accent} />}
      </AnimatePresence>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 8, ...glassCardStyle(cardBg) }} className="btl-scroll">
        {sorted.length === 0 && (
          <div style={{ padding: "16px 10px", fontSize: 10, color: "#a39c86", textAlign: "center" }}>
            No time blocks yet — add your first one below.
          </div>
        )}
        <Reorder.Group axis="y" values={sorted} onReorder={handleReorder} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          <AnimatePresence initial={false}>
            {sorted.map((t, i) => (
              <TimeTableRow
                key={t.id}
                t={t}
                isUpcoming={t.id === upcomingId}
                isOverdue={!t.done && t.id !== upcomingId && (t.time || "") < nowStr}
                isCelebrating={celebrateId === t.id}
                isFirst={i === 0} isLast={i === sorted.length - 1}
                accent={accent} cardBg={cardBg}
                itemFontSize={itemFontSize} itemFontFamily={itemFontFamily}
                itemColorOverride={itemColorOverride} itemWeight={itemWeight}
                onToggle={handleToggle} onRemove={onRemove} onToggleRecurring={onToggleRecurring}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      <div style={{ marginTop: 6, flexShrink: 0, display: "flex", gap: 4, flexWrap: "wrap" }}>
        <CategoryDropdown value={category} onChange={setCategory} categories={TIME_CATEGORIES} accent={accent} />
        <TimePicker value={time} onChange={setTime} accent={accent} />
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="What to do at this time..."
          style={{ flex: 1, fontSize: 10, padding: "5px 7px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none", minWidth: 0 }}
        />
        <motion.button
          onClick={() => setRepeatNew((v) => !v)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          title={repeatNew ? "New slot repeats daily — click for one-off" : "New slot is one-off — click to repeat daily"}
          style={{
            border: "none", borderRadius: 6, padding: "0 7px", cursor: "pointer", flexShrink: 0,
            background: repeatNew ? accent : "rgba(0,0,0,0.06)", color: repeatNew ? "#fff" : "#8a8579",
            display: "flex", alignItems: "center",
          }}>
          <Repeat size={12} />
        </motion.button>
        <motion.button
          onClick={submit}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.85, rotate: 90 }}
          style={{ border: "none", background: accent, color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", flexShrink: 0 }}>
          <Plus size={13} />
        </motion.button>
      </div>
    </div>
  );
}

/* ---------------- TODAY'S MOOD (compact — lives inside the Earn Money / Notes card) ---------------- */
/* ---------------- FOCUS MODE ↔ TIME TABLE SYNC (this update) ----------------
   A big highlighted "what's happening right now" banner at the top of Focus
   Mode, sourced from the same state.timeTable data the Time Table widget
   uses — so the current slot doesn't get lost the moment you step into
   Focus Mode. Ticks its own clock every 30s, same self-contained pattern
   as TimeTable itself, so nothing extra needs threading down from
   Dashboard. Returns null (renders nothing) once nothing's left scheduled
   for today, so it never sits there stale/empty. */
function FocusModeNowBanner({ items, accent, fm }) {
  const [nowStr, setNowStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowStr(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const sorted = [...(items || [])].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const current = sorted.find((t) => !t.done && (t.time || "") >= nowStr);
  if (!current) return null;
  const cat = timeCatInfo(current.category);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{
          flexShrink: 0, marginBottom: 10, borderRadius: 12, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: `${accent}18`, border: `1.5px solid ${accent}55`,
          position: "relative", overflow: "hidden",
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.4, 0.9] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          style={{ width: 9, height: 9, borderRadius: "50%", background: accent, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: accent, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Right now · {formatTime12(current.time)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: fm.text || C.dark, marginTop: 1 }}>
            {cat.emoji} {current.text}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

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
/* ---------------- Setting → Background (this update) ----------------
   Manages every color LiquidBackground.jsx draws with (gradient wash +
   blobs + particles all share the same 4-hue palette — see PALETTE in
   that file) plus one overall animation-speed dial for the blobs/
   gradient/particles. Both persist to Firestore on state.liquidBg like
   everything else in the app. */
const LIQUID_BG_COLOR_LABELS = ["Amber", "Sky", "Coral", "Sage"];
function LiquidBgPanel({ liquidBg, onColorChange, onColorsReset, onSpeedChange, onSpeedReset, onEnabledChange }) {
  const colors = (liquidBg && Array.isArray(liquidBg.colors) && liquidBg.colors.length === 4)
    ? liquidBg.colors : LIQUID_BG_DEFAULT_COLORS;
  const speed = Number.isFinite(liquidBg?.speed) ? liquidBg.speed : 1;
  // enabled — the on/off switch (this update). Colors/speed below still
  // stay editable while off, they just won't visibly do anything until the
  // background is switched back on — same as e.g. muting a video but still
  // being able to change the volume slider underneath.
  const enabled = liquidBg?.enabled !== false;

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.dark, display: "flex", alignItems: "center", gap: 5 }}>
          <Waves size={14} /> Liquid Background
        </div>
        {/* On/off switch (this update) — flips state.liquidBg.enabled, which
            LiquidBackground.jsx checks before rendering anything at all
            (gradient, blobs, and the particle canvas all stop together). */}
        <motion.button
          type="button"
          role="switch"
          aria-checked={enabled}
          title={enabled ? "Turn background animation off" : "Turn background animation on"}
          whileTap={{ scale: 0.94 }}
          onClick={() => onEnabledChange(!enabled)}
          style={{
            flexShrink: 0, width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer",
            padding: 3, display: "flex", justifyContent: enabled ? "flex-end" : "flex-start",
            background: enabled ? C.accent : "#d8d2c0", transition: "background 160ms ease",
          }}
        >
          <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }}
            style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.25)" }} />
        </motion.button>
      </div>
      <div style={{ fontSize: 10, color: "#8a8579", marginBottom: 14 }}>
        The animated gradient, blobs and floating particles behind the dashboard —
        recolor all 4 hues, speed up/slow down how fast they drift and morph, or
        turn the whole thing off above for a plain, static background.
      </div>

      {/* Colors */}
      <div style={{
        opacity: enabled ? 1 : 0.45, pointerEvents: enabled ? "auto" : "none", transition: "opacity 160ms ease",
      }}>
      {/* placeholder-open — closed below, wraps colors+speed so both grey out together when off */}
      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <Palette size={10} /> COLORS
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        {colors.map((hex, i) => (
          <div key={i}>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : LIQUID_BG_DEFAULT_COLORS[i]}
              onChange={(e) => onColorChange(i, e.target.value)}
              style={{ width: "100%", height: 30, borderRadius: 8, border: "1px solid #ece7d8", cursor: "pointer", padding: 2, background: "#fff" }}
            />
            <div style={{ fontSize: 9, fontWeight: 700, color: C.text, textAlign: "center", marginTop: 3 }}>{LIQUID_BG_COLOR_LABELS[i]}</div>
          </div>
        ))}
      </div>
      <motion.div
        whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
        onClick={onColorsReset}
        style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: C.dark, border: "1px solid #ece7d8", borderRadius: 999, padding: "6px 0", cursor: "pointer", background: "#fff", marginBottom: 18 }}
      >
        Reset colors to default
      </motion.div>

      {/* Speed */}
      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <Gauge size={10} /> ANIMATION SPEED
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <input
          type="range" min={0.4} max={3} step={0.1} value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: C.accent, cursor: "pointer" }}
        />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark, width: 40, textAlign: "right" }}>{speed.toFixed(1)}x</span>
      </div>
      <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 8 }}>
        Controls how fast the blobs drift/morph, the gradient shifts, and the particles move. 1.0x is the original speed.
      </div>
      <motion.div
        whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
        onClick={onSpeedReset}
        style={{ textAlign: "center", fontSize: 10, fontWeight: 800, color: C.dark, border: "1px solid #ece7d8", borderRadius: 999, padding: "6px 0", cursor: "pointer", background: "#fff" }}
      >
        Reset speed to 1.0x
      </motion.div>
      </div>
    </div>
  );
}

function SettingsTab({ state, addItem, removeItem, editItem, onClose, onThemeScopeChange, onThemeScopeReset, onWidgetThemeChange, onWidgetThemeReset, onWidgetSizePreset, onAnalyticsSummaryChange, onAnalyticsSummaryReset, onAnalyticsSummaryColorChange, onAnalyticsSummaryColorReset, onAnalyticsColorChange, onAnalyticsColorReset, onMoneyColorChange, onMoneyColorReset, onApplyPanelPreset, onResetPanelPreset, onLiquidGlassOptionsChange, onLiquidGlassOptionsReset, onSetClockRingtone, onLiquidBgColorChange, onLiquidBgColorsReset, onLiquidBgSpeedChange, onLiquidBgSpeedReset, onLiquidBgEnabledChange }) {
  const [mode, setMode] = useState(null); // "goal" | "extry" | "bigGoals" | "lifeRules" | "theme" | "alarm" | null
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

  const dragControls = useDragControls();

  return (
    <motion.div
      onClick={(e) => e.stopPropagation()}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ left: -2000, right: 2000, top: -2000, bottom: 2000 }}
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
        pointerEvents: "auto", position: "relative",
      }}>
      {/* Close button — pinned to the modal's own top-right corner (this
          update) instead of living inside the wrapping tab row. It used to
          sit after a `flex:1` spacer at the end of that row, so once the
          tabs (Add Goles / Add extra / .../ Background) ran out of room and
          wrapped, the spacer + button wrapped down too and landed at the
          *left* edge of the second line — nowhere near a "close" button's
          expected spot. Absolute-positioning it against this outer card
          keeps it top-right always, no matter how many tab rows wrap. */}
      <motion.span whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onClose} title="Close" style={{
        position: "absolute", top: 8, right: 8, zIndex: 2,
        borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
      }}><X size={13} color={C.dark} /></motion.span>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 34px 8px 10px", flexWrap: "wrap",
        borderBottom: "1px solid rgba(64,61,57,0.15)", background: "rgba(255,252,242,0.5)",
      }}>
        <span
          onPointerDown={(e) => dragControls.start(e)}
          title="Drag to move"
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "grab", touchAction: "none", flexShrink: 0 }}
        >
          <GripVertical size={14} color="#a39c86" />
          <span style={{ fontSize: 12, fontWeight: 800, color: C.dark }}>Setting</span>
        </span>
        <Oval onClick={() => setMode("goal")} style={{ cursor: "pointer", background: mode === "goal" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "goal" ? "#fff" : C.text }}>Add Goles</Oval>
        <Oval onClick={() => setMode("extry")} style={{ cursor: "pointer", background: mode === "extry" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "extry" ? "#fff" : C.text }}>Add extry</Oval>
        <Oval onClick={() => setMode("bigGoals")} style={{ cursor: "pointer", background: mode === "bigGoals" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "bigGoals" ? "#fff" : C.text }}>Add Big Goal</Oval>
        <Oval onClick={() => setMode("lifeRules")} style={{ cursor: "pointer", background: mode === "lifeRules" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "lifeRules" ? "#fff" : C.text }}>Add Rule</Oval>
        <Oval onClick={() => setMode(mode === "theme" ? null : "theme")} style={{ cursor: "pointer", background: mode === "theme" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "theme" ? "#fff" : C.text }}><Palette size={11} style={{ marginRight: 4 }} />Theme</Oval>
        <Oval onClick={() => setMode(mode === "alarm" ? null : "alarm")} style={{ cursor: "pointer", background: mode === "alarm" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "alarm" ? "#fff" : C.text }}><AlarmClock size={11} style={{ marginRight: 4 }} />Alarm</Oval>
        <Oval onClick={() => setMode(mode === "background" ? null : "background")} style={{ cursor: "pointer", background: mode === "background" ? C.accent : "rgba(255,255,255,0.6)", color: mode === "background" ? "#fff" : C.text }}><Waves size={11} style={{ marginRight: 4 }} />Background</Oval>
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
            onAnalyticsSummaryColorChange={onAnalyticsSummaryColorChange}
            onAnalyticsSummaryColorReset={onAnalyticsSummaryColorReset}
            onAnalyticsColorChange={onAnalyticsColorChange}
            onAnalyticsColorReset={onAnalyticsColorReset}
            onMoneyColorChange={onMoneyColorChange}
            onMoneyColorReset={onMoneyColorReset}
            onApplyPreset={onApplyPanelPreset}
            onResetPreset={onResetPanelPreset}
            onLiquidGlassOptionsChange={onLiquidGlassOptionsChange}
            onLiquidGlassOptionsReset={onLiquidGlassOptionsReset}
          />
        ) : mode === "alarm" ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.dark, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <AlarmClock size={14} /> Alarm Ringtone
            </div>
            <div style={{ fontSize: 10, color: "#8a8579", marginBottom: 12, maxWidth: 420 }}>
              Plays when an alarm set on the Clock & Alarm widget goes off (rings up to 30s or until dismissed). Tap ▶ to preview, then pick one.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 420 }}>
              {ALARM_RINGTONES.map((r) => {
                const selected = (state.clockRingtone || "classic") === r.id;
                return (
                  <motion.div
                    key={r.id}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => onSetClockRingtone(r.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                      border: `1.5px solid ${selected ? C.accent : "rgba(64,61,57,0.15)"}`, borderRadius: 10,
                      padding: "8px 10px", background: selected ? hexToRgba(C.accent, 0.12) : "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: selected ? C.accent : C.text, display: "flex", alignItems: "center", gap: 6 }}>
                      {selected ? <CheckCircle2 size={13} /> : <Bell size={13} style={{ opacity: 0.5 }} />}
                      {r.label}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); previewRingtone(r.id); }}
                      title="Preview"
                      style={{ border: "none", background: C.dark, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                    ><Play size={10} fill="#fff" /></motion.button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : mode === "background" ? (
          <LiquidBgPanel
            liquidBg={state.liquidBg}
            onColorChange={onLiquidBgColorChange}
            onColorsReset={onLiquidBgColorsReset}
            onSpeedChange={onLiquidBgSpeedChange}
            onSpeedReset={onLiquidBgSpeedReset}
            onEnabledChange={onLiquidBgEnabledChange}
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

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/* Share card v2 — adds the signed-in user's name up top and a full
   "Today's Goals" breakdown (✅ completed / ⏳ pending, both lists
   pulled straight from state.dailyGoals + state.extryGoals — the same
   two arrays the checklists on the dashboard already read/write) below
   the Life Score ring + stat row that were already here. Canvas height
   is computed dynamically off however many goals exist today, so the
   card never crops the list. Still pure Canvas 2D — no new npm installs. */
/* Loads a remote image (e.g. a Google account photo) as a promise, for
   drawing into the share-card canvas below. crossOrigin is set so a
   CORS-friendly source (Google profile photos allow this) doesn't taint
   the canvas and block toDataURL(); any failure (no photo, blocked CORS,
   network error) just rejects so the caller can skip the avatar instead
   of breaking the whole card. */
function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* Same layout as before, now returns a Promise<dataURL> instead of the
   dataURL directly — the Google account photo (when available) is drawn
   as a circular avatar next to the "BYOUND THE LIFE" eyebrow before the
   canvas is finalized, so callers await/​.then() instead of calling this
   synchronously. */
async function generateShareCard(state, lifeScore, userName, userPhoto) {
  const dailyGoals = state.dailyGoals || [];
  const extryGoals = state.extryGoals || [];
  const allGoals = [...dailyGoals, ...extryGoals];
  const doneGoals = allGoals.filter((g) => g.done);
  const pendingGoals = allGoals.filter((g) => !g.done);

  const MAX_ROWS = 8;
  const ROW_H = 46;
  const HEADER_INSET = 60;
  const BOTTOM_PAD = 24;
  const shownRows = Math.min(Math.max(doneGoals.length, pendingGoals.length, 1), MAX_ROWS);
  const hasOverflow = doneGoals.length > MAX_ROWS || pendingGoals.length > MAX_ROWS;
  const panelH = HEADER_INSET + shownRows * ROW_H + (hasOverflow ? 34 : 0) + BOTTOM_PAD;

  // ---- Focus Timer — today's tracked categories + time (this update) ----
  // Same data the Focus Timer widget itself reads (focusSecondsToday banks
  // whatever's currently running on top of what's already logged today),
  // so the share card always matches what's live on the dashboard.
  const focusTimer = normalizeFocusTimer(state.focusTimer);
  const focusRows = focusTimer.categories
    .map((c) => ({ label: c.label, color: c.color, secs: focusSecondsToday(focusTimer, c.id) }))
    .filter((c) => c.secs > 0)
    .sort((a, b) => b.secs - a.secs);
  const totalFocusSecs = focusRows.reduce((a, c) => a + c.secs, 0);
  const FOCUS_HEADER_H = 56;
  const FOCUS_ROW_H = 44;
  const FOCUS_MAX_ROWS = 6;
  const focusRowsShown = Math.min(Math.max(focusRows.length, 1), FOCUS_MAX_ROWS);
  const focusOverflow = focusRows.length > FOCUS_MAX_ROWS;
  const FOCUS_PANEL_H = FOCUS_HEADER_H + focusRowsShown * FOCUS_ROW_H + (focusOverflow ? 30 : 0) + 22;
  const FOCUS_BLOCK_H = FOCUS_PANEL_H + 40; // panel + top/bottom margin around it

  const W = 1080;
  const TOP_H = 900;
  const EARN_SPEND_H = 150;
  const GOALS_TITLE_H = 60;
  const QUOTE_H = 190;
  const FOOTER_H = 90;
  const H = TOP_H + EARN_SPEND_H + FOCUS_BLOCK_H + GOALS_TITLE_H + panelH + 40 + QUOTE_H + FOOTER_H;

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
  ctx.fillStyle = "#4a7c5915";
  ctx.beginPath(); ctx.arc(W - 30, H * 0.58, 170, 0, Math.PI * 2); ctx.fill();

  ctx.textAlign = "center";

  // account photo avatar (top-left, next to the brand eyebrow) — only
  // drawn when a photo URL is available and it actually loads; any
  // failure is swallowed so a broken/blocked photo never breaks the card.
  if (userPhoto) {
    try {
      const avatarImg = await loadImageForCanvas(userPhoto);
      const avatarR = 42, avatarX = 110, avatarY = 90;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
      ctx.lineWidth = 4;
      ctx.strokeStyle = lifeScore.color;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.stroke();
    } catch (e) { /* CORS-blocked, no photo, or failed to load — skip the avatar */ }
  }

  // small brand eyebrow
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillStyle = lifeScore.color;
  ctx.fillText("BYOUND THE LIFE", W / 2, 64);

  // headline — the signed-in user's name front and center
  const name = (userName || "").trim();
  ctx.fillStyle = C.dark;
  ctx.font = "900 46px Inter, sans-serif";
  ctx.fillText(name || "My Journey", W / 2, 118);

  ctx.font = "600 20px Inter, sans-serif";
  ctx.fillStyle = "#a39c86";
  ctx.fillText(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), W / 2, 150);

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

  // stat row — Total Earned pill removed (money now gets its own proper
  // Earn/Spend panel below instead of being squeezed in here)
  const statY = 800;
  const stats = [
    { label: "Day Streak", value: String(state.streak || 0), emoji: "🔥" },
    { label: "Today's Goals", value: `${doneGoals.length}/${allGoals.length}`, emoji: "📋" },
  ];
  const bestCat = computeBestCategory(state);
  if (bestCat) stats.push({ label: "Top Category", value: bestCat.label, emoji: "🏆" });

  const colW = W / stats.length;
  stats.forEach((s, i) => {
    const x = colW * i + colW / 2;
    ctx.font = "50px Inter, sans-serif";
    ctx.fillText(s.emoji, x, statY);
    ctx.font = "900 30px Inter, sans-serif";
    ctx.fillStyle = C.dark;
    ctx.fillText(s.value, x, statY + 50);
    ctx.font = "600 16px Inter, sans-serif";
    ctx.fillStyle = "#a39c86";
    ctx.fillText(s.label, x, statY + 76);
  });

  // ---- Earn & Spend — a proper dedicated panel, not squeezed into the
  // stat row. Shows TODAY's earn/spend (from state.moneyHistory[today],
  // the same per-day aggregate the trend chart already uses) — not the
  // lifetime totals. Two cards side by side: green Earned, red Spent,
  // with a small Net readout centered underneath. ----
  {
    const todayMoney = (state.moneyHistory && state.moneyHistory[todayISO()]) || { earn: 0, spend: 0 };
    const earnToday = todayMoney.earn || 0;
    const spendToday = todayMoney.spend || 0;
    const netToday = earnToday - spendToday;
    const esY = TOP_H;
    const esGap = 30;
    const esColW = (W - 180 - esGap) / 2;
    const esLeftX = 90, esRightX = 90 + esColW + esGap;
    const esCardH = 100;

    ctx.textAlign = "left";
    drawRoundedRect(ctx, esLeftX, esY, esColW, esCardH, 20);
    ctx.fillStyle = "#4a7c5914"; ctx.fill();
    ctx.strokeStyle = "#4a7c5945"; ctx.lineWidth = 1.5; ctx.stroke();

    drawRoundedRect(ctx, esRightX, esY, esColW, esCardH, 20);
    ctx.fillStyle = "#c0392b0f"; ctx.fill();
    ctx.strokeStyle = "#c0392b38"; ctx.stroke();

    ctx.font = "44px Inter, sans-serif";
    ctx.fillText("💰", esLeftX + 24, esY + 58);
    ctx.fillText("💸", esRightX + 24, esY + 58);

    ctx.font = "700 17px Inter, sans-serif";
    ctx.fillStyle = "#4a7c59";
    ctx.fillText("Earned Today", esLeftX + 82, esY + 34);
    ctx.fillStyle = "#c0392b";
    ctx.fillText("Spent Today", esRightX + 82, esY + 34);

    ctx.font = "900 34px Inter, sans-serif";
    ctx.fillStyle = C.dark;
    ctx.fillText(`₹${earnToday}`, esLeftX + 82, esY + 68);
    ctx.fillText(`₹${spendToday}`, esRightX + 82, esY + 68);

    ctx.textAlign = "center";
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillStyle = netToday >= 0 ? "#4a7c59" : "#c0392b";
    ctx.fillText(`Net Today ${netToday >= 0 ? "+" : ""}₹${netToday}`, W / 2, esY + esCardH + 32);
  }

  // ---- Focus Timer panel — one row per category tracked today, with a
  // colored dot matching the widget's own category color, and a total
  // badge top-right (same formatFocusDuration used on the dashboard). ----
  {
    const fY = TOP_H + EARN_SPEND_H + 20;
    const fX = 90, fW = W - 180;
    drawRoundedRect(ctx, fX, fY, fW, FOCUS_PANEL_H, 20);
    ctx.fillStyle = "#fca31112"; ctx.fill();
    ctx.strokeStyle = "#fca31142"; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillStyle = C.dark;
    ctx.fillText("⏱️ Focus Timer", fX + 24, fY + 36);

    ctx.textAlign = "right";
    ctx.font = "800 20px Inter, sans-serif";
    ctx.fillStyle = C.accent;
    ctx.fillText(formatFocusDuration(totalFocusSecs), fX + fW - 24, fY + 36);

    ctx.textAlign = "left";
    if (focusRows.length === 0) {
      ctx.font = "italic 600 18px Inter, sans-serif";
      ctx.fillStyle = "#b3ac99";
      ctx.fillText("No focus sessions today", fX + 24, fY + FOCUS_HEADER_H + 8);
    } else {
      const rowsToShow = Math.min(focusRows.length, FOCUS_MAX_ROWS);
      for (let i = 0; i < rowsToShow; i++) {
        const r = focusRows[i];
        const rowY = fY + FOCUS_HEADER_H + i * FOCUS_ROW_H;
        ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(fX + 32, rowY + 6, 8, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = "left";
        ctx.font = "600 20px Inter, sans-serif";
        ctx.fillStyle = C.text;
        ctx.fillText(truncateToWidth(ctx, r.label, fW - 220), fX + 54, rowY + 13);
        ctx.textAlign = "right";
        ctx.font = "800 20px Inter, sans-serif";
        ctx.fillStyle = C.dark;
        ctx.fillText(formatFocusDuration(r.secs), fX + fW - 24, rowY + 13);
      }
      if (focusOverflow) {
        ctx.textAlign = "left";
        ctx.font = "700 16px Inter, sans-serif";
        ctx.fillStyle = "#a39c86";
        ctx.fillText(`+${focusRows.length - FOCUS_MAX_ROWS} more`, fX + 54, fY + FOCUS_HEADER_H + rowsToShow * FOCUS_ROW_H + 8);
      }
    }
    ctx.textAlign = "center";
  }

  // ---- Today's Goals — completed vs pending, side by side ----
  let y = TOP_H + EARN_SPEND_H + FOCUS_BLOCK_H;
  ctx.font = "800 26px Inter, sans-serif";
  ctx.fillStyle = C.dark;
  ctx.fillText("📋 Today's Goals", W / 2, y + 30);
  y += GOALS_TITLE_H;

  const colGap = 40;
  const colW2 = (W - 180 - colGap) / 2;
  const leftX = 90, rightX = 90 + colW2 + colGap;

  drawRoundedRect(ctx, leftX, y, colW2, panelH, 20);
  ctx.fillStyle = "#4a7c5912"; ctx.fill();
  ctx.strokeStyle = "#4a7c5940"; ctx.lineWidth = 1.5; ctx.stroke();

  drawRoundedRect(ctx, rightX, y, colW2, panelH, 20);
  ctx.fillStyle = "#c0392b0f"; ctx.fill();
  ctx.strokeStyle = "#c0392b33"; ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillStyle = "#4a7c59";
  ctx.fillText(`✅ Completed (${doneGoals.length})`, leftX + 22, y + 34);
  ctx.fillStyle = "#c0392b";
  ctx.fillText(`⏳ Pending (${pendingGoals.length})`, rightX + 22, y + 34);

  const drawGoalList = (goals, x, startY, mode) => {
    const rowsToShow = Math.min(goals.length, MAX_ROWS);
    for (let i = 0; i < rowsToShow; i++) {
      const g = goals[i];
      const rowY = startY + i * ROW_H;
      if (mode === "check") {
        ctx.beginPath(); ctx.arc(x + 10, rowY + 5, 12, 0, Math.PI * 2);
        ctx.strokeStyle = "#4a7c5960"; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = "#4a7c59"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 4, rowY + 6); ctx.lineTo(x + 8, rowY + 11); ctx.lineTo(x + 16, rowY - 1); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(x + 10, rowY + 5, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#c0392b70"; ctx.lineWidth = 2; ctx.stroke();
      }
      const cat = catInfo(g.category);
      ctx.fillStyle = cat.color;
      ctx.beginPath(); ctx.arc(x + 34, rowY + 5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = "600 19px Inter, sans-serif";
      ctx.fillStyle = mode === "check" ? "#6b6459" : C.text;
      ctx.fillText(truncateToWidth(ctx, g.text || "", colW2 - 90), x + 50, rowY + 12);
    }
    if (goals.length > MAX_ROWS) {
      ctx.font = "700 16px Inter, sans-serif";
      ctx.fillStyle = "#a39c86";
      ctx.fillText(`+${goals.length - MAX_ROWS} more`, x + 50, startY + rowsToShow * ROW_H + 8);
    }
    if (goals.length === 0) {
      ctx.font = "italic 600 17px Inter, sans-serif";
      ctx.fillStyle = "#b3ac99";
      ctx.fillText(mode === "check" ? "Nothing done yet — go get one! 💪" : "Everything's done! 🎉", x, startY + 6);
    }
  };

  drawGoalList(doneGoals, leftX + 22, y + 60, "check");
  drawGoalList(pendingGoals, rightX + 22, y + 60, "circle");

  ctx.textAlign = "center";
  y += panelH + 40;

  // divider + footer — today's notes (from the Earn/Spend widget), bold
  // black, instead of the old lifeRules quote
  drawRoundedRect(ctx, 90, y, W - 180, QUOTE_H, 24);
  ctx.fillStyle = "#ffffffaa";
  ctx.fill();
  const todaysNotes = (state.notes || (state.dailyLogs && state.dailyLogs[todayISO()]?.notes) || "").trim();
  ctx.font = "800 20px Inter, sans-serif";
  ctx.fillStyle = "#a39c86";
  ctx.fillText("📝 Today's Notes", W / 2, y + 40);
  if (todaysNotes) {
    ctx.font = "900 27px Inter, sans-serif";
    ctx.fillStyle = "#000000";
    wrapText(ctx, todaysNotes, W / 2, y + QUOTE_H / 2 + 20, W - 260, 36);
  } else {
    ctx.font = "700 22px Inter, sans-serif";
    ctx.fillStyle = "#b3ac99";
    ctx.fillText("No notes added today", W / 2, y + QUOTE_H / 2 + 20);
  }
  y += QUOTE_H;

  ctx.font = "700 20px Inter, sans-serif";
  ctx.fillStyle = "#a39c86";
  ctx.fillText("Made with Byound The Life", W / 2, y + 50);

  return canvas.toDataURL("image/png");
}

/* Share modal v2 — spring pop-in, a live "X/Y goals done today" chip
   above the card, a shimmering skeleton while the canvas renders, and
   a Copy-to-clipboard button alongside Download/Share (only shown when
   the browser actually supports it). */
function ShareJourneyModal({ state, lifeScore, userName, userPhoto, onClose }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const allGoals = [...(state.dailyGoals || []), ...(state.extryGoals || [])];
  const doneCount = allGoals.filter((g) => g.done).length;
  const canCopyImage = typeof navigator !== "undefined" && !!navigator.clipboard?.write;

  useEffect(() => {
    // tiny delay so the modal's spring entrance doesn't jank against the
    // canvas draw; generateShareCard is async now (awaits the account
    // photo before finishing), so we .then() instead of calling it
    // synchronously — `cancelled` guards against setting state after
    // the modal has already closed/re-rendered.
    let cancelled = false;
    const t = setTimeout(() => {
      generateShareCard(state, lifeScore, userName, userPhoto).then((url) => {
        if (!cancelled) setImgUrl(url);
      });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lifeScore, userName, userPhoto]);

  const download = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `byound-the-life-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const copyImage = async () => {
    if (!imgUrl || !canCopyImage) return;
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* clipboard permission denied/unsupported — Download still works */ }
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
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(37,36,34,0.72)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }} onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        style={{ background: "#fff", borderRadius: 18, padding: 18, maxWidth: 400, width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 30px 70px rgba(37,36,34,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: C.dark, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color={C.accent} /> Share Your Journey
          </span>
          <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={16} color={C.dark} /></motion.button>
        </div>
        <div style={{ fontSize: 10.5, color: "#a39c86", marginBottom: 12 }}>
          {userName ? `${userName} · ` : ""}{doneCount}/{allGoals.length} goals done today
        </div>

        <AnimatePresence mode="wait">
          {imgUrl ? (
            <motion.img
              key="img" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
              src={imgUrl} alt="Your journey" style={{ width: "100%", borderRadius: 12, border: "1px solid #ece7d8", display: "block" }}
            />
          ) : (
            <motion.div
              key="loading"
              style={{
                padding: 70, textAlign: "center", fontSize: 11, color: "#a39c86", borderRadius: 12,
                background: "linear-gradient(100deg, #f4efe1 30%, #fbf7ec 50%, #f4efe1 70%)", backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
            >
              Generating your card…
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={download} style={{ flex: 1, border: `1px solid ${C.dark}`, background: "#fff", color: C.dark, borderRadius: 10, padding: "9px 0", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>⬇ Download</motion.button>
          {canCopyImage && (
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={copyImage} style={{ flex: 1, border: `1px solid ${C.dark}`, background: copied ? "#eaf3ec" : "#fff", color: copied ? "#4a7c59" : C.dark, borderRadius: 10, padding: "9px 0", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>{copied ? "✓ Copied" : "📋 Copy"}</motion.button>
          )}
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }} onClick={share} style={{ flex: 1, border: "none", background: C.accent, color: "#fff", borderRadius: 10, padding: "9px 0", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>📤 Share</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Heatmap({ completionHistory, accentColor, weeks = 12, cellSize = 10 }) {
  const accent = accentColor || C.accent;
  const WEEKS = weeks;
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
                  width: cellSize, height: cellSize, borderRadius: 2,
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

/* ---------------- PER-WIDGET STREAK CHIP + MINI HEATMAP (this update) ----------------
   Small "🔥 N" badge that sits beside a checklist widget's title Oval, plus an
   optional toggle to reveal a compact 8-week consistency heatmap right inside
   that widget's card. Both are driven by the new state.widgetStreaks /
   state.widgetHistory maps (one entry per checklist widget: dailyGoals,
   extryGoals, timeTable) so each list gets its own independent streak instead
   of only the combined one that already existed in the header. */
function StreakChip({ streak, accent }) {
  const prev = useRef(streak);
  const bumped = streak > prev.current;
  useEffect(() => { prev.current = streak; }, [streak]);
  if (!streak) return null;
  return (
    <motion.span
      key={streak}
      initial={bumped ? { scale: 0.3, opacity: 0, y: -4 } : false}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9, fontWeight: 900,
        color: accent, background: "rgba(0,0,0,0.05)", borderRadius: 999, padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
      title={`${streak}-day streak on this list`}
    >
      <Flame size={9} /> {streak}
    </motion.span>
  );
}

/* Header row shared by GoalChecklist + TimeTable: centered Oval title, with the
   streak chip and a heatmap-toggle button pinned to the right so the title stays
   visually centered regardless of whether a widget has an active streak yet. */
function ChecklistHeader({ title, streak, accent, showHeat, onToggleHeat, extraToggle, extraToggles }) {
  // Back-compat: TimeTable now passes an array via `extraToggles` (bell +
  // pie chart); GoalChecklist still passes nothing. `extraToggle` (singular)
  // is kept working too in case anything else still calls it that way.
  const toggles = extraToggles || (extraToggle ? [extraToggle] : []);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, flexShrink: 0, minHeight: 22 }}>
      <Oval style={{ display: "block", margin: 0, background: C.dark, color: C.bg, borderColor: C.dark }}>{title}</Oval>
      <div style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
        <StreakChip streak={streak} accent={accent} />
        {toggles.map((tgl, i) => (
          <motion.button
            key={i}
            onClick={tgl.onClick}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            title={tgl.title}
            style={{
              border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: 6,
              background: tgl.active ? accent : "rgba(0,0,0,0.05)", color: tgl.active ? "#fff" : "#8a8579",
            }}
          >
            {tgl.icon}
          </motion.button>
        ))}
        <motion.button
          onClick={onToggleHeat}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.88 }}
          title="Show consistency heatmap"
          style={{
            border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 6,
            background: "#000", color: "#fff",
          }}
        >
          <BarChart3 size={10} />
        </motion.button>
      </div>
    </div>
  );
}

function WidgetHeatmapPanel({ history, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ overflow: "hidden", flexShrink: 0 }}
    >
      <div style={{ marginBottom: 6, padding: "6px 6px 4px", background: "rgba(0,0,0,0.03)", borderRadius: 6 }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#a39c86", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Last 8 weeks — daily % complete
        </div>
        <Heatmap completionHistory={history || {}} accentColor={accent} weeks={8} cellSize={8} />
      </div>
    </motion.div>
  );
}

/* ---------------- TIME TABLE: time-block breakdown pie chart (this update) ----------------
   "Where did today's hours actually go" — sorts the schedule by time and
   treats each row's duration as the gap to the next row (the last row wraps
   around to the first row's time next day, so a full day's schedule always
   sums to 24h). Durations are then summed per TIME_CATEGORIES bucket and
   drawn as a small recharts donut, matching the visual language of the
   existing "Spend by category" donut in Money Management. */
function timeToMinutes(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
}

function computeTimeBreakdown(items) {
  const sorted = [...(items || [])].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  if (!sorted.length) return [];
  const totals = {};
  for (let i = 0; i < sorted.length; i++) {
    const cur = timeToMinutes(sorted[i].time);
    const next = i < sorted.length - 1 ? timeToMinutes(sorted[i + 1].time) : timeToMinutes(sorted[0].time) + 24 * 60;
    const dur = Math.max(0, next - cur);
    const key = sorted[i].category || "other";
    totals[key] = (totals[key] || 0) + dur;
  }
  return Object.entries(totals)
    .map(([key, mins]) => {
      const info = timeCatInfo(key);
      return { key, label: info.label, emoji: info.emoji, color: info.color, hours: +(mins / 60).toFixed(1) };
    })
    .filter((c) => c.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

function TimeBreakdownPanel({ items, accent }) {
  const data = useMemo(() => computeTimeBreakdown(items), [items]);
  const totalHours = data.reduce((a, c) => a + c.hours, 0);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ overflow: "hidden", flexShrink: 0 }}
    >
      <div style={{ marginBottom: 6, padding: "6px 8px", background: "rgba(0,0,0,0.03)", borderRadius: 6 }}>
        <div style={{ fontSize: 8, fontWeight: 800, color: "#a39c86", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Where today's hours go
        </div>
        {data.length === 0 ? (
          <div style={{ fontSize: 9.5, color: "#a39c86", textAlign: "center", padding: "8px 0" }}>Add a couple of time blocks to see the breakdown.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="hours" nameKey="label" innerRadius={18} outerRadius={30} paddingAngle={2} strokeWidth={1} stroke="#fff">
                    {data.map((c) => <Cell key={c.key} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}h`, p?.payload?.label]} contentStyle={{ fontSize: 9, borderRadius: 8, border: "1px solid #ece7d8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {data.map((c) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, flex: 1, color: "#000" }}>{c.emoji} {c.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: accent }}>{c.hours}h</span>
                  <span style={{ fontSize: 8, color: "#a39c86", width: 26, textAlign: "right" }}>{totalHours ? Math.round((c.hours / totalHours) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function moodToNum(m) { return m === "happy" ? 1 : m === "neutral" ? 0.5 : m === "sad" ? 0 : null; }

// Extracted so both AnalyticsTab (Life Score badge) and the main header's
// new "Share Journey" icon can compute the same score without duplicating
// the formula. `colorOverride` lets AnalyticsTab keep applying the user's
// custom theme color on top of the computed default.
function computeLifeScore(state, colorOverride) {
  const hist = state.completionHistory || {};
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
  return { score, label, emoji, color: colorOverride || color };
}


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
                  <CartesianGrid stroke={ac.chartAxis || "#f0ece0"} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: ac.chartAxis || "#b3ac99" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: ac.chartAxis || "#b3ac99" }} width={28} />
                  <Tooltip formatter={(v, n, p) => [`${v}%`, p.payload.n ? `${p.payload.n} day(s)` : "No data"]} contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900}>
                    {weekdayStats.data.map((d, i) => (
                      <Cell key={i} fill={i === weekdayStats.bestI ? (ac.weekdayBest || "#4a7c59") : i === weekdayStats.worstI ? (ac.weekdayWorst || "#e07a5f") : tintHex(ac.weekdayOther || C.accent, 0.35)} />
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
                <CartesianGrid stroke={ac.chartAxis || "#f0ece0"} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: ac.chartAxis || "#b3ac99" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: ac.chartAxis || "#b3ac99" }} width={30} />
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

function AnalyticsTab({ state, user, onClose, onOpenMoneyManagement }) {
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

  const lifeScore = useMemo(
    () => computeLifeScore(state, ac.lifeScoreRing),
    [state.completionHistory, state.moodLog, state.streak, ac.lifeScoreRing]
  );

  const focusTimer = useMemo(() => normalizeFocusTimer(state.focusTimer), [state.focusTimer]);
  const focusDailyTotals = useMemo(() => computeFocusDailyTotals(focusTimer, 14), [focusTimer]);
  const focusBreakdown30d = useMemo(() => computeFocusBreakdown(focusTimer, 30), [focusTimer]);
  const focusTodaySeconds = useMemo(
    () => focusTimer.categories.reduce((sum, c) => sum + focusSecondsToday(focusTimer, c.id), 0),
    [focusTimer]
  );
  const focus7dAvgMinutes = useMemo(() => {
    const last7 = focusDailyTotals.slice(-7);
    if (!last7.length) return 0;
    return Math.round(last7.reduce((a, d) => a + d.minutes, 0) / last7.length);
  }, [focusDailyTotals]);

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
      borderRadius: 10,
      display: "flex", flexDirection: "column", height: "100%",
      color: at.text || undefined, fontFamily: atFontFamily, fontWeight: at.bold ? 600 : undefined,
      zoom: at.scale !== 1 ? at.scale : undefined,
      ...glassCardStyle(at.bg, at.border),
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        borderBottom: `1px solid ${hexLuminance(at.bg || "#fffdf7") < 0.5 ? "rgba(255,255,255,0.14)" : "rgba(64,61,57,0.12)"}`,
        background: "transparent", borderRadius: "10px 10px 0 0",
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
              <CartesianGrid stroke={ac.chartAxis || "#f0ece0"} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: ac.chartAxis || "#b3ac99" }} interval={4} />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => v === 1 ? "🙂" : v === 0.5 ? "😐" : "🙁"} tick={{ fontSize: 10, fill: ac.chartAxis || undefined }} width={24} />
              <Tooltip formatter={(v) => v === 1 ? "Happy" : v === 0.5 ? "Neutral" : v === 0 ? "Sad" : "No entry"} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="mood" stroke={ac.moodLine || C.blue} strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ---------- Focus Timer analytics (this update) ---------- */}
        <div style={{ fontSize: 11, fontWeight: 800, color: ac.sectionHeader || C.dark, margin: "18px 0 6px" }}>Focus Time — last 14 days</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 100, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <Gauge size={14} color={C.accent} />
            <div style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>{formatFocusDuration(focusTodaySeconds)}</div>
            <div style={{ fontSize: 9, color: "#b3ac99" }}>Focused today</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <TrendingUp size={14} color="#4a7c59" />
            <div style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>{focus7dAvgMinutes}m</div>
            <div style={{ fontSize: 9, color: "#b3ac99" }}>7-day avg / day</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <Award size={14} color={C.blue} />
            <div style={{ fontSize: 12, fontWeight: 900, color: C.dark }}>{focusBreakdown30d[0]?.label || "—"}</div>
            <div style={{ fontSize: 9, color: "#b3ac99" }}>Top category · 30d</div>
          </div>
        </div>
        <div style={{ height: 130, marginBottom: 14 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={focusDailyTotals} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={ac.chartAxis || "#f0ece0"} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: ac.chartAxis || "#b3ac99" }} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: ac.chartAxis || undefined }} width={28} />
              <Tooltip formatter={(v) => [`${v}m`, "Focused"]} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
              <Bar dataKey="minutes" fill={C.accent} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {focusBreakdown30d.length > 0 && (
          <div style={{ marginBottom: 18, padding: "8px 10px", background: "rgba(0,0,0,0.03)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 74, height: 74, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={focusBreakdown30d} dataKey="minutes" nameKey="label" innerRadius={20} outerRadius={34} paddingAngle={2} strokeWidth={1} stroke="#fff">
                    {focusBreakdown30d.map((c) => <Cell key={c.key} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}m`, p?.payload?.label]} contentStyle={{ fontSize: 9, borderRadius: 8, border: "1px solid #ece7d8" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {focusBreakdown30d.map((c) => {
                const totalMin = focusBreakdown30d.reduce((a, x) => a + x.minutes, 0);
                return (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9.5, flex: 1, color: C.text }}>{c.label}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: C.accent }}>{Math.round(c.minutes)}m</span>
                    <span style={{ fontSize: 8, color: "#a39c86", width: 26, textAlign: "right" }}>{totalMin ? Math.round((c.minutes / totalMin) * 100) : 0}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
      {showShare && <ShareJourneyModal state={state} lifeScore={lifeScore} userName={user?.displayName || state.lifeStory?.profile?.name || ""} userPhoto={user?.photoURL || ""} onClose={() => setShowShare(false)} />}
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
    // Recurring slots reset every day like goals do; a one-off slot
    // (recurring === false) keeps whatever done/undone state it was left
    // in — it already happened (or didn't) and isn't meant to repeat.
    timeTable: (s.timeTable || []).map((t) => (t.recurring !== false && t.done) ? { ...t, done: false } : t),
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
      borderRadius: 10, display: "flex", flexDirection: "column", height: "100%", position: "relative",
      color: mt.text || undefined, fontFamily: mtFontFamily, fontWeight: mt.bold ? 600 : undefined,
      zoom: mt.scale !== 1 ? mt.scale : undefined,
      ...glassCardStyle(mt.bg, mt.border),
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${hexLuminance(mt.bg || "#fffdf7") < 0.5 ? "rgba(255,255,255,0.14)" : "rgba(64,61,57,0.12)"}`, background: "transparent", borderRadius: "10px 10px 0 0", flexWrap: "wrap", rowGap: 6 }}>
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
                  <CartesianGrid stroke={mc.chartAxis || "#f0ece0"} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: mc.chartAxis || "#b3ac99" }} interval={Math.ceil(range / 7)} />
                  <YAxis tick={{ fontSize: 9, fill: mc.chartAxis || "#b3ac99" }} width={34} tickFormatter={(v) => `₹${v}`} />
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

  // "Done" — clears the widget's draft textarea + photo preview so it's
  // ready for a fresh note, WITHOUT wiping what's already saved for
  // today in dailyLogs[day].notes — that's the exact field Memories →
  // Notes reads, so erasing it here was the bug (notes disappeared from
  // Memories the instant you hit Done). Now Done only resets the visual
  // draft; the saved note for today stays intact until you actually
  // type something new (which live-syncs the same way it always has).
  const clearNotesAndImage = () => {
    update((s) => {
      s.notes = "";
      s.uploadedImage = null;
      return s;
    });
  };

  return (
    <div style={{ borderRadius: 8, padding: 7, width: "100%", height: "100%", overflowY: "auto", boxSizing: "border-box", display: "flex", flexDirection: "column", ...glassCardStyle(cardBg) }} className="btl-scroll">
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

      <AnimatePresence>
        {(state.notes || state.uploadedImage) && (
          <motion.button
            initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 6 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
            onClick={clearNotesAndImage}
            title="Clears today's notes and uploaded photo"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%",
              border: "none", borderRadius: 6, padding: "6px 0", background: "#4a7c59", color: "#fff",
              fontSize: 9.5, fontWeight: 800, cursor: "pointer", overflow: "hidden",
            }}
          >
            <CheckCircle2 size={12} /> Done — clear notes & photo
          </motion.button>
        )}
      </AnimatePresence>

      {/* Today's Mood — replaces the old standalone multi-day "DATE" widget.
          Only today's mood lives here now, right in the card's own free space. */}
      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: "1px solid #f0ece0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: labelFontSize, fontWeight: tsWeight, color: ts.color || autoTextColor(cardBg), fontFamily: tsFontFamily }}>Today's Mood :-</span>
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
function CalendarDayCell({ day, iso, pct, isToday, isPast, index, fontSize, fontFamily, fontWeight, textColor, cardBg }) {
  const done = typeof pct === "number" && pct >= 100;
  const partial = typeof pct === "number" && pct > 0 && pct < 100;
  const missed = isPast && !done; // day already ended without being finished — gets a "cut" mark
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.012, 0.3), type: "spring", stiffness: 420, damping: 24 }}
      whileHover={{ scale: 1.14, zIndex: 1, boxShadow: `0 0 0 1.5px ${C.dark}, 0 4px 12px rgba(252,163,17,0.45)` }}
      whileTap={{ scale: 0.94 }}
      style={{
        position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 7, fontSize, fontWeight, fontFamily,
        background: done ? C.accent : partial ? "#fff3d6" : "transparent",
        color: done ? "#fff" : (textColor || autoTextColor(cardBg)),
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
    <div style={{ borderRadius: 8, padding: 10, width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6, overflow: "hidden", ...glassCardStyle(cardBg) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: titleFontSize, fontWeight: 800, color: textColor || autoTextColor(cardBg), fontFamily, display: "flex", alignItems: "center", gap: 5 }}><CalendarDays size={13} /> Calendar</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={monthLabel}
            initial={{ opacity: 0, x: dir >= 0 ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir >= 0 ? -8 : 8 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: monthFontSize, fontWeight: 800, color: textColor || autoMutedColor(cardBg), fontFamily }}
          >{monthLabel}</motion.span>
        </AnimatePresence>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, fontSize: weekdayFontSize, fontWeight: 800, color: textColor || autoMutedColor(cardBg), fontFamily, textAlign: "center" }}>
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
                  fontSize={dayFontSize} fontFamily={fontFamily} fontWeight={fontWeight} textColor={textColor} cardBg={cardBg}
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
function AnalyticsSummaryMetric({ meta, value, textColor, colors }) {
  const dt = useContext(DashboardThemeCtx);
  const sc = colors || {};
  const safeTextColor = sc.text || textColor || dt.text || C.dark;
  // meta.color/labels default to the fixed C.dark brand color for
  // "neutral" metrics (Overall ring, Net Money) — swap that one fixed
  // shade for the current theme's text color so it stays legible
  // against dark Panel Theme presets too; distinct accent colors
  // (green/red/blue) are left untouched since those already read fine
  // on both light and dark backgrounds. A per-metric custom color
  // (from Settings → Theme → Analytics Summary) always wins.
  const baseColor = meta.color === C.dark ? safeTextColor : meta.color;
  const ringColor = sc[meta.id] || baseColor;
  if (meta.type === "ring") {
    return <RingStat pct={value} label={meta.label} color={ringColor} textColor={safeTextColor} />;
  }
  const Icon = meta.icon;
  const display = meta.type === "money"
    ? `${value < 0 ? "-" : ""}₹${Math.abs(Math.round(value))}`
    : String(Math.round(value)).padStart(3, "0");
  const moneyColor = sc[meta.id] || (meta.color === C.dark ? safeTextColor : (meta.color || safeTextColor));
  return (
    <div style={{ textAlign: "center", minWidth: 42 }}>
      <div style={{
        minWidth: 34, height: 34, borderRadius: meta.type === "money" ? 10 : "50%",
        background: meta.type === "money" ? "transparent" : (sc[meta.id] || C.dark),
        color: meta.type === "money" ? moneyColor : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
        fontSize: meta.type === "money" ? 12 : 12, fontWeight: 900, margin: "0 auto 2px", padding: "0 4px",
      }}>
        {meta.type === "money" && Icon && <Icon size={11} />}
        {display}
      </div>
      <div style={{ fontSize: 8, fontWeight: 700, color: safeTextColor, opacity: 0.65, whiteSpace: "nowrap" }}>{meta.label}</div>
    </div>
  );
}
function AnalyticsSummaryWidget({ state, onOpen, cardBg, metrics, colors }) {
  const values = computeAnalyticsSummaryValues(state);
  const activeIds = metrics && metrics.length ? metrics : ANALYTICS_SUMMARY_DEFAULT_METRICS;
  const activeMetrics = activeIds.map(analyticsSummaryMetricMeta).filter(Boolean);
  return (
    <div style={{ borderRadius: 8, padding: 10, width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, ...glassCardStyle(cardBg) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: autoTextColor(cardBg), display: "flex", alignItems: "center", gap: 5 }}><BarChart3 size={13} /> Analytics Summary</span>
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
              <AnalyticsSummaryMetric meta={meta} value={values[meta.id]} textColor={autoTextColor(cardBg)} colors={colors} />
            </motion.div>
          ))}
        </AnimatePresence>
        {!activeMetrics.length && (
          <span style={{ fontSize: 9, color: autoMutedColor(cardBg), fontWeight: 700 }}>
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
   - a corner ResizeHandle (bottom-right) you can drag: width is
     free-form (1%–100% of the grid, clamped to a MIN_WIDGET_W floor),
     height is free-form px clamped between MIN_WIDGET_H and
     MAX_WIDGET_H — both axes now resize continuously, one drag-pixel
     at a time, and everything else reflows around the change.
   - a MoveHandle (top-left) you can drag-and-drop directly onto
     another widget to reorder them (in addition to the reorder list
     above, in case the person would rather drag the actual widgets).
   Resize is live (the tile visibly grows/shrinks as you drag, other
   widgets reflow around it) and only commits to state.layout on
   pointerup, via onResize(id, {w,h}) / onDropOnto(draggedId, overId). */
/* NOTE on ResizableWidgetTile: width now resizes exactly like height —
   continuously, one drag-pixel at a time — because GRID_COLS is a fine
   100-unit (%) grid instead of a coarse 6-column one. See handleResizeMove
   below and the GRID_COLS/MIN_WIDGET_W comments above. */
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
    // Width follows the pointer continuously — GRID_COLS=100 means each
    // grid unit is ~1% of the container's width, so this reads as smooth,
    // free-form resizing (same feel as height) rather than snapping in
    // big fixed jumps. Only clamped to a sane minimum so a widget can't
    // be dragged down to an unusably thin sliver.
    const rawFraction = d.startW / GRID_COLS + deltaX / d.containerWidth;
    const w = Math.min(GRID_COLS, Math.max(MIN_WIDGET_W, Math.round(rawFraction * GRID_COLS)));
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

  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      layout
      data-widget-id={id}
      className="btl-widget-card"
      onMouseMove={handleCardMouseMove}
      initial={{ opacity: 0, y: 14, scaleY: 0.94 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      whileHover={interacting ? undefined : { scale: 1.012, boxShadow: "0 16px 34px rgba(37,36,34,0.18)", transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
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
                }}>{size.w}% wide · {size.h}px tall</span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        <div style={{ fontSize: 10, color: "#8a8579", marginTop: 14, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 5 }}>
          <Type size={11} style={{ flexShrink: 0 }} />
          Tap a widget's name above (Big Goals, Life Rules, Daily/Entry Goals, Time Table, Earn Money / Notes, Calendar) to select it, then style only that one below.
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
          reorder them, or drag the ⋰ bottom-right corner to resize freely in any direction — both width (15%–100%) and height (120–1200px) are free-form, and every other widget reflows around it automatically.
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
  const isDefault = !v.bg && !v.text && !v.border && (!includeTextControls || (!v.font && !v.bold && v.scale === 1));
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
          key={`${title}-${v.bg}-${v.text}-${v.border}-${v.font}-${v.bold}-${scalePct}`}
          initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
          style={{
            border: `1px solid ${v.border || "#ece7d8"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12,
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
        <ColorSwatchRow icon={<Square size={10} />} label="Border color (panel edge)" options={TEXT_COLOR_OPTIONS} value={v.border} onChange={(border) => onChange({ border })} />
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

/* Same pattern as AnalyticsColorsEditor, for the Analytics Summary widget's
   per-metric ring/badge/value colors + shared label text color. */
function AnalyticsSummaryColorsEditor({ value, onChange, onReset }) {
  const v = normalizeAnalyticsSummaryColors(value);
  const isDefault = ANALYTICS_SUMMARY_ELEMENT_COLOR_FIELDS.every((f) => !v[f.key]);

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
          Pick a custom color for any ring, badge/value or label text in the Analytics Summary widget —
          each one below is independent of the others.
        </div>
        {ANALYTICS_SUMMARY_ELEMENT_COLOR_FIELDS.map((f) => (
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
function AnalyticsSummaryThemeEditor({ state, metrics, colors, onChange, onReset }) {
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
          <AnalyticsSummaryWidget state={state} onOpen={() => {}} metrics={activeIds} colors={colors} />
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

/* One-click "Panel Theme" row — 6 preset swatches that recolor the whole
   app (every scope + every widget) in a single tap. Sits above the
   per-section tabs so it reads as the fast option, with the detailed
   editors below still available for fine-tuning afterward. */
function PanelPresetRow({ activePreset, onApply, onReset }) {
  return (
    <div style={{
      border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)",
      padding: "10px 10px 12px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
        <Sparkles size={12} style={{ color: C.dark }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Panel Theme</span>
        <div style={{ flex: 1 }} />
        {!!activePreset && (
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title="Reset panel theme" style={{
            border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
            padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
          }}><RefreshCw size={10} /> Reset</motion.button>
        )}
      </div>
      <div style={{ fontSize: 9, color: "#8a8579", marginBottom: 10, lineHeight: 1.4 }}>
        One tap recolors the whole panel — Dashboard, Analytics, Money, Focus Mode,
        Friend Celebration &amp; every widget together. Fine-tune any of them
        individually below afterward if you like.
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {PANEL_THEME_PRESETS.map((p) => {
          const active = activePreset === p.id;
          return (
            <motion.button
              key={p.id}
              whileHover={{ y: -2, scale: 1.06 }} whileTap={{ scale: 0.92 }}
              onClick={() => onApply(p.id)}
              title={p.label}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: "50%", background: p.swatch,
                border: active ? `2px solid ${C.dark}` : "1px solid #ddd6c4",
                boxShadow: active ? "0 0 0 3px rgba(37,36,34,0.14)" : "0 1px 3px rgba(0,0,0,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <CheckCircle2 size={14} style={{ color: "#fff", filter: "drop-shadow(0 0 2px rgba(0,0,0,0.5))" }} />}
              </span>
              <span style={{ fontSize: 8, fontWeight: 700, color: active ? C.dark : "#8a8579" }}>{p.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Liquid Glass fine-tune row (this update) ----
   Shown only under Setting → Theme → Panel Theme once "Liquid Glass" is
   the active preset — matches the reference moodboard's request that
   colors/background/blur stay "manageable" rather than a single fixed
   look. Three knobs, each writing straight to
   state.theme.liquidGlassOptions and read live by glassCardStyle():
   - Blur (4–40px) — how frosted the glass reads
   - Frost opacity (20–95%, "Auto" clears back to the built-in default)
   - Soft shadow (neumorphic) — layers the embossed light/dark dual
     shadow from the reference image under the glass fill, instead of
     the normal single lifted drop-shadow */
function LiquidGlassOptionsRow({ options, onChange, onReset }) {
  const o = options || { blur: 20, opacity: null, soft: false };
  const isAuto = o.opacity == null;
  return (
    <div style={{
      border: "1px solid #ece7d8", borderRadius: 10, background: "rgba(255,255,255,0.7)",
      padding: "10px 10px 12px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
        <Sparkles size={12} style={{ color: C.dark }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>Liquid Glass — fine-tune</span>
        <div style={{ flex: 1 }} />
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={onReset} title="Reset blur/opacity/shadow" style={{
          border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
          padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
        }}><RefreshCw size={10} /> Reset</motion.button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 700, color: "#8a8579", marginBottom: 4 }}>
          <span>Blur</span><span>{o.blur}px</span>
        </div>
        <input type="range" min={4} max={40} step={1} value={o.blur}
          onChange={(e) => onChange({ blur: Number(e.target.value) })}
          style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 700, color: "#8a8579", marginBottom: 4 }}>
          <span>Frost opacity</span>
          <span>{isAuto ? "Auto" : `${Math.round(o.opacity * 100)}%`}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="range" min={20} max={95} step={1} value={isAuto ? 65 : Math.round(o.opacity * 100)}
            onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            style={{ flex: 1 }} />
          {!isAuto && (
            <button onClick={() => onChange({ opacity: null })} style={{
              border: "1px solid #ddd6c4", background: "#fff", color: "#8a8579", borderRadius: 999,
              padding: "2px 8px", cursor: "pointer", fontSize: 9, fontWeight: 700, flexShrink: 0,
            }}>Auto</button>
          )}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
        <input type="checkbox" checked={!!o.soft} onChange={(e) => onChange({ soft: e.target.checked })} />
        <span style={{ fontSize: 10, fontWeight: 700, color: C.dark }}>Soft shadow (neumorphic)</span>
      </label>
      <div style={{ fontSize: 8.5, color: "#8a8579", marginTop: 3, lineHeight: 1.4 }}>
        Adds the embossed light/dark edge from the soft-UI moodboard under the glass blur, instead of a single floating shadow.
      </div>
    </div>
  );
}

/* Top-level Theme tab shown inside Settings — five sub-sections. */
function ThemePanel({ state, theme, layoutSizes, onScopeChange, onScopeReset, onWidgetChange, onWidgetReset, onWidgetSize, onAnalyticsSummaryChange, onAnalyticsSummaryReset, onAnalyticsSummaryColorChange, onAnalyticsSummaryColorReset, onAnalyticsColorChange, onAnalyticsColorReset, onMoneyColorChange, onMoneyColorReset, onApplyPreset, onResetPreset, onLiquidGlassOptionsChange, onLiquidGlassOptionsReset }) {
  const [section, setSection] = useState("dashboard");
  const t = normalizeTheme(theme);
  const SECTIONS = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutGrid size={10} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={10} /> },
    { key: "widgets", label: "Widgets", icon: <Palette size={10} /> },
    { key: "analyticsSummary", label: "Analytics Summary", icon: <PiggyBank size={10} /> },
    { key: "money", label: "Money Management", icon: <Wallet size={10} /> },
    { key: "focusMode", label: "Focus Mode", icon: <Target size={10} /> },
    { key: "friendCelebration", label: "Friend Celebration", icon: <Users size={10} /> },
  ];
  return (
    <div>
      <PanelPresetRow activePreset={t.panelPreset} onApply={onApplyPreset} onReset={onResetPreset} />
      {t.panelPreset === "liquidGlass" && (
        <LiquidGlassOptionsRow options={t.liquidGlassOptions} onChange={onLiquidGlassOptionsChange} onReset={onLiquidGlassOptionsReset} />
      )}
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
          <div key="analyticsSummary" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AnalyticsSummaryThemeEditor
              state={state} metrics={t.analyticsSummary.metrics} colors={t.analyticsSummaryColors}
              onChange={onAnalyticsSummaryChange} onReset={onAnalyticsSummaryReset}
            />
            <AnalyticsSummaryColorsEditor
              value={t.analyticsSummaryColors}
              onChange={(key, hex) => onAnalyticsSummaryColorChange(key, hex)}
              onReset={onAnalyticsSummaryColorReset}
            />
          </div>
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
        {section === "friendCelebration" && (
          <ScopeThemeEditor
            key="friendCelebration" title="Friend Celebration" icon={<Users size={12} style={{ color: C.dark }} />}
            value={t.friendCelebration} onChange={(p) => onScopeChange("friendCelebration", p)} onReset={() => onScopeReset("friendCelebration")}
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

function MemNotesPanel({ summary, memInput, setMemInput, onSubmit, readOnly }) {
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
      {!readOnly && (
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
      )}
    </div>
  );
}

const MEM_TABS = [
  { key: "goals", label: "Goals", icon: CheckCircle2 },
  { key: "money", label: "Money", icon: Wallet },
  { key: "photos", label: "Photos", icon: Camera },
  { key: "notes", label: "Notes", icon: StickyNote },
];

export function MemoriesModal({ state, onAddMemory, onClose, readOnly }) {
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
          <span style={{ fontWeight: 900, fontSize: 13, color: C.dark }}>{readOnly ? "Friend's Memories" : "Memories"}</span>
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
            {tabKey === "notes" && <MemNotesPanel summary={summary} memInput={memInput} setMemInput={setMemInput} onSubmit={submitMemory} readOnly={readOnly} />}
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
  todayCardBg: "#ffffff",
  todayCardTextColor: C.text,
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
function LifeStoryDayBlock({ iso, entry, isToday, theme, onChangeHtml, onAddImage, onRemoveImage, blockRef, cardBg, plain }) {
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

  if (plain) {
    // Minimal, card-free rendering for the past-entries list: just the
    // date, left-aligned, with the story text directly underneath it —
    // no gradient border, no background box, no centered pill.
    return (
      <div ref={blockRef} style={{ marginBottom: 22, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, color: C.dark, marginBottom: 6 }}>
          <CalendarDays size={11} /> {formatStoryDate(iso)}
        </div>
        {entry?.html ? (
          <div
            onClick={handleChipClick}
            style={{ fontSize: t.fontSize, fontWeight: t.bold ? 700 : 400, lineHeight: 1.6, color: t.textColor, fontFamily: t.fontFamily, whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left" }}
            dangerouslySetInnerHTML={{ __html: entry.html }}
          />
        ) : (
          <div style={{ fontSize: t.fontSize, color: "#c9c4b3", fontStyle: "italic", fontFamily: t.fontFamily }}>No story written this day.</div>
        )}

        <AnimatePresence>
          {lightbox !== null && (
            <LifeStoryLightbox src={images[lightbox]} onClose={() => setLightbox(null)} onDelete={() => { onRemoveImage(lightbox); setLightbox(null); }} />
          )}
        </AnimatePresence>
      </div>
    );
  }

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
        <div style={{ position: "relative", background: cardBg || (isDark ? "rgba(20,20,20,0.94)" : "rgba(255,255,255,0.92)"), borderRadius: 16, padding: 14 }}>
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

      {/* Today's Entry (glass popup) — its own colors, independent from
         the page/past-entries theme above, since it floats on its own
         translucent glass rather than sitting on the page background. */}
      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#a39c86", marginTop: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <BookOpen size={10} /> TODAY'S ENTRY CARD
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "#a39c86", marginBottom: 4 }}>Card background</div>
          <input
            type="color" value={/^#[0-9a-fA-F]{6}$/.test(theme.todayCardBg) ? theme.todayCardBg : "#ffffff"}
            onChange={(e) => set({ todayCardBg: e.target.value })}
            style={{ width: "100%", height: 28, borderRadius: 8, border: "1px solid #ece7d8", cursor: "pointer", padding: 2, background: "#fff" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "#a39c86", marginBottom: 4 }}>Card text</div>
          <input
            type="color" value={/^#[0-9a-fA-F]{6}$/.test(theme.todayCardTextColor) ? theme.todayCardTextColor : "#403d39"}
            onChange={(e) => set({ todayCardTextColor: e.target.value })}
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

/* ---------------- TODAY'S ENTRY — LIQUID GLASS POPUP ----------------
   Today's journal entry no longer sits inline in the feed. It lives
   inside a floating, fully-glass card that genie-opens/closes out of
   the header's "today" toggle button (same liquid-warp filter + squeeze
   animation as GenieHidable above, just landing on a floating popup
   instead of an inline block). Sized to sit inside the "past-day entry
   card" area rather than covering the whole screen, and dismissible by
   the toggle button, the ✕, an outside click, or Escape. */
function LifeStoryTodayGlassPopup({ open, toggleRef, children, onClose, cardBg = "#ffffff", textColor = C.dark }) {
  const wrapRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const prevOpenRef = useRef(false);

  // Drives open → mount+emerge, and close → shrink+unmount, off of the
  // `open` prop (parent just flips a boolean; this owns the animation).
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen) { setMounted(true); return; }

    if (!open && wasOpen) {
      const el = wrapRef.current;
      const btn = toggleRef.current;
      if (!el || !btn) { setMounted(false); return; }
      const elRect = el.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const dx = (btnRect.left + btnRect.width / 2) - (elRect.left + elRect.width / 2);
      const dy = (btnRect.top + btnRect.height / 2) - (elRect.top + elRect.height / 2);
      el.style.transformOrigin = "50% 50%";
      el.style.filter = "url(#ls-genie-warp)";
      try {
        document.getElementById("ls-genie-turb-anim")?.beginElement();
        document.getElementById("ls-genie-disp-anim")?.beginElement();
      } catch (e) { /* SMIL restart can throw on rapid re-clicks in some engines */ }
      animate(el, {
        x: [0, dx * 0.45, dx], y: [0, dy * 0.55, dy],
        scaleX: [1, 1.16, 0.04], scaleY: [1, 0.7, 0.05],
        opacity: [1, 1, 0],
      }, {
        duration: 0.55, times: [0, 0.42, 1], ease: "easeInOut",
        onComplete: () => setMounted(false),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Once mounted for an "open", play the emerge-from-button animation.
  useEffect(() => {
    if (!mounted || !open) return;
    const el = wrapRef.current;
    const btn = toggleRef.current;
    if (!el || !btn) return;
    const elRect = el.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const dx = (btnRect.left + btnRect.width / 2) - (elRect.left + elRect.width / 2);
    const dy = (btnRect.top + btnRect.height / 2) - (elRect.top + elRect.height / 2);
    el.style.transformOrigin = "50% 50%";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.04, 0.05)`;
    el.style.opacity = "0";
    el.style.filter = "url(#ls-genie-warp)";
    try {
      document.getElementById("ls-genie-turb-anim")?.beginElement();
      document.getElementById("ls-genie-disp-anim")?.beginElement();
    } catch (e) { /* see above */ }
    requestAnimationFrame(() => {
      animate(el, {
        x: [dx, dx * 0.4, 0], y: [dy, dy * 0.5, 0],
        scaleX: [0.04, 1.16, 1], scaleY: [0.05, 0.7, 1],
        opacity: [0, 1, 1],
      }, {
        duration: 0.6, times: [0, 0.55, 1], ease: "easeOut",
        onComplete: () => { el.style.filter = ""; el.style.transform = ""; el.style.opacity = ""; },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Outside click + Escape both close it — only wired up while it's showing.
  useEffect(() => {
    if (!mounted) return;
    const handleClick = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (toggleRef.current?.contains(e.target)) return;
      onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [mounted, onClose, toggleRef]);

  if (!mounted) return null;

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute", right: "3%", bottom: "8%",
        width: "min(440px, 58%)", height: "44%", minWidth: 250, minHeight: 220,
        zIndex: 45,
      }}
    >
      <div
        style={{
          position: "relative", width: "100%", height: "100%", borderRadius: 26,
          background: `linear-gradient(150deg, ${hexToRgba(cardBg, 0.62)}, ${hexToRgba(cardBg, 0.22)} 55%, ${hexToRgba(cardBg, 0.34)})`,
          border: `1px solid ${hexToRgba(cardBg, 0.75)}`,
          boxShadow: "0 26px 64px rgba(37,36,34,0.32), 0 2px 0 rgba(255,255,255,0.6) inset, 0 -1px 0 rgba(255,255,255,0.25) inset",
          backdropFilter: "blur(26px) saturate(200%)", WebkitBackdropFilter: "blur(26px) saturate(200%)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* top gloss sheen — the "glass key" highlight from the reference look */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "48%", pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0))",
        }} />
        <div style={{
          position: "absolute", top: 10, left: "8%", right: "8%", height: 10, borderRadius: 999, pointerEvents: "none",
          background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(255,255,255,0))", filter: "blur(2px)",
        }} />

        <div style={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderBottom: `1px solid ${hexToRgba(cardBg, 0.45)}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: textColor, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} /> Today's Entry
          </span>
          <motion.div
            whileHover={{ scale: 1.15, rotate: 90 }} whileTap={{ scale: 0.9 }}
            onClick={onClose} style={{ cursor: "pointer", color: textColor, display: "flex" }}
          >
            <X size={14} />
          </motion.div>
        </div>

        <div style={{ position: "relative", flex: 1, overflowY: "auto", padding: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function LifeStoryTab({ state, update, onClose }) {
  const story = state.lifeStory || { profile: null, entries: {} };
  const entries = story.entries || {};
  const theme = { ...LIFE_STORY_DEFAULT_THEME, ...(story.theme || {}) };
  // Today's Entry popup uses its own bg/text colors (set in Theme →
  // Today's Entry Card) rather than the page/past-entries ones above,
  // since it floats on its own translucent glass. Falls back safely if
  // a saved theme predates these two fields.
  const todayCardBgHex = /^#[0-9a-fA-F]{6}$/.test(theme.todayCardBg) ? theme.todayCardBg : "#ffffff";
  const todayCardTextHex = /^#[0-9a-fA-F]{6}$/.test(theme.todayCardTextColor) ? theme.todayCardTextColor : (/^#/.test(theme.textColor) ? theme.textColor : C.dark);
  const today = todayISO();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [todayPopupOpen, setTodayPopupOpen] = useState(false);
  const feedRef = useRef(null);
  const blockRefs = useRef({});
  const hideToggleRef = useRef(null);
  const pastCardRef = useRef(null);

  const dates = useMemo(() => {
    const keys = new Set(Object.keys(entries));
    keys.add(today);
    return [...keys].sort(); // ascending — oldest at top, today at bottom
  }, [entries, today]);
  // Everything except today — this is what lives inside the bounded
  // "past-day entry card" area. Today's entry now lives only in the
  // glass popup, opened from the header toggle.
  const pastDates = useMemo(() => dates.filter((d) => d !== today), [dates, today]);

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
    if (iso === today) { setTodayPopupOpen(true); return; }
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
          onClick={() => setTodayPopupOpen((v) => !v)}
          title={todayPopupOpen ? "Close today's entry" : "Open today's entry"}
          style={{
            border: `1px solid ${todayPopupOpen ? C.accent : C.text}`, borderRadius: 999, padding: "4px 9px", background: todayPopupOpen ? "#fff7ea" : "#fff",
            display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, fontWeight: 800, color: todayPopupOpen ? C.accent : C.dark,
          }}
        >
          <BookOpen size={11} /> {todayPopupOpen ? "close" : "today"}
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
      <div style={{ flex: 1, position: "relative", padding: 16, background: theme.bgColor, overflow: "hidden" }}>
        <div ref={feedRef} style={{ position: "absolute", inset: 0, overflowY: "auto", padding: 16 }}>
          {/* Past-day entries — no card/border/box at all, just the date
             then the story text underneath it, left-aligned. Today's
             entry lives only in the glass popup below. */}
          <div ref={pastCardRef} style={{ maxWidth: 620, textAlign: "left" }}>
            {pastDates.length === 0 ? (
              <div style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "#a39c86", padding: "8px 0" }}>
                No past entries yet — write today's first, then check back here tomorrow.
              </div>
            ) : (
              pastDates.map((iso) => (
                <LifeStoryDayBlock
                  key={iso} iso={iso} entry={entries[iso]} isToday={false} theme={theme} plain
                  onChangeHtml={setEntryHtml(iso)} onAddImage={addImage(iso)} onRemoveImage={removeImage(iso)}
                  blockRef={(el) => { blockRefs.current[iso] = el; }}
                />
              ))
            )}
          </div>
        </div>

        {/* Today's entry — opens as a full liquid-glass popup out of the
           "today" toggle button in the header above. Its background/text
           color come from Theme → Today's Entry Card. */}
        <LifeStoryTodayGlassPopup
          open={todayPopupOpen} toggleRef={hideToggleRef} onClose={() => setTodayPopupOpen(false)}
          cardBg={todayCardBgHex} textColor={todayCardTextHex}
        >
          <LifeStoryDayBlock
            iso={today} entry={entries[today]} isToday
            theme={{ ...theme, textColor: todayCardTextHex }}
            cardBg={hexToRgba(todayCardBgHex, 0.92)}
            onChangeHtml={setEntryHtml(today)} onAddImage={addImage(today)} onRemoveImage={removeImage(today)}
            blockRef={(el) => { blockRefs.current[today] = el; }}
          />
        </LifeStoryTodayGlassPopup>
      </div>

      <AnimatePresence>{!story.profile && <LifeStoryProfileSetup onSave={setProfile} />}</AnimatePresence>
    </div>
  );
}

/* ---------------- FITNESS TAB (this update) ----------------
   New top-level tab (like Analytics/Money/Life Story) — a full "Liquid
   Glass" screen with 3 sections: Exercise, Yoga, Pranayama. Each section
   is a grid of GIF widget-cards; every card has a top-right "info" button
   that pops a glass modal with how-to steps + benefits, in Hinglish, plus
   the recommended duration. Purely content-driven (FITNESS_DATA below) —
   adding more moves later is just pushing another object into the right
   array and dropping the matching GIF into /public/fitness, no other code
   changes needed. No new Firestore fields — this is reference content,
   not a tracked/completable checklist. */
const FITNESS_SECTIONS = [
  { id: "exercise", label: "Exercise", icon: Dumbbell, color: "#e85d4c" },
  { id: "yoga", label: "Yoga", icon: Flower2, color: "#4a7c59" },
  { id: "pranayama", label: "Pranayama", icon: Wind, color: "#3a86c8" },
];

const FITNESS_DATA = {
  exercise: [
    {
      id: "legRaise",
      name: "Leg Raise",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/leg-raise.gif",
      steps: [
        "Peeth ke bal seedhe lait jayein, dono haath body ke dono taraf zameen par flat rakhein.",
        "Dono pairon ko seedha rakhte hue zameen se halka sa (15–20°) upar uthayein.",
        "Is position ko control ke saath hold karein, phir dheere-dheere niche layein — pair zameen ko touch na karne dein.",
        "Isi tarah reps repeat karein, saans normal rakhein, jerk na maarein.",
      ],
      benefits: [
        "Lower abs aur core strength badhti hai.",
        "Hip flexors mazboot hote hain.",
        "Belly fat kam karne me madad milti hai.",
      ],
    },
    {
      id: "superman",
      name: "Superman Hold",
      duration: "3 sets × 20–30 sec hold",
      gif: "/fitness/superman-hold.gif",
      steps: [
        "Pet ke bal (face down) lait jayein, haathon ko chin/forehead ke neeche fold karke rakhein.",
        "Dono haath aur dono pair ko ek saath zameen se halka upar uthayein, jaise superman udd raha ho.",
        "Peeth aur core tight rakhte hue is position ko 20–30 second hold karein.",
        "Dheere se wapas starting position me aayein aur repeat karein.",
      ],
      benefits: [
        "Lower back aur spine strong hoti hai.",
        "Posture improve hota hai.",
        "Glutes aur hamstrings bhi activate hote hain.",
      ],
    },
    {
      id: "verticalLegRaise",
      name: "Vertical Leg Raise",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/vertical-leg-raise.gif",
      steps: [
        "Peeth ke bal lait jayein, haath body ke dono taraf zameen par flat rakhein.",
        "Dono pairon ko seedha rakhte hue upar ki taraf ~90° tak le jayein.",
        "Control ke saath pairon ko dheere-dheere niche layein, bina zameen chhue.",
        "Movement slow aur controlled rakhein, momentum se na uthayein.",
      ],
      benefits: [
        "Lower abs ke liye ek best exercise hai.",
        "Hip flexibility badhti hai.",
        "Six-pack banane me madad karta hai.",
      ],
    },
    {
      id: "crunch",
      name: "Crunch",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/crunch.gif",
      steps: [
        "Peeth ke bal lait jayein, ghutne mode kar zameen par pair flat rakhein.",
        "Haathon ko sir ke peeche halka support ke liye rakhein — gardan par zor na dein.",
        "Upper body ko dheere se upar uthayein, abs ko squeeze karein.",
        "Saans exhale karte hue upar aayein, phir control ke saath wapas niche.",
      ],
      benefits: [
        "Upper abs strong hote hain.",
        "Core stability improve hoti hai.",
        "Beginner-friendly exercise hai.",
      ],
    },
    {
      id: "benchDips",
      name: "Bench Dips (Tricep Dips)",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/bench-dips.gif",
      steps: [
        "Ek bench ya stable surface ke edge par haath rakhein, ungliyan aage ki taraf.",
        "Pairon ko aage seedha rakhein, hips ko bench se thoda aage slide karein.",
        "Kohniyon ko mod kar body ko dheere-dheere niche layein, jab tak upper arm zameen ke parallel na ho.",
        "Triceps se push karte hue wapas upar aayein — kohniyan poori tarah lock na karein.",
      ],
      benefits: [
        "Triceps aur shoulders strong hote hain.",
        "Upper body strength badhti hai.",
        "Arms ko tone karne me madad karta hai.",
      ],
    },
    {
      id: "bentKneeCrunch",
      name: "Bent-Knee Crunch",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/glute-bridge-crunch.gif",
      steps: [
        "Peeth ke bal lait jayein, ghutne mode karke pair zameen par flat rakhein.",
        "Haathon ko chest par cross karke rakhein.",
        "Upper body ko halka sa upar uthayein, abs ko squeeze karte hue.",
        "Control ke saath niche aayein aur repeat karein.",
      ],
      benefits: [
        "Core aur abs ko directly target karta hai.",
        "Beginners ke liye safe aur effective hai.",
        "Back par zyada pressure nahi padta.",
      ],
    },
    {
      id: "hollowBodyHold",
      name: "Hollow Body Hold",
      duration: "3 sets × 20–30 sec hold",
      gif: "/fitness/hollow-body-hold.gif",
      steps: [
        "Peeth ke bal lait jayein, haathon ko sar ke peeche ya hips ke paas rakhein.",
        "Upper body (head + shoulders) aur dono legs, dono ko zameen se thoda upar uthayein.",
        "Lower back ko zameen se chipka ke rakhein — arch na banne dein.",
        "Is 'banana/hollow' shape ko tight core ke saath hold karein, normal saans lete rahein.",
      ],
      benefits: [
        "Poora core (upper + lower abs) ek saath activate hota hai.",
        "Body control aur stability badhti hai.",
        "Gymnastics aur advanced core moves ki neev banata hai.",
      ],
    },
    {
      id: "plank",
      name: "Plank",
      duration: "3 sets × 30–60 sec hold",
      gif: "/fitness/plank.gif",
      steps: [
        "Push-up jaisi position mein aayein — haath kandhon ke seedhe neeche, poori body ek seedhi line mein.",
        "Toes par balance karein, hips na upar uthayein na neeche girne dein.",
        "Core, glutes aur legs tight rakhein.",
        "Is position ko set time tak hold karein, normal saans lete rahein.",
      ],
      benefits: [
        "Poora core strong hota hai.",
        "Posture aur spine stability improve hoti hai.",
        "Shoulders aur back bhi strengthen hote hain.",
      ],
    },
    {
      id: "reverseCrunchFull",
      name: "Reverse Crunch (Full Extension)",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/reverse-crunch-full.gif",
      steps: [
        "Peeth ke bal lait jayein, haath sar ke paas zameen par support ke liye rakhein.",
        "Core ka use karke hips aur legs ko upar, seedha aasman ki taraf uthayein.",
        "Control ke saath is position ko thoda hold karein.",
        "Dheere-dheere wapas niche layein, hips ko poori tarah zameen par na patko.",
      ],
      benefits: [
        "Lower abs ko intensely target karta hai.",
        "Core strength aur control dono badhte hain.",
        "Advanced ab exercises (jaise V-up) ke liye prepare karta hai.",
      ],
    },
    {
      id: "deadHang",
      name: "Dead Hang",
      duration: "3 sets × 20–40 sec hold",
      gif: "/fitness/dead-hang.gif",
      steps: [
        "Ek pull-up bar ko shoulder-width se thoda zyada wide grip se pakdein.",
        "Poori body ko relax karke seedha latak jayein, pair zameen se upar.",
        "Shoulders ko thoda engage rakhein (poori tarah loose na chhodein), core tight rakhein.",
        "Is position ko comfortable time tak hold karein, saans normal rakhein.",
      ],
      benefits: [
        "Grip strength badhti hai.",
        "Shoulders aur spine decompress hote hain — back pain me rahat milti hai.",
        "Upper body pulling strength ki foundation banti hai.",
      ],
    },
    {
      id: "pushUp",
      name: "Push-Up",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/push-up.gif",
      steps: [
        "Plank position mein aayein, haath thode wide, kandhon ke seedhe neeche.",
        "Kohniyan mod kar chest ko dheere-dheere zameen ke paas layein, body seedhi line mein rakhein.",
        "Chest floor ke paas aane par push karke wapas upar aayein.",
        "Poori range of motion ke saath controlled reps karein.",
      ],
      benefits: [
        "Chest, shoulders aur triceps strong hote hain.",
        "Core bhi stabilizer ki tarah kaam karta hai.",
        "Bina equipment ke full upper-body strength banata hai.",
      ],
    },
    {
      id: "tuckJump",
      name: "Tuck Jump",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/tuck-jump.gif",
      steps: [
        "Seedhe khade hoke halka sa squat position mein aayein.",
        "Explosively upar jump karein aur dono ghutnon ko chest ki taraf tuck karein.",
        "Soft landing ke saath zameen par wapas aayein, ghutne halke mode rakhein.",
        "Turant agla rep shuru karein, rhythm maintain karein.",
      ],
      benefits: [
        "Explosive power aur cardio fitness badhti hai.",
        "Legs aur core dono strong hote hain.",
        "Calorie burn aur agility improve karta hai.",
      ],
    },
    {
      id: "wallPlank",
      name: "Wall Plank (Decline Plank)",
      duration: "3 sets × 20–40 sec hold",
      gif: "/fitness/wall-plank.gif",
      steps: [
        "Plank position mein aayein aur dono pairon ko peeche ek deewar par tikayein (feet elevated).",
        "Haath kandhon ke seedhe neeche, body ek seedhi line mein rakhein.",
        "Core aur glutes tight rakhein, hips ko sag ya spike na hone dein.",
        "Is elevated position ko hold karein — normal plank se thoda zyada challenging hota hai.",
      ],
      benefits: [
        "Normal plank se zyada shoulders aur upper abs par load daalta hai.",
        "Core stability aur balance dono improve hote hain.",
        "Full-body strength ke liye ek advanced progression hai.",
      ],
    },
    {
      id: "stabilityBallPike",
      name: "Stability Ball Pike",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/stability-ball-pike.gif",
      steps: [
        "Push-up position lein, lekin pairon ko zameen ke bajaye ek stability ball par rakhein.",
        "Haath zameen par kandhon ke neeche fixed rakhein, poori body seedhi line mein.",
        "Core ka use karke hips ko upar uthayein aur ball ko apni taraf roll karein (pike shape banaye).",
        "Dheere se wapas start position mein aayein, ball ko control ke saath wapas roll karein.",
      ],
      benefits: [
        "Core, shoulders aur hips sabko ek saath target karta hai.",
        "Balance aur stability significantly improve hoti hai.",
        "Ek advanced-level full-body core exercise hai.",
      ],
    },
    {
      id: "seatedBandRow",
      name: "Seated Resistance Band Row",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/seated-band-row.gif",
      steps: [
        "Zameen par pair seedhe karke baith jayein, band ko pairon ke around ya kisi anchor point se loop karein.",
        "Band ke dono handles ko pakdein, arms aage seedhe rakhein, peeth seedhi rakhein.",
        "Kohniyon ko peeche khींchte hue band ko apne torso ki taraf khींchein, shoulder blades ko squeeze karein.",
        "Control ke saath wapas start position mein aayein, band ko dheere se release karein.",
      ],
      benefits: [
        "Upper aur mid-back muscles strong hote hain.",
        "Posture improve hota hai — jhukna kam hota hai.",
        "Bina heavy weight ke back workout ke liye accha option hai.",
      ],
    },
    {
      id: "declineDumbbellPress",
      name: "Decline Dumbbell Press",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/decline-dumbbell-press.gif",
      steps: [
        "Decline bench par lait jayein, pairon ko top support ke neeche fix karein, ek dumbbell har haath mein pakdein.",
        "Dumbbells ko chest ke upar, arms poori tarah extended rakhein.",
        "Dheere-dheere kohniyan mod kar dumbbells ko chest ke paas layein.",
        "Chest se push karke wapas upar arms extend karein, top par halka squeeze karein.",
      ],
      benefits: [
        "Lower chest ko specifically target karta hai.",
        "Triceps aur shoulders bhi involve hote hain.",
        "Chest ka overall shape aur definition improve hoti hai.",
      ],
    },
    {
      id: "chestSupportedBandRow",
      name: "Chest-Supported Band Row",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/chest-supported-band-row.gif",
      steps: [
        "Ek bench par pet ke bal (chest support ke saath) lait jayein, ek haath mein band/cable pakdein jo neeche anchor ho.",
        "Doosra haath bench par support ke liye rakh sakte hain.",
        "Kohni mod kar band ko apni hip ki taraf khींचein, shoulder blade ko squeeze karein.",
        "Control ke saath arm ko wapas seedha karein aur repeat karein — dono side equal reps karein.",
      ],
      benefits: [
        "Back muscles ko isolate karke target karta hai.",
        "Chest-support hone se lower back par zero strain padta hai.",
        "Muscle imbalance thik karne ke liye (single-arm) best hai.",
      ],
    },
    {
      id: "declineBarbellPress",
      name: "Decline Barbell Press",
      duration: "3 sets × 8–10 reps",
      gif: "/fitness/decline-barbell-press.gif",
      steps: [
        "Decline bench par lait jayein, pairon ko top support ke neeche fix karein.",
        "Barbell ko shoulder-width se thoda wide grip se pakdein, rack se utharein.",
        "Bar ko dheere-dheere lower-chest tak niche layein, kohniyan halki angle par rakhein.",
        "Chest se push karke bar ko wapas upar arms extend hone tak le jayein.",
      ],
      benefits: [
        "Lower chest ke liye heavy strength-building exercise hai.",
        "Triceps aur front shoulders bhi strong hote hain.",
        "Overall pushing power badhata hai.",
      ],
    },
    {
      id: "assistedPullUp",
      name: "Assisted Pull-Up (Incline Bench)",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/assisted-pull-up.gif",
      steps: [
        "Angled bench/machine par baith jayein, overhead bar ko shoulder-width grip se pakdein.",
        "Pairon ko fix karke body ko halka reclined rakhein.",
        "Kohniyan mod kar apni chest/chin ko bar ki taraf upar khींचein.",
        "Control ke saath dheere-dheere wapas niche aayein, arms poori tarah extend na hone dein achanak se.",
      ],
      benefits: [
        "Back aur biceps strong karta hai, full pull-up seekhne ka beginner-friendly tareeka hai.",
        "Grip strength badhti hai.",
        "Full pull-up ki taraf progress karne me madad karta hai.",
      ],
    },
    {
      id: "cableLateralRaise",
      name: "Cable Lateral Raise",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/cable-lateral-raise.gif",
      steps: [
        "Do cable pulleys ke beech khade hoke dono haathon se handles pakdein.",
        "Arms ko halka mod ke rakhein, body seedhi aur core tight rakhein.",
        "Dono arms ko side mein shoulder-height tak upar uthayein, controlled motion ke saath.",
        "Dheere se wapas niche layein, momentum ka use na karein.",
      ],
      benefits: [
        "Side shoulders (lateral deltoids) ko target karta hai.",
        "Cable hone se poori range of motion mein constant tension milti hai.",
        "Shoulders ko wide aur defined look dene me madad karta hai.",
      ],
    },
    {
      id: "barbellShrug",
      name: "Barbell Shrug",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/barbell-shrug.gif",
      steps: [
        "Barbell ko shoulder-width grip se pakdein, seedhe khade hoke arms seedhe niche rakhein.",
        "Shoulders ko seedha upar (kaanon ki taraf) uthayein, jaise \"I don't know\" gesture karte hain.",
        "Top par ek second ke liye hold karke shoulders ko squeeze karein.",
        "Dheere-dheere wapas niche layein, ghumaav (rolling) na karein — sirf up-down movement rakhein.",
      ],
      benefits: [
        "Traps (upper back/neck muscles) strong hote hain.",
        "Upper body ka posture aur look improve hota hai.",
        "Heavy lifting (deadlift/squat) ke liye supporting strength deta hai.",
      ],
    },
    {
      id: "barbellBoxSquat",
      name: "Barbell Box Squat",
      duration: "3 sets × 8–10 reps",
      gif: "/fitness/barbell-box-squat.gif",
      steps: [
        "Rack me barbell ko upper-back/traps par rakhein, bar ko dono haathon se pakdein.",
        "Ek box/bench ke aage khade hoke feet shoulder-width apart rakhein.",
        "Hips ko peeche le jaate hue dheere-dheere box par baith jayein, chest upar rakhein.",
        "Box ko halka touch karke, legs se push karte hue wapas seedhe khade ho jayein.",
      ],
      benefits: [
        "Legs, glutes aur core sabko strong karta hai.",
        "Box ka use squat depth consistent aur safe rakhne me madad karta hai.",
        "Overall lower-body strength aur power badhata hai.",
      ],
    },
    {
      id: "lyingTricepsExtension",
      name: "Lying Triceps Extension",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/lying-triceps-extension.gif",
      steps: [
        "Ek bench par peeth ke bal lait jayein, dono haathon se ek dumbbell/ball ko pakdein.",
        "Arms ko seedha upar (chest/forehead ke upar) rakhein, kohniyan halki fixed rakhein.",
        "Sirf kohniyan mod kar weight ko dheere se sar ke peeche/upar tak niche layein.",
        "Triceps se push karte hue arms ko wapas seedha upar le jayein.",
      ],
      benefits: [
        "Triceps ko directly isolate karke target karta hai.",
        "Arms ko tone aur strong banata hai.",
        "Bench press jaisi pushing exercises ko support karta hai.",
      ],
    },
    {
      id: "standingToeTouchStretch",
      name: "Standing Toe Touch Stretch",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/standing-toe-touch-stretch.gif",
      steps: [
        "Seedhe khade hoke pairon ko hip-width apart rakhein (ya kisi low bar/step par pairon ko halka fix karein).",
        "Ghutne halke se seedhe rakhte hue, hips se aage jhukein.",
        "Dono haathon se apne ankles/toes ko touch karne ki koshish karein.",
        "Is stretch ko relax hoke hold karein, jhatka na maarein — dheere-dheere aur gehra jaayein.",
      ],
      benefits: [
        "Hamstrings aur lower back ko stretch karta hai.",
        "Flexibility badhati hai aur muscle tightness kam karti hai.",
        "Workout se pehle ya baad mein warm-up/cool-down ke liye achhi hai.",
      ],
    },
  ],
  /* Alt Exercise set — toggled in from the header "swap" button next to the
     Exercise/Yoga/Pranayama pills. Same shape as `exercise` above, shown
     instead of it when the toggle is on; toggling again switches back to
     the original 23-item `exercise` list. */
  exerciseAlt: [
    {
      id: "sideLyingLegStretch",
      name: "Side-Lying Leg Stretch (Box)",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/side-lying-leg-stretch.gif",
      steps: [
        "Ek karvat (side) par lait jayein, hips aur shoulders ek hi line me stack rakhein.",
        "Upar wale pair ko seedha rakhte hue kisi box/step ke upar rakhein, neeche wala pair halka mudha rahega.",
        "Ek haath hip par rakhein aur doosra haath support ke liye zameen par flat rakhein.",
        "Is position ko relax hoke hold karein, phir side badal kar doosri taraf repeat karein.",
      ],
      benefits: [
        "Inner thigh aur hip ko achhi tarah stretch karta hai.",
        "Hip flexibility aur mobility improve hoti hai.",
        "Workout se pehle warm-up ya baad me cool-down ke liye achha hai.",
      ],
    },
    {
      id: "lyingToeTouch",
      name: "Lying Toe Touch Stretch",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/lying-toe-touch.gif",
      steps: [
        "Peeth ke bal lait jayein, dono pair seedhe upar (ceiling ki taraf) le jayein.",
        "Dono haathon se upar uthte hue apne toes/ankles ko touch karne ki koshish karein.",
        "Shoulders ko halka sa zameen se upar uthayein, core tight rakhein.",
        "Control ke saath wapas niche aayein aur repeat karein.",
      ],
      benefits: [
        "Abs aur core strength badhti hai.",
        "Hamstrings bhi isi motion me halke se stretch hote hain.",
        "Flexibility aur body coordination improve hoti hai.",
      ],
    },
    {
      id: "floorDumbbellPress",
      name: "Dumbbell Floor Press",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/floor-dumbbell-press.gif",
      steps: [
        "Peeth ke bal zameen par lait jayein, ghutne mode kar pair flat rakhein.",
        "Dono haathon se ek dumbbell ko chest ke paas pakdein, kohniyan zameen ki taraf.",
        "Dumbbell ko seedha upar push karein jab tak arms lock na ho jayein.",
        "Control ke saath dheere-dheere wapas chest tak niche layein aur repeat karein.",
      ],
      benefits: [
        "Chest aur triceps ko target karta hai.",
        "Zameen par lait ke karne se shoulder par kam stress padta hai.",
        "Beginners ke liye bench press ka ek achha, safe alternative hai.",
      ],
    },
    {
      id: "skaterBoxerLunge",
      name: "Split Lunge Punch (Boxer Stance)",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/skater-boxer-lunge.gif",
      steps: [
        "Ek pair aage aur doosra pair peeche, split stance me khade ho jayein, dono fists ko guard position me chin ke paas rakhein.",
        "Front knee ko mode kar body weight ko thoda aage-niche shift karein, back leg seedhi rakhein.",
        "Core tight rakhte hue balance banaye rakhein, jaise ek boxer apni stance hold karta hai.",
        "Kuch second hold karke ya reps me pairon ko switch karke doosri taraf repeat karein.",
      ],
      benefits: [
        "Legs, glutes aur core ek saath activate hote hain.",
        "Balance aur lower-body stability badhti hai.",
        "Functional/athletic movement pattern ban ta hai, footwork improve hoti hai.",
      ],
    },
    {
      id: "proneFullBodyStretch",
      name: "Prone Full-Body Stretch",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/prone-full-body-stretch.gif",
      steps: [
        "Pet ke bal (face down) zameen par flat lait jayein.",
        "Dono haathon ko aage ki taraf seedha extend karein, legs ko peeche seedha rakhein, toes point karein.",
        "Poori body ko lambi line me halka sa stretch karein — jaise dono taraf se khinch rahe hon.",
        "Relax rehte hue normal saans lein aur is position ko hold karein.",
      ],
      benefits: [
        "Poori spine aur body ko gently lengthen karta hai.",
        "Lower back aur shoulders ka tension release hota hai.",
        "Workout se pehle warm-up ya baad me cool-down ke liye achha hai.",
      ],
    },
    {
      id: "seatedRussianTwistDumbbell",
      name: "Seated Russian Twist (Dumbbell)",
      duration: "3 sets × 16–20 reps (8–10 per side)",
      gif: "/fitness/seated-russian-twist-dumbbell.gif",
      steps: [
        "Zameen par baith jayein, ghutne mode kar upper body ko thoda peeche lean karein (V-sit jaisi position).",
        "Dono haathon se ek dumbbell ko chest ke saamne pakdein.",
        "Core ko engage karte hue torso ko ek taraf twist karein, phir doosri taraf.",
        "Chahe to legs ko zameen se thoda upar uthaye rakhein taaki intensity badhe, saans normal rakhein.",
      ],
      benefits: [
        "Obliques aur poora core strong hote hain.",
        "Rotational strength aur balance improve hoti hai.",
        "Waistline tone karne me madad milti hai.",
      ],
    },
    {
      id: "bentKneeCrunchFeetUp",
      name: "Bent-Knee Crunch (Feet Raised)",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/bent-knee-crunch-feet-up.gif",
      steps: [
        "Peeth ke bal lait jayein, ghutne 90° mode kar pair zameen se upar uthayein (table-top position).",
        "Haathon ko sir ke peeche halka support ke liye rakhein, gardan par zor na dein.",
        "Upper body ko dheere se upar uthayein, abs ko squeeze karein.",
        "Control ke saath wapas niche aayein — shoulders zameen ko halka sa touch karke phir se uthayein.",
      ],
      benefits: [
        "Upper aur lower abs dono ek saath target hote hain.",
        "Core control aur stability badhti hai.",
        "Lower back-friendly variation hai, kyunki pair zameen ko touch nahi karte.",
      ],
    },
    {
      id: "kneelingJumpSquat",
      name: "Kneeling Jump Squat",
      duration: "3 sets × 8–10 reps",
      gif: "/fitness/kneeling-jump-squat.gif",
      steps: [
        "Zameen par ghutnon ke bal baithein, upper body seedhi rakhein, fists ko chin ke paas guard position me rakhein.",
        "Hips aur core ko explosively engage karte hue, ghutnon se zameen chhodkar seedhe pairon par upar 'jump' karein.",
        "Soft aur controlled landing ke saath dono pairon par khade ho jayein.",
        "Dheere se wapas kneeling position me aayein aur repeat karein — beginners chahe to bina jump ke sirf khade hoke bhi kar sakte hain.",
      ],
      benefits: [
        "Explosive power aur core strength dono badhte hain.",
        "Hips aur glutes ko activate karta hai.",
        "Full-body coordination aur athleticism improve hoti hai.",
      ],
    },
    {
      id: "plankLegRaise",
      name: "Plank Leg Raise",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/plank-leg-raise.gif",
      steps: [
        "High plank position me aayein, haath kandhon ke seedhe neeche, body ek seedhi line me.",
        "Core tight rakhte hue, ek pair ko seedha rakhte hue hips height tak upar uthayein.",
        "Hips ko level rakhein — ek taraf twist na hone dein.",
        "Control ke saath pair ko wapas niche layein aur doosri taraf repeat karein.",
      ],
      benefits: [
        "Core, glutes aur lower back ek saath strong hote hain.",
        "Balance aur stability badhti hai.",
        "Plank ka isometric benefit + glute activation, dono ek exercise me.",
      ],
    },
    {
      id: "sideLyingObliqueCrunch",
      name: "Side-Lying Oblique Crunch",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/side-lying-oblique-crunch.gif",
      steps: [
        "Ek karvat (side) par lait jayein, neeche wala haath zameen par support ke liye rakhein.",
        "Upar wale haath ko sir ke peeche rakhein, dono legs ko seedha aur ek saath rakhein.",
        "Legs ko halka sa upar uthate hue, upper body ko bhi thoda crunch karein — jaise dono ends paas aa rahe hon.",
        "Control ke saath wapas starting position me aayein, phir side badal kar doosri taraf repeat karein.",
      ],
      benefits: [
        "Obliques (side abs) ko directly target karta hai.",
        "Waistline tone karne me madad karta hai.",
        "Core stability aur lateral strength badhti hai.",
      ],
    },
    {
      id: "standingWideArmStretch",
      name: "Standing Wide-Arm Chest Stretch",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/standing-wide-arm-stretch.gif",
      steps: [
        "Seedhe khade ho jayein, pair hip-width apart rakhein.",
        "Dono haathon ko dono taraf shoulder height tak seedha faila dein (T shape).",
        "Chest ko halka sa aage push karein aur shoulder blades ko paas laane ki koshish karein.",
        "Deep breaths lete hue is position ko relax hoke hold karein.",
      ],
      benefits: [
        "Chest, shoulders aur upper back ko open aur stretch karta hai.",
        "Posture improve karne me madad karta hai, especially desk-work ke baad.",
        "Warm-up ya cool-down dono ke liye suitable hai.",
      ],
    },
    /* ---- 19 new exercises added on user request (this update) ---- */
    {
      id: "donkeyKick",
      name: "Donkey Kick (Kneeling Leg Raise)",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/donkey-kick.gif",
      steps: [
        "Tabletop position me aa jayein — dono haath shoulders ke neeche, dono ghutne hips ke neeche.",
        "Ek ghutna 90° mode rakhte hue, us pair ko upar ceiling ki taraf push karein — foot sole ceiling ki taraf ho.",
        "Top position par thoda squeeze karein, phir control ke saath wapas starting position me layein.",
        "Poora set ek side par complete karke doosri side par repeat karein.",
      ],
      benefits: [
        "Glutes (especially glute max) ko directly target karta hai.",
        "Hip stability aur lower-back support improve hota hai.",
        "Core bhi is movement me automatically engage hota hai.",
      ],
    },
    {
      id: "quadrupedLegExtension",
      name: "Quadruped Leg Extension",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/quadruped-leg-extension.gif",
      steps: [
        "Tabletop position me aa jayein, back neutral (na zyada arch, na round) rakhein.",
        "Ek leg ko seedha peeche ki taraf extend karein, jab tak wo hip ke level tak (ya thoda upar) na aa jaye.",
        "Core tight rakhein taaki hips side-to-side na hilein, 1–2 second hold karein.",
        "Dheere se wapas starting position me layein aur dusri leg se repeat karein.",
      ],
      benefits: [
        "Lower back aur glutes strengthen karta hai.",
        "Balance aur core stability improve hoti hai.",
        "Spine ko neutral position me control karna sikhata hai.",
      ],
    },
    {
      id: "straightArmPlank",
      name: "Straight-Arm Plank",
      duration: "3 sets × 30–45 sec hold",
      gif: "/fitness/straight-arm-plank.gif",
      steps: [
        "Push-up position me aa jayein — haath shoulders ke seedhe neeche, arms straight (locked nahi, halka soft).",
        "Pairon ko peeche extend karein, toes par weight rakhein, body head-to-heel ek seedhi line me rakhein.",
        "Core, glutes aur quads tight rakhein — hips na girne dein na zyada upar uthne dein.",
        "Normal saans lete hue is position ko hold karein.",
      ],
      benefits: [
        "Poora core (abs, obliques, lower back) engage hota hai.",
        "Shoulders aur wrists ki stability badhti hai.",
        "Posture aur overall body control improve hota hai.",
      ],
    },
    {
      id: "childsPoseStretch",
      name: "Child's Pose Stretch",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/childs-pose-stretch.gif",
      steps: [
        "Ghutnon ke bal baithein, ghutne hip-width ya thoda zyada wide rakhein.",
        "Hips ko dheere se heels ki taraf le jayein aur upper body ko aage zameen ki taraf jhukayein.",
        "Haathon ko aage extend karein (ya body ke paas relax chhod dein), forehead ko zameen par rakhein.",
        "Deep, slow breaths lete hue relax karein, lower back aur shoulders ko release hone dein.",
      ],
      benefits: [
        "Lower back, hips aur shoulders ko gently stretch karta hai.",
        "Stress aur tension release karne me madad karta hai.",
        "Workout ke beech ya baad recovery ke liye acha hai.",
      ],
    },
    {
      id: "crossArmCrunch",
      name: "Cross-Arm Crunch",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/cross-arm-crunch.gif",
      steps: [
        "Peeth ke bal lait jayein, ghutne mode kar pair zameen par flat rakhein.",
        "Dono haathon ko cross karke chest/chin ke paas rakhein (gardan par pull na karein).",
        "Abs ko squeeze karte hue upper body ko dheere se upar uthayein.",
        "Ek beat hold karein, phir control ke saath wapas niche aayein.",
      ],
      benefits: [
        "Upper abs ko isolate karke target karta hai.",
        "Gardan par strain kam karta hai (traditional crunch ke comparison me).",
        "Core endurance build karne ke liye acha beginner move hai.",
      ],
    },
    {
      id: "plankKneeRaise",
      name: "Plank Knee Raise (Hip Extension)",
      duration: "3 sets × 10–12 reps (per side)",
      gif: "/fitness/plank-knee-raise.gif",
      steps: [
        "Forearm ya straight-arm plank position me aa jayein, body ek seedhi line me.",
        "Ek ghutne ko mode kar us leg ko upar-peeche ki taraf lift karein (hip height tak ya thoda upar).",
        "Hips ko level rakhein — is movement ke dauran torso rotate na ho.",
        "Control ke saath leg ko wapas layein aur dusri side se repeat karein.",
      ],
      benefits: [
        "Glutes aur core dono ek saath engage hote hain.",
        "Plank ke isometric hold ke saath dynamic hip strength bhi milti hai.",
        "Hip stability aur balance improve hota hai.",
      ],
    },
    {
      id: "reclinedKneeBendRest",
      name: "Reclined Knee-Bend Rest",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/reclined-knee-bend-rest.gif",
      steps: [
        "Peeth ke bal lait jayein, ghutne mode karein aur pair zameen par flat, hip-width apart rakhein.",
        "Haath body ke dono taraf relax chhod dein, shoulders zameen par soft rakhein.",
        "Lower back ko zameen ke saath halka connect hone dein, jaw aur neck relax rakhein.",
        "Slow, deep breaths ke saath is position me rest karein.",
      ],
      benefits: [
        "Core aur ab exercises ke beech ek achi reset/recovery position hai.",
        "Lower back ko neutral positon me relax karta hai.",
        "Heart rate normal karne aur breathing control ke liye useful hai.",
      ],
    },
    {
      id: "sideLyingRelaxationStretch",
      name: "Side-Lying Relaxation Stretch",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/side-lying-relaxation-stretch.gif",
      steps: [
        "Ek karvat (side) par lait jayein, neeche wala haath sir ke neeche support ke liye mode lein.",
        "Upar wala haath body ke aage zameen par relax rakhein, dono legs ko seedha aur ek dusre par rakhein.",
        "Poori body ko relax hone dein, shoulders aur hips ko soft rakhein.",
        "Kuch saans lene ke baad side badal kar dusri taraf repeat karein.",
      ],
      benefits: [
        "Poori body (especially spine aur hips) ko gently release karta hai.",
        "Cool-down ya stretching routine ke liye acha starting/ending point hai.",
        "Relaxation aur breathing awareness badhata hai.",
      ],
    },
    {
      id: "standingSideLegRaise",
      name: "Standing Side Leg Raise",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/standing-side-leg-raise.gif",
      steps: [
        "Seedhe khade ho jayein, haathon ko chest ke paas clasp kar lein balance ke liye.",
        "Weight ek leg par shift karein aur dusri leg ko seedha side me upar uthayein.",
        "Torso ko seedha rakhein, hips ko aage-peeche na jhukne dein.",
        "Control ke saath leg ko wapas niche layein aur reps complete karke side badlein.",
      ],
      benefits: [
        "Outer thighs aur glutes (glute medius) ko target karta hai.",
        "Balance aur single-leg stability improve karta hai.",
        "Warm-up ya lower-body circuit dono me fit ho jata hai.",
      ],
    },
    {
      id: "kneelingForwardReachStretch",
      name: "Kneeling Forward Reach Stretch",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/kneeling-forward-reach-stretch.gif",
      steps: [
        "Tabletop position se shuru karein, ek leg ko seedha peeche extend karein.",
        "Upper body ko dheere se aage zameen ki taraf reach karein, haath aage stretch karein.",
        "Lower back ko round na karein — hips se hinge karte hue lambi spine rakhein.",
        "Position hold karein, phir dheere se wapas aayein aur dusri side se repeat karein.",
      ],
      benefits: [
        "Hip flexors, hamstrings aur lower back ko stretch karta hai.",
        "Spine mobility aur balance dono improve hote hain.",
        "Strength moves ke beech acha active-recovery stretch hai.",
      ],
    },
    {
      id: "sideLyingKneeTuckStretch",
      name: "Side-Lying Knee Tuck Stretch",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/side-lying-knee-tuck-stretch.gif",
      steps: [
        "Ek karvat par lait jayein, dono ghutnon ko mode kar chest ki taraf le aayein (fetal-jaisi position).",
        "Haathon se dheere se ghutnon ko chest ke aur paas hold karein, gardan aur shoulders relax rakhein.",
        "Lower back me halka stretch mehsoos hone tak position hold karein.",
        "Kuch saans ke baad relax karein aur chahein to side badal kar repeat karein.",
      ],
      benefits: [
        "Lower back aur hips ko gently decompress karta hai.",
        "Tension release karne aur relax karne me madad karta hai.",
        "Cool-down routine ka acha hissa ban sakta hai.",
      ],
    },
    {
      id: "verticalToeReachCrunch",
      name: "Vertical Toe-Reach Crunch",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/vertical-toe-reach-crunch.gif",
      steps: [
        "Peeth ke bal lait jayein, dono pairon ko seedha upar ceiling ki taraf le jayein (90°).",
        "Haathon ko upar extend karke shins/toes ki taraf reach karein.",
        "Upper body ko crunch karte hue shoulders zameen se uthayein, abs ko squeeze karein.",
        "Control ke saath wapas niche aayein, legs ko upar hi stable rakhein.",
      ],
      benefits: [
        "Upper aur lower abs dono ek saath engage hote hain.",
        "Core coordination aur strength badhati hai.",
        "Six-pack definition ke liye ek advanced-level move hai.",
      ],
    },
    {
      id: "standingMarchInPlace",
      name: "Standing March in Place",
      duration: "3 sets × 30–45 sec",
      gif: "/fitness/standing-march-in-place.gif",
      steps: [
        "Seedhe khade ho jayein, haath relax body ke paas rakhein.",
        "Ek ghutna hip height tak upar uthayein, phir niche laate hue dusra ghutna uthayein — jaise jagah par chal rahe hon.",
        "Arms ko naturally opposite leg ke saath swing hone dein.",
        "Ek steady, comfortable rhythm me continue karein.",
      ],
      benefits: [
        "Heart rate gently raise karta hai — warm-up ke liye perfect.",
        "Hip flexors aur core activate hote hain.",
        "Low-impact hone ki wajah se sabke liye suitable hai.",
      ],
    },
    {
      id: "boxerGuardStance",
      name: "Boxer Guard Stance Hold",
      duration: "3 sets × 30–40 sec hold",
      gif: "/fitness/boxer-guard-stance.gif",
      steps: [
        "Pair shoulder-width apart, ek pair thoda aage (staggered stance) rakhein, ghutne halke se soft.",
        "Dono haathon ko fists bana kar chin/cheek ke paas guard position me rakhein.",
        "Core tight aur weight thoda balls-of-feet par rakhein, ready position jaisa feel karein.",
        "Is stance ko hold karein, punches/combos shuru karne se pehle base position ke tor par use karein.",
      ],
      benefits: [
        "Lower-body stability aur core engagement badhata hai.",
        "Boxing-based cardio moves (punches, split lunge punch) ke liye base stance hai.",
        "Coordination aur reaction-readiness improve karta hai.",
      ],
    },
    {
      id: "flutterKicks",
      name: "Flutter Kicks",
      duration: "3 sets × 30–40 sec",
      gif: "/fitness/flutter-kicks.gif",
      steps: [
        "Peeth ke bal lait jayein, haath hips ke neeche ya body ke dono taraf rakhein.",
        "Dono pairon ko zameen se thoda upar uthayein, legs seedhi rakhein.",
        "Chhoti-chhoti, fast alternating up-down kicks karein — jaise swimming me flutter kick karte hain.",
        "Lower back ko zameen ke paas rakhein, core tight rakhte hue continue karein.",
      ],
      benefits: [
        "Lower abs aur hip flexors ko intensely target karta hai.",
        "Core endurance aur stability badhati hai.",
        "Cardio-core combo circuit ke liye acha finisher move hai.",
      ],
    },
    {
      id: "highPlankHold",
      name: "High Plank Hold",
      duration: "3 sets × 30–45 sec hold",
      gif: "/fitness/high-plank-hold.gif",
      steps: [
        "Push-up position me aa jayein, haath shoulders ke seedhe neeche rakhein.",
        "Pairon ko peeche extend karein, toes par weight, body head-to-heel ek line me.",
        "Hips ko na zyada upar uthne dein, na neeche girne dein — neutral spine rakhein.",
        "Core aur glutes tight rakhte hue, normal saans ke saath position hold karein.",
      ],
      benefits: [
        "Full-body isometric strength build karta hai.",
        "Core stability aur shoulder endurance improve hota hai.",
        "Har fitness level ke liye scalable exercise hai.",
      ],
    },
    {
      id: "pushUpDescent",
      name: "Push-Up",
      duration: "3 sets × 10–15 reps",
      gif: "/fitness/push-up-descent.gif",
      steps: [
        "High plank position se shuru karein, haath shoulder-width se thoda wide rakhein.",
        "Kohniyan mod kar chest ko dheere-dheere zameen ki taraf niche layein, body ek line me rakhein.",
        "Chest zameen ke paas aane par, haathon se push karte hue wapas upar aayein.",
        "Poori movement me core tight aur elbows body ke thode close rakhein.",
      ],
      benefits: [
        "Chest, shoulders aur triceps strengthen karta hai.",
        "Core bhi stabilizer ke tor par kaam karta hai.",
        "Equipment-free, kahin bhi kiya ja sakta hai.",
      ],
    },
    {
      id: "joggingInPlace",
      name: "Jogging in Place",
      duration: "3 sets × 30–60 sec",
      gif: "/fitness/jogging-in-place.gif",
      steps: [
        "Seedhe khade ho jayein, haathon ko halka mode kar running-motion me rakhein.",
        "Ek jagah par hi halki jogging shuru karein, ghutne comfortable height tak uthayein.",
        "Arms ko naturally legs ke opposite swing hone dein, breathing steady rakhein.",
        "Comfortable pace par continue karein, zaroorat ho to intensity adjust karein.",
      ],
      benefits: [
        "Cardio warm-up ke liye quick aur effective hai.",
        "Blood flow aur heart rate badhata hai, joints ko movement ke liye prepare karta hai.",
        "Koi equipment ya bahar jaane ki zarurat nahi.",
      ],
    },
    {
      id: "standingHighKneeRaise",
      name: "Standing High Knee Raise",
      duration: "3 sets × 15–20 reps (per side)",
      gif: "/fitness/standing-high-knee-raise.gif",
      steps: [
        "Seedhe khade ho jayein, haath relax ya halka guard position me rakhein.",
        "Ek ghutna waist/hip height tak jitna comfortably ho sake, tezi se upar uthayein.",
        "Dheere se pair niche layein aur dusri leg se repeat karein — chahein to alternate karke continuous karein.",
        "Core engaged rakhein aur torso ko seedha, stable rakhein.",
      ],
      benefits: [
        "Core, hip flexors aur cardio fitness ek saath improve karta hai.",
        "Coordination aur balance badhata hai.",
        "HIIT ya warm-up circuits me easily fit ho jata hai.",
      ],
    },
    {
      id: "mountainClimber",
      name: "Mountain Climber",
      duration: "3 sets × 20–30 reps (per side)",
      gif: "/fitness/mountain-climber.gif",
      steps: [
        "High plank position se shuru karein, haath shoulders ke neeche aur body ek seedhi line mein rakhein.",
        "Ek ghutne ko chest ki taraf tezi se aage laayein, phir wapas plank position mein le jayein.",
        "Dusre pair se bhi wahi movement karein — jaise running motion, dono pair alternate karte rahein.",
        "Hips ko stable rakhein, jhukne na dein, aur core tight rakhein poori exercise ke dauran.",
      ],
      benefits: [
        "Core aur abs ko strong banata hai.",
        "Cardio aur fat-burning ke liye ek high-intensity move hai.",
        "Shoulders aur hip flexors ki agility improve karta hai.",
      ],
    },
    {
      id: "standingKneeDrive",
      name: "Standing Knee Drive",
      duration: "3 sets × 15–20 reps (per side)",
      gif: "/fitness/standing-knee-drive.gif",
      steps: [
        "Seedhe khade ho jayein, haathon ko running position mein halka mode kar rakhein.",
        "Ek ghutne ko upar aur aage ki taraf tezi se drive karein, jaise sprint start kar rahe hon.",
        "Dheere se pair niche layein aur dusre pair se repeat karein.",
        "Torso ko halka aage jhukayein aur poore movement mein balance banaye rakhein.",
      ],
      benefits: [
        "Hip flexors aur core ko activate karta hai.",
        "Sprint aur running form improve karne mein madad karta hai.",
        "Warm-up ya cardio circuit dono ke liye acha hai.",
      ],
    },
    {
      id: "highKneeMarch",
      name: "High Knee March",
      duration: "3 sets × 30–45 sec",
      gif: "/fitness/high-knee-march.gif",
      steps: [
        "Seedhe khade ho jayein, haath body ke paas relaxed rakhein.",
        "Ek ghutna hip height tak upar uthayein, chahein to opposite haath ko halka sa upar laayein.",
        "Control ke saath pair niche layein aur dusre pair se march continue karein.",
        "Ek steady, marching rhythm maintain karein, jaldi na karein.",
      ],
      benefits: [
        "Core aur hip flexors ko gently strengthen karta hai.",
        "Low-impact warm-up ke liye perfect hai.",
        "Balance aur coordination improve karta hai.",
      ],
    },
    {
      id: "threeLeggedDownDog",
      name: "Three-Legged Downward Dog Stretch",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/three-legged-downward-dog.gif",
      steps: [
        "Downward dog position mein aayein — hips upar, haath aur pair zameen par, body ek inverted-V shape mein.",
        "Ek pair ko seedha upar hip height se bhi upar uthayein, dono haath zameen par firm rakhein.",
        "Hips ko square rakhne ki koshish karein, uthaye hue pair ko seedha aur active rakhein.",
        "Kuch saans hold karein, phir side badal kar dusre pair se repeat karein.",
      ],
      benefits: [
        "Hamstrings, calves aur shoulders ko deeply stretch karta hai.",
        "Core aur balance ko engage karta hai.",
        "Poori body ko lengthen karne wala achha stretch hai.",
      ],
    },
    {
      id: "standardPlankHold",
      name: "Standard Plank Hold",
      duration: "3 sets × 30–45 sec hold",
      gif: "/fitness/standard-plank-hold.gif",
      steps: [
        "Forearms ya haathon par plank position mein aayein, body sir se ediyon tak ek seedhi line mein rakhein.",
        "Core, glutes aur thighs ko tight kar ke engage karein.",
        "Hips ko na upar uthne dein na neeche jhukne dein — neutral spine maintain karein.",
        "Steady saans lete hue is position ko hold karein.",
      ],
      benefits: [
        "Poore core — abs, obliques aur lower back — ko strengthen karta hai.",
        "Posture aur spine stability improve karta hai.",
        "Beginner se advanced tak sabke liye ek foundational move hai.",
      ],
    },
    {
      id: "seatedHalfSplitStretch",
      name: "Seated Half-Split Stretch",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/seated-half-split-stretch.gif",
      steps: [
        "Zameen par baith jayein, ek pair seedha aage extend karein aur dusra pair ghutne se mod kar side mein rakhein.",
        "Seedhe pair ki taraf thoda aage jhukein, dono haathon se shin ya ankle ki taraf reach karein.",
        "Peeth ko jitna ho sake seedha rakhein, hips ko zameen par grounded rakhein.",
        "Hamstring mein stretch mehsoos karte hue position hold karein, phir side badal kar repeat karein.",
      ],
      benefits: [
        "Hamstrings aur lower back ko deeply stretch karta hai.",
        "Hip flexibility improve karta hai.",
        "Workout ke baad cool-down ke liye achha hai.",
      ],
    },
    {
      id: "reverseLegRaiseCeiling",
      name: "Lying Vertical Leg Raise",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/lying-vertical-leg-raise.gif",
      steps: [
        "Peeth ke bal lait jayein, dono pair seedhe jode kar rakhein aur haath body ke paas ya hips ke neeche rakhein.",
        "Dono pairon ko ek saath seedha upar (ceiling ki taraf) uthayein jab tak wo vertical na ho jayein.",
        "Control ke saath dheere-dheere pairon ko niche layein, zameen ko touch na karein.",
        "Lower back ko zameen se pressed rakhein poori movement ke dauran.",
      ],
      benefits: [
        "Lower abs ko strongly target karta hai.",
        "Core stability aur control improve karta hai.",
        "Six-pack definition ke liye effective move hai.",
      ],
    },
    {
      id: "squatHandsBehindHead",
      name: "Bodyweight Squat (Hands Behind Head)",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/squat-hands-behind-head.gif",
      steps: [
        "Pair shoulder-width apart rakh kar khade ho jayein, dono haath sir ke peeche rakhein.",
        "Hips ko peeche aur niche le jayein jaise kisi chair par baith rahe hon, ghutne toes ki direction mein rakhein.",
        "Thighs zameen ke parallel hone tak niche jayein, chest upar aur seedha rakhein.",
        "Ediyon se push karte hue wapas starting position mein aayein.",
      ],
      benefits: [
        "Quads, glutes aur hamstrings ko strengthen karta hai.",
        "Hands behind head rakhne se upper back aur posture bhi engage hoti hai.",
        "Lower-body strength training ka ek solid foundational move hai.",
      ],
    },
    {
      id: "straightLegRaiseHold",
      name: "Straight-Leg Raise Hold",
      duration: "3 sets × 20–30 sec hold",
      gif: "/fitness/straight-leg-raise-hold.gif",
      steps: [
        "Peeth ke bal lait jayein, haath body ke bagal mein ya hips ke neeche rakhein support ke liye.",
        "Dono pairon ko seedha rakhte hue zameen se karib 45° ke angle tak upar uthayein.",
        "Lower back ko zameen se pressed rakhte hue is position ko hold karein.",
        "Steady saans lete rahein, phir dheere se pair niche layein.",
      ],
      benefits: [
        "Lower abs aur hip flexors ko isometrically strengthen karta hai.",
        "Core endurance badhata hai.",
        "Simple lekin effective ab move hai, koi equipment nahi chahiye.",
      ],
    },
    {
      id: "spidermanPlankCrunch",
      name: "Spiderman Plank Crunch",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/spiderman-plank-crunch.gif",
      steps: [
        "High plank position se shuru karein, haath shoulders ke neeche.",
        "Ek ghutne ko mod kar usi taraf ki kohni ki taraf side se laayein, jaise spider crawl kar raha ho.",
        "Pair ko wapas plank position mein le jayein, dusri taraf se repeat karein.",
        "Hips low aur stable rakhein, poori movement mein core engaged rakhein.",
      ],
      benefits: [
        "Obliques aur core ko intensely target karta hai.",
        "Hip mobility aur coordination improve karta hai.",
        "Full-body cardio aur strength dono ek saath milti hai.",
      ],
    },
    {
      id: "dumbbellPullover",
      name: "Dumbbell Pullover",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/dumbbell-pullover.gif",
      steps: [
        "Peeth ke bal lait jayein (bench ya zameen par), ghutne mode kar pair flat rakhein.",
        "Dono haathon se ek dumbbell ko chest ke upar pakdein, kohniyan halki mudi hui.",
        "Dumbbell ko dheere-dheere sir ke peeche, zameen ke karib tak le jayein, chest ko stretch hone dein.",
        "Control ke saath wapas chest ke upar layein, poori movement smooth rakhein.",
      ],
      benefits: [
        "Chest, lats aur triceps ko ek saath target karta hai.",
        "Upper body mobility aur ribcage expansion improve karta hai.",
        "Full-body pulling aur pushing strength dono banane mein madad karta hai.",
      ],
    },
    {
      id: "standingWideStanceSideBend",
      name: "Standing Wide-Stance Side Bend",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/standing-wide-stance-side-bend.gif",
      steps: [
        "Pair ko normal se zyada wide rakh kar khade ho jayein, toes halka bahar ki taraf.",
        "Dono haathon ko upar sir ke paas le jayein.",
        "Upper body ko ek side ki taraf jhukayein, opposite side ki waist mein stretch mehsoos karein.",
        "Position hold karein, phir seedhe ho kar dusri side repeat karein.",
      ],
      benefits: [
        "Obliques aur side body ko deeply stretch karta hai.",
        "Inner thighs bhi is wide stance se engage hoti hain.",
        "Spine flexibility aur posture improve karta hai.",
      ],
    },
    {
      id: "catCowStretch",
      name: "Cat-Cow Stretch",
      duration: "2–3 sets × 8–10 reps",
      gif: "/fitness/cat-cow-stretch.gif",
      steps: [
        "Hands aur knees par aa jayein (tabletop position), wrists shoulders ke neeche aur knees hips ke neeche.",
        "Saans chhodte hue peeth ko upar arch karein (cat pose), thodi ko chest ki taraf laayein.",
        "Saans lete hue peeth ko niche dip karein (cow pose), chest aur sir ko upar uthayein.",
        "Dono positions ke beech breath ke saath smoothly move karte rahein.",
      ],
      benefits: [
        "Spine ki flexibility aur mobility improve karta hai.",
        "Back aur neck ki tension release karta hai.",
        "Warm-up ya yoga cool-down dono ke liye achha hai.",
      ],
    },
    {
      id: "seatedLegExtensionBench",
      name: "Seated Leg Extension (Bench)",
      duration: "3 sets × 15–20 reps (per side)",
      gif: "/fitness/seated-leg-extension-bench.gif",
      steps: [
        "Kisi bench ya sturdy chair ke edge par baith jayein, dono pair ghutno se mudhe hue zameen par.",
        "Ek pair ko seedha aage ki taraf uthayein jab tak wo fully extended na ho jaye.",
        "Thigh muscle ko squeeze karte hue kuch second hold karein.",
        "Control ke saath pair niche layein aur dusre pair se repeat karein.",
      ],
      benefits: [
        "Quadriceps ko isolate karke strengthen karta hai.",
        "Knee stability aur joint health improve karta hai.",
        "Beginners ke liye ek low-impact leg-strengthening move hai.",
      ],
    },
    {
      id: "figure4Stretch",
      name: "Figure-4 Stretch (Reclining Pigeon)",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/fitness/figure-4-stretch.jpg",
      steps: [
        "Peeth ke bal lait jayein, dono ghutne mode kar pair flat rakhein.",
        "Ek ankle ko dusre pair ke ghutne ke upar cross karein, jaise figure-4 shape ban raha ho.",
        "Neeche wale pair ki thigh ko dono haathon se pakdein aur chest ki taraf dheere se khinchein.",
        "Upar wali hip mein stretch mehsoos karte hue position hold karein, phir side badal kar repeat karein.",
      ],
      benefits: [
        "Glutes aur piriformis ko deeply stretch karta hai.",
        "Hip tightness aur lower-back discomfort kam karta hai.",
        "Workout ke baad cool-down ke liye achha hai.",
      ],
    },
    {
      id: "boatPoseHold",
      name: "Boat Pose Hold (V-Sit)",
      duration: "3 sets × 20–30 sec hold",
      gif: "/fitness/boat-pose-hold.gif",
      steps: [
        "Zameen par baith jayein, ghutne halke mode kar rakhein aur haath legs ke paas rakhein.",
        "Torso ko peeche thoda tilt karein aur dono pairon ko zameen se upar uthayein.",
        "Dheere-dheere pairon ko seedha karein, body ek V-shape banaye, haath aage extend karein.",
        "Core tight rakhte hue balance ke saath is position ko hold karein.",
      ],
      benefits: [
        "Poore core aur hip flexors ko strongly engage karta hai.",
        "Balance aur stability improve karta hai.",
        "Posture aur spine strength ke liye bhi faydemand hai.",
      ],
    },
    {
      id: "bicycleCrunch",
      name: "Bicycle Crunch",
      duration: "3 sets × 15–20 reps (per side)",
      gif: "/fitness/bicycle-crunch.gif",
      steps: [
        "Peeth ke bal lait jayein, dono haath sir ke peeche halke se rakhein.",
        "Dono ghutne chest ki taraf uthayein aur shoulders ko zameen se thoda upar crunch karein.",
        "Ek ghutne ko seedha extend karein jabki dusra ghutna chest ki taraf aaye, opposite elbow ko us ghutne ki taraf twist karein.",
        "Cycling motion mein dono sides alternate karte hue continue karein.",
      ],
      benefits: [
        "Abs aur obliques dono ko ek saath target karta hai.",
        "Core rotation aur coordination improve karta hai.",
        "Equipment-free, kahin bhi kiya ja sakta hai.",
      ],
    },
    {
      id: "scissorKicks",
      name: "Scissor Kicks",
      duration: "3 sets × 20–30 sec",
      gif: "/fitness/scissor-kicks.gif",
      steps: [
        "Peeth ke bal lait jayein, haath body ke bagal mein flat rakhein support ke liye.",
        "Dono pairon ko zameen se thoda upar uthayein.",
        "Ek pair ko upar aur dusre ko niche le jayein, phir alternate karein — jaise scissor chal rahi ho.",
        "Lower back ko zameen se pressed rakhein aur core tight rakhein poori movement mein.",
      ],
      benefits: [
        "Lower abs aur hip flexors ko strongly target karta hai.",
        "Core endurance aur control badhata hai.",
        "Cardio ke saath-saath ab burn bhi karta hai.",
      ],
    },
    {
      id: "supermanReach",
      name: "Superman Reach",
      duration: "3 sets × 12–15 reps",
      gif: "/fitness/superman-reach.gif",
      steps: [
        "Pet ke bal (face-down) lait jayein, dono haath aage aur pair peeche seedhe extend karein.",
        "Ek saath dono haath, chest aur pairon ko zameen se upar uthayein, jaise udd rahe hon.",
        "Kuch second is position ko hold karein, lower back ko squeeze karein.",
        "Control ke saath wapas starting position mein aayein.",
      ],
      benefits: [
        "Lower back aur glutes ko strengthen karta hai.",
        "Poori posterior chain (peeth, glutes, hamstrings) ko activate karta hai.",
        "Posture improve karne aur back pain kam karne mein madad karta hai.",
      ],
    },
    {
      id: "boxStepUp",
      name: "Box Step-Up",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/box-step-up.gif",
      steps: [
        "Ek sturdy box ya step ke saamne khade ho jayein.",
        "Ek pair box par rakhein aur us pair se push karte hue poori body ko upar uthayein.",
        "Dusre pair ko bhi box par le aayein, seedhe khade ho jayein.",
        "Control ke saath ek-ek pair kar ke wapas zameen par utrein, phir dusre pair se shuru karein.",
      ],
      benefits: [
        "Quads, glutes aur hamstrings ko functional tarike se strengthen karta hai.",
        "Balance aur single-leg stability improve karta hai.",
        "Cardio aur lower-body strength dono ek saath milti hai.",
      ],
    },
    {
      id: "standingMountainPose",
      name: "Standing Mountain Pose (Posture Reset)",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/standing-mountain-pose.gif",
      steps: [
        "Dono pair jode kar ya hip-width apart seedhe khade ho jayein.",
        "Weight ko dono pairon par evenly distribute karein, shoulders ko relax kar peeche-niche rakhein.",
        "Chest ko halka upar aur spine ko lamba rakhein, chin neutral position mein.",
        "Steady, deep saans lete hue is grounded posture ko hold karein.",
      ],
      benefits: [
        "Posture awareness aur alignment improve karta hai.",
        "Balance aur body-mind focus badhata hai.",
        "Kisi bhi workout ya stretch routine ke start/end mein achha reset point hai.",
      ],
    },
    {
      id: "forearmPlankFists",
      name: "Forearm Plank (Fists)",
      duration: "3 sets × 30–45 sec hold",
      gif: "/fitness/forearm-plank-fists.gif",
      steps: [
        "Forearms zameen par rakhein, kohniyan shoulders ke seedhe neeche, dono haath fist bana kar rakhein.",
        "Pairon ko peeche extend karein, toes par balance karein, body ek seedhi line mein.",
        "Core, glutes aur thighs ko tight kar ke engage karein.",
        "Hips ko na upar uthne dein na neeche jhukne dein, steady saans lete hue hold karein.",
      ],
      benefits: [
        "Core aur shoulders ko strongly stabilize karta hai.",
        "Forearm grip aur upper-body endurance badhata hai.",
        "Standard plank ka ek joint-friendly variation hai.",
      ],
    },
    {
      id: "bandedSideLyingClamshell",
      name: "Banded Side-Lying Clamshell",
      duration: "3 sets × 15–20 reps (per side)",
      gif: "/fitness/banded-side-lying-clamshell.gif",
      steps: [
        "Ek resistance band dono ankles ke around lagayein aur side mein lait jayein, ghutne mode kar rakhein, pair ek dusre ke upar.",
        "Sir ko haath se support karein, hips ko stack rakhein.",
        "Ediyon ko touch rakhte hue, upar wale ghutne ko band ke resistance ke against upar uthayein.",
        "Control ke saath wapas niche layein, phir repeat karein — poora set khatam hone par side badlein.",
      ],
      benefits: [
        "Glutes (khaas kar glute medius) ko target karta hai.",
        "Hip stability aur knee alignment improve karta hai.",
        "Band ka resistance move ko aur effective banata hai.",
      ],
    },
    {
      id: "standingOverheadReachStretch",
      name: "Standing Overhead Reach Stretch",
      duration: "2–3 sets × 15–20 sec hold",
      gif: "/fitness/standing-overhead-reach-stretch.gif",
      steps: [
        "Seedhe khade ho jayein, pair hip-width apart rakhein.",
        "Dono haathon ko sir ke upar seedha extend karein, ungliyan ceiling ki taraf reach karein.",
        "Poori body ko halka lamba (elongate) karein, ediyon ko halka upar bhi utha sakte hain.",
        "Kuch second hold karein, steady saans lein, phir dheere se haath niche layein.",
      ],
      benefits: [
        "Poori body — shoulders, spine aur sides — ko stretch karta hai.",
        "Posture aur upper-body mobility improve karta hai.",
        "Warm-up ya kisi bhi workout ke beech quick reset ke liye achha hai.",
      ],
    },
    {
      id: "weightedToeReachDumbbell",
      name: "Weighted Toe Reach (Dumbbell)",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/weighted-toe-reach-dumbbell.gif",
      steps: [
        "Peeth ke bal lait jayein, dono pairon ko seedha upar (vertical) uthayein.",
        "Ek dumbbell dono haathon se pakdein aur chest ke upar rakhein.",
        "Shoulders ko zameen se upar crunch karte hue dumbbell ko apne pairon/toes ki taraf reach karein.",
        "Control ke saath wapas niche layein, poori movement mein pair stable rakhein.",
      ],
      benefits: [
        "Upper abs ko added resistance ke saath target karta hai.",
        "Core strength aur stability ko next level tak le jata hai.",
        "Simple crunch se zyada challenging aur effective variation hai.",
      ],
    },
    {
      id: "singleLegRaiseLying",
      name: "Single-Leg Raise (Lying)",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/single-leg-raise-lying.gif",
      steps: [
        "Peeth ke bal lait jayein, ek haath sir ke neeche rakhein support ke liye, dusra haath side mein.",
        "Ek pair ko seedha rakhte hue upar ~45° angle tak uthayein, dusra pair zameen par flat rahega.",
        "Upar uthaye hue pair ko control ke saath niche layein, zameen touch na karein.",
        "Set poora hone ke baad dusre pair se repeat karein.",
      ],
      benefits: [
        "Lower abs aur hip flexors ko isolate karke strengthen karta hai.",
        "Core control aur stability improve karta hai.",
        "Beginners ke liye bhi ek accessible ab move hai.",
      ],
    },
    {
      id: "tabletopCrunchHold",
      name: "Tabletop Crunch Hold",
      duration: "3 sets × 20–30 sec hold",
      gif: "/fitness/tabletop-crunch-hold.gif",
      steps: [
        "Peeth ke bal lait jayein, dono ghutne 90° par mode kar tabletop position mein rakhein (shins zameen ke parallel).",
        "Haath body ke bagal mein flat rakhein, lower back ko zameen se pressed rakhein.",
        "Core ko engage kar ke is position ko steady hold karein.",
        "Steady saans lete rahein, hips ko rock na hone dein.",
      ],
      benefits: [
        "Lower abs ko isometrically activate karta hai.",
        "Core control aur pelvic stability improve karta hai.",
        "Reverse crunch aur leg-raise jaisi exercises ke liye ek achhi foundation hai.",
      ],
    },
    {
      id: "seatedSingleLegStretch",
      name: "Seated Single-Leg Stretch",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/seated-single-leg-stretch.jpg",
      steps: [
        "Zameen par baith jayein, torso ko halka peeche recline karein aur upper body ko crunch karein.",
        "Ek ghutne ko chest ki taraf mode kar dono haathon se shin pakdein, dusra pair seedha aage extend karein.",
        "Balance banaye rakhte hue kuch second hold karein.",
        "Pair switch karein aur dusri taraf se repeat karein, movement ko smooth rakhein.",
      ],
      benefits: [
        "Abs aur hip flexors ko ek saath target karta hai.",
        "Core balance aur coordination improve karta hai.",
        "Pilates-style ek effective ab-toning move hai.",
      ],
    },
    {
      id: "lyingSingleLegRaiseHandsBehindHead",
      name: "Lying Single-Leg Raise (Hands Behind Head)",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/lying-single-leg-raise-hands-behind-head.gif",
      steps: [
        "Peeth ke bal lait jayein, dono haath sir ke peeche halke se rakhein.",
        "Ek pair ko seedha rakhte hue upar vertical position tak uthayein, dusra pair zameen par flat rahega.",
        "Shoulders ko zameen se halka crunch karte hue upar uthaye hue pair ki taraf reach karein.",
        "Control ke saath niche layein, phir dusre pair se repeat karein.",
      ],
      benefits: [
        "Upper aur lower abs dono ko ek saath engage karta hai.",
        "Hip flexor flexibility aur core strength improve karta hai.",
        "Basic leg raise se zyada core-intensive variation hai.",
      ],
    },
    {
      id: "bandedSumoSquat",
      name: "Banded Sumo Squat",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/banded-sumo-squat.gif",
      steps: [
        "Ek resistance band ankles ke around lagayein, pair normal se wide rakh kar khade ho jayein, toes bahar ki taraf.",
        "Dono haath hips par rakhein, chest upar aur seedha rakhein.",
        "Hips ko niche le jayein jaise sumo-style squat kar rahe hon, ghutne band ke against bahar push karein.",
        "Ediyon se push karte hue wapas starting position mein aayein.",
      ],
      benefits: [
        "Glutes, inner thighs aur outer hips ko strongly target karta hai.",
        "Band ka resistance muscle activation aur burn dono badhata hai.",
        "Lower-body strength aur stability improve karta hai.",
      ],
    },
    {
      id: "straightLegToeTouch",
      name: "Straight-Leg Toe Touch",
      duration: "3 sets × 15–20 reps",
      gif: "/fitness/straight-leg-toe-touch.gif",
      steps: [
        "Peeth ke bal lait jayein, dono pair seedhe upar uthayein.",
        "Ek saath dono haath aur upper body ko crunch karte hue upar uthayein, hips ko bhi halka zameen se uthne dein.",
        "Haathon se apne toes ko touch karne ki koshish karein, poori movement control ke saath karein.",
        "Dheere-dheere wapas starting position mein aayein.",
      ],
      benefits: [
        "Poore abs — upper aur lower dono — ko intensely target karta hai.",
        "Core power aur coordination badhata hai.",
        "Ek dynamic, high-engagement ab move hai.",
      ],
    },
    {
      id: "vUpToeTouch",
      name: "V-Up (Toe Touch)",
      duration: "3 sets × 10–12 reps",
      gif: "/fitness/v-up-toe-touch.gif",
      steps: [
        "Peeth ke bal lait jayein, haath sir ke upar aur pair seedhe extend karein.",
        "Ek saath dono haath aur pairon ko upar uthayein, body ek V-shape banaye.",
        "Haathon se toes ko touch karein, core ko poori tarah squeeze karein.",
        "Control ke saath wapas niche layein, zameen touch karne se pehle phir se shuru karein.",
      ],
      benefits: [
        "Poore core ko ek powerful, compound movement mein target karta hai.",
        "Flexibility aur core strength dono ek saath improve karta hai.",
        "Advanced ab-training ke liye ek classic move hai.",
      ],
    },
    {
      id: "proneSingleLegRaise",
      name: "Prone Single-Leg Raise",
      duration: "3 sets × 12–15 reps (per side)",
      gif: "/fitness/prone-single-leg-raise.gif",
      steps: [
        "Pet ke bal (face-down) lait jayein, haath body ke bagal mein flat rakhein.",
        "Ek pair ko seedha rakhte hue zameen se jitna ho sake upar uthayein.",
        "Glute ko squeeze karte hue kuch second hold karein.",
        "Control ke saath pair niche layein, phir dusre pair se repeat karein.",
      ],
      benefits: [
        "Glutes aur lower back ko isolate karke strengthen karta hai.",
        "Hip extension strength aur posture improve karta hai.",
        "Superman jaisi exercises ka ek single-leg, joint-friendly variation hai.",
      ],
    },
    {
      id: "proneFullBodyReach",
      name: "Prone Full-Body Reach",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/fitness/prone-full-body-reach.gif",
      steps: [
        "Pet ke bal (face-down) lait jayein, dono haath aage aur pair peeche seedhe extend karein.",
        "Poori body ko flat rakhte hue haath aur pairon ko halka zameen se lift karein, jaise lamba stretch ho raha ho.",
        "Sir ko neutral rakhein, neck strain na karein.",
        "Steady saans lete hue is lengthened position ko hold karein.",
      ],
      benefits: [
        "Poori posterior chain — peeth, glutes aur shoulders — ko gently activate karta hai.",
        "Spine ko lengthen kar posture improve karta hai.",
        "Superman-style exercises ke liye ek halka warm-up move hai.",
      ],
    },
  ],
  yoga: [
    {
      id: "ardhaHalasana",
      name: "Ardha Halasana (Half Plow Pose)",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/yoga/ardha-halasana-half-plow.gif",
      steps: [
        "Peeth ke bal (matt par) lait jayein, dono haath body ke bagal mein flat rakhein, hatheliyan zameen ki taraf.",
        "Saans lete hue dono pairon ko seedha rakhte hue upar uthayein, jab tak wo zameen se ~60–90° angle par na aa jayein.",
        "Lower back ko zameen se pressed rakhein, neck aur shoulders ko relaxed rakhein.",
        "Steady saans lete hue is position ko hold karein, phir saans chhodte hue dheere se pair niche layein.",
      ],
      benefits: [
        "Thyroid gland ko gently stimulate karta hai, halke neck compression ke through jab combine kiya jaye pura Halasana ke saath.",
        "Abdominal muscles aur hip flexors ko strengthen karta hai.",
        "Sarvangasana aur Halasana jaisi advanced poses ke liye ek safe prep move hai.",
      ],
    },
    {
      id: "navasanaBoatPose",
      name: "Navasana (Boat Pose)",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/yoga/navasana-boat-pose.gif",
      steps: [
        "Zameen par baith jayein, ghutne mode kar pair flat rakhein.",
        "Torso ko halka peeche recline karein aur dono pairon ko zameen se uthayein, shins ko zameen ke parallel rakhein.",
        "Dono haathon ko aage, pairon ke parallel extend karein, hatheliyan ek dusre ki taraf.",
        "Chest ko upar aur spine ko seedha rakhte hue is V-shape position ko balance ke saath hold karein.",
      ],
      benefits: [
        "Core, hip flexors aur spine ko ek saath strengthen karta hai.",
        "Digestion improve karta hai aur abdominal organs ko stimulate karta hai.",
        "Balance, focus aur concentration badhata hai.",
      ],
    },
    {
      id: "ardhaSarvangasana",
      name: "Ardha Sarvangasana (Half Shoulder Stand)",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/yoga/ardha-sarvangasana-half-shoulder-stand.gif",
      steps: [
        "Peeth ke bal lait jayein, dono haath body ke bagal mein rakhein.",
        "Saans lete hue hips aur pairon ko upar uthayein, ghutne mode kar sakte hain.",
        "Dono haathon se lower back/hips ko support dein, kohniyan zameen par firm rakhein.",
        "Chin ko halka chest ki taraf laayein (chin lock), steady saans lete hue is position ko hold karein.",
      ],
      benefits: [
        "Thyroid gland ko directly stimulate karta hai neck ke gentle compression se — thyroid health ke liye is list ka sabse effective pose mana jata hai.",
        "Blood circulation ko upper body aur brain ki taraf improve karta hai.",
        "Stress kam karta hai aur poori endocrine system ko balance karne mein madad karta hai.",
      ],
    },
    {
      id: "ustrasanaCamelPose",
      name: "Ustrasana (Camel Pose)",
      duration: "2–3 sets × 15–20 sec hold",
      gif: "/yoga/ustrasana-camel-pose.gif",
      steps: [
        "Ghutno ke bal khade ho jayein (kneeling), ghutne hip-width apart rakhein.",
        "Dono haathon ko lower back ya hips par rakhein, support ke liye.",
        "Chest ko upar aur aage push karte hue peeche ki taraf halka backbend karein, sir ko dheere se peeche jaane dein.",
        "Neck par zyada zor na dein, steady saans lete hue hold karein, phir dheere se wapas aayein.",
      ],
      benefits: [
        "Thyroid gland ko stimulate karta hai throat ke stretch se.",
        "Chest, shoulders aur spine ko deeply open karta hai.",
        "Posture improve karta hai aur peeth ko strengthen karta hai.",
      ],
    },
    {
      id: "constructiveRestPose",
      name: "Constructive Rest Pose",
      duration: "2–3 sets × 30–60 sec hold",
      gif: "/yoga/constructive-rest-pose.gif",
      steps: [
        "Peeth ke bal lait jayein, dono ghutne mode kar pair flat zameen par rakhein hip-width apart.",
        "Dono haath body ke bagal mein relaxed rakhein, hatheliyan upar ya niche jo comfortable lage.",
        "Lower back ko naturally zameen ke saath settle hone dein, jabardasti press na karein.",
        "Steady, deep saans lete hue is neutral resting position ko hold karein.",
      ],
      benefits: [
        "Lower back aur hips ki tension release karta hai.",
        "Spine ko ek neutral, supported position mein relax karta hai.",
        "Back pain relief aur stress kam karne ke liye ek gentle, safe pose hai.",
      ],
    },
    {
      id: "makarasanaCrocodilePose",
      name: "Makarasana (Crocodile Pose)",
      duration: "2–3 sets × 30–60 sec hold",
      gif: "/yoga/makarasana-crocodile-pose.gif",
      steps: [
        "Pet ke bal (face-down) lait jayein, pair thoda apart aur relaxed rakhein.",
        "Dono haathon ko fold kar ek dusre ke upar rakhein, aur forehead/chin ko haathon par rest karein.",
        "Shoulders aur poori body ko completely relax hone dein.",
        "Slow, deep belly-breathing par focus karte hue is position ko hold karein.",
      ],
      benefits: [
        "Poori peeth aur nervous system ko deeply relax karta hai.",
        "Stress aur anxiety kam karta hai.",
        "Backbends ke baad ya kisi bhi yoga session ke end mein rest pose ke liye achha hai.",
      ],
    },
    {
      id: "virabhadrasanaIIWarrior",
      name: "Virabhadrasana II (Warrior II)",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/yoga/virabhadrasana-ii-warrior-ii.gif",
      steps: [
        "Pairon ko wide stance mein rakhein, ek pair aage 90° mode karein aur dusra pair peeche seedha rakhein.",
        "Dono haathon ko shoulder height par zameen ke parallel extend karein.",
        "Aage wale ghutne ko ankle ke upar rakhein, hips ko square aur torso ko seedha rakhein.",
        "Aage wale haath ki direction mein dekhein, steady saans lete hue hold karein, phir side badal kar repeat karein.",
      ],
      benefits: [
        "Legs, hips aur core ko strongly strengthen karta hai.",
        "Stamina, balance aur focus improve karta hai.",
        "Digestion aur bloating relief ke liye bhi asar dikhata hai.",
      ],
    },
    {
      id: "marjaryasanaCatPose",
      name: "Marjaryasana (Cat Pose)",
      duration: "2–3 sets × 15–20 sec hold",
      gif: "/yoga/marjaryasana-cat-pose.gif",
      steps: [
        "Hands aur knees par aa jayein (tabletop position), wrists shoulders ke neeche aur knees hips ke neeche.",
        "Saans chhodte hue peeth ko upar ki taraf arch karein, chin ko chest ki taraf laayein.",
        "Pet ko andar khinchein aur spine ko rounded rakhein.",
        "Kuch second hold karein, phir neutral position mein wapas aayein.",
      ],
      benefits: [
        "Spine ki flexibility aur mobility improve karta hai.",
        "Belly ko gently massage karta hai, jo bloating mein bhi madad karta hai.",
        "Back aur neck ki tension release karta hai.",
      ],
    },
    {
      id: "supportedSavasanaKneesBent",
      name: "Supported Savasana (Knees Bent)",
      duration: "2–3 sets × 60–90 sec hold",
      gif: "/yoga/supported-savasana-knees-bent.gif",
      steps: [
        "Peeth ke bal lait jayein, ghutne mode kar pair flat zameen par rakhein.",
        "Ek haath ko relaxed body ke bagal mein rakhein aur dusra haath halka forehead/aankhon ke upar rakhein.",
        "Poori body ko completely relax hone dein, jaw aur shoulders ko loosen karein.",
        "Slow, natural saans lete hue kuch minute is calming position mein rahein.",
      ],
      benefits: [
        "Deep relaxation aur stress relief deta hai.",
        "Nervous system ko calm karta hai aur mind ko settle karta hai.",
        "Kisi bhi yoga sequence ke end mein poori body ko integrate karne ke liye perfect hai.",
      ],
    },
    {
      id: "salambaBhujangasanaSphinx",
      name: "Salamba Bhujangasana (Sphinx Pose)",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/yoga/salamba-bhujangasana-sphinx-pose.gif",
      steps: [
        "Pet ke bal (face-down) lait jayein, forearms zameen par rakhein, kohniyan shoulders ke neeche.",
        "Forearms se halka press karte hue chest aur upper body ko dheere se upar uthayein.",
        "Hips aur pair zameen par relaxed rakhein, shoulders ko peeche-niche rakhein.",
        "Steady saans lete hue is gentle backbend ko hold karein.",
      ],
      benefits: [
        "Spine ko gently strengthen karta hai bina zyada strain ke.",
        "Chest aur abdomen ko open karta hai, jo digestion improve karta hai.",
        "Cobra pose ka ek beginner-friendly, low-intensity variation hai.",
      ],
    },
    {
      id: "phalakasanaPlankPose",
      name: "Phalakasana (Plank Pose)",
      duration: "3 sets × 20–30 sec hold",
      gif: "/yoga/phalakasana-plank-pose.gif",
      steps: [
        "High plank position mein aayein, haath shoulders ke seedhe neeche rakhein.",
        "Pairon ko peeche extend karein, toes par balance karein, body ek seedhi line mein.",
        "Core, glutes aur thighs ko tight kar ke engage karein.",
        "Neutral spine maintain karte hue steady saans lein aur hold karein.",
      ],
      benefits: [
        "Poore core, shoulders aur arms ko strengthen karta hai.",
        "Posture aur spine stability improve karta hai.",
        "Morning yoga routine ke liye ek energizing, full-body activating pose hai.",
      ],
    },
    {
      id: "highPlankFullBodyStretch",
      name: "High Plank Pose (Full-Body Stretch)",
      duration: "3 sets × 20–30 sec hold",
      gif: "/yoga/high-plank-full-body-stretch.gif",
      steps: [
        "High plank position mein aayein, haath shoulders ke seedhe neeche rakhein.",
        "Pairon ko peeche extend karein, edi ko dheere se zameen ki taraf push karein, calves aur hamstrings ko stretch karein.",
        "Poori body ko sir se ediyon tak ek lambi, seedhi line mein rakhein.",
        "Core engage rakhte hue steady saans lein aur is lengthened position ko hold karein.",
      ],
      benefits: [
        "Legs, core aur shoulders ko ek saath strengthen aur stretch karta hai.",
        "Poori body ko lengthen kar legs ko leaner aur toned look deta hai.",
        "Posture aur full-body stability improve karta hai.",
      ],
    },
    {
      id: "savasanaCorpsePose",
      name: "Savasana (Corpse Pose)",
      duration: "1 set × 3–5 min hold",
      gif: "/yoga/savasana-corpse-pose.gif",
      steps: [
        "Peeth ke bal lait jayein, dono pair halke apart aur haath body ke bagal mein relaxed rakhein, hatheliyan upar ki taraf.",
        "Aankhein band kar lein aur poori body ko sir se pair tak dheere-dheere relax karein.",
        "Natural, slow saans par focus karein, kisi bhi tension ko chhodte jayein.",
        "Kuch minute is complete stillness aur relaxation mein rahein, phir dheere se aankhein kholein.",
      ],
      benefits: [
        "Poori body aur mind ko deep relaxation deta hai.",
        "Stress, anxiety aur fatigue kam karta hai.",
        "Har yoga session ko close karne ke liye ek zaroori, integrating pose hai.",
      ],
    },
    {
      id: "reclingSingleLegStretchBedtime",
      name: "Reclining Single-Leg Stretch (Bedtime Pose)",
      duration: "2–3 sets × 20–30 sec hold (per side)",
      gif: "/yoga/reclining-single-leg-stretch-bedtime.gif",
      steps: [
        "Peeth ke bal lait jayein, ek pair ko ghutne se mode kar foot flat zameen par rakhein.",
        "Dusre pair ko seedha upar uthayein, ghutna halka bent rakh sakte hain.",
        "Haath body ke bagal mein relaxed rakhein, shoulders ko zameen par settle hone dein.",
        "Steady, slow saans lete hue hold karein, phir side badal kar dusre pair se repeat karein.",
      ],
      benefits: [
        "Hamstrings aur lower back ko gently stretch karta hai.",
        "Nervous system ko calm kar so ne se pehle body ko relax karta hai.",
        "Bedtime yoga routine ke liye ek soothing, low-effort pose hai.",
      ],
    },
    {
      id: "pelvicTiltTabletopPose",
      name: "Pelvic Tilt Tabletop Pose",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/yoga/pelvic-tilt-tabletop-pose.gif",
      steps: [
        "Peeth ke bal lait jayein, dono ghutne 90° par mode kar tabletop position mein rakhein (shins zameen ke parallel).",
        "Haath body ke bagal mein flat rakhein support ke liye.",
        "Pelvic floor muscles ko gently engage karein, lower back ko zameen se halka pressed rakhein.",
        "Steady saans lete hue is position ko hold karein, hips ko rock na hone dein.",
      ],
      benefits: [
        "Pelvic floor aur lower abs ko gently activate karta hai.",
        "Lower back tension aur pelvic discomfort kam karne mein madad karta hai.",
        "Pelvic health routines ke liye ek low-impact, supportive pose hai.",
      ],
    },
    {
      id: "vasisthasanaSidePlank",
      name: "Vasisthasana (Side Plank Pose)",
      duration: "2–3 sets × 15–20 sec hold (per side)",
      gif: "/yoga/vasisthasana-side-plank.gif",
      steps: [
        "Ek side plank position mein aayein, ek haath zameen par seedha shoulder ke neeche rakhein.",
        "Dono pairon ko stack karein ya thoda stagger karein, body ko ek seedhi diagonal line mein rakhein.",
        "Dusre haath ko ceiling ki taraf seedha upar extend karein.",
        "Core aur obliques ko tight rakhte hue is position ko hold karein, phir side badal kar repeat karein.",
      ],
      benefits: [
        "Obliques, core aur shoulders ko intensely target karta hai — Adonis belt (V-line) define karne ke liye effective.",
        "Balance aur full-body stability improve karta hai.",
        "Wrists aur arms ki strength bhi badhata hai.",
      ],
    },
    {
      id: "supineKneeBendRelaxation",
      name: "Supine Knee Bend Relaxation Pose",
      duration: "2–3 sets × 30–60 sec hold",
      gif: "/yoga/supine-knee-bend-relaxation.gif",
      steps: [
        "Peeth ke bal lait jayein, dono ghutne mode kar pair flat zameen par hip-width apart rakhein.",
        "Dono haathon ko chest ke upar cross kar ke rakhein, ya jo bhi comfortable lage.",
        "Poori body ko relax hone dein, jaw aur shoulders ko loosen karein.",
        "Slow, deep saans lete hue is calming position mein rahein.",
      ],
      benefits: [
        "Lower back aur hips ki tension release karta hai.",
        "Nervous system ko calm karta hai.",
        "Kisi bhi workout ya yoga session ke beech quick reset ke liye achha hai.",
      ],
    },
    {
      id: "pavanmuktasanaWindRelieving",
      name: "Pavanmuktasana (Wind-Relieving Pose)",
      duration: "2–3 sets × 20–30 sec hold",
      gif: "/yoga/pavanmuktasana-wind-relieving.gif",
      steps: [
        "Peeth ke bal lait jayein, dono ghutne chest ki taraf mode karein.",
        "Dono haathon se shins ya ankles ko pakdein, ghutno ko gently chest ke kareeb khinchein.",
        "Sir ko relaxed rakhein ya halka upar uthayein, shoulders ko zameen par rakhein.",
        "Steady saans lete hue hold karein, poet mein halka pressure mehsoos karein.",
      ],
      benefits: [
        "Digestion improve karta hai aur gas/bloating relief deta hai.",
        "Lower back aur hips ko gently stretch karta hai.",
        "Pelvic aur abdominal area mein tension release karta hai.",
      ],
    },
    {
      id: "tuckedHeadstandPrep",
      name: "Tucked Headstand Prep (Sirsasana Variation)",
      duration: "2–3 sets × 10–15 sec hold",
      gif: "/yoga/tucked-headstand-prep.gif",
      steps: [
        "Forearms aur crown of head ko zameen par ek tripod base bana kar rakhein.",
        "Hips ko upar uthayein, ghutno ko chest ki taraf tucked rakhein (crow-pose jaisi tucked position).",
        "Core ko engage kar balance banaye rakhein, weight ko forearms aur head ke beech evenly distribute karein.",
        "Kuch second control ke saath hold karein — beginners wall ke paas practice karein.",
      ],
      benefits: [
        "Core, shoulders aur balance ko strongly train karta hai.",
        "Full Sirsasana (Headstand) ki taraf ek safe progression step hai.",
        "Focus aur body awareness improve karta hai.",
      ],
    },
    {
      id: "sirsasanaHeadstand",
      name: "Sirsasana (Headstand Pose)",
      duration: "2–3 sets × 15–30 sec hold",
      gif: "/yoga/sirsasana-headstand.gif",
      steps: [
        "Forearms zameen par tripod base bana kar rakhein, crown of head ko haathon ke beech zameen par rakhein.",
        "Ghutno ko chest ki taraf tuck karke hips ko upar uthayein, core engage karein.",
        "Dheere-dheere dono pairon ko seedha ceiling ki taraf extend karein, poori body ek seedhi line mein.",
        "Steady saans lete hue balance hold karein — beginners wall ka support lein aur experienced guidance ke bina lambe time tak practice na karein.",
      ],
      benefits: [
        "Blood circulation ko brain aur upper body ki taraf boost karta hai.",
        "Core, shoulders aur poori body ki strength aur balance improve karta hai.",
        "Focus aur mental clarity badhata hai — inversions ka ek advanced, powerful pose.",
      ],
    },
  ],
  pranayama: [],
};

/* Glass info popup — steps ("Kaise Karein") + benefits ("Fayde") for one move. */
function FitnessInfoModal({ item, sectionColor, onClose }) {
  if (!item) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 420, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(37,36,34,0.5)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", padding: 18,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: "spring", stiffness: 340, damping: 27 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, maxHeight: "84vh", overflowY: "auto", borderRadius: 20, padding: 20,
          background: "rgba(255,253,247,0.78)", backdropFilter: "blur(24px) saturate(200%)", WebkitBackdropFilter: "blur(24px) saturate(200%)",
          border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 26px 64px rgba(37,36,34,0.35), inset 0 1px 0 rgba(255,255,255,0.75)",
        }}
        className="btl-scroll"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: hexToRgba(sectionColor, 0.16), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={item.gif} alt={item.name} style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8 }} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: C.dark, lineHeight: 1.25 }}>{item.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 10.5, fontWeight: 800, color: sectionColor }}>
                <Timer size={11} /> {item.duration}
              </div>
            </div>
          </div>
          <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ border: "none", background: "rgba(64,61,57,0.08)", borderRadius: 999, padding: 6, cursor: "pointer", flexShrink: 0 }}>
            <X size={14} color={C.dark} />
          </motion.button>
        </div>

        <div style={{ fontSize: 10, fontWeight: 900, color: sectionColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          🏋️ Kaise Karein
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {(item.steps || []).map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", background: sectionColor, color: "#fff", fontSize: 9.5, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 900, color: sectionColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          💪 Fayde
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {(item.benefits || []).map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, marginTop: 6, width: 5, height: 5, borderRadius: "50%", background: sectionColor }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

const fitnessCardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.96 },
  show: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.05, type: "spring", stiffness: 280, damping: 24 } }),
};

function FitnessCard({ item, index, sectionColor, onInfo }) {
  return (
    <motion.div
      custom={index} variants={fitnessCardVariants} initial="hidden" animate="show"
      whileHover={{ y: -4, boxShadow: "0 18px 36px rgba(37,36,34,0.18)" }}
      style={{
        borderRadius: 16, overflow: "hidden", position: "relative", cursor: "default",
        ...glassCardStyle("#ffffff", hexToRgba(sectionColor, 0.35)),
      }}
    >
      <div style={{ position: "relative", background: hexToRgba(sectionColor, 0.08) }}>
        <img src={item.gif} alt={item.name} style={{ width: "100%", height: 150, objectFit: "contain", display: "block" }} />
        <motion.button
          whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.92 }}
          onClick={() => onInfo(item)}
          title="Info — kaise karein & fayde"
          style={{
            position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.8)",
            background: "rgba(255,255,255,0.75)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(37,36,34,0.2)",
          }}
        >
          <Info size={14} color={sectionColor} />
        </motion.button>
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.dark, marginBottom: 4, lineHeight: 1.25 }}>{item.name}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: sectionColor, background: hexToRgba(sectionColor, 0.12), borderRadius: 999, padding: "3px 8px" }}>
          <Timer size={10} /> {item.duration}
        </div>
      </div>
    </motion.div>
  );
}

function FitnessEmptySection({ sectionColor, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px", textAlign: "center", gap: 6 }}>
      <div style={{ fontSize: 30 }}>🧘</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>{label} jaldi aa rahe hain</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8579", maxWidth: 260 }}>GIFs add hote hi yahan {label.toLowerCase()} ke widgets dikhne lagenge.</div>
    </div>
  );
}

function FitnessTab({ onClose }) {
  const [section, setSection] = useState("exercise");
  const [infoItem, setInfoItem] = useState(null);
  // Swaps the "Exercise" section between the original list and the alt
  // (exerciseAlt) list — the header button next to the section pills.
  // Clicking it once shows the alt set; clicking again reverts to the
  // original set. Only meaningful on the "exercise" section.
  const [showAltExercise, setShowAltExercise] = useState(false);
  const active = FITNESS_SECTIONS.find((s) => s.id === section) || FITNESS_SECTIONS[0];
  const items =
    section === "exercise" && showAltExercise
      ? FITNESS_DATA.exerciseAlt || []
      : FITNESS_DATA[section] || [];

  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 10, background: "#fff", display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${C.text}`, borderRadius: "10px 10px 0 0", flexWrap: "wrap", rowGap: 8 }}>
        <motion.div whileHover={{ x: -2 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ArrowLeft size={15} color={C.dark} />
        </motion.div>
        <Dumbbell size={14} color={C.dark} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>Fitness</span>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 4, background: "rgba(64,61,57,0.06)", borderRadius: 999, padding: 4 }}>
          {FITNESS_SECTIONS.map((s) => {
            const isActive = s.id === section;
            const SIcon = s.icon;
            return (
              <motion.button
                key={s.id} onClick={() => setSection(s.id)}
                whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                style={{
                  position: "relative", border: "none", borderRadius: 999, padding: "6px 12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800,
                  color: isActive ? "#fff" : C.dark, background: "transparent", zIndex: 1,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="fitnessSectionPill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    style={{ position: "absolute", inset: 0, borderRadius: 999, background: s.color, zIndex: -1 }}
                  />
                )}
                <SIcon size={12} /> {s.label}
              </motion.button>
            );
          })}
        </div>

        {section === "exercise" && (
          <motion.button
            onClick={() => setShowAltExercise((v) => !v)}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            title={showAltExercise ? "Original exercises par wapas jayein" : "Alt exercises dikhayein"}
            style={{
              display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999,
              padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 800,
              color: showAltExercise ? "#fff" : active.color,
              background: showAltExercise ? active.color : hexToRgba(active.color, 0.14),
            }}
          >
            <RefreshCw size={12} /> {showAltExercise ? "Original" : "Alt"}
          </motion.button>
        )}

        <motion.div whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ cursor: "pointer", color: C.dark }}>
          <X size={16} />
        </motion.div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, background: `linear-gradient(180deg, ${hexToRgba(active.color, 0.05)} 0%, #fffcf2 220px)` }} className="btl-scroll">
        <AnimatePresence mode="wait">
          <motion.div
            key={section === "exercise" && showAltExercise ? "exerciseAlt" : section}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
          >
            {items.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, maxWidth: 980, margin: "0 auto" }}>
                {items.map((item, i) => (
                  <FitnessCard key={item.id} item={item} index={i} sectionColor={active.color} onInfo={setInfoItem} />
                ))}
              </div>
            ) : (
              <FitnessEmptySection sectionColor={active.color} label={active.label} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {infoItem && <FitnessInfoModal item={infoItem} sectionColor={active.color} onClose={() => setInfoItem(null)} />}
      </AnimatePresence>
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
  const [showShare, setShowShare] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false); // Friend Celebration panel
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved"
  const [activeAlarm, setActiveAlarm] = useState(null); // { id, time } | null — Clock & Alarm widget (this update)
  const incomingFriendReqCount = useIncomingFriendRequestCount(fbUser?.uid);
  const fileRef = useRef(null);
  const loaded = useRef(false);
  const dashboardRootRef = useRef(null); // outer panel — LiquidBackground listens here for ripple clicks

  useEffect(() => {
    if (!fbUser) return;
    loadState(fbUser).then((s) => { setState(rolloverDailyGoals(s)); loaded.current = true; });
    ensurePublicProfile(fbUser); // keep users_public/{uid} fresh so friends can find you by email
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

  // ---- Clock & Alarm (this update): watches state.clockAlarms every
  // second and fires AlarmRingModal the moment the live clock hits an
  // armed alarm's "HH:MM". Reads from a ref (kept in sync below) instead
  // of `state` directly so this one interval doesn't need to be torn
  // down/recreated on every keystroke elsewhere in the app. Alarms are
  // daily-recurring by design (an analog dial can't tell today from
  // tomorrow) — `firedRef` just guards against re-firing twice inside
  // the same minute, not against firing again the next day.
  const clockStateRef = useRef(state);
  useEffect(() => { clockStateRef.current = state; }, [state]);
  const alarmFiredRef = useRef({});
  useEffect(() => {
    const id = setInterval(() => {
      const s = clockStateRef.current;
      if (!s) return;
      const now = new Date();
      const key = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const match = (s.clockAlarms || []).find((a) => a.time === key && alarmFiredRef.current[a.id] !== key);
      if (match) {
        alarmFiredRef.current[match.id] = key;
        setActiveAlarm(match);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  // Starts the looping ringtone the moment an alarm fires, and stops it
  // either when "Done" is tapped (setActiveAlarm(null) below) or after
  // ALARM_MAX_RING_MS (~30s) — whichever comes first.
  useEffect(() => {
    if (!activeAlarm) return;
    const stopTone = startAlarmRingtone(clockStateRef.current?.clockRingtone || "classic");
    const t = setTimeout(() => setActiveAlarm(null), ALARM_MAX_RING_MS);
    return () => { stopTone(); clearTimeout(t); };
  }, [activeAlarm]);

  const update = useCallback((fn) => setState((s) => fn({ ...s })), []);
  // Shared "shine" trigger — the diagonal shine sweep used to fire on every
  // single item you completed (any widget), not just the big daily+extry
  // 100% milestone. Restored here as a small shared helper so every
  // completion path below (Daily/Extry/Big Goals, Life Rules, Time Table)
  // can call the exact same effect: a full-width shine sweeps across the
  // whole dashboard, so the words in every widget sitting near the one you
  // just filled catch that same glow/shine as it passes over them.
  const triggerShine = () => {
    setShine(true);
    setTimeout(() => setShine(false), 1600);
  };

  if (!state) {
    return <BTLLoadingScreen label="Loading BTL" bg={C.bg} dark={C.dark} accent={C.accent} />;
  }

  const dailyPct = state.dailyGoals.length ? (state.dailyGoals.filter((g) => g.done).length / state.dailyGoals.length) * 100 : 0;
  const extryPct = state.extryGoals.length ? (state.extryGoals.filter((g) => g.done).length / state.extryGoals.length) * 100 : 0;
  const overallPct = (dailyPct + extryPct) / 2;
  const headerLifeScore = computeLifeScore(state);

  const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100];
  function isMilestone(n) { return MILESTONES.includes(n) || (n > 100 && n % 50 === 0); }

  function checkFullCompletion(next) {
    const allDone = next.dailyGoals.length && next.dailyGoals.every((g) => g.done) &&
      next.extryGoals.length && next.extryGoals.every((g) => g.done);
    if (allDone && next.lastCompletedDate !== todayISO()) {
      next.lastCompletedDate = todayISO();
      next.streak = (next.streak || 0) + 1;
      triggerShine();
      if (isMilestone(next.streak)) {
        setConfetti(true);
        setMilestoneStreak(next.streak);
        setTimeout(() => { setConfetti(false); setMilestoneStreak(null); }, 2600);
      }
    }
    return next;
  }

  // Generic per-widget version of recordCompletionHistory/checkFullCompletion
  // above — same math (today's % done, +1 streak the first time a list hits
  // 100% in a day), just keyed by widget id instead of hardcoded to the
  // combined daily+extry pair. No milestone confetti here on purpose: that
  // banner stays reserved for the original combined streak so three widgets
  // don't each fire their own popup.
  function recordWidgetProgress(s, key, items) {
    if (!items || !items.length) return s;
    const done = items.filter((it) => it.done).length;
    const pct = (done / items.length) * 100;
    const day = todayISO();
    s.widgetHistory = { ...(s.widgetHistory || {}), [key]: { ...((s.widgetHistory || {})[key] || {}), [day]: pct } };
    const allDone = items.every((it) => it.done);
    const lastMap = s.widgetLastCompletedDate || {};
    if (allDone && lastMap[key] !== day) {
      s.widgetLastCompletedDate = { ...lastMap, [key]: day };
      const streaks = s.widgetStreaks || {};
      s.widgetStreaks = { ...streaks, [key]: (streaks[key] || 0) + 1 };
    }
    return s;
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
    const wasDone = !!s[listKey].find((g) => g.id === id)?.done;
    s[listKey] = s[listKey].map((g) => g.id === id ? { ...g, done: !g.done } : g);
    if (!wasDone) triggerShine(); // marking something done (not un-checking) gives the nearby widgets their shine
    recordCompletionHistory(s);
    recordWidgetProgress(s, listKey, s[listKey]);
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

  const toggleTimeItem = (id) => update((s) => {
    const wasDone = !!(s.timeTable || []).find((t) => t.id === id)?.done;
    s.timeTable = (s.timeTable || []).map((t) => t.id === id ? { ...t, done: !t.done } : t);
    if (!wasDone) triggerShine();
    recordWidgetProgress(s, "timeTable", s.timeTable);
    return s;
  });
  const addTimeItem = (time, text, category, recurring = true) => update((s) => {
    s.timeTable = [...(s.timeTable || []), ensureTimeItemDefaults({ id: `${Date.now()}-${Math.random()}`, time, text, category, recurring, done: false })];
    return s;
  });
  const removeTimeItem = (id) => update((s) => {
    s.timeTable = (s.timeTable || []).filter((t) => t.id !== id);
    return s;
  });
  // Drag-to-reschedule (this update): TimeTable's Reorder.Group computes the
  // new "HH:MM" from where a row was dropped and calls this with just the
  // result — same shape as every other single-field patch below.
  const rescheduleTimeItem = (id, time) => update((s) => {
    s.timeTable = (s.timeTable || []).map((t) => t.id === id ? { ...t, time } : t);
    return s;
  });
  // Recurring toggle (this update): flips whether a slot resets each day in
  // rolloverDailyGoals below, or stays as a one-off event.
  const toggleTimeRecurring = (id) => update((s) => {
    s.timeTable = (s.timeTable || []).map((t) => t.id === id ? { ...t, recurring: !t.recurring } : t);
    return s;
  });

  // Clock & Alarm (this update) — set via double-click on the dial,
  // removed via the ✕ on its chip under the widget, ringtone changed
  // from Setting → Alarm. Same `update()` pattern as everything else.
  /* ---- Focus Timer (this update) ----
     `update()` runs synchronously against the freshest state, so
     stop-then-start (when switching categories) is done as one atomic
     write rather than two separate updates that could race. */
  const bankFocusSeconds = (s) => {
    // Mutates s.focusTimer in place to bank whatever's currently running
    // into today's history, then clears `active`. No-op if nothing running.
    const ft = normalizeFocusTimer(s.focusTimer);
    if (ft.active) {
      const elapsed = Math.max(0, Math.floor((Date.now() - ft.active.startTs) / 1000));
      const day = todayISO();
      const dayHist = { ...(ft.history[day] || {}) };
      dayHist[ft.active.categoryId] = (dayHist[ft.active.categoryId] || 0) + elapsed;
      ft.history = { ...ft.history, [day]: dayHist };
      ft.active = null;
    }
    s.focusTimer = ft;
    return ft;
  };
  const toggleFocusTimer = (categoryId) => update((s) => {
    const ft = bankFocusSeconds(s); // stop+bank whatever was running (including this one, if it was running)
    const wasRunningThis = state.focusTimer.active?.categoryId === categoryId;
    if (!wasRunningThis) ft.active = { categoryId, startTs: Date.now() };
    s.focusTimer = ft;
    return s;
  });
  const addFocusCategory = (label, color) => update((s) => {
    const ft = normalizeFocusTimer(s.focusTimer);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    ft.categories = [...ft.categories, { id, label, color }];
    s.focusTimer = ft;
    return s;
  });
  const removeFocusCategory = (categoryId) => update((s) => {
    const ft = state.focusTimer.active?.categoryId === categoryId ? bankFocusSeconds(s) : normalizeFocusTimer(s.focusTimer);
    ft.categories = ft.categories.filter((c) => c.id !== categoryId);
    s.focusTimer = ft;
    return s;
  });
  const setClockAlarm = (time) => update((s) => {
    if ((s.clockAlarms || []).some((a) => a.time === time)) return s; // already armed
    s.clockAlarms = [...(s.clockAlarms || []), { id: `${Date.now()}-${Math.random()}`, time }];
    return s;
  });
  const removeClockAlarm = (id) => update((s) => {
    s.clockAlarms = (s.clockAlarms || []).filter((a) => a.id !== id);
    return s;
  });
  const setClockRingtone = (ringtoneId) => update((s) => {
    s.clockRingtone = ALARM_RINGTONES.some((r) => r.id === ringtoneId) ? ringtoneId : "classic";
    return s;
  });

  // Liquid Background — Setting → Background (this update)
  const setLiquidBgColor = (index, hex) => update((s) => {
    const colors = [...(s.liquidBg?.colors || LIQUID_BG_DEFAULT_COLORS)];
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) colors[index] = hex;
    s.liquidBg = { ...(s.liquidBg || {}), colors, speed: s.liquidBg?.speed ?? 1, enabled: s.liquidBg?.enabled ?? true };
    return s;
  });
  const resetLiquidBgColors = () => update((s) => {
    s.liquidBg = { ...(s.liquidBg || {}), colors: [...LIQUID_BG_DEFAULT_COLORS], speed: s.liquidBg?.speed ?? 1, enabled: s.liquidBg?.enabled ?? true };
    return s;
  });
  const setLiquidBgSpeed = (speed) => update((s) => {
    const clamped = Math.min(3, Math.max(0.4, Number(speed) || 1));
    s.liquidBg = { colors: s.liquidBg?.colors || [...LIQUID_BG_DEFAULT_COLORS], speed: clamped, enabled: s.liquidBg?.enabled ?? true };
    return s;
  });
  const resetLiquidBgSpeed = () => update((s) => {
    s.liquidBg = { colors: s.liquidBg?.colors || [...LIQUID_BG_DEFAULT_COLORS], speed: 1, enabled: s.liquidBg?.enabled ?? true };
    return s;
  });
  // On/off switch (this update) — flips whether LiquidBackground renders at
  // all. Colors/speed are left untouched so switching back on picks up
  // right where the user left their palette/speed dial.
  const setLiquidBgEnabled = (enabled) => update((s) => {
    s.liquidBg = {
      colors: s.liquidBg?.colors || [...LIQUID_BG_DEFAULT_COLORS],
      speed: s.liquidBg?.speed ?? 1,
      enabled: !!enabled,
    };
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
  const setAnalyticsSummaryColor = (key, hex) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.analyticsSummaryColors = { ...theme.analyticsSummaryColors, [key]: hex };
    s.theme = theme;
    return s;
  });
  const resetAnalyticsSummaryColors = () => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.analyticsSummaryColors = normalizeAnalyticsSummaryColors({});
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
  /* One-click Panel Theme preset — applies bg+text to every scope and
     every widget's background in a single Firestore write. */
  const applyPanelPreset = (presetId) => update((s) => {
    const preset = PANEL_THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return s;
    const theme = normalizeTheme(s.theme);
    ["dashboard", "analytics", "money", "focusMode", "friendCelebration"].forEach((scope) => {
      theme[scope] = normalizeScopeTheme({ ...theme[scope], bg: preset.bg, text: preset.text });
    });
    const widgets = {};
    WIDGETS.forEach((w) => { widgets[w.id] = { bg: preset.widgetBg }; });
    theme.widgets = normalizeWidgetThemes(widgets);
    theme.panelPreset = preset.id;
    s.theme = theme;
    return s;
  });
  const resetPanelPreset = () => update((s) => {
    const theme = normalizeTheme(s.theme);
    ["dashboard", "analytics", "money", "focusMode", "friendCelebration"].forEach((scope) => {
      theme[scope] = normalizeScopeTheme({});
    });
    theme.widgets = normalizeWidgetThemes({});
    theme.panelPreset = "";
    s.theme = theme;
    return s;
  });
  /* Liquid Glass fine-tuning — blur px / frost opacity / neumorphic soft
     shadow toggle. Only shown in the UI while panelPreset === "liquidGlass",
     but harmless to keep set otherwise since ACTIVE_GLASS_OPTS below only
     applies it while that preset is active. */
  const setLiquidGlassOptions = (patch) => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.liquidGlassOptions = normalizeLiquidGlassOptions({ ...theme.liquidGlassOptions, ...patch });
    s.theme = theme;
    return s;
  });
  const resetLiquidGlassOptions = () => update((s) => {
    const theme = normalizeTheme(s.theme);
    theme.liquidGlassOptions = normalizeLiquidGlassOptions({});
    s.theme = theme;
    return s;
  });

  const theme = normalizeTheme(state.theme);
  /* Feeds glassCardStyle() (module scope, defined far above) the current
     Liquid Glass tuning for this render pass only — see the comment on
     ACTIVE_GLASS_OPTS. Every other preset renders with this null, so
     glassCardStyle() falls back to its original hardcoded numbers. */
  ACTIVE_GLASS_OPTS = theme.panelPreset === "liquidGlass" ? theme.liquidGlassOptions : null;
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
    dailyGoals: <GoalChecklist title="Daily Goals" items={state.dailyGoals} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} textStyle={state.layout.textStyles?.dailyGoals} cardBg={theme.widgets.dailyGoals?.bg} streak={state.widgetStreaks?.dailyGoals || 0} history={state.widgetHistory?.dailyGoals || {}} />,
    extryGoals: <GoalChecklist title="Extry Goals" items={state.extryGoals} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} textStyle={state.layout.textStyles?.extryGoals} cardBg={theme.widgets.extryGoals?.bg} streak={state.widgetStreaks?.extryGoals || 0} history={state.widgetHistory?.extryGoals || {}} />,
    timeTable: <TimeTable items={state.timeTable || []} onToggle={toggleTimeItem} onAdd={addTimeItem} onRemove={removeTimeItem} onReschedule={rescheduleTimeItem} onToggleRecurring={toggleTimeRecurring} accent={C.accent} textStyle={state.layout.textStyles?.timeTable} cardBg={theme.widgets.timeTable?.bg} streak={state.widgetStreaks?.timeTable || 0} history={state.widgetHistory?.timeTable || {}} />,
    earnMoney: <EarnMoneyNotesCard state={state} update={update} onOpenEarn={() => openMoneyModal("earn")} onOpenSpend={() => openMoneyModal("spend")} onImageFile={onImageFile} onImageDrop={processImageFile} fileRef={fileRef} todayMood={state.moodLog?.[todayISO()]} onSetMood={(m) => setMood(todayISO(), m)} textStyle={state.layout.textStyles?.earnMoney} cardBg={theme.widgets.earnMoney?.bg} />,
    analyticsSummary: <AnalyticsSummaryWidget state={state} onOpen={() => setTab("analytics")} cardBg={theme.widgets.analyticsSummary?.bg} metrics={theme.analyticsSummary.metrics} colors={theme.analyticsSummaryColors} />,
    calendar: <CalendarWidget completionHistory={state.completionHistory} cardBg={theme.widgets.calendar?.bg} textStyle={state.layout.textStyles?.calendar} />,
    clock: <AnalogClockWidget alarms={state.clockAlarms || []} ringtoneId={state.clockRingtone} onSetAlarm={setClockAlarm} onRemoveAlarm={removeClockAlarm} accent={C.accent} cardBg={theme.widgets.clock?.bg} />,
    focusTimer: <FocusTimerWidget focusTimer={normalizeFocusTimer(state.focusTimer)} onToggle={toggleFocusTimer} onAddCategory={addFocusCategory} onRemoveCategory={removeFocusCategory} accent={C.accent} cardBg={theme.widgets.focusTimer?.bg} />,
  };

  return (
    <DashboardThemeCtx.Provider value={dashTheme}>
    <div ref={dashboardRootRef} style={{
      fontFamily: "Inter, system-ui, sans-serif", background: dashTheme.bg, color: dashTheme.text,
      height: "100%", maxHeight: "100%", borderRadius: 14, padding: 14, position: "relative", overflow: "hidden",
      border: `1px solid #ece7d8`, fontSize: 11, boxSizing: "border-box",
      display: "flex", flexDirection: "column",
      zIndex: 0, isolation: "isolate", // <-- establishes this panel's own stacking context so the
      // z-index:-1 LiquidBackground layer below stays confined *inside* this
      // div (behind its content, above its own background) instead of
      // escaping to some ancestor's stacking context and rendering out of
      // sight — without this, no amount of opacity/color tuning on the
      // liquid layer would ever become visible.
      zoom: "80%", // <-- shrinks the WHOLE dashboard (text, buttons, spacing, icons). Change to "70%" for smaller, "90%" for bigger.
    }}>
      {/* ---- Liquid Background (this update) ---- replaces the old 3
          static blob circles with a full animated liquid system: a
          slow-shifting liquid gradient mesh, 4 goo-merged morphing
          blobs, parallax wave bands along the bottom, a canvas particle
          -fluid layer that drifts and loosely follows the cursor, and
          an expanding ripple ring on every click/tap anywhere on the
          dashboard. Still purely decorative — z-index -1, pointer-
          events: none, clipped by this panel's own overflow:hidden —
          and still exactly what the glass cards' blur needs behind
          them to read as frosted glass rather than flat color. Backs
          off automatically on prefers-reduced-motion and on touch
          devices (see components/LiquidBackground.jsx). */}
      {/* On/off switch (this update, Setting → Background) — when off,
          LiquidBackground isn't mounted at all, so no CSS animation, no
          canvas rAF loop, nothing running in the background at all, not
          just hidden with opacity. */}
      {state.liquidBg?.enabled !== false && (
        <LiquidBackground
          containerRef={dashboardRootRef}
          dark={hexLuminance(dashTheme.bg) < 0.5}
          colors={state.liquidBg?.colors}
          speed={state.liquidBg?.speed}
        />
      )}
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
        /* ---- widget-card cursor spotlight — a soft glow that follows the
           mouse across each dashboard card (Life Goals, Calendar, Daily/
           Extry Goals, etc), on top of the lift + shadow from whileHover. */
        .btl-widget-card { position: relative; }
        .btl-widget-card::before {
          content: ""; position: absolute; inset: 0; border-radius: 8px; z-index: 6; pointer-events: none;
          background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), rgba(252,163,17,0.16), transparent 68%);
          opacity: 0; transition: opacity 260ms ease;
        }
        .btl-widget-card:hover::before { opacity: 1; }
        /* ---- goal / list row hover — used by Life Big Goals, Life Rules,
           Daily Goals and Extry Goals rows for a subtle "alive" nudge. */
        .btl-goal-row { transition: background 160ms ease, transform 160ms ease, box-shadow 160ms ease; }
        .btl-goal-row:hover { background: rgba(252,163,17,0.09); transform: translateX(3px); }
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
          <AnalyticsTab state={state} user={fbUser} onClose={() => setTab("dashboard")} onOpenMoneyManagement={() => setTab("money")} />
        </div>
      ) : tab === "money" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <MoneyManagementTab state={state} onClose={() => setTab("analytics")} onResetData={resetMoneyData} />
        </div>
      ) : tab === "lifeStory" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LifeStoryTab state={state} update={update} onClose={() => setTab("dashboard")} />
        </div>
      ) : tab === "fitness" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <FitnessTab onClose={() => setTab("dashboard")} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* ---------- HEADER ---------- */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8, flexShrink: 0 }}>
            <motion.div
              animate={{ scale: [1, 1.025, 1] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "relative", display: "inline-flex" }}
            >
              <motion.span
                aria-hidden
                animate={{ boxShadow: [`0 0 0px 0px ${C.dark}00`, `0 0 16px 3px ${C.dark}50`, `0 0 0px 0px ${C.dark}00`] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ position: "absolute", inset: -3, borderRadius: 999, pointerEvents: "none" }}
              />
              <Oval style={{ background: C.dark, color: C.bg, borderColor: C.dark, fontSize: 16, fontWeight: 900, position: "relative" }}>Byound The Life</Oval>
            </motion.div>
            <Oval title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>Goals</Oval>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Oval title="Coming soon" style={{ cursor: "not-allowed", justifyContent: "flex-start", background: hexToRgba("#4a7c59", 0.16), borderColor: "#4a7c59", color: "#4a7c59" }}>
                Total Earn Money life :-&nbsp;
                <span style={{ fontWeight: 900, color: "#4a7c59", background: "#4a7c5930", padding: "2px 9px", borderRadius: 999, marginLeft: 4 }}>
                  ₹{state.totalEarnLife.toFixed(0)}
                </span>
              </Oval>
              <Oval title="Coming soon" style={{ cursor: "not-allowed", justifyContent: "flex-start", background: hexToRgba("#8b0000", 0.16), borderColor: "#8b0000", color: "#8b0000" }}>
                Total Spend Money life :-&nbsp;
                <span style={{ fontWeight: 900, color: "#8b0000", background: "#8b000030", padding: "2px 9px", borderRadius: 999, marginLeft: 4 }}>
                  ₹{(state.totalSpendLife || 0).toFixed(0)}
                </span>
              </Oval>
            </div>
            <Oval className="btl-oval-btn" onClick={() => setMemOpen(true)} style={{ cursor: "pointer", background: C.blue, borderColor: C.blue, color: C.dark }}><BookOpen size={11} style={{ marginRight: 4 }} />memor</Oval>
            <Oval className="btl-oval-btn" onClick={() => setTab("lifeStory")} style={{ cursor: "pointer", background: "#b083f0", borderColor: "#b083f0", color: "#fff" }}><Pencil size={11} style={{ marginRight: 4 }} />life story</Oval>
            <Oval className="btl-oval-btn" onClick={() => setTab("fitness")} style={{ cursor: "pointer", background: "#e85d4c", borderColor: "#e85d4c", color: "#fff" }}><Dumbbell size={11} style={{ marginRight: 4 }} />fitness</Oval>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GlowIconButton icon={Target} label="Focus Mode" active={focusMode} color={C.accent} onClick={() => setFocusMode((v) => !v)} />
              <GlowIconButton icon={Sparkles} label="Share Journey" color="#b083f0" onClick={() => setShowShare(true)} />
              <GlowIconButton icon={Settings} label="Setting" color={dashTheme.text} onClick={() => setSettingsOpen(true)} />
              <div style={{ position: "relative" }}>
                <GlowIconButton icon={Users} label="Friend Celebration" color="#e63946" onClick={() => setFriendOpen(true)} />
                {incomingFriendReqCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    style={{
                      position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 999,
                      background: "#e63946", color: "#fff", fontSize: 9, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                      border: "1.5px solid #fff", pointerEvents: "none",
                    }}
                  >{incomingFriendReqCount}</motion.span>
                )}
              </div>
            </div>


            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SaveStatus status={saveStatus} />
              <DayStreakBadge streak={state.streak} accent={C.accent} dark={theme.analyticsSummaryColors.streak || C.dark} />
              <RingStat pct={dailyPct} label="Daily Goal" sub="Staytus" color={theme.analyticsSummaryColors.daily || C.accent} textColor={theme.analyticsSummaryColors.text || undefined} />
              <RingStat pct={extryPct} label="Extry Goal" sub="Staytus" color={theme.analyticsSummaryColors.extry || C.blue} textColor={theme.analyticsSummaryColors.text || undefined} />
              <RingStat pct={overallPct} label="Goal" color={theme.analyticsSummaryColors.overall || dashTheme.text || C.dark} textColor={theme.analyticsSummaryColors.text || undefined} />
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
              color: fm.text || undefined,
              fontFamily: fmFontFamily, fontWeight: fm.bold ? 600 : undefined,
              zoom: fm.scale !== 1 ? fm.scale : undefined,
              borderRadius: fm.bg ? 10 : 0, padding: fm.bg ? 10 : 0, boxSizing: "border-box",
              ...(fm.bg ? glassCardStyle(fm.bg, fm.border) : null),
            }}>
              {/* ---------- FOCUS MODE ---------- */}
              <Oval style={{ display: "block", width: "fit-content", margin: "0 auto 8px", background: C.accent, color: "#fff", borderColor: C.accent, fontSize: 12, flexShrink: 0 }}>
                FOCUS MODE — TODAY'S REMAINING GOALS
              </Oval>
              <FocusModeNowBanner items={state.timeTable} accent={C.accent} fm={fm} />
              <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 220, display: "flex" }}>
                  <GoalChecklist title="Daily Goals" items={state.dailyGoals.filter((g) => !g.done)} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} cardBg={theme.widgets.dailyGoals?.bg} />
                </div>
                <div style={{ flex: "1 1 240px", minWidth: 220, display: "flex" }}>
                  <GoalChecklist title="Extry Goals" items={state.extryGoals.filter((g) => !g.done)} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} cardBg={theme.widgets.extryGoals?.bg} />
                </div>
                <div style={{ flex: "1 1 240px", minWidth: 220, display: "flex" }}>
                  <TimeTable items={(state.timeTable || []).filter((t) => !t.done)} onToggle={toggleTimeItem} onAdd={addTimeItem} onRemove={removeTimeItem} onReschedule={rescheduleTimeItem} onToggleRecurring={toggleTimeRecurring} accent={C.accent} cardBg={theme.widgets.timeTable?.bg} streak={state.widgetStreaks?.timeTable || 0} history={state.widgetHistory?.timeTable || {}} />
                </div>
              </div>
              {state.dailyGoals.filter((g) => !g.done).length === 0 && state.extryGoals.filter((g) => !g.done).length === 0 && (state.timeTable || []).filter((t) => !t.done).length === 0 && (
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
              position: "absolute", inset: 0, zIndex: 65,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
            <SettingsTab
              state={state} addItem={settingsAdd} removeItem={settingsRemove} editItem={settingsEdit} onClose={() => setSettingsOpen(false)}
              onThemeScopeChange={setThemeScope} onThemeScopeReset={resetThemeScope}
              onWidgetThemeChange={setWidgetTheme} onWidgetThemeReset={resetWidgetTheme}
              onWidgetSizePreset={setWidgetSizePreset}
              onAnalyticsSummaryChange={setAnalyticsSummaryMetrics} onAnalyticsSummaryReset={resetAnalyticsSummaryMetrics}
              onAnalyticsSummaryColorChange={setAnalyticsSummaryColor} onAnalyticsSummaryColorReset={resetAnalyticsSummaryColors}
              onAnalyticsColorChange={setAnalyticsColor} onAnalyticsColorReset={resetAnalyticsColors}
              onMoneyColorChange={setMoneyColor} onMoneyColorReset={resetMoneyColors}
              onApplyPanelPreset={applyPanelPreset} onResetPanelPreset={resetPanelPreset}
              onLiquidGlassOptionsChange={setLiquidGlassOptions} onLiquidGlassOptionsReset={resetLiquidGlassOptions}
              onSetClockRingtone={setClockRingtone}
              onLiquidBgColorChange={setLiquidBgColor}
              onLiquidBgColorsReset={resetLiquidBgColors}
              onLiquidBgSpeedChange={setLiquidBgSpeed}
              onLiquidBgSpeedReset={resetLiquidBgSpeed}
              onLiquidBgEnabledChange={setLiquidBgEnabled}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- MEMORIES MODAL (Glassmorphism 2.0 / Liquid Glass — full journal, tabbed) ---------- */}
      <AnimatePresence>
        {memOpen && <MemoriesModal state={state} onAddMemory={addMemory} onClose={() => setMemOpen(false)} />}
      </AnimatePresence>

      {/* ---------- FRIEND CELEBRATION (icon in header) — invite/accept flow, VS
           split-screen dashboard, glass chat, and friend's Memories reused above ---------- */}
      <AnimatePresence>
        {friendOpen && (
          <FriendCelebration
            user={fbUser}
            myState={state}
            myStats={{ dailyPct, extryPct, overallPct, streak: state.streak, lifeScore: headerLifeScore }}
            onClose={() => setFriendOpen(false)}
            theme={theme.friendCelebration}
          />
        )}
      </AnimatePresence>

      {/* ---------- SHARE JOURNEY MODAL (header icon — same modal Analytics uses) ---------- */}
      <AnimatePresence>
        {showShare && (
          <ShareJourneyModal
            state={state} lifeScore={headerLifeScore}
            userName={fbUser?.displayName || state.lifeStory?.profile?.name || ""}
            userPhoto={fbUser?.photoURL || ""}
            onClose={() => setShowShare(false)}
          />
        )}
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

      {/* ---------- ALARM RING POPUP (Clock & Alarm widget — this update) ---------- */}
      <AnimatePresence>
        {activeAlarm && (
          <AlarmRingModal alarm={activeAlarm} ringtoneId={state.clockRingtone} onDismiss={() => setActiveAlarm(null)} />
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
