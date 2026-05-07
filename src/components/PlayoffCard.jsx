import { useState } from "react";
import { useTimer } from "../utils/useTimer";
import { Play, Pause } from "lucide-react";

export function PlayoffCard({ match, onSave, accent, readOnly = false }) {
  const [sA, setSA] = useState(match?.scoreA ?? "");
  const [sB, setSB] = useState(match?.scoreB ?? "");
  const timer = useTimer();
  const ac = accent || 'var(--color-lime)';
  
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
  
  return (
    <div className="glass-card fu" style={{ borderRadius: 'var(--radius-md)', padding: '1.2rem', position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ac }} />
      <div style={{ fontSize: 10, letterSpacing: 2, color: ac, marginBottom: 2, marginTop: 4 }}>{match.label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 16 }}>{match.note}</div>
      
      {[{ team: match.teamA, win: wA, score: match.scoreA }, { team: match.teamB, win: wB, score: match.scoreB }].map(({ team, win, score }, ti) => (
        <div key={ti} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 'var(--radius-sm)', background: win ? 'rgba(26, 61, 18, 0.4)' : "transparent", marginBottom: 6, border: win ? `1px solid rgba(46, 90, 26, 0.5)` : `1px solid transparent`, transition: 'all 0.2s' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: win ? 'var(--color-lime)' : (!match.played ? 'var(--color-text)' : 'var(--color-muted)') }}>{team ? team.join(" & ") : "TBD"}</span>
          {match.played && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: win ? 'var(--color-lime)' : 'var(--color-muted)', lineHeight: 1 }}>{score}</span>}
        </div>
      ))}
      
      {match.played && match.duration && <div style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: "right", marginTop: 8 }}>⏱ {fmtDur(match.duration)}</div>}
      
      {!match.played && !readOnly && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: `1px solid var(--color-border)`, paddingTop: 14, marginTop: 8 }}>
            <input type="number" min={0} value={sA} onChange={e => setSA(e.target.value)} placeholder="0" className="si score-input-sm"
              style={{ width: 54, background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, textAlign: "center", padding: "8px 0", boxSizing: "border-box" }} />
            <span style={{ color: 'var(--color-muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>VS</span>
            <input type="number" min={0} value={sB} onChange={e => setSB(e.target.value)} placeholder="0" className="si score-input-sm"
              style={{ width: 54, background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, textAlign: "center", padding: "8px 0", boxSizing: "border-box" }} />
            <button className="pb" onClick={() => { if (sA !== "" && sB !== "") { const dur = timer.running ? timer.stop() : timer.elapsed || null; timer.reset(); onSave(Number(sA), Number(sB), dur); } }}
              style={{ flex: 1, background: ac, border: "none", borderRadius: 'var(--radius-sm)', padding: "12px 0", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, color: 'var(--color-dark)' }}>
              CONFIRM
            </button>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            {timer.running && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--color-cyan)', letterSpacing: 2 }}>{timer.fmt(timer.elapsed)}</span>}
            <button className="pb" onClick={timer.running ? timer.stop : timer.start}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: timer.running ? 'rgba(53, 200, 241, 0.1)' : 'var(--color-surface)', border: `1px solid ${timer.running ? 'var(--color-cyan)' : 'var(--color-border)'}`, color: timer.running ? 'var(--color-cyan)' : 'var(--color-muted)', borderRadius: 'var(--radius-sm)', padding: "6px 12px", fontSize: 12, fontWeight: 500 }}>
              {timer.running ? <Pause size={14} /> : <Play size={14} />}
              {timer.running ? "PAUSE" : "TIMER"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
