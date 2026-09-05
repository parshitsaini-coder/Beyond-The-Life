import { AuthProvider } from "@/lib/AuthContext";
import PWARegister from "@/components/PWARegister";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  title: "Byound The Life",
  description: "Personal life-goals dashboard",
  // ---------------- Step 9 — PWA metadata ----------------
  // manifest.json + apple-mobile-web-app tags are what actually make
  // "Add to Home Screen" available on Android Chrome and iOS Safari.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BTL",
  },
};

// theme_color also needs to live in Next's viewport export (not metadata)
// per Next 14 App Router — this is what colors the browser chrome/status
// bar once installed. Same #403d39 token as manifest.json and the radial
// redesign's dial color.
export const viewport = {
  themeColor: "#403d39",
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;800&family=Playfair+Display:wght@400;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* ---------------- Step 6 — Global Theme Pass (mobile only) ----------------
             The real page background lives here, not just inside BTLDashboard.jsx's own
             rounded card. Desktop's inline `background: "#fffcf2"` below is untouched —
             this is a separate stylesheet rule, gated to <=768px, that only wins because
             of !important (a normal CSS mechanism for overriding inline styles, not a
             hack). Same #c0d6df token BTLDashboard.jsx and the radial components use. */}
        <style>{`
          @media (max-width: 768px) {
            body.btl-app-body { background: #c0d6df !important; }
          }
        `}</style>
      </head>
      <body className="btl-app-body" style={{ margin: 0, background: "#fffcf2", overflow: "hidden", height: "100vh" }}>
        <AuthProvider>{children}</AuthProvider>
        {/* Registers the service worker + shows the "Add to Home Screen"
            banner when the browser fires beforeinstallprompt. Both are
            client-only (no-ops during SSR/build), so this is zero-risk to
            add at the root — every existing page renders exactly the same,
            just with these two invisible-until-relevant components mounted
            alongside it. */}
        <PWARegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
