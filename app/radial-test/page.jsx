"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { UserCircle2, BarChart3, Wallet } from "lucide-react";
import RadialDialMenu, { BTL_RADIAL_ITEMS } from "@/components/RadialDialMenu";
import RadialPanelSheet from "@/components/RadialPanelSheet";

// Temporary isolated route to visually verify the radial dial + panel
// open/close transition before either gets wired into BTLDashboard.jsx
// (Step 7). Safe to delete once approved.

function SummaryCard({ icon: Icon, title, subtitle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(255,255,255,0.55)",
        borderRadius: 12,
        padding: "14px 16px",
        border: "1px solid rgba(64,61,57,0.12)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#403d39",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} color="#c0d6df" />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#403d39" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#403d39", opacity: 0.65 }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

export default function RadialTestPage() {
  const [openPanel, setOpenPanel] = useState(null); // { key, label, origin } | null

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
      {/* Top bar — profile icon only, top-right (home view has no Back) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "calc(14px + env(safe-area-inset-top, 0px)) 16px 6px",
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
          <UserCircle2 size={24} color="#403d39" />
        </button>
      </div>

      {/* Top summary widgets — always-visible glance cards on the home view */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "6px 16px 0",
        }}
      >
        <SummaryCard icon={BarChart3} title="Analytics Summary" subtitle="Your progress at a glance" />
        <SummaryCard icon={Wallet} title="Total Earn & Spend" subtitle="This month's money flow" />
      </div>

      <RadialDialMenu
        items={BTL_RADIAL_ITEMS}
        disabled={!!openPanel}
        anchorBottom="34vh"
        onSelect={(key, origin) => {
          const item = BTL_RADIAL_ITEMS.find((i) => i.key === key);
          setOpenPanel({ key, label: item?.label || key, origin });
        }}
      />

      <AnimatePresence>
        {openPanel && (
          <RadialPanelSheet
            key={openPanel.key}
            origin={openPanel.origin}
            title={openPanel.label}
            onClose={() => setOpenPanel(null)}
          >
            <p style={{ color: "#403d39", opacity: 0.75, lineHeight: 1.5 }}>
              Placeholder panel for <b>{openPanel.label}</b>. Once Part A is
              wired into the real dashboard (Step 7), this is where that
              panel's actual widget/content will render.
            </p>
          </RadialPanelSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
