import { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, set, onDisconnect, get } from "firebase/database";
import { doc, setDoc, collection, query, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, firestore } from "../firebase";
import confetti from "canvas-confetti";

import { generateSchedule, computeStandings, initPlayoffs, genCode } from "../utils/schedule";
import { loadH, saveH, isCreator, registerAsCreator, computeH2HMatrix } from "../utils/history";
import { generateScorerPin, saveScorerPin, getScorerPin } from "../components/ScorerModal";
import { playAudio } from "../utils/audio";
import { useToast } from "../components/Toast";
import { normalizePlayerName } from "../utils/players";

// ── Firestore helpers (Google users only) ──────────────────────────────────

// Save FULL tournament data to Firestore — this is the single source of truth for Google users
export async function saveFullTournament(uid, entry) {
  if (!uid || !entry?.code) return;
  try {
    const docRef = doc(firestore, "users", uid, "tournaments", entry.code);

    // Check if document already exists to avoid overwriting createdAt
    const { getDoc } = await import("firebase/firestore");
    const existing = await getDoc(docRef);

    const data = {
      code: entry.code,
      name: entry.name || "",
      date: entry.date || new Date().toISOString(),
      status: entry.status || (entry.champion ? "completed" : "in-progress"),
      players: entry.players || [],
      playerCount: entry.players?.length || 0,
      rounds: entry.rounds || [],
      playoffs: entry.playoffs || null,
      champion: entry.champion || null,
      finalStandings: entry.finalStandings || [],
      profiles: entry.profiles || {},
      themeColor: entry.themeColor || "#10d48e",
      isPublic: entry.isPublic !== false,
      updatedAt: Date.now(),
    };

    // Only write createdAt on first creation — never overwrite it
    if (!existing.exists()) {
      data.createdAt = serverTimestamp();
    }

    await setDoc(docRef, data, { merge: true });
  } catch (e) { console.warn("Firestore write failed", e); }
}

// Fetch all tournaments for a signed-in user from Firestore (returns FULL data)
export async function fetchUserTournaments(uid) {
  try {
    const q = query(collection(firestore, "users", uid, "tournaments"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const docs = snap.docs.map(d => {
      const data = d.data();
      // Convert Firestore Timestamp to ISO string for date field
      const dateVal = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.date;
      return { ...data, date: dateVal || new Date().toISOString(), firestoreId: d.id };
    });
    // Sort: most recently updated first
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return docs;
  } catch (e) {
    console.warn("fetchUserTournaments failed:", e);
    return null; // null = fetch failed (offline), not empty (deleted)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const sanitizeForFirebase = (obj) => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirebase);
  const result = {};
  for (const key in obj) {
    if (obj[key] !== undefined) result[key] = sanitizeForFirebase(obj[key]);
  }
  return result;
};

export const safePlayoffs = (p) => {
  if (!p) return null;
  const safe = (m, label, note) => m ? {
    teamA: m.teamA || null, teamB: m.teamB || null,
    scoreA: m.scoreA ?? null, scoreB: m.scoreB ?? null,
    played: m.played || false, duration: m.duration || null,
    label: m.label || label, note: m.note || note
  } : null;

  let mode = p.mode;
  if (!mode) {
    if (p.isMini || (!p.q1 && p.final)) mode = "final_only";
    else if (p.q1 && p.elim && p.q2) mode = "ipl8";
    else if (p.q1 && !p.elim) mode = "elim_to_sf";
    else mode = "ipl8";
  }

  const base = { mode, champion: p.champion || null, eliminated: p.eliminated || [] };
  if (mode === "final_only")  return { ...base, final: safe(p.final || p.q1, "GRAND FINAL", "") };
  if (mode === "elim_to_sf")  return { ...base, sf1: safe(p.sf1 || p.q1, "SEMI FINAL", "1st+4th vs 2nd+3rd"), final: safe(p.final, "GRAND FINAL", "Winner SF vs Runner-up SF") };
  if (mode === "ipl6")        return { ...base, q1: safe(p.q1, "QUALIFIER 1", "1st+4th vs 2nd+3rd"), elim: safe(p.elim, "ELIMINATOR", "5th+6th vs Loser Q1"), final: safe(p.final, "THE FINAL", "Winner Q1 vs Winner Elim") };
  if (mode === "ipl8")        return { ...base, q1: safe(p.q1, "QUALIFIER 1", "1st+4th vs 2nd+3rd"), elim: safe(p.elim, "ELIMINATOR", "5th+8th vs 6th+7th"), q2: safe(p.q2, "QUALIFIER 2", "Loser Q1 vs Winner Elim"), final: safe(p.final, "THE FINAL", "Winner Q1 vs Winner Q2") };
  if (mode === "top8")        return { ...base, qf1: safe(p.qf1, "QF 1", ""), qf2: safe(p.qf2, "QF 2", ""), sf1: safe(p.sf1, "SEMI FINAL 1", ""), sf2: safe(p.sf2, "SEMI FINAL 2", ""), final: safe(p.final, "GRAND FINAL", "") };
  if (mode === "top8_ipl")    return { ...base, q1: safe(p.q1, "QUALIFIER 1", ""), q2_b: safe(p.q2_b, "QUALIFIER 2", ""), elim: safe(p.elim, "ELIMINATOR", ""), sf: safe(p.sf, "SEMI FINAL", ""), final: safe(p.final, "THE FINAL", "") };
  return { ...base, q1: safe(p.q1, "QUALIFIER 1", ""), elim: safe(p.elim, "ELIMINATOR", ""), q2: safe(p.q2, "QUALIFIER 2", ""), final: safe(p.final, "FINAL", "") };
};

async function fbSet(path, data) {
  try { await set(ref(db, path), sanitizeForFirebase(data)); } catch (e) { console.error("FB write error", e); }
}

function playScoreSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTournament() {
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [playoffs, setPlayoffs] = useState(null);
  const [champion, setChampion] = useState(null);
  const [code, setCode] = useState(null);
  const [tab, setTab] = useState("rounds");
  const [savedToHist, setSavedToHist] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [animatingScore, setAnimatingScore] = useState(null);
  const [scorerPin, setScorerPin] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [themeColor, setThemeColor] = useState("#10d48e");
  const [h2hMatrix, setH2hMatrix] = useState({});
  // Timer state keyed by "roundIndex-matchIndex" — survives tab switches + app close
  const [matchTimers, setMatchTimers] = useState({});
  const [liveScores, setLiveScores] = useState({}); // real-time in-progress scores
  // Tournament metadata
  const [tournamentName, setTournamentName] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Refs that must not trigger re-renders
  const isWriting = useRef(false);
  const canEditRef = useRef(false);
  const joinCompleteRef = useRef(false);
  const pendingSync = useRef(null); // { rounds, playoffs, champion, profiles } when offline write is queued

  const { addToast } = useToast();

  // ── H2H init ──────────────────────────────────────────────────────────────
  useEffect(() => { setH2hMatrix(computeH2HMatrix()); }, []);

  // ── Restore timers when code is set (must run before save effect) ───────────
  useEffect(() => {
    if (!code) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`pkl_timers_${code}`) || "{}");
      const restored = {};
      Object.entries(saved).forEach(([key, t]) => {
        restored[key] = t.running && t.startedAt
          ? { ...t, elapsed: Math.floor((Date.now() - t.startedAt) / 1000) }
          : t;
      });
      if (Object.keys(restored).length > 0) setMatchTimers(restored);
    } catch {}
  }, [code]);

  // ── Save timers — only when there is actual data (prevents overwriting on init) ──
  useEffect(() => {
    if (!code || Object.keys(matchTimers).length === 0) return;
    localStorage.setItem(`pkl_timers_${code}`, JSON.stringify(matchTimers));
  }, [matchTimers, code]);

  // ── Theme color → CSS var ─────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty("--color-lime", themeColor);
  }, [themeColor]);

  // ── Sync profile changes to Firebase immediately ──────────────────────────
  useEffect(() => {
    if (!code || Object.keys(profiles).length === 0 || isWriting.current) return;
    try {
      set(ref(db, `tournaments/${code}/profiles`), profiles).catch(() => {});
    } catch {}
  }, [profiles, code]);

  // ── Firebase listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const dbRef = ref(db, `tournaments/${code}`);
    const unb = onValue(dbRef, (snap) => {
      // Only skip incoming updates on the WRITING device (prevents self-echo flicker)
      // Viewers / other devices should ALWAYS receive updates
      if (isWriting.current && canEditRef.current) return;
      setSyncing(true);
      const v = snap.val();
      if (v) {
        const newRounds = v.rounds ? v.rounds.map((r) => (r ? Object.values(r) : [])) : null;
        if (v.players) setPlayers(v.players);
        if (newRounds) setRounds(newRounds);
        if (v.playoffs !== undefined) setPlayoffs(safePlayoffs(v.playoffs));
        if (v.champion !== undefined) setChampion(v.champion || null);
        if (v.profiles) setProfiles(v.profiles);
        if (v.themeColor) setThemeColor(v.themeColor);
        if (v.name !== undefined) setTournamentName(v.name || "");
        if (joinCompleteRef.current) setReadOnly(!canEditRef.current);

        // When champion is declared — save final result to ALL accounts watching
        // This ensures viewers (different Google account) get the completed tournament
        // in their own history and career stats
        if (newRounds && v.players && v.champion) {
          const all = loadH().filter(t => t.code);
          const seen = new Map();
          all.forEach(t => seen.set(t.code, t));
          const existing = seen.get(code);
          const finalEntry = {
            ...(existing || {}),
            code, players: v.players,
            rounds: newRounds,
            playoffs: safePlayoffs(v.playoffs),
            champion: v.champion,
            name: v.name || existing?.name || "",
            date: existing?.date || new Date().toISOString(),
            finalStandings: computeStandings(v.players, newRounds),
            profiles: v.profiles || {},
            themeColor: v.themeColor || "#10d48e",
            isPublic: v.isPublic !== false,
            status: "completed",
          };
          seen.set(code, finalEntry);
          saveH(Array.from(seen.values())); // update localStorage cache

          // Also save to this device's Firestore account (works for viewers too)
          const uid = getAuth().currentUser?.uid;
          if (uid) saveFullTournament(uid, finalEntry);
        }
      }
      setSyncing(false);
    });
    const presId = Math.random().toString(36).substr(2);
    const presRef = ref(db, `presence/${code}/${presId}`);
    set(presRef, true);
    onDisconnect(presRef).remove();
    const unbPres = onValue(ref(db, `presence/${code}`), (snap) => {
      setOnlineCount(snap.exists() ? Object.keys(snap.val()).length : 1);
    });
    return () => { unb(); unbPres(); set(presRef, null); };
  }, [code]);

  // ── Separate listener for live in-progress scores (doesn't trigger flicker) ──
  useEffect(() => {
    if (!code) return;
    const unsubLive = onValue(ref(db, `tournaments/${code}/live`), snap => {
      setLiveScores(snap.exists() ? snap.val() : {});
    });
    return () => unsubLive();
  }, [code]);

  // ── Reconnect: flush any pending offline write ────────────────────────────
  useEffect(() => {
    const flush = () => {
      if (!pendingSync.current || !code || !canEditRef.current) return;
      const { rounds: r, playoffs: p, champion: c, profiles: pr } = pendingSync.current;
      fbSet(`tournaments/${code}`, {
        players, rounds: r, playoffs: p, champion: c, profiles: pr, themeColor, name: tournamentName, ts: Date.now()
      });
      pendingSync.current = null;
    };
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [code, players, themeColor, tournamentName]);

  // ── Champion celebration ──────────────────────────────────────────────────
  useEffect(() => {
    if (!champion || savedToHist || readOnly) return;
    playAudio("cheer");
    addToast(`🏆 ${champion} are Champions!`, "success", 6000);
    const end = Date.now() + 4000;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#c8f135", "#35c8f1", "#f1c835"] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#c8f135", "#35c8f1", "#f1c835"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
    _upsertHist(rounds, playoffs, champion);
    setSavedToHist(true);
    // Update Firestore status to completed
    const uid = getAuth().currentUser?.uid;
    if (uid && code) saveToUserAccount(uid, code, { status: "done", champion });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion, savedToHist, readOnly]);

  // ── Internal: push to Firebase ────────────────────────────────────────────
  const pushToFirebase = useCallback(async (newRounds, newPlayoffs, newChamp, currentProfiles) => {
    if (!code || readOnly) return;
    const prof = currentProfiles ?? profiles;
    isWriting.current = true;
    try {
      await fbSet(`tournaments/${code}`, {
        players, rounds: newRounds, playoffs: newPlayoffs, champion: newChamp,
        profiles: prof, themeColor, name: tournamentName, ts: Date.now()
      });
      pendingSync.current = null;
    } catch {
      // Network down — queue for retry when reconnected
      pendingSync.current = { rounds: newRounds, playoffs: newPlayoffs, champion: newChamp, profiles: prof };
    } finally {
      setTimeout(() => { isWriting.current = false; }, 800);
    }
  }, [code, readOnly, players, profiles, themeColor, tournamentName]);

  // ── Internal: save tournament history ────────────────────────────────────
  // Google users → Firestore (source of truth) + localStorage (cache)
  // Guests → localStorage only
  const _upsertHist = useCallback((newRounds, newPlayoffs, newChamp, currentProfiles, tColor, overrideCode) => {
    const c = overrideCode ?? code;
    if (!c) return;
    const prof = currentProfiles ?? profiles;
    const col = tColor ?? themeColor;
    const all = loadH().filter((t) => t.code);
    const seen = new Map();
    all.forEach((t) => seen.set(t.code, t));
    const h = Array.from(seen.values());
    const idx = h.findIndex((t) => t.code === c);
    const entry = {
      date: idx >= 0 ? h[idx].date : new Date().toISOString(),
      name: tournamentName || h[idx]?.name || "",
      players, code: c,
      isPublic,
      champion: newChamp || null,
      status: newChamp ? "completed" : "in-progress",
      finalStandings: computeStandings(players, newRounds),
      playoffs: newPlayoffs || null,
      rounds: newRounds,
      profiles: prof,
      themeColor: col,
    };
    if (idx >= 0) h[idx] = entry; else h.push(entry);
    saveH(h); // always cache locally (works offline, speeds up reads)

    // Google users: Firestore is the source of truth — save full data there too
    const uid = getAuth().currentUser?.uid;
    if (uid) saveFullTournament(uid, entry);
  }, [code, players, profiles, themeColor, tournamentName, isPublic]);

  // ── Actions ───────────────────────────────────────────────────────────────

  // ── Live score push (minimal debounce for real-time feel) ────────────────
  const liveTimers = useRef({});
  const pushLiveScore = useCallback((key, sA, sB, note, timerStartedAt) => {
    if (!code || readOnly) return;
    clearTimeout(liveTimers.current[key]);
    // 50ms debounce - fast enough for real-time, slow enough to batch rapid clicks
    liveTimers.current[key] = setTimeout(() => {
      set(ref(db, `tournaments/${code}/live/${key}`), {
        a: sA === "" ? 0 : Number(sA),
        b: sB === "" ? 0 : Number(sB),
        note: note || "",
        startedAt: timerStartedAt || null,
        ts: Date.now(),
      }).catch(() => {});
    }, 50);
  }, [code, readOnly]);

  // ── Fast timer update (no debounce - real-time sync) ─────────────────────
  const syncTimerState = useCallback((key, timerState, sA = 0, sB = 0, note = "") => {
    if (!code || readOnly) return;
    set(ref(db, `tournaments/${code}/live/${key}`), {
      a: sA,
      b: sB,
      note: note || "",
      startedAt: timerState?.startedAt || null,
      timerRunning: timerState?.running || false,
      ts: Date.now(),
    }).catch(() => {});
  }, [code, readOnly]);

  const clearLiveScore = useCallback((key) => {
    if (!code) return;
    set(ref(db, `tournaments/${code}/live/${key}`), null).catch(() => {});
  }, [code]);

  // ── Timer helpers (survive tab switches + immediately sync) ──────────────
  const startMatchTimer = useCallback((key) => {
    setMatchTimers(prev => {
      const existingTimer = prev[key];
      // Preserve elapsed time from previous pause, or start fresh
      const previousElapsed = existingTimer?.elapsed || 0;
      const newTimerState = {
        startedAt: Date.now() - (previousElapsed * 1000),
        elapsed: previousElapsed,
        running: true,
      };
      // Immediately sync to Firebase (no debounce for timer start)
      syncTimerState(key, newTimerState, 0, 0, "");
      return {
        ...prev,
        [key]: newTimerState,
      };
    });
  }, [syncTimerState]);

  const stopMatchTimer = useCallback((key) => {
    setMatchTimers(prev => {
      const t = prev[key];
      if (!t) return prev;
      const elapsed = t.startedAt ? Math.floor((Date.now() - t.startedAt) / 1000) : t.elapsed;
      const stopped = { ...t, elapsed, running: false };
      // Immediately sync to Firebase when timer stops
      syncTimerState(key, stopped, 0, 0, "");
      return { ...prev, [key]: stopped };
    });
  }, [syncTimerState]);

  const resetMatchTimer = useCallback((key) => {
    const reset = { startedAt: null, elapsed: 0, running: false };
    setMatchTimers(prev => ({ ...prev, [key]: reset }));
    // Immediately sync to Firebase when timer resets
    syncTimerState(key, reset, 0, 0, "");
  }, [syncTimerState]);
  const getMatchTimer = (key) => matchTimers[key] || { startedAt: null, elapsed: 0, running: false };

  const handleStart = async (p, numRounds, newProfiles = {}, tColor = "#10d48e", meta = {}) => {
    // Normalize player names for consistent storage across tournaments
    const normalizedPlayers = p.map(name => normalizePlayerName(name));
    // Remap profiles to use normalized names
    const normalizedProfiles = {};
    Object.entries(newProfiles).forEach(([displayName, profile]) => {
      const norm = normalizePlayerName(displayName);
      normalizedProfiles[norm] = profile;
    });

    const r = generateSchedule(normalizedPlayers, numRounds);
    const c = genCode();
    const pin = generateScorerPin();
    window.scrollTo(0, 0);
    setPlayers(normalizedPlayers); setRounds(r); setCode(c); setPlayoffs(null);
    setChampion(null); setTab("rounds"); setReadOnly(false); setSavedToHist(false);
    setMatchTimers({});
    canEditRef.current = true;
    setScorerPin(pin);
    setProfiles(normalizedProfiles);
    setThemeColor(tColor);
    setTournamentName(meta.name || "");
    setIsPublic(meta.isPublic !== false);
    registerAsCreator(c);
    saveScorerPin(c, pin);
    isWriting.current = true;
    try {
      await fbSet(`tournaments/${c}`, {
        players: normalizedPlayers, rounds: r, playoffs: null, champion: null,
        scorerPin: String(pin), profiles: normalizedProfiles, themeColor: tColor,
        name: meta.name || "", isPublic: meta.isPublic !== false,
        scheduledAt: meta.scheduledAt || null,
        creatorUid: getAuth().currentUser?.uid || null,
        ts: Date.now()
      });
      _upsertHist(r, null, null, normalizedProfiles, tColor, c);
      // Save to Firestore user account for cross-device sync
      const uid = getAuth().currentUser?.uid;
      if (uid) {
        await saveToUserAccount(uid, c, {
          code: c, name: meta.name || "", status: "live",
          playerCount: normalizedPlayers.length, players: normalizedPlayers,
          isPublic: meta.isPublic !== false,
          scheduledAt: meta.scheduledAt || null,
          createdAt: serverTimestamp(), updatedAt: Date.now(), champion: null,
        });
      }
      addToast("Tournament created! Share the code.", "success");
      joinCompleteRef.current = true;
    } finally { isWriting.current = false; }
  };

  const handleJoin = (c, data) => {
    const creator = isCreator(c);
    const savedPin = getScorerPin(c);
    const fbPin = String(data.scorerPin || "").trim();
    const isSavedScorer = !!(savedPin && fbPin && String(savedPin).trim() === fbPin);
    // Same Google account on any device gets creator access
    const uid = getAuth().currentUser?.uid;
    const isUidCreator = !!(uid && data.creatorUid && uid === data.creatorUid);
    if (isUidCreator && !creator) registerAsCreator(c); // sync localStorage too
    const canEdit = creator || isSavedScorer || isUidCreator;
    canEditRef.current = canEdit;

    setPlayers(data.players || []);
    setRounds(data.rounds ? data.rounds.map((r) => (r ? Object.values(r) : [])) : []);
    setPlayoffs(safePlayoffs(data.playoffs));
    setChampion(data.champion || null);
    setProfiles(data.profiles || {});
    setThemeColor(data.themeColor || "#10d48e");
    setTournamentName(data.name || "");
    setCode(c);
    setTab("rounds");
    setReadOnly(!canEdit);

    if (isUidCreator) {
      if (data.scorerPin) { saveScorerPin(c, String(data.scorerPin)); setScorerPin(String(data.scorerPin)); }
      addToast(`Joined #${c} (Creator ✓)`, "success");
    } else if (creator) {
      if (data.scorerPin) { saveScorerPin(c, String(data.scorerPin)); setScorerPin(String(data.scorerPin)); }
      addToast(`Joined #${c} (Creator ✓)`, "success");
    } else if (isSavedScorer) {
      setScorerPin(fbPin);
      addToast(`Joined #${c} (Scorer Access ✓)`, "success");
    } else {
      setScorerPin(null);
      addToast(`Joined #${c} — spectator mode. Tap 🔒 for scorer access`, "info");
    }
    joinCompleteRef.current = true;
    window.scrollTo(0, 0);

    // Always save to localStorage + Firestore (for all Google users, not just new joins)
    // This ensures viewer's career stats & history update on their account too
    const rounds = data.rounds ? data.rounds.map((r) => (r ? Object.values(r) : [])) : [];
    const entry = {
      code: c, name: data.name || "", date: new Date().toISOString(),
      status: data.champion ? "completed" : "in-progress",
      players: data.players || [], playerCount: (data.players || []).length,
      rounds, playoffs: safePlayoffs(data.playoffs),
      champion: data.champion || null,
      finalStandings: computeStandings(data.players || [], rounds),
      profiles: data.profiles || {},
      themeColor: data.themeColor || "#10d48e",
      isPublic: data.isPublic !== false,
    };
    const all = loadH().filter(t => t.code);
    const seen = new Map();
    all.forEach(t => seen.set(t.code, t));
    const existing = seen.get(c);
    seen.set(c, { ...entry, date: existing?.date || entry.date }); // preserve original date
    saveH(Array.from(seen.values()));

    if (uid) saveFullTournament(uid, seen.get(c));
  };

  const saveResult = (ri, mi, sA, sB, dur, notes = "") => {
    try {
      const nx = JSON.parse(JSON.stringify(rounds));
      nx[ri][mi] = { ...nx[ri][mi], scoreA: sA, scoreB: sB, played: true, duration: dur || null, notes };
      setRounds(nx);
      setAnimatingScore(`${ri}-${mi}`);
      setTimeout(() => setAnimatingScore(null), 500);
      playScoreSound();
      clearLiveScore(`${ri}-${mi}`);
      pushToFirebase(nx, playoffs, champion);
      _upsertHist(nx, playoffs, champion); // handles both localStorage + Firestore
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ["#c8f135", "#35c8f1"] });
      addToast("✓ Score saved", "success", 1500);
    } catch { addToast("Failed to save score", "error"); }
  };

  const startPlayoffs = () => {
    const st = computeStandings(players, rounds);
    const poffs = initPlayoffs(st);
    setPlayoffs(poffs); setTab("playoffs");
    pushToFirebase(rounds, poffs, champion);
    _upsertHist(rounds, poffs, champion); // handles both localStorage + Firestore
    addToast("Playoffs started!", "info");
  };

  const declareAsFinal = () => {
    const st = computeStandings(players, rounds);
    const t = st.map((s) => s.name);
    const poffs = {
      mode: "final_only",
      final: { teamA: [t[0], t[1]], teamB: [t[2], t[3] || t[2]], scoreA: null, scoreB: null, played: false, label: "GRAND FINAL", note: "Top 4 — Quick Final" },
      champion: null,
    };
    setPlayoffs(poffs); setTab("playoffs");
    pushToFirebase(rounds, poffs, champion);
    _upsertHist(rounds, poffs, champion); // handles both localStorage + Firestore
    addToast("Quick Final created!", "info");
  };

  const savePlayoff = (stage, sA, sB, dur, notes = "") => {
    try {
      const nx = JSON.parse(JSON.stringify(playoffs));
      nx[stage] = { ...nx[stage], scoreA: sA, scoreB: sB, played: true, duration: dur || null, notes };
      const m = nx[stage];
      if (!m.teamA || !m.teamB) return;
      const win = [...(sA > sB ? m.teamA : m.teamB)];
      const lose = [...(sA > sB ? m.teamB : m.teamA)];
      let newChamp = champion;
      const mode = nx.mode || "ipl8";

      if (mode === "final_only") {
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      } else if (mode === "elim_to_sf") {
        if (stage === "sf1") nx.final = { ...nx.final, teamA: win, teamB: lose };
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      } else if (mode === "ipl6") {
        if (stage === "q1") { if (nx.final) nx.final = { ...nx.final, teamA: win }; if (nx.elim) nx.elim = { ...nx.elim, teamB: lose }; }
        if (stage === "elim") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      } else if (mode === "ipl8") {
        if (stage === "q1") {
          if (nx.final) nx.final = { ...nx.final, teamA: win };
          if (nx.elim?.played) {
            const ew = nx.elim.scoreA > nx.elim.scoreB ? [...nx.elim.teamA] : [...nx.elim.teamB];
            if (nx.q2) nx.q2 = { ...nx.q2, teamA: lose, teamB: ew };
          } else { if (nx.q2) nx.q2 = { ...nx.q2, teamA: lose }; }
        }
        if (stage === "elim") {
          const q1l = nx.q1?.played ? (nx.q1.scoreA > nx.q1.scoreB ? [...nx.q1.teamB] : [...nx.q1.teamA]) : null;
          if (nx.q2) nx.q2 = { ...nx.q2, teamB: win, teamA: nx.q2.teamA || q1l };
        }
        if (stage === "q2") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      } else if (mode === "top8") {
        if (stage === "qf1") { if (nx.sf1) nx.sf1 = { ...nx.sf1, teamA: win }; }
        if (stage === "qf2") { if (nx.sf1) nx.sf1 = { ...nx.sf1, teamB: win }; }
        if (stage === "sf1") { if (nx.final) nx.final = { ...nx.final, teamA: win }; }
        if (stage === "sf2") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      } else if (mode === "top8_ipl") {
        if (stage === "q1") { if (nx.final) nx.final = { ...nx.final, teamA: win }; if (nx.sf) nx.sf = { ...nx.sf, teamA: lose }; }
        if (stage === "q2_b") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "elim") { if (nx.sf) nx.sf = { ...nx.sf, teamB: win }; }
        if (stage === "sf") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      }

      setPlayoffs(nx);
      playScoreSound();
      pushToFirebase(rounds, nx, newChamp);
      _upsertHist(rounds, nx, newChamp); // handles both localStorage + Firestore
      if (!newChamp) confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ["#f1c835", "#35c8f1"] });
      addToast(`${m.label} result saved!`, "success", 2000);
    } catch (e) { console.error("savePlayoff error", e); addToast("Failed to save playoff score", "error"); }
  };

  const executeEnd = () => {
    if (code) localStorage.removeItem(`pkl_timers_${code}`);
    canEditRef.current = false;
    joinCompleteRef.current = false;
    pendingSync.current = null;
    setPlayers([]); setRounds([]); setPlayoffs(null);
    setCode(null); setChampion(null); setScorerPin(null);
    setMatchTimers({}); setTournamentName(""); setIsPublic(true);
  };

  const handleScorerPinEntered = async (enteredPin) => {
    try {
      const snap = await get(ref(db, `tournaments/${code}/scorerPin`));
      const fbPin = String(snap.val() || "").trim();
      const entered = String(enteredPin || "").trim();
      if (snap.exists() && fbPin === entered && fbPin.length > 0) {
        saveScorerPin(code, enteredPin);
        setScorerPin(enteredPin);
        canEditRef.current = true;
        setReadOnly(false);
        addToast("Scorer access granted! You can now enter scores.", "success");
      } else {
        addToast("Wrong PIN. Ask the tournament creator.", "error");
      }
    } catch { addToast("Could not verify PIN. Check connection.", "error"); }
  };

  const copyStandingsText = () => {
    const st = computeStandings(players, rounds);
    const lines = ["🏓 PICKLEBALL STANDINGS", ""];
    st.forEach((s, i) => {
      const diff = s.scored - s.conceded;
      lines.push(`${i + 1}. ${s.name} — ${s.pts}pts | ${s.won}W ${s.lost}L | ${diff > 0 ? "+" : ""}${diff}`);
    });
    lines.push("", `Code: ${code}`);
    navigator.clipboard?.writeText(lines.join("\n"))
      .then(() => addToast("Standings copied! Paste to WhatsApp 📋", "success", 3000));
  };

  return {
    // State
    players, rounds, playoffs, champion, code, tab, setTab,
    readOnly, syncing, onlineCount, animatingScore, scorerPin,
    profiles, themeColor, h2hMatrix, savedToHist,
    tournamentName, isPublic,
    // Timer helpers
    startMatchTimer, stopMatchTimer, resetMatchTimer, getMatchTimer,
    // Live score helpers
    liveScores, pushLiveScore, clearLiveScore,
    // Actions
    handleStart, handleJoin, saveResult, savePlayoff, executeEnd,
    handleScorerPinEntered, copyStandingsText, startPlayoffs, declareAsFinal,
  };
}
