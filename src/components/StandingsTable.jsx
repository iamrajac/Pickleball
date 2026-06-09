import { useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, ChevronDown, ChevronUp, Flame, Info } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";
export function StandingsTable({ standings, rounds, profiles = {}, playoffs = null, champion = null }) {

  // Derive playoff result badges from playoffs object
  const getPlayoffBadge = (name) => {
    if (!playoffs) return null;
    // Champion
    if (champion && (champion === name || champion.includes(name))) return { symbol: "🏆", label: "CHAMPION", color: "#f1c835" };
    // Runner up — lost the final
    if (playoffs.final?.played) {
      const winA = playoffs.final.scoreA > playoffs.final.scoreB;
      const losers = winA ? playoffs.final.teamB : playoffs.final.teamA;
      if (losers?.includes(name)) return { symbol: "🥈", label: "RUNNER UP", color: "#94a3b8" };
    }
    // 3rd place — lost in semi/q2/elim before final
    const mode = playoffs.mode;
    const checkMatch = (match) => {
      if (!match?.played) return false;
      const winA = match.scoreA > match.scoreB;
      const losers = winA ? match.teamB : match.teamA;
      return losers?.includes(name);
    };
    if (mode === "elim_to_sf" && checkMatch(playoffs.sf1)) return { symbol: "🥉", label: "3RD PLACE", color: "#cd7f32" };
    if (mode === "ipl6" && checkMatch(playoffs.elim)) return { symbol: "🥉", label: "3RD PLACE", color: "#cd7f32" };
    if (mode === "ipl8" && checkMatch(playoffs.q2)) return { symbol: "🥉", label: "3RD PLACE", color: "#cd7f32" };
    if (mode === "top8" && (checkMatch(playoffs.sf1) || checkMatch(playoffs.sf2))) return { symbol: "🥉", label: "3RD PLACE", color: "#cd7f32" };
    if (mode === "top8_ipl" && checkMatch(playoffs.sf)) return { symbol: "🥉", label: "3RD PLACE", color: "#cd7f32" };
    // Eliminated from group stage (not in playoffs)
    const eliminated = playoffs.eliminated || [];
    if (eliminated.includes(name)) return { symbol: "E", label: "ELIMINATED", color: "#ef4444", isE: true };
    return null;
  };

  const [expandedRow, setExpandedRow] = useState(null);
  const [detailMatch, setDetailMatch] = useState(null);
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
    const safePct = isNaN(pct) ? 0 : pct;
    const r = 24;
    const circ = 2 * Math.PI * r;
    const dash = (safePct * circ) / 100;
    return (
      <svg width="60" height="60" viewBox="0 0 60 60" style={{ display: 'block' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-lime)" strokeWidth="5" strokeDasharray={`${dash || 0} ${circ}`} strokeLinecap="round" transform="rotate(-90 30 30)" />
        <text x="30" y="35" textAnchor="middle" fill="var(--color-lime)" fontSize="15" fontWeight="bold" fontFamily="'Bebas Neue', sans-serif" letterSpacing="1">{safePct}%</text>
      </svg>
    );
  };

  return (
    <div className="glass-card fu" style={{ borderRadius: 'var(--radius-lg)', overflow: "hidden" }}>
      <div className="standings-wrapper" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div className="standings-grid" style={{ display: "grid", gridTemplateColumns: "28px 1fr 24px 24px 24px 36px 36px 36px 36px 76px", padding: "12px 14px", borderBottom: `1px solid var(--color-border)`, fontSize: 10, letterSpacing: 2, color: 'var(--color-muted)', fontWeight: 600 }}>
        <span>#</span><span>PLAYER</span>
        <span style={{ textAlign: "center" }}>P</span>
        <span style={{ textAlign: "center" }}>W</span>
        <span style={{ textAlign: "center" }}>L</span>
        <span style={{ textAlign: "center" }}>PTS</span>
        <span style={{ textAlign: "center" }}>+/-</span>
        <span style={{ textAlign: "center" }}>FOR</span>
        <span style={{ textAlign: "center" }}>AGN</span>
        <span style={{ textAlign: "center" }}>FORM</span>
      </div>

      {(() => {
        return standings.map((s, i) => {
          const diff = s.scored - s.conceded;
          const top = i < 4;
          const recentForm = s.form.slice(-5);
          const formStr = Array.isArray(s.form) ? s.form.join("") : (s.form || "");
          const streakW = formStr.match(/W+$/)?.[0]?.length || 0;
          const expanded = expandedRow === s.name;
          const matches = playerMatches[s.name] || [];
          
          return (
            <div key={s.name}>
              {(() => {
                const badge = getPlayoffBadge(s.name);
                const isElim = badge?.isE;
                const isChamp = badge?.symbol === "🏆";
                const isRunner = badge?.symbol === "🥈";
                const rowBg = isChamp ? "rgba(241,200,53,0.12)" :
                              isRunner ? "rgba(148,163,184,0.1)" :
                              badge?.symbol === "🥉" ? "rgba(205,127,50,0.1)" :
                              isElim ? "rgba(239,68,68,0.08)" :
                              top ? "rgba(23, 29, 15, 0.4)" : "transparent";
                const rowBorder = isElim ? "1px solid rgba(239,68,68,0.2)" :
                                  isChamp ? "1px solid rgba(241,200,53,0.2)" : `1px solid var(--color-border)`;
                return (
              <div className="rh standings-grid" onClick={() => setExpandedRow(expanded ? null : s.name)}
                style={{ display: "grid", gridTemplateColumns: "28px 1fr 24px 24px 24px 36px 36px 36px 36px 76px", padding: "10px 14px", borderBottom: rowBorder, background: rowBg, cursor: "pointer", alignItems: "center", opacity: isElim ? 0.65 : 1 }}>
              
              <span className="standings-rank" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: i === 0 ? 'var(--color-gold)' : i < 4 ? 'var(--color-lime)' : 'var(--color-muted)', lineHeight: 1.1 }}>
                {i === 0 ? <Trophy size={16} /> : i + 1}
              </span>
              
              <span className="standings-name" style={{ fontWeight: 500, fontSize: 14, color: isElim ? 'var(--color-danger)' : top ? 'var(--color-text)' : 'var(--color-muted)', display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                {!badge && top && <span className="live-dot" style={{ width: 6, height: 6, flexShrink: 0, animation: 'none' }} />}
                {badge && !badge.isE && <span style={{ fontSize: 14, flexShrink: 0 }}>{badge.symbol}</span>}
                <PlayerAvatar name={s.name} profile={profiles[s.name]} size={20} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isElim ? "line-through" : "none" }}>{s.name}</span>
                {badge?.isE && (
                  <span style={{ display: "flex", alignItems: "center", background: "rgba(239,68,68,0.2)", color: "#ef4444", padding: "1px 5px", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>E</span>
                )}
                {streakW >= 3 && !badge && (
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
              <span className="standings-num" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-text)' }}>{s.scored}</span>
              <span className="standings-num" style={{ textAlign: "center", fontSize: 13, color: 'var(--color-muted)' }}>{s.conceded}</span>
              <span style={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "center", flexWrap: "nowrap", overflow: "hidden" }}>
                {recentForm.slice(-5).map((f, fi) => (
                  <span key={fi} style={{ width: 13, height: 13, borderRadius: 3, background: f === "W" ? 'rgba(26, 61, 18, 0.9)' : 'rgba(61, 18, 18, 0.9)', display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: f === "W" ? 'var(--color-lime)' : 'var(--color-danger)', flexShrink: 0 }}>{f}</span>
                ))}
                {Array(Math.max(0, 5 - recentForm.length)).fill(0).map((_, fi) => (
                  <span key={`e${fi}`} style={{ width: 13, height: 13, borderRadius: 3, background: 'var(--color-border)', flexShrink: 0 }} />
                ))}
              </span>
            </div>
            );
          })()}
            
            {expanded && matches.length > 0 && (() => {
              try {
                const stats = getPlayerStats(matches);
                return (
                <div className="fu" style={{ background: "rgba(10, 12, 8, 0.6)", borderBottom: `1px solid var(--color-border)`, padding: "20px", boxShadow: "inset 0 4px 12px rgba(0,0,0,0.2)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, background: "var(--color-surface)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", flexWrap: "wrap" }}>
                    <PlayerAvatar name={s.name} profile={profiles[s.name]} size={48} />
                    <div style={{ flex: 1, minWidth: 80 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: "var(--color-lime)", lineHeight: 1 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 4 }}>PLAYER PROFILE</div>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginBottom: 4 }}>BEST PARTNER</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                          <PlayerAvatar name={stats.bestPartner} profile={profiles[stats.bestPartner]} size={18} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>{stats.bestPartner}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginBottom: 4 }}>BIGGEST RIVAL</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                          <PlayerAvatar name={stats.rival} profile={profiles[stats.rival]} size={18} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>{stats.rival}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginBottom: 4 }}>WIN RATE</div>
                        <CircularProgress pct={stats.winRate} />
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--color-muted)', marginBottom: 10, fontWeight: 600 }}>MATCH HISTORY</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {matches.map((m, mi) => (
                      <div key={mi} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 'var(--radius-sm)', background: m.win ? 'var(--color-win)' : 'var(--color-lose)', borderLeft: `3px solid ${m.win ? 'var(--color-lime)' : 'var(--color-danger)'}` }}>
                        <span style={{ fontSize: 12, color: m.win ? 'var(--color-lime)' : 'var(--color-danger)', fontWeight: 600, width: 20 }}>{m.win ? "W" : "L"}</span>
                        <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>w/ {m.partner} vs {m.opp ? m.opp.join(" & ") : "TBD"}</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: m.win ? 'var(--color-lime)' : 'var(--color-danger)', margin: "0 8px" }}>{m.myScore}–{m.oppScore}</span>
                        {m.duration && <span style={{ fontSize: 11, color: 'var(--color-muted)', marginRight: 6 }}>⏱{Math.floor(m.duration / 60)}m{m.duration % 60}s</span>}
                        {m.notes && (
                          <button onClick={() => setDetailMatch(m)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2, display: "flex", alignItems: "center" }}>
                            <Info size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                );
              } catch (err) {
                return <div style={{ color: "red", padding: 20 }}>ERROR EXPANDING: {err.toString()}</div>;
              }
            })()}
          </div>
        );
      });
      })()}
      </div>{/* end standings-wrapper */}
      <div style={{ padding: "10px 14px", fontSize: 11, color: 'var(--color-muted)', letterSpacing: 1, background: 'rgba(0,0,0,0.1)' }}>
        ● TOP 4 ADVANCE TO PLAYOFFS · TAP ROW FOR MATCH HISTORY
      </div>

      {/* Match Detail Bottom Sheet — portal to escape stacking context */}
      {detailMatch && createPortal(
        <div onClick={() => setDetailMatch(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, margin: "0 auto", background: "var(--card)", borderRadius: "20px 20px 0 0", padding: "1.5rem 1.2rem 2.5rem", animation: "slideUp 0.25s ease-out" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 1.2rem" }} />

            {/* Result + score */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 2, padding: "3px 10px", borderRadius: 6, background: detailMatch.win ? "rgba(16,212,142,0.12)" : "rgba(239,68,68,0.12)", color: detailMatch.win ? "var(--accent)" : "var(--danger)" }}>
                {detailMatch.win ? "WIN" : "LOSS"}
              </span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: detailMatch.win ? "var(--accent)" : "var(--danger)", letterSpacing: 2 }}>
                {detailMatch.myScore} – {detailMatch.oppScore}
              </span>
              {detailMatch.duration && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>⏱ {Math.floor(detailMatch.duration / 60)}m {detailMatch.duration % 60}s</span>
              )}
            </div>

            {/* Teams */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: detailMatch.win ? "rgba(16,212,142,0.06)" : "var(--surface)", border: `1px solid ${detailMatch.win ? "rgba(16,212,142,0.25)" : "var(--border)"}` }}>
                <div style={{ fontSize: 10, color: detailMatch.win ? "var(--accent)" : "var(--text-muted)", letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>YOUR TEAM</div>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{detailMatch.partner ? `You & ${detailMatch.partner}` : "You"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>VS</div>
              <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: !detailMatch.win ? "rgba(16,212,142,0.06)" : "var(--surface)", border: `1px solid ${!detailMatch.win ? "rgba(16,212,142,0.25)" : "var(--border)"}` }}>
                <div style={{ fontSize: 10, color: !detailMatch.win ? "var(--accent)" : "var(--text-muted)", letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>OPPONENTS</div>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{detailMatch.opp ? detailMatch.opp.join(" & ") : "TBD"}</div>
              </div>
            </div>

            {/* Notes — bullet points */}
            {detailMatch.notes && (
              <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>MATCH NOTES</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detailMatch.notes.split("·").map((s, i) => s.trim() && (
                    <div key={i} style={{ fontSize: 12, color: "var(--text)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>•</span>
                      <span>{s.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setDetailMatch(null)} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
