"use client";
import { useRef, useState, useCallback, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, ListChecks, Trophy, AlarmClock, ShieldCheck, Timer,
  CalendarClock, CalendarDays, Camera, BookOpen, Dumbbell, Settings,
  PartyPopper, BarChart3, Share2, Wallet, Droplets,
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
  { id: "water", label: "Drink Water", icon: Droplets, kind: "widget" },
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

/* One dial chip. Memoized so a hover change only re-renders the two chips
   whose state actually changed (not all 13) — and the pointer-move work is
   batched to one update per animation frame below, which is what keeps the
   drag buttery on phones. The hovered/confirmed chip gets a higher z-index
   so its scale-up never gets painted under a neighbour. */
const DialChip = memo(function DialChip({ item, isHover, isConfirm, dimmed, index }) {
  const Icon = item.icon;
  const hot = isHover || isConfirm;
  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
      animate={{
        x: item.x,
        y: item.y,
        opacity: dimmed ? 0 : 1,
        scale: isConfirm ? 1.28 : isHover ? 1.16 : 1,
      }}
      exit={{ x: 0, y: 0, opacity: 0, scale: 0.3, transition: { type: "spring", stiffness: 520, damping: 34 } }}
      transition={{
        type: "spring", stiffness: 420, damping: 30, mass: 0.8,
        // gentle fan-out stagger on open only; hover/confirm changes stay instant
        delay: isHover || isConfirm || dimmed ? 0 : Math.min(index, 12) * 0.008,
      }}
      style={{
        position: "absolute",
        left: "50%",
        bottom: CIRCLE_SIZE / 2 + 4,
        width: CHIP_SIZE,
        height: CHIP_SIZE,
        marginLeft: -CHIP_SIZE / 2,
        borderRadius: "50%",
        background: hot ? "#fca311" : "#fffcf2",
        color: hot ? "#fff" : CIRCLE_COLOR,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        zIndex: hot ? 20 : 1,
        willChange: "transform, opacity",
        transition: "background-color 120ms, color 120ms",
      }}
    >
      <Icon size={22} />
    </motion.div>
  );
});

/* The hovered item's name. It lives on its OWN top layer (zIndex above every
   chip) and sits just outside the chip, pushed away from the orb, so no
   neighbouring chip can paint over it any more — and it is clamped to the
   screen so labels on the far-left/right chips are never cut off. */
function DialLabel({ item }) {
  const len = Math.hypot(item.x, item.y) || 1;
  const ux = item.x / len;
  const uy = item.y / len;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const half = (item.label.length * 6.6 + 26) / 2;
  let lx = item.x + ux * (CHIP_SIZE / 2 + 22);
  let ly = item.y + uy * (CHIP_SIZE / 2 + 18) - 6;
  const maxX = vw / 2 - half - 8;
  const clampedX = clamp(lx, -maxX, maxX);
  if (clampedX !== lx) ly -= CHIP_SIZE / 2 + 6; // was pushed back over its chip → lift it clear
  lx = clampedX;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: CIRCLE_SIZE / 2 + 4 + CHIP_SIZE / 2,
        width: 0,
        height: 0,
        transform: `translate(${lx}px, ${ly}px)`,
        zIndex: 80,
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)" }}>
        <motion.span
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: "#fffcf2",
            background: "rgba(37,36,34,0.94)",
            padding: "5px 11px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            willChange: "transform, opacity",
          }}
        >
          {item.label}
        </motion.span>
      </div>
    </div>
  );
}

/**
 * RadialDialMenu — bottom-center dial. Press and hold the circle,
 * drag toward an item, release over it to select. Purely presentational:
 * fires onSelect(item) and does no navigation itself.
 *
 * Smoothness (this update): pointermove is coalesced to one update per
 * animation frame, chips are memoized, only transform/opacity animate, and
 * the layer is hinted to the compositor — so dragging stays at the screen's
 * refresh rate instead of re-rendering the whole dial on every raw event.
 */
export default function RadialDialMenu({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [orbPulse, setOrbPulse] = useState(null);
  // Offset of the finger from the orb's centre — drives the orb's elastic
  // leash and LiquidOrbButton's tail. Updated at most once per frame.
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const circleRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const lastPtRef = useRef(null);
  const hoverRef = useRef(null);
  const pullRef = useRef({ x: 0, y: 0 });

  const nearestItem = useCallback((px, py) => {
    let best = null;
    let bestDist = Infinity;
    for (const item of LAYOUT) {
      const d = Math.hypot(px - (originRef.current.x + item.x), py - (originRef.current.y + item.y));
      if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
  }, []);

  const applyHover = useCallback((id) => {
    if (hoverRef.current === id) return;
    hoverRef.current = id;
    setHoverId(id);
    if (id) { try { navigator.vibrate && navigator.vibrate(6); } catch (e) { /* no haptics */ } }
  }, []);

  const processMove = useCallback(() => {
    rafRef.current = 0;
    const p = lastPtRef.current;
    if (!p) return;
    const dx = p.x - originRef.current.x;
    const dy = p.y - originRef.current.y;
    if (Math.abs(dx - pullRef.current.x) >= 0.5 || Math.abs(dy - pullRef.current.y) >= 0.5) {
      pullRef.current = { x: dx, y: dy };
      setPull(pullRef.current);
    }
    if (Math.hypot(dx, dy) < DEADZONE) { applyHover(null); return; }
    const item = nearestItem(p.x, p.y);
    applyHover(item ? item.id : null);
  }, [applyHover, nearestItem]);

  const stopTracking = useCallback((onMove, onUp, onCancel) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const handlePointerDown = (e) => {
    const rect = circleRef.current.getBoundingClientRect();
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    lastPtRef.current = { x: e.clientX, y: e.clientY };
    pullRef.current = { x: 0, y: 0 };
    hoverRef.current = null;
    setOpen(true);
    setHoverId(null);
    setOrbPulse({ key: Date.now(), variant: "press" });

    const onMove = (ev) => {
      lastPtRef.current = { x: ev.clientX, y: ev.clientY };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(processMove);
    };
    const onUp = (ev) => {
      stopTracking(onMove, onUp, onCancel);
      const dx = ev.clientX - originRef.current.x;
      const dy = ev.clientY - originRef.current.y;
      pullRef.current = { x: 0, y: 0 };
      setPull({ x: 0, y: 0 });
      hoverRef.current = null;
      if (Math.hypot(dx, dy) < DEADZONE) { setOpen(false); setHoverId(null); return; }
      const item = nearestItem(ev.clientX, ev.clientY);
      if (item) {
        setConfirmId(item.id);
        setHoverId(null);
        setOrbPulse({ key: Date.now(), variant: "confirm" });
        setTimeout(() => {
          onSelect && onSelect(item);
          setOpen(false);
          setConfirmId(null);
        }, 180);
      } else {
        setOpen(false);
        setHoverId(null);
      }
    };
    const onCancel = () => { // e.g. the browser took over the touch — never leave the dial stuck open
      stopTracking(onMove, onUp, onCancel);
      pullRef.current = { x: 0, y: 0 };
      hoverRef.current = null;
      setPull({ x: 0, y: 0 });
      setOpen(false);
      setHoverId(null);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const labelItem = LAYOUT.find((i) => i.id === (confirmId || hoverId)) || null;

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
            transition={{ duration: 0.12 }}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", willChange: "opacity" }}
          >
            {LAYOUT.map((item, index) => (
              <DialChip
                key={item.id}
                item={item}
                index={index}
                isHover={hoverId === item.id}
                isConfirm={confirmId === item.id}
                dimmed={!!confirmId && confirmId !== item.id}
              />
            ))}
            {labelItem && <DialLabel key={labelItem.id} item={labelItem} />}
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
          // tight while dragging (finger-locked), soft elastic overshoot on release
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
          willChange: "transform",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        aria-label="Open navigation dial"
      >
        <LiquidOrbButton size={CIRCLE_SIZE} active={open} pulse={orbPulse} pull={{ dx: pull.x, dy: pull.y }} />
      </motion.button>
    </div>
  );
}
