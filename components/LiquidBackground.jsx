"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
        g.addColorStop(0, `rgba(${p.hue},${dark ? 0.5 : 0.35})`);
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
            ctx.strokeStyle = `rgba(${a.hue},${(1 - d / 90) * (dark ? 0.14 : 0.09)})`;
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
        g.addColorStop(0, `rgba(${p.hue},${dark ? 0.5 : 0.35})`);
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

/* ---------------- 5. Ripple Effect ---------------- */
function RippleLayer({ containerRef, reduced }) {
  const [ripples, setRipples] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (reduced) return; // motion-sensitive users get no ripple bursts
    const el = containerRef?.current;
    if (!el) return;
    function onDown(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0) - rect.left;
      const y = (e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0) - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const id = ++idRef.current;
      const hue = PALETTE[id % PALETTE.length];
      setRipples((prev) => [...prev.slice(-5), { id, x, y, hue }]);
    }
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, [containerRef, reduced]);

  return (
    <AnimatePresence>
      {ripples.map((r) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0.55, scale: 0 }}
          animate={{ opacity: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          onAnimationComplete={() => setRipples((prev) => prev.filter((p) => p.id !== r.id))}
          style={{
            position: "absolute", left: r.x, top: r.y, width: 220, height: 220,
            marginLeft: -110, marginTop: -110, borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${r.hue},0.28) 0%, rgba(${r.hue},0.12) 45%, transparent 72%)`,
            border: `1px solid rgba(${r.hue},0.35)`,
          }}
        />
      ))}
    </AnimatePresence>
  );
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
          position: "absolute", inset: "-10%", opacity: dark ? 0.55 : 0.7,
          background:
            `radial-gradient(circle at 18% 22%, rgba(${PALETTE[0]},0.20), transparent 42%),` +
            `radial-gradient(circle at 82% 18%, rgba(${PALETTE[1]},0.20), transparent 45%),` +
            `radial-gradient(circle at 30% 85%, rgba(${PALETTE[2]},0.16), transparent 48%),` +
            `radial-gradient(circle at 78% 80%, rgba(${PALETTE[3]},0.14), transparent 45%)`,
          animation: reduced ? "none" : "btlLiquidGradientShift 26s ease-in-out infinite alternate",
          filter: "blur(2px)",
        }}
      />

      {/* 2. Liquid Blob — goo-merged morphing blobs */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, filter: `url(#${gooId})`, opacity: dark ? 0.5 : 0.6 }}
      >
        {PALETTE.map((hue, i) => (
          <div
            key={i}
            className={`btl-liquid-blob btl-liquid-blob-${i}`}
            style={{
              position: "absolute",
              width: 190 + i * 26,
              height: 190 + i * 26,
              left: `${14 + i * 20}%`,
              top: `${8 + (i % 2) * 46}%`,
              background: `radial-gradient(circle at 35% 32%, rgba(${hue},0.85), rgba(${hue},0.15) 70%)`,
              mixBlendMode: dark ? "screen" : "multiply",
              animation: reduced
                ? "none"
                : `btlBlobMorph ${blobDur[i]}s ease-in-out infinite, btlBlobDrift ${blobDur[i] + 6}s ease-in-out infinite`,
              animationDelay: `${i * -3.5}s`,
            }}
          />
        ))}
      </div>

      {/* 3. Wave Effect — parallax bands along the bottom edge */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", opacity: dark ? 0.4 : 0.5 }}>
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
              fill={`rgba(${PALETTE[i]},${0.16 - i * 0.03})`}
            />
          </svg>
        ))}
      </div>

      {/* 4. Particle Fluid */}
      <ParticleFluidCanvas reduced={reduced} coarse={coarse} dark={dark} />

      {/* 5. Ripple Effect — spawned from clicks anywhere on the dashboard */}
      <RippleLayer containerRef={containerRef} reduced={reduced} />

      <style>{`
        @keyframes btlLiquidGradientShift {
          0%   { transform: translate(0%, 0%) rotate(0deg) scale(1); }
          50%  { transform: translate(-2.5%, 2%) rotate(4deg) scale(1.06); }
          100% { transform: translate(2%, -2%) rotate(-3deg) scale(1.03); }
        }
        @keyframes btlBlobMorph {
          0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          25%      { border-radius: 40% 60% 70% 30% / 50% 60% 40% 50%; }
          50%      { border-radius: 70% 30% 50% 50% / 30% 60% 40% 70%; }
          75%      { border-radius: 30% 70% 40% 60% / 70% 40% 60% 30%; }
        }
        @keyframes btlBlobDrift {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(4%, -6%) scale(1.08); }
          66%  { transform: translate(-5%, 4%) scale(0.94); }
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
