"use client";
import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app works fine without a SW, it just won't cache
      // the shell for offline use. No need to surface this to the user.
    });
  }, []);
  return null;
}
