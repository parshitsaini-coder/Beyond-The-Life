"use client";
import { Target } from "lucide-react";

/* Orphaned control (Step 5 decision): Focus Mode isn't one of the 15
   radial items, so it gets its own small floating button instead of a
   home inside a panel. Positioned above-left of the dial so it never
   overlaps the press-hold circle or the fan-out zone. */
export default function FocusModeFab({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Focus Mode"
      aria-pressed={active}
      style={{
        position: "fixed",
        left: 20,
        bottom: "calc(28px + env(safe-area-inset-bottom, 0px))",
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "none",
        background: active ? "#fca311" : "#fffcf2",
        color: active ? "#fff" : "#403d39",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        zIndex: 59,
      }}
    >
      <Target size={20} />
    </button>
  );
}
