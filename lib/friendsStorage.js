"use client";
import {
  doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot, serverTimestamp, limit,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

/* ============================================================
   FRIEND CELEBRATION — Firestore layer
   New collections (see firestore.rules for security):
     users_public/{uid}                — tiny public profile so people
                                          can be found by email to invite
     friend_requests/{autoId}          — { fromUid, fromName, fromPhoto,
                                            toUid, toName, toPhoto,
                                            status: pending|accepted|declined,
                                            createdAt }
     friendships/{friendshipId}        — id = sorted "uidA_uidB"
                                          { uids:[a,b], users:{a:{...},b:{...}}, createdAt }
     friend_chats/{friendshipId}/messages/{autoId}
                                        — { fromUid, fromName, text, createdAt }
   ============================================================ */

export function friendshipId(a, b) {
  return [a, b].sort().join("_");
}

/* Keep a lightweight public profile doc in sync so friends can find you
   by email and so their "your name / your photo" always shows fresh. */
export async function ensurePublicProfile(user) {
  if (!user) return;
  const ref = doc(db, "users_public", user.uid);
  const data = {
    uid: user.uid,
    name: user.displayName || user.email || "BTL User",
    photoURL: user.photoURL || "",
    email: user.email || "",
    emailLower: (user.email || "").toLowerCase(),
    updatedAt: Date.now(),
  };
  try {
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().name !== data.name || snap.data().photoURL !== data.photoURL) {
      await setDoc(ref, data, { merge: true });
    }
  } catch (e) {
    console.error("ensurePublicProfile failed", e);
  }
}

export async function findUserByEmail(email) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return null;
  const q = query(collection(db, "users_public"), where("emailLower", "==", clean), limit(1));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  return snaps.docs[0].data();
}

/* All other people who have ever opened the dashboard (users_public is
   readable by any signed-in user — see firestore.rules). Used by the
   "Discover" panel so you can see everyone and request them directly,
   instead of only inviting by typing an exact email. Excludes yourself. */
export async function listAllUsers(myUid) {
  const snaps = await getDocs(collection(db, "users_public"));
  return snaps.docs
    .map((d) => d.data())
    .filter((u) => u.uid && u.uid !== myUid);
}

/* Send a request directly to a known uid (no email lookup needed —
   used by the Discover list where we already have their profile). */
export async function sendFriendRequestToUid(fromUser, target) {
  if (!target?.uid) return { ok: false, reason: "error" };
  if (target.uid === fromUser.uid) return { ok: false, reason: "self" };

  const fsId = friendshipId(fromUser.uid, target.uid);
  const already = await getDoc(doc(db, "friendships", fsId));
  if (already.exists()) return { ok: false, reason: "already_friends" };

  const dupQ = query(
    collection(db, "friend_requests"),
    where("fromUid", "==", fromUser.uid),
    where("toUid", "==", target.uid),
    where("status", "==", "pending"),
    limit(1)
  );
  const dup = await getDocs(dupQ);
  if (!dup.empty) return { ok: false, reason: "already_sent" };

  await addDoc(collection(db, "friend_requests"), {
    fromUid: fromUser.uid,
    fromName: fromUser.displayName || fromUser.email || "BTL User",
    fromPhoto: fromUser.photoURL || "",
    toUid: target.uid,
    toName: target.name || "",
    toPhoto: target.photoURL || "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return { ok: true };
}

/* Send an invite by email. Returns { ok: true } or { ok: false, reason }. */
export async function sendFriendRequestByEmail(fromUser, toEmail) {
  const target = await findUserByEmail(toEmail);
  if (!target) return { ok: false, reason: "not_found" };
  return sendFriendRequestToUid(fromUser, target);
}

export function listenIncomingRequests(uid, cb) {
  if (!uid) return () => {};
  const q = query(collection(db, "friend_requests"), where("toUid", "==", uid), where("status", "==", "pending"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export function listenOutgoingRequests(uid, cb) {
  if (!uid) return () => {};
  const q = query(collection(db, "friend_requests"), where("fromUid", "==", uid), where("status", "==", "pending"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export async function acceptFriendRequest(request) {
  const fsId = friendshipId(request.fromUid, request.toUid);
  await setDoc(doc(db, "friendships", fsId), {
    uids: [request.fromUid, request.toUid],
    users: {
      [request.fromUid]: { name: request.fromName || "", photoURL: request.fromPhoto || "" },
      [request.toUid]: { name: request.toName || "", photoURL: request.toPhoto || "" },
    },
    createdAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, "friend_requests", request.id));
}

export async function declineFriendRequest(requestId) {
  await deleteDoc(doc(db, "friend_requests", requestId));
}

export async function cancelFriendRequest(requestId) {
  await deleteDoc(doc(db, "friend_requests", requestId));
}

export async function unfriend(fsId) {
  await deleteDoc(doc(db, "friendships", fsId));
}

export function listenFriendships(uid, cb) {
  if (!uid) return () => {};
  const q = query(collection(db, "friendships"), where("uids", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const otherUid = (data.uids || []).find((u) => u !== uid);
        const other = (data.users && data.users[otherUid]) || {};
        return { id: d.id, otherUid, name: other.name || "Friend", photoURL: other.photoURL || "", createdAt: data.createdAt };
      });
      cb(list);
    },
    () => cb([])
  );
}

export function listenFriendState(friendUid, cb) {
  if (!friendUid) return () => {};
  return onSnapshot(
    doc(db, "btl_state", friendUid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null)
  );
}

export function listenChatMessages(fsId, cb) {
  if (!fsId) return () => {};
  const q = query(collection(db, "friend_chats", fsId, "messages"), orderBy("createdAt", "asc"), limit(300));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export async function sendChatMessage(fsId, fromUid, fromName, text) {
  const clean = (text || "").trim();
  if (!clean) return;
  await addDoc(collection(db, "friend_chats", fsId, "messages"), {
    fromUid, fromName: fromName || "", text: clean, createdAt: serverTimestamp(),
  });
}

/* Small live badge-count hook: how many incoming friend requests are
   waiting, so the header icon can show a red counter without the whole
   Friend Celebration panel needing to be mounted/open. */
export function useIncomingFriendRequestCount(uid) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!uid) { setCount(0); return; }
    const unsub = listenIncomingRequests(uid, (list) => setCount(list.length));
    return unsub;
  }, [uid]);
  return count;
}
