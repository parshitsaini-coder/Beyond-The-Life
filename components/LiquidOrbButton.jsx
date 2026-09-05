"use client";
import { useId, useMemo } from "react";
import { usePrefersReducedMotion, useIsCoarsePointer } from "@/components/LiquidBackground";

/* ============================================================
   LIQUID ORB BUTTON — the radial dial's center circle, restyled
   to match the reference: a glowing blue/teal 3D liquid blob that
   reacts to touch.
   ============================================================
   Reuses the SAME goo-merged border-radius-morph technique as
   LiquidBackground.jsx (already tuned for this app's mobile
   performance and accessibility rules) rather than pulling in a
   WebGL/Three.js engine for a single 76px button — a full 3D
   scene here would cost a persistent render loop on every mobile
   frame just for one button, competing with the drag-gesture
   tracking this same circle already does on pointermove. The
   flat SVG-filter blob technique gets the same "glowing liquid
   sphere" read at a fraction of the cost, and inherits the
   existing reduced-motion / coarse-pointer handling for free.

   Two purely visual states layer on top of the idle animation:
     - `active`  (press-and-hold in progress) — blobs brighten and
       pull in slightly, glow intensifies. Purely a style change,
       doesn't touch the drag-gesture logic in RadialDialMenu.jsx.
     - `pulse`   ({ key, variant }) — a one-shot radiating ring.
       variant "press" fires on pointerdown (soft, single ring);
       variant "confirm" fires the instant an item is selected
       (brighter double ring + flash) — the "reacts when you tap
       it" behaviour that was asked for. `key` must change every
       time (e.g. Date.now()) so React remounts the ring and the
       CSS animation restarts even if the same variant fires twice
       in a row.
   ============================================================ */

const ORB_HUES = ["46,181,204", "34,211,168", "56,142,230"]; // blue/teal RGB triples

export default function LiquidOrbButton({ size = 76, active = false, pulse = null }) {
  const gooId = useId();
  const reduced = usePrefersReducedMotion();
  const coarse = useIsCoarsePointer();

  // 3 blobs is enough to read as one morphing liquid mass at this size —
  // more just costs paint time without being visible under the goo blur.
  const blobDur = useMemo(() => [7, 9, 8], []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id={gooId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={coarse ? "5" : "6"} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" result="goo" />
          </filter>
        </defs>
      </svg>

      {/* Deep base wash — gives the blobs a dark "depth" to glow out of,
          same idea as the reference image's dark backdrop, scoped to
          just this circle rather than the whole screen. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 50% 42%, #123244, #06141c 80%)",
          transition: "filter 200ms ease",
          filter: active ? "brightness(1.15)" : "brightness(1)",
        }}
      />

      {/* Goo-merged morphing blobs */}
      <div style={{ position: "absolute", inset: "-25%", filter: `url(#${gooId})` }}>
        {[0, 1, 2].map((i) => {
          const hue = ORB_HUES[i % ORB_HUES.length];
          const pos = [{ left: "20%", top: "18%" }, { left: "45%", top: "40%" }, { left: "15%", top: "48%" }][i];
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: size * (0.62 + i * 0.06),
                height: size * (0.62 + i * 0.06),
                left: pos.left,
                top: pos.top,
                background: `radial-gradient(circle at 35% 32%, rgba(${hue},0.95), rgba(${hue},0.35) 70%)`,
                mixBlendMode: "screen",
                opacity: active ? 1 : 0.9,
                transform: active ? "scale(0.94)" : "scale(1)",
                transition: "opacity 200ms ease, transform 200ms ease",
                animation: reduced
                  ? "none"
                  : `btlOrbBlobMorph ${blobDur[i]}s ease-in-out infinite, btlOrbBlobDrift ${blobDur[i] + 3}s ease-in-out infinite`,
                animationDelay: `${i * -2.2}s`,
              }}
            />
          );
        })}
      </div>

      {/* Breathing outer glow halo — escapes the circle clip since it's
          drawn via box-shadow on an element sized slightly past `inset`,
          not clipped content. */}
      <div
        style={{
          position: "absolute",
          inset: "-14%",
          borderRadius: "50%",
          boxShadow: active
            ? "0 0 30px 10px rgba(40,190,200,0.65)"
            : "0 0 20px 6px rgba(40,190,200,0.4)",
          transition: "box-shadow 200ms ease",
          animation: reduced ? "none" : "btlOrbGlowPulse 3s ease-in-out infinite",
        }}
      />

      {/* One-shot tap reaction — remounted on every new pulse.key so the
          CSS animation restarts even for repeated taps. */}
      {pulse && !reduced && (
        <span
          key={pulse.key}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: pulse.variant === "confirm" ? "2px solid rgba(120,230,220,0.9)" : "2px solid rgba(120,230,220,0.6)",
            animation: pulse.variant === "confirm" ? "btlOrbRippleConfirm 550ms ease-out forwards" : "btlOrbRipplePress 420ms ease-out forwards",
          }}
        />
      )}

      <style>{`
        @keyframes btlOrbBlobMorph {
          0%, 100% { border-radius: 58% 42% 38% 62% / 55% 35% 65% 45%; }
          33%      { border-radius: 42% 58% 62% 38% / 48% 55% 45% 52%; }
          66%      { border-radius: 62% 38% 48% 52% / 35% 58% 42% 65%; }
        }
        @keyframes btlOrbBlobDrift {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          50%      { transform: translate(6%, -5%) scale(1.08); }
        }
        @keyframes btlOrbGlowPulse {
          0%, 100% { opacity: 0.75; }
          50%      { opacity: 1; }
        }
        @keyframes btlOrbRipplePress {
          0%   { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes btlOrbRippleConfirm {
          0%   { transform: scale(0.7); opacity: 1; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
