import { useState, useEffect, useRef, useCallback } from "react";
import { ref, onValue, set, onDisconnect, push, get } from "firebase/database";
import { db } from "./firebase";
import confetti from "canvas-confetti";

import { generateSchedule, computeStandings, initPlayoffs, genCode } from "./utils/schedule";
import { loadH, saveH, isCreator, registerAsCreator, computeH2HMatrix } from "./utils/history";

import { SetupScreen } from "./screens/SetupScreen";
import { HistoryScreen, HistoryDetail } from "./screens/HistoryScreen";
import { CareerScreen } from "./screens/CareerScreen";
import { ToastProvider, useToast } from "./components/Toast";
import { MatchCard } from "./components/MatchCard";
import { StandingsTable } from "./components/StandingsTable";
import { PlayoffCard } from "./components/PlayoffCard";
import { ShareModal } from "./components/ShareModal";
import { StandingsShareModal } from "./components/StandingsShare";
import { ReactionsOverlay } from "./components/Reactions";
import { MatchTicker } from "./components/MatchTicker";
import { TournamentAwards } from "./components/TournamentAwards";
import { ScorerPinModal, ScorerPinEntry, generateScorerPin, saveScorerPin, getScorerPin } from "./components/ScorerModal";
import { playAudio } from "./utils/audio";
import { Share2, Users, AlertCircle, RefreshCw, ArrowLeft, Moon, Sun, Camera, Lock, Wifi, WifiOff } from "lucide-react";

// ── Theme ──────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("pkl_theme") || "dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pkl_theme", theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");
  return { theme, toggle };
}

// ── Sound effects ──────────────────────────────────────────────────────────
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

// ── Firebase helpers ───────────────────────────────────────────────────────
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

const safePlayoffs = (p) => {
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

// ── Main App ───────────────────────────────────────────────────────────────
function PickleballApp() {
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [playoffs, setPlayoffs] = useState(null);
  const [tab, setTab] = useState("rounds");
  const [champion, setChampion] = useState(null);
  const [code, setCode] = useState(null);
  const [viewHist, setViewHist] = useState(null);
  const [viewCareer, setViewCareer] = useState(false);
  const [savedToHist, setSavedToHist] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showStandingsShare, setShowStandingsShare] = useState(false);
  const [animatingScore, setAnimatingScore] = useState(null);
  const [showScorerPin, setShowScorerPin] = useState(false);
  const [showScorerEntry, setShowScorerEntry] = useState(false);
  const [scorerPin, setScorerPin] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [h2hMatrix, setH2hMatrix] = useState({});
  const [profiles, setProfiles] = useState({});
  const [themeColor, setThemeColor] = useState("#c8f135");
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const isWriting = useRef(false);
  const canEditRef = useRef(false); // permanent - never overwritten by Firebase listener
  const joinCompleteRef = useRef(false); // true only after handleJoin/handleStart fully ran
  const { addToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    setH2hMatrix(computeH2HMatrix());
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--color-lime', themeColor);
  }, [themeColor]);

  // ── Offline detection ───────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => { setIsOffline(false); addToast("Back online — syncing...", "success", 2000); };
    const onOffline = () => { setIsOffline(true); addToast("Offline — scores saved locally", "info", 3000); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [addToast]);

  // ── Auto-join from URL ──────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      window.history.replaceState({}, "", window.location.pathname);
      // fetch and join
      get(ref(db, `tournaments/${joinCode}`)).then(snap => {
        if (snap.exists()) handleJoin(joinCode, snap.val());
      });
    }
  }, []);

  // ── Firebase listener ───────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const dbRef = ref(db, `tournaments/${code}`);
    const unb = onValue(dbRef, snap => {
      if (isWriting.current) return;
      setSyncing(true);
      const v = snap.val();
      if (v) {
        if (v.players) setPlayers(v.players);
        if (v.rounds) setRounds(v.rounds.map(r => r ? Object.values(r) : []));
        if (v.playoffs !== undefined) setPlayoffs(safePlayoffs(v.playoffs));
        if (v.champion !== undefined) setChampion(v.champion || null);
        if (v.profiles) setProfiles(v.profiles);
        if (v.themeColor) setThemeColor(v.themeColor);
        // Only re-apply readOnly after join is fully complete
        // This prevents the listener firing before handleJoin runs from overriding permissions
        if (joinCompleteRef.current) {
          setReadOnly(!canEditRef.current);
        }
      }
      setSyncing(false);
    });
    const presRef = ref(db, `presence/${code}/${Math.random().toString(36).substr(2)}`);
    set(presRef, true); onDisconnect(presRef).remove();
    const unbPres = onValue(ref(db, `presence/${code}`), snap => {
      setOnlineCount(snap.exists() ? Object.keys(snap.val()).length : 1);
    });
    return () => { unb(); unbPres(); set(presRef, null); };
  }, [code]);

  // ── Champion celebration ────────────────────────────────────────────────
  const _saveHist = useCallback((poffs, champ) => {
    if (savedToHist) return;
    const h = loadH();
    h.push({ date: new Date().toISOString(), players, champion: champ, code, finalStandings: computeStandings(players, rounds), playoffs: poffs, rounds });
    saveH(h); setSavedToHist(true);
  }, [savedToHist, players, code, rounds]);

  useEffect(() => {
    if (champion && !savedToHist && !readOnly) {
      playAudio("cheer");
      addToast(`🏆 ${champion} are Champions!`, "success", 6000);
      
      const duration = 4000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#c8f135', '#35c8f1', '#f1c835']
        });
        confetti({
          particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#c8f135', '#35c8f1', '#f1c835']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
      
      _saveHist(playoffs, champion);
    }
  }, [champion, savedToHist, readOnly, addToast, playoffs, _saveHist]);

  // ── Firebase push ───────────────────────────────────────────────────────
  const pushToFirebase = async (newRounds, newPlayoffs, newChamp, currentProfiles = profiles) => {
    if (!code || readOnly) return;
    isWriting.current = true;
    try {
      await fbSet(`tournaments/${code}`, { players, rounds: newRounds, playoffs: newPlayoffs, champion: newChamp, profiles: currentProfiles, themeColor, ts: Date.now() });
    } finally {
      setTimeout(() => { isWriting.current = false; }, 800);
    }
  };

  const _upsertHist = (newRounds, newPlayoffs, newChamp, currentProfiles = profiles, tColor = themeColor) => {
    const h = loadH();
    const idx = h.findIndex(t => t.code === code);
    const entry = { date: idx >= 0 ? h[idx].date : new Date().toISOString(), players, code, champion: newChamp || null, status: newChamp ? "completed" : "in-progress", finalStandings: computeStandings(players, newRounds), playoffs: newPlayoffs || null, rounds: newRounds, profiles: currentProfiles, themeColor: tColor };
    if (idx >= 0) h[idx] = entry; else h.push(entry);
    saveH(h);
  };

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleStart = async (p, numRounds, newProfiles = {}, tColor = "#c8f135") => {
    const r = generateSchedule(p, numRounds);
    const c = genCode();
    const pin = generateScorerPin();
    window.scrollTo(0, 0); setPlayers(p); setRounds(r); setCode(c); setPlayoffs(null); setChampion(null); setTab("rounds"); setReadOnly(false); setSavedToHist(false);
    canEditRef.current = true;
    setScorerPin(pin);
    setProfiles(newProfiles);
    setThemeColor(tColor);
    registerAsCreator(c);
    saveScorerPin(c, pin);
    isWriting.current = true;
    try {
      await fbSet(`tournaments/${c}`, { players: p, rounds: r, playoffs: null, champion: null, scorerPin: String(pin), profiles: newProfiles, themeColor: tColor, ts: Date.now() });
      _upsertHist(r, null, null, newProfiles, tColor);
      addToast("Tournament created! Share the code.", "success");
      joinCompleteRef.current = true;
    } finally { isWriting.current = false; }
  };

  const handleJoin = (c, data) => {
    // Determine edit access BEFORE touching any state
    const creator = isCreator(c);
    const savedPin = getScorerPin(c);
    const fbPin = String(data.scorerPin || "").trim();
    const isSavedScorer = !!(savedPin && fbPin && String(savedPin).trim() === fbPin);
    const canEdit = creator || isSavedScorer;

    // Store in ref so Firebase listener NEVER overrides this decision
    canEditRef.current = canEdit;

    setPlayers(data.players || []);
    setRounds(data.rounds ? data.rounds.map(r => r ? Object.values(r) : []) : []);
    setPlayoffs(safePlayoffs(data.playoffs));
    setChampion(data.champion || null);
    setProfiles(data.profiles || {});
    setThemeColor(data.themeColor || "#c8f135");
    setCode(c);
    setTab("rounds");
    setReadOnly(!canEdit);

    if (creator) {
      if (data.scorerPin) {
        saveScorerPin(c, String(data.scorerPin));
        setScorerPin(String(data.scorerPin));
      }
      addToast(`Joined #${c} (Creator ✓)`, "success");
    } else if (isSavedScorer) {
      setScorerPin(fbPin);
      addToast(`Joined #${c} (Scorer Access ✓)`, "success");
    } else {
      setScorerPin(null);
      addToast(`Joined #${c} — spectator mode. Tap 🔒 for scorer access`, "info");
    }
    // Mark join as complete — listener can now safely re-apply permissions
    joinCompleteRef.current = true;
    window.scrollTo(0, 0);
  };

  const saveResult = (ri, mi, sA, sB, dur, notes = "") => {
    try {
      const nx = JSON.parse(JSON.stringify(rounds));
      nx[ri][mi] = { ...nx[ri][mi], scoreA: sA, scoreB: sB, played: true, duration: dur || null, notes };
      setRounds(nx);
      setAnimatingScore(`${ri}-${mi}`);
      setTimeout(() => setAnimatingScore(null), 500);
      playScoreSound();
      pushToFirebase(nx, playoffs, champion);
      _upsertHist(nx, playoffs, champion);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#c8f135', '#35c8f1'] });
      addToast("✓ Score saved", "success", 1500);
    } catch (e) { addToast("Failed to save score", "error"); }
  };

  const startPlayoffs = () => {
    const st = computeStandings(players, rounds);
    const poffs = initPlayoffs(st);
    setPlayoffs(poffs); setTab("playoffs");
    pushToFirebase(rounds, poffs, champion);
    addToast("Playoffs started!", "info");
  };

  const declareAsFinal = () => {
    const st = computeStandings(players, rounds);
    const t = st.map(s => s.name);
    // Quick final = just top 4 play a single match regardless of player count
    const poffs = {
      mode: "final_only",
      final: { teamA: [t[0], t[1]], teamB: [t[2], t[3]||t[2]], scoreA: null, scoreB: null, played: false, label: "GRAND FINAL", note: "Top 4 — Quick Final" },
      champion: null
    };
    setPlayoffs(poffs); setTab("playoffs");
    pushToFirebase(rounds, poffs, champion);
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
      }
      else if (mode === "elim_to_sf") {
        if (stage === "sf1") {
          nx.final = { ...nx.final, teamA: win, teamB: lose };
        }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      }
      else if (mode === "ipl6") {
        // Q1: winner→Final, loser→Elim (loser joins existing 5+6 team as teamB)
        if (stage === "q1") {
          if (nx.final) nx.final = { ...nx.final, teamA: win };
          if (nx.elim)  nx.elim  = { ...nx.elim,  teamB: lose };
        }
        if (stage === "elim") {
          if (nx.final) nx.final = { ...nx.final, teamB: win };
        }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      }
      else if (mode === "ipl8") {
        if (stage === "q1") {
          if (nx.final) nx.final = { ...nx.final, teamA: win };
          if (nx.elim?.played) {
            const ew = nx.elim.scoreA > nx.elim.scoreB ? [...nx.elim.teamA] : [...nx.elim.teamB];
            if (nx.q2) nx.q2 = { ...nx.q2, teamA: lose, teamB: ew };
          } else {
            if (nx.q2) nx.q2 = { ...nx.q2, teamA: lose };
          }
        }
        if (stage === "elim") {
          const q1l = nx.q1?.played ? (nx.q1.scoreA > nx.q1.scoreB ? [...nx.q1.teamB] : [...nx.q1.teamA]) : null;
          if (nx.q2) nx.q2 = { ...nx.q2, teamB: win, teamA: nx.q2.teamA || q1l };
        }
        if (stage === "q2") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      }
      else if (mode === "top8") {
        if (stage === "qf1") { if (nx.sf1) nx.sf1 = { ...nx.sf1, teamA: win }; }
        if (stage === "qf2") { if (nx.sf1) nx.sf1 = { ...nx.sf1, teamB: win }; }
        if (stage === "sf1") { if (nx.final) nx.final = { ...nx.final, teamA: win }; }
        if (stage === "sf2") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      }
      else if (mode === "top8_ipl") {
        if (stage === "q1") { if (nx.final) nx.final = { ...nx.final, teamA: win }; if (nx.sf) nx.sf = { ...nx.sf, teamA: lose }; }
        if (stage === "q2_b") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "elim") { if (nx.sf) nx.sf = { ...nx.sf, teamB: win }; }
        if (stage === "sf") { if (nx.final) nx.final = { ...nx.final, teamB: win }; }
        if (stage === "final") { newChamp = win.join(" & "); nx.champion = newChamp; setChampion(newChamp); }
      }

      setPlayoffs(nx);
      playScoreSound();
      pushToFirebase(rounds, nx, newChamp);
      _upsertHist(rounds, nx, newChamp);
      if (!newChamp) confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#f1c835', '#35c8f1'] });
      addToast(`${m.label} result saved!`, "success", 2000);
    } catch (e) { console.error("savePlayoff error", e); addToast("Failed to save playoff score", "error"); }
  };

  const executeEnd = () => {
    canEditRef.current = false;
    joinCompleteRef.current = false;
    setPlayers([]); setRounds([]); setPlayoffs(null); setCode(null); setChampion(null); setShowConfirmEnd(false);
    setScorerPin(null);
  };

  const handleScorerPinEntered = async (enteredPin) => {
    // Verify PIN against Firebase
    try {
      const snap = await get(ref(db, `tournaments/${code}/scorerPin`));
      const fbPin = String(snap.val() || "").trim();
      const entered = String(enteredPin || "").trim();
      if (snap.exists() && fbPin === entered && fbPin.length > 0) {
        saveScorerPin(code, enteredPin);
        setScorerPin(enteredPin);
        canEditRef.current = true;
        setReadOnly(false);
        setShowScorerEntry(false);
        addToast("Scorer access granted! You can now enter scores.", "success");
      } else {
        addToast("Wrong PIN. Ask the tournament creator.", "error");
      }
    } catch {
      addToast("Could not verify PIN. Check connection.", "error");
    }
  };

  const copyStandingsText = () => {
    const st = computeStandings(players, rounds);
    const lines = ["🏓 PICKLEBALL STANDINGS", ""];
    st.forEach((s, i) => {
      const diff = s.scored - s.conceded;
      lines.push(`${i+1}. ${s.name} — ${s.pts}pts | ${s.won}W ${s.lost}L | ${diff>0?"+":""}${diff}`);
    });
    lines.push("", `Code: ${code}`);
    navigator.clipboard?.writeText(lines.join("\n")).then(() => addToast("Standings copied! Paste to WhatsApp 📋", "success", 3000));
  };

  const swipeTargetRef = useRef(null);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    swipeTargetRef.current = e.target;
  };

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    // Don't swipe tabs if the touch started inside a horizontally scrollable element
    const target = swipeTargetRef.current;
    if (target) {
      let el = target;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) return;
        el = el.parentElement;
      }
    }
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 60;
    const isRightSwipe = distance < -60;
    if (isLeftSwipe) {
      if (tab === "rounds") setTab("standings");
      else if (tab === "standings") setTab("playoffs");
      playAudio("tick");
    } else if (isRightSwipe) {
      if (tab === "playoffs") setTab("standings");
      else if (tab === "standings") setTab("rounds");
      playAudio("tick");
    }
  };

  // ── Screens ─────────────────────────────────────────────────────────────
  if (viewCareer) return <CareerScreen onBack={() => setViewCareer(false)} theme={theme} />;
  if (viewHist === "list") return <HistoryScreen onBack={() => setViewHist(null)} onOpen={t => setViewHist(t)} theme={theme} />;
  if (viewHist) return <HistoryDetail tournament={viewHist} onBack={() => setViewHist("list")} theme={theme} />;
  if (!code) return <SetupScreen onStart={handleStart} onJoin={handleJoin} onHistory={() => setViewHist("list")} onCareer={() => setViewCareer(true)} onToggleTheme={toggleTheme} theme={theme} />;

  const standings = computeStandings(players, rounds);
  const allM = rounds.flat();
  const totalM = allM.length;
  const totalPlayed = allM.filter(m => m.played).length;
  const pct = totalM ? Math.round((totalPlayed / totalM) * 100) : 0;
  const allDone = totalM > 0 && totalPlayed === totalM;

  // Eliminated players banner component
  const EliminatedBanner = ({ names }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", marginBottom: 16, borderRadius: "var(--radius-sm)", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
      <span style={{ fontSize: 16 }}>🚫</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-danger)", letterSpacing: 1 }}>ELIMINATED</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{names.join(", ")} — did not advance to playoffs</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Topbar */}
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: `1px solid var(--color-border)` }}>
        <div style={{ padding: "0 0.75rem" }}>
          {/* Main row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 52 }}>
            {/* Back */}
            <button onClick={() => setShowConfirmEnd(true)} className="ni" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", padding: "4px", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <ArrowLeft size={20} />
            </button>

            {/* Title + info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: theme === 'dark' ? 'var(--color-lime)' : '#f97316', letterSpacing: 1.5, lineHeight: 1, whiteSpace: "nowrap" }}>
                  {readOnly ? "👁 SPECTATING" : "LIVE"}
                </div>
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                {syncing && <RefreshCw size={10} className="spin" style={{ color: "rgba(255,255,255,0.6)" }} />}
                {isOffline && <WifiOff size={12} color="#fca5a5" />}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", display: "flex", gap: 6, alignItems: "center", marginTop: 1, overflow: "hidden" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={9} /> {onlineCount}</span>
                <span style={{ color: "#93c5fd", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 11 }}>{code}</span>
                <span>· {totalPlayed}/{totalM}</span>
              </div>
            </div>

            {/* Right side actions — only essentials visible, rest in one row */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              {/* Scorer lock */}
              {readOnly ? (
                <button className="pb" onClick={() => setShowScorerEntry(true)}
                  style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.5)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 4, color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  <Lock size={13} /> SCORER
                </button>
              ) : scorerPin ? (
                <button className="pb" onClick={() => setShowScorerPin(true)}
                  style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.5)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 4, color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  <Lock size={13} /> PIN
                </button>
              ) : null}

              {/* Share */}
              <button className="pb" onClick={() => setShowShare(true)}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", color: "#93c5fd", cursor: "pointer" }}>
                <Share2 size={14} />
              </button>

              {/* Theme */}
              <button className="pb" onClick={toggleTheme}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* Progress */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: 40, height: 3, background: "var(--color-border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--color-lime)", width: `${pct}%`, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.9)" }}>{pct}%</span>
              </div>
            </div>
          </div>

          {/* Tab strip */}
          <div style={{ display: "flex", gap: 4, paddingBottom: 8 }}>
            {[{ id: "rounds", label: "⚡ ROUNDS" }, { id: "standings", label: "📊 TABLE" }, { id: "playoffs", label: "🏆 PLAYOFFS" }].map(t => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? "on" : "off"}`} onClick={() => { setTab(t.id); playAudio("tick"); window.scrollTo(0, 0); }} style={{ flex: 1 }}>{t.label}</button>
            ))}
          </div>
        </div>
        <MatchTicker rounds={rounds} playoffs={playoffs} profiles={profiles} />
      </div>

      {/* Modals */}
      {showShare && <ShareModal code={code} onClose={() => setShowShare(false)} />}
      {showStandingsShare && <StandingsShareModal standings={standings} onClose={() => setShowStandingsShare(false)} playoffs={playoffs} champion={champion} />}
      {showScorerPin && scorerPin && <ScorerPinModal code={code} pin={scorerPin} onClose={() => setShowScorerPin(false)} />}
      {showScorerEntry && <ScorerPinEntry code={code} onGranted={handleScorerPinEntered} onClose={() => setShowScorerEntry(false)} />}

      {/* Confirm end */}
      {showConfirmEnd && (
        <div className="fu" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", maxWidth: 360, width: "90%", textAlign: "center" }}>
            <AlertCircle size={44} color="var(--color-danger)" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, marginBottom: 8 }}>END TOURNAMENT?</div>
            <div style={{ fontSize: 14, color: "var(--color-muted)", marginBottom: 24 }}>Progress is saved in history.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="pb" onClick={() => setShowConfirmEnd(false)} style={{ flex: 1, padding: "12px", background: "var(--color-surface)", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontWeight: 600, cursor: "pointer" }}>CANCEL</button>
              <button className="pb" onClick={executeEnd} style={{ flex: 1, padding: "12px", background: "var(--color-danger)", border: "none", borderRadius: "var(--radius-sm)", color: "white", fontWeight: 600, cursor: "pointer" }}>END IT</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "1.5rem 1rem 120px", maxWidth: 1000, margin: "0 auto" }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}>

        {/* ROUNDS */}
        {tab === "rounds" && (
          <div>
            <div className="desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 24, alignItems: "start" }}>
              {rounds.map((round, ri) => {
                const done = round.every(m => m.played);
                return (
                  <div key={ri} className="fu" style={{ animationDelay: `${ri * .03}s` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: done ? "var(--color-lime)" : "var(--color-text)", letterSpacing: 2 }}>ROUND {ri + 1}</div>
                      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                      <div style={{ fontSize: 11, letterSpacing: 1, color: done ? "var(--color-lime)" : "var(--color-muted)", fontWeight: 600 }}>{done ? "✓ DONE" : `${round.filter(m => m.played).length}/${round.length}`}</div>
                    </div>
                    {/* Bye indicator */}
                    {round[0]?.bye && round[0].bye.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", marginBottom: 8, borderRadius: 8, background: "rgba(241,200,53,0.08)", border: "1px solid rgba(241,200,53,0.2)" }}>
                        <span style={{ fontSize: 13 }}>☕</span>
                        <span style={{ fontSize: 12, color: "var(--color-gold)" }}>
                          Sitting out: <strong>{round[0].bye.join(", ")}</strong>
                        </span>
                      </div>
                    )}
                    {round.map((m, mi) => (
                      <div key={mi} className={animatingScore === `${ri}-${mi}` ? "score-flash" : ""}>
                        <MatchCard match={m} delay={mi * .04} readOnly={readOnly} onSave={(a, b, dur, notes) => saveResult(ri, mi, a, b, dur, notes)} h2hMatrix={h2hMatrix} profiles={profiles} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {allDone && !playoffs && !readOnly && (
              <div className="fu" style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap", animationDelay: "0.2s" }}>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "var(--color-lime)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--color-dark)" }} onClick={startPlayoffs}>🏆 FULL PLAYOFFS</button>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "transparent", border: `2px solid var(--color-gold)`, borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-gold)" }} onClick={declareAsFinal}>⚡ QUICK FINAL</button>
              </div>
            )}
          </div>
        )}

        {/* STANDINGS */}
        {tab === "standings" && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="pb" onClick={copyStandingsText} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "var(--radius-sm)", color: "#25d366", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                📋 COPY FOR WHATSAPP
              </button>
              <button className="pb" onClick={() => setShowStandingsShare(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--color-surface)", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Camera size={14} /> SHARE IMAGE
              </button>
            </div>
            <TournamentAwards players={players} rounds={rounds} champion={champion} profiles={profiles} />
            <StandingsTable standings={standings} rounds={rounds} profiles={profiles} />
            {allDone && !playoffs && !readOnly && (
              <div className="fu" style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap", animationDelay: "0.2s" }}>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "var(--color-lime)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--color-dark)" }} onClick={startPlayoffs}>🏆 FULL PLAYOFFS</button>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "transparent", border: `2px solid var(--color-gold)`, borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-gold)" }} onClick={declareAsFinal}>⚡ QUICK FINAL</button>
              </div>
            )}
          </div>
        )}

        {/* PLAYOFFS */}
        {tab === "playoffs" && (
          <div className="fu">
            {!playoffs ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "5rem 1rem", borderRadius: "var(--radius-lg)" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: "var(--color-border)", letterSpacing: 4, lineHeight: 1 }}>LOCKED</div>
                <div style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 12 }}>Complete all group matches first</div>
                {allDone && !readOnly && (
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
                    <button className="pb" style={{ padding: "16px 32px", background: "var(--color-lime)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-dark)", cursor: "pointer" }} onClick={startPlayoffs}>FULL PLAYOFFS</button>
                    <button className="pb" style={{ padding: "16px 32px", background: "transparent", border: `2px solid var(--color-gold)`, borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: "var(--color-gold)", cursor: "pointer" }} onClick={declareAsFinal}>QUICK FINAL</button>
                  </div>
                )}
              </div>
            ) : (playoffs.q1 || playoffs.final || playoffs.sf1) ? (
              <div style={{ maxWidth: 800, margin: "0 auto" }}>
                {/* Bracket mode label */}
                {(() => {
                  const mode = playoffs.mode || "ipl8";
                  const labels = { final_only: "GRAND FINAL", elim_to_sf: "TOP 4 BRACKET", ipl6: "6-TEAM IPL BRACKET", ipl8: "IPL PLAYOFF BRACKET", top8: "TOP 8 BRACKET", top8_ipl: "TOP 8 IPL BRACKET" };
                  const desc = { final_only: "Single match final", elim_to_sf: "Semi Final + Final", ipl6: "Q1 · Eliminator · Final", ipl8: "Q1 · Eliminator · Q2 · Final", top8: "QF · SF · Final", top8_ipl: "Q1 · Q2 · Elim · SF · Final" };
                  return !champion && !playoffs.champion ? (
                    <div style={{ textAlign:"center", marginBottom: 20 }}>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize: 22, color:"var(--color-lime)", letterSpacing: 3 }}>{labels[mode]}</div>
                      <div style={{ fontSize: 12, color:"var(--color-muted)" }}>{desc[mode]} · {players.length} players</div>
                    </div>
                  ) : null;
                })()}
                {(champion || playoffs.champion) && (
                  <div className="fu glass-card" style={{ border: `1px solid var(--color-lime)`, borderRadius: "var(--radius-lg)", padding: "2rem", textAlign: "center", marginBottom: 24, background: "rgba(200, 241, 53, 0.05)" }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 11, letterSpacing: 4, color: "var(--color-lime)", marginBottom: 8, fontWeight: 600 }}>TOURNAMENT CHAMPIONS</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "var(--color-lime)", letterSpacing: 3 }}>{champion || playoffs.champion}</div>
                  </div>
                )}
                {(() => {
                  const mode = playoffs.mode || "ipl8";
                  const PC = ({ stage, match, accent }) => match ? (
                    <PlayoffCard match={match} onSave={(a,b,d,n) => savePlayoff(stage,a,b,d,n)} accent={accent||"var(--color-lime)"} readOnly={readOnly} h2hMatrix={h2hMatrix} profiles={profiles} />
                  ) : null;

                  // Eliminated players banner
                  const eliminated = playoffs.eliminated || [];

                  if (mode === "final_only") return (
                    <>
                      {eliminated.length > 0 && <EliminatedBanner names={eliminated} />}
                      <PC stage="final" match={playoffs.final} accent="var(--color-gold)" />
                    </>
                  );

                  if (mode === "elim_to_sf") return (
                    <>
                      {eliminated.length > 0 && <EliminatedBanner names={eliminated} />}
                      <PC stage="sf1" match={playoffs.sf1} accent="var(--color-lime)" />
                      {playoffs.final?.teamA && <div style={{marginTop:16}}><PC stage="final" match={playoffs.final} accent="var(--color-gold)" /></div>}
                    </>
                  );

                  if (mode === "ipl6") return (
                    <>
                      {eliminated.length > 0 && <EliminatedBanner names={eliminated} />}
                      <PC stage="q1" match={playoffs.q1} accent="var(--color-lime)" />
                      {playoffs.elim && <div style={{marginTop:16}}><PC stage="elim" match={playoffs.elim} accent="var(--color-cyan)" /></div>}
                      {playoffs.final?.teamA && <div style={{marginTop:16}}><PC stage="final" match={playoffs.final} accent="var(--color-gold)" /></div>}
                    </>
                  );

                  if (mode === "ipl8") return (
                    <>
                      <div className="playoff-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                        <PC stage="q1"   match={playoffs.q1}   accent="var(--color-lime)" />
                        <PC stage="elim" match={playoffs.elim} accent="var(--color-cyan)" />
                      </div>
                      {playoffs.q2 && <div style={{marginBottom:16}}><PC stage="q2" match={playoffs.q2} accent="var(--color-gold)" /></div>}
                      {playoffs.final && <PC stage="final" match={playoffs.final} accent="var(--color-lime)" />}
                    </>
                  );

                  if (mode === "top8") return (
                    <>
                      {eliminated.length > 0 && <EliminatedBanner names={eliminated} />}
                      <div className="playoff-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                        <PC stage="qf1" match={playoffs.qf1} accent="var(--color-lime)" />
                        <PC stage="qf2" match={playoffs.qf2} accent="var(--color-cyan)" />
                      </div>
                      <div className="playoff-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                        <PC stage="sf1" match={playoffs.sf1} accent="var(--color-gold)" />
                        <PC stage="sf2" match={playoffs.sf2} accent="var(--color-gold)" />
                      </div>
                      {playoffs.final && <PC stage="final" match={playoffs.final} accent="var(--color-lime)" />}
                    </>
                  );

                  if (mode === "top8_ipl") return (
                    <>
                      {eliminated.length > 0 && <EliminatedBanner names={eliminated} />}
                      <div className="playoff-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                        <PC stage="q1"   match={playoffs.q1}   accent="var(--color-lime)" />
                        <PC stage="q2_b" match={playoffs.q2_b} accent="var(--color-cyan)" />
                      </div>
                      <div className="playoff-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                        <PC stage="elim" match={playoffs.elim} accent="var(--color-gold)" />
                        <PC stage="sf"   match={playoffs.sf}   accent="var(--color-gold)" />
                      </div>
                      {playoffs.final && <PC stage="final" match={playoffs.final} accent="var(--color-lime)" />}
                    </>
                  );

                  return null;
                })()}
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>FINAL STANDINGS</div>
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                  </div>
                  <TournamentAwards players={players} rounds={rounds} champion={champion} />
                  {/* Share buttons — only shown when tournament is complete */}
                  {(champion || playoffs?.champion) && (
                    <div className="fu" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      <button className="pb" onClick={copyStandingsText} style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "var(--radius-sm)", color: "#25d366", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        📋 COPY FOR WHATSAPP
                      </button>
                      <button className="pb" onClick={() => setShowStandingsShare(true)} style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "var(--color-surface)", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <Camera size={14} /> SHARE IMAGE
                      </button>
                    </div>
                  )}
                  <StandingsTable standings={standings} rounds={rounds} playoffs={playoffs} champion={champion} />
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ textAlign: "center", padding: "4rem", borderRadius: "var(--radius-lg)" }}>
                <RefreshCw className="spin text-muted" size={32} style={{ margin: "0 auto 16px" }} />
                <div style={{ fontSize: 14, color: "var(--color-muted)" }}>Loading playoffs...</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Reactions */}
      <ReactionsOverlay code={code} readOnly={readOnly} />

      {/* Champion Trophy Overlay */}
      {champion && <div className="champion-trophy" style={{ fontSize: "25vh" }}>🏆</div>}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <PickleballApp />
    </ToastProvider>
  );
}
