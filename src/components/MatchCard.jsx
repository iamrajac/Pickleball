import { useState, useRef, useEffect } from "react";
import { useTimer } from "../utils/useTimer";
import { Play, Pause, X } from "lucide-react";
import { validatePickleballScore, scoreHint } from "../utils/pickleballRules";
import { getH2HStats } from "../utils/history";
import { PlayerAvatar } from "./PlayerAvatar";
import { playAudio } from "../utils/audio";

function ScoreCounter({ value, onChange, hasError }) {
  const num = value === "" ? null : Number(value);
  const dec = () => { if (num !== null && num > 0) onChange(String(num - 1)); };
  const inc = () => { onChange(String(num === null ? 0 : num + 1)); };

  const btnStyle = (active) => ({
    width: 32, height: 32, borderRadius: 6,
    background: active ? 'rgba(200,241,53,0.15)' : 'var(--color-surface)',
    border: `1px solid ${active ? 'rgba(200,241,53,0.4)' : 'var(--color-border)'}`,
    color: active ? 'var(--color-lime)' : 'var(--color-muted)',
    fontSize: 18, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <button className="pb" onPointerDown={e => { e.preventDefault(); inc(); }} style={btnStyle(true)}>+</button>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, lineHeight: 1,
        color: hasError ? 'var(--color-danger)' : num !== null ? 'var(--color-lime)' : 'var(--color-muted)',
        minWidth: 32, textAlign: "center", userSelect: "none",
      }}>
        {num !== null ? num : "—"}
      </div>
      <button className="pb" onPointerDown={e => { e.preventDefault(); dec(); }} style={btnStyle(num !== null && num > 0)} disabled={num === null || num <= 0}>−</button>
    </div>
  );
}

// ── Auto note generator ────────────────────────────────────────────────────
function generateAutoNote(history, teamA, teamB) {
  if (history.length < 2) return "";
  const curr = history[history.length - 1];
  const a = curr.a, b = curr.b;
  const tA = teamA?.join(" & ") || "Team A";
  const tB = teamB?.join(" & ") || "Team B";
  const total = a + b;

  // Perfect game
  if ((a === 11 && b === 0)) return `🔥 Dominant! ${tA} win 11-0 — shutout!`;
  if ((b === 11 && a === 0)) return `🔥 Dominant! ${tB} win 11-0 — shutout!`;

  // Comeback — current leader was once down by 5+
  if (a !== b) {
    const leader = a > b ? "a" : "b";
    const leaderName = a > b ? tA : tB;
    let maxDeficit = 0;
    for (let i = 0; i < history.length - 1; i++) {
      const h = history[i];
      const deficit = leader === "a" ? h.b - h.a : h.a - h.b;
      if (deficit > maxDeficit) maxDeficit = deficit;
    }
    if (maxDeficit >= 7) return `🤯 Unbelievable comeback! ${leaderName} were down ${maxDeficit} points!`;
    if (maxDeficit >= 5) return `💪 What a comeback! ${leaderName} came back from ${maxDeficit} down!`;
    if (maxDeficit >= 3) return `${leaderName} fought back from ${maxDeficit} down.`;
  }

  // Tied at high score
  if (a === b && a >= 10) return `😱 Tied at ${a}-${a}! Nerve-wracking!`;
  if (a === b && a >= 8)  return `Tied at ${a}-${a}! What a match!`;

  // Current run of consecutive points
  let run = 0;
  let lastScorer = null;
  for (let i = history.length - 1; i > 0; i--) {
    const cur = history[i], prev = history[i - 1];
    const scorer = cur.a > prev.a ? "a" : "b";
    if (lastScorer === null) lastScorer = scorer;
    if (scorer === lastScorer) run++;
    else break;
  }
  if (run >= 6) return `🔥 ${lastScorer === "a" ? tA : tB} on fire — ${run} points in a row!`;
  if (run >= 4) return `${lastScorer === "a" ? tA : tB} on a ${run}-point run!`;

  // First point
  if (total === 1) return `First point to ${a === 1 ? tA : tB}.`;

  return "";
}

export function MatchCard({ match, onSave, delay = 0, readOnly = false, h2hMatrix = {}, profiles = {},
  timerState, onTimerStart, onTimerStop, onTimerReset }) {
  const [sA, setSA] = useState(match.scoreA ?? "");
  const [sB, setSB] = useState(match.scoreB ?? "");
  const [matchNotes, setMatchNotes] = useState(match.notes || "");
  const [notesEdited, setNotesEdited] = useState(false); // true once user manually types
  const [scoreHistory, setScoreHistory] = useState([]); // sequence of {a, b} for auto-notes
  const [isActive, setIsActive] = useState(false);
  // Use lifted timer state if provided, otherwise fall back to local timer
  const localTimer = useTimer();
  const usingLiftedTimer = !!timerState;
  const timer = usingLiftedTimer ? {
    elapsed: timerState.startedAt && timerState.running
      ? Math.floor((Date.now() - timerState.startedAt) / 1000)
      : timerState.elapsed,
    running: timerState.running,
    start:   onTimerStart,
    stop:    () => { onTimerStop(); return timerState.elapsed; },
    reset:   onTimerReset,
    fmt:     localTimer.fmt,
  } : localTimer;

  // Tick every second when lifted timer is running
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!usingLiftedTimer || !timerState?.running) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [usingLiftedTimer, timerState?.running]);

  // Fair serve & side assignment algorithm (deterministic hash)
  const hash = String((match.teamA || []).join("") + match.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const serveTeamA = hash % 2 === 0;
  const sideLeftA = (hash >> 1) % 2 === 0;
  const servingTeam = serveTeamA ? match?.teamA?.join(" & ") : match?.teamB?.join(" & ");
  const serveSide = serveTeamA ? (sideLeftA ? "Left" : "Right") : (!sideLeftA ? "Left" : "Right");

  const wA = match.played && match.scoreA > match.scoreB;
  const wB = match.played && match.scoreB > match.scoreA;
  const fmtDur = s => s ? `${Math.floor(s / 60)}m ${s % 60}s` : null;

  const hint = scoreHint(sA, sB);
  const canSave = sA !== "" && sB !== "" && !hint;

  // Track score progression and auto-generate notes
  const updateScore = (newA, newB) => {
    const numA = newA === "" ? null : Number(newA);
    const numB = newB === "" ? null : Number(newB);
    if (numA === null || numB === null) return;
    const next = { a: numA, b: numB };
    const prev = scoreHistory[scoreHistory.length - 1];
    // Only append if score actually changed (not a reset)
    if (!prev || prev.a !== numA || prev.b !== numB) {
      const newHistory = [...scoreHistory, next];
      setScoreHistory(newHistory);
      // Auto-generate note only if user hasn't manually edited notes
      if (!notesEdited) {
        const auto = generateAutoNote(newHistory, match.teamA, match.teamB);
        if (auto) setMatchNotes(auto);
      }
    }
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
    playAudio("pop");
    onSave(Number(sA), Number(sB), dur, matchNotes);
  };

  return (
    <div ref={cardRef} className="mc fu glass-card" onClick={() => { if (!match.played && !readOnly) setIsActive(true); }} style={{ animationDelay: `${delay}s`, borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', marginBottom: 8, position: "relative", overflow: "hidden" }}>
      {match.played && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: 'var(--color-lime)' }} />}
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

        {match.played ? (
          <div style={{ textAlign: "center", minWidth: 72 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--color-lime)', letterSpacing: 3, lineHeight: 1 }}>
              {match.scoreA}–{match.scoreB}
            </div>
            {match.duration && <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 4 }}>⏱ {fmtDur(match.duration)}</div>}
          </div>
        ) : readOnly ? (
          <div style={{ textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--color-muted)', letterSpacing: 2 }}>VS</div>
        ) : (
          <div className="match-score-area" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 120 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ScoreCounter value={sA} onChange={v => { setSA(v); setIsActive(true); updateScore(v, sB); }} hasError={!!(hint && sA !== "" && sB !== "")} />
              <span style={{ color: 'var(--color-muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, margin: "0 2px" }}>VS</span>
              <ScoreCounter value={sB} onChange={v => { setSB(v); setIsActive(true); updateScore(sA, v); }} hasError={!!(hint && sA !== "" && sB !== "")} />
            </div>
            <button className="pb" onClick={handleSave} disabled={!canSave}
              style={{ width: "100%", background: canSave ? 'var(--color-lime)' : 'rgba(200,241,53,0.2)', border: "none", borderRadius: 'var(--radius-sm)', padding: "8px 4px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, color: canSave ? 'var(--color-dark)' : 'var(--color-muted)', cursor: canSave ? "pointer" : "not-allowed" }}>
              SAVE
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
      {!match.played && !readOnly && hint && sA !== "" && sB !== "" && (
        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,85,85,0.1)", border: "1px solid rgba(255,85,85,0.3)", fontSize: 11, color: 'var(--color-danger)', display: "flex", alignItems: "center", gap: 6 }}>
          ⚠ {hint}
        </div>
      )}

      {/* Serve and Match Notes Area */}
      {!match.played && !readOnly && isActive && (
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

      {/* Timer row */}
      {!match.played && !readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid var(--color-border)` }}>
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
        </div>
      )}

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
