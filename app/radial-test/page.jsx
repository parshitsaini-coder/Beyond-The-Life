"use client";

import { useState } from "react";
import { ChevronLeft, UserCircle2 } from "lucide-react";
import RadialDialMenu, { BTL_RADIAL_ITEMS } from "@/components/RadialDialMenu";

// Temporary isolated route to visually verify the radial dial before it
// gets wired into BTLDashboard.jsx (Step 7). Safe to delete once approved.
export default function RadialTestPage() {
  const [lastSelected, setLastSelected] = useState(null);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#c0d6df",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Top bar — Back (left) + Profile (right) only, per Step 5 target shape */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
        }}
      >
        <button
          type="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={22} color="#403d39" />
        </button>
        <button
          type="button"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UserCircle2 size={24} color="#403d39" />
        </button>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 40,
          color: "#403d39",
          fontSize: 13,
          fontWeight: 600,
          opacity: 0.7,
          padding: "0 24px",
        }}
      >
        Press &amp; hold the circle below, drag toward an item, release to
        open it.
        {lastSelected && (
          <div style={{ marginTop: 10, fontSize: 15 }}>
            Last selected: <b>{lastSelected}</b>
          </div>
        )}
      </div>

      <RadialDialMenu
        items={BTL_RADIAL_ITEMS}
        onSelect={(key) => {
          const item = BTL_RADIAL_ITEMS.find((i) => i.key === key);
          setLastSelected(item?.label || key);
        }}
      />
    </div>
  );
}
