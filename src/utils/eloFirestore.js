import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { firestore } from "../firebase";

// claims = { "player_name_key": { uid, displayName, ... } }
// Returns { displayName: eloRating } for all claimed players
export async function loadClaimedElos(claims, players) {
  const nameToElo = {};
  await Promise.all(
    Object.entries(claims || {}).map(async ([key, claim]) => {
      if (!claim?.uid) return;
      // Match claim key back to original player name
      const playerName = (players || []).find(
        p => p.replace(/\s+/g, "_").toLowerCase() === key
      );
      if (!playerName) return;
      try {
        const snap = await getDoc(doc(firestore, "users", claim.uid));
        if (snap.exists()) {
          nameToElo[playerName] = snap.data().eloRating ?? 1200;
        }
      } catch {}
    })
  );
  return nameToElo;
}

// Save updated ELO ratings back to each claimed player's Firestore profile
export async function saveClaimedElos(claims, players, elosBefore, elosAfter, tournamentCode, tournamentName) {
  await Promise.all(
    Object.entries(claims || {}).map(async ([key, claim]) => {
      if (!claim?.uid) return;
      const playerName = (players || []).find(
        p => p.replace(/\s+/g, "_").toLowerCase() === key
      );
      if (!playerName) return;
      const ratingAfter = elosAfter[playerName];
      if (ratingAfter === undefined) return;
      const ratingBefore = elosBefore[playerName] ?? 1200;
      try {
        console.log("[ELO] saving for", playerName, "uid:", claim.uid, "rating:", ratingAfter);
        await updateDoc(doc(firestore, "users", claim.uid), {
          eloRating: ratingAfter,
          eloHistory: arrayUnion({
            tournamentCode,
            tournamentName: tournamentName || tournamentCode,
            ratingBefore,
            ratingAfter,
            delta: ratingAfter - ratingBefore,
            date: new Date().toISOString(),
          }),
        });
        console.log("[ELO] saved OK for", playerName);
      } catch (e) {
        console.error("[ELO] save failed for", playerName, e.code, e.message);
      }
    })
  );
}
