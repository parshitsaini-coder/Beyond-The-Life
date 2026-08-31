"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Settings, X, Plus, Smile, Meh, Frown, Image as ImageIcon,
  LogOut, Trash2, ChevronRight, ChevronDown, ChevronUp, Flame, Target, BookOpen,
  Repeat, RotateCcw, BarChart3, TrendingUp, Award, Tag
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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
    totalEarnLife: 0,
    memories: [],
    moodLog: {},        // { "2026-08-30": "happy" | "neutral" | "sad" }
    completionHistory: {}, // { "2026-08-30": 62.5 }  -- % of daily+extry goals done that day
    streak: 0,
    lastCompletedDate: null,
  };
}

/* ---------------- STORAGE HELPERS ----------------
   Previously window.storage (artifact-sandbox-only, private per Claude
   account). Now backed by Firebase Firestore + security rules — see
   lib/btlStorage.js and firestore.rules. These are thin wrappers that
   take the signed-in Firebase user, so the rest of this file barely
   had to change. */
async function loadState(user) {
  return loadStateFromFirestore(user, makeDefaultState, ensureGoalDefaults);
}
async function saveState(user, state) {
  return saveStateToFirestore(user, state);
}

/* ---------------- SMALL UI ATOMS ---------------- */
function Oval({ children, style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${C.text}`, borderRadius: 999, padding: "4px 14px",
        fontSize: 14, fontWeight: 800, background: C.bg, color: C.text,
        whiteSpace: "nowrap", ...style,
      }}
    >
      {children}
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

/* ---------------- EDITABLE LIST (Life Big Goals / Life Rules) ---------------- */
function TextList({ title, items, onAdd, onRemove }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Oval style={{ display: "block", margin: "0 auto 6px", background: C.dark, color: C.bg, borderColor: C.dark, fontSize: 15, fontWeight: 900 }}>{title}</Oval>
      <div style={{
        border: `1px solid ${C.text}`, borderRadius: 8, maxHeight: 150, overflowY: "auto", background: "#fff",
      }} className="btl-scroll">
        {items.length === 0 && <div style={{ padding: 8, fontSize: 12, color: "#b3ac99" }}>Nothing yet — add one below.</div>}
        {items.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 8px", borderBottom: i < items.length - 1 ? "1px solid #f0ece0" : "none", fontSize: 13, fontWeight: 700,
          }}>
            <span>{t}</span>
            <Trash2 size={12} style={{ cursor: "pointer", color: "#c9c2ac", flexShrink: 0 }} onClick={() => onRemove(i)} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
        <input
          value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
          placeholder={`Add to ${title}...`}
          style={{ flex: 1, fontSize: 10, padding: "5px 7px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
        />
        <button
          onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
          style={{ border: "none", background: C.accent, color: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer" }}
        >
          <Plus size={13} />
        </button>
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
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.dark, marginBottom: 6, textAlign: "center" }}>{title}</div>
      <div style={{ maxHeight: 230, overflowY: "auto" }} className="btl-scroll">
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

      <div style={{ marginTop: 6 }}>
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
    <div style={{ width: 150, flexShrink: 0 }}>
      <Oval style={{ display: "block", margin: "0 auto 6px", background: C.dark, color: C.bg, borderColor: C.dark }}>DATE</Oval>
      <div style={{ maxHeight: 250, overflowY: "auto", border: `1px solid ${C.text}`, borderRadius: 8, background: "#fff" }} className="btl-scroll">
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

/* ---------------- SETTINGS TAB (image 2) ---------------- */
function SettingsTab({ state, addItem, removeItem, onClose }) {
  const [mode, setMode] = useState(null); // "goal" | "extry" | null
  const [val, setVal] = useState("");

  const submit = () => {
    if (!val.trim()) return;
    if (mode === "goal") addItem("dailyGoals", val.trim());
    if (mode === "extry") addItem("extryGoals", val.trim());
    setVal(""); setMode(null);
  };

  return (
    <div style={{
      border: `1px solid ${C.text}`, borderRadius: 10, background: "#fff",
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        borderBottom: `1px solid ${C.text}`, background: C.bg, borderRadius: "10px 10px 0 0",
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.dark }}>Setting</span>
        <Oval onClick={() => setMode("goal")} style={{ cursor: "pointer", background: mode === "goal" ? C.accent : C.bg, color: mode === "goal" ? "#fff" : C.text }}>Add Goles</Oval>
        <Oval onClick={() => setMode("extry")} style={{ cursor: "pointer", background: mode === "extry" ? C.accent : C.bg, color: mode === "extry" ? "#fff" : C.text }}>Add extry</Oval>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} title="Closed Butan" style={{
          border: "none", borderRadius: "50%", width: 24, height: 24, background: "#e9e4d3",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}><X size={13} color={C.dark} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }} className="btl-scroll">
        {mode && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <input
              autoFocus value={val} onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={mode === "goal" ? "New daily goal..." : "New entry goal..."}
              style={{ flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
            />
            <button onClick={submit} style={{ border: "none", background: C.accent, color: "#fff", borderRadius: 6, padding: "0 10px", cursor: "pointer", fontSize: 11 }}>Add</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { key: "dailyGoals", label: "Daily Goals" },
            { key: "extryGoals", label: "Extry Goals" },
            { key: "bigGoals", label: "Life Big Goals", plain: true },
            { key: "lifeRules", label: "Life Rules", plain: true },
          ].map((col) => (
            <div key={col.key}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.dark, marginBottom: 4 }}>{col.label}</div>
              <div style={{ border: "1px solid #ece7d8", borderRadius: 8, maxHeight: 130, overflowY: "auto" }} className="btl-scroll">
                {(state[col.key] || []).map((item, i) => (
                  <div key={col.plain ? i : item.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "4px 7px", fontSize: 10, borderBottom: "1px solid #f5f1e6",
                  }}>
                    <span>{col.plain ? item : item.text}</span>
                    <Trash2 size={11} style={{ cursor: "pointer", color: "#d8d2bf" }} onClick={() => removeItem(col.key, col.plain ? i : item.id)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#b3ac99", padding: "6px 0", borderTop: "1px solid #f0ece0" }}>
        Setting Teb
      </div>
    </div>
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
      </div>
      {showShare && <ShareJourneyModal state={state} lifeScore={lifeScore} onClose={() => setShowShare(false)} />}
    </div>
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
  const [memVal, setMemVal] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const fileRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!fbUser) return;
    loadState(fbUser).then((s) => { setState(s); loaded.current = true; });
  }, [fbUser]);

  useEffect(() => {
    if (!state || !loaded.current || !fbUser) return;
    const t = setTimeout(() => saveState(fbUser, state), 400);
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

  const settingsAdd = (listKey, text) => addGoal(listKey)(text);
  const settingsRemove = (listKey, idOrIdx) => {
    if (listKey === "bigGoals" || listKey === "lifeRules") removePlain(listKey, idOrIdx);
    else removeGoal(listKey)(idOrIdx);
  };

  const setMood = (date, mood) => update((s) => { s.moodLog = { ...s.moodLog, [date]: mood }; return s; });

  const addEarnToday = () => update((s) => {
    const v = parseFloat(s.earnToday);
    if (!isNaN(v)) { s.totalEarnLife = (s.totalEarnLife || 0) + v; s.earnToday = ""; }
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

  return (
    <div style={{
      fontFamily: "Inter, system-ui, sans-serif", background: C.bg, color: C.text,
      minHeight: 560, borderRadius: 14, padding: 14, position: "relative", overflow: "hidden",
      border: `1px solid #ece7d8`, fontSize: 11,
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

      {tab === "settings" ? (
        <div style={{ height: 560 }}>
          <SettingsTab state={state} addItem={settingsAdd} removeItem={settingsRemove} onClose={() => setTab("dashboard")} />
        </div>
      ) : tab === "analytics" ? (
        <div style={{ height: 560 }}>
          <AnalyticsTab state={state} onClose={() => setTab("dashboard")} />
        </div>
      ) : (
        <>
          {/* ---------- HEADER ---------- */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <Oval style={{ background: C.dark, color: C.bg, borderColor: C.dark, fontSize: 16, fontWeight: 900 }}>Byound The Life</Oval>
            <Oval title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>Goals</Oval>
            <Oval title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>Total Earn Money life :- ₹{state.totalEarnLife.toFixed(0)}</Oval>
            <Oval className="btl-oval-btn" onClick={() => setMemOpen(true)} style={{ cursor: "pointer", background: C.blue, borderColor: C.blue, color: C.dark }}><BookOpen size={11} style={{ marginRight: 4 }} />memor</Oval>
            <button className="btl-oval-btn" onClick={() => setFocusMode((v) => !v)} title="Hide everything except today's incomplete goals" style={{
              border: `1px solid ${focusMode ? C.accent : C.text}`, background: focusMode ? C.accent : C.bg, color: focusMode ? "#fff" : C.text,
              borderRadius: 999, padding: "4px 14px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
            }}><Target size={14} /> Focus Mode</button>
            <button className="btl-oval-btn" onClick={() => setTab("analytics")} style={{
              border: `1px solid ${C.text}`, background: C.bg, borderRadius: 999, padding: "4px 14px",
              display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
            }}><BarChart3 size={14} /> Analytics</button>
            <button className="btl-oval-btn" onClick={() => setTab("settings")} style={{
              border: `1px solid ${C.text}`, background: C.bg, borderRadius: 999, padding: "4px 14px",
              display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 14, fontWeight: 800,
            }}><Settings size={14} /> Setting</button>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", background: C.dark, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
                }}>{String(state.streak).padStart(3, "0")}</div>
              </div>
              <RingStat pct={dailyPct} label="Daily Goal" sub="Staytus" color={C.accent} />
              <RingStat pct={extryPct} label="Extry Goal" sub="Staytus" color={C.blue} />
              <RingStat pct={overallPct} label="Goal" color={C.dark} />
              <button onClick={signOutUser} title="Sign out"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b3ac99" }}>
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {/* ---------- BIG GOALS + RULES ---------- */}
          {!focusMode && (
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <TextList title="Life Big Goals" items={state.bigGoals} onAdd={(t) => addPlain("bigGoals", t)} onRemove={(i) => removePlain("bigGoals", i)} />
              <TextList title="Life Rules" items={state.lifeRules} onAdd={(t) => addPlain("lifeRules", t)} onRemove={(i) => removePlain("lifeRules", i)} />
            </div>
          )}

          {/* ---------- DAILY GOAL SECTION ---------- */}
          <Oval style={{ display: "block", width: "fit-content", margin: "0 auto 8px", background: C.accent, color: "#fff", borderColor: C.accent, fontSize: 12 }}>
            {focusMode ? "FOCUS MODE — TODAY'S REMAINING GOALS" : "DAILY GOAL"}
          </Oval>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <GoalChecklist title="Daily Goals" items={focusMode ? state.dailyGoals.filter((g) => !g.done) : state.dailyGoals} onToggle={toggleGoal("dailyGoals")} onAdd={addGoal("dailyGoals")} onRemove={removeGoal("dailyGoals")} onToggleSubtask={toggleSubtask("dailyGoals")} onAddSubtask={addSubtask("dailyGoals")} onSetIcon={setGoalIcon("dailyGoals")} accent={C.accent} />
                <GoalChecklist title="Extry Goals" items={focusMode ? state.extryGoals.filter((g) => !g.done) : state.extryGoals} onToggle={toggleGoal("extryGoals")} onAdd={addGoal("extryGoals")} onRemove={removeGoal("extryGoals")} onToggleSubtask={toggleSubtask("extryGoals")} onAddSubtask={addSubtask("extryGoals")} onSetIcon={setGoalIcon("extryGoals")} accent={C.blue} />
              </div>

              {focusMode && state.dailyGoals.filter((g) => !g.done).length === 0 && state.extryGoals.filter((g) => !g.done).length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: "#a39c86", fontSize: 12, fontWeight: 700 }}>
                  🎉 Sab kuch done! Focus Mode se bahar aane ke liye button dabao.
                </div>
              )}

              {/* Earn money + notes + image */}
              {!focusMode && (
              <div style={{ border: `1px solid ${C.text}`, borderRadius: 8, padding: 8, background: "#fff" }}>
                <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 5 }}>Earn Money Today :-</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    value={state.earnToday} onChange={(e) => update((s) => { s.earnToday = e.target.value; return s; })}
                    onKeyDown={(e) => e.key === "Enter" && addEarnToday()}
                    type="number" placeholder="₹ amount"
                    style={{ flex: 1, fontSize: 11, padding: "5px 7px", borderRadius: 6, border: "1px solid #ddd6c4", outline: "none" }}
                  />
                  <button onClick={addEarnToday} style={{ border: "none", background: C.dark, color: "#fff", borderRadius: 6, padding: "0 10px", cursor: "pointer", fontSize: 10 }}>Add</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    value={state.notes} onChange={(e) => update((s) => { s.notes = e.target.value; return s; })}
                    placeholder="notes"
                    style={{ flex: 1, minHeight: 60, fontSize: 10, padding: 6, borderRadius: 6, border: "1px solid #ddd6c4", outline: "none", resize: "vertical" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    {state.uploadedImage
                      ? <img src={state.uploadedImage} alt="upload" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd6c4" }} />
                      : <div style={{ width: 60, height: 60, borderRadius: 6, border: "1px dashed #ddd6c4", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9c2ac" }}><ImageIcon size={20} /></div>}
                    <Oval className="btl-oval-btn" onClick={() => fileRef.current?.click()} style={{ cursor: "pointer", fontSize: 9, padding: "2px 8px" }}>image Uplode</Oval>
                    <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: "none" }} />
                  </div>
                </div>
              </div>
              )}
            </div>

            {!focusMode && <DateMoodColumn moodLog={state.moodLog} onSetMood={setMood} />}
          </div>
        </>
      )}

      {/* ---------- MEMORY MODAL ---------- */}
      {memOpen && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(37,36,34,0.35)", zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setMemOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 260, maxHeight: 340, background: "#fff", borderRadius: 10, padding: 12,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800, fontSize: 12 }}>Memories</span>
              <X size={14} style={{ cursor: "pointer" }} onClick={() => setMemOpen(false)} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 200 }} className="btl-scroll">
              {state.memories.length === 0 && <div style={{ fontSize: 10, color: "#b3ac99" }}>No memories saved yet.</div>}
              {state.memories.map((m, i) => (
                <div key={i} style={{ fontSize: 10, padding: "5px 0", borderBottom: "1px solid #f0ece0" }}>
                  <div style={{ color: "#b3ac99", fontSize: 8 }}>{m.date}</div>
                  {m.text}
                </div>
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
                placeholder="Write a memory..." style={{ flex: 1, fontSize: 10, padding: "5px 7px", borderRadius: 6, border: "1px solid #ddd6c4" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
