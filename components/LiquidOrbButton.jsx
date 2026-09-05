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
   (Looked at StarKnightt/liquid-effect-animation per your link —
   that's a Three.js canvas-text ripple shader, a different problem
   shape entirely and would mean shipping a WebGL runtime just for
   this one circle, so its *technique* isn't reused here — same
   "no new dependency for one button" call as the rest of this file.)

   Visual states layered on top of the idle animation:
     - `active`   (press-and-hold in progress) — blobs brighten and
       pull in slightly, glow intensifies. Purely a style change,
       doesn't touch the drag-gesture logic in RadialDialMenu.jsx.
     - `pulse`    ({ key, variant }) — a one-shot radiating ring.
       variant "press" fires on pointerdown (soft, single ring);
       variant "confirm" fires the instant an item is selected
       (brighter double ring + flash).
     - `dragVector` ({ dx, dy }, px offset of the finger from the
       orb's own center while held down) — the liquid mass *sloshes*
       toward the finger in real time as it moves, like fluid tilted
       inside a round glass: the blob mass shifts + stretches toward
       the pull direction and a soft glass highlight slides the
       opposite way, then springs back elastically the instant
       `dragVector` returns to {0,0} on release. Stays fully inside
       the circle's own clip — no geometry ever escapes the button's
       bounds, so the touch target/hit box is untouched.
     - `splash`   ({ key }) — a fast one-shot liquid "pop": droplets
       burst outward from center and melt back into the mass through
       the same goo filter, plus a quick bright flash. Fires on
       pointerdown alongside `pulse`'s "press" ring for the "clicking
       it feels instantly liquid" reaction that was asked for. `key`
       must change every time so the animation restarts on repeat taps.
   ============================================================ */

const ORB_HUES = ["46,181,204", "34,211,168", "56,142,230"]; // blue/teal RGB triples
const MAX_PULL = 46; // px — finger offset at which the slosh/stretch fully saturates

export default function LiquidOrbButton({
  size = 76,
  active = false,
  pulse = null,
  dragVector = null,
  splash = null,
}) {
  const gooId = useId();
  const reduced = usePrefersReducedMotion();
  const coarse = useIsCoarsePointer();

  // 3 blobs is enough to read as one morphing liquid mass at this size —
  // more just costs paint time without being visible under the goo blur.
  const blobDur = useMemo(() => [7, 9, 8], []);

  // ---- drag-driven "slosh": clamp the finger offset, turn it into a
  // 0..1 pull amount + an angle, then compose a transform that shifts
  // + elongates the whole liquid mass toward the finger. Recomputed
  // every render (dx/dy change on every pointermove) — cheap, no need
  // to memoize a couple of trig calls.
  const dx = dragVector?.dx || 0;
  const dy = dragVector?.dy || 0;
  const dist = Math.min(Math.hypot(dx, dy), MAX_PULL);
  const pullT = reduced ? 0 : dist / MAX_PULL; // 0 = centered, 1 = fully sloshed
  const angleDeg = dist > 0.5 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
  const dragging = !!dragVector && (dx !== 0 || dy !== 0);
  const isCoarseOrFine = coarse ? 0.85 : 1; // slightly gentler pull on touch, same feel

  const sloshTransform =
    `rotate(${angleDeg}deg) ` +
    `translateX(${pullT * size * 0.16 * isCoarseOrFine}px) ` +
    `scaleX(${1 + pullT * 0.32}) scaleY(${1 - pullT * 0.16}) ` +
    `rotate(${-angleDeg}deg)`;
  // Follows the finger instantly while dragging (near-zero lag reads as
  // "liquid"), then eases back with a soft overshoot the moment it's let go.
  const sloshTransition = dragging
    ? "transform 90ms linear"
    : "transform 640ms cubic-bezier(0.22, 1.61, 0.36, 1)";

  // Glass highlight drifts the OPPOSITE way from the slosh — the classic
  // "light stays put while liquid tilts underneath it" read.
  const highlightOffsetX = -pullT * size * 0.14;
  const highlightOffsetY = -pullT * size * 0.1 - size * 0.16;

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

      {/* Goo-merged morphing blobs — wrapped in a slosh layer so the whole
          liquid mass can shift + stretch toward the drag direction while
          each blob keeps its own independent morph/drift underneath. */}
      <div
        style={{
          position: "absolute",
          inset: "-25%",
          filter: `url(#${gooId})`,
          transform: sloshTransform,
          transition: sloshTransition,
          willChange: dragging ? "transform" : "auto",
        }}
      >
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

      {/* Glass highlight — a soft light patch that drifts opposite the
          slosh direction, staying inside the same clip. Gives the mass
          underneath a "liquid under glass" depth cue rather than a flat
          color fill, at the cost of one more (cheap, no-filter) div. */}
      <div
        style={{
          position: "absolute",
          width: size * 0.66,
          height: size * 0.4,
          left: "50%",
          top: "50%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0) 72%)",
          mixBlendMode: "overlay",
          transform: `translate(calc(-50% + ${highlightOffsetX}px), calc(-50% + ${highlightOffsetY}px))`,
          transition: sloshTransition,
          opacity: active ? 0.9 : 0.7,
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

      {/* Fast liquid "splash" — fires alongside pulse's press ring on
          pointerdown. A quick bright flash plus droplets that fly outward
          THROUGH the same goo filter as the main mass, so they visually
          melt back into it as they shrink — reads as a single liquid pop,
          not separate flying circles. Remounted every splash.key so rapid
          taps always restart clean. */}
      {splash && !reduced && (
        <div key={splash.key} style={{ position: "absolute", inset: 0 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "radial-gradient(circle at 50% 45%, rgba(190,245,240,0.85), rgba(190,245,240,0) 70%)",
              animation: "btlOrbSplashFlash 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
              mixBlendMode: "screen",
            }}
          />
          <div style={{ position: "absolute", inset: "-25%", filter: `url(#${gooId})` }}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const theta = (i / 6) * Math.PI * 2;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: size * 0.22,
                    height: size * 0.22,
                    marginLeft: -size * 0.11,
                    marginTop: -size * 0.11,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, rgba(${ORB_HUES[i % ORB_HUES.length]},0.95), rgba(${ORB_HUES[i % ORB_HUES.length]},0.2) 70%)`,
                    mixBlendMode: "screen",
                    "--dropx": `${Math.cos(theta) * size * 0.62}px`,
                    "--dropy": `${Math.sin(theta) * size * 0.62}px`,
                    animation: `btlOrbSplashDroplet 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                    animationDelay: `${i * 8}ms`,
                  }}
                />
              );
            })}
          </div>
        </div>
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
        @keyframes btlOrbSplashFlash {
          0%   { opacity: 0; }
          20%  { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes btlOrbSplashDroplet {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.95; }
          100% { transform: translate(var(--dropx), var(--dropy)) scale(0.15); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
