"use client";
import { useState } from "react";
import RadialDialMenu from "@/components/RadialDialMenu";

/* Temporary isolated route — visit /radial-test to try the press-hold
   -> drag -> release gesture on its own, before it's wired into the
   real BTLDashboard in Step 7. Safe to delete once confirmed. */
export default function RadialTestPage() {
  const [lastSelected, setLastSelected] = useState(null);

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
          Radial dial test
        </h1>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Press and hold the circle at the bottom, drag toward an item,
          release to select. Releasing near the circle cancels.
        </p>
        <p style={{ marginTop: 24, fontSize: 15, fontWeight: 600 }}>
          Last selected:{" "}
          <span style={{ color: "#fca311" }}>{lastSelected || "—"}</span>
        </p>
      </div>

      <RadialDialMenu onSelect={(item) => setLastSelected(item.label)} />
    </div>
  );
}
