"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Settings, X, Plus, Smile, Meh, Frown, Image as ImageIcon,
  LogOut, Trash2, ChevronRight, ChevronDown, ChevronUp, Flame, Target, BookOpen,
  Repeat, RotateCcw, BarChart3, TrendingUp, Award, Tag, Pencil,
  GripVertical, Pin, PinOff, LayoutGrid, RefreshCw, Maximize2, Move
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Bar, Area, Legend } from "recharts";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useAuth, signOutUser } from "@/lib/AuthContext";
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
  { id: "mood", label: "Date & Mood" },
  { id: "analyticsSummary", label: "Analytics Summary" },
];
const GRID_COLS = 6;          // grid columns widget widths snap to
const MIN_WIDGET_H = 120;     // px — minimum free-form height
const MAX_WIDGET_H = 500;     // px — maximum free-form height
/* Legacy "sm" | "md" | "lg" strings from before free-form resize —
   kept only so ensureLayoutDefaults can migrate old saved layouts. */
const LEGACY_SIZE_SPAN = { sm: 2, md: 3, lg: 6 };
const LEGACY_SIZE_HEIGHT = { sm: 150, md: 215, lg: 260 };

const DEFAULT_LAYOUT = {
  order: WIDGETS.map((w) => w.id),
  sizes: {
    bigGoals: { w: 3, h: 172 }, lifeRules: { w: 3, h: 172 }, dailyGoals: { w: 3, h: 215 }, extryGoals: { w: 3, h: 215 },
    earnMoney: { w: 3, h: 240 }, mood: { w: 3, h: 240 }, analyticsSummary: { w: 6, h: 260 },
  },
  pinned: { analyticsSummary: false },
};
function defaultLayout() {
  return {
    order: DEFAULT_LAYOUT.order.slice(),
    sizes: Object.fromEntries(Object.entries(DEFAULT_LAYOUT.sizes).map(([k, v]) => [k, { ...v }])),
    pinned: { ...DEFAULT_LAYOUT.pinned },
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
  const order = Array.isArray(layout.order) && layout.order.length ? layout.order.slice() : DEFAULT_LAYOUT.order.slice();
  WIDGETS.forEach((w) => { if (!order.includes(w.id)) order.push(w.id); });
  const rawSizes = { ...DEFAULT_LAYOUT.sizes, ...(layout.sizes || {}) };
  const sizes = {};
  WIDGETS.forEach((w) => { sizes[w.id] = normalizeSize(rawSizes[w.id]); });
  const pinned = { ...DEFAULT_LAYOUT.pinned, ...(layout.pinned || {}) };
  return { ...s, layout: { order, sizes, pinned } };
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
    memories: [],
    moodLog: {},        // { "2026-08-30": "happy" | "neutral" | "sad" }
    completionHistory: {}, // { "2026-08-30": 62.5 }  -- % of daily+extry goals done that day
    streak: 0,
    lastCompletedDate: null,
    layout: defaultLayout(),
  };
}

/* ---------------- STORAGE HELPERS ----------------
   Previously window.storage (artifact-sandbox-only, private per Claude
   account). Now backed by Firebase Firestore + security rules — see
   lib/btlStorage.js and firestore.rules. These are thin wrappers that
   take the signed-in Firebase user, so the rest of this file barely
   had to change. */
async function loadState(user) {
  const s = await loadStateFromFirestore(user, makeDefaultState, ensureGoalDefaults);
  return ensureLayoutDefaults(s);
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
  return (
    <motion.div
      {...rest}
      onClick={onClick}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 1.07 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${C.text}`, borderRadius: 999, padding: "4px 14px",
        fontSize: 14, fontWeight: 800, background: C.bg, color: C.text,
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
function TextList({ title, items }) {
  return (
    <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column" }}>
      <Oval style={{ display: "block", margin: "0 auto 8px", background: C.dark, color: C.bg, borderColor: C.dark, fontSize: 15, fontWeight: 900 }}>{title}</Oval>
      <div style={{
        border: `1px solid ${C.text}`, borderRadius: 8, flex: 1, overflowY: "auto", background: "#fff",
      }} className="btl-scroll">
        {items.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, color: "#b3ac99", textAlign: "center" }}>
            Nothing yet — add one from Setting.
          </div>
        )}
        {items.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center",
            padding: "8px 10px", borderBottom: i < items.length - 1 ? "1px solid #f0ece0" : "none", fontSize: 13, fontWeight: 700,
          }}>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- DAILY / EXTRY GOAL CHECKLIST (pro: categories, priority, recurring, subtasks) ---------------- */
function GoalChecklist({ title, items, onToggle, onAdd, onRemove, onToggleSubtask, onAddSubtask, onSetIcon, accent }) {
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
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.text}`, borderRadius: 8, background: "#fff" }} className="btl-scroll">
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
                <span style={{ flex: 1, fontSize: 11, cursor: "pointer" }} onClick={() => onToggle(g.id)}>{g.text}</span>
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
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, padding: "2px 0", cursor: "pointer", textDecoration: s.done ? "line-through" : "none", color: s.done ? "#b3ac99" : C.text }}>
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

/* ---------------- DATE / MOOD COLUMN ---------------- */
function DateMoodColumn({ moodLog, onSetMood }) {
  const days = [];
  for (let i = -6; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  const today = todayISO();
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <Oval style={{ display: "block", margin: "0 auto 6px", background: C.dark, color: C.bg, borderColor: C.dark, flexShrink: 0 }}>DATE</Oval>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", border: `1px solid ${C.text}`, borderRadius: 8, background: "#fff" }} className="btl-scroll">
        {days.map((d) => {
          const mood = moodLog[d];
          const isToday = d === today;
          return (
            <div key={d} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 6px", borderBottom: "1px solid #f0ece0",
              background: isToday ? "#fff3df" : "transparent",
            }}>
              <span style={{ fontSize: 9, fontWeight: isToday ? 800 : 500, color: C.dark }}>
                {new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
              </span>
              <div style={{ display: "flex", gap: 3 }}>
                <MoodBtn active={mood === "happy"} onClick={() => onSetMood(d, "happy")} title="Happy"><Smile size={13} /></MoodBtn>
                <MoodBtn active={mood === "neutral"} onClick={() => onSetMood(d, "neutral")} title="Neutral"><Meh size={13} /></MoodBtn>
                <MoodBtn active={mood === "sad"} onClick={() => onSetMood(d, "sad")} title="Sad"><Frown size={13} /></MoodBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
function SettingsTab({ state, addItem, removeItem, editItem, onClose }) {
  const [mode, setMode] = useState(null); // "goal" | "extry" | "bigGoals" | "lifeRules" | null
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
        <div style={{ flex: 1 }} />
        <motion.span whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onClose} title="Close" style={{
          borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
        }}><X size={13} color={C.dark} /></motion.span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }} className="btl-scroll">
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

function Heatmap({ completionHistory }) {
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
    if (pct === undefined) return "#efece1";
    if (pct === 0) return "#efece1";
    if (pct < 40) return "#fde3b0";
    if (pct < 75) return "#fdbf5e";
    return C.accent;
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
        {["#efece1", "#fde3b0", "#fdbf5e", C.accent].map((c) => (
          <div key={c} style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
        ))}
        More
      </div>
    </div>
  );
}

function moodToNum(m) { return m === "happy" ? 1 : m === "neutral" ? 0.5 : m === "sad" ? 0 : null; }

function AnalyticsTab({ state, onClose }) {
  const [showShare, setShowShare] = useState(false);
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

  const moneyData = useMemo(() => {
    const hist = state.moneyHistory || {};
    const arr = [];
    let running = 0;
    for (let i = 13; i >= 0; i--) {
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
  }, [state.moneyHistory]);

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
    return { score, label, emoji, color };
  }, [state.completionHistory, state.moodLog, state.streak]);

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
      border: `1px solid ${C.text}`, borderRadius: 10, background: "#fff",
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        borderBottom: `1px solid ${C.text}`, background: C.bg, borderRadius: "10px 10px 0 0",
      }}>
        <BarChart3 size={14} color={C.dark} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.dark }}>Analytics & Insights</span>
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
            <div style={{ fontSize: 13, fontWeight: 900, color: C.dark }}>{lifeScore.emoji} {lifeScore.label}</div>
            <div style={{ fontSize: 9, color: "#a39c86", marginTop: 2 }}>Life Score — last 7 days completion, streak & mood combined</div>
          </div>
        </div>

        {/* insights row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <TrendingUp size={14} color={C.accent} />
            <div style={{ fontSize: 16, fontWeight: 900, color: C.dark }}>{insights ? `${Math.round(insights.avg)}%` : "—"}</div>
            <div style={{ fontSize: 9, color: "#b3ac99" }}>Average completion</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <Award size={14} color="#4a7c59" />
            <div style={{ fontSize: 12, fontWeight: 900, color: C.dark }}>{insights ? `${Math.round(insights.best[1])}%` : "—"}</div>
            <div style={{ fontSize: 9, color: "#b3ac99" }}>Best day{insights ? ` · ${insights.best[0]}` : ""}</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, border: "1px solid #ece7d8", borderRadius: 8, padding: 10, textAlign: "center" }}>
            <Flame size={14} color="#e07a5f" />
            <div style={{ fontSize: 12, fontWeight: 900, color: C.dark }}>{insights ? `${Math.round(insights.worst[1])}%` : "—"}</div>
            <div style={{ fontSize: 9, color: "#b3ac99" }}>Toughest day{insights ? ` · ${insights.worst[0]}` : ""}</div>
          </div>
        </div>

        {/* Smart insight cards */}
        {smartInsights.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.dark, marginBottom: 6 }}>🧠 Smart Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {smartInsights.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                  borderRadius: 8, background: `${c.color}12`, border: `1px solid ${c.color}33`,
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{c.icon}</span>
                  <span style={{ fontSize: 10.5, color: C.text, lineHeight: 1.4 }}>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, color: C.dark, marginBottom: 6 }}>Daily goal completion — last 13 weeks</div>
        <Heatmap completionHistory={state.completionHistory || {}} />

        <div style={{ fontSize: 11, fontWeight: 800, color: C.dark, margin: "18px 0 6px" }}>Mood trend — last 30 days</div>
        <div style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={moodData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#f0ece0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#b3ac99" }} interval={4} />
              <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} tickFormatter={(v) => v === 1 ? "🙂" : v === 0.5 ? "😐" : "🙁"} tick={{ fontSize: 10 }} width={24} />
              <Tooltip formatter={(v) => v === 1 ? "Happy" : v === 0.5 ? "Neutral" : v === 0 ? "Sad" : "No entry"} labelStyle={{ fontSize: 10 }} contentStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="mood" stroke={C.blue} strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ---------- Money analytics: pro-level earn vs spend graph ---------- */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.dark }}>💰 Money — earn vs spend (last 14 days)</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{
            flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px",
            background: "linear-gradient(135deg, #4a7c5918, transparent)", border: "1px solid #4a7c5940",
          }}>
            <div style={{ fontSize: 9, color: "#6b8f77", fontWeight: 700 }}>Total Earned</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#4a7c59" }}>₹{moneySummary.earn.toFixed(0)}</div>
          </div>
          <div style={{
            flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px",
            background: "linear-gradient(135deg, #c0392b18, transparent)", border: "1px solid #c0392b40",
          }}>
            <div style={{ fontSize: 9, color: "#c0776b", fontWeight: 700 }}>Total Spent</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#c0392b" }}>₹{moneySummary.spend.toFixed(0)}</div>
          </div>
          <div style={{
            flex: 1, minWidth: 110, borderRadius: 10, padding: "10px 12px",
            background: `linear-gradient(135deg, ${moneySummary.net >= 0 ? C.accent : "#c0392b"}18, transparent)`,
            border: `1px solid ${moneySummary.net >= 0 ? C.accent : "#c0392b"}40`,
          }}>
            <div style={{ fontSize: 9, color: "#a39c86", fontWeight: 700 }}>Net (life)</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: moneySummary.net >= 0 ? C.accent : "#c0392b" }}>
              {moneySummary.net >= 0 ? "+" : "−"}₹{Math.abs(moneySummary.net).toFixed(0)}
            </div>
          </div>
        </div>

        <div style={{ height: 220, border: "1px solid #ece7d8", borderRadius: 10, padding: "10px 4px 4px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={moneyData} margin={{ top: 4, right: 10, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a7c59" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#4a7c59" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e07a5f" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#e07a5f" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f0ece0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#b3ac99" }} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: "#b3ac99" }} width={34} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                formatter={(v, key) => [`₹${Number(v).toFixed(0)}`, key === "earn" ? "Earned" : key === "spend" ? "Spent" : "Net"]}
                labelStyle={{ fontSize: 10, fontWeight: 700 }} contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #ece7d8" }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => v === "earn" ? "Earned" : v === "spend" ? "Spent" : "Net trend"} />
              <Area type="monotone" dataKey="net" stroke={C.accent} strokeWidth={2} fill="url(#netGrad)" dot={false} />
              <Bar dataKey="earn" fill="url(#earnGrad)" radius={[4, 4, 0, 0]} barSize={9} />
              <Bar dataKey="spend" fill="url(#spendGrad)" radius={[4, 4, 0, 0]} barSize={9} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {showShare && <ShareJourneyModal state={state} lifeScore={lifeScore} onClose={() => setShowShare(false)} />}
    </div>
  );
}

/* ---------------- EARN MONEY / SPEND MONEY / NOTES / IMAGE (extracted as a widget) ---------------- */
function EarnMoneyNotesCard({ state, update, addEarnToday, addSpendToday, onImageFile, fileRef }) {
  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 8, padding: 7, background: "#fff", width: "100%", height: "100%", overflowY: "auto", boxSizing: "border-box" }} className="btl-scroll">
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 4, color: "#4a7c59" }}>Earn Money Today :-</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={state.earnToday} onChange={(e) => update((s) => { s.earnToday = e.target.value; return s; })}
              onKeyDown={(e) => e.key === "Enter" && addEarnToday()}
              type="number" placeholder="₹ amount"
              style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
            />
            <button onClick={addEarnToday} style={{ border: "none", background: "#4a7c59", color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", fontSize: 9, flexShrink: 0 }}>Add</button>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 10, marginBottom: 4, color: "#c0392b" }}>Spend Money Today :-</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={state.spendToday} onChange={(e) => update((s) => { s.spendToday = e.target.value; return s; })}
              onKeyDown={(e) => e.key === "Enter" && addSpendToday()}
              type="number" placeholder="₹ amount"
              style={{ flex: 1, minWidth: 0, fontSize: 10, padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
            />
            <button onClick={addSpendToday} style={{ border: "none", background: "#c0392b", color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", fontSize: 9, flexShrink: 0 }}>Add</button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <textarea
          value={state.notes} onChange={(e) => update((s) => { s.notes = e.target.value; return s; })}
          placeholder="notes"
          style={{ flex: 1, minHeight: 44, maxHeight: 44, fontSize: 9, padding: 5, borderRadius: 6, border: "1px solid #ddd6c4", outline: "none", resize: "none" }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          {state.uploadedImage
            ? <img src={state.uploadedImage} alt="upload" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd6c4" }} />
            : <div style={{ width: 44, height: 44, borderRadius: 6, border: "1px dashed #ddd6c4", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9c2ac" }}><ImageIcon size={16} /></div>}
          <Oval className="btl-oval-btn" onClick={() => fileRef.current?.click()} style={{ cursor: "pointer", fontSize: 8, padding: "2px 6px" }}>image Uplode</Oval>
          <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: "none" }} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- ANALYTICS SUMMARY (pinnable widget) ---------------- */
function AnalyticsSummaryWidget({ state, onOpen }) {
  const dailyPct = state.dailyGoals.length ? (state.dailyGoals.filter((g) => g.done).length / state.dailyGoals.length) * 100 : 0;
  const extryPct = state.extryGoals.length ? (state.extryGoals.filter((g) => g.done).length / state.extryGoals.length) * 100 : 0;
  const overallPct = (dailyPct + extryPct) / 2;
  return (
    <div style={{ border: `1px solid ${C.text}`, borderRadius: 8, padding: 10, background: "#fff", width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.dark, display: "flex", alignItems: "center", gap: 5 }}><BarChart3 size={13} /> Analytics Summary</span>
        <Oval className="btl-oval-btn" onClick={onOpen} style={{ cursor: "pointer", fontSize: 9, padding: "2px 9px" }}>Open full <ChevronRight size={11} style={{ marginLeft: 2 }} /></Oval>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
        <RingStat pct={dailyPct} label="Daily" color={C.accent} />
        <RingStat pct={extryPct} label="Extry" color={C.blue} />
        <RingStat pct={overallPct} label="Overall" color={C.dark} />
        <div style={{ marginLeft: "auto", textAlign: "center" }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: C.dark, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, margin: "0 auto 2px",
          }}>{String(state.streak).padStart(3, "0")}</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: "#8a8579" }}>Day Streak</div>
        </div>
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
        gridColumn: `span ${effective.w}`, height: effective.h,
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
  const visible = layout.order.filter((id) => id !== "analyticsSummary" || layout.pinned.analyticsSummary);

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
      style={{ display: "grid", gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridAutoFlow: "row dense", gap: 12, paddingBottom: 6 }}
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
  const togglePin = (id) => onChange((l) => ({ ...l, pinned: { ...l.pinned, [id]: !l.pinned[id] } }));
  const onWidgetResize = (id, size) => onChange((l) => ({ ...l, sizes: { ...l.sizes, [id]: normalizeSize(size) } }));

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
            return (
              <Reorder.Item
                key={id} value={id}
                whileDrag={{ scale: 1.03, boxShadow: "0 10px 26px rgba(37,36,34,0.18)", cursor: "grabbing" }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: "rgba(255,255,255,0.85)", border: "1px solid #ece7d8", borderRadius: 8,
                  listStyle: "none", opacity: isAnalytics && !isPinned ? 0.6 : 1,
                }}
              >
                <GripVertical size={14} style={{ color: "#b3ac99", cursor: "grab", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.dark, flex: 1 }}>{w.label}</span>
                {isAnalytics && (
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => togglePin(id)} title={isPinned ? "Unpin from dashboard" : "Pin to dashboard"} style={{
                    border: `1px solid ${isPinned ? C.accent : "#ddd6c4"}`, background: isPinned ? C.accent : "#fff",
                    color: isPinned ? "#fff" : "#8a8579", borderRadius: 999, padding: "3px 9px",
                    display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 9, fontWeight: 700,
                  }}>
                    {isPinned ? <Pin size={11} /> : <PinOff size={11} />} {isPinned ? "Pinned" : "Not shown"}
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

export default function App() {
  const { user: fbUser } = useAuth();
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [shine, setShine] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState(null);
  const [memOpen, setMemOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memVal, setMemVal] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved"
  const fileRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!fbUser) return;
    loadState(fbUser).then((s) => { setState(s); loaded.current = true; });
  }, [fbUser]);

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
    const done = s.dailyGoals.filter((g) => g.done).length + s.extryGoals.filter((g) => g.done).length;
    const pct = total ? (done / total) * 100 : 0;
    s.completionHistory = { ...s.completionHistory, [todayISO()]: pct };
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

  const addEarnToday = () => update((s) => {
    const v = parseFloat(s.earnToday);
    if (!isNaN(v)) {
      s.totalEarnLife = (s.totalEarnLife || 0) + v;
      const day = todayISO();
      const cur = (s.moneyHistory && s.moneyHistory[day]) || { earn: 0, spend: 0 };
      s.moneyHistory = { ...(s.moneyHistory || {}), [day]: { ...cur, earn: cur.earn + v } };
      s.earnToday = "";
    }
    return s;
  });

  const addSpendToday = () => update((s) => {
    const v = parseFloat(s.spendToday);
    if (!isNaN(v)) {
      s.totalSpendLife = (s.totalSpendLife || 0) + v;
      const day = todayISO();
      const cur = (s.moneyHistory && s.moneyHistory[day]) || { earn: 0, spend: 0 };
      s.moneyHistory = { ...(s.moneyHistory || {}), [day]: { ...cur, spend: cur.spend + v } };
      s.spendToday = "";
    }
    return s;
  });

  const onImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { alert("Please pick an image under ~1.5MB."); return; }
    const reader = new FileReader();
    reader.onload = () => update((s) => { s.uploadedImage = reader.result; return s; });
    reader.readAsDataURL(file);
  };

  const updateLayout = (fn) => update((s) => { s.layout = fn(s.layout); return s; });
  const resetLayout = () => update((s) => { s.layout = defaultLayout(); return s; });

  /* Shared widget content map — used by both the plain dashboard grid
     and the live resizable preview inside the Layout tab, so dragging
     a corner handle resizes the exact same widget the user sees on
     their normal dashboard. */
  const widgetsMap = {
    bigGoals: <TextList title="Life Big Goals" items={state.bigGoals} />,
    lifeRules: <TextList title="Life Rules" items={state.lifeRules} />,
    dailyGoals: <GoalChecklist title="Daily Goals" items={state.dailyGoals} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} />,
    extryGoals: <GoalChecklist title="Extry Goals" items={state.extryGoals} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} />,
    earnMoney: <EarnMoneyNotesCard state={state} update={update} addEarnToday={addEarnToday} addSpendToday={addSpendToday} onImageFile={onImageFile} fileRef={fileRef} />,
    mood: <DateMoodColumn moodLog={state.moodLog} onSetMood={setMood} />,
    analyticsSummary: <AnalyticsSummaryWidget state={state} onOpen={() => setTab("analytics")} />,
  };

  return (
    <div style={{
      fontFamily: "Inter, system-ui, sans-serif", background: C.bg, color: C.text,
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

      {tab === "layout" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <LayoutEditor layout={state.layout} widgets={widgetsMap} onChange={updateLayout} onReset={resetLayout} onClose={() => setTab("dashboard")} />
        </div>
      ) : tab === "analytics" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <AnalyticsTab state={state} onClose={() => setTab("dashboard")} />
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
            <motion.button
              onClick={() => setFocusMode((v) => !v)} title="Hide everything except today's incomplete goals"
              whileHover={{ y: -2 }} whileTap={{ scale: 1.07 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{
                border: `1px solid ${focusMode ? C.accent : C.text}`, background: focusMode ? C.accent : C.bg, color: focusMode ? "#fff" : C.text,
                borderRadius: 999, padding: "4px 14px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}><Target size={14} /> Focus Mode</motion.button>
            <motion.button
              onClick={() => setTab("layout")} title="Rearrange, resize, and pin widgets"
              whileHover={{ y: -2 }} whileTap={{ scale: 1.07 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{
                border: `1px solid ${C.text}`, background: C.bg, borderRadius: 999, padding: "4px 14px",
                display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}><LayoutGrid size={14} /> Layout</motion.button>
            <motion.button
              onClick={() => setTab("analytics")}
              whileHover={{ y: -2 }} whileTap={{ scale: 1.07 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{
                border: `1px solid ${C.text}`, background: C.bg, borderRadius: 999, padding: "4px 14px",
                display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
              }}><BarChart3 size={14} /> Analytics</motion.button>
            <motion.button
              onClick={() => setSettingsOpen(true)}
              whileHover={{ y: -2 }} whileTap={{ scale: 1.07 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{
                border: `1px solid ${C.text}`, background: C.bg, borderRadius: 999, padding: "4px 14px",
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
              <motion.button onClick={signOutUser} title="Sign out" whileHover={{ y: -2 }} whileTap={{ scale: 1.15 }}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b3ac99" }}>
                <LogOut size={15} />
              </motion.button>
            </div>
          </div>

          {focusMode ? (
            <>
              {/* ---------- FOCUS MODE ---------- */}
              <Oval style={{ display: "block", width: "fit-content", margin: "0 auto 8px", background: C.accent, color: "#fff", borderColor: C.accent, fontSize: 12, flexShrink: 0 }}>
                FOCUS MODE — TODAY'S REMAINING GOALS
              </Oval>
              <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
                <GoalChecklist title="Daily Goals" items={state.dailyGoals.filter((g) => !g.done)} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} />
                <GoalChecklist title="Extry Goals" items={state.extryGoals.filter((g) => !g.done)} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} />
              </div>
              {state.dailyGoals.filter((g) => !g.done).length === 0 && state.extryGoals.filter((g) => !g.done).length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: "#a39c86", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  🎉 Sab kuch done! Focus Mode se bahar aane ke liye button dabao.
                </div>
              )}
            </>
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
            <SettingsTab state={state} addItem={settingsAdd} removeItem={settingsRemove} editItem={settingsEdit} onClose={() => setSettingsOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- MEMORY MODAL (Glassmorphism 2.0 / Liquid Glass) ---------- */}
      <AnimatePresence>
        {memOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{
              position: "absolute", inset: 0, background: "rgba(37,36,34,0.28)", zIndex: 60,
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
            }} onClick={() => setMemOpen(false)}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              style={{
                width: 260, maxHeight: 340, background: "rgba(255,255,255,0.68)",
                backdropFilter: "blur(16px) saturate(160%)", WebkitBackdropFilter: "blur(16px) saturate(160%)",
                border: "1px solid rgba(255,255,255,0.6)", borderRadius: 14, padding: 12,
                boxShadow: "0 12px 36px rgba(37,36,34,0.18)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 12 }}>Memories</span>
                <motion.span whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} style={{ display: "inline-flex", cursor: "pointer" }}>
                  <X size={14} onClick={() => setMemOpen(false)} />
                </motion.span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 200 }} className="btl-scroll">
                {state.memories.length === 0 && <div style={{ fontSize: 10, color: "#b3ac99" }}>No memories saved yet.</div>}
                {state.memories.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.03 }}
                    style={{ fontSize: 10, padding: "5px 0", borderBottom: "1px solid rgba(240,236,224,0.8)" }}>
                    <div style={{ color: "#b3ac99", fontSize: 8 }}>{m.date}</div>
                    {m.text}
                  </motion.div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={memVal} onChange={(e) => setMemVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && memVal.trim()) {
                      update((s) => { s.memories = [{ date: todayISO(), text: memVal.trim() }, ...s.memories]; return s; });
                      setMemVal("");
                    }
                  }}
                  placeholder="Write a memory..." style={{
                    flex: 1, fontSize: 10, padding: "5px 7px", borderRadius: 6,
                    border: "1px solid #ddd6c4", background: "rgba(255,255,255,0.7)",
                  }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
