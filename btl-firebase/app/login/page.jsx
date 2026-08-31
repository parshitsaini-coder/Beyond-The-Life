"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, signInWithGoogle } from "@/lib/AuthContext";

const C = { bg: "#fffcf2", text: "#403d39", dark: "#252422", accent: "#fca311", blue: "#98c1d9" };

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (e) {
      console.error("Google sign-in failed", e);
      alert("Sign-in failed, please try again.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{
        width: 320, border: `1px solid ${C.dark}`, borderRadius: 14, padding: 28,
        background: "#fff", textAlign: "center",
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, marginBottom: 4 }}>Byound The Life</div>
        <div style={{ fontSize: 12, color: "#8a8579", marginBottom: 22 }}>Sign in to sync your goals everywhere</div>
        <button
          onClick={handleSignIn}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            border: `1px solid ${C.text}`, borderRadius: 8, padding: "10px 14px",
            background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: C.dark,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.6 35.4 26.9 36.3 24 36.3c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.6 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.5 36.2 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          {loading ? "Loading…" : "Sign in with Google"}
        </button>
        <div style={{ marginTop: 14, fontSize: 9, color: "#c9c2ac" }}>
          Real OAuth via Firebase Auth — replaces the artifact's demo login.
        </div>
      </div>
    </div>
  );
}
