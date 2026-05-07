import { useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { ChevronRight, History, Wifi, BarChart2 } from "lucide-react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { AvatarPickerModal } from "../components/AvatarPickerModal";

export function SetupScreen({ onStart, onHistory, onJoin, onCareer }) {
  const [numP, setNumP] = useState(8);
  const [names, setNames] = useState(Array(8).fill("").map((_, i) => `Player ${i + 1}`));
  const [rounds, setRounds] = useState(7);
  const [focus, setFocus] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState("");
  const [profiles, setProfiles] = useState({});
  const [editingAvatar, setEditingAvatar] = useState(null);

  const updateCount = n => {
    const c = Math.max(4, Math.min(20, Math.round(n)));
    setNumP(c);
    setNames(prev => {
      const a = [...prev];
      while (a.length < c) a.push(`Player ${a.length + 1}`);
      return a.slice(0, c);
    });
  };
  
  const byeCount = numP % 4;
  const courtsPerRound = Math.floor(numP / 4);
  
  const canStart = names.slice(0, numP).every(n => n.trim());

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinErr("");
    try {
      const snap = await get(ref(db, `tournaments/${joinCode.trim().toUpperCase()}`));
      if (snap.exists()) {
        onJoin(joinCode.trim().toUpperCase(), snap.val());
      } else {
        setJoinErr("Tournament not found. Check the code.");
      }
    } catch {
      setJoinErr("Connection error. Try again.");
    }
    setJoining(false);
  };

  return (
    <div style={{ padding: "0 1rem 4rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        
        {/* Header */}
        <div className="fu" style={{ paddingTop: "2.5rem", paddingBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--color-muted)', marginBottom: 4 }}>🏓 TOURNAMENT MANAGER</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 62, color: 'var(--color-lime)', lineHeight: .95, letterSpacing: 3 }}>
              PICKLE<br />BALL
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="pb glass" onClick={onHistory} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text)', padding: "8px 16px", borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500 }}>
              <History size={16} /> HISTORY
            </button>
            <button className="pb glass" onClick={onCareer} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-lime)', padding: "8px 16px", borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500, border: '1px solid rgba(200,241,53,0.3)' }}>
              <BarChart2 size={16} /> CAREER
            </button>
          </div>
        </div>

        {/* Join existing */}
        <div className="fu glass-card" style={{ animationDelay: ".04s", borderRadius: 'var(--radius-md)', padding: "1.4rem", marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: 2, color: 'var(--color-cyan)', marginBottom: 12, fontWeight: 600 }}>
            <Wifi size={14} /> JOIN LIVE TOURNAMENT
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter Code (e.g. ABC123)"
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              className="si"
              style={{ flex: 1, background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 'var(--radius-sm)', color: 'var(--color-lime)', fontSize: 16, padding: "12px 16px", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }} />
            <button className="pb" onClick={handleJoin} disabled={joining}
              style={{ background: 'var(--color-cyan)', border: "none", borderRadius: 'var(--radius-sm)', padding: "0 24px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, color: 'var(--color-dark)' }}>
              {joining ? "..." : "JOIN"}
            </button>
          </div>
          {joinErr && <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 8 }}>{joinErr}</div>}
        </div>

        {/* Settings Grid */}
        <div className="fu" style={{ animationDelay: ".06s", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[{ label: "PLAYERS", val: numP, min: 4, max: 20, step: 1, set: e => updateCount(Number(e.target.value)) },
            { label: "ROUNDS", val: rounds, min: 1, max: 30, step: 1, set: e => setRounds(Math.max(1, Number(e.target.value))) }
          ].map(({ label, val, min, max, step, set }) => (
            <div key={label} className="glass-card" style={{ borderRadius: 'var(--radius-md)', padding: "1.4rem" }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--color-muted)', marginBottom: 8, fontWeight: 600 }}>{label}</div>
              <input type="number" value={val} min={min} max={max} step={step} onChange={set}
                className="si"
                style={{ background: "transparent", border: "none", color: 'var(--color-lime)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, width: "100%", padding: 0, lineHeight: 1 }} />
            </div>
          ))}
        </div>

        {/* Bye notice */}
        {byeCount > 0 && (
          <div className="fu glass-card" style={{ animationDelay: ".08s", borderRadius: 'var(--radius-sm)', padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(241, 200, 53, 0.3)" }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gold)' }}>{byeCount} player{byeCount > 1 ? "s" : ""} will sit out per round (bye rotation)</div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{courtsPerRound} match{courtsPerRound > 1 ? "es" : ""} per round · everyone gets equal play time</div>
            </div>
          </div>
        )}

        {/* Player Roster */}
        <div className="fu glass-card" style={{ animationDelay: ".1s", borderRadius: 'var(--radius-lg)', padding: "1.6rem", marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--color-muted)', marginBottom: 16, fontWeight: 600 }}>PLAYER ROSTER</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {Array.from({ length: numP }, (_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: focus === i ? 'rgba(36, 44, 24, 0.6)' : 'var(--color-surface)', border: `1px solid ${focus === i ? 'var(--color-lime)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', padding: "10px 14px", transition: "all .2s ease" }}>
                <div onClick={() => setEditingAvatar(i)} style={{ cursor: "pointer", transition: "transform 0.1s" }} className="pb">
                  <PlayerAvatar name={names[i]} profile={profiles[names[i]]} size={30} fallbackIndex={i} />
                </div>
                <input value={names[i] || ""} placeholder={`Player ${i + 1}`}
                  onFocus={() => setFocus(i)} onBlur={() => setFocus(null)}
                  onChange={e => { const a = [...names]; a[i] = e.target.value; setNames(a); }}
                  style={{ background: "transparent", border: "none", color: 'var(--color-text)', fontSize: 15, outline: "none", width: "100%", fontFamily: "'DM Sans', sans-serif" }} />
                <div style={{ fontSize: 13, color: 'var(--color-border)', fontFamily: "'Bebas Neue', sans-serif" }}>{i + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button className="fu pb" style={{ animationDelay: ".14s", width: "100%", padding: "20px", background: canStart ? 'var(--color-lime)' : 'var(--color-border)', border: "none", borderRadius: 'var(--radius-md)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color: canStart ? 'var(--color-dark)' : 'var(--color-muted)', cursor: canStart ? "pointer" : "not-allowed", display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, boxShadow: canStart ? '0 8px 32px rgba(200, 241, 53, 0.25)' : 'none' }}
          onClick={() => canStart && onStart(names.slice(0, numP).map(n => n.trim()), rounds, profiles)}>
          CREATE TOURNAMENT <ChevronRight size={24} />
        </button>
      </div>

      {editingAvatar !== null && (
        <AvatarPickerModal 
          name={names[editingAvatar]} 
          currentProfile={profiles[names[editingAvatar]]} 
          onSave={(prof) => {
            setProfiles(prev => ({ ...prev, [names[editingAvatar]]: prof }));
            setEditingAvatar(null);
          }} 
          onClose={() => setEditingAvatar(null)} 
        />
      )}
    </div>
  );
}
