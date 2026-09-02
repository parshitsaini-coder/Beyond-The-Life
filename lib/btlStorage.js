"use client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------------------------------------------------------
   Drop-in replacement for the artifact's loadState()/saveState()
   (which used window.storage, private-per-account, one key only).

   Same state shape as makeDefaultState() in btl_dashboard.jsx —
   now stored as one Firestore document per user at
   btl_state/{uid}, protected by Firestore security rules (see
   firestore.rules) so it's genuinely private and synced across
   every device that user signs into.
   --------------------------------------------------------------- */

export async function loadStateFromFirestore(user, makeDefaultState, ensureGoalDefaults) {
  if (!user) return null;

  const ref = doc(db, "btl_state", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const merged = { ...makeDefaultState(), ...snap.data() };
    merged.dailyGoals = (merged.dailyGoals || []).map(ensureGoalDefaults);
    merged.extryGoals = (merged.extryGoals || []).map(ensureGoalDefaults);
    merged.timeTable = (merged.timeTable || []).map(ensureGoalDefaults);
    merged.completionHistory = merged.completionHistory || {};
    merged.dailyLogs = merged.dailyLogs || {};
    merged.user = { name: user.displayName || user.email, id: user.uid };
    return merged;
  }

  // first time this user has signed in: seed their document with defaults
  const fresh = { ...makeDefaultState(), user: { name: user.displayName || user.email, id: user.uid } };
  await setDoc(ref, fresh);
  return fresh;
}

export async function saveStateToFirestore(user, state) {
  if (!user) return;
  try {
    await setDoc(doc(db, "btl_state", user.uid), state, { merge: false });
  } catch (e) {
    console.error("BTL save failed", e);
  }
}
