import { useState, useEffect, useCallback } from "react";
import {
  doc, collection, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { ref, get } from "firebase/database";
import { firestore, db } from "../firebase";

function genClubCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ── Club CRUD ──────────────────────────────────────────────────────────────

export async function createClub({ name, description = "", themeColor = "#10d48e" }) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  const user = auth.currentUser;
  if (!uid) throw new Error("Not logged in");

  // Use in-app display name from Firestore profile (set in Account), fall back to Google name
  const profileSnap = await getDoc(doc(firestore, "players", uid));
  const profileName = profileSnap.exists() ? (profileSnap.data().displayName || user.displayName || "Admin") : (user.displayName || "Admin");
  const avatarObj = profileSnap.exists() ? (profileSnap.data().avatar || null) : null;
  const profilePhoto = avatarObj?.type === "image" ? avatarObj.value : (user.photoURL || null);

  const clubId = `${Date.now()}_${uid.slice(0, 6)}`;
  const code = genClubCode();

  const clubRef = doc(firestore, "clubs", clubId);
  await setDoc(clubRef, {
    id: clubId, name, description, themeColor, code,
    adminUid: uid, memberCount: 1, createdAt: serverTimestamp(),
  });

  // Add creator as admin member
  await setDoc(doc(firestore, "clubs", clubId, "members", uid), {
    uid, name: profileName,
    photoURL: profilePhoto,
    avatar: avatarObj,
    role: "admin", joinedAt: serverTimestamp(),
    playerName: profileName,
  });

  // Add club to user's profile
  await updateDoc(doc(firestore, "users", uid), {
    clubs: arrayUnion(clubId),
  });

  return { clubId, code };
}

export async function joinClub(code) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  const user = auth.currentUser;
  if (!uid) throw new Error("Not logged in");

  // Find club by code
  const { getDocs: gd, collection: col, query, where } = await import("firebase/firestore");
  const q = query(col(firestore, "clubs"), where("code", "==", code.toUpperCase()));
  const snap = await gd(q);
  if (snap.empty) throw new Error("Club not found");

  const clubDoc = snap.docs[0];
  const clubId = clubDoc.id;

  // Check not already a member
  const memberSnap = await getDoc(doc(firestore, "clubs", clubId, "members", uid));
  if (memberSnap.exists()) throw new Error("Already a member");

  // Use in-app display name from Firestore profile (set in Account), fall back to Google name
  const profileSnap = await getDoc(doc(firestore, "players", uid));
  const profileName = profileSnap.exists() ? (profileSnap.data().displayName || user.displayName || "Player") : (user.displayName || "Player");
  const avatarObjJ = profileSnap.exists() ? (profileSnap.data().avatar || null) : null;
  const profilePhoto = avatarObjJ?.type === "image" ? avatarObjJ.value : (user.photoURL || null);

  await setDoc(doc(firestore, "clubs", clubId, "members", uid), {
    uid, name: profileName,
    photoURL: profilePhoto,
    avatar: avatarObjJ,
    role: "member", joinedAt: serverTimestamp(),
    playerName: profileName,
  });

  await updateDoc(doc(firestore, "clubs", clubId), {
    memberCount: (clubDoc.data().memberCount || 0) + 1,
  });

  await updateDoc(doc(firestore, "users", uid), {
    clubs: arrayUnion(clubId),
  });

  return { clubId, club: clubDoc.data() };
}

export async function requestJoinClub(code) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  const user = auth.currentUser;
  if (!uid) throw new Error("Not logged in");

  const { getDocs: gd, collection: col, query, where } = await import("firebase/firestore");
  const q = query(col(firestore, "clubs"), where("code", "==", code.toUpperCase()));
  const snap = await gd(q);
  if (snap.empty) throw new Error("Club not found");

  const clubDoc = snap.docs[0];
  const clubId = clubDoc.id;

  // Already a member?
  const memberSnap = await getDoc(doc(firestore, "clubs", clubId, "members", uid));
  if (memberSnap.exists()) throw new Error("Already a member");

  // Already pending?
  const pendingSnap = await getDoc(doc(firestore, "clubs", clubId, "pendingMembers", uid));
  if (pendingSnap.exists()) throw new Error("Request already sent");

  const profileSnap = await getDoc(doc(firestore, "players", uid));
  const profileName = profileSnap.exists() ? (profileSnap.data().displayName || user.displayName || "Player") : (user.displayName || "Player");
  const avatarObj = profileSnap.exists() ? (profileSnap.data().avatar || null) : null;
  const profilePhoto = avatarObj?.type === "image" ? avatarObj.value : (user.photoURL || null);

  await setDoc(doc(firestore, "clubs", clubId, "pendingMembers", uid), {
    uid, name: profileName, photoURL: profilePhoto, avatar: avatarObj,
    playerName: profileName, requestedAt: serverTimestamp(),
  });

  // Track pending club in user doc for badge display
  await updateDoc(doc(firestore, "users", uid), {
    pendingClubs: arrayUnion(clubId),
  });

  return { clubId, clubName: clubDoc.data().name };
}

export async function approveJoinRequest(clubId, pendingUid) {
  const pendingRef = doc(firestore, "clubs", clubId, "pendingMembers", pendingUid);
  const pendingSnap = await getDoc(pendingRef);
  if (!pendingSnap.exists()) return;

  const data = pendingSnap.data();
  await setDoc(doc(firestore, "clubs", clubId, "members", pendingUid), {
    ...data, role: "member", joinedAt: serverTimestamp(),
  });
  await deleteDoc(pendingRef);

  const clubSnap = await getDoc(doc(firestore, "clubs", clubId));
  if (clubSnap.exists()) {
    await updateDoc(doc(firestore, "clubs", clubId), {
      memberCount: (clubSnap.data().memberCount || 0) + 1,
    });
  }

  await updateDoc(doc(firestore, "users", pendingUid), {
    clubs: arrayUnion(clubId),
    pendingClubs: arrayRemove(clubId),
  });
}

export async function rejectJoinRequest(clubId, pendingUid) {
  await deleteDoc(doc(firestore, "clubs", clubId, "pendingMembers", pendingUid));
  await updateDoc(doc(firestore, "users", pendingUid), {
    pendingClubs: arrayRemove(clubId),
  });
}

export async function setMemberRole(clubId, memberUid, role) {
  await updateDoc(doc(firestore, "clubs", clubId, "members", memberUid), { role });
}

export async function kickMember(clubId, memberUid) {
  await deleteDoc(doc(firestore, "clubs", clubId, "members", memberUid));
  try {
    await updateDoc(doc(firestore, "users", memberUid), { clubs: arrayRemove(clubId) });
  } catch {}
  try {
    const clubSnap = await getDoc(doc(firestore, "clubs", clubId));
    if (clubSnap.exists()) {
      const current = clubSnap.data().memberCount || 1;
      await updateDoc(doc(firestore, "clubs", clubId), { memberCount: Math.max(0, current - 1) });
    }
  } catch {}
}

export async function syncProfileToClubs(uid, clubIds, { displayName, avatar }) {
  if (!uid || !clubIds?.length) return;
  const photoURL = avatar?.type === "image" ? avatar.value : null;
  await Promise.all(clubIds.map(clubId =>
    updateDoc(doc(firestore, "clubs", clubId, "members", uid), {
      name: displayName,
      playerName: displayName,
      avatar: avatar || null,
      photoURL: photoURL || null,
    }).catch(() => {})
  ));
}

export async function leaveClub(clubId) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  // If leaving as an admin, auto-promote earliest-joined member if no other admin remains
  const memberSnap = await getDoc(doc(firestore, "clubs", clubId, "members", uid));
  if (memberSnap.exists() && memberSnap.data().role === "admin") {
    const allSnap = await getDocs(collection(firestore, "clubs", clubId, "members"));
    const others = allSnap.docs.filter(d => d.id !== uid).map(d => ({ uid: d.id, ...d.data() }));
    const hasOtherAdmin = others.some(m => m.role === "admin");
    if (!hasOtherAdmin && others.length > 0) {
      const earliest = [...others].sort((a, b) => (a.joinedAt?.seconds || 0) - (b.joinedAt?.seconds || 0))[0];
      await updateDoc(doc(firestore, "clubs", clubId, "members", earliest.uid), { role: "admin" });
    }
  }
  await deleteDoc(doc(firestore, "clubs", clubId, "members", uid));
  await updateDoc(doc(firestore, "users", uid), { clubs: arrayRemove(clubId) });
  try {
    const clubSnap = await getDoc(doc(firestore, "clubs", clubId));
    if (clubSnap.exists()) {
      const current = clubSnap.data().memberCount || 1;
      await updateDoc(doc(firestore, "clubs", clubId), { memberCount: Math.max(0, current - 1) });
    }
  } catch {}
}

// Compute per-player wins/losses from all matches in a tournament entry
function computePlayerStats(entry) {
  const stats = {};
  const ensure = (name) => {
    if (name && !stats[name]) stats[name] = { wins: 0, losses: 0, matches: 0 };
  };
  const processMatch = (m) => {
    if (!m || !m.played || !m.teamA || !m.teamB) return;
    const aWon = m.scoreA > m.scoreB;
    [...m.teamA, ...m.teamB].forEach(ensure);
    m.teamA.forEach(p => {
      stats[p].matches++;
      if (aWon) stats[p].wins++; else stats[p].losses++;
    });
    m.teamB.forEach(p => {
      stats[p].matches++;
      if (!aWon) stats[p].wins++; else stats[p].losses++;
    });
  };
  (entry.rounds || []).forEach(round => {
    const matches = Array.isArray(round) ? round : (round?.matches || []);
    matches.forEach(processMatch);
  });
  if (entry.playoffs) Object.values(entry.playoffs).forEach(processMatch);
  return stats;
}

// Get the active season ID for a club (returns null if none)
export async function getActiveSeasonId(clubId) {
  if (!clubId) return null;
  try {
    const { query, where, collection: col, getDocs: gd } = await import("firebase/firestore");
    const q = query(col(firestore, "clubs", clubId, "seasons"), where("status", "==", "active"));
    const snap = await gd(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch { return null; }
}

export async function saveTournamentToClub(clubId, tournamentEntry) {
  if (!clubId || !tournamentEntry?.code) return;
  const playerStats = computePlayerStats(tournamentEntry);
  await setDoc(doc(firestore, "clubs", clubId, "tournaments", tournamentEntry.code), {
    code: tournamentEntry.code,
    name: tournamentEntry.name || "",
    date: tournamentEntry.date || new Date().toISOString(),
    champion: tournamentEntry.champion || null,
    playerCount: tournamentEntry.players?.length || 0,
    status: tournamentEntry.champion ? "completed" : "live",
    players: tournamentEntry.players || [],
    playerStats,
  }, { merge: true });
}

export async function removeTournamentFromClub(clubId, tournamentCode) {
  if (!clubId || !tournamentCode) return;
  await deleteDoc(doc(firestore, "clubs", clubId, "tournaments", tournamentCode));
}

// ── Season CRUD ────────────────────────────────────────────────────────────

export async function createSeason(clubId, name) {
  const seasonId = `${Date.now()}`;
  await setDoc(doc(firestore, "clubs", clubId, "seasons", seasonId), {
    id: seasonId, name, status: "active",
    tournaments: [], standings: {},
    createdAt: serverTimestamp(),
  });
  return seasonId;
}

export async function endSeason(clubId, seasonId) {
  await updateDoc(doc(firestore, "clubs", clubId, "seasons", seasonId), { status: "completed" });
}

export async function addTournamentToSeason(clubId, seasonId, tournamentCode, players, champion, playoffs) {
  const seasonRef = doc(firestore, "clubs", clubId, "seasons", seasonId);
  const snap = await getDoc(seasonRef);
  if (!snap.exists()) return;

  const season = snap.data();
  if ((season.tournaments || []).includes(tournamentCode)) return;

  const losingTeam = (match) => {
    if (!match?.played) return [];
    return (match.scoreA > match.scoreB ? match.teamB : match.teamA) || [];
  };

  const silverTeam = playoffs?.final ? losingTeam(playoffs.final) : [];

  let bronzeTeam = [];
  if (playoffs) {
    const mode = playoffs.mode;
    if (mode === "ipl8" || mode === "top8_ipl") bronzeTeam = losingTeam(playoffs.q2);
    else if (mode === "ipl6") bronzeTeam = losingTeam(playoffs.elim);
    else if (mode === "elim_to_sf") bronzeTeam = losingTeam(playoffs.sf);
    else if (mode === "top8") bronzeTeam = [...losingTeam(playoffs.sf1), ...losingTeam(playoffs.sf2)];
  }

  const championSet = new Set(champion ? champion.split(" & ").map(s => s.trim().toLowerCase()) : []);
  const silverSet = new Set(silverTeam.map(s => s.toLowerCase()));
  const bronzeSet = new Set(bronzeTeam.map(s => s.toLowerCase()));

  const standings = { ...(season.standings || {}) };
  (players || []).forEach(p => {
    if (!standings[p]) standings[p] = { points: 0, wins: 0, played: 0 };
    standings[p].played++;
    const k = p.toLowerCase();
    if (championSet.has(k)) { standings[p].points += 5; standings[p].wins++; }
    else if (silverSet.has(k)) standings[p].points += 3;
    else if (bronzeSet.has(k)) standings[p].points += 2;
    else standings[p].points += 1;
  });

  await updateDoc(seasonRef, {
    tournaments: arrayUnion(tournamentCode),
    standings,
  });
}

export async function migrateSeasonPoints(clubId, seasonId) {
  const seasonRef = doc(firestore, "clubs", clubId, "seasons", seasonId);
  const snap = await getDoc(seasonRef);
  if (!snap.exists()) return;
  const season = snap.data();
  if ((season.pointsVersion || 0) >= 2) return;

  const tournamentCodes = season.tournaments || [];
  if (tournamentCodes.length === 0) {
    await updateDoc(seasonRef, { pointsVersion: 2 });
    return;
  }

  const tSnap = await getDocs(collection(firestore, "clubs", clubId, "tournaments"));
  const clubTs = tSnap.docs.map(d => d.data()).filter(t => tournamentCodes.includes(t.code));

  const losingTeam = (match) => {
    if (!match?.played) return [];
    return (match.scoreA > match.scoreB ? match.teamB : match.teamA) || [];
  };

  const standings = {};
  for (const t of clubTs) {
    const fbSnap = await get(ref(db, `tournaments/${t.code}`));
    if (!fbSnap.exists()) continue;
    const fbData = fbSnap.val();
    const champion = fbData.champion || t.champion;
    const playoffs = fbData.playoffs || null;
    const players = fbData.players || t.players || [];

    const silverTeam = playoffs?.final ? losingTeam(playoffs.final) : [];
    let bronzeTeam = [];
    if (playoffs) {
      const mode = playoffs.mode;
      if (mode === "ipl8" || mode === "top8_ipl") bronzeTeam = losingTeam(playoffs.q2);
      else if (mode === "ipl6") bronzeTeam = losingTeam(playoffs.elim);
      else if (mode === "elim_to_sf") bronzeTeam = losingTeam(playoffs.sf);
      else if (mode === "top8") bronzeTeam = [...losingTeam(playoffs.sf1), ...losingTeam(playoffs.sf2)];
    }

    const championSet = new Set(champion ? champion.split(" & ").map(s => s.trim().toLowerCase()) : []);
    const silverSet = new Set(silverTeam.map(s => s.toLowerCase()));
    const bronzeSet = new Set(bronzeTeam.map(s => s.toLowerCase()));

    players.forEach(p => {
      if (!standings[p]) standings[p] = { points: 0, wins: 0, played: 0 };
      standings[p].played++;
      const k = p.toLowerCase();
      if (championSet.has(k)) { standings[p].points += 5; standings[p].wins++; }
      else if (silverSet.has(k)) standings[p].points += 3;
      else if (bronzeSet.has(k)) standings[p].points += 2;
      else standings[p].points += 1;
    });
  }

  await updateDoc(seasonRef, { standings, pointsVersion: 2 });
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useClubs() {
  const [clubs, setClubs] = useState([]);
  const [pendingClubIds, setPendingClubIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    // onSnapshot so approval/rejection updates the list in real-time
    const unsub = onSnapshot(doc(firestore, "users", uid), async snap => {
      const clubIds = snap.exists() ? (snap.data().clubs || []) : [];
      const pendingIds = snap.exists() ? (snap.data().pendingClubs || []) : [];
      setPendingClubIds(pendingIds);

      const allIds = [...new Set([...clubIds, ...pendingIds])];
      if (!allIds.length) { setClubs([]); setLoading(false); return; }

      const clubDocs = await Promise.all(allIds.map(id => getDoc(doc(firestore, "clubs", id))));
      setClubs(clubDocs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { clubs, pendingClubIds, loading };
}

// Subscribes to players/{uid} for each member — single source of truth for name/avatar.
// Returns a map of uid → player profile data. Updates in real-time when anyone changes their profile.
export function useClubMemberProfiles(members) {
  const [profiles, setProfiles] = useState({});
  const uids = members.map(m => m.uid).filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!uids) { setProfiles({}); return; }
    const memberList = members.filter(m => m.uid);
    const unsubs = memberList.map(m =>
      onSnapshot(doc(firestore, "players", m.uid), snap => {
        if (snap.exists()) {
          setProfiles(prev => ({ ...prev, [m.uid]: snap.data() }));
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }, [uids]);

  return profiles;
}

export function useClubDetail(clubId) {
  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;

    const unsubClub = onSnapshot(doc(firestore, "clubs", clubId), snap => {
      if (snap.exists()) setClub({ id: snap.id, ...snap.data() });
      setLoading(false);
    });

    const unsubMembers = onSnapshot(collection(firestore, "clubs", clubId, "members"), snap => {
      setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });

    const unsubPending = onSnapshot(collection(firestore, "clubs", clubId, "pendingMembers"), snap => {
      setPendingMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });

    const unsubTournaments = onSnapshot(collection(firestore, "clubs", clubId, "tournaments"), snap => {
      const list = snap.docs.map(d => ({ ...d.data() }));
      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setTournaments(list);
    });

    const unsubSeasons = onSnapshot(collection(firestore, "clubs", clubId, "seasons"), snap => {
      setSeasons(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    return () => { unsubClub(); unsubMembers(); unsubPending(); unsubTournaments(); unsubSeasons(); };
  }, [clubId]);

  const isAdmin = useCallback(() => {
    const uid = getAuth().currentUser?.uid;
    return members.find(m => m.uid === uid)?.role === "admin";
  }, [members]);

  return { club, members, pendingMembers, tournaments, seasons, loading, isAdmin };
}

// Fetches full match data (rounds + playoffs) from RTDB for each completed club tournament
// Returns null while loading, [] or populated array when ready
export function useClubFullHistory(tournaments) {
  const [fullHistory, setFullHistory] = useState(null);
  const codesKey = tournaments
    .filter(t => t.status === "completed" && t.code)
    .map(t => t.code).sort().join(",");

  useEffect(() => {
    if (!codesKey) { setFullHistory([]); return; }
    const completed = tournaments.filter(t => t.status === "completed" && t.code);
    Promise.all(completed.map(clubT =>
      get(ref(db, `tournaments/${clubT.code}`)).then(snap => {
        if (!snap.exists()) return null;
        const fbData = snap.val();
        return {
          ...clubT,
          rounds: fbData.rounds ? fbData.rounds.map(r => r ? Object.values(r) : []) : [],
          playoffs: fbData.playoffs || null,
        };
      }).catch(() => null)
    )).then(results => setFullHistory(results.filter(Boolean)));
  }, [codesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return fullHistory;
}
