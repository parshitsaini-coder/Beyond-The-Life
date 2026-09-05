/**
 * ---------------- Step 10 — Capacitor static export config ----------------
 * IMPORTANT: this file did not exist before Step 10 — Next.js was running on
 * its default (SSR-capable) build config, which is exactly what Vercel needs
 * and must keep getting. Adding `output: "export"` unconditionally would
 * change how `next build` behaves for the *website* deploy too, which
 * breaks the "do not touch existing behaviour" rule from the master spec.
 *
 * So the static export mode only turns on when we explicitly ask for it,
 * via `CAPACITOR_BUILD=true npm run build` (see the new `build:capacitor`
 * script in package.json). A normal `npm run build` / Vercel build sees
 * this env var unset and gets the exact same config as before (none).
 *
 * Audited before enabling this (Step 10 audit):
 *  - No app/api routes, no "use server" actions anywhere in app/components/lib
 *  - No next/image usage (so no image-optimizer-needs-a-server issue)
 *  - No dynamic route segments ([id], etc.) — only static /, /login, /dashboard, /radial-test
 *  - All Firebase env vars are NEXT_PUBLIC_* (inlined at build time), so they
 *    survive a static export fine as long as .env.local is present at build time
 * This app is 100% client components already (Firebase Auth + Firestore run
 * in the browser), so `output: "export"` needs no code changes elsewhere.
 */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

/** @type {import('next').NextConfig} */
const nextConfig = isCapacitorBuild
  ? {
      output: "export",
      // Capacitor serves the app from a file:// / capacitor:// origin inside
      // the WebView, not from a real domain — no image optimization server
      // is available there, so images must be left unoptimized.
      images: { unoptimized: true },
      // Static HTML export wants a trailing slash + a distinct out dir so it
      // never collides with (or gets committed alongside) the normal Vercel
      // build output in `.next`.
      trailingSlash: true,
      distDir: "out",
    }
  : {};

module.exports = nextConfig;
