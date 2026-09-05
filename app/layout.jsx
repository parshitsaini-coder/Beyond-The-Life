import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "Byound The Life",
  description: "Personal life-goals dashboard",
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
      </body>
    </html>
  );
}
