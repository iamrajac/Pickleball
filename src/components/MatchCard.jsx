import { useState } from "react";
import { useTimer } from "../utils/useTimer";
import { Play, Pause, X } from "lucide-react";

export function MatchCard({ match, onSave, delay = 0, readOnly = false }) {
  const [sA, setSA] = useState(match.scoreA ?? "");
  const [sB, setSB] = useState(match.scoreB ?? "");
  const timer = useTimer();
  
  const wA = match.played && match.scoreA > match.scoreB;
  const wB = match.played && match.scoreB > match.scoreA;
  const fmtDur = s => s ? `${Math.floor(s / 60)}m ${s % 60}s` : null;

  return (
    <div className="mc fu glass-card" style={{ animationDelay: `${delay}s`, borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', marginBottom: 8, position: "relative", overflow: "hidden" }}>
      {match.played && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: 'var(--color-lime)' }} />}
      {timer.running && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: 'var(--color-cyan)', animation: "pulse 1s infinite" }} />}
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
        <div>
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
        ) : (
          readOnly ? (
            <div style={{ textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--color-muted)', letterSpacing: 2 }}>VS</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 170 }}>
              <input type="number" min={0} value={sA} onChange={e => setSA(e.target.value)} placeholder="—" className="si score-input-sm"
                style={{ width: 44, background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, textAlign: "center", padding: "6px 0", boxSizing: "border-box" }} />
              <span style={{ color: 'var(--color-muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14 }}>VS</span>
              <input type="number" min={0} value={sB} onChange={e => setSB(e.target.value)} placeholder="—" className="si score-input-sm"
                style={{ width: 44, background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, textAlign: "center", padding: "6px 0", boxSizing: "border-box" }} />
              <button className="pb" onClick={() => { if (sA !== "" && sB !== "") { const dur = timer.running ? timer.stop() : timer.elapsed || null; timer.reset(); onSave(Number(sA), Number(sB), dur); } }}
                style={{ flex: 1, background: 'var(--color-lime)', border: "none", borderRadius: 'var(--radius-sm)', padding: "10px 8px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1, color: 'var(--color-dark)' }}>
                SAVE
              </button>
            </div>
          )
        )}
        
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: wB ? 'var(--color-lime)' : wA ? 'var(--color-muted)' : 'var(--color-text)', lineHeight: 1.35 }}>
            {match?.teamB ? match.teamB.join(" & ") : "TBD"}
          </div>
          {wB && <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-lime)', marginTop: 4, textAlign: "right" }}>WIN ✓</div>}
        </div>
      </div>
      
      {!match.played && !readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12, paddingTop: 10, borderTop: `1px solid var(--color-border)` }}>
          {timer.running && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--color-cyan)', letterSpacing: 2 }}>{timer.fmt(timer.elapsed)}</span>}
          {!timer.running && timer.elapsed > 0 && <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--color-muted)' }}>{timer.fmt(timer.elapsed)}</span>}
          
          <button className="pb" onClick={timer.running ? timer.stop : timer.start}
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
    </div>
  );
}
