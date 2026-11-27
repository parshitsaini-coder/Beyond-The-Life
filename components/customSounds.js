/* ================================================================
   CUSTOM ALARM SOUNDS — "add a sound from my own files"
   ----------------------------------------------------------------
   The person picks an audio file in Setting → Alarm. The file itself is
   kept in this browser's IndexedDB (a Firestore document can't hold
   audio), so it works offline and survives reloads, but it lives on THIS
   device only — add it again on another phone/PC. Only the ringtone id
   ("custom:<uid>") is saved with the rest of the app state; if that id
   isn't found on a device the app quietly falls back to a built-in tone.

   Exposes a tiny sync cache (urlFor / nameFor) so the alarm player can
   resolve a custom id to a playable blob: URL without awaiting anything
   at ring time, plus a React hook for the settings UI.
   ================================================================ */
import { useEffect, useState } from "react";

export const CUSTOM_PREFIX = "custom:";
export const isCustomSoundId = (id) => typeof id === "string" && id.startsWith(CUSTOM_PREFIX);
export const CUSTOM_SOUND_MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file
export const CUSTOM_SOUND_MAX_COUNT = 12;

const DB_NAME = "btl-custom-sounds";
const STORE = "sounds";
const EVENT = "btl-custom-sounds-changed";

const urls = {};   // id -> blob: URL
const names = {};  // id -> display name
let list = [];     // [{ id, name, size }]
let loadPromise = null;

export const customSoundUrl = (id) => urls[id] || null;
export const customSoundName = (id) => names[id] || null;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB not available")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Could not open sound storage"));
  });
}
const tx = (db, mode, fn) => new Promise((resolve, reject) => {
  const t = db.transaction(STORE, mode);
  const out = fn(t.objectStore(STORE));
  t.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
  t.onerror = () => reject(t.error || new Error("Sound storage error"));
  t.onabort = () => reject(t.error || new Error("Sound storage aborted"));
});

const notify = () => { try { window.dispatchEvent(new Event(EVENT)); } catch (e) { /* ssr */ } };

/* Reads every saved sound into the sync cache. Safe to call many times. */
export function loadCustomSounds(force = false) {
  if (typeof window === "undefined") return Promise.resolve([]);
  if (loadPromise && !force) return loadPromise;
  loadPromise = (async () => {
    try {
      const db = await openDb();
      const rows = await tx(db, "readonly", (store) => store.getAll());
      db.close();
      Object.values(urls).forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
      Object.keys(urls).forEach((k) => delete urls[k]);
      Object.keys(names).forEach((k) => delete names[k]);
      const sorted = (rows || []).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      sorted.forEach((r) => { urls[r.id] = URL.createObjectURL(r.blob); names[r.id] = r.name; });
      list = sorted.map((r) => ({ id: r.id, name: r.name, size: r.blob ? r.blob.size : 0 }));
    } catch (e) { list = []; }
    notify();
    return list;
  })();
  return loadPromise;
}

const prettyName = (filename) => {
  const base = String(filename || "My sound").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "My sound").slice(0, 28);
};

/* Validates + stores a File. Resolves { id, name } or throws an Error with a
   message that is safe to show the person. */
export async function addCustomSound(file) {
  if (!file) throw new Error("No file chosen");
  const looksAudio = (file.type && file.type.startsWith("audio/")) || /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name || "");
  if (!looksAudio) throw new Error("Please choose an audio file (mp3, wav, m4a, ogg…)");
  if (file.size > CUSTOM_SOUND_MAX_BYTES) throw new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB — max is 8 MB`);
  await loadCustomSounds();
  if (list.length >= CUSTOM_SOUND_MAX_COUNT) throw new Error(`You can keep up to ${CUSTOM_SOUND_MAX_COUNT} custom sounds — remove one first`);
  // make sure the browser can actually decode it before saving
  await new Promise((resolve, reject) => {
    const probeUrl = URL.createObjectURL(file);
    const a = new Audio();
    const done = (err) => { URL.revokeObjectURL(probeUrl); err ? reject(err) : resolve(); };
    a.onloadedmetadata = () => done(null);
    a.onerror = () => done(new Error("This browser can't play that file — try an mp3 or wav"));
    a.preload = "metadata";
    a.src = probeUrl;
  });
  const id = `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = prettyName(file.name);
  const db = await openDb();
  try {
    await tx(db, "readwrite", (store) => store.put({ id, name, type: file.type, blob: file, ts: Date.now() }));
  } catch (e) {
    throw new Error("Couldn't save the sound on this device (storage full or blocked)");
  } finally { db.close(); }
  await loadCustomSounds(true);
  return { id, name };
}

export async function removeCustomSound(id) {
  try {
    const db = await openDb();
    await tx(db, "readwrite", (store) => store.delete(id));
    db.close();
  } catch (e) { /* nothing to delete */ }
  await loadCustomSounds(true);
}

/* React hook — returns the current list and re-renders on add/remove. */
export function useCustomSounds() {
  const [items, setItems] = useState(list);
  useEffect(() => {
    let alive = true;
    const sync = () => { if (alive) setItems([...list]); };
    window.addEventListener(EVENT, sync);
    loadCustomSounds().then(sync);
    return () => { alive = false; window.removeEventListener(EVENT, sync); };
  }, []);
  return items;
}
