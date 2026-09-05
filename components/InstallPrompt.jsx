"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_KEY = "btl-install-dismissed-at";
// Re-offer after a week rather than never again — someone who dismissed it
// once during a rushed moment shouldn't lose the option permanently.
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - dismissedAt < RESHOW_AFTER_MS) return;
      setDeferredEvent(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setVisible(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredEvent) return;
    deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            position: "fixed", left: "50%", transform: "translateX(-50%)",
            bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 9999,
            display: "flex", alignItems: "center", gap: 10,
            background: "#403d39", color: "#fffcf2", borderRadius: 999,
            padding: "10px 10px 10px 16px", boxShadow: "0 12px 32px rgba(37,36,34,0.35)",
            fontFamily: "Inter, system-ui, sans-serif", maxWidth: "92vw",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>Install Beyond The Life?</span>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
            onClick={install}
            style={{
              border: "none", borderRadius: 999, padding: "7px 14px", background: "#c0d6df",
              color: "#252422", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Install
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              border: "none", borderRadius: "50%", width: 26, height: 26, background: "rgba(255,255,255,0.12)",
              color: "#fffcf2", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            ×
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
