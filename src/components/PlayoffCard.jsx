import { useState, useRef, useEffect } from "react";
import { useTimer } from "../utils/useTimer";
import { Play, Pause } from "lucide-react";
import { validatePickleballScore, scoreHint } from "../utils/pickleballRules";
import { getH2HStats } from "../utils/history";
import { PlayerAvatar } from "./PlayerAvatar";
import { playAudio } from "../utils/audio";
import { generateAutoNote } from "./MatchCard";

// Global score buffer — persists across remounts caused by Firebase listener
const scoreBuffer = {};

// +/- counter (same as MatchCard)
function ScoreCounter({ value, onChange, hasError, incDisabled }) {
  const num = value === "" ? null : Number(value);
  const dec = () => { if (num !== null && num > 0) onChange(String(num - 1)); };
  const inc = () => { if (!incDisabled) onChange(String(num === null ? 0 : num + 1)); };
  const btn = (active, disabled) => ({
    width: 36, height: 36, borderRadius: 8,
    background: disabled ? "var(--surface)" : active ? "rgba(16,212,142,0.15)" : "var(--surface)",
    border: `1px solid ${disabled ? "rgba(128,128,128,0.2)" : active ? "var(--accent)" : "var(--border)"}`,
    color: disabled ? "rgba(128,128,128,0.3)" : active ? "var(--accent)" : "var(--text-muted)",
    fontSize: 20, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <button className="pb" onPointerDown={e => { e.preventDefault(); inc(); }} style={btn(!incDisabled, incDisabled)} disabled={incDisabled}>+</button>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1, minWidth: 36, textAlign: "center",
        color: hasError ? "var(--danger)" : num !== null ? "var(--accent)" : "var(--text-muted)",
        userSelect: "none",
      }}>
        {num !== null ? num : "—"}
      </div>
      <button className="pb" onPointerDown={e => { e.preventDefault(); dec(); }} style={btn(num !== null && num > 0, false)} disabled={num === null || num <= 0}>−</button>
    </div>
  );
}

export function PlayoffCard({ match, onSave, accent, readOnly = false, h2hMatrix = {}, profiles = {}, onLiveScore }) {
  const matchKey = match ? `${match.label}-${(match.teamA||[]).join("-")}` : "none";

  const [sA, setSA] = useState(() => scoreBuffer[matchKey]?.sA ?? match?.scoreA ?? "");
  const [sB, setSB] = useState(() => scoreBuffer[matchKey]?.sB ?? match?.scoreB ?? "");
  const [matchNotes, setMatchNotes] = useState(() => scoreBuffer[matchKey]?.notes ?? match?.notes ?? "");
  const [isActive, setIsActive] = useState(false);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [storyMoments, setStoryMoments] = useState([]);
  const notesEditedRef = useRef(false);
  const timer = useTimer();
  const timerKey = `pkl_playoff_timer_${matchKey}`;

  // Restore timer on mount
  useEffect(() => {
    if (match?.played) return;
    // Try module-level buffer first (survives tab switches), then localStorage (survives refresh)
    const buf = scoreBuffer[matchKey];
    const saved = buf?.timer ?? JSON.parse(localStorage.getItem(timerKey) || "null");
    if (saved) timer.restore(saved.elapsed, saved.running, saved.startedAt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save timer state on every tick (scoreBuffer = survives tab switch; localStorage = survives refresh)
  // Only push startedAt to Firebase when running state CHANGES (not every tick) to avoid stale score overwrites
  const prevRunningRef = useRef(timer.running);
  useEffect(() => {
    if (match?.played) return;
    const startedAt = timer.running ? Date.now() - timer.elapsed * 1000 : null;
    const timerState = { elapsed: timer.elapsed, running: timer.running, startedAt };
    if (!scoreBuffer[matchKey]) scoreBuffer[matchKey] = {};
    scoreBuffer[matchKey].timer = timerState;
    localStorage.setItem(timerKey, JSON.stringify(timerState));
    // Only push to Firebase when timer starts or stops (not every second tick)
    if (onLiveScore && timer.running !== prevRunningRef.current) {
      onLiveScore(Number(sA) || 0, Number(sB) || 0, "", startedAt);
    }
    prevRunningRef.current = timer.running;
  }, [timer.elapsed, timer.running, timerKey, matchKey, match?.played]);

  const updatePlayoffScore = (newA, newB) => {
    const numA = newA === "" ? 0 : Number(newA);
    const numB = newB === "" ? 0 : Number(newB);
    if (isNaN(numA) || isNaN(numB)) return;
    const startedAt = timer.running ? Date.now() - timer.elapsed * 1000 : null;
    if (onLiveScore) onLiveScore(numA, numB, "", startedAt);
    setScoreHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.a === numA && last.b === numB) return prev;
      const next = [...prev, { a: numA, b: numB }];
      if (!notesEditedRef.current) {
        const moment = generateAutoNote(next, match.teamA, match.teamB);
        if (moment) {
          setMatchNotes(moment);
          setStoryMoments(ps => {
            const lm = ps[ps.length - 1];
            if (lm === moment) return ps;
            const isRun        = m => m && (m.includes("point run") || m.includes("on fire") || m.includes("in a row") || m.includes("Unstoppable") || m.includes("scoring"));
            const isComeback   = m => m && m.includes("comeback");
            const isTied       = m => m && (m.includes("Tied") || m.includes("Level") || m.includes("Deuce"));
            const isDominating = m => m && (m.includes("yet to score") || m.includes("leading") || m.includes("Dominant") || m.includes("shutout") || m.includes("perfect"));
            const isMatchPt    = m => m && m.includes("match point");
            const sameType = (a, b) =>
              (isRun(a) && isRun(b)) || (isComeback(a) && isComeback(b)) ||
              (isTied(a) && isTied(b)) || (isDominating(a) && isDominating(b)) ||
              (isMatchPt(a) && isMatchPt(b));
            return sameType(moment, lm) ? [...ps.slice(0, -1), moment] : [...ps, moment];
          });
        }
      }
      return next;
    });
  };
  const ac = accent || "var(--accent)";

  const hash = String((match.teamA || []).join("") + (match.label || "")).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const serveTeamA = hash % 2 === 0;
  const sideLeftA = (hash >> 1) % 2 === 0;
  const servingTeam = serveTeamA ? match?.teamA?.join(" & ") : match?.teamB?.join(" & ");
  const serveSide = serveTeamA ? (sideLeftA ? "Left" : "Right") : (!sideLeftA ? "Left" : "Right");

  useEffect(() => {
    if (!match?.played) scoreBuffer[matchKey] = { sA, sB, notes: matchNotes };
  }, [sA, sB, matchNotes, matchKey, match?.played]);

  useEffect(() => {
    if (match?.played) delete scoreBuffer[matchKey];
  }, [match?.played, matchKey]);

  if (!match?.teamA || !match?.teamB) return (
    <div className="card" style={{ borderRadius: "var(--radius-md)", padding: "1.2rem", opacity: 0.5 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: ac, marginBottom: 4 }}>{match?.label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{match?.note}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
        <span>{match?.teamA ? match.teamA.join(" & ") : "TBD"}</span>
        <span style={{ fontSize: 10 }}>VS</span>
        <span>{match?.teamB ? match.teamB.join(" & ") : "TBD"}</span>
      </div>
    </div>
  );

  const wA = match.played && match.scoreA > match.scoreB;
  const wB = match.played && match.scoreB > match.scoreA;
  const fmtDur = s => s ? `${Math.floor(s / 60)}m ${s % 60}s` : null;

  const hint = scoreHint(sA, sB);
  const canSave = sA !== "" && sB !== "" && !hint;

  const numA = sA === "" ? 0 : Number(sA);
  const numB = sB === "" ? 0 : Number(sB);
  const aWon = numA >= 11 && (numA - numB) >= 2;
  const bWon = numB >= 11 && (numB - numA) >= 2;
  const gameOver = aWon || bWon;

  const handleSave = () => {
    if (!canSave) return;
    const dur = timer.running ? timer.stop() : timer.elapsed || null;
    timer.reset();
    delete scoreBuffer[matchKey];
    localStorage.removeItem(timerKey);
    setIsActive(false);
    playAudio("pop");
    // Build narrative
    let finalNote = matchNotes;
    if (!notesEditedRef.current && storyMoments.length > 0) {
      const numA = Number(sA), numB = Number(sB);
      const winner = numA > numB ? match.teamA?.join(" & ") : match.teamB?.join(" & ");
      const score = `${Math.max(numA, numB)}-${Math.min(numA, numB)}`;
      const deduped = storyMoments.filter((m, i) => i === 0 || m !== storyMoments[i - 1]);
      finalNote = deduped.join(" · ") + ` · ${winner} won ${score}`;
    }
    onSave(Number(sA), Number(sB), dur, finalNote);
  };

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
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) setIsActive(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [isActive]);

  return (
    <div ref={cardRef} className="card" onClick={() => { if (!match?.played && !readOnly) setIsActive(true); }}
      style={{ borderRadius: "var(--radius-md)", padding: "1.2rem", position: "relative", overflow: "hidden", cursor: !match?.played && !readOnly ? "pointer" : "default" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: ac }} />
      <div style={{ fontSize: 10, letterSpacing: 2, color: ac, marginBottom: 2, marginTop: 4, fontWeight: 700 }}>{match.label}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>{match.note}</div>

      {[{ team: match.teamA, win: wA, score: match.scoreA }, { team: match.teamB, win: wB, score: match.scoreB }].map(({ team, win, score }, ti) => (
        <div key={ti} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "var(--radius-sm)", background: win ? "var(--win)" : "transparent", marginBottom: 6, border: `1px solid ${win ? "var(--accent)" : "var(--border)"}`, transition: "all 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {team?.map((p, i) => (
                <div key={p} style={{ marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={22} /></div>
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: win ? "var(--accent)" : !match.played ? "var(--text)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {team ? team.join(" & ") : "TBD"}
            </span>
          </div>
          {match.played && <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: win ? "var(--accent)" : "var(--text-muted)", lineHeight: 1, flexShrink: 0 }}>{score}</span>}
        </div>
      ))}

      {match.played && match.duration && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 8 }}>⏱ {fmtDur(match.duration)}</div>
      )}

      {!match.played && !readOnly && (
        <>
          {/* Score counters */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 8 }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.teamA?.join(" & ")}</div>
              <ScoreCounter value={sA} onChange={v => { setSA(v); const nb = sB === "" ? "0" : sB; if (sB === "") setSB("0"); setIsActive(true); updatePlayoffScore(v, nb); }} hasError={!!(hint && sA !== "" && sB !== "")} incDisabled={gameOver} />
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text-muted)", letterSpacing: 2 }}>VS</div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.teamB?.join(" & ")}</div>
              <ScoreCounter value={sB} onChange={v => { setSB(v); const na = sA === "" ? "0" : sA; if (sA === "") setSA("0"); setIsActive(true); updatePlayoffScore(na, v); }} hasError={!!(hint && sA !== "" && sB !== "")} incDisabled={gameOver} />
            </div>
          </div>

          {hint && sA !== "" && sB !== "" && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "var(--danger-dim)", border: "1px solid var(--danger)", fontSize: 11, color: "var(--danger)" }}>
              ⚠ {hint}
            </div>
          )}

          <button className="pb" onClick={handleSave} disabled={!canSave}
            style={{ width: "100%", marginTop: 12, padding: "13px", background: canSave ? ac : "var(--card-hover)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 1, color: canSave ? "#fff" : "var(--text-muted)", cursor: canSave ? "pointer" : "not-allowed" }}>
            CONFIRM RESULT
          </button>

          {isActive && (
            <div style={{ marginTop: 10, padding: "10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                🎾 <strong style={{ color: "var(--text)" }}>{servingTeam}</strong> serves first · <strong style={{ color: "var(--text)" }}>{serveSide}</strong> side
              </div>
              <input type="text" placeholder="Match notes (auto-generated or type your own...)" value={matchNotes} onChange={e => { setMatchNotes(e.target.value); notesEditedRef.current = true; }}
                style={{ width: "100%", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)", padding: "8px", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            {timer.running && <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--upcoming)", letterSpacing: 2 }}>{timer.fmt(timer.elapsed)}</span>}
            <button className="pb" onClick={() => { setIsActive(true); timer.running ? timer.stop() : timer.start(); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: timer.running ? "var(--upcoming-dim)" : "var(--surface)", border: `1px solid ${timer.running ? "var(--upcoming)" : "var(--border)"}`, color: timer.running ? "var(--upcoming)" : "var(--text-muted)", borderRadius: "var(--radius-sm)", padding: "7px 14px", fontSize: 12, fontWeight: 600 }}>
              {timer.running ? <Pause size={13} /> : <Play size={13} />}
              {timer.running ? "PAUSE" : "TIMER"}
            </button>
          </div>
        </>
      )}

      {h2hData.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--gold)", marginBottom: 6, fontWeight: 700 }}>HEAD-TO-HEAD</div>
          <div style={{ display: "grid", gridTemplateColumns: h2hData.length > 2 ? "1fr 1fr" : "1fr", gap: 6 }}>
            {h2hData.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text)" }}>{d.a} vs {d.b}:</strong> {d.stat}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
