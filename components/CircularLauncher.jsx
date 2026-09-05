"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, User, LogIn, LogOut, ShieldCheck, Plus, X,
  CheckCircle2, ListChecks, Target, AlarmClock, BookOpen, Timer,
  CalendarClock, CalendarDays, Image as ImageIcon, Pencil, Dumbbell,
  Settings, Users, BarChart3, Sparkles,
} from "lucide-react";
import { useAuth, signOutUser, signInWithGoogle } from "@/lib/AuthContext";

/* ============================================================
   CIRCULAR LAUNCHER — mobile home screen
   ------------------------------------------------------------
   - Background: #c0d6df
   - Center button: #403d39 (press + hold + swipe to a feature,
     release over it to open that feature with an animated
     "reveal" transition into /dashboard).
   - Top bar: back button (left) + profile avatar (right) only.
   - Tap the center button (no drag) to fan the menu open, tap
     any bubble to open it directly, tap the backdrop (or the
     center button again) to close.
   ============================================================ */

const BG = "#c0d6df";
const CIRCLE = "#403d39";

/* Every feature the person listed, in the order they gave them.
   `target` is the query value read by BTLDashboard.jsx (?open=target)
   to jump straight to that widget / tab / modal. */
const FEATURES = [
  { id: "dailyGoals", label: "Daily Goals", icon: CheckCircle2, target: "dailyGoals" },
  { id: "extryGoals", label: "Extry Goals", icon: ListChecks, target: "extryGoals" },
  { id: "bigGoals", label: "Life Big Goals", icon: Target, target: "bigGoals" },
  { id: "clock", label: "Clock & Alarm", icon: AlarmClock, target: "clock" },
  { id: "lifeRules", label: "Life Rules", icon: BookOpen, target: "lifeRules" },
  { id: "focusTimer", label: "Timer", icon: Timer, target: "focusTimer" },
  { id: "timeTable", label: "Time Table", icon: CalendarClock, target: "timeTable" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, target: "calendar" },
  { id: "memories", label: "Memory", icon: ImageIcon, target: "memories" },
  { id: "lifeStory", label: "Life Story", icon: Pencil, target: "lifeStory" },
  { id: "fitness", label: "Fitness", icon: Dumbbell, target: "fitness" },
  { id: "settings", label: "Settings", icon: Settings, target: "settings" },
  { id: "friends", label: "Friends Celebration", icon: Users, target: "friends" },
  { id: "analytics", label: "Analysis", icon: BarChart3, target: "analytics" },
  { id: "share", label: "Share Journal", icon: Sparkles, target: "share" },
];

const CIRCLE_SIZE = 92;
const BOTTOM_GAP = 46; // distance from bottom of screen to the center button
const SPREAD_DEG = 172; // total angular width of the fan, centered "up"
const HIT_DEAD_ZONE = 26; // px — inside this radius of the center, no bubble is selected

function polar(centerX, centerY, radius, thetaDeg) {
  const rad = (thetaDeg * Math.PI) / 180;
  return { x: centerX + radius * Math.sin(rad), y: centerY - radius * Math.cos(rad) };
}

/* Build the fan layout: alternates two ring radii (near/far) so 15
   labeled bubbles can share one arc without overlapping, while every
   bubble's angle still reads as one continuous sweep left-to-right. */
function useFanLayout(center, radiusNear, radiusFar) {
  return useMemo(() => {
    const n = FEATURES.length;
    return FEATURES.map((f, i) => {
      const theta = n > 1 ? -SPREAD_DEG / 2 + (i * SPREAD_DEG) / (n - 1) : 0;
      const radius = i % 2 === 0 ? radiusFar : radiusNear;
      const pos = polar(center.x, center.y, radius, theta);
      return { ...f, theta, radius, ...pos };
    });
  }, [center.x, center.y, radiusNear, radiusFar]);
}

/* ---------------- Profile mini avatar + popup (top-right, self-contained) ---------------- */
function ProfileMini() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const initial = (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ position: "relative" }}>
      <motion.button
        onClick={() => setOpen((v) => !v)}
        title={user ? user.displayName || "Profile" : "Sign in"}
        whileTap={{ scale: 0.92 }}
        style={{
          width: 40, height: 40, borderRadius: "50%", padding: 0, cursor: "pointer",
          border: `2px solid ${open ? CIRCLE : "rgba(64,61,57,0.25)"}`,
          background: user?.photoURL ? "transparent" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        }}
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : user ? (
          <span style={{ fontSize: 15, fontWeight: 800, color: CIRCLE }}>{initial}</span>
        ) : (
          <User size={18} color={CIRCLE} />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -6 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0, width: 240, zIndex: 201,
                background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.7)", borderRadius: 16, padding: 16,
                boxShadow: "0 20px 44px rgba(37,36,34,0.25)",
              }}
            >
              {user ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 900, color: CIRCLE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.displayName || "Signed in"}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#6b675f", marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.email}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 700, color: "#4a7c59", background: "rgba(74,124,89,0.12)", borderRadius: 999, padding: "4px 10px", width: "fit-content", marginBottom: 12 }}>
                    <ShieldCheck size={11} /> Signed in
                  </div>
                  <button
                    onClick={() => { signOutUser(); setOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px solid rgba(192,57,43,0.35)", background: "#fff", color: "#c0392b", borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { signInWithGoogle(); setOpen(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px solid ${CIRCLE}`, background: "#fff", color: CIRCLE, borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                >
                  <LogIn size={14} /> Continue with Google
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Soft floating background blobs (purely decorative) ---------------- */
function SoftBlobs() {
  const blobs = [
    { size: 220, top: "8%", left: "-8%", color: "#98c1d9", dur: 11 },
    { size: 180, top: "58%", left: "72%", color: "#a9c9ce", dur: 14 },
    { size: 150, top: "30%", left: "58%", color: "#ffffff", dur: 9 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          animate={{ x: [0, 18, -14, 0], y: [0, -16, 12, 0] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute", top: b.top, left: b.left, width: b.size, height: b.size,
            borderRadius: "50%", background: b.color, opacity: 0.35, filter: "blur(46px)",
          }}
        />
      ))}
    </div>
  );
}

export default function CircularLauncher() {
  const router = useRouter();
  const [viewport, setViewport] = useState({ w: 390, h: 780 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [selected, setSelected] = useState(null); // feature object mid-selection
  const [opening, setOpening] = useState(false);

  const circleRef = useRef(null);
  const draggingRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const center = { x: viewport.w / 2, y: viewport.h - BOTTOM_GAP - CIRCLE_SIZE / 2 };
  const radiusNear = Math.max(112, Math.min(150, viewport.w * 0.34));
  const radiusFar = radiusNear + 76;
  const fan = useFanLayout(center, radiusNear, radiusFar);

  const closeMenu = () => { setMenuOpen(false); setHighlightId(null); };

  const openFeature = (feature) => {
    setSelected(feature);
    setMenuOpen(false);
    setHighlightId(null);
    setOpening(true);
    setTimeout(() => {
      router.push(`/dashboard?open=${feature.target}`);
    }, 620);
  };

  const nearestFeature = (clientX, clientY) => {
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const dist = Math.hypot(dx, dy);
    if (dist < HIT_DEAD_ZONE) return null;
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    let best = null;
    let bestDiff = Infinity;
    for (const f of fan) {
      const diff = Math.abs(f.theta - angle);
      if (diff < bestDiff) { bestDiff = diff; best = f; }
    }
    return best;
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    try { circleRef.current?.setPointerCapture(e.pointerId); } catch {}
    draggingRef.current = true;
    wasOpenRef.current = menuOpen;
    setMenuOpen(true);
  };
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const f = nearestFeature(e.clientX, e.clientY);
    setHighlightId(f ? f.id : null);
  };
  const handlePointerUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { circleRef.current?.releasePointerCapture(e.pointerId); } catch {}
    if (highlightId) {
      const f = FEATURES.find((x) => x.id === highlightId);
      if (f) { openFeature(f); return; }
    }
    // no drag / no hit — plain tap: toggle the menu instead of selecting
    if (wasOpenRef.current) closeMenu();
    setHighlightId(null);
  };

  const handleBack = () => {
    if (menuOpen) { closeMenu(); return; }
    try { router.back(); } catch {}
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: BG, overflow: "hidden",
      fontFamily: "Inter, system-ui, sans-serif", touchAction: "none",
      WebkitTapHighlightColor: "transparent",
    }}>
      <SoftBlobs />

      {/* ---------------- TOP BAR — back (left) + profile (right) only ---------------- */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", paddingTop: "max(14px, env(safe-area-inset-top))",
      }}>
        <motion.button
          onClick={handleBack}
          whileTap={{ scale: 0.9 }}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(64,61,57,0.15)",
          }}
        >
          <ArrowLeft size={19} color={CIRCLE} />
        </motion.button>

        <ProfileMini />
      </div>

      {/* ---------------- Backdrop — tap anywhere empty to close the fan ---------------- */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            onClick={closeMenu}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(64,61,57,0.06)" }}
          />
        )}
      </AnimatePresence>

      {/* ---------------- Fan of feature bubbles ---------------- */}
      <AnimatePresence>
        {menuOpen && fan.map((f, i) => {
          const Icon = f.icon;
          const active = highlightId === f.id;
          return (
            <motion.button
              key={f.id}
              onClick={() => openFeature(f)}
              initial={{ opacity: 0, scale: 0.2, left: center.x, top: center.y }}
              animate={{
                opacity: 1, scale: active ? 1.14 : 1, left: f.x, top: f.y,
              }}
              exit={{ opacity: 0, scale: 0.2, left: center.x, top: center.y, transition: { duration: 0.25, delay: 0 } }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: i * 0.02 }}
              style={{
                position: "absolute", zIndex: 20, transform: "translate(-50%, -50%)",
                width: 66, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                border: "none", background: "transparent", cursor: "pointer", padding: 0,
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: "50%",
                background: active ? CIRCLE : "#ffffff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: active ? `0 0 0 4px rgba(64,61,57,0.18), 0 10px 20px rgba(64,61,57,0.35)` : "0 6px 16px rgba(64,61,57,0.18)",
                transition: "background 120ms ease",
              }}>
                <Icon size={20} color={active ? "#fff" : CIRCLE} />
              </div>
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: CIRCLE, lineHeight: 1.15, textAlign: "center",
                textShadow: "0 1px 4px rgba(255,255,255,0.7)",
              }}>
                {f.label}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* ---------------- Center circle button ---------------- */}
      <motion.button
        ref={circleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        whileTap={{ scale: 0.94 }}
        animate={{
          boxShadow: menuOpen
            ? [`0 0 0 0 ${CIRCLE}55`, `0 0 0 18px ${CIRCLE}00`]
            : [`0 0 0 0 ${CIRCLE}40`, `0 0 0 14px ${CIRCLE}00`],
        }}
        transition={{ boxShadow: { duration: 1.8, repeat: Infinity, ease: "easeOut" } }}
        style={{
          position: "absolute", left: center.x, top: center.y, transform: "translate(-50%, -50%)",
          width: CIRCLE_SIZE, height: CIRCLE_SIZE, borderRadius: "50%", zIndex: 30,
          background: CIRCLE, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <motion.div animate={{ rotate: menuOpen ? 135 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
          <Plus size={30} color="#fff" />
        </motion.div>
      </motion.button>

      {/* ---------------- Full-screen "reveal" transition into the chosen panel ---------------- */}
      <AnimatePresence>
        {opening && selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none" }}
          >
            <motion.div
              initial={{ scale: 0.15, left: center.x, top: center.y }}
              animate={{ scale: Math.ceil(Math.hypot(viewport.w, viewport.h) / 46), left: center.x, top: center.y }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "absolute", width: 100, height: 100, borderRadius: "50%",
                background: CIRCLE, transform: "translate(-50%, -50%)",
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.3 }}
              style={{
                position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#fff",
              }}
            >
              <selected.icon size={34} />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3 }}>Opening {selected.label}…</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
