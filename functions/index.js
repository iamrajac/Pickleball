const functions = require("firebase-functions");
const admin     = require("firebase-admin");

admin.initializeApp();

const db        = admin.database();
const firestore = admin.firestore();

// ── Helper: send FCM to all subscribers of a tournament ───────────────────
async function notifySubscribers(code, title, body, tag) {
  const subsSnap = await db.ref(`tournaments/${code}/subscribers`).once("value");
  if (!subsSnap.exists()) return;

  const uids = Object.keys(subsSnap.val());
  const tokens = [];

  for (const uid of uids) {
    try {
      const userSnap = await firestore.doc(`users/${uid}`).get();
      if (userSnap.exists()) {
        const fcmTokens = userSnap.data().fcmTokens || [];
        tokens.push(...fcmTokens);
      }
    } catch {}
  }

  if (!tokens.length) return;

  // sendEachForMulticast handles stale tokens gracefully
  const result = await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    data: { tag, code },
    tokens,
  });

  // Remove tokens that are no longer valid
  const staleTokens = [];
  result.responses.forEach((resp, i) => {
    if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
      staleTokens.push(tokens[i]);
    }
  });
  if (staleTokens.length) {
    for (const uid of uids) {
      try {
        const userRef = firestore.doc(`users/${uid}`);
        const snap = await userRef.get();
        if (!snap.exists()) continue;
        const filtered = (snap.data().fcmTokens || []).filter(t => !staleTokens.includes(t));
        await userRef.update({ fcmTokens: filtered });
      } catch {}
    }
  }
}

// ── 1. Auto-start scheduled tournaments (runs every minute) ───────────────
exports.autoStartTournaments = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    const now = Date.now();
    // Find tournaments scheduled within the last 2 minutes (catches up if function was delayed)
    const snap = await db.ref("tournaments")
      .orderByChild("scheduledAt")
      .startAt(now - 2 * 60 * 1000)
      .endAt(now)
      .once("value");

    if (!snap.exists()) return null;

    const updates = {};
    const notifications = [];

    snap.forEach(child => {
      const data = child.val();
      // Only auto-start if not already started and no champion yet
      if (!data.champion && data.status !== "live") {
        updates[`tournaments/${child.key}/status`] = "live";
        notifications.push({ code: child.key, name: data.name || child.key });
      }
    });

    if (Object.keys(updates).length) {
      await db.ref().update(updates);
      for (const { code, name } of notifications) {
        await notifySubscribers(
          code,
          "🏓 Tournament is LIVE now!",
          `${name} has started — good luck!`,
          "tournament_start"
        );
      }
    }

    return null;
  });

// ── 2. Notify all subscribers when champion is declared ───────────────────
exports.onChampionDeclared = functions.database
  .ref("tournaments/{code}/champion")
  .onWrite(async (change, context) => {
    const champion = change.after.val();
    // Only fire when champion is newly set (not cleared)
    if (!champion || !change.before.val() === null) {
      if (change.before.val()) return null; // champion was cleared, skip
    }
    if (!champion) return null;

    const { code } = context.params;
    const snap = await db.ref(`tournaments/${code}/name`).once("value");
    const tournamentName = snap.val() || code;

    await notifySubscribers(
      code,
      `🏆 ${champion} are Champions!`,
      `${tournamentName} has ended. Check the final standings!`,
      "champion"
    );

    return null;
  });

// ── 3. Notify when a new announcement is posted ───────────────────────────
exports.onAnnouncementPosted = functions.database
  .ref("tournaments/{code}/announcements/{announcementId}")
  .onCreate(async (snap, context) => {
    const announcement = snap.val();
    if (!announcement?.text) return null;

    const { code } = context.params;
    const nameSnap = await db.ref(`tournaments/${code}/name`).once("value");
    const tournamentName = nameSnap.val() || code;

    await notifySubscribers(
      code,
      `📢 ${tournamentName}`,
      announcement.text,
      "announcement"
    );

    return null;
  });
