import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { Wifi, AlertCircle } from "lucide-react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { AvatarPickerModal } from "../components/AvatarPickerModal";
import { suggestRounds } from "./HubScreen";
import { findDuplicatePlayerNames, normalizePlayerName } from "../utils/players";

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
  const [step, setStep] = useState("form"); // "form" | "players"
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [numP, setNumP] = useState(8);
  const [rounds, setRounds] = useState(7);
  const [roundsSuggested, setRoundsSuggested] = useState(true);
  const [names, setNames] = useState(Array(8).fill("").map((_, i) => `Player ${i + 1}`));
  const [profiles, setProfiles] = useState({});
  const [editingAvatar, setEditingAvatar] = useState(null);
  const [focus, setFocus] = useState(null);

  // Join state
  const [joinCode, setJoinCode] = useState("");
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
    try {
      const upper = raw.toUpperCase();
      let snap = await get(ref(db, `tournaments/${upper}`));
      if (!snap.exists() && raw !== upper) snap = await get(ref(db, `tournaments/${raw}`));
      if (snap.exists() && snap.val()) {
        onJoin(upper, snap.val());
      } else {
        setJoinErr(`Tournament "${upper}" not found.`);
      }
    } catch { setJoinErr("Connection error. Check your internet."); }
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

            {/* Players grid */}
            <div className="card" style={{ padding: "1.4rem", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }} className="player-grid">
                {Array.from({ length: numP }, (_, i) => {
                  const normName = normalizePlayerName(names[i]);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: focus === i ? "var(--accent-dim)" : "var(--surface)", border: `1.5px solid ${focus === i ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--radius-md)", padding: "10px 14px", transition: "all 0.15s" }}>
                      <div onClick={() => setEditingAvatar(i)} style={{ cursor: "pointer", flexShrink: 0 }}>
                        <PlayerAvatar name={names[i]} profile={profiles[normName]} size={30} fallbackIndex={i} />
                      </div>
                      <input value={names[i] || ""} placeholder={`Player ${i + 1}`}
                        onFocus={() => setFocus(i)} onBlur={() => setFocus(null)}
                        onChange={e => { const a = [...names]; a[i] = e.target.value; setNames(a); }}
                        style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 15, outline: "none", flex: 1, fontFamily: "var(--font-body)" }} />
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
              onClick={() => canStart && onStart(names.slice(0, numP).map(n => n.trim()), rounds, profiles, "#10d48e", { name: name.trim(), isPublic, scheduledAt: scheduledAt || null })}>
              START TOURNAMENT →
            </button>
          </div>
        </div>
        {editingAvatar !== null && (
          <AvatarPickerModal name={names[editingAvatar]} currentProfile={profiles[normalizePlayerName(names[editingAvatar])]}
            onSave={prof => { setProfiles(prev => ({ ...prev, [normalizePlayerName(names[editingAvatar])]: prof })); setEditingAvatar(null); }}
            onClose={() => setEditingAvatar(null)} />
        )}
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
