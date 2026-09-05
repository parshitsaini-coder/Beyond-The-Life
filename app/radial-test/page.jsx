"use client";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import RadialDialMenu from "@/components/RadialDialMenu";
import RadialPanel from "@/components/RadialPanel";
import MobileTopBar from "@/components/MobileTopBar";
import FocusModeFab from "@/components/FocusModeFab";
import StatusStrip from "@/components/StatusStrip";

/* Temporary isolated route — visit /radial-test. Nothing in
   BTLDashboard.jsx is touched by this route; Step 7 ports this into
   the real dashboard behind a mobile-only breakpoint. */
export default function RadialTestPage() {
  const [activeItem, setActiveItem] = useState(null);
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#c0d6df",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <MobileTopBar onBack={() => {}} onProfile={() => {}} />
      <StatusStrip streak={12} daily={65} extry={40} overall={52} timeTable={30} />

      <div style={{ textAlign: "center", padding: "12px 24px 0", color: "#403d39" }}>
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          Press and hold the circle, drag to an item, release to open its
          panel. Focus button bottom-left is the orphaned control from
          Step 5.
        </p>
      </div>

      <FocusModeFab active={focusMode} onToggle={() => setFocusMode((v) => !v)} />
      <RadialDialMenu onSelect={(item) => setActiveItem(item)} />

      <AnimatePresence>
        {activeItem && (
          <RadialPanel
            key={activeItem.id}
            onClose={() => setActiveItem(null)}
            onProfile={() => {}}
          >
            <div style={{ paddingTop: 24, color: "#403d39" }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                {activeItem.label}
              </h2>
              <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
                Placeholder body — Step 7 replaces this with the real{" "}
                {activeItem.kind === "widget"
                  ? "widget content, promoted to its own full-screen panel"
                  : activeItem.kind === "tab"
                  ? "tab content (already a full screen today)"
                  : "modal content (already an overlay today)"}
                . Note the top bar here is Back + Profile only — the
                heading above is part of the panel body, not the bar.
              </p>
              <div
                style={{
                  height: 360,
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
