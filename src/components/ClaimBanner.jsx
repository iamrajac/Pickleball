import { useState, useMemo } from "react";
import { ref, set } from "firebase/database";
import { db } from "../firebase";
import { findBestMatches } from "../utils/nameMatcher";
import { saveFullTournament } from "../hooks/useTournament";
import { loadH } from "../utils/history";

export function ClaimBanner({ code, players, currentUser, existingClaims, profiles, onClaimed, readOnly, displayNameOverride }) {
  const [claimed, setClaimed] = useState(null);
  const [claiming, setClaiming] = useState(false);

  // Only show for spectators (readOnly = true) who are logged in
  // "dismissed" means explicitly closed with X — don't re-show
  // "claimed" means already successfully claimed — skip
  const savedState = localStorage.getItem(`pkl_claimed_${code}`);
  const alreadyClaimed = savedState && savedState !== "__dismissed__";
  const dismissed = savedState === "__dismissed__";
  const displayName = displayNameOverride || currentUser?.displayName || currentUser?.email?.split("@")[0] || "";

  // Show all unclaimed players — let the user pick their own name
  // Also try fuzzy match to highlight the most likely one first
  const matches = useMemo(() => {
    if (!players || !players.length) return [];
    const claims = existingClaims || {};
    const unclaimed = players.filter(p => {
      const key = p.replace(/\s+/g, "_").toLowerCase();
      return !claims[key];
    });
    if (!unclaimed.length) return [];
    // If displayName exists, sort by fuzzy match score (best match first)
    if (displayName) {
      const scored = findBestMatches(unclaimed, displayName, 0);
      return scored.length ? scored : unclaimed.map(name => ({ name, score: 0 }));
    }
    return unclaimed.map(name => ({ name, score: 0 }));
  }, [players, displayName, existingClaims]);

  if (!readOnly || !currentUser || dismissed || alreadyClaimed || claimed || matches.length === 0) return null;

  const handleClaim = async (playerName) => {
    setClaiming(true);
    try {
      const key = playerName.replace(/\s+/g, "_").toLowerCase();
      const claimData = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "",
        photoURL: currentUser.photoURL || null,
        claimedAt: Date.now(),
      };
      // Write claim
      await set(ref(db, `tournaments/${code}/claims/${key}`), claimData);

      // Write profile so avatar shows immediately
      await set(ref(db, `tournaments/${code}/profiles/${playerName}`), {
        emoji: currentUser.photoURL ? null : "👤",
        color: "#10d48e",
        photoURL: currentUser.photoURL || null,
        displayName: currentUser.displayName || playerName,
      });

      // Save tournament to user's history/Firestore
      const local = loadH().find(t => t.code === code);
      if (local && currentUser.uid) {
        saveFullTournament(currentUser.uid, { ...local, code });
      }

      setClaimed(playerName);
      localStorage.setItem(`pkl_claimed_${code}`, playerName);
      if (onClaimed) onClaimed(playerName);
    } catch (e) {
      console.error("Claim error:", e);
    } finally {
      setClaiming(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(`pkl_claimed_${code}`, "__dismissed__");
    setClaimed("__dismissed__");
  };

  return (
    <div style={{
      margin: "8px 0",
      padding: "12px 14px",
      background: "rgba(16,212,142,0.08)",
      border: "1px solid rgba(16,212,142,0.25)",
      borderRadius: 10,
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      position: "relative",
    }}>
      <div style={{ fontSize: 18, flexShrink: 0 }}>🏓</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-lime)", marginBottom: 6 }}>
          Is this you in this tournament?
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {matches.map(({ name }) => (
            <button
              key={name}
              className="pb"
              disabled={claiming}
              onClick={() => handleClaim(name)}
              style={{
                padding: "6px 12px",
                background: "rgba(16,212,142,0.15)",
                border: "1px solid rgba(16,212,142,0.4)",
                borderRadius: 20,
                color: "var(--color-lime)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
          Your name: {displayName} · Tap to claim and add to your stats
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>
        ×
      </button>
    </div>
  );
}
