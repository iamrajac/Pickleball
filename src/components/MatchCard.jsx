import { useState, useRef, useEffect } from "react";
import { useTimer } from "../utils/useTimer";
import { Play, Pause, X, Share2 } from "lucide-react";
import { validatePickleballScore, scoreHint } from "../utils/pickleballRules";
import { getH2HStats } from "../utils/history";
import { PlayerAvatar } from "./PlayerAvatar";
import { playAudio } from "../utils/audio";
import { notifyComeback } from "../utils/notifications";
import html2canvas from "html2canvas";

function ScoreCounter({ value, onChange, hasError, incDisabled }) {
  const num = value === "" ? null : Number(value);
  const [pop, setPop] = useState(false);
  const prevNum = useRef(num);
  useEffect(() => {
    if (num !== prevNum.current && num !== null) {
      setPop(true);
      const t = setTimeout(() => setPop(false), 280);
      prevNum.current = num;
      return () => clearTimeout(t);
    }
    prevNum.current = num;
  }, [num]);
  const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
  const dec = () => { if (num !== null && num > 0) { haptic(); onChange(String(num - 1)); } };
  const inc = () => { if (!incDisabled) { haptic(); onChange(String(num === null ? 0 : num + 1)); } };

  const btnStyle = (active, disabled) => ({
    width: 32, height: 32, borderRadius: 6,
    background: disabled ? 'var(--color-surface)' : active ? 'rgba(200,241,53,0.15)' : 'var(--color-surface)',
    border: `1px solid ${disabled ? 'rgba(128,128,128,0.2)' : active ? 'rgba(200,241,53,0.4)' : 'var(--color-border)'}`,
    color: disabled ? 'rgba(128,128,128,0.3)' : active ? 'var(--color-lime)' : 'var(--color-muted)',
    fontSize: 18, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <button className="pb" onPointerDown={e => { e.preventDefault(); inc(); }} style={btnStyle(!incDisabled, incDisabled)} disabled={incDisabled}>+</button>
      <div className={pop ? "score-count-pop" : ""} style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, lineHeight: 1,
        color: hasError ? 'var(--color-danger)' : num !== null ? 'var(--color-lime)' : 'var(--color-muted)',
        minWidth: 32, textAlign: "center", userSelect: "none",
        display: "inline-block",
      }}>
        {num !== null ? num : "—"}
      </div>
      <button className="pb" onPointerDown={e => { e.preventDefault(); dec(); }} style={btnStyle(num !== null && num > 0, false)} disabled={num === null || num <= 0}>−</button>
    </div>
  );
}

// ── Auto note generator ────────────────────────────────────────────────────
export function generateAutoNote(history, teamA, teamB) {
  if (history.length === 0) return "";
  const curr = history[history.length - 1];
  const a = curr.a, b = curr.b;
  const tA = teamA?.join(" & ") || "Team A";
  const tB = teamB?.join(" & ") || "Team B";

  // First point ever
  if (a + b === 1) return `First point to ${a === 1 ? tA : tB} 🏓`;

  // Perfect game possibility
  if (a === 11 && b === 0) return `🔥 Dominant! ${tA} leading 11-0 — perfect start!`;
  if (b === 11 && a === 0) return `🔥 Dominant! ${tB} leading 11-0 — perfect start!`;
  if (a === 0 && b >= 5)   return `${tB} leading ${b}-0 — ${tA} yet to score`;
  if (b === 0 && a >= 5)   return `${tA} leading ${a}-0 — ${tB} yet to score`;

  // Tied moments
  if (a === b) {
    if (a >= 10) return `😱 ${a}-${a}! Deuce — next 2 points wins it!`;
    if (a >= 8)  return `Tied ${a}-${a}! Anyone's game now`;
    if (a >= 5)  return `Level at ${a}-${a}`;
    if (a === 1) return `1-1 — all square`;
    return "";
  }

  // Comeback detection — current leader was once trailing
  if (a !== b) {
    const leader = a > b ? "a" : "b";
    const leaderName = a > b ? tA : tB;
    let maxDeficit = 0;
    for (const h of history) {
      const deficit = leader === "a" ? h.b - h.a : h.a - h.b;
      if (deficit > maxDeficit) maxDeficit = deficit;
    }
    if (maxDeficit >= 7) return `🤯 Unbelievable! ${leaderName} came back from ${maxDeficit} down!`;
    if (maxDeficit >= 5) return `💪 What a comeback! ${leaderName} were down ${maxDeficit} points!`;
    if (maxDeficit >= 3) return `${leaderName} fighting back — came from ${maxDeficit} down`;
  }

  // Consecutive run by same team
  let run = 0;
  let runTeam = null;
  for (let i = history.length - 1; i > 0; i--) {
    const cur = history[i], prev = history[i - 1];
    // Determine who scored this point
    const scorer = cur.a > prev.a ? "a" : cur.b > prev.b ? "b" : null;
    if (!scorer) break; // score decreased (manual correction), stop
    if (runTeam === null) runTeam = scorer;
    if (scorer === runTeam) run++;
    else break;
  }
  const runName = runTeam === "a" ? tA : tB;
  if (run >= 7) return `🔥 Unstoppable! ${runName} on a ${run}-point tear!`;
  if (run >= 5) return `🔥 ${runName} on a ${run}-point run!`;
  if (run >= 3) return `${runName} scoring ${run} in a row`;

  // Match point / game point situations
  const high = Math.max(a, b), low = Math.min(a, b);
  const leader = a > b ? tA : tB;
  if (high === 10 && low <= 8) return `${leader} on match point!`;
  if (high === 10 && low === 9) return `${leader} on match point — ${low <= 9 ? tA === leader ? tB : tA : ""} must score!`;

  return "";
}

export function MatchCard({ match, onSave, delay = 0, readOnly = false, h2hMatrix = {}, profiles = {},
  timerState, onTimerStart, onTimerStop, onTimerReset, onLiveScore, liveScore, tournamentName, roundIndex }) {
  const [sA, setSA] = useState(match.scoreA ?? "");
  const [sB, setSB] = useState(match.scoreB ?? "");
  const [localTouched, setLocalTouched] = useState(false); // true once THIS device taps +/-
  const [matchNotes, setMatchNotes] = useState(match.notes || "");
  const [notesEdited, setNotesEdited] = useState(false);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [storyMoments, setStoryMoments] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [localSaved, setLocalSaved] = useState(false); // instantly hides SAVE on this device
  const [liveTick, setLiveTick] = useState(0); // forces re-render for live timer
  const [scoreSynced, setScoreSynced] = useState(false); // visual feedback for sync

  // ── Sync live score from Firebase when local hasn't been touched ──────────
  useEffect(() => {
    if (match.played || localTouched || !liveScore) return;
    // Update display to show what scorer device has
    if (liveScore.a > 0 || liveScore.b > 0) {
      setSA(String(liveScore.a));
      setSB(String(liveScore.b));
    }
    if (liveScore.note) setMatchNotes(liveScore.note);
  }, [liveScore?.a, liveScore?.b, liveScore?.note, localTouched, match.played]);

  // ── Live timer tick for OTHER devices (reads from liveScore.startedAt) ────
  useEffect(() => {
    if (!liveScore?.startedAt) return;
    // Force re-render every 100ms for smooth timer update
    const id = setInterval(() => setLiveTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, [liveScore?.startedAt]);

  // ── Local (lifted) timer ──────────────────────────────────────────────────
  const localTimer = useTimer();
  const usingLiftedTimer = !!timerState;
  const timer = usingLiftedTimer ? {
    elapsed: timerState.startedAt && timerState.running
      ? Math.floor((Date.now() - timerState.startedAt) / 1000)
      : timerState.elapsed,
    running: timerState.running,
    start:   onTimerStart,
    stop:    () => {
      const final = timerState.startedAt && timerState.running
        ? Math.floor((Date.now() - timerState.startedAt) / 1000)
        : timerState.elapsed;
      onTimerStop(); return final;
    },
    reset:   onTimerReset,
    fmt:     localTimer.fmt,
  } : localTimer;

  // Tick for lifted timer
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!usingLiftedTimer || !timerState?.running) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [usingLiftedTimer, timerState?.running]);

  // ── Live timer from other device ──────────────────────────────────────────
  const liveTimerElapsed = liveScore?.startedAt && !localTouched
    ? Math.floor((Date.now() - liveScore.startedAt) / 1000) : null;

  // Fair serve & side assignment algorithm (deterministic hash)
  const hash = String((match.teamA || []).join("") + match.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const serveTeamA = hash % 2 === 0;
  const sideLeftA = (hash >> 1) % 2 === 0;
  const servingTeam = serveTeamA ? match?.teamA?.join(" & ") : match?.teamB?.join(" & ");
  const serveSide = serveTeamA ? (sideLeftA ? "Left" : "Right") : (!sideLeftA ? "Left" : "Right");

  const isPlayed = match.played || localSaved;
  const wA = isPlayed && (localSaved ? Number(sA) > Number(sB) : match.scoreA > match.scoreB);
  const wB = isPlayed && (localSaved ? Number(sB) > Number(sA) : match.scoreB > match.scoreA);
  const fmtDur = s => s ? `${Math.floor(s / 60)}m ${s % 60}s` : null;

  const hint = scoreHint(sA, sB);
  const canSave = sA !== "" && sB !== "" && !hint;

  // Disable + once a side has already won (reached 11+ with 2-point lead)
  // This prevents over-incrementing on a finished game
  const numA = sA === "" ? 0 : Number(sA);
  const numB = sB === "" ? 0 : Number(sB);
  const aWon = numA >= 11 && (numA - numB) >= 2;
  const bWon = numB >= 11 && (numB - numA) >= 2;

  // notesEdited ref — avoids stale closure in setScoreHistory callback
  const notesEditedRef = useRef(false);
  useEffect(() => { notesEditedRef.current = notesEdited; }, [notesEdited]);

  // ── Push live score to Firebase IMMEDIATELY on every change ───────────────
  useEffect(() => {
    if (match.played) return;
    const numA = sA === "" ? 0 : Number(sA);
    const numB = sB === "" ? 0 : Number(sB);
    // Push every change instantly (no debounce for real-time feedback)
    onLiveScore?.(numA, numB, matchNotes, timerState?.startedAt || null);
    // Visual feedback: show sync confirmation briefly
    setScoreSynced(true);
    const timer = setTimeout(() => setScoreSynced(false), 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sA, sB, matchNotes, timerState?.startedAt]);

  // ── Push live timer state whenever timer changes ───────────────────────────
  useEffect(() => {
    if (match.played) return;
    const numA = sA === "" ? 0 : Number(sA);
    const numB = sB === "" ? 0 : Number(sB);
    // Always push when timer state changes (start, stop, or tick)
    onLiveScore?.(numA, numB, matchNotes, timerState?.startedAt || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState?.running, timerState?.startedAt, timerState?.elapsed]);

  // ── Track score progression ────────────────────────────────────────────────
  const updateScore = (newA, newB) => {
    const numA = newA === "" ? 0 : Number(newA);
    const numB = newB === "" ? 0 : Number(newB);
    if (isNaN(numA) || isNaN(numB)) return;

    setScoreHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.a === numA && last.b === numB) return prev;
      const newHistory = [...prev, { a: numA, b: numB }];
      if (!notesEditedRef.current) {
        const moment = generateAutoNote(newHistory, match.teamA, match.teamB);
        if (moment) {
          setMatchNotes(moment);
          // Fire comeback push notification
          if (moment.includes("comeback")) {
            const trailing = numA < numB ? match.teamA?.join(" & ") : match.teamB?.join(" & ");
            notifyComeback(trailing || "A team", `${Math.min(numA,numB)}-${Math.max(numA,numB)}`, `${numA}-${numB}`);
          }
          setStoryMoments(prevStory => {
            const last = prevStory[prevStory.length - 1];
            if (last === moment) return prevStory;
            const isRun        = m => m && (m.includes("point run") || m.includes("on fire") || m.includes("in a row") || m.includes("Unstoppable") || m.includes("scoring"));
            const isComeback   = m => m && m.includes("comeback");
            const isTied       = m => m && (m.includes("Tied") || m.includes("Level") || m.includes("Deuce"));
            const isDominating = m => m && (m.includes("yet to score") || m.includes("leading") || m.includes("Dominant") || m.includes("shutout") || m.includes("perfect"));
            const isMatchPt    = m => m && m.includes("match point");
            const sameType = (a, b) =>
              (isRun(a) && isRun(b)) || (isComeback(a) && isComeback(b)) ||
              (isTied(a) && isTied(b)) || (isDominating(a) && isDominating(b)) ||
              (isMatchPt(a) && isMatchPt(b));
            return sameType(moment, last) ? [...prevStory.slice(0, -1), moment] : [...prevStory, moment];
          });
        }
      }
      return newHistory;
    });
  };

  // Only compute H2H when match is active (user focused on it)
  const h2hData = [];
  if (isActive && !match.played && h2hMatrix && match.teamA && match.teamB) {
    match.teamA.forEach(a => {
      match.teamB.forEach(b => {
        const stat = getH2HStats(a, b, h2hMatrix);
        if (stat) h2hData.push({ a, b, stat });
      });
    });
  }

  const cardRef = useRef(null);
  const shareCardRef = useRef(null);

  const shareCard = async () => {
    // Build off-screen card
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:400px;height:220px;";
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    const winnerA = scoreA > scoreB;
    const teamA = match.teamA?.join(" & ") || "Team A";
    const teamB = match.teamB?.join(" & ") || "Team B";
    const winner = winnerA ? teamA : teamB;
    const rndLabel = roundIndex != null ? `Round ${roundIndex + 1}` : "";
    container.innerHTML = `
      <div style="width:400px;height:220px;background:#0d1117;display:flex;flex-direction:column;justify-content:space-between;padding:20px 24px;box-sizing:border-box;font-family:'Bebas Neue',Arial,sans-serif;color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;color:#c8f135;letter-spacing:2px;">${(tournamentName || "PICKLEBALL").toUpperCase()}</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:1px;">${rndLabel.toUpperCase()}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="flex:1;text-align:left;">
            <div style="font-size:${teamA.length > 14 ? 14 : 18}px;letter-spacing:1px;color:${winnerA ? '#c8f135' : 'rgba(255,255,255,0.55)'};">${teamA}</div>
            ${winnerA ? '<div style="font-size:10px;color:#c8f135;letter-spacing:2px;margin-top:4px;">WINNER ✓</div>' : ''}
          </div>
          <div style="text-align:center;min-width:90px;">
            <div style="font-size:52px;letter-spacing:4px;line-height:1;color:#c8f135;">${scoreA}–${scoreB}</div>
          </div>
          <div style="flex:1;text-align:right;">
            <div style="font-size:${teamB.length > 14 ? 14 : 18}px;letter-spacing:1px;color:${!winnerA ? '#c8f135' : 'rgba(255,255,255,0.55)'};">${teamB}</div>
            ${!winnerA ? '<div style="font-size:10px;color:#c8f135;letter-spacing:2px;margin-top:4px;">WINNER ✓</div>' : ''}
          </div>
        </div>
        <div style="display:flex;justify-content:center;align-items:center;">
          <span style="font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:1px;">pickleball-eosin.vercel.app</span>
        </div>
      </div>`;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container.firstElementChild, { backgroundColor: "#0d1117", scale: 2, logging: false });
      document.body.removeChild(container);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "match-result.png", { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `${teamA} vs ${teamB}`, text: `${winner} wins ${scoreA}-${scoreB}!` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "match-result.png"; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }, "image/png");
    } catch (e) {
      if (document.body.contains(container)) document.body.removeChild(container);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setIsActive(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isActive]);

  const handleSave = () => {
    if (!canSave) return;
    const { valid } = validatePickleballScore(sA, sB);
    if (!valid) return;
    const dur = timer.running ? timer.stop() : timer.elapsed || null;
    timer.reset();
    setIsActive(false);
    setLocalSaved(true); // instantly switch card to "done" state while Firebase updates
    playAudio("pop");

    // Build full match narrative from accumulated story moments
    let finalNote = matchNotes;
    if (!notesEdited && storyMoments.length > 0) {
      const numA = Number(sA), numB = Number(sB);
      const winner = numA > numB ? match.teamA?.join(" & ") : match.teamB?.join(" & ");
      const score = `${Math.max(numA, numB)}-${Math.min(numA, numB)}`;
      // Deduplicate consecutive same moments
      const deduped = storyMoments.filter((m, i) => i === 0 || m !== storyMoments[i - 1]);
      finalNote = deduped.join(" · ") + ` · ${winner} won ${score}`;
    }

    onSave(Number(sA), Number(sB), dur, finalNote);
  };

  return (
    <div ref={cardRef} className="mc fu glass-card" onClick={() => { if (!isPlayed && !readOnly) setIsActive(true); }} style={{ animationDelay: `${delay}s`, borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', marginBottom: 8, position: "relative", overflow: "hidden" }}>
      {isPlayed && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: 'var(--color-lime)' }} />}
      {timer.running && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: 'var(--color-cyan)', animation: "pulse 1s infinite" }} />}

      <div className="mc-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            {match?.teamA?.map((p, i) => (
              <div key={p} style={{ marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={22} /></div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: wA ? 'var(--color-lime)' : wB ? 'var(--color-muted)' : 'var(--color-text)', lineHeight: 1.35 }}>
            {match?.teamA ? match.teamA.join(" & ") : "TBD"}
          </div>
          {wA && <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-lime)', marginTop: 4 }}>WIN ✓</div>}
        </div>

        {isPlayed ? (
          <div style={{ textAlign: "center", minWidth: 72 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--color-lime)', letterSpacing: 3, lineHeight: 1 }}>
              {localSaved ? `${sA}–${sB}` : `${match.scoreA}–${match.scoreB}`}
            </div>
            {match.duration && <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 4 }}>⏱ {fmtDur(match.duration)}</div>}
            <button className="pb" onClick={(e) => { e.stopPropagation(); shareCard(); }}
              style={{ marginTop: 6, background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4, fontSize: 10, margin: "6px auto 0" }}>
              <Share2 size={10} /> SHARE
            </button>
          </div>
        ) : readOnly ? (
          <div style={{ textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--color-muted)', letterSpacing: 2 }}>VS</div>
        ) : (
          <div className="match-score-area" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 120, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ScoreCounter value={sA} onChange={v => { setSA(v); setIsActive(true); updateScore(v, sB); }} hasError={!!(hint && sA !== "" && sB !== "")} incDisabled={aWon} />
              <span style={{ color: 'var(--color-muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, margin: "0 2px" }}>VS</span>
              <ScoreCounter value={sB} onChange={v => { setSB(v); setIsActive(true); updateScore(sA, v); }} hasError={!!(hint && sA !== "" && sB !== "")} incDisabled={bWon} />
            </div>
            <button className="pb" onClick={handleSave} disabled={!canSave}
              style={{ width: "100%", background: canSave ? 'var(--color-lime)' : 'rgba(200,241,53,0.2)', border: "none", borderRadius: 'var(--radius-sm)', padding: "8px 4px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, color: canSave ? 'var(--color-dark)' : 'var(--color-muted)', cursor: canSave ? "pointer" : "not-allowed", position: "relative", overflow: "hidden" }}>
              SAVE
              {scoreSynced && (
                <span style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-dark)", fontWeight: 700, animation: "slideIn 0.3s ease-out" }}>✓</span>
              )}
            </button>
          </div>
        )}

        <div className="mc-team-right" style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            {match?.teamB?.map((p, i) => (
              <div key={p} style={{ marginLeft: i > 0 ? -12 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={22} /></div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: wB ? 'var(--color-lime)' : wA ? 'var(--color-muted)' : 'var(--color-text)', lineHeight: 1.35 }}>
            {match?.teamB ? match.teamB.join(" & ") : "TBD"}
          </div>
          {wB && <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-lime)', marginTop: 4 }}>WIN ✓</div>}
        </div>
      </div>

      {/* Score validation hint */}
      {!isPlayed && !readOnly && hint && sA !== "" && sB !== "" && (
        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,85,85,0.1)", border: "1px solid rgba(255,85,85,0.3)", fontSize: 11, color: 'var(--color-danger)', display: "flex", alignItems: "center", gap: 6 }}>
          ⚠ {hint}
        </div>
      )}

      {/* Serve and Match Notes Area */}
      {!isPlayed && !readOnly && isActive && (
        <div style={{ marginTop: 12, padding: "10px", background: 'rgba(0,0,0,0.2)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            🎾 <strong style={{ color: 'var(--color-text)' }}>{servingTeam || "TBD"}</strong> serves first from the <strong style={{ color: 'var(--color-text)' }}>{serveSide}</strong> side.
          </div>
          <div style={{ position: "relative" }}>
            <input type="text" placeholder="Match notes (auto-generated or type your own...)"
              value={matchNotes}
              onChange={e => { setMatchNotes(e.target.value); setNotesEdited(true); }}
              style={{ width: '100%', background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', padding: "8px", paddingRight: matchNotes ? "28px" : "8px", fontSize: 12, boxSizing: "border-box" }} />
            {matchNotes && (
              <button onClick={() => { setMatchNotes(""); setNotesEdited(false); }}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                <X size={12} />
              </button>
            )}
          </div>
          {matchNotes && !notesEdited && (
            <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 4, fontStyle: "italic" }}>✨ Auto-generated — tap to edit</div>
          )}
        </div>
      )}

      {/* Timer row — local or live synced */}
      {!isPlayed && !readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid var(--color-border)` }}>
          {/* Show live timer from another device if we're not the scorer */}
          {liveTimerElapsed !== null && !localTouched && (
            <>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--color-cyan)', letterSpacing: 2 }}>{localTimer.fmt(liveTimerElapsed)}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "rgba(16, 212, 142, 0.1)", border: "1px solid var(--color-lime)", borderRadius: "var(--radius-sm)", fontSize: 9, color: "var(--color-lime)", fontWeight: 600, letterSpacing: 1 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--color-lime)", animation: "pulse 1.5s infinite" }} />
                LIVE
              </div>
            </>
          )}
          {/* Show local timer when scorer is controlling it */}
          {(localTouched || liveTimerElapsed === null) && (
            <>
              {timer.running && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--color-cyan)', letterSpacing: 2 }}>{timer.fmt(timer.elapsed)}</span>}
              {!timer.running && timer.elapsed > 0 && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--color-muted)' }}>{timer.fmt(timer.elapsed)}</span>}
              <button className="pb" onClick={() => { setIsActive(true); timer.running ? timer.stop() : timer.start(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: timer.running ? 'rgba(53, 200, 241, 0.1)' : 'var(--color-surface)', border: `1px solid ${timer.running ? 'var(--color-cyan)' : 'var(--color-border)'}`, color: timer.running ? 'var(--color-cyan)' : 'var(--color-muted)', borderRadius: 'var(--radius-sm)', padding: "6px 12px", fontSize: 12, fontWeight: 500 }}>
                {timer.running ? <Pause size={14} /> : <Play size={14} />}
                {timer.running ? "PAUSE" : "TIMER"}
              </button>
              {timer.elapsed > 0 && !timer.running && (
                <button className="pb" onClick={timer.reset} style={{ display: 'flex', alignItems: 'center', background: "transparent", border: "none", color: 'var(--color-muted)', padding: "6px" }}>
                  <X size={16} />
                </button>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* H2H — only shown when match is active */}
      {h2hData.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid var(--color-border)` }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--color-gold)', marginBottom: 6 }}>📊 HEAD-TO-HEAD</div>
          <div style={{ display: 'grid', gridTemplateColumns: h2hData.length > 2 ? '1fr 1fr' : '1fr', gap: 6 }}>
            {h2hData.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                <strong style={{ color: 'var(--color-text)' }}>{d.a} vs {d.b}:</strong> {d.stat}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
