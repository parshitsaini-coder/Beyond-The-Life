"use client";
import { useId, useMemo } from "react";
import { usePrefersReducedMotion, useIsCoarsePointer } from "@/components/LiquidBackground";

// How many px of finger travel it takes to reach "fully stretched" — tuned
// against RadialDialMenu's DEADZONE (34px) so the tail is already visibly
// forming right as the menu starts responding, not lagging behind it.
const PULL_RANGE = 70;
// Small droplets that fling off on a hard tap/confirm — count kept low
// (goo-blur cost scales with blob count, and this sits on a button that's
// already animating two other blob layers every frame).
const SPLASH_DROPLETS = 6;

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

   New in this update — deep liquid drag-follow + splash-on-tap:
     - `pull`    ({ dx, dy } in raw pixels from the orb's own center,
       same numbers RadialDialMenu already tracks for hover-matching
       during the drag) — the blob mass shifts toward the finger and
       grows a stretchy teardrop "tail" pointing back at the drag
       origin, so the liquid visibly gets pulled/dragged rather than
       just sliding as a rigid disc. Fully goo-merged with the idle
       blobs (same filter), so the tail and the main mass read as one
       continuous liquid body, not a separate shape. Magnitude ramps
       over `PULL_RANGE` px and is clamped past that, so a very long
       drag doesn't stretch the tail off past a sane size.
     - `pulse.variant === "press"` now ALSO fires a quick multi-droplet
       splash (goo-merged, so droplets coalesce/separate like a real
       liquid burst) instead of just the ring — the "fast liquid effect
       on click" behaviour. "confirm" keeps its brighter double-ring +
       flash on top of the same splash, since that's the bigger, more
       final-feeling hit.
   ============================================================ */

const ORB_HUES = ["46,181,204", "34,211,168", "56,142,230"]; // blue/teal RGB triples

export default function LiquidOrbButton({ size = 76, active = false, pulse = null, pull = null }) {
  const gooId = useId();
  const reduced = usePrefersReducedMotion();
  const coarse = useIsCoarsePointer();

  // 3 blobs is enough to read as one morphing liquid mass at this size —
  // more just costs paint time without being visible under the goo blur.
  const blobDur = useMemo(() => [7, 9, 8], []);

  const dx = pull?.dx || 0;
  const dy = pull?.dy || 0;
  const pullDist = Math.hypot(dx, dy);
  // 0 → 1 how "committed" the drag is; eases in so small jitters near the
  // deadzone don't already show a full tail.
  const pullT = reduced ? 0 : Math.min(1, pullDist / PULL_RANGE);
  const pullAngle = pullDist > 0.5 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
  // Mass shift: the blob cluster itself drifts a little toward the finger,
  // on top of (not instead of) its own idle drifting animation.
  const massShiftX = dx * 0.28;
  const massShiftY = dy * 0.28;
  // Tail: an ellipse anchored at center, stretched along the drag axis and
  // pushed back toward the origin — reads as liquid being dragged out of
  // the main body rather than the whole disc sliding.
  const tailLen = size * (0.42 + pullT * 0.68);
  const tailWidth = size * (0.5 - pullT * 0.16);
  const splashDroplets = useMemo(
    () =>
      Array.from({ length: SPLASH_DROPLETS }, (_, i) => ({
        angle: (360 / SPLASH_DROPLETS) * i + (i % 2 ? 14 : -8),
        dist: 0.9 + (i % 3) * 0.18,
        size: 0.14 + ((i * 37) % 10) / 100,
        delay: (i % 3) * 18,
      })),
    []
  );

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

      {/* Goo-merged morphing blobs + drag tail — all inside the same
          filtered wrapper so everything coalesces into one liquid mass. */}
      <div
        style={{
          position: "absolute",
          inset: "-25%",
          filter: `url(#${gooId})`,
          transform: `translate(${massShiftX}px, ${massShiftY}px)`,
          transition: pullT === 0 ? "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
        }}
      >
        {pullT > 0.02 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: tailLen,
              height: tailWidth,
              marginTop: -tailWidth / 2,
              // grown from center outward along the drag axis, back toward
              // the finger's origin (opposite the mass shift direction)
              transformOrigin: "0% 50%",
              transform: `rotate(${pullAngle + 180}deg) scaleX(${0.35 + pullT * 0.65})`,
              borderRadius: "50% 50% 45% 45% / 60% 60% 40% 40%",
              background: `radial-gradient(circle at 30% 40%, rgba(${ORB_HUES[0]},${0.9 * pullT}), rgba(${ORB_HUES[2]},${0.3 * pullT}) 75%)`,
              opacity: 0.55 + pullT * 0.45,
            }}
          />
        )}
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

        {/* Splash droplets — goo-merged burst on tap. Remounted every
            pulse.key so the animation restarts on repeated taps; ends at
            opacity 0 (`forwards`) so nothing is left frozen on screen. */}
        {pulse && !reduced && (pulse.variant === "press" || pulse.variant === "confirm") &&
          splashDroplets.map((d, i) => (
            <div
              key={`${pulse.key}-${i}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: size * d.size,
                height: size * d.size,
                marginLeft: (-size * d.size) / 2,
                marginTop: (-size * d.size) / 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 32%, rgba(${ORB_HUES[i % ORB_HUES.length]},0.95), rgba(${ORB_HUES[i % ORB_HUES.length]},0.3) 70%)`,
                mixBlendMode: "screen",
                "--splash-x": `${Math.cos((d.angle * Math.PI) / 180) * size * d.dist}px`,
                "--splash-y": `${Math.sin((d.angle * Math.PI) / 180) * size * d.dist}px`,
                animation: `btlOrbSplash ${pulse.variant === "confirm" ? 480 : 380}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                animationDelay: `${d.delay}ms`,
              }}
            />
          ))}
      </div>

      {/* Fast "hit" flash — a quick brightening wash that snaps in on tap
          and fades right away, giving the click a punchy, immediate feel
          before the slower ring/splash finish settling. */}
      {pulse && !reduced && (
        <div
          key={`flash-${pulse.key}`}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 45%, rgba(210,250,245,0.55), rgba(210,250,245,0) 70%)",
            mixBlendMode: "screen",
            animation: `btlOrbFlash ${pulse.variant === "confirm" ? 300 : 220}ms ease-out forwards`,
          }}
        />
      )}

      {/* Specular highlight — a small bright glint biased opposite the
          drag direction, like light catching the far side of a liquid
          sphere as it's tugged. Purely additive depth cue; not clipped
          to the goo filter since it should stay crisp, not gooey. */}
      <div
        style={{
          position: "absolute",
          width: size * 0.34,
          height: size * 0.22,
          left: "50%",
          top: "50%",
          marginLeft: -size * 0.17 - dx * 0.12,
          marginTop: -size * 0.32 - dy * 0.12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.55), rgba(255,255,255,0) 75%)",
          filter: "blur(1px)",
          opacity: active ? 0.85 : 0.6,
          transition: "opacity 200ms ease, margin 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          pointerEvents: "none",
        }}
      />

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
        @keyframes btlOrbSplash {
          0%   { transform: translate(0, 0) scale(0.4); opacity: 0.95; }
          60%  { opacity: 0.85; }
          100% { transform: translate(var(--splash-x), var(--splash-y)) scale(0.15); opacity: 0; }
        }
        @keyframes btlOrbFlash {
          0%   { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
