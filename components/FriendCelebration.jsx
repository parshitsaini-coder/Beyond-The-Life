"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, UserPlus, MessageCircle, Send, Check, ArrowLeft, Handshake, Zap,
  BookOpen, CheckCircle2, Circle, Loader2,
} from "lucide-react";
import {
  friendshipId, sendFriendRequestByEmail, listenIncomingRequests, listenOutgoingRequests,
  acceptFriendRequest, declineFriendRequest, cancelFriendRequest, listenFriendships,
  listenFriendState, listenChatMessages, sendChatMessage,
} from "@/lib/friendsStorage";
import { MemoriesModal } from "@/components/BTLDashboard";

/* ============================================================
   FRIEND CELEBRATION
   Header icon (wired in BTLDashboard.jsx) opens this full-screen
   panel. Flow:
     intro    -> a "VS" style clash animation plays every time this
                 opens (not just first time — it's the panel's own
                 entrance effect)
     hub      -> your name, an "Invite a Friend" box (by email),
                 incoming requests (accept/decline), outgoing
                 (pending) requests, and your existing friends list
     vsIntro  -> a second VS animation (this time with the real
                 friend's photo) plays when you open a friend, or
                 automatically the moment they accept your invite
                 while you're sitting on the hub
     vs       -> the split-screen "You vs {Friend}" dashboard, with
                 a Chat button (glass popup, live) and a Memory
                 button on the friend's side (reuses the exact same
                 MemoriesModal the rest of the app uses, fed with
                 their live data via Firestore)
   ============================================================ */

const C = { bg: "#fffcf2", text: "#403d39", dark: "#252422", accent: "#fca311", blue: "#98c1d9" };

/* ---------------- small shared bits ---------------- */

function Avatar({ name, photoURL, size = 48 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return photoURL ? (
    <img
      src={photoURL} alt={name || "Avatar"} referrerPolicy="no-referrer"
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.35)" }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: C.accent, color: "#fff", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800,
      boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
    }}>
      {initial}
    </div>
  );
}

function MiniRing({ pct = 0, size = 42, color = C.accent, label }) {
  const p = Math.min(100, Math.max(0, pct || 0));
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (p / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={4} fill="none" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: off }}
            transition={{ type: "spring", stiffness: 70, damping: 16 }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.24, fontWeight: 900, color: "#fff" }}>
          {Math.round(p)}%
        </div>
      </div>
      {label && <div style={{ fontSize: 8.5, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>{label}</div>}
    </div>
  );
}

function computeStatsFromState(state) {
  if (!state) return null;
  const dailyPct = state.dailyGoals?.length ? (state.dailyGoals.filter((g) => g.done).length / state.dailyGoals.length) * 100 : 0;
  const extryPct = state.extryGoals?.length ? (state.extryGoals.filter((g) => g.done).length / state.extryGoals.length) * 100 : 0;
  const overallPct = (dailyPct + extryPct) / 2;
  const streak = state.streak || 0;
  const lifeScore = Math.round(dailyPct * 0.35 + extryPct * 0.25 + Math.min(streak / 30, 1) * 100 * 0.4);
  return { dailyPct, extryPct, overallPct, streak, lifeScore };
}

/* ---------------- VS intro animation (fullscreen) ---------------- */

function VSIntro({ leftPhoto, leftName, rightPhoto, rightName, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      key="vs-intro"
      initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#e63946,#fca311)", clipPath: "polygon(0 0, 55% 0, 45% 100%, 0 100%)" }} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "absolute", inset: 0, background: "linear-gradient(315deg,#252422,#403d39)", clipPath: "polygon(55% 0, 100% 0, 100% 100%, 45% 100%)" }} />

      <motion.div initial={{ x: -240, opacity: 0, scale: 0.6 }} animate={{ x: -90, opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 210, damping: 16 }} style={{ position: "relative", zIndex: 1 }}>
        <Avatar name={leftName} photoURL={leftPhoto} size={104} />
      </motion.div>
      <motion.div initial={{ x: 240, opacity: 0, scale: 0.6 }} animate={{ x: 90, opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 210, damping: 16 }} style={{ position: "relative", zIndex: 1 }}>
        <Avatar name={rightName} photoURL={rightPhoto} size={104} />
      </motion.div>

      <motion.div
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
        transition={{ delay: 0.72, duration: 0.5, times: [0, 0.6, 1] }}
        style={{ position: "absolute", zIndex: 2, fontSize: 44, fontWeight: 900, color: "#fff", fontStyle: "italic", letterSpacing: 2, textShadow: "0 0 30px rgba(255,255,255,0.85), 0 4px 20px rgba(0,0,0,0.5)" }}
      >VS</motion.div>
      <motion.div
        initial={{ scale: 0, opacity: 0.9 }} animate={{ scale: 3.2, opacity: 0 }}
        transition={{ delay: 0.72, duration: 0.6, ease: "easeOut" }}
        style={{ position: "absolute", width: 56, height: 56, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.95), transparent 70%)", zIndex: 1 }}
      />

      <div style={{ position: "absolute", bottom: 46, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.8)", letterSpacing: 1 }}>
        🎉 Friend Celebration
      </div>
    </motion.div>
  );
}

/* ---------------- HUB: your name, invite, requests, friends ---------------- */

const STATUS_MSG = {
  not_found: "Koi user is email se nahi mila — pehle unhe BTL mein sign in karna hoga.",
  self: "Aap khud ko invite nahi kar sakte 🙂",
  already_friends: "Aap already friends hain!",
  already_sent: "Request pehle se bheji ja chuki hai.",
  error: "Kuch galat ho gaya, dobara try karein.",
};

function FriendHubView({ user, friendships, incoming, outgoing, onSelectFriend, onClose }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const send = async () => {
    if (!email.trim() || sending) return;
    setSending(true); setStatus(null);
    try {
      const res = await sendFriendRequestByEmail(user, email.trim());
      setStatus(res);
      if (res.ok) setEmail("");
    } catch (e) {
      setStatus({ ok: false, reason: "error" });
    }
    setSending(false);
  };

  const withBusy = (id, fn) => async () => { setBusyId(id); try { await fn(); } finally { setBusyId(null); } };

  return (
    <motion.div
      key="hub"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "22px 26px 14px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <Avatar name={user?.displayName || user?.email} photoURL={user?.photoURL} size={46} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>{user?.displayName || user?.email || "You"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>🎉 Friend Celebration</div>
        </div>
        <div style={{ flex: 1 }} />
        <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
          <X size={17} />
        </motion.button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 22, display: "flex", flexDirection: "column", gap: 22 }} className="btl-scroll">
        {/* invite */}
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,0.14)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <UserPlus size={15} color={C.accent} />
            <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>Invite a Friend</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={email} onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="friend's email address..."
              style={{ flex: 1, fontSize: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", outline: "none" }}
            />
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} onClick={send} disabled={sending}
              style={{ border: "none", background: C.accent, color: "#fff", borderRadius: 10, padding: "0 16px", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: sending ? 0.7 : 1 }}>
              {sending ? <Loader2 size={13} className="btl-spin" /> : <Send size={13} />} Invite
            </motion.button>
          </div>
          <AnimatePresence>
            {status && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: status.ok ? "#7bd389" : "#f4a261", overflow: "hidden" }}>
                {status.ok ? "✅ Invite sent!" : STATUS_MSG[status.reason] || STATUS_MSG.error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* incoming requests */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.65)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Requests {incoming.length > 0 && `(${incoming.length})`}
          </div>
          {incoming.length === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Koi naya friend request nahi hai.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence>
              {incoming.map((req) => (
                <motion.div key={req.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "9px 12px" }}>
                  <Avatar name={req.fromName} photoURL={req.fromPhoto} size={34} />
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.fromName}</div>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} disabled={busyId === req.id}
                    onClick={withBusy(req.id, () => acceptFriendRequest(req))}
                    style={{ background: "#4a7c59", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
                    <Check size={14} />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} disabled={busyId === req.id}
                    onClick={withBusy(req.id, () => declineFriendRequest(req.id))}
                    style={{ background: "rgba(230,57,70,0.85)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
                    <X size={14} />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* outgoing */}
        {outgoing.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.65)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Sent</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {outgoing.map((req) => (
                <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "9px 12px" }}>
                  <Avatar name={req.toName} photoURL={req.toPhoto} size={28} />
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Waiting for {req.toName || "a reply"}...
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} disabled={busyId === req.id}
                    onClick={withBusy(req.id, () => cancelFriendRequest(req.id))}
                    style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Cancel
                  </motion.button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* friends */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.65)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Your Friends {friendships.length > 0 && `(${friendships.length})`}
          </div>
          {friendships.length === 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Abhi tak koi friend nahi — upar se invite bhejein.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12, paddingBottom: 10 }}>
            {friendships.map((f) => (
              <motion.div key={f.id} whileHover={{ y: -4, scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onSelectFriend(f)}
                style={{ cursor: "pointer", background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.12)" }}>
                <Avatar name={f.name} photoURL={f.photoURL} size={48} />
                <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{f.name}</div>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: C.accent, display: "flex", alignItems: "center", gap: 3 }}><Handshake size={10} /> Open</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- VS split-screen dashboard ---------------- */

function GoalMiniList({ title, items }) {
  const done = items.filter((g) => g.done).length;
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10, flex: 1, minHeight: 70, overflowY: "auto" }} className="btl-scroll">
      <div style={{ fontSize: 9.5, fontWeight: 900, color: "rgba(255,255,255,0.6)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span>{title}</span><span>{done}/{items.length}</span>
      </div>
      {items.length === 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>No goals yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((g) => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: g.done ? "rgba(255,255,255,0.4)" : "#fff", textDecoration: g.done ? "line-through" : "none" }}>
            {g.done ? <CheckCircle2 size={12} color="#7bd389" /> : <Circle size={12} color="rgba(255,255,255,0.35)" />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.text || "Goal"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerColumn({ side, name, photoURL, totalEarn, totalSpend, stats, dailyGoals, extryGoals, loading, onOpenMemory }) {
  const accent = side === "me" ? C.accent : "#e63946";
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "me" ? -20 : 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 22 }}
      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${accent}44`, borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={name} photoURL={photoURL} size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          {side === "friend" && (
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={onOpenMemory}
              style={{ marginTop: 4, border: "none", background: C.blue, color: C.dark, borderRadius: 999, padding: "3px 10px", fontSize: 9.5, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <BookOpen size={10} /> Memory
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: "rgba(74,124,89,0.18)", borderRadius: 10, padding: "7px 10px" }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Total Earn</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#7bd389" }}>₹{Math.round(totalEarn)}</div>
        </div>
        <div style={{ flex: 1, background: "rgba(230,57,70,0.18)", borderRadius: 10, padding: "7px 10px" }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Total Spend</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#f4a261" }}>₹{Math.round(totalSpend)}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "16px 0", textAlign: "center" }}>Loading {name}'s data...</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "4px 0" }}>
            <MiniRing pct={stats?.dailyPct} color={C.accent} label="Daily" />
            <MiniRing pct={stats?.extryPct} color={C.blue} label="Extry" />
            <MiniRing pct={stats?.overallPct} color="#fff" label="Overall" />
            <MiniRing pct={Math.min(100, ((stats?.streak || 0) / 30) * 100)} color="#e63946" label={`🔥 ${stats?.streak || 0}`} />
            <MiniRing pct={stats?.lifeScore} color="#7bd389" label="Score" />
          </div>
          <GoalMiniList title="Daily Goals" items={dailyGoals} />
          <GoalMiniList title="Extry Goals" items={extryGoals} />
        </>
      )}
    </motion.div>
  );
}

function FriendVSView({ user, myState, myStats, friend, friendState, onBack, onOpenChat, onOpenMemory }) {
  const friendStats = useMemo(() => computeStatsFromState(friendState), [friendState]);

  return (
    <motion.div
      key="vs"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "18px 22px 14px", overflow: "hidden" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.92 }} onClick={onBack}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 999, padding: "7px 14px", color: "#fff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 0 }}>
          <Zap size={14} color={C.accent} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(user?.displayName || "You").split(" ")[0]} <span style={{ color: "#e63946", fontStyle: "italic" }}>VS</span> {(friend?.name || "Friend").split(" ")[0]}
          </span>
        </div>
        <motion.button whileHover={{ y: -2, scale: 1.06 }} whileTap={{ scale: 0.9 }} onClick={onOpenChat}
          style={{ background: C.accent, border: "none", borderRadius: 999, padding: "7px 14px", color: "#fff", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800 }}>
          <MessageCircle size={14} /> Chat
        </motion.button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18, overflowY: "auto" }} className="btl-scroll">
        <PlayerColumn
          side="me"
          name={user?.displayName || user?.email || "You"}
          photoURL={user?.photoURL}
          totalEarn={myState?.totalEarnLife || 0}
          totalSpend={myState?.totalSpendLife || 0}
          stats={myStats}
          dailyGoals={myState?.dailyGoals || []}
          extryGoals={myState?.extryGoals || []}
        />
        <PlayerColumn
          side="friend"
          name={friend?.name || "Friend"}
          photoURL={friend?.photoURL}
          totalEarn={friendState?.totalEarnLife || 0}
          totalSpend={friendState?.totalSpendLife || 0}
          stats={friendStats}
          dailyGoals={friendState?.dailyGoals || []}
          extryGoals={friendState?.extryGoals || []}
          loading={!friendState}
          onOpenMemory={onOpenMemory}
        />
      </div>
    </motion.div>
  );
}

/* ---------------- glass chat popup ---------------- */

function FriendChatModal({ user, friend, fsId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!fsId) return;
    const unsub = listenChatMessages(fsId, setMessages);
    return unsub;
  }, [fsId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendChatMessage(fsId, user.uid, user.displayName || user.email, text);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 14 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={{
          width: "min(420px, 92vw)", height: "min(560px, 82vh)", background: "rgba(37,36,34,0.78)",
          backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.18)", borderRadius: 22, boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          <Avatar name={friend?.name} photoURL={friend?.photoURL} size={34} />
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend?.name}</div>
          <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
            <X size={14} />
          </motion.button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 4px", display: "flex", flexDirection: "column", gap: 8 }} className="btl-scroll">
          {messages.length === 0 && <div style={{ margin: "auto", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Say hi to {friend?.name}! 👋</div>}
          {messages.map((m) => {
            const mine = m.fromUid === user.uid;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%",
                  background: mine ? "linear-gradient(135deg,#fca311,#e07a5f)" : "rgba(255,255,255,0.1)",
                  color: "#fff", borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "8px 12px", fontSize: 12, wordBreak: "break-word",
                }}>
                {m.text}
              </motion.div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <input
            value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
            style={{ flex: 1, fontSize: 12, padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", outline: "none" }}
          />
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} onClick={send} disabled={sending}
            style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: sending ? 0.7 : 1 }}>
            <Send size={15} />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- root ---------------- */

export default function FriendCelebration({ user, myState, myStats, onClose }) {
  const [phase, setPhase] = useState("intro"); // intro | hub | vsIntro | vs
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const [activeFriend, setActiveFriend] = useState(null);
  const [friendState, setFriendState] = useState(null);
  const [friendships, setFriendships] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const seenIds = useRef(null);

  useEffect(() => {
    if (!user) return;
    const u1 = listenFriendships(user.uid, (list) => {
      // If a fresh friendship shows up while we're sitting on the hub
      // (i.e. the other person just accepted our invite), jump straight
      // into their VS screen with its own intro animation.
      if (seenIds.current) {
        const fresh = list.find((f) => !seenIds.current.has(f.id));
        if (fresh && phaseRef.current === "hub") {
          setActiveFriend(fresh);
          setPhase("vsIntro");
        }
      }
      seenIds.current = new Set(list.map((f) => f.id));
      setFriendships(list);
    });
    const u2 = listenIncomingRequests(user.uid, setIncoming);
    const u3 = listenOutgoingRequests(user.uid, setOutgoing);
    return () => { u1(); u2(); u3(); };
  }, [user]);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("hub"), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!activeFriend?.otherUid) { setFriendState(null); return; }
    const unsub = listenFriendState(activeFriend.otherUid, setFriendState);
    return unsub;
  }, [activeFriend?.otherUid]);

  const selectFriend = (f) => { setActiveFriend(f); setPhase("vsIntro"); };
  const backToHub = () => { setPhase("hub"); setChatOpen(false); setMemoryOpen(false); };

  const fsId = user && activeFriend ? friendshipId(user.uid, activeFriend.otherUid) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      style={{ position: "absolute", inset: 0, zIndex: 95, background: "linear-gradient(145deg,#1b1a17,#252422)", overflow: "hidden" }}
    >
      <style>{`
        @keyframes btlFriendSpin { to { transform: rotate(360deg); } }
        .btl-spin { animation: btlFriendSpin 0.9s linear infinite; }
      `}</style>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <VSIntro key="intro" leftPhoto={user?.photoURL} leftName={user?.displayName || "You"} rightPhoto="" rightName="Friends" onDone={() => setPhase("hub")} />
        )}
        {phase === "hub" && (
          <FriendHubView key="hub" user={user} friendships={friendships} incoming={incoming} outgoing={outgoing} onSelectFriend={selectFriend} onClose={onClose} />
        )}
        {phase === "vsIntro" && activeFriend && (
          <VSIntro key="vsintro" leftPhoto={user?.photoURL} leftName={user?.displayName || "You"} rightPhoto={activeFriend.photoURL} rightName={activeFriend.name} onDone={() => setPhase("vs")} />
        )}
        {phase === "vs" && activeFriend && (
          <FriendVSView
            user={user} myState={myState} myStats={myStats} friend={activeFriend} friendState={friendState}
            onBack={backToHub} onOpenChat={() => setChatOpen(true)} onOpenMemory={() => setMemoryOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && activeFriend && fsId && (
          <FriendChatModal user={user} friend={activeFriend} fsId={fsId} onClose={() => setChatOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {memoryOpen && activeFriend && friendState && (
          <MemoriesModal state={friendState} onAddMemory={() => {}} onClose={() => setMemoryOpen(false)} readOnly />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
