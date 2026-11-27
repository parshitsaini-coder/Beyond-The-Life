"use client";
import { useState, useEffect, useRef, useId } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  Droplets, Bell, BellOff, BellRing, Plus, Minus, X, Check, Settings2, Sparkles, Clock,
} from "lucide-react";

/* ================================================================
   DRINK WATER — alarm + time table widget (this update)
   ----------------------------------------------------------------
   One self-contained file so the 16k-line BTLDashboard.jsx only needs
   small hook-ups:
     • state.water  = { enabled, goalMl, glassMl, schedule[], log{} }
         schedule: [{ id, time:"HH:MM", ml, on }]   (repeats every day)
         log:      { "YYYY-MM-DD": { ml, done:{ [slotId]: true } } }
     • WaterReminderWidget  — the dashboard widget (desktop grid, mobile
       dial panel and the mobile quick-swap card all render this same one)
     • WaterRingModal       — popup shown when a scheduled time arrives
     • notifyWaterDue / requestWaterPermission — system notification +
       vibration so phones/PCs alert even if the tab is in the background
   All state changes are pure helpers (water*) so the dashboard just does
   update(s => { s.water = fn(normalizeWater(s.water)); return s; }).
   ================================================================ */

/* ---------------- constants + tiny helpers ---------------- */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad2 = (n) => String(n).padStart(2, "0");
const clampN = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const numOr = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;

export function formatWaterTime(t) {
  if (!TIME_RE.test(t || "")) return t || "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${h >= 12 ? "PM" : "AM"}`;
}
export function waterDayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const WATER_BLUE = "#3aa7e6";
const WATER_DEEP = "#1f7fc4";
const WATER_LIGHT = "#bfe6fa";
// Default day: every hour from 8 AM to 9 PM (14 reminders).
const WATER_DEFAULT_TIMES = Array.from({ length: 14 }, (_, i) => `${pad2(8 + i)}:00`);
const WATER_DEFAULT_GOAL = 3000;
// The first release shipped this 2-hourly list; people who never touched it
// are moved to the new hourly default (anyone who edited it keeps their own).
const WATER_OLD_DEFAULT_TIMES = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];
const ML_CHOICES = [150, 250, 330, 500, 750];

/* ---------------- state shape ---------------- */
export function normalizeWater(w) {
  const src = w && typeof w === "object" ? w : {};
  const glassMl = clampN(Math.round(numOr(src.glassMl, 250)), 50, 1000);
  let goalMl = clampN(Math.round(numOr(src.goalMl, WATER_DEFAULT_GOAL)), 500, 10000);
  let schedule;
  if (Array.isArray(src.schedule)) {
    const seen = new Set();
    schedule = src.schedule
      .filter((s) => s && TIME_RE.test(s.time || ""))
      .filter((s) => (seen.has(s.time) ? false : (seen.add(s.time), true)))
      .map((s) => ({
        id: typeof s.id === "string" && s.id ? s.id : uid(),
        time: s.time,
        ml: clampN(Math.round(numOr(s.ml, glassMl)), 50, 1500),
        on: s.on !== false,
      }));
  } else {
    // first run — a sensible 8-glass day the person can edit freely
    schedule = WATER_DEFAULT_TIMES.map((time) => ({ id: uid(), time, ml: glassMl, on: true }));
  }
  schedule.sort((a, b) => toMin(a.time) - toMin(b.time));
  if (Array.isArray(src.schedule) && schedule.length === WATER_OLD_DEFAULT_TIMES.length
    && schedule.every((sl, i) => sl.time === WATER_OLD_DEFAULT_TIMES[i] && sl.on)) {
    schedule = WATER_DEFAULT_TIMES.map((time) => ({ id: uid(), time, ml: glassMl, on: true }));
    if (goalMl === 2000) goalMl = WATER_DEFAULT_GOAL;
  }
  // keep ~60 days of history so the saved doc never grows without bound
  const log = {};
  const rawLog = src.log && typeof src.log === "object" ? src.log : {};
  Object.keys(rawLog).sort().slice(-60).forEach((day) => {
    const e = rawLog[day] || {};
    log[day] = { ml: Math.max(0, Math.round(numOr(e.ml, 0))), done: e.done && typeof e.done === "object" ? { ...e.done } : {} };
  });
  return { enabled: src.enabled !== false, goalMl, glassMl, schedule, log };
}

const dayEntry = (w, day) => w.log[day] || { ml: 0, done: {} };
export const waterTotalToday = (w, day = waterDayKey()) => dayEntry(w, day).ml;

/* ---------------- pure mutators (all take + return a normalized water) ---------------- */
export function waterAddSlot(w, time, ml) {
  if (!TIME_RE.test(time || "") || w.schedule.some((s) => s.time === time)) return w;
  const next = [...w.schedule, { id: uid(), time, ml: clampN(Math.round(ml || w.glassMl), 50, 1500), on: true }];
  next.sort((a, b) => toMin(a.time) - toMin(b.time));
  return { ...w, schedule: next };
}
export const waterRemoveSlot = (w, id) => ({ ...w, schedule: w.schedule.filter((s) => s.id !== id) });
export const waterToggleSlotOn = (w, id) => ({ ...w, schedule: w.schedule.map((s) => (s.id === id ? { ...s, on: !s.on } : s)) });
export const waterToggleEnabled = (w) => ({ ...w, enabled: !w.enabled });
export const waterSetGoal = (w, goalMl) => ({ ...w, goalMl: clampN(Math.round(goalMl), 500, 10000) });
export const waterSetGlass = (w, glassMl) => ({ ...w, glassMl: clampN(Math.round(glassMl), 50, 1000) });
/* Ticking a slot banks its millilitres; un-ticking takes them back. */
export function waterToggleDone(w, id, day = waterDayKey()) {
  const slot = w.schedule.find((s) => s.id === id);
  if (!slot) return w;
  const e = dayEntry(w, day);
  const done = { ...e.done };
  let ml = e.ml;
  if (done[id]) { delete done[id]; ml = Math.max(0, ml - slot.ml); }
  else { done[id] = true; ml += slot.ml; }
  return { ...w, log: { ...w.log, [day]: { ml, done } } };
}
export function waterMarkDone(w, id, day = waterDayKey()) {
  const e = dayEntry(w, day);
  return e.done[id] ? w : waterToggleDone(w, id, day);
}
/* Quick "+1 glass" (or negative to undo) not tied to any slot. */
export function waterDrink(w, ml, day = waterDayKey()) {
  const e = dayEntry(w, day);
  return { ...w, log: { ...w.log, [day]: { ml: Math.max(0, e.ml + ml), done: { ...e.done } } } };
}
/* Rebuilds the whole time table: every `everyH` hours from 08:00 to 21:00. */
export function waterAutoFill(w, everyH, startH = 8, endH = 21) {
  const schedule = [];
  for (let m = startH * 60; m <= endH * 60; m += Math.max(1, everyH) * 60) {
    schedule.push({ id: uid(), time: fromMin(m), ml: w.glassMl, on: true });
  }
  return { ...w, schedule };
}

/* ---------------- phone/PC alerts ---------------- */
const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export async function requestWaterPermission() {
  try {
    if (!notifySupported()) return "unsupported";
    if (Notification.permission === "default") return await Notification.requestPermission();
    return Notification.permission;
  } catch (e) { return "denied"; }
}
export function notifyWaterDue({ time, ml }) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) { /* no vibration */ }
  try {
    if (!notifySupported() || Notification.permission !== "granted") return;
    const title = "💧 Time to drink water";
    const opts = { body: `${formatWaterTime(time)} · drink ${ml} ml`, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "btl-water", renotify: true, vibrate: [200, 100, 200] };
    const fallback = () => { try { new Notification(title, opts); } catch (e) { /* blocked */ } };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then((reg) => (reg ? reg.showNotification(title, opts) : fallback())).catch(fallback);
    } else fallback();
  } catch (e) { /* notifications unavailable */ }
}

/* ---------------- small animated pieces ---------------- */
function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const c = animate(prev.current, value, { duration: 0.7, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    prev.current = value;
    return () => c.stop();
  }, [value]);
  return <>{shown.toLocaleString("en-IN")}</>;
}

/* Endless ambient motion is plain CSS (not JS-driven framer loops) so it
   costs the main thread nothing — important on phones, where it shares the
   screen with the radial dial. Paused automatically when the tab is hidden
   and disabled for people who ask for reduced motion. */
const WATER_CSS = `
@keyframes btlWvA { from { transform: translateX(0); } to { transform: translateX(-60px); } }
@keyframes btlWvB { from { transform: translateX(-60px); } to { transform: translateX(0); } }
@keyframes btlBubble { 0% { transform: translateY(0); opacity: 0; } 25% { opacity: 0.9; } 100% { transform: translateY(var(--rise)); opacity: 0; } }
@keyframes btlShimmer { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
@keyframes btlGlow { 0%, 100% { opacity: 0.25; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.12); } }
.btl-wv-a { animation: btlWvA 2.3s linear infinite; }
.btl-wv-b { animation: btlWvB 3.4s linear infinite; }
.btl-bubble { animation-name: btlBubble; animation-iteration-count: infinite; animation-timing-function: ease-out; }
.btl-shimmer { animation: btlShimmer 1.8s linear infinite; }
.btl-water-glow { animation: btlGlow 5s ease-in-out infinite; will-change: transform, opacity; }
@media (prefers-reduced-motion: reduce) { .btl-wv-a, .btl-wv-b, .btl-bubble, .btl-shimmer, .btl-water-glow { animation: none !important; } }
`;

const WAVE_D = "M-60 0 Q-45 -5 -30 0 T0 0 T30 0 T60 0 T90 0 T120 0 T150 0 T180 0 T210 0 V140 H-60 Z";
const BOTTLE_D = "M38 8 H62 V18 Q62 22 68 27 Q80 35 80 52 V124 Q80 134 70 134 H30 Q20 134 20 124 V52 Q20 35 32 27 Q38 22 38 18 Z";
const BOT_BOTTOM = 134;
const BOT_TOP = 30;

/* The hero: a glass bottle that fills with two out-of-phase waves,
   rising bubbles, a splash ring + "+250 ml" float whenever you drink. */
function WaterBottle({ pct, splashKey, splashLabel, size = 118, textStroke = "rgba(20,60,100,0.55)" }) {
  const cid = `wb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const depth = (BOT_BOTTOM - BOT_TOP) * pct;
  const surfaceY = BOT_BOTTOM - depth;
  const full = pct >= 1;
  return (
    <div style={{ position: "relative", width: size, height: size * 1.4, flexShrink: 0 }}>
      <motion.div
        animate={full ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={full ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
        style={{ width: "100%", height: "100%" }}
      >
        <svg viewBox="0 0 100 140" width="100%" height="100%" style={{ overflow: "visible" }}>
          <defs>
            <clipPath id={cid}><path d={BOTTLE_D} /></clipPath>
            <linearGradient id={`${cid}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8fdcff" />
              <stop offset="100%" stopColor={WATER_DEEP} />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="136" rx="34" ry="4" fill="rgba(0,0,0,0.14)" />
          <path d={BOTTLE_D} fill="rgba(255,255,255,0.28)" />
          <g clipPath={`url(#${cid})`}>
            <motion.g initial={false} animate={{ y: surfaceY }} transition={{ type: "spring", stiffness: 55, damping: 13 }} style={{ opacity: pct > 0 ? 1 : 0 }}>
              <path d={WAVE_D} fill={`url(#${cid}g)`} opacity={0.55} className="btl-wv-b" />
              <path d={WAVE_D} fill={`url(#${cid}g)`} className="btl-wv-a" />
              {pct > 0.06 && [0, 1, 2, 3].map((i) => (
                <circle
                  key={i} cx={34 + i * 11} cy={Math.max(10, depth - 6)} r={1.6 + (i % 2)} fill="rgba(255,255,255,0.85)"
                  className="btl-bubble"
                  style={{ "--rise": `${-Math.max(0, depth - 14)}px`, animationDuration: `${2.4 + i * 0.5}s`, animationDelay: `${i * 0.7}s` }}
                />
              ))}
            </motion.g>
          </g>
          <path d={BOTTLE_D} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="2.4" strokeLinejoin="round" />
          <rect x="35" y="0" width="30" height="9" rx="3.5" fill={WATER_DEEP} />
          <path d="M27 46 V112" stroke="rgba(255,255,255,0.7)" strokeWidth="3.2" strokeLinecap="round" />
          <text x="50" y="86" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff"
            stroke={textStroke} strokeWidth="3" paintOrder="stroke" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {Math.round(pct * 100)}%
          </text>
          <AnimatePresence>
            {splashKey > 0 && (
              <motion.ellipse
                key={`sp${splashKey}`} cx="50" cy={Math.min(surfaceY + 2, 128)} fill="none" stroke="#fff" strokeWidth="2"
                initial={{ rx: 4, ry: 1, opacity: 0.95 }} animate={{ rx: 32, ry: 6, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
        </svg>
      </motion.div>
      <AnimatePresence>
        {splashKey > 0 && splashLabel && (
          <motion.div
            key={`lb${splashKey}`}
            initial={{ opacity: 0, y: 6, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: -34, scale: 1 }}
            transition={{ duration: 1.3, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
            style={{ position: "absolute", left: 0, right: 0, top: "30%", textAlign: "center", pointerEvents: "none", fontSize: 13, fontWeight: 900, color: WATER_DEEP, textShadow: "0 1px 0 #fff" }}
          >{splashLabel}</motion.div>
        )}
      </AnimatePresence>
      {full && [0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.4], y: [0, -8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5 }}
          style={{ position: "absolute", top: 8 + i * 14, left: i === 1 ? "-4%" : "92%", color: "#f6c343", display: "flex" }}>
          <Sparkles size={13} />
        </motion.span>
      ))}
    </div>
  );
}

function CheckBurst() {
  return (
    <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: -6, pointerEvents: "none" }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <motion.span key={i} initial={{ opacity: 1, x: 16, y: 16, scale: 1 }}
            animate={{ opacity: 0, x: 16 + Math.cos(a) * 15, y: 16 + Math.sin(a) * 15, scale: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: WATER_BLUE }} />
        );
      })}
    </motion.div>
  );
}

/* ================================================================
   THE WIDGET
   ================================================================ */
export function WaterReminderWidget({ water: waterProp, onUpdate, onTest, cardStyle, textColor = "#252422", mutedColor = "#8a8579" }) {
  const water = waterProp || normalizeWater(undefined);
  const [now, setNow] = useState(() => new Date());
  const [splash, setSplash] = useState({ key: 0, label: "" });
  const [panel, setPanel] = useState(null); // null | "settings" | "auto"
  const [newTime, setNewTime] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    return `${pad2(d.getHours())}:00`;
  });
  const [newMl, setNewMl] = useState(water.glassMl);
  const [perm, setPerm] = useState(() => (notifySupported() ? Notification.permission : "unsupported"));
  const [burstId, setBurstId] = useState(null);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15 * 1000);
    const resync = () => { if (document.visibilityState === "visible") setNow(new Date()); };
    document.addEventListener("visibilitychange", resync);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", resync); };
  }, []);

  const day = waterDayKey(now);
  const entry = water.log[day] || { ml: 0, done: {} };
  const total = entry.ml;
  const pct = Math.min(1, total / water.goalMl);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots = water.schedule.map((s) => ({ ...s, mins: toMin(s.time), done: !!entry.done[s.id] }));
  const next = slots.find((s) => s.on && !s.done && s.mins > nowMin);
  const doneCount = slots.filter((s) => s.done).length;
  const statusOf = (s) => {
    if (s.done) return "done";
    if (!s.on) return "off";
    if (next && next.id === s.id) return "next";
    if (s.mins <= nowMin) return nowMin - s.mins <= 5 ? "due" : "missed";
    return "later";
  };
  const inText = (mins) => {
    const d = mins - nowMin;
    return d >= 60 ? `${Math.floor(d / 60)}h ${d % 60 ? `${d % 60}m` : ""}`.trim() : `${d}m`;
  };

  const apply = (fn) => onUpdate((w) => fn(w));
  const pop = (label) => setSplash((s) => ({ key: s.key + 1, label }));
  const drink = (ml) => { apply((w) => waterDrink(w, ml, waterDayKey())); pop(ml > 0 ? `+${ml} ml` : `${ml} ml`); };
  const tick = (s) => {
    if (!s.done) { setBurstId(s.id); setTimeout(() => setBurstId((v) => (v === s.id ? null : v)), 600); pop(`+${s.ml} ml`); }
    apply((w) => waterToggleDone(w, s.id, waterDayKey()));
  };
  const toggleMaster = async () => {
    if (!water.enabled && perm === "default") setPerm(await requestWaterPermission());
    apply(waterToggleEnabled);
  };
  const askPerm = async () => setPerm(await requestWaterPermission());
  const addSlot = () => {
    if (!TIME_RE.test(newTime)) { setAddError("Pick a time"); return; }
    if (water.schedule.some((s) => s.time === newTime)) { setAddError("That time already exists"); setTimeout(() => setAddError(""), 1800); return; }
    setAddError("");
    apply((w) => waterAddSlot(w, newTime, newMl));
  };
  const cycleMl = () => setNewMl((v) => ML_CHOICES[(ML_CHOICES.indexOf(v) + 1) % ML_CHOICES.length] ?? ML_CHOICES[1]);

  const statusStyle = {
    done: { dot: "#4a9d5f", label: "Done", color: "#4a9d5f" },
    next: { dot: WATER_BLUE, label: next ? `Next · in ${inText(next.mins)}` : "Next", color: WATER_DEEP },
    due: { dot: "#f08a24", label: "Drink now!", color: "#d9701a" },
    missed: { dot: "#d9534f", label: "Missed", color: "#d9534f" },
    off: { dot: "#b3ac99", label: "Alarm off", color: mutedColor },
    later: { dot: "#b9d9ee", label: "Upcoming", color: mutedColor },
  };

  const chipBtn = (active) => ({
    border: `1px solid ${active ? WATER_BLUE : "rgba(0,0,0,0.12)"}`, background: active ? "rgba(58,167,230,0.18)" : "rgba(255,255,255,0.55)",
    color: textColor, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "4px 9px", cursor: "pointer",
  });

  return (
    <div style={{ borderRadius: 8, padding: 10, width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden", position: "relative", ...cardStyle }}>
      {/* soft animated water-glow behind everything */}
      <style>{WATER_CSS}</style>
      <div aria-hidden className="btl-water-glow"
        style={{ position: "absolute", width: 180, height: 180, right: -60, top: -50, borderRadius: "50%", background: `radial-gradient(circle, ${WATER_LIGHT}, transparent 70%)`, pointerEvents: "none" }} />

      {/* ---- header ---- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: textColor, display: "flex", alignItems: "center", gap: 5 }}>
          <motion.span animate={{ y: [0, -2, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ display: "flex", color: WATER_BLUE }}><Droplets size={14} /></motion.span>
          Drink Water
          <span style={{ fontSize: 9, fontWeight: 800, color: mutedColor }}>· {doneCount}/{slots.length}</span>
        </span>
        <span style={{ display: "flex", gap: 5 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))} title="Goal & alerts"
            style={{ border: "none", background: panel === "settings" ? "rgba(58,167,230,0.25)" : "rgba(255,255,255,0.5)", color: textColor, borderRadius: 999, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Settings2 size={12} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={toggleMaster} title={water.enabled ? "Water alarms ON — tap to mute" : "Water alarms OFF — tap to enable"}
            style={{ border: "none", background: water.enabled ? WATER_BLUE : "rgba(255,255,255,0.5)", color: water.enabled ? "#fff" : textColor, borderRadius: 999, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {water.enabled ? <BellRing size={12} /> : <BellOff size={12} />}
          </motion.button>
        </span>
      </div>

      {/* ---- hero: bottle + numbers + actions ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, position: "relative", zIndex: 1 }}>
        <WaterBottle pct={pct} splashKey={splash.key} splashLabel={splash.label} size={84} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: textColor, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}><CountUp value={total} /></span>
            <span style={{ fontSize: 10, fontWeight: 800, color: mutedColor }}>/ {water.goalMl.toLocaleString("en-IN")} ml</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(58,167,230,0.18)", overflow: "hidden" }}>
            <motion.div initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: "spring", stiffness: 70, damping: 16 }}
              style={{ height: "100%", borderRadius: 999, background: `linear-gradient(90deg, #8fdcff, ${WATER_DEEP})`, position: "relative", overflow: "hidden" }}>
              <span className="btl-shimmer"
                style={{ position: "absolute", top: 0, bottom: 0, width: "40%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }} />
            </motion.div>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: pct >= 1 ? "#4a9d5f" : mutedColor, display: "flex", alignItems: "center", gap: 4, minHeight: 14 }}>
            {pct >= 1 ? <>🎉 Goal reached — great job!</>
              : next ? <><Clock size={10} /> Next {formatWaterTime(next.time)} · in {inText(next.mins)}</>
              : slots.length ? <>No more reminders today</> : <>Add a time below</>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.92 }} onClick={() => drink(water.glassMl)}
              style={{ flex: 1, border: "none", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 900, borderRadius: 999, padding: "7px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                background: `linear-gradient(135deg, #5cc3f5, ${WATER_DEEP})`, boxShadow: "0 4px 12px rgba(31,127,196,0.4)" }}>
              <Plus size={12} /> {water.glassMl} ml
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => drink(-water.glassMl)} title="Undo one glass"
              style={{ border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.6)", color: textColor, borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Minus size={12} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* ---- optional panels ---- */}
      <AnimatePresence initial={false}>
        {panel === "settings" && (
          <motion.div key="settings" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", flexShrink: 0, position: "relative", zIndex: 1 }}>
            <div style={{ border: "1px solid rgba(58,167,230,0.35)", background: "rgba(255,255,255,0.45)", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Daily goal", value: `${water.goalMl} ml`, dec: () => apply((w) => waterSetGoal(w, w.goalMl - 250)), inc: () => apply((w) => waterSetGoal(w, w.goalMl + 250)) },
                { label: "Glass size", value: `${water.glassMl} ml`, dec: () => apply((w) => waterSetGlass(w, w.glassMl - 50)), inc: () => apply((w) => waterSetGlass(w, w.glassMl + 50)) },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: textColor }}>
                  {r.label}
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={r.dec} style={{ ...chipBtn(false), padding: "2px 8px" }}>−</button>
                    <span style={{ minWidth: 56, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }}>{r.value}</span>
                    <button onClick={r.inc} style={{ ...chipBtn(false), padding: "2px 8px" }}>+</button>
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {perm === "granted" ? (
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: "#4a9d5f", display: "flex", alignItems: "center", gap: 4 }}><Check size={11} /> Phone/PC notifications on</span>
                ) : perm === "denied" ? (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "#d9534f" }}>Notifications blocked — allow them in browser site settings</span>
                ) : perm === "unsupported" ? (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: mutedColor }}>Notifications not supported here (in-app popup + sound still work)</span>
                ) : (
                  <button onClick={askPerm} style={chipBtn(false)}>🔔 Allow notifications</button>
                )}
                <button onClick={onTest} style={chipBtn(false)}>▶ Test alarm</button>
              </div>
            </div>
          </motion.div>
        )}
        {panel === "auto" && (
          <motion.div key="auto" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", flexShrink: 0, position: "relative", zIndex: 1 }}>
            <div style={{ border: "1px solid rgba(58,167,230,0.35)", background: "rgba(255,255,255,0.45)", borderRadius: 10, padding: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: mutedColor, marginBottom: 5 }}>Auto time table, 8 AM → 9 PM (replaces current times)</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3].map((h) => (
                  <motion.button key={h} whileTap={{ scale: 0.92 }} style={chipBtn(false)}
                    onClick={() => { apply((w) => waterAutoFill(w, h)); setPanel(null); }}>Every {h}h</motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- time table ---- */}
      <div className="btl-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, position: "relative", zIndex: 1, paddingRight: 2 }}>
        <AnimatePresence initial={false}>
          {slots.map((s) => {
            const st = statusOf(s);
            const meta = statusStyle[st];
            const hot = st === "next" || st === "due";
            return (
              <motion.div key={s.id} layout
                initial={{ opacity: 0, x: -14 }} animate={{ opacity: s.on || s.done ? 1 : 0.6, x: 0 }} exit={{ opacity: 0, x: 24, height: 0, marginBottom: -5 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 10, flexShrink: 0,
                  background: s.done ? "rgba(74,157,95,0.12)" : "rgba(255,255,255,0.55)", border: `1px solid ${hot ? WATER_BLUE : "rgba(255,255,255,0.7)"}`,
                  borderLeft: `4px solid ${meta.dot}` }}>
                {hot && (
                  <motion.span aria-hidden animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity }}
                    style={{ position: "absolute", inset: -1, borderRadius: 10, boxShadow: `0 0 0 3px ${hexA(meta.dot, 0.35)}`, pointerEvents: "none" }} />
                )}
                <div style={{ position: "relative", width: 24, height: 24, flexShrink: 0 }}>
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => tick(s)} title={s.done ? "Undo" : "I drank this"}
                    style={{ width: 24, height: 24, borderRadius: "50%", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      border: `2px solid ${s.done ? "#4a9d5f" : WATER_BLUE}`, background: s.done ? "#4a9d5f" : "rgba(255,255,255,0.7)", color: "#fff" }}>
                    <AnimatePresence>{s.done && (
                      <motion.span key="c" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} style={{ display: "flex" }}><Check size={13} strokeWidth={3} /></motion.span>
                    )}</AnimatePresence>
                  </motion.button>
                  <AnimatePresence>{burstId === s.id && <CheckBurst />}</AnimatePresence>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: textColor, fontFamily: "'JetBrains Mono', monospace", textDecoration: s.done ? "line-through" : "none", opacity: s.done ? 0.65 : 1 }}>{formatWaterTime(s.time)}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: WATER_DEEP }}>{s.ml} ml</span>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: meta.color }}>{meta.label}</div>
                </div>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => apply((w) => waterToggleSlotOn(w, s.id))} title={s.on ? "Turn this alarm off" : "Turn this alarm on"}
                  style={{ border: "none", background: "transparent", color: s.on ? WATER_BLUE : mutedColor, cursor: "pointer", padding: 2, display: "flex" }}>
                  {s.on ? <Bell size={13} /> : <BellOff size={13} />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => apply((w) => waterRemoveSlot(w, s.id))} title="Delete"
                  style={{ border: "none", background: "transparent", color: mutedColor, cursor: "pointer", padding: 2, display: "flex", opacity: 0.8 }}>
                  <X size={13} />
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {slots.length === 0 && (
          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: mutedColor, padding: "14px 0" }}>
            No reminder times yet — add one below or tap ✨ Auto.
          </div>
        )}
      </div>

      {/* ---- add time bar ---- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input type="time" value={newTime} onChange={(e) => { setNewTime(e.target.value); setAddError(""); }}
            style={{ flex: 1, minWidth: 0, height: 30, boxSizing: "border-box", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "0 6px", fontSize: 12, fontWeight: 800, color: "#252422", background: "rgba(255,255,255,0.85)", fontFamily: "'JetBrains Mono', monospace" }} />
          <motion.button whileTap={{ scale: 0.9 }} onClick={cycleMl} title="Tap to change amount"
            style={{ ...chipBtn(false), height: 30, padding: "0 9px", whiteSpace: "nowrap" }}>{newMl} ml</motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setPanel((p) => (p === "auto" ? null : "auto"))} title="Auto time table"
            style={{ ...chipBtn(panel === "auto"), height: 30, width: 30, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={13} /></motion.button>
          <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.88 }} onClick={addSlot} title="Add reminder time"
            style={{ border: "none", background: `linear-gradient(135deg, #5cc3f5, ${WATER_DEEP})`, color: "#fff", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 3px 8px rgba(31,127,196,0.35)" }}>
            <Plus size={15} />
          </motion.button>
        </div>
        <AnimatePresence>
          {addError && <motion.div initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ fontSize: 9, fontWeight: 800, color: "#d9534f" }}>{addError}</motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return `rgba(58,167,230,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ================================================================
   THE RING POPUP — a falling droplet, expanding ripples, glass card.
   Rendered by the dashboard (absolute, inside the dashboard root) the
   same way AlarmRingModal is.
   ================================================================ */
export function WaterRingModal({ slot, onDrink, onSnooze, onDismiss }) {
  if (!slot) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, zIndex: 96, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(16,44,72,0.4)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        style={{ width: "min(88%, 330px)", borderRadius: 22, padding: "24px 20px 20px", textAlign: "center", position: "relative", overflow: "hidden",
          background: "rgba(255,255,255,0.78)", backdropFilter: "blur(24px) saturate(190%)", WebkitBackdropFilter: "blur(24px) saturate(190%)",
          border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 24px 60px rgba(16,44,72,0.4), inset 0 1px 0 rgba(255,255,255,0.7)" }}>
        <motion.div animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.18, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -50, borderRadius: "50%", background: `radial-gradient(circle, ${hexA(WATER_BLUE, 0.5)}, transparent 70%)`, zIndex: 0 }} />

        <div style={{ position: "relative", zIndex: 1, height: 92, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} initial={{ width: 10, height: 4, opacity: 0.7 }} animate={{ width: 90, height: 22, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 + i * 0.35, ease: "easeOut" }}
              style={{ position: "absolute", bottom: 0, borderRadius: "50%", border: `2px solid ${WATER_BLUE}` }} />
          ))}
          <motion.svg width="38" height="50" viewBox="0 0 38 50"
            animate={{ y: [-46, 22], scaleY: [1.15, 0.9], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeIn", times: [0, 0.15, 0.9, 1] }}
            style={{ position: "absolute", top: 0 }}>
            <defs><linearGradient id="wrmDrop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9be3ff" /><stop offset="100%" stopColor={WATER_DEEP} /></linearGradient></defs>
            <path d="M19 3 C19 3 5 21 5 31 A14 14 0 0 0 33 31 C33 21 19 3 19 3 Z" fill="url(#wrmDrop)" />
            <path d="M12 29 A8 8 0 0 0 17 38" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </motion.svg>
        </div>

        <div style={{ position: "relative", zIndex: 1, fontSize: 11, fontWeight: 800, color: "#6b8aa3", marginTop: 6 }}>Time to hydrate 💧</div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 30, fontWeight: 900, color: "#17324d", fontFamily: "'JetBrains Mono', 'Courier New', monospace", margin: "2px 0" }}>
          {formatWaterTime(slot.time)}
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: 12, fontWeight: 800, color: WATER_DEEP, marginBottom: 16 }}>Drink {slot.ml} ml of water</div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <motion.button onClick={onDrink} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
            style={{ border: "none", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 900, borderRadius: 999, padding: "10px 22px", background: `linear-gradient(135deg, #5cc3f5, ${WATER_DEEP})`, boxShadow: "0 6px 16px rgba(31,127,196,0.45)" }}>
            ✓ I drank it
          </motion.button>
          <motion.button onClick={onSnooze} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
            style={{ border: "1px solid rgba(0,0,0,0.12)", cursor: "pointer", color: "#17324d", fontSize: 12, fontWeight: 800, borderRadius: 999, padding: "10px 16px", background: "rgba(255,255,255,0.8)" }}>
            Snooze 10 min
          </motion.button>
        </div>
        <button onClick={onDismiss} style={{ position: "relative", zIndex: 1, marginTop: 10, border: "none", background: "transparent", color: "#8aa0b3", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Dismiss</button>
      </motion.div>
    </motion.div>
  );
}
