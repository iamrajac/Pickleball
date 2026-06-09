import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { Wifi, AlertCircle } from "lucide-react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { AvatarPickerModal } from "../components/AvatarPickerModal";
import { PlayerSearchInput } from "../components/PlayerSearchInput";
import { suggestRounds } from "./HubScreen";
import { findDuplicatePlayerNames, normalizePlayerName } from "../utils/players";
import { getGlobalProfiles } from "../utils/globalProfiles";
import { loadH } from "../utils/history";
import { computeCareerStats } from "../utils/careerStats";

const OPTIMAL_REASONS = {
  4: "3 rounds — everyone pairs with everyone once",
  5: "5 rounds — balanced with 1 bye/round",
  6: "9 rounds — equal byes, full variety",
  7: "7 rounds — clean rotation",
  8: "7 rounds — classic 8-player format",
  9: "9 rounds — 1 bye/round, equal rest",
  10: "9 rounds — 2 byes/round, equal rest",
  11: "11 rounds — 3 byes/round, balanced",
  12: "9 rounds — 3 courts, full variety",
  13: "9 rounds — balanced schedule",
  14: "11 rounds — 2 byes/round, equal play",
  15: "9 rounds — 3 byes/round",
  16: "9 rounds — 4 courts, great variety",
  17: "9 rounds — balanced",
  18: "9 rounds — 2 byes/round",
  19: "9 rounds — balanced",
  20: "7 rounds — 5 courts, everyone plays every round",
};

function Stepper({ label, value, onDec, onInc, min, max, note }) {
  return (
    <div className="card" style={{ padding: "1.4rem" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button className="pb" onClick={onDec} disabled={value <= min}
          style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: value <= min ? "var(--surface)" : "var(--accent-dim)", border: `1px solid ${value <= min ? "var(--border)" : "var(--accent)"}`, color: value <= min ? "var(--text-muted)" : "var(--accent)", fontSize: 22, fontWeight: 700, cursor: value <= min ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          −
        </button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 52, color: "var(--accent)", lineHeight: 1, textAlign: "center", flex: 1 }}>{value}</div>
        <button className="pb" onClick={onInc} disabled={value >= max}
          style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: value >= max ? "var(--surface)" : "var(--accent-dim)", border: `1px solid ${value >= max ? "var(--border)" : "var(--accent)"}`, color: value >= max ? "var(--text-muted)" : "var(--accent)", fontSize: 22, fontWeight: 700, cursor: value >= max ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          +
        </button>
      </div>
      {note && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>✨ {note}</div>
      )}
    </div>
  );
}

export function SetupScreen({ onStart, onJoin, onBack, theme }) {
  const location = useLocation();
  const clubId = location.state?.clubId || null;
  const clubMembers = location.state?.clubMembers || null; // [{uid, name, playerName, photoURL}]
  const rematchPlayers = location.state?.rematchPlayers || null;
  const [step, setStep] = useState("form"); // always start at form, rematch pre-fills players
  const [name, setName] = useState(rematchPlayers ? `Rematch ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "");
  const [isPublic, setIsPublic] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [numP, setNumP] = useState(rematchPlayers ? rematchPlayers.length : 8);
  const [rounds, setRounds] = useState(7);
  const [roundsSuggested, setRoundsSuggested] = useState(true);
  const [names, setNames] = useState(() => {
    if (rematchPlayers) return [...rematchPlayers, ...Array(Math.max(0, 8 - rematchPlayers.length)).fill("")];
    return Array(8).fill("").map((_, i) => `Player ${i + 1}`);
  });
  const [profiles, setProfiles] = useState(() => getGlobalProfiles());
  const [editingAvatar, setEditingAvatar] = useState(null);
  const [focus, setFocus] = useState(null);

  // Join state — pre-fill from ?join= URL param (coming from public tournament JOIN button)
  const [joinCode, setJoinCode] = useState(() => {
    const p = new URLSearchParams(window.location.hash.split("?")[1] || "");
    return p.get("join") || "";
  });
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState("");

  // Auto-suggest rounds when player count changes
  const updateCount = (n) => {
    const c = Math.max(4, Math.min(20, Math.round(n)));
    setNumP(c);
    setNames(prev => {
      const a = [...prev];
      while (a.length < c) a.push(`Player ${a.length + 1}`);
      return a.slice(0, c);
    });
    // Only auto-update rounds if user hasn't manually changed them
    if (roundsSuggested) setRounds(suggestRounds(c));
  };

  const handleRoundsChange = (delta) => {
    setRoundsSuggested(false); // user is manually adjusting
    setRounds(r => Math.max(1, Math.min(30, r + delta)));
  };

  const resetRoundsSuggestion = () => {
    setRounds(suggestRounds(numP));
    setRoundsSuggested(true);
  };

  const canStart = names.slice(0, numP).every(n => n.trim()) && name.trim();

  const handleJoin = async () => {
    const raw = joinCode.trim();
    if (!raw) return;
    setJoining(true); setJoinErr("");
    const upper = raw.toUpperCase();
    try {
      let snap = await get(ref(db, `tournaments/${upper}`));
      if (!snap.exists() && raw !== upper) snap = await get(ref(db, `tournaments/${raw}`));
      if (snap.exists() && snap.val()) {
        onJoin(upper, snap.val());
        setJoining(false);
        return;
      }
      setJoinErr(`Tournament "${upper}" not found.`);
    } catch (e) {
      const isPermission = e?.code === "PERMISSION_DENIED" || e?.message?.includes("permission");
      setJoinErr(isPermission
        ? `Sign in with Google to join this tournament.`
        : "Connection error. Check your internet and try again.");
    }
    setJoining(false);
  };

  const byeCount = numP % 4;
  const courts   = Math.floor(numP / 4);
  const optimalRounds = suggestRounds(numP);

  if (step === "players") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: "2rem", paddingBottom: "1.5rem" }}>
              <button className="pb ni" onClick={() => setStep("form")}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", padding: 4, display: "flex", cursor: "pointer" }}>
                ← Back
              </button>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 2, color: "var(--accent)" }}>PLAYER ROSTER</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{numP} players · {rounds} rounds</div>
              </div>
            </div>

            {/* Club member picker — shown when creating from a club */}
            {clubMembers && clubMembers.length > 0 && (
              <div className="card" style={{ padding: "1rem 1.2rem", marginBottom: 14, border: "1px solid rgba(16,212,142,0.25)" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--accent)", fontWeight: 700, marginBottom: 10 }}>👥 SELECT FROM CLUB MEMBERS</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {clubMembers.map(m => {
                    const pName = m.playerName || m.name;
                    const isSelected = names.slice(0, numP).includes(pName);
                    return (
                      <button key={m.uid} className="pb"
                        onClick={() => {
                          if (isSelected) {
                            const idx = names.indexOf(pName);
                            if (idx !== -1) { const a = [...names]; a[idx] = `Player ${idx + 1}`; setNames(a); }
                          } else {
                            const emptyIdx = names.findIndex((n, i) => i < numP && (n.startsWith("Player ") || n.trim() === ""));
                            if (emptyIdx !== -1) {
                              const a = [...names]; a[emptyIdx] = pName; setNames(a);
                              if (m.photoURL) {
                                const norm = pName.toLowerCase().replace(/\s+/g, "_");
                                setProfiles(prev => ({ ...prev, [norm]: { ...prev[norm], uid: m.uid, photoURL: m.photoURL, displayName: pName } }));
                              }
                            }
                          }
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 20, border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`, background: isSelected ? "rgba(16,212,142,0.12)" : "transparent", color: isSelected ? "var(--accent)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                        {m.photoURL && <img src={m.photoURL} style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />}
                        {pName}
                        {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Players grid */}
            <div className="card" style={{ padding: "1.4rem", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }} className="player-grid">
                {Array.from({ length: numP }, (_, i) => {
                  const normName = normalizePlayerName(names[i]);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: focus === i ? "var(--accent-dim)" : "var(--surface)", border: `1.5px solid ${focus === i ? "var(--accent)" : profiles[normName]?.uid ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--radius-md)", padding: "10px 14px", transition: "all 0.15s", position: "relative" }}>
                      <div style={{ flexShrink: 0 }}>
                        <PlayerAvatar name={names[i]} profile={profiles[normName]} size={30} fallbackIndex={i} />
                      </div>
                      <PlayerSearchInput
                        value={names[i] || ""}
                        placeholder={`Player ${i + 1}`}
                        onChange={v => { const a = [...names]; a[i] = v; setNames(a); }}
                        onLink={player => {
                          if (!player) return;
                          const a = [...names]; a[i] = player.displayName || player.username; setNames(a);
                          const norm = normalizePlayerName(player.displayName || player.username);
                          setProfiles(prev => ({
                            ...prev,
                            [norm]: { ...prev[norm], uid: player.uid, username: player.username, displayName: player.displayName },
                          }));
                        }}
                        style={{ color: "var(--text)", fontSize: 15, fontFamily: "var(--font-body)" }}
                      />
                      {profiles[normName]?.username && (
                        <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>@{profiles[normName].username}</span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-display)", flexShrink: 0 }}>{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {(() => {
              const dups = findDuplicatePlayerNames(names.slice(0, numP));
              return dups.length > 0 && (
                <div className="card" style={{ padding: "10px 16px", marginBottom: 16, borderLeft: "3px solid var(--danger)", display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertCircle size={18} style={{ color: "var(--danger)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>Duplicate Player Names</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {dups.map((d, i) => (
                        <div key={i}>{d.displayNames.join(", ")} — will be treated as the same player</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {byeCount > 0 && (
              <div className="card" style={{ padding: "10px 16px", marginBottom: 16, borderLeft: "3px solid var(--gold)", display: "flex", alignItems: "center", gap: 10 }}>
                <span>☕</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>{byeCount} player{byeCount > 1 ? "s" : ""} sit out per round</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{courts} match{courts > 1 ? "es" : ""} per round · bye rotation keeps it fair</div>
                </div>
              </div>
            )}

            <button className="pb btn btn-primary" style={{ width: "100%", fontSize: 20, padding: "18px", borderRadius: "var(--radius-lg)", opacity: canStart ? 1 : 0.4, cursor: canStart ? "pointer" : "not-allowed" }}
              onClick={() => canStart && onStart(names.slice(0, numP).map(n => n.trim()), rounds, profiles, "#10d48e", { name: name.trim(), isPublic, scheduledAt: scheduledAt || null, clubId: clubId || null })}>
              START TOURNAMENT →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "seeding") {
    const seededNames = names.slice(0, numP).map(n => n.trim());
    const move = (from, to) => {
      const a = [...seededNames];
      [a[from], a[to]] = [a[to], a[from]];
      setNames([...a, ...names.slice(numP)]);
    };

    const autoSeedByStats = () => {
      const history = loadH();
      const { players: statPlayers } = computeCareerStats(history);
      const statMap = {};
      statPlayers.forEach(p => { statMap[p.name.toLowerCase()] = p; });

      const sorted = [...seededNames].sort((a, b) => {
        const sa = statMap[a.toLowerCase()];
        const sb = statMap[b.toLowerCase()];
        // Known players sorted by win rate desc, unknown players go to bottom
        if (!sa && !sb) return 0;
        if (!sa) return 1;
        if (!sb) return -1;
        if (sb.winRate !== sa.winRate) return sb.winRate - sa.winRate;
        return sb.wins - sa.wins;
      });
      setNames([...sorted, ...names.slice(numP)]);
    };

    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: "2rem", paddingBottom: "1.5rem" }}>
              <button className="pb ni" onClick={() => setStep("players")} style={{ background: "none", border: "none", color: "var(--text-secondary)", padding: 4, display: "flex", cursor: "pointer" }}>← Back</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 2, color: "var(--accent)" }}>SEEDING</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Seed 1 is strongest — plays Q1 (2 chances)</div>
              </div>
              <button onClick={autoSeedByStats} style={{
                background: "var(--accent-dim)", border: "1px solid var(--accent)",
                borderRadius: "var(--radius-md)", padding: "8px 12px",
                color: "var(--accent)", fontSize: 11, fontWeight: 700,
                letterSpacing: 1, cursor: "pointer", flexShrink: 0,
              }}>
                ⚡ AUTO SEED
              </button>
            </div>

            <div className="card" style={{ padding: "1.25rem", marginBottom: 16 }}>
              {(() => {
                const history = loadH();
                const { players: sp } = computeCareerStats(history);
                const sm = {};
                sp.forEach(p => { sm[p.name.toLowerCase()] = p; });
                return seededNames.map((n, i) => {
                  const st = sm[n.toLowerCase()];
                  return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < seededNames.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: i < 3 ? "var(--accent)" : "var(--text-muted)", width: 32, textAlign: "center", flexShrink: 0 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{n}</div>
                    {st ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{st.winRate != null ? `${st.winRate}% win rate · ` : ""}{st.matches} matches</div>
                        : <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No stats yet</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => i > 0 && move(i, i - 1)} disabled={i === 0} style={{ width: 32, height: 32, borderRadius: 6, background: i === 0 ? "var(--surface)" : "var(--card)", border: "1px solid var(--border)", color: i === 0 ? "var(--text-muted)" : "var(--text)", cursor: i === 0 ? "not-allowed" : "pointer", fontSize: 14 }}>↑</button>
                    <button onClick={() => i < seededNames.length - 1 && move(i, i + 1)} disabled={i === seededNames.length - 1} style={{ width: 32, height: 32, borderRadius: 6, background: i === seededNames.length - 1 ? "var(--surface)" : "var(--card)", border: "1px solid var(--border)", color: i === seededNames.length - 1 ? "var(--text-muted)" : "var(--text)", cursor: i === seededNames.length - 1 ? "not-allowed" : "pointer", fontSize: 14 }}>↓</button>
                  </div>
                </div>
                  );
                });
              })()}
            </div>

            <div className="card" style={{ padding: "12px 16px", marginBottom: 16, borderLeft: "3px solid var(--upcoming)" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text)" }}>Seeding affects playoffs:</strong> Seed 1 & 2 play Qualifier 1 (2 chances to reach Final). Seeds 3 & 4 play Eliminator (1 chance).
              </div>
            </div>

            <button className="pb btn btn-primary" style={{ width: "100%", fontSize: 20, padding: "18px", borderRadius: "var(--radius-lg)" }}
              onClick={() => onStart(seededNames, rounds, profiles, "#10d48e", { name: name.trim(), isPublic, scheduledAt: scheduledAt || null })}>
              START TOURNAMENT →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>
      <div style={{ padding: "0 1rem" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: "2rem", paddingBottom: "1.5rem" }}>
            <button className="pb ni" onClick={onBack}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", padding: 4, display: "flex", cursor: "pointer" }}>
              ← Back
            </button>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: 2, color: "var(--accent)" }}>
              NEW TOURNAMENT
            </div>
          </div>

          {/* Join existing */}
          <div className="card fu" style={{ padding: "1.4rem", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--upcoming)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Wifi size={13} /> JOIN EXISTING TOURNAMENT
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter Code (e.g. ABC123)" onKeyDown={e => e.key === "Enter" && handleJoin()}
                className="si input" style={{ flex: 1, fontFamily: "var(--font-display)", letterSpacing: 2, fontSize: 18, color: "var(--accent)" }} />
              <button className="pb btn btn-primary" onClick={handleJoin} disabled={joining}
                style={{ padding: "0 24px", fontSize: 16 }}>
                {joining ? "..." : "JOIN"}
              </button>
            </div>
            {joinErr && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{joinErr}</div>}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>CREATE NEW</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Tournament name */}
          <div className="card fu" style={{ padding: "1.4rem", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>TOURNAMENT NAME</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunday League, Club Finals..."
              className="input si"
              style={{ fontSize: 16, fontWeight: 600 }} />
          </div>

          {/* Public / Private */}
          <div className="card fu" style={{ padding: "1.4rem", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 12 }}>VISIBILITY</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { val: true,  label: "🌐 PUBLIC",  desc: "Anyone can view live scores" },
                { val: false, label: "🔒 PRIVATE", desc: "Invite only — need a code" },
              ].map(opt => (
                <button key={String(opt.val)} className="pb" onClick={() => setIsPublic(opt.val)}
                  style={{ padding: "14px", borderRadius: "var(--radius-md)", background: isPublic === opt.val ? "var(--accent-dim)" : "var(--surface)", border: `1.5px solid ${isPublic === opt.val ? "var(--accent)" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isPublic === opt.val ? "var(--accent)" : "var(--text)", marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled date (optional) */}
          <div className="card fu" style={{ padding: "1.4rem", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>
              SCHEDULED DATE & TIME <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>(optional)</span>
            </div>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="input si"
              style={{ colorScheme: "dark", fontSize: 15 }} />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Leave blank to start immediately. Set a date to show it in Upcoming.
            </div>
          </div>

          {/* Players + Rounds */}
          <div className="fu" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Stepper label="PLAYERS" value={numP} onDec={() => updateCount(numP - 1)} onInc={() => updateCount(numP + 1)} min={4} max={20} />
            <Stepper
              label="ROUNDS"
              value={rounds}
              onDec={() => handleRoundsChange(-1)}
              onInc={() => handleRoundsChange(1)}
              min={1} max={30}
              note={roundsSuggested ? OPTIMAL_REASONS[numP] : `Suggested: ${optimalRounds} rounds`}
            />
          </div>

          {/* Reset to suggested */}
          {!roundsSuggested && (
            <button className="pb" onClick={resetRoundsSuggestion}
              style={{ width: "100%", padding: "10px", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: "var(--radius-md)", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
              ✨ Reset to optimal ({optimalRounds} rounds for {numP} players)
            </button>
          )}

          {/* Next → players */}
          <button className="pb btn btn-primary fu" style={{ width: "100%", fontSize: 20, padding: "18px", borderRadius: "var(--radius-lg)", opacity: name.trim() ? 1 : 0.4, cursor: name.trim() ? "pointer" : "not-allowed", marginBottom: 8 }}
            onClick={() => name.trim() && setStep("players")}>
            NEXT — SET PLAYERS →
          </button>

          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 24 }}>
            You'll enter player names on the next screen
          </div>
        </div>
      </div>
    </div>
  );
}
