import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "Byound The Life",
  description: "Personal life-goals dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fffcf2", overflow: "hidden", height: "100vh" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
