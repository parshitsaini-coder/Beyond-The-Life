"use client";
/* ---------------- BTL LOADING SCREEN — "arrow hits the bullseye" ----------------
   Full-screen cinematic loading animation, built entirely with SVG + framer-motion
   (already a project dependency — no new installs needed):

     1. An arrow launches from off-screen and roams/wobbles across the ENTIRE
        screen — tumbling, looping, correcting course — exactly like it's
        searching for its mark.
     2. A glowing dashed trail draws itself behind the arrow as it flies.
     3. A breathing bullseye target sits center-screen the whole time, its
        rings pulsing gently as if "waiting" for the hit.
     4. On the final stretch the arrow snaps dead straight and slams into the
        bullseye — triggering a shockwave ring, a white flash, a spark burst,
        a "LOCKED ON" reticle snap, and a full-screen shake for real impact.
     5. Everything loops seamlessly (all timings share one period) for as
        long as the real app takes to load.

   Colors are passed in so this matches whichever theme is calling it; sane
   defaults match BTL's cream/charcoal/amber palette. */

import { motion } from "framer-motion";

// One shared "period" (seconds) that every phase locks to, so nothing ever
// drifts out of sync no matter how many loops play.
const FLIGHT = 2.4; // arrow roams + dives
const PAUSE = 1.0; // beat of stillness after impact before it resets
const PERIOD = FLIGHT + PAUSE;

// The arrow's full journey across the whole screen (viewBox 0 0 1000 600).
// It wobbles/loops through open space, then the last leg straightens hard
// into the bullseye at (500,300) for the "lock-on and BAM" moment.
const XK = [-80, 190, 640, 230, 430, 500];
const YK = [70, 460, 80, 300, 330, 300];
const RK = [22, -30, 155, 255, 345, 360]; // deliberate overshoot = tumble/spin
const SK = [1, 1, 1, 1, 1.12, 1.3]; // punches "toward camera" right at impact
const TK = [0, 0.3, 0.55, 0.75, 0.9, 1]; // keyframe times as fraction of FLIGHT

const timesToPeriod = (arr) => arr.map((t) => (t * FLIGHT) / PERIOD);

// Smooth-ish curve through the same waypoints, for the glowing trail.
const TRAIL_D = `M ${XK[0]} ${YK[0]}
  C ${XK[0] + 120} ${YK[0] + 180}, ${XK[1] - 100} ${YK[1] + 40}, ${XK[1]} ${YK[1]}
  C ${XK[1] + 160} ${YK[1] - 220}, ${XK[2] - 140} ${YK[2] + 40}, ${XK[2]} ${YK[2]}
  C ${XK[2] - 200} ${YK[2] + 60}, ${XK[3] + 120} ${YK[3] - 140}, ${XK[3]} ${YK[3]}
  C ${XK[3] + 90} ${YK[3] + 30}, ${XK[4] - 60} ${YK[4] - 30}, ${XK[4]} ${YK[4]}
  L ${XK[5]} ${YK[5]}`;

function Arrow({ size = 46, color = "#252422", tip = "#fca311" }) {
  // A hand-built archery arrow: fletching, shaft, head — pointing "right"
  // (0deg) so rotation keyframes read naturally.
  return (
    <g transform={`translate(${-size / 2},${-size / 10})`}>
      <rect x="0" y={size * 0.08} width={size * 0.62} height={size * 0.045} rx={size * 0.02} fill={color} />
      <path d={`M ${size * 0.02} ${size * 0.02} L ${size * 0.16} ${size * 0.105} L ${size * 0.02} ${size * 0.19} Z`} fill={color} opacity="0.85" />
      <path d={`M ${size * 0.02} ${size * 0.19} L ${size * 0.16} ${size * 0.105} L ${size * 0.02} ${size * 0.02} Z`} fill={color} opacity="0.55" transform={`translate(0, ${size * 0.03})`} />
      <path
        d={`M ${size * 0.6} ${size * -0.02} L ${size * 0.86} ${size * 0.105} L ${size * 0.6} ${size * 0.23} L ${size * 0.68} ${size * 0.105} Z`}
        fill={tip}
      />
    </g>
  );
}

export default function BTLLoadingScreen({
  label = "Loading BTL",
  bg = "#fffcf2",
  dark = "#252422",
  accent = "#fca311",
  ring = "#e8563c",
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: bg, display: "flex",
        alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 9999,
      }}
    >
      <motion.div
        // Whole-scene shake, timed to land exactly on impact each cycle.
        animate={{ x: [0, -6, 6, -4, 3, 0], y: [0, 4, -4, 2, -2, 0] }}
        transition={{ duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1], repeat: Infinity, repeatDelay: PERIOD - 0.4, delay: FLIGHT, ease: "easeOut" }}
        style={{ width: "100%", height: "100%", position: "relative" }}
      >
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <radialGradient id="btl-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="60%" stopColor={bg} stopOpacity="0" />
              <stop offset="100%" stopColor={dark} stopOpacity="0.08" />
            </radialGradient>
            <filter id="btl-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="0" y="0" width="1000" height="600" fill="url(#btl-vignette)" />

          {/* Glowing dashed trail that "draws" itself behind the arrow */}
          <motion.path
            d={TRAIL_D}
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 10"
            filter="url(#btl-glow)"
            animate={{ pathLength: [0, 1, 1, 1], opacity: [0, 0.6, 0.6, 0] }}
            transition={{
              duration: PERIOD, repeat: Infinity, ease: "linear",
              times: [0, FLIGHT / PERIOD, (FLIGHT + 0.15) / PERIOD, 1],
            }}
          />

          {/* Breathing bullseye, always waiting center-stage */}
          <motion.g
            animate={{ scale: [1, 1.045, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "500px 300px" }}
          >
            <circle cx="500" cy="300" r="72" fill={dark} />
            <circle cx="500" cy="300" r="58" fill={bg} />
            <circle cx="500" cy="300" r="44" fill={ring} />
            <circle cx="500" cy="300" r="30" fill={bg} />
            <circle cx="500" cy="300" r="16" fill={accent} />
          </motion.g>

          {/* Impact shockwave ring */}
          <motion.circle
            cx="500" cy="300" r="16" fill="none" stroke={accent} strokeWidth="4"
            initial={{ opacity: 0 }}
            animate={{ r: [16, 16, 95], opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.75, repeat: Infinity, repeatDelay: PERIOD - 0.75, delay: FLIGHT, ease: "easeOut" }}
          />
          <motion.circle
            cx="500" cy="300" r="16" fill="none" stroke={ring} strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={{ r: [16, 16, 130], opacity: [0, 0.7, 0] }}
            transition={{ duration: 0.95, repeat: Infinity, repeatDelay: PERIOD - 0.95, delay: FLIGHT + 0.05, ease: "easeOut" }}
          />

          {/* Impact flash */}
          <motion.circle
            cx="500" cy="300" r="40" fill="#fff"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1.3, 1.6] }}
            transition={{ duration: 0.35, repeat: Infinity, repeatDelay: PERIOD - 0.35, delay: FLIGHT, ease: "easeOut" }}
            style={{ transformOrigin: "500px 300px" }}
          />

          {/* Spark burst */}
          {Array.from({ length: 10 }, (_, i) => {
            const ang = (360 / 10) * i * (Math.PI / 180);
            const dist = 60 + (i % 3) * 18;
            return (
              <motion.circle
                key={i}
                cx="500" cy="300" r="3.5" fill={i % 2 ? accent : ring}
                initial={{ opacity: 0 }}
                animate={{
                  cx: [500, 500 + Math.cos(ang) * dist],
                  cy: [300, 300 + Math.sin(ang) * dist],
                  opacity: [0, 1, 0],
                  scale: [1, 0.3],
                }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: PERIOD - 0.6, delay: FLIGHT, ease: "easeOut" }}
              />
            );
          })}

          {/* Targeting reticle that snaps in tight right on impact — the
              "locked on" sci-fi beat */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 1, 0], scale: [2.2, 2.2, 1, 1, 0.85] }}
            transition={{
              duration: 0.6, repeat: Infinity, repeatDelay: PERIOD - 0.6, delay: FLIGHT - 0.15, ease: "easeOut",
              times: [0, 0.2, 0.55, 0.8, 1],
            }}
            style={{ transformOrigin: "500px 300px" }}
          >
            <circle cx="500" cy="300" r="52" fill="none" stroke="#e8563c" strokeWidth="2" strokeDasharray="10 6" />
            <line x1="500" y1="235" x2="500" y2="255" stroke="#e8563c" strokeWidth="3" />
            <line x1="500" y1="345" x2="500" y2="365" stroke="#e8563c" strokeWidth="3" />
            <line x1="435" y1="300" x2="455" y2="300" stroke="#e8563c" strokeWidth="3" />
            <line x1="545" y1="300" x2="565" y2="300" stroke="#e8563c" strokeWidth="3" />
          </motion.g>

          {/* Ghost energy-trail copy of the arrow (soft blurred duplicate) */}
          <motion.g
            filter="url(#btl-glow)"
            style={{ opacity: 0.35 }}
            animate={{ x: XK, y: YK, rotate: RK, scale: SK }}
            transition={{
              duration: PERIOD, repeat: Infinity, ease: "easeInOut",
              times: timesToPeriod(TK),
            }}
          >
            <Arrow size={50} color={accent} tip={ring} />
          </motion.g>

          {/* The arrow itself */}
          <motion.g
            animate={{ x: XK, y: YK, rotate: RK, scale: SK }}
            transition={{
              duration: PERIOD, repeat: Infinity, ease: "easeInOut",
              times: timesToPeriod(TK),
            }}
          >
            <Arrow size={46} color={dark} tip={accent} />
          </motion.g>
        </svg>

        {/* Caption */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: "18%", display: "flex",
          flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none",
        }}>
          <motion.div
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 15, color: dark, letterSpacing: 0.4 }}
          >
            {label}
            <motion.span
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, times: [0, 0.2, 0.8, 1] }}
            >…</motion.span>
          </motion.div>
          <div style={{ width: 140, height: 3, borderRadius: 999, background: `${dark}22`, overflow: "hidden" }}>
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: PERIOD, repeat: Infinity, ease: "linear" }}
              style={{ width: "50%", height: "100%", background: accent, borderRadius: 999 }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
