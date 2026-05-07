import { useState, useRef, useEffect } from "react";
import { useTimer } from "../utils/useTimer";
import { Play, Pause } from "lucide-react";
import { validatePickleballScore, scoreHint } from "../utils/pickleballRules";
import { getH2HStats } from "../utils/history";
import { PlayerAvatar } from "./PlayerAvatar";
import { playAudio } from "../utils/audio";

// Global score buffer — persists across remounts caused by Firebase listener
const scoreBuffer = {};

export function PlayoffCard({ match, onSave, accent, readOnly = false, h2hMatrix = {}, profiles = {} }) {
  const matchKey = match ? `${match.label}-${(match.teamA||[]).join("-")}` : "none";

  // Read from buffer first so scores survive Firebase-triggered remounts
  const [sA, setSA] = useState(() => scoreBuffer[matchKey]?.sA ?? match?.scoreA ?? "");
  const [sB, setSB] = useState(() => scoreBuffer[matchKey]?.sB ?? match?.scoreB ?? "");
  const [matchNotes, setMatchNotes] = useState(() => scoreBuffer[matchKey]?.notes ?? match?.notes ?? "");
  const [isActive, setIsActive] = useState(false);
  const timer = useTimer();
  const ac = accent || 'var(--color-lime)';

  // Fair serve & side assignment algorithm (deterministic hash)
  const hash = String((match.teamA || []).join("") + (match.label || "")).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const serveTeamA = hash % 2 === 0;
  const sideLeftA = (hash >> 1) % 2 === 0;
  const servingTeam = serveTeamA ? match?.teamA?.join(" & ") : match?.teamB?.join(" & ");
  const serveSide = serveTeamA ? (sideLeftA ? "Left" : "Right") : (!sideLeftA ? "Left" : "Right");
  const timer = useTimer();
  const ac = accent || 'var(--color-lime)';

  // Keep buffer in sync
  useEffect(() => {
    if (!match?.played) scoreBuffer[matchKey] = { sA, sB, notes: matchNotes };
  }, [sA, sB, matchNotes, matchKey, match?.played]);

  // Clear buffer once played
  useEffect(() => {
    if (match?.played) delete scoreBuffer[matchKey];
  }, [match?.played, matchKey]);

  if (!match?.teamA || !match?.teamB) return (
    <div className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: '1.2rem', opacity: .5 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: ac, marginBottom: 4 }}>{match?.label}</div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 12 }}>{match?.note}</div>
      <div style={{ fontSize: 13, color: 'var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
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

  const handleSave = () => {
    if (!canSave) return;
    const dur = timer.running ? timer.stop() : timer.elapsed || null;
    timer.reset();
    delete scoreBuffer[matchKey];
    setIsActive(false);
    playAudio("pop");
    onSave(Number(sA), Number(sB), dur, matchNotes);
  };

  // H2H only when active
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

  return (
    <div ref={cardRef} className="glass-card fu" onClick={() => { if (!match?.played && !readOnly) setIsActive(true); }} style={{ borderRadius: 'var(--radius-md)', padding: '1.2rem', position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ac }} />
      <div style={{ fontSize: 10, letterSpacing: 2, color: ac, marginBottom: 2, marginTop: 4 }}>{match.label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 16 }}>{match.note}</div>

      {[{ team: match.teamA, win: wA, score: match.scoreA }, { team: match.teamB, win: wB, score: match.scoreB }].map(({ team, win, score }, ti) => (
        <div key={ti} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 'var(--radius-sm)', background: win ? 'rgba(26, 61, 18, 0.4)' : "transparent", marginBottom: 6, border: win ? `1px solid rgba(46, 90, 26, 0.5)` : `1px solid transparent`, transition: 'all 0.2s' }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {team?.map((p, i) => (
                <div key={p} style={{ marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={24} /></div>
              ))}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: win ? 'var(--color-lime)' : (!match.played ? 'var(--color-text)' : 'var(--color-muted)') }}>{team ? team.join(" & ") : "TBD"}</span>
          </div>
          {match.played && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: win ? 'var(--color-lime)' : 'var(--color-muted)', lineHeight: 1 }}>{score}</span>}
        </div>
      ))}

      {match.played && match.duration && <div style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: "right", marginTop: 8 }}>⏱ {fmtDur(match.duration)}</div>}

      {!match.played && !readOnly && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: `1px solid var(--color-border)`, paddingTop: 14, marginTop: 8 }}>
            <input type="number" min={0} value={sA}
              onChange={e => { setSA(e.target.value); setIsActive(true); }}
              onFocus={() => setIsActive(true)}
              onPointerDown={() => setIsActive(true)}
              placeholder="0" className="si score-input-sm"
              style={{ width: 54, background: 'var(--color-surface)', border: `1px solid ${hint && sA !== "" && sB !== "" ? 'var(--color-danger)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, textAlign: "center", padding: "8px 0", boxSizing: "border-box" }} />
            <span style={{ color: 'var(--color-muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>VS</span>
            <input type="number" min={0} value={sB}
              onChange={e => { setSB(e.target.value); setIsActive(true); }}
              onFocus={() => setIsActive(true)}
              onPointerDown={() => setIsActive(true)}
              placeholder="0" className="si score-input-sm"
              style={{ width: 54, background: 'var(--color-surface)', border: `1px solid ${hint && sA !== "" && sB !== "" ? 'var(--color-danger)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, textAlign: "center", padding: "8px 0", boxSizing: "border-box" }} />
            <button className="pb" onClick={handleSave} disabled={!canSave}
              style={{ flex: 1, background: canSave ? ac : 'rgba(200,241,53,0.15)', border: "none", borderRadius: 'var(--radius-sm)', padding: "12px 0", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, color: canSave ? 'var(--color-dark)' : 'var(--color-muted)', cursor: canSave ? "pointer" : "not-allowed" }}>
              CONFIRM
            </button>
          </div>

          {hint && sA !== "" && sB !== "" && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,85,85,0.1)", border: "1px solid rgba(255,85,85,0.3)", fontSize: 11, color: 'var(--color-danger)', display: "flex", alignItems: "center", gap: 6 }}>
              ⚠ {hint}
            </div>
          )}

          {isActive && (
            <div style={{ marginTop: 12, padding: "10px", background: 'rgba(0,0,0,0.2)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                🎾 <strong style={{ color: 'var(--color-text)' }}>{servingTeam || "TBD"}</strong> serves first from the <strong style={{ color: 'var(--color-text)' }}>{serveSide}</strong> side.
              </div>
              <input type="text" placeholder="Add match notes (e.g. game-winning shot...)" value={matchNotes} onChange={e => setMatchNotes(e.target.value)} 
                style={{ width: '100%', background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', padding: "8px", fontSize: 12, boxSizing: "border-box" }} />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            {timer.running && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--color-cyan)', letterSpacing: 2 }}>{timer.fmt(timer.elapsed)}</span>}
            <button className="pb" onClick={() => { setIsActive(true); timer.running ? timer.stop() : timer.start(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: timer.running ? 'rgba(53, 200, 241, 0.1)' : 'var(--color-surface)', border: `1px solid ${timer.running ? 'var(--color-cyan)' : 'var(--color-border)'}`, color: timer.running ? 'var(--color-cyan)' : 'var(--color-muted)', borderRadius: 'var(--radius-sm)', padding: "6px 12px", fontSize: 12, fontWeight: 500 }}>
              {timer.running ? <Pause size={14} /> : <Play size={14} />}
              {timer.running ? "PAUSE" : "TIMER"}
            </button>
          </div>
        </>
      )}

      {/* H2H — only when active */}
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
