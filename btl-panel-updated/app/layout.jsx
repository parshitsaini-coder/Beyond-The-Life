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
      </head>
      <body style={{ margin: 0, background: "#fffcf2", overflow: "hidden", height: "100vh" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
