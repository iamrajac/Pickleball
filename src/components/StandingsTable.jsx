import { useState } from "react";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";

export function StandingsTable({ standings, rounds, profiles = {} }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const playerMatches = {};
  
  standings.forEach(s => playerMatches[s.name] = []);
  if (rounds) {
    rounds.forEach(r => r.forEach(m => {
      if (!m.played) return;
      const sA = Number(m.scoreA), sB = Number(m.scoreB);
      m.teamA.forEach(p => playerMatches[p]?.push({ partner: m.teamA.find(x => x !== p), opp: m.teamB, myScore: sA, oppScore: sB, win: sA > sB, duration: m.duration }));
      m.teamB.forEach(p => playerMatches[p]?.push({ partner: m.teamB.find(x => x !== p), opp: m.teamA, myScore: sB, oppScore: sA, win: sB > sA, duration: m.duration }));
    }));
  }

  return (
    <div className="glass-card fu" style={{ borderRadius: 'var(--radius-lg)', overflow: "hidden" }}>
      <div className="standings-grid" style={{ display: "grid", gridTemplateColumns: "28px 1fr 36px 36px 36px 44px 44px 44px 44px 80px", padding: "12px 14px", borderBottom: `1px solid var(--color-border)`, fontSize: 10, letterSpacing: 2, color: 'var(--color-muted)', fontWeight: 600 }}>
        <span>#</span><span>PLAYER</span>
        <span style={{ textAlign: "center" }}>P</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>PTS</span>
        <span style={{ textAlign: "center" }}>+/-</span>
        <span style={{ textAlign: "center" }} className="hide-mobile">FOR</span>
        <span style={{ textAlign: "center" }} className="hide-mobile">AGN</span>
        <span style={{ textAlign: "center" }}>FORM</span>
      </div>
      
      {standings.map((s, i) => {
        const diff = s.scored - s.conceded;
        const top = i < 4;
        const recentForm = s.form.slice(-5);
        const expanded = expandedRow === s.name;
        const matches = playerMatches[s.name] || [];
        
        return (
          <div key={s.name}>
            <div className="rh standings-grid" onClick={() => setExpandedRow(expanded ? null : s.name)}
              style={{ display: "grid", gridTemplateColumns: "28px 1fr 36px 36px 36px 44px 44px 44px 44px 80px", padding: "14px", borderBottom: `1px solid var(--color-border)`, background: top ? "rgba(23, 29, 15, 0.4)" : "transparent", cursor: "pointer", position: "relative" }}>
              
              <span className="standings-rank" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: i === 0 ? 'var(--color-gold)' : i < 4 ? 'var(--color-lime)' : 'var(--color-muted)', lineHeight: 1.1 }}>
                {i === 0 ? <Trophy size={16} /> : i + 1}
              </span>
              
              <span className="standings-name" style={{ fontWeight: 500, fontSize: 14, color: top ? 'var(--color-text)' : 'var(--color-muted)', display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                {top && <span className="live-dot" style={{ width: 6, height: 6, flexShrink: 0, animation: 'none' }} />}
                <PlayerAvatar name={s.name} profile={profiles[s.name]} size={20} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                {matches.length > 0 && (
                  <span style={{ color: 'var(--color-muted)', marginLeft: 'auto', marginRight: 8 }}>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                )}
              </span>
              
              <span className="standings-num" style={{ textAlign: "center", color: 'var(--color-muted)', fontSize: 13 }}>{s.played}</span>
              <span className="standings-num" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-lime)' }}>{s.won}</span>
              <span className="standings-num" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-danger)' }}>{s.lost}</span>
              <span className="standings-pts" style={{ textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--color-lime)', lineHeight: 1.1 }}>{s.pts}</span>
              <span className="standings-num" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: diff > 0 ? 'var(--color-lime)' : diff < 0 ? 'var(--color-danger)' : 'var(--color-muted)' }}>{diff > 0 ? "+" : ""}{diff}</span>
              <span className="standings-num hide-mobile" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-text)' }}>{s.scored}</span>
              <span className="standings-num hide-mobile" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-muted)' }}>{s.conceded}</span>
              
              <span style={{ display: "flex", gap: 3, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                {recentForm.map((f, fi) => (
                  <span key={fi} className="form-tile" style={{ width: 16, height: 16, borderRadius: 4, background: f === "W" ? 'rgba(26, 61, 18, 0.8)' : 'rgba(61, 18, 18, 0.8)', display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: f === "W" ? 'var(--color-lime)' : 'var(--color-danger)' }}>{f}</span>
                ))}
                {Array(5 - recentForm.length).fill(0).map((_, fi) => (
                  <span key={`e${fi}`} className="form-tile" style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--color-border)' }} />
                ))}
              </span>
            </div>
            
            {expanded && matches.length > 0 && (
              <div className="fu" style={{ background: "rgba(10, 12, 8, 0.6)", borderBottom: `1px solid var(--color-border)`, padding: "14px 18px", boxShadow: "inset 0 4px 12px rgba(0,0,0,0.2)" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--color-muted)', marginBottom: 10, fontWeight: 600 }}>MATCH HISTORY — {s.name.toUpperCase()}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {matches.map((m, mi) => (
                    <div key={mi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 'var(--radius-sm)', background: m.win ? 'var(--color-win)' : 'var(--color-lose)', borderLeft: `3px solid ${m.win ? 'var(--color-lime)' : 'var(--color-danger)'}` }}>
                      <span style={{ fontSize: 12, color: m.win ? 'var(--color-lime)' : 'var(--color-danger)', fontWeight: 600, width: 20 }}>{m.win ? "W" : "L"}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>w/ {m.partner} vs {m.opp ? m.opp.join(" & ") : "TBD"}</span>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: m.win ? 'var(--color-lime)' : 'var(--color-danger)', margin: "0 12px" }}>{m.myScore}–{m.oppScore}</span>
                      {m.duration && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>⏱{Math.floor(m.duration / 60)}m{m.duration % 60}s</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ padding: "10px 14px", fontSize: 11, color: 'var(--color-muted)', letterSpacing: 1, background: 'rgba(0,0,0,0.2)' }}>
        ● TOP 4 ADVANCE TO PLAYOFFS · TAP ROW FOR MATCH HISTORY
      </div>
    </div>
  );
}
