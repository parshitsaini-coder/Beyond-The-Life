"use client";
import { motion, AnimatePresence } from "framer-motion";
import MobileTopBar from "./MobileTopBar";

/* ---------------- Step 4 — Panel open/close transition ----------------
   One shared wrapper so all 15 panels animate identically. The panel
   scales/slides up from the dial's position at the bottom of the
   screen (transformOrigin: bottom center) while fading in, and reverses
   the same way on close — the "emerging from the circle" feel the spec
   asked for, without needing a literal shared-element layoutId per
   panel (15 different panel bodies, one shared open/close motion is
   simpler to keep consistent and cheaper to maintain).

   Step 5 update: top bar is now the shared MobileTopBar (Back + Profile
   only, per spec's "nothing else") instead of a Back + title row — any
   heading a panel needs now lives inside its own body content.

   Usage (Step 7 will do this for real, test route does it now):
     <AnimatePresence>
       {activePanel && (
         <RadialPanel key={activePanel.id} onClose={...} onProfile={...}>
           ...panel content, including its own heading if it needs one...
         </RadialPanel>
       )}
     </AnimatePresence>
*/

const OPEN_TRANSITION = { duration: 0.32, ease: [0.16, 1, 0.3, 1] }; // easeOutExpo-ish — quick then settles
const CLOSE_TRANSITION = { duration: 0.24, ease: [0.7, 0, 0.84, 0] }; // snappier collapse back to the circle

// variants carry their own `transition`, which is how framer-motion is
// told to use OPEN_TRANSITION going in but CLOSE_TRANSITION coming out —
// a single shared `transition` prop can't express that asymmetry.
const backdropVariants = {
  initial: { opacity: 0, transition: OPEN_TRANSITION },
  animate: { opacity: 1, transition: OPEN_TRANSITION },
  exit: { opacity: 0, transition: CLOSE_TRANSITION },
};

const panelVariants = {
  initial: { opacity: 0, scale: 0.18, y: 120, transition: OPEN_TRANSITION },
  animate: { opacity: 1, scale: 1, y: 0, transition: OPEN_TRANSITION },
  exit: { opacity: 0, scale: 0.18, y: 120, transition: CLOSE_TRANSITION },
};

export default function RadialPanel({ onClose, onProfile, profilePhotoUrl, children }) {
  return (
    <>
      {/* Backdrop dims in/out with the panel */}
      <motion.div
        variants={backdropVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          position: "fixed",
          inset: 0,
          background: "#c0d6df",
          zIndex: 70,
        }}
      />
      <motion.div
        variants={panelVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          transformOrigin: "50% 100%",
          position: "fixed",
          inset: 0,
          zIndex: 71,
          display: "flex",
          flexDirection: "column",
          background: "#c0d6df",
        }}
      >
        <MobileTopBar onBack={onClose} onProfile={onProfile} profilePhotoUrl={profilePhotoUrl} />

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}

/* Exit-only override for the exit transition, since framer-motion reads
   `transition` for both directions unless we pass different config per
   variant — kept as a named export in case Step 7 needs the raw curves
   (e.g. to match a manual close-drag gesture later). */
export const RADIAL_PANEL_TRANSITIONS = { OPEN_TRANSITION, CLOSE_TRANSITION };
