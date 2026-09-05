"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ListChecks,
  Target,
  AlarmClock,
  BookOpenCheck,
  Timer,
  CalendarClock,
  Calendar,
  Image as ImageIcon,
  Pencil,
  Dumbbell,
  Settings as SettingsIcon,
  PartyPopper,
  BarChart3,
  Share2,
} from "lucide-react";

// ---- Step 3 (icon + label mapping) folded in here since the list is fixed
// by spec — exported so BTLDashboard.jsx can reuse the same keys when this
// gets wired in (Step 7). Order here IS the sweep order around the arc.
export const BTL_RADIAL_ITEMS = [
  { key: "dailyGoals", label: "Daily Goal", Icon: CheckCircle2 },
  { key: "extryGoals", label: "Entry Goals", Icon: ListChecks },
  { key: "bigGoals", label: "Life Big Goals", Icon: Target },
  { key: "clock", label: "Clock & Alarm", Icon: AlarmClock },
  { key: "lifeRules", label: "Life Rules", Icon: BookOpenCheck },
  { key: "focusTimer", label: "Timer", Icon: Timer },
  { key: "timeTable", label: "Time Table", Icon: CalendarClock },
  { key: "calendar", label: "Calendar", Icon: Calendar },
  { key: "memory", label: "Memory", Icon: ImageIcon },
  { key: "lifeStory", label: "Life Story", Icon: Pencil },
  { key: "fitness", label: "Fitness", Icon: Dumbbell },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
  { key: "friendCelebration", label: "Friend Celebration", Icon: PartyPopper },
  { key: "analytics", label: "Analytics", Icon: BarChart3 },
  { key: "shareJournal", label: "Share Journal", Icon: Share2 },
];

const CIRCLE_COLOR = "#403d39";
const ARC_SPAN_DEG = 190; // total sweep, centered straight up (0deg = up)
const RING_INNER = 108;
const RING_OUTER = 178;
const MIN_DRAG_PX = 22; // ignore angle until finger has moved this far from center
const ITEM_SIZE = 50;

function angleFor(index, total) {
  const start = -ARC_SPAN_DEG / 2;
  const step = total > 1 ? ARC_SPAN_DEG / (total - 1) : 0;
  return start + step * index;
}

function polarToXY(deg, radius) {
  const rad = (deg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

/**
 * Press-and-hold-drag radial dial menu.
 * Renders its OWN fixed-position circle + fan-out items — drop it once,
 * near the bottom of the screen, and it handles the rest.
 *
 * Usage: <RadialDialMenu items={BTL_RADIAL_ITEMS} onSelect={(key) => ...} />
 */
export default function RadialDialMenu({
  items = BTL_RADIAL_ITEMS,
  onSelect,
  circleColor = CIRCLE_COLOR,
  disabled = false,
  // Distance of the dial's center from the bottom of the screen — any CSS
  // length works ("40px", "34vh", "38%"). Defaults to a thumb-reach bottom
  // position; pass something like "34vh" to float it mid-screen instead.
  anchorBottom = "40px",
}) {
  const anchorCalc = `calc(${anchorBottom} + env(safe-area-inset-bottom, 0px))`;
  const labelCalc = `calc(${anchorBottom} + ${RING_OUTER + 90}px + env(safe-area-inset-bottom, 0px))`;
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);

  const circleRef = useRef(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const laidOut = items.map((it, i) => {
    const deg = angleFor(i, items.length);
    const radius = i % 2 === 0 ? RING_OUTER : RING_INNER;
    const { x, y } = polarToXY(deg, radius);
    return { ...it, deg, radius, x, y };
  });

  const resolveActive = useCallback(
    (clientX, clientY) => {
      const { x: cx, y: cy } = centerRef.current;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < MIN_DRAG_PX) return null;
      // screen-degrees where 0 = straight up, clockwise positive
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const half = ARC_SPAN_DEG / 2;
      if (deg < -half) deg = -half;
      if (deg > half) deg = half;
      let best = null;
      let bestDelta = Infinity;
      for (const it of laidOut) {
        const delta = Math.abs(it.deg - deg);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = it;
        }
      }
      return best ? best.key : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  const handlePointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    const rect = circleRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    circleRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setPressed(true);
    setOpen(true);
    setActiveKey(null);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const key = resolveActive(e.clientX, e.clientY);
    setActiveKey(key);
  };

  const finishGesture = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setPressed(false);
    try {
      circleRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* no-op: capture may already be gone */
    }
    if (activeKey) {
      const chosen = activeKey;
      const chosenItem = laidOut.find((it) => it.key === chosen);
      // Absolute screen point of the confirmed item's icon — passed along so
      // the panel that opens next can visually "emerge" from this exact spot
      // (Step 4) instead of appearing from nowhere.
      const origin = chosenItem
        ? { x: centerRef.current.x + chosenItem.x, y: centerRef.current.y + chosenItem.y }
        : { ...centerRef.current };
      setConfirmKey(chosen);
      setActiveKey(null);
      window.setTimeout(() => {
        setOpen(false);
        setConfirmKey(null);
        onSelect?.(chosen, origin);
      }, 170);
    } else {
      setOpen(false);
    }
  };

  // Escape-to-close, for desktop/dev convenience while this lives on its
  // own test route.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        draggingRef.current = false;
        setPressed(false);
        setActiveKey(null);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const activeItem = laidOut.find((it) => it.key === (activeKey || confirmKey));

  return (
    <>
      {/* Backdrop — dims whatever is behind the dial while it's open */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(20,22,20,0.30)",
              backdropFilter: "blur(2px)",
              zIndex: 40,
              touchAction: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Currently-targeted item label */}
      <AnimatePresence>
        {open && activeItem && (
          <motion.div
            key="label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "fixed",
              left: "50%",
              bottom: labelCalc,
              transform: "translateX(-50%)",
              zIndex: 55,
              background: "#fff",
              color: circleColor,
              fontWeight: 700,
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: 999,
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {activeItem.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fan-out items */}
      <AnimatePresence>
        {open &&
          laidOut.map((it, i) => {
            const isActive = it.key === (activeKey || confirmKey);
            const Icon = it.Icon;
            return (
              <motion.div
                key={it.key}
                initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                animate={{
                  opacity: 1,
                  scale: isActive ? 1.2 : 1,
                  x: it.x,
                  y: it.y,
                }}
                exit={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
                transition={{
                  type: "spring",
                  damping: 1,
                  duration: 0.4,
                  delay: draggingRef.current ? 0 : i * 0.012,
                }}
                style={{
                  position: "fixed",
                  left: "50%",
                  bottom: anchorCalc,
                  width: ITEM_SIZE,
                  height: ITEM_SIZE,
                  marginLeft: -ITEM_SIZE / 2,
                  marginBottom: -ITEM_SIZE / 2,
                  zIndex: 50,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isActive ? "#f5efe4" : "#ffffff",
                  color: circleColor,
                  boxShadow: isActive
                    ? "0 6px 18px rgba(0,0,0,0.28)"
                    : "0 3px 10px rgba(0,0,0,0.18)",
                  pointerEvents: "none", // selection is resolved by drag angle, not hover/click
                }}
              >
                <Icon size={22} strokeWidth={2.2} />
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* Center dial */}
      <motion.button
        ref={circleRef}
        type="button"
        aria-label="Open menu"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        animate={{ scale: pressed ? 0.92 : 1 }}
        transition={{ type: "spring", damping: 1, duration: 0.25 }}
        style={{
          position: "fixed",
          left: "50%",
          bottom: anchorCalc,
          transform: "translateX(-50%)",
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: circleColor,
          border: "none",
          zIndex: 60,
          boxShadow: open
            ? "0 0 0 8px rgba(64,61,57,0.16)"
            : "0 4px 16px rgba(0,0,0,0.28)",
          touchAction: "none",
          cursor: "pointer",
        }}
      />
    </>
  );
}
