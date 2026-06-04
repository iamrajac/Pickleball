// ── Global player profiles (persist avatars across tournaments) ──────────────
// Keyed by normalized player name so "Max", "max", "MAX" all share the same profile.
// localStorage: 'pkl_global_profiles' → { normalizedName: { photo, color, ... } }
// Firestore: users/{uid}/settings/profiles → same structure (for cross-device sync)

const KEY = 'pkl_global_profiles';

export function getGlobalProfiles() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function saveGlobalProfiles(profiles) {
  try { localStorage.setItem(KEY, JSON.stringify(profiles)); } catch {}
}

// Merge tournament profiles into the global store
// Only updates if the incoming profile has actual data (photo or color)
export function mergeIntoGlobal(tournamentProfiles) {
  if (!tournamentProfiles || !Object.keys(tournamentProfiles).length) return;
  const current = getGlobalProfiles();
  let changed = false;
  Object.entries(tournamentProfiles).forEach(([name, profile]) => {
    if (profile && (profile.photo || profile.color || profile.type)) {
      const existing = current[name] || {};
      const merged = { ...existing, ...profile };
      // Only update if something actually changed
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        current[name] = merged;
        changed = true;
      }
    }
  });
  if (changed) saveGlobalProfiles(current);
}

// Get profiles pre-filled for a list of player names
export function profilesForPlayers(playerNames) {
  const global = getGlobalProfiles();
  const result = {};
  (playerNames || []).forEach(name => {
    if (global[name]) result[name] = global[name];
  });
  return result;
}

// Sync global profiles to Firestore for cross-device (Google users)
export async function syncGlobalProfilesToFirestore(uid, firestore) {
  if (!uid || !firestore) return;
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const profiles = getGlobalProfiles();
    if (!Object.keys(profiles).length) return;
    await setDoc(doc(firestore, 'users', uid, 'settings', 'profiles'), profiles, { merge: true });
  } catch {}
}

// Load global profiles from Firestore into localStorage
export async function loadGlobalProfilesFromFirestore(uid, firestore) {
  if (!uid || !firestore) return;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(firestore, 'users', uid, 'settings', 'profiles'));
    if (snap.exists()) {
      const remote = snap.data();
      const local = getGlobalProfiles();
      // Merge: remote fills in gaps, local overrides if both exist
      saveGlobalProfiles({ ...remote, ...local });
    }
  } catch {}
}
