import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { messagingPromise, firestore } from "../firebase";

// ── Get this from Firebase Console ────────────────────────────────────────
// Project Settings → Cloud Messaging → Web Push certificates → Key pair
const VAPID_KEY = "YOUR_VAPID_KEY_HERE";

// Request notification permission, get FCM token, save to users/{uid}/fcmTokens
export async function initFCM(uid) {
  if (!uid) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;

  const messaging = await messagingPromise;
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

    await updateDoc(doc(firestore, "users", uid), {
      fcmTokens: arrayUnion(token),
    });
  } catch (e) {
    console.warn("FCM init failed:", e);
  }
}

// Subscribe to a tournament — lets Cloud Functions know to notify this user
export async function subscribeToTournament(uid, tournamentCode, db) {
  if (!uid || !tournamentCode) return;
  const { ref, set } = await import("firebase/database");
  try {
    await set(ref(db, `tournaments/${tournamentCode}/subscribers/${uid}`), true);
  } catch {}
}

// Listen for foreground messages (app is open)
export async function onForegroundMessage(callback) {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
