"use client";
import { ArrowLeft, User } from "lucide-react";

/* ---------------- Step 5 — Top bar replacement ----------------
   Mobile-only top bar: Back (left) + Profile (right), nothing else.
   Everything that used to live in the old header row (title pill,
   Goals/Money placeholders, Memory/Life Story/Fitness/Share/Settings/
   Friend buttons) is now reached through the radial dial instead —
   see RADIAL_ITEMS in RadialDialMenu.jsx.

   Orphaned controls (per your decisions):
   - Focus Mode toggle -> small floating button, rendered separately
     (see FocusModeFab below), not part of this bar
   - Streak + status rings -> slim strip rendered separately under
     this bar (see StatusStrip below), not part of this bar
   - "Goals" / Total Earn/Spend Money placeholders -> left out of the
     mobile layout for now, decide later

   onBack: when no panel is open, this can be a no-op or navigate to
   whatever "outside BTL" screen makes sense (Step 7 decides); when a
   panel is open, RadialPanel passes its own close handler here.
*/
export default function MobileTopBar({ onBack, onProfile, profilePhotoUrl }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "calc(10px + env(safe-area-inset-top, 0px)) 16px 10px",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "#403d39",
          color: "#fffcf2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowLeft size={19} />
      </button>

      <button
        onClick={onProfile}
        aria-label="Profile"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: "#403d39",
          color: "#fffcf2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: 0,
        }}
      >
        {profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profilePhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <User size={19} />
        )}
      </button>
    </div>
  );
}
