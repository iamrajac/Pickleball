import { useState } from "react";
import { Trophy, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";
import { computeElo } from "../utils/elo";

export function StandingsTable({ standings, rounds, profiles = {} }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const playerMatches = {};
  
  standings.forEach(s => playerMatches[s.name] = []);
  if (rounds) {
    rounds.forEach(r => r.forEach(m => {
      if (!m.played) return;
      const sA = Number(m.scoreA), sB = Number(m.scoreB);
      m.teamA.forEach(p => playerMatches[p]?.push({ partner: m.teamA.find(x => x !== p), opp: m.teamB, myScore: sA, oppScore: sB, win: sA > sB, duration: m.duration, notes: m.notes }));
      m.teamB.forEach(p => playerMatches[p]?.push({ partner: m.teamB.find(x => x !== p), opp: m.teamA, myScore: sB, oppScore: sA, win: sB > sA, duration: m.duration, notes: m.notes }));
    }));
  }

  const getPlayerStats = (matches) => {
    if (!matches.length) return { winRate: 0, bestPartner: "N/A", rival: "N/A" };
    let wins = 0;
    const partners = {};
    const rivals = {};
    matches.forEach(m => {
      if (m.win) {
        wins++;
        partners[m.partner] = (partners[m.partner] || 0) + 1;
      } else {
        if (m.opp) m.opp.forEach(o => rivals[o] = (rivals[o] || 0) + 1);
      }
    });
    const winRate = Math.round((wins / matches.length) * 100);
    const bestPartner = Object.entries(partners).sort((a,b) => b[1]-a[1])[0]?.[0] || "None";
    const rival = Object.entries(rivals).sort((a,b) => b[1]-a[1])[0]?.[0] || "None";
    return { winRate, bestPartner, rival };
  };

  const CircularProgress = ({ pct }) => {
    const r = 24;
    const circ = 2 * Math.PI * r;
    const dash = (pct * circ) / 100;
    return (
      <svg width="60" height="60" viewBox="0 0 60 60" style={{ display: 'block' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-lime)" strokeWidth="5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 30 30)" />
        <text x="30" y="35" textAnchor="middle" fill="var(--color-lime)" fontSize="15" fontWeight="bold" fontFamily="'Bebas Neue', sans-serif" letterSpacing="1">{pct}%</text>
      </svg>
    );
  };

  return (
    <div className="glass-card fu" style={{ borderRadius: 'var(--radius-lg)', overflow: "hidden" }}>
      <div className="standings-grid" style={{ display: "grid", gridTemplateColumns: "28px 1fr 24px 24px 24px 36px 36px 36px 36px 40px 76px", padding: "12px 14px", borderBottom: `1px solid var(--color-border)`, fontSize: 10, letterSpacing: 2, color: 'var(--color-muted)', fontWeight: 600 }}>
        <span>#</span><span>PLAYER</span>
        <span style={{ textAlign: "center" }}>P</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>PTS</span>
        <span style={{ textAlign: "center" }}>+/-</span>
        <span style={{ textAlign: "center" }} className="hide-mobile">FOR</span>
        <span style={{ textAlign: "center" }} className="hide-mobile">AGN</span>
        <span style={{ textAlign: "center" }}>ELO</span>
        <span style={{ textAlign: "center" }}>FORM</span>
      </div>
      
      {(() => {
        const elos = computeElo(standings.map(s => s.name), rounds);
        return standings.map((s, i) => {
          const diff = s.scored - s.conceded;
          const top = i < 4;
          const recentForm = s.form.slice(-5);
          const streakW = s.form.match(/W+$/)?.[0]?.length || 0;
          const expanded = expandedRow === s.name;
          const matches = playerMatches[s.name] || [];
          
          return (
            <div key={s.name}>
              <div className="rh standings-grid" onClick={() => setExpandedRow(expanded ? null : s.name)}
                style={{ display: "grid", gridTemplateColumns: "28px 1fr 24px 24px 24px 36px 36px 36px 36px 40px 76px", padding: "14px", borderBottom: `1px solid var(--color-border)`, background: top ? "rgba(23, 29, 15, 0.4)" : "transparent", cursor: "pointer", position: "relative" }}>
              
              <span className="standings-rank" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: i === 0 ? 'var(--color-gold)' : i < 4 ? 'var(--color-lime)' : 'var(--color-muted)', lineHeight: 1.1 }}>
                {i === 0 ? <Trophy size={16} /> : i + 1}
              </span>
              
              <span className="standings-name" style={{ fontWeight: 500, fontSize: 14, color: top ? 'var(--color-text)' : 'var(--color-muted)', display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                {top && <span className="live-dot" style={{ width: 6, height: 6, flexShrink: 0, animation: 'none' }} />}
                <PlayerAvatar name={s.name} profile={profiles[s.name]} size={20} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                {streakW >= 3 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 2, background: "rgba(241, 53, 53, 0.2)", color: "var(--color-danger)", padding: "2px 6px", borderRadius: 12, fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
                    <Flame size={10} fill="var(--color-danger)" /> {streakW}
                  </span>
                )}
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
              <span className="standings-num" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-gold)', fontWeight: 600 }}>{elos[s.name]}</span>
              
              <span style={{ display: "flex", gap: 3, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                {recentForm.map((f, fi) => (
                  <span key={fi} className="form-tile" style={{ width: 16, height: 16, borderRadius: 4, background: f === "W" ? 'rgba(26, 61, 18, 0.8)' : 'rgba(61, 18, 18, 0.8)', display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: f === "W" ? 'var(--color-lime)' : 'var(--color-danger)' }}>{f}</span>
                ))}
                {Array(5 - recentForm.length).fill(0).map((_, fi) => (
                  <span key={`e${fi}`} className="form-tile" style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--color-border)' }} />
                ))}
              </span>
            </div>
            
            {expanded && matches.length > 0 && (() => {
              const stats = getPlayerStats(matches);
              return (
              <div className="fu" style={{ background: "rgba(10, 12, 8, 0.6)", borderBottom: `1px solid var(--color-border)`, padding: "20px", boxShadow: "inset 0 4px 12px rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 20, background: "var(--color-surface)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <PlayerAvatar name={s.name} profile={profiles[s.name]} size={60} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: "var(--color-lime)", lineHeight: 1 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>PLAYER PROFILE</div>
                  </div>
                  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 1, marginBottom: 4 }}>BEST PARTNER</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                        <PlayerAvatar name={stats.bestPartner} profile={profiles[stats.bestPartner]} size={20} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{stats.bestPartner}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 1, marginBottom: 4 }}>BIGGEST RIVAL</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                        <PlayerAvatar name={stats.rival} profile={profiles[stats.rival]} size={20} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{stats.rival}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginLeft: 8 }}>
                      <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 1, marginBottom: 4 }}>WIN RATE</div>
                      <CircularProgress pct={stats.winRate} />
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--color-muted)', marginBottom: 10, fontWeight: 600 }}>MATCH HISTORY</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {matches.map((m, mi) => (
                    <div key={mi} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", borderRadius: 'var(--radius-sm)', background: m.win ? 'var(--color-win)' : 'var(--color-lose)', borderLeft: `3px solid ${m.win ? 'var(--color-lime)' : 'var(--color-danger)'}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: m.win ? 'var(--color-lime)' : 'var(--color-danger)', fontWeight: 600, width: 20 }}>{m.win ? "W" : "L"}</span>
                        <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>w/ {m.partner} vs {m.opp ? m.opp.join(" & ") : "TBD"}</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: m.win ? 'var(--color-lime)' : 'var(--color-danger)', margin: "0 12px" }}>{m.myScore}–{m.oppScore}</span>
                        {m.duration && <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>⏱{Math.floor(m.duration / 60)}m{m.duration % 60}s</span>}
                      </div>
                      {m.notes && (
                        <div style={{ fontSize: 11, color: 'var(--color-text)', paddingLeft: 20, fontStyle: "italic", opacity: 0.8 }}>
                          "{m.notes}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}
          </div>
        );
      });
      })()}
      <div style={{ padding: "10px 14px", fontSize: 11, color: 'var(--color-muted)', letterSpacing: 1, background: 'rgba(0,0,0,0.2)' }}>
        ● TOP 4 ADVANCE TO PLAYOFFS · TAP ROW FOR MATCH HISTORY
      </div>
    </div>
  );
}
