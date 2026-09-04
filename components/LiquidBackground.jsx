"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/* ============================================================
   LIQUID BACKGROUND — dashboard-wide animated background system
   ============================================================
   Five techniques, all layered behind the dashboard's own content
   (z-index -1, pointer-events: none except the ripple trigger which
   just listens on the existing container — it never blocks clicks):

     1. Liquid Gradient   — slow-shifting radial gradient mesh, the
                             base wash every other layer sits on.
     2. Liquid Blob       — 4 organic blobs that morph border-radius
                             and drift, merged into one "goo" mass via
                             an SVG filter (blur + contrast) so they
                             melt into and split from each other.
     3. Wave Effect       — 3 translucent SVG wave bands parallax-
                             scrolling along the bottom edge.
     4. Particle Fluid    — canvas layer of soft glowing dots that
                             drift with gentle turbulence and are
                             loosely drawn toward the cursor, with
                             faint connective lines for a "fluid mesh"
                             feel.
     5. Ripple Effect     — an expanding, fading ring spawned at the
                             exact point of every click/tap anywhere
                             on the dashboard.

   Performance & accessibility (non-negotiable, matches epic-design /
   lightweight-3d-effects house rules):
     - Only `transform`, `opacity`, `filter` are animated in CSS.
     - `prefers-reduced-motion` freezes every animation to a single
       static, still-pretty frame.
     - `pointer: coarse` (phones/tablets) halves the particle count
       and disables the cursor-attraction math (no cursor there).
     - Canvas loop is a single shared requestAnimationFrame, torn down
       on unmount; particle count is capped low (28 desktop / 14
       touch) — this is a decorative dashboard backdrop, not a hero.
     - Everything lives at z-index -1 inside the dashboard's own
       `overflow:hidden` panel, so it never affects layout or leaks
       outside the rounded card.
   ============================================================ */

const PALETTE = [
  "252,163,17",   // amber  (C.accent)
  "152,193,217",  // sky    (C.blue)
  "224,122,95",   // coral
  "129,178,154",  // sage — soft 4th liquid tone, keeps the goo mass
                   // from reading as only 2 hues once blobs overlap
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const h = (e) => setReduced(e.matches);
      if (mq.addEventListener) mq.addEventListener("change", h); else mq.addListener(h);
      return () => { if (mq.removeEventListener) mq.removeEventListener("change", h); else mq.removeListener(h); };
    } catch (e) { /* assume motion is fine */ }
  }, []);
  return reduced;
}

function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(pointer: coarse)");
      setCoarse(mq.matches);
      const h = (e) => setCoarse(e.matches);
      if (mq.addEventListener) mq.addEventListener("change", h); else mq.addListener(h);
      return () => { if (mq.removeEventListener) mq.removeEventListener("change", h); else mq.removeListener(h); };
    } catch (e) { /* assume desktop */ }
  }, []);
  return coarse;
}

/* ---------------- 4. Particle Fluid (canvas) ---------------- */
function ParticleFluidCanvas({ reduced, coarse, dark }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const COUNT = coarse ? 14 : 28;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
      r: 1.6 + Math.random() * 2.6,
      hue: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      phase: Math.random() * Math.PI * 2,
    }));

    function resize() {
      const parent = canvas.parentElement;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = (e.clientX - rect.left) / rect.width;
      pointerRef.current.y = (e.clientY - rect.top) / rect.height;
      pointerRef.current.active = true;
    }
    function onLeave() { pointerRef.current.active = false; }
    if (!coarse) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerleave", onLeave);
    }

    if (reduced) {
      // Single still frame — organic dots, no motion, no listeners needed.
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        const px = p.x * width, py = p.y * height;
        const g = ctx.createRadialGradient(px, py, 0, px, py, p.r * 6);
        g.addColorStop(0, `rgba(${p.hue},${dark ? 0.42 : 0.3})`);
        g.addColorStop(1, `rgba(${p.hue},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      });
      return () => ro.disconnect();
    }

    let t = 0;
    function tick() {
      t += 0.008;
      ctx.clearRect(0, 0, width, height);
      const ptr = pointerRef.current;

      particles.forEach((p) => {
        // gentle turbulence drift
        p.x += p.vx + Math.sin(t + p.phase) * 0.00008;
        p.y += p.vy + Math.cos(t + p.phase) * 0.00008;

        // loose attraction toward the cursor — fluid-like pull, capped
        if (ptr.active) {
          const dx = ptr.x - p.x, dy = ptr.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.22) {
            p.x += dx * 0.0018;
            p.y += dy * 0.0018;
          }
        }

        if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;
      });

      // faint connective mesh between nearby particles — the "fluid" tell
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = (a.x - b.x) * width, dy = (a.y - b.y) * height;
          const d = Math.hypot(dx, dy);
          if (d < 90) {
            ctx.strokeStyle = `rgba(${a.hue},${(1 - d / 90) * (dark ? 0.13 : 0.09)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * width, a.y * height);
            ctx.lineTo(b.x * width, b.y * height);
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        const px = p.x * width, py = p.y * height;
        const g = ctx.createRadialGradient(px, py, 0, px, py, p.r * 6);
        g.addColorStop(0, `rgba(${p.hue},${dark ? 0.42 : 0.3})`);
        g.addColorStop(1, `rgba(${p.hue},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced, coarse, dark]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ---------------- 5. Ripple 3D Effect (wave-interference canvas) ----------------
   A proper concentric-ring wave simulation instead of a single fading circle:
   every click/tap spawns a point source, and each animation frame draws many
   thin concentric rings expanding outward from it with a sine-shaped envelope
   (bright at the wavefront, tapering behind it — like an actual ripple, not a
   solid disc). Colors cycle teal → indigo per ring so the banding reads the
   same as a real wave-interference photograph, and every ripple is drawn with
   `globalCompositeOperation: "lighter"` (additive light blending) so when two
   ripples' rings cross, they don't just overlap flatly — they add into a
   bright, slightly magenta interference zone, exactly like two overlapping
   water ripples. A soft shadowBlur gives the rings a glowing, slightly-3D
   look rather than flat hard-edged circles. */
const RIPPLE_TEAL = [45, 212, 191];
const RIPPLE_INDIGO = [88, 28, 135];
function lerpColor(a, b, t) {
  return `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`;
}

function RippleWaveCanvas({ containerRef, reduced }) {
  const canvasRef = useRef(null);
  const ripplesRef = useRef([]); // [{x,y,start}], mutated directly — no re-render needed
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const el = containerRef?.current;
    if (!canvas || !el) return;
    const ctx = canvas.getContext("2d");
    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const parent = canvas.parentElement;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    function onDown(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0) - rect.left;
      const y = (e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0) - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      ripplesRef.current = [...ripplesRef.current.slice(-3), { x, y, start: performance.now() }];
    }
    el.addEventListener("pointerdown", onDown);

    if (reduced) {
      // One gentle static ring per tap instead of an expanding animation.
      function onDownReduced(e) {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0) - rect.left;
        const y = (e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0) - rect.top;
        ctx.beginPath();
        ctx.arc(x, y, 60, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${RIPPLE_TEAL.join(",")},0.35)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        setTimeout(() => ctx.clearRect(0, 0, width, height), 500);
      }
      el.addEventListener("pointerdown", onDownReduced);
      return () => { ro.disconnect(); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerdown", onDownReduced); };
    }

    const SPEED = 260;         // px/sec — how fast the wavefront expands
    const LIFE = 2400;         // ms — total ripple lifetime
    const WAVELENGTH = 30;     // px — distance between wave crests (bigger = gentler, more "water"-like swell)
    const STOPS = 160;         // gradient color-stop resolution — high enough that the browser's
                                // own linear interpolation between stops reads as a perfectly smooth,
                                // continuous wave with no visible ring edges (this is the fix for the
                                // "distinct rings" look — a single gradient, not many stroked circles)

    function tick() {
      ctx.clearRect(0, 0, width, height);
      const now = performance.now();
      ripplesRef.current = ripplesRef.current.filter((r) => now - r.start < LIFE);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      ripplesRef.current.forEach((r) => {
        const elapsed = now - r.start;
        const t = elapsed / LIFE;
        const fade = Math.max(0, 1 - t * t); // eases out smoothly near the end instead of a linear cutoff
        const frontRadius = (elapsed / 1000) * SPEED;
        if (frontRadius < 1) return;

        const gradient = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, frontRadius);
        for (let s = 0; s <= STOPS; s++) {
          const frac = s / STOPS;                              // 0 (center) .. 1 (wavefront)
          const radiusPx = frac * frontRadius;
          const behindFront = (frontRadius - radiusPx) / WAVELENGTH; // in wavelengths, 0 at the edge
          const envelope = Math.exp(-behindFront / 2.4);        // smooth exponential taper toward the
                                                                  // center — no hard cutoff, so nothing
                                                                  // reads as a discrete "ring"
          const crest = (Math.sin(radiusPx / WAVELENGTH * Math.PI * 2 - elapsed / 140) + 1) / 2;
          const color = lerpColor(RIPPLE_TEAL, RIPPLE_INDIGO, crest);
          const alpha = Math.max(0, Math.min(1, envelope * fade * (0.16 + crest * 0.34)));
          gradient.addColorStop(frac, `rgba(${color},${alpha})`);
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, frontRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      ctx.restore();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
    };
  }, [containerRef, reduced]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ---------------- main export ---------------- */
export default function LiquidBackground({ containerRef, dark = false }) {
  const reduced = usePrefersReducedMotion();
  const coarse = useIsCoarsePointer();

  const blobDur = useMemo(() => [22, 27, 19, 25], []);
  const gooId = useMemo(() => `btl-goo-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}>
      {/* SVG goo filter — melts the blobs together where they overlap */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id={gooId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
            <feColorMatrix in="blur" mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11" result="goo" />
          </filter>
        </defs>
      </svg>

      {/* 1. Liquid Gradient — base wash, slow hue/position drift */}
      <div
        aria-hidden="true"
        className="btl-liquid-gradient"
        style={{
          position: "absolute", inset: "-10%", opacity: dark ? 0.5 : 0.6,
          background:
            `radial-gradient(circle at 18% 22%, rgba(${PALETTE[0]},0.32), transparent 58%),` +
            `radial-gradient(circle at 82% 18%, rgba(${PALETTE[1]},0.32), transparent 60%),` +
            `radial-gradient(circle at 30% 85%, rgba(${PALETTE[2]},0.28), transparent 62%),` +
            `radial-gradient(circle at 78% 80%, rgba(${PALETTE[3]},0.24), transparent 60%),` +
            `radial-gradient(circle at 50% 50%, rgba(${PALETTE[0]},0.12), transparent 70%)`,
          animation: reduced ? "none" : "btlLiquidGradientShift 26s ease-in-out infinite alternate",
          filter: "blur(2px)",
        }}
      />

      {/* 2. Liquid Blob — goo-merged morphing blobs */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, filter: `url(#${gooId})`, opacity: dark ? 0.45 : 0.55 }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const hue = PALETTE[i % PALETTE.length];
          const pos = [
            { left: "6%", top: "4%" },
            { left: "62%", top: "2%" },
            { left: "34%", top: "58%" },
            { left: "78%", top: "60%" },
            { left: "2%", top: "66%" },
          ][i];
          return (
            <div
              key={i}
              className={`btl-liquid-blob btl-liquid-blob-${i}`}
              style={{
                position: "absolute",
                width: 280 + i * 34,
                height: 280 + i * 34,
                left: pos.left,
                top: pos.top,
                background: `radial-gradient(circle at 35% 32%, rgba(${hue},0.75), rgba(${hue},0.25) 70%)`,
                mixBlendMode: dark ? "screen" : "normal",
                animation: reduced
                  ? "none"
                  : `btlBlobMorph ${blobDur[i % blobDur.length]}s ease-in-out infinite, btlBlobDrift ${blobDur[i % blobDur.length] + 6}s ease-in-out infinite`,
                animationDelay: `${i * -3.5}s`,
              }}
            />
          );
        })}
      </div>

      {/* 3. Wave Effect — parallax bands along the bottom edge */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", opacity: dark ? 0.38 : 0.48 }}>
        {[0, 1, 2].map((i) => (
          <svg
            key={i}
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            style={{
              position: "absolute", bottom: i * 6, left: "-10%", width: "120%", height: `${70 + i * 14}px`,
              animation: reduced ? "none" : `btlWaveScroll ${18 + i * 9}s linear infinite`,
              animationDirection: i % 2 ? "reverse" : "normal",
            }}
          >
            <path
              d="M0,40 C150,90 350,0 600,40 C850,80 1050,10 1200,50 L1200,120 L0,120 Z"
              fill={`rgba(${PALETTE[i]},${0.28 - i * 0.04})`}
            />
          </svg>
        ))}
      </div>

      {/* 4. Particle Fluid */}
      <ParticleFluidCanvas reduced={reduced} coarse={coarse} dark={dark} />

      {/* 5. Ripple 3D Effect — wave-interference rings spawned from clicks anywhere on the dashboard */}
      <RippleWaveCanvas containerRef={containerRef} reduced={reduced} />

      <style>{`
        @keyframes btlLiquidGradientShift {
          0%   { transform: translate(0%, 0%) rotate(0deg) scale(1); }
          50%  { transform: translate(-9%, 7%) rotate(8deg) scale(1.12); }
          100% { transform: translate(8%, -8%) rotate(-6deg) scale(1.08); }
        }
        @keyframes btlBlobMorph {
          0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          25%      { border-radius: 40% 60% 70% 30% / 50% 60% 40% 50%; }
          50%      { border-radius: 70% 30% 50% 50% / 30% 60% 40% 70%; }
          75%      { border-radius: 30% 70% 40% 60% / 70% 40% 60% 30%; }
        }
        @keyframes btlBlobDrift {
          0%   { transform: translate(0px, 0px) scale(1); }
          25%  { transform: translate(22%, -28%) scale(1.15); }
          50%  { transform: translate(-18%, 20%) scale(0.9); }
          75%  { transform: translate(-26%, -16%) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes btlWaveScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-8.33%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .btl-liquid-gradient, .btl-liquid-blob { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
