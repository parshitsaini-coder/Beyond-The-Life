"use client";
import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, ListChecks, Trophy, AlarmClock, ShieldCheck, Timer,
  CalendarClock, CalendarDays, Camera, BookOpen, Dumbbell, Settings,
  PartyPopper, BarChart3, Share2, Wallet,
} from "lucide-react";
import LiquidOrbButton from "@/components/LiquidOrbButton";

/* ---------------- CONFIG ----------------
   The spec's 15 items + order, PLUS Money Management as a 16th item
   (added in Step 5: the header audit found it had an existing full tab
   but no slot in the original list — you chose "add as a 16th radial
   item" over folding it into Analytics or Settings-only). Each carries
   the `tab` id it should eventually open (Step 7 wiring) — filled in
   now so wiring later is a one-line lookup, not a second pass through
   this list. `kind` records what Step 1's audit found: "widget" items
   are the 7 that live on the freeform dashboard grid today and (per
   your Step 1 decision) will each become their own dedicated
   full-screen panel; "tab" items already have a real full-screen;
   "modal" items already open as an overlay. */
export const RADIAL_ITEMS = [
  { id: "dailyGoals", label: "Daily Goal", icon: CheckCircle2, kind: "widget" },
  { id: "extryGoals", label: "Entry Goals", icon: ListChecks, kind: "widget" },
  { id: "bigGoals", label: "Life Big Goals", icon: Trophy, kind: "widget" },
  { id: "clock", label: "Clock & Alarm", icon: AlarmClock, kind: "widget" },
  { id: "lifeRules", label: "Life Rules", icon: ShieldCheck, kind: "widget" },
  { id: "focusTimer", label: "Timer", icon: Timer, kind: "widget" },
  { id: "timeTable", label: "Time Table", icon: CalendarClock, kind: "widget" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, kind: "widget" },
  { id: "memory", label: "Memory", icon: Camera, kind: "modal" },
  { id: "lifeStory", label: "Life Story", icon: BookOpen, kind: "tab" },
  { id: "fitness", label: "Fitness", icon: Dumbbell, kind: "tab" },
  { id: "settings", label: "Settings", icon: Settings, kind: "modal" },
  { id: "friend", label: "Friend Celebration", icon: PartyPopper, kind: "modal" },
  { id: "analytics", label: "Analytics", icon: BarChart3, kind: "tab" },
  { id: "share", label: "Share Journal", icon: Share2, kind: "modal" },
  { id: "money", label: "Money Management", icon: Wallet, kind: "tab" },
];

const CIRCLE_COLOR = "#403d39";
const CIRCLE_SIZE = 76; // px
const INNER_RADIUS = 108;
const OUTER_RADIUS = 190;
const SWEEP_DEG = 210; // total angular spread, centered straight up
const DEADZONE = 34; // px — releasing inside this radius of the circle cancels
const CHIP_SIZE = 56; // px, icon-only touch target
// Cap on how far the orb's own "leash follow" can physically move it —
// the drag itself is tracked over the full ring radius (up to OUTER_RADIUS)
// for hover-matching, but the button visibly drifting that far would read
// as broken rather than liquid. This keeps the leash to a believable nudge
// while LiquidOrbButton's internal tail/stretch still scales with the full
// drag distance.
const LEASH_MAX = 26;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function ringPositions(count, radius, sweep, offsetDeg = 0) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angleFromUp = -sweep / 2 + t * sweep + offsetDeg;
    const theta = (angleFromUp * Math.PI) / 180;
    positions.push({
      x: radius * Math.sin(theta),
      y: -radius * Math.cos(theta),
      angle: angleFromUp,
    });
  }
  return positions;
}

function buildLayout(items) {
  const inner = items.slice(0, 7);
  const outer = items.slice(7);
  const innerPos = ringPositions(inner.length, INNER_RADIUS, SWEEP_DEG, 0);
  // outer ring staggered by half a step so chips don't sit on the same
  // radial line as the inner ring directly behind them
  const outerPos = ringPositions(outer.length, OUTER_RADIUS, SWEEP_DEG, SWEEP_DEG / (outer.length * 2));
  return [
    ...inner.map((item, i) => ({ ...item, ...innerPos[i] })),
    ...outer.map((item, i) => ({ ...item, ...outerPos[i] })),
  ];
}

const LAYOUT = buildLayout(RADIAL_ITEMS);

/**
 * RadialDialMenu — bottom-center dial. Press and hold the circle,
 * drag toward an item, release over it to select. Purely presentational:
 * fires onSelect(item) and does no navigation itself, so it can be
 * dropped into the isolated test route first and wired into the real
 * dashboard in Step 7 unchanged.
 */
export default function RadialDialMenu({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [orbPulse, setOrbPulse] = useState(null);
  // Raw pointer offset from the orb's own center, fed straight into
  // LiquidOrbButton's `pull` prop for the drag-follow tail/mass-shift, and
  // also used (scaled down) to give the whole button a small elastic
  // leash-follow via framer-motion below — snaps back with a spring the
  // instant this resets to {0,0} on release.
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const circleRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0 });

  const nearestItem = useCallback((px, py) => {
    let best = null;
    let bestDist = Infinity;
    for (const item of LAYOUT) {
      const ix = originRef.current.x + item.x;
      const iy = originRef.current.y + item.y;
      const d = Math.hypot(px - ix, py - iy);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }, []);

  const handlePointerDown = (e) => {
    const rect = circleRef.current.getBoundingClientRect();
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setOpen(true);
    setHoverId(null);
    setOrbPulse({ key: Date.now(), variant: "press" });
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  const handlePointerMove = (e) => {
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    // Liquid follow tracks the full raw drag every move — independent of
    // the menu's own DEADZONE below, so the orb already starts stretching
    // toward the finger before the menu itself commits to a hover target.
    setPull({ x: dx, y: dy });
    if (dist < DEADZONE) {
      setHoverId(null);
      return;
    }
    const item = nearestItem(e.clientX, e.clientY);
    setHoverId(item ? item.id : null);
  };

  const handlePointerUp = (e) => {
    window.removeEventListener("pointermove", handlePointerMove);
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    setPull({ x: 0, y: 0 });
    if (dist < DEADZONE) {
      // released back near the circle — cancel, no selection
      setOpen(false);
      setHoverId(null);
      return;
    }
    const item = nearestItem(e.clientX, e.clientY);
    if (item) {
      setConfirmId(item.id);
      setOrbPulse({ key: Date.now(), variant: "confirm" });
      setTimeout(() => {
        onSelect && onSelect(item);
        setOpen(false);
        setHoverId(null);
        setConfirmId(null);
      }, 180);
    } else {
      setOpen(false);
      setHoverId(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        justifyContent: "center",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {LAYOUT.map((item) => {
              const isHover = hoverId === item.id;
              const isConfirm = confirmId === item.id;
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                  animate={{
                    x: item.x,
                    y: item.y,
                    opacity: confirmId && !isConfirm ? 0 : 1,
                    scale: isConfirm ? 1.28 : isHover ? 1.16 : 1,
                  }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: CIRCLE_SIZE / 2 + 4,
                    width: CHIP_SIZE,
                    height: CHIP_SIZE,
                    marginLeft: -CHIP_SIZE / 2,
                    borderRadius: "50%",
                    background: isHover || isConfirm ? "#fca311" : "#fffcf2",
                    color: isHover || isConfirm ? "#fff" : CIRCLE_COLOR,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                  }}
                >
                  <Icon size={22} />
                  <span
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: CIRCLE_COLOR,
                      background: "#fffcf2",
                      padding: "2px 6px",
                      borderRadius: 6,
                      whiteSpace: "nowrap",
                      opacity: isHover || isConfirm ? 1 : 0,
                      transition: "opacity 120ms",
                      pointerEvents: "none",
                    }}
                  >
                    {item.label}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={circleRef}
        onPointerDown={handlePointerDown}
        animate={{
          scale: open ? 1.08 : 1,
          x: clamp(pull.x * 0.22, -LEASH_MAX, LEASH_MAX),
          y: clamp(pull.y * 0.22, -LEASH_MAX, LEASH_MAX),
        }}
        transition={{
          scale: { type: "spring", stiffness: 400, damping: 24 },
          // Snappier while actively being dragged so the orb feels
          // "leashed" to the finger with barely any lag; springs back with
          // a soft overshoot the moment pull resets to {0,0} on release —
          // that overshoot is what reads as elastic/liquid rather than a
          // rigid disc just re-centering.
          x: open ? { type: "spring", stiffness: 900, damping: 26 } : { type: "spring", stiffness: 260, damping: 14 },
          y: open ? { type: "spring", stiffness: 900, damping: 26 } : { type: "spring", stiffness: 260, damping: 14 },
        }}
        style={{
          pointerEvents: "auto",
          touchAction: "none",
          position: "relative",
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: "50%",
          background: CIRCLE_COLOR, // fallback paint while LiquidOrbButton's layers mount
          border: "none",
          overflow: "hidden",
          boxShadow: open
            ? "0 0 0 8px rgba(30,150,160,0.18)"
            : "0 3px 14px rgba(6,20,28,0.45)",
          zIndex: 61,
        }}
        aria-label="Open navigation dial"
      >
        <LiquidOrbButton size={CIRCLE_SIZE} active={open} pulse={orbPulse} pull={{ dx: pull.x, dy: pull.y }} />
      </motion.button>
    </div>
  );
}
