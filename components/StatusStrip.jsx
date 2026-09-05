"use client";
import { Flame } from "lucide-react";

/* Orphaned control (Step 5 decision): streak + the 4 status rings
   (Daily/Extry/Overall/Time Table %) aren't nav destinations, so they
   get a slim read-only strip under the top bar instead of disappearing.
   Real percentages come from `state` in Step 7 — this takes plain
   numbers so it can be exercised in the isolated test route too. */
export default function StatusStrip({ streak, daily, extry, overall, timeTable }) {
  const rings = [
    { label: "Daily", pct: daily, color: "#fca311" },
    { label: "Extry", pct: extry, color: "#98c1d9" },
    { label: "Overall", pct: overall, color: "#403d39" },
    { label: "Time", pct: timeTable, color: "#8a6fd6" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "0 16px 10px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          background: "#403d39",
          color: "#fffcf2",
          borderRadius: 999,
          padding: "4px 9px",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        <Flame size={12} />
        {streak}
      </div>
      {rings.map((r) => (
        <div key={r.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <svg width={30} height={30} viewBox="0 0 30 30">
            <circle cx="15" cy="15" r="12" fill="none" stroke="#ffffff80" strokeWidth="3" />
            <circle
              cx="15" cy="15" r="12" fill="none" stroke={r.color} strokeWidth="3"
              strokeDasharray={`${(r.pct / 100) * 75.4} 75.4`}
              strokeLinecap="round"
              transform="rotate(-90 15 15)"
            />
            <text x="15" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#403d39">
              {Math.round(r.pct)}
            </text>
          </svg>
          <span style={{ fontSize: 9, color: "#403d39", fontWeight: 600 }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}
