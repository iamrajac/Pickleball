import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";
import { QRCodeSVG } from "qrcode.react";
import { Share2, Users, RefreshCw, Lock, ExternalLink } from "lucide-react";
import { computeStandings } from "../utils/schedule";
import { safePlayoffs } from "../hooks/useTournament";
import { StandingsTable } from "../components/StandingsTable";
import { MatchCard } from "../components/MatchCard";
import { PlayoffCard } from "../components/PlayoffCard";
import { MatchTicker } from "../components/MatchTicker";
import { BracketTree } from "../components/BracketTree";

function usePublicTournament(code) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    const r = ref(db, `tournaments/${code}`);
    const unsub = onValue(r, snap => {
      setLoading(false);
      if (!snap.exists() || !snap.val()) { setNotFound(true); return; }
      const v = snap.val();
      const rounds = v.rounds ? v.rounds.map(r => r ? Object.values(r) : []) : [];
      setData({ ...v, rounds, playoffs: safePlayoffs(v.playoffs) });
    }, () => { setLoading(false); setNotFound(true); });
    return () => unsub();
  }, [code]);

  return { data, loading, notFound };
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`tab-btn ${active ? "on" : "off"}`} style={{ flex: 1 }}>
      {children}
    </button>
  );
}

export function PublicTournamentScreen() {
  const params = useParams();
  // When rendered outside <Routes> (unauthenticated path), useParams returns {}.
  // Fall back to parsing the code from the URL hash directly.
  const code = params.code || window.location.hash.match(/\/tournament\/([^/?#]+)/)?.[1];
  const navigate = useNavigate();
  const { data, loading, notFound } = usePublicTournament(code?.toUpperCase());
  const [tab, setTab] = useState("rounds");
  const [showQR, setShowQR] = useState(false);
  const publicUrl = `${window.location.origin}${window.location.pathname}#/tournament/${code?.toUpperCase()}`;

  // Update page title for browser/share previews
  useEffect(() => {
    if (data?.name) document.title = `${data.name} — Pickleball Pro`;
    return () => { document.title = "Pickleball Pro — Tournament Manager"; };
  }, [data?.name]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RefreshCw size={28} className="spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "2rem", textAlign: "center" }}>
      <Lock size={40} style={{ color: "var(--text-muted)" }} />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: 2 }}>PRIVATE OR NOT FOUND</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>This tournament is private or doesn't exist.</div>
      <button onClick={() => navigate("/")} style={{ marginTop: 8, background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "12px 24px", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 1, cursor: "pointer" }}>
        OPEN APP
      </button>
    </div>
  );

  const { name, players = [], rounds = [], playoffs, champion, profiles = {}, onlineCount } = data;
  const standings = computeStandings(players, rounds);
  const allM = rounds.flat();
  const played = allM.filter(m => m.played).length;
  const pct = allM.length ? Math.round((played / allM.length) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Topbar */}
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--border)" }}>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 52 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--accent)", letterSpacing: 1.5, lineHeight: 1 }}>
                  LIVE
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: 1, color: "var(--text)", lineHeight: 1.1, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name || `#${code}`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={11} /> {players.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: 36, height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--accent)", width: `${pct}%`, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 10, color: "var(--text-muted)" }}>{pct}%</span>
              </div>
              <button onClick={() => setShowQR(v => !v)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px", display: "flex", color: "var(--text-secondary)", cursor: "pointer" }}>
                <Share2 size={15} />
              </button>
              <button onClick={() => navigate("/")} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)", padding: "6px 10px", fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink size={11} /> JOIN
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, paddingBottom: 8 }}>
            <TabBtn active={tab === "rounds"} onClick={() => setTab("rounds")}>⚡ ROUNDS</TabBtn>
            <TabBtn active={tab === "standings"} onClick={() => setTab("standings")}>📊 TABLE</TabBtn>
            <TabBtn active={tab === "playoffs"} onClick={() => setTab("playoffs")}>🏆 PLAYOFFS</TabBtn>
          </div>
        </div>
        <MatchTicker rounds={rounds} playoffs={playoffs} profiles={profiles} liveScores={{}} />
      </div>

      {/* QR panel */}
      {showQR && (
        <div className="fu" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", padding: "1.25rem", display: "flex", gap: 20, alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 10 }}>
            <QRCodeSVG value={publicUrl} size={100} fgColor="#0d0f0a" />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 1, marginBottom: 6 }}>SHARE THIS PAGE</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Scan to watch live on any device</div>
            <button onClick={() => { navigator.clipboard?.writeText(publicUrl); }} style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", padding: "6px 12px", color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              COPY LINK
            </button>
          </div>
        </div>
      )}

      {/* Champion banner */}
      {champion && (
        <div style={{ background: "rgba(200,241,53,0.08)", border: "1px solid var(--accent)", borderRadius: 0, padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🏆</div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "var(--accent)", fontWeight: 700 }}>TOURNAMENT CHAMPIONS</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--accent)", letterSpacing: 2, marginTop: 4 }}>{champion}</div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "1.25rem 1rem 80px", maxWidth: 800, margin: "0 auto" }}>

        {tab === "rounds" && rounds.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-muted)", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏓</div>
            Waiting for tournament to start…
          </div>
        )}
        {tab === "rounds" && rounds.map((round, ri) => {
          const done = round.every(m => m.played);
          const byeNames = round[0]?.bye;
          return (
            <div key={ri} className="fu" style={{ marginBottom: 24, animationDelay: `${ri * 0.03}s` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: done ? "var(--accent)" : "var(--text)", letterSpacing: 2 }}>ROUND {ri + 1}</div>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <div style={{ fontSize: 11, letterSpacing: 1, color: done ? "var(--accent)" : "var(--text-muted)", fontWeight: 600 }}>{done ? "✓ DONE" : `${round.filter(m => m.played).length}/${round.length}`}</div>
              </div>
              {byeNames?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", marginBottom: 8, borderRadius: 8, background: "rgba(241,200,53,0.08)", border: "1px solid rgba(241,200,53,0.2)" }}>
                  <span style={{ fontSize: 13 }}>☕</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sitting out: <strong>{byeNames.join(", ")}</strong></span>
                </div>
              )}
              {round.map((m, mi) => (
                <MatchCard key={mi} match={m} delay={mi * 0.03} readOnly profiles={profiles}
                  onSave={() => {}} h2hMatrix={{}} timerState={null}
                  onTimerStart={() => {}} onTimerStop={() => {}} onTimerReset={() => {}} onLiveScore={() => {}} />
              ))}
            </div>
          );
        })}

        {tab === "standings" && (
          <div className="fu">
            <StandingsTable standings={standings} rounds={rounds} profiles={profiles} />
          </div>
        )}

        {tab === "playoffs" && (
          <div className="fu">
            {!playoffs ? (
              <div className="card" style={{ textAlign: "center", padding: "4rem 1rem" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 48, color: "var(--border)", letterSpacing: 4 }}>LOCKED</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>Complete all group matches first</div>
              </div>
            ) : (
              <BracketTree playoffs={playoffs} profiles={profiles} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
