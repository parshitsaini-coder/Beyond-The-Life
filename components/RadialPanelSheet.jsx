"use client";

import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

/**
 * Full-screen panel that visually "emerges" from a screen point (the item
 * that was just selected on the radial dial) and retreats back into that
 * same point on close. Works via an expanding/collapsing circular clip-path
 * centered on `origin`, so it reads as the panel growing out of the icon
 * rather than a generic slide/fade.
 *
 * Usage:
 *   {openPanel && (
 *     <AnimatePresence>
 *       <RadialPanelSheet origin={openPanel.origin} title={openPanel.label} onClose={...}>
 *         ...panel content...
 *       </RadialPanelSheet>
 *     </AnimatePresence>
 *   )}
 */
export default function RadialPanelSheet({
  origin,
  title,
  onClose,
  children,
  bg = "#f7f3e9",
  accent = "#403d39",
}) {
  const safeOrigin = origin || { x: 0, y: 0 };
  const clipClosed = `circle(0% at ${safeOrigin.x}px ${safeOrigin.y}px)`;
  const clipOpen = `circle(150% at ${safeOrigin.x}px ${safeOrigin.y}px)`;

  return (
    <motion.div
      initial={{ clipPath: clipClosed, opacity: 0.5 }}
      animate={{ clipPath: clipOpen, opacity: 1 }}
      exit={{ clipPath: clipClosed, opacity: 0.5 }}
      transition={{ type: "spring", damping: 1, duration: 0.5 }}
      style={{
        position: "fixed",
        inset: 0,
        background: bg,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        willChange: "clip-path",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(14px + env(safe-area-inset-top, 0px)) 16px 10px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "rgba(64,61,57,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={22} color={accent} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 17, color: accent }}>
          {title}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 24px" }}>
        {children}
      </div>
    </motion.div>
  );
}
