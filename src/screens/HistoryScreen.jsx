import { useState } from "react";
import { loadH, saveH, isCreator } from "../utils/history";
import { StandingsTable } from "../components/StandingsTable";
import { MatchCard } from "../components/MatchCard";
import { PlayoffCard } from "../components/PlayoffCard";
import { Trophy, ArrowLeft, Calendar, Users, Trash2, ChevronRight } from "lucide-react";

export function HistoryScreen({ onBack, onOpen, theme = 'dark' }) {
  const lime = theme === 'light' ? '#1e3a5f' : 'var(--color-lime)';
  const muted = theme === 'light' ? '#64748b' : 'var(--color-muted)';
  const text = theme === 'light' ? '#0f172a' : 'var(--color-text)';
  const border = theme === 'light' ? '#e2e8f0' : 'var(--color-border)';

  const [hist, setHist] = useState(() => loadH());
  const [deleteCode, setDeleteCode] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const deleteOne = (code) => {
    const updated = hist.filter(t => t.code !== code);
    saveH(updated);
    setHist(updated);
    setDeleteCode(null);
  };

  const clearAll = () => {
    saveH([]);
    setHist([]);
    setConfirmClear(false);
  };

  return (
    <div style={{ padding: "0 1rem 4rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div className="fu" style={{ paddingTop: "2.5rem", paddingBottom: "2rem", display: "flex", alignItems: "center", gap: 16 }}>
          <button className="pb glass" onClick={onBack} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 'var(--radius-sm)', border: `1px solid var(--color-border)`, color: text }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: lime, letterSpacing: 2, lineHeight: 1 }}>TOURNAMENT HISTORY</div>
            <div style={{ fontSize: 12, color: muted }}>{hist.length} saved tournament{hist.length !== 1 ? "s" : ""}</div>
          </div>
          {hist.length > 0 && (
            <button className="pb" onClick={() => setConfirmClear(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 'var(--radius-sm)', color: "#ef4444", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>
              <Trash2 size={13} /> CLEAR ALL
            </button>
          )}
        </div>

        {/* Empty state */}
        {hist.length === 0 ? (
          <div className="fu glass-card" style={{ padding: "4rem 2rem", textAlign: "center", borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🏆</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: border, letterSpacing: 2 }}>NO HISTORY YET</div>
            <div style={{ fontSize: 14, color: muted, marginTop: 8 }}>Complete a tournament to see it here.</div>
          </div>
        ) : (
          [...hist].reverse().map((t, i) => (
            <div key={t.code || i} style={{ position: "relative", marginBottom: 12 }}>

              {/* Card */}
              <div className="fu rh glass-card" onClick={() => onOpen(t)}
                style={{ animationDelay: `${i * .05}s`, borderRadius: 'var(--radius-md)', padding: "1.2rem 1.4rem", paddingRight: "4rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: text, letterSpacing: 1 }}>{new Date(t.date).toLocaleDateString()}</span>
                    {t.status === "in-progress"
                      ? <span style={{ fontSize: 9, background: 'rgba(53,200,241,0.2)', color: 'var(--color-cyan)', padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>IN PROGRESS</span>
                      : <span style={{ fontSize: 9, background: 'rgba(200,241,53,0.2)', color: lime, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>COMPLETED</span>
                    }
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: muted }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {t.players.length} players</span>
                    {t.code && <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>#{t.code} {isCreator(t.code) ? "(Host)" : ""}</span>}
                  </div>
                  {t.champion && (
                    <div style={{ fontSize: 13, color: 'var(--color-gold)', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Trophy size={14} /> {t.champion}
                    </div>
                  )}
                </div>
                <div style={{ color: muted, flexShrink: 0 }}><ChevronRight size={20} /></div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteCode(t.code); }}
                className="pb"
                title="Delete tournament"
                style={{
                  position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8, width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#ef4444", zIndex: 1
                }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Confirm Delete One */}
      {deleteCode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div className="glass-card fu" style={{ borderRadius: 16, padding: "2rem", maxWidth: 320, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 8, color: text }}>DELETE TOURNAMENT?</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 24 }}>
              This will permanently remove it from your history on this device.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteCode(null)} className="pb"
                style={{ flex: 1, padding: "11px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, color: text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                CANCEL
              </button>
              <button onClick={() => deleteOne(deleteCode)} className="pb"
                style={{ flex: 1, padding: "11px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 10, color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear All */}
      {confirmClear && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div className="glass-card fu" style={{ borderRadius: 16, padding: "2rem", maxWidth: 320, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 8, color: text }}>CLEAR ALL HISTORY?</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 24 }}>
              All <strong style={{ color: "#ef4444" }}>{hist.length}</strong> tournament{hist.length !== 1 ? "s" : ""} will be permanently deleted from this device.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmClear(false)} className="pb"
                style={{ flex: 1, padding: "11px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, color: text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                CANCEL
              </button>
              <button onClick={clearAll} className="pb"
                style={{ flex: 1, padding: "11px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 10, color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                CLEAR ALL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryDetail({ tournament, onBack, theme = 'dark' }) {
  const lime = theme === 'light' ? '#1e3a5f' : 'var(--color-lime)';
  const muted = theme === 'light' ? '#64748b' : 'var(--color-muted)';
  const text = theme === 'light' ? '#0f172a' : 'var(--color-text)';
  const border = theme === 'light' ? '#e2e8f0' : 'var(--color-border)';
  const t = tournament;
  const standings = t.finalStandings || [];
  const rounds = t.rounds || [];
  const playoffs = t.playoffs || null;
  const [tab, setTab] = useState("rounds");

  return (
    <div style={{ minHeight: "100vh", background: 'var(--color-dark)', color: text, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 60 }}>
            <button onClick={onBack} className="ni" style={{ background: "none", border: "none", color: muted, padding: 0, display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={24} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: lime, letterSpacing: 2, lineHeight: 1 }}>TOURNAMENT RECAP</div>
              <div style={{ fontSize: 11, color: muted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Calendar size={12} /> {new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                <span>·</span> <Users size={12} /> {t.players.length} players
                {t.code && <><span>·</span> <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>#{t.code}</span></>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, paddingBottom: 8 }}>
            {[{ id: "rounds", label: "⚡ ROUNDS" }, { id: "standings", label: "📊 TABLE" }, { id: "playoffs", label: "🏆 PLAYOFFS" }].map(tb => (
              <button key={tb.id} className={`tab-btn ${tab === tb.id ? "on" : "off"}`} onClick={() => setTab(tb.id)} style={{ flex: 1 }}>{tb.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "1.5rem 1rem 4rem", maxWidth: 1000, margin: "0 auto" }}>
        {tab === "rounds" && (
          <div className="desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 24, alignItems: "start" }}>
            {rounds.length === 0 && <div className="fu" style={{ color: muted }}>No rounds data available for this tournament.</div>}
            {rounds.map((round, ri) => (
              <div key={ri} className="fu" style={{ animationDelay: `${ri * .03}s` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: round.every(m => m.played) ? 'var(--color-lime)' : 'var(--color-text)', letterSpacing: 2 }}>ROUND {ri + 1}</div>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                  <div style={{ fontSize: 11, color: round.every(m => m.played) ? 'var(--color-lime)' : 'var(--color-muted)', letterSpacing: 1, fontWeight: 600 }}>{round.filter(m => m.played).length}/{round.length}</div>
                </div>
                {round.map((m, mi) => <MatchCard key={mi} match={m} delay={mi * .04} readOnly={true} onSave={() => { }} />)}
              </div>
            ))}
          </div>
        )}

        {tab === "standings" && (
          <div className="fu">
            <StandingsTable standings={standings} rounds={rounds} />
          </div>
        )}

        {tab === "playoffs" && (
          <div className="fu">
            {!playoffs ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "4rem 1rem", borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: border, letterSpacing: 2 }}>NO PLAYOFFS</div>
                <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>This tournament ended before playoffs.</div>
              </div>
            ) : playoffs.q1 ? (
              <div style={{ maxWidth: 800, margin: "0 auto" }}>
                {(t.champion || playoffs.champion) && (
                  <div className="fu glass-card" style={{ border: `1px solid var(--color-lime)`, borderRadius: 'var(--radius-lg)', padding: "2rem", textAlign: "center", marginBottom: 24, background: 'rgba(200,241,53,0.05)', boxShadow: '0 8px 32px rgba(200,241,53,0.1)' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 11, letterSpacing: 4, color: lime, marginBottom: 8, fontWeight: 600 }}>TOURNAMENT CHAMPIONS</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: lime, letterSpacing: 3 }}>{t.champion || playoffs.champion}</div>
                  </div>
                )}
                {playoffs.isMini ? (
                  <PlayoffCard match={playoffs.q1} onSave={() => { }} accent="var(--color-gold)" readOnly={true} />
                ) : (
                  <>
                    <div className="playoff-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      <PlayoffCard match={playoffs.q1} onSave={() => { }} accent="var(--color-lime)" readOnly={true} />
                      {playoffs.elim && <PlayoffCard match={playoffs.elim} onSave={() => { }} accent="var(--color-cyan)" readOnly={true} />}
                    </div>
                    {playoffs.q2 && <div style={{ marginBottom: 16 }}><PlayoffCard match={playoffs.q2} onSave={() => { }} accent="var(--color-gold)" readOnly={true} /></div>}
                    {playoffs.final && <PlayoffCard match={playoffs.final} onSave={() => { }} accent="var(--color-lime)" readOnly={true} />}
                  </>
                )}
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: text }}>FINAL STANDINGS</div>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                  </div>
                  <StandingsTable standings={standings} rounds={rounds} />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}