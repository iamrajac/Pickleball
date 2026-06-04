import {
  doc, getDoc, setDoc, collection,
  query, where, orderBy, limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../firebase";

// ── Validation ──────────────────────────────────────────────────────────────

export function validateUsername(raw) {
  const u = raw.trim().toLowerCase();
  if (u.length < 3)  return "At least 3 characters";
  if (u.length > 20) return "Max 20 characters";
  if (!/^[a-z0-9_]+$/.test(u)) return "Only letters, numbers and underscores";
  return null; // valid
}

// ── Claim username ───────────────────────────────────────────────────────────

export async function claimUsername(uid, username, displayName) {
  const u = username.trim().toLowerCase();
  const uRef = doc(firestore, "usernames", u);
  const uSnap = await getDoc(uRef);
  if (uSnap.exists() && uSnap.data().uid !== uid) throw new Error("Username already taken");

  await setDoc(uRef, { uid });
  await setDoc(doc(firestore, "players", uid), {
    uid, username: u, displayName: displayName || username,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
  return u;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function getPlayerByUsername(username) {
  try {
    const uSnap = await getDoc(doc(firestore, "usernames", username.toLowerCase()));
    if (!uSnap.exists()) return null;
    const uid = uSnap.data().uid;
    return getPlayerByUid(uid);
  } catch { return null; }
}

export async function getPlayerByUid(uid) {
  try {
    const snap = await getDoc(doc(firestore, "players", uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch { return null; }
}

// ── Search players ───────────────────────────────────────────────────────────

export async function searchPlayers(term) {
  if (!term || term.length < 2) return [];
  const t = term.toLowerCase();
  try {
    const q = query(
      collection(firestore, "players"),
      where("username", ">=", t),
      where("username", "<=", t + ""),
      limit(6),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch { return []; }
}

// ── Update stats snapshot on player doc ────────────────────────────────────

export async function updatePlayerStats(uid, stats) {
  if (!uid) return;
  try {
    await setDoc(doc(firestore, "players", uid), {
      stats, updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {}
}

// ── Compute badges from stats ────────────────────────────────────────────────

export const BADGES = [
  { id: "first_win",   emoji: "🥇", label: "First Win",      check: s => s.wins >= 1 },
  { id: "champion",    emoji: "🏆", label: "Champion",        check: s => s.titles >= 1 },
  { id: "5x_champ",   emoji: "👑", label: "5× Champion",     check: s => s.titles >= 5 },
  { id: "10_matches",  emoji: "🎯", label: "10 Matches",      check: s => s.matches >= 10 },
  { id: "50_matches",  emoji: "💪", label: "50 Matches",      check: s => s.matches >= 50 },
  { id: "sharpshooter",emoji: "⚡", label: "Sharpshooter",    check: s => s.winRate >= 70 && s.matches >= 10 },
  { id: "streak5",     emoji: "🔥", label: "5-Win Streak",    check: s => s.bestStreak >= 5 },
  { id: "comeback",    emoji: "💥", label: "Comeback King",   check: s => s.wins >= 5 && s.diff < 0 },
];

export function computeBadges(stats) {
  return BADGES.filter(b => b.check(stats));
}
