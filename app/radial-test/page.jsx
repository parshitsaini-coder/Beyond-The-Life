"use client";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import RadialDialMenu from "@/components/RadialDialMenu";
import RadialPanel from "@/components/RadialPanel";

/* Temporary isolated route — visit /radial-test to try the full flow:
   press-hold -> drag -> release -> panel emerges from the circle ->
   Back collapses it away. Safe to delete once confirmed; nothing in
   BTLDashboard.jsx is touched by this route. */
export default function RadialTestPage() {
  const [activeItem, setActiveItem] = useState(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#c0d6df",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 48,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: "0 24px", color: "#403d39" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Radial dial test — Step 4
        </h1>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Press and hold the circle, drag to an item, release to open its
          panel. Tap the back arrow inside the panel to close it.
        </p>
      </div>

      <RadialDialMenu onSelect={(item) => setActiveItem(item)} />

      <AnimatePresence>
        {activeItem && (
          <RadialPanel
            key={activeItem.id}
            title={activeItem.label}
            onClose={() => setActiveItem(null)}
          >
            <div style={{ paddingTop: 24, color: "#403d39" }}>
              <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
                Placeholder body — Step 7 replaces this with the real{" "}
                {activeItem.kind === "widget"
                  ? "widget content, promoted to its own full-screen panel"
                  : activeItem.kind === "tab"
                  ? "tab content (already a full screen today)"
                  : "modal content (already an overlay today)"}
                .
              </p>
              <div
                style={{
                  height: 400,
                  borderRadius: 12,
                  background: "#fffcf2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: "#403d39",
                  opacity: 0.5,
                }}
              >
                {activeItem.label} content goes here
              </div>
            </div>
          </RadialPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
