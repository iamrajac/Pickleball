import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users, LogIn } from "lucide-react";
import { useClubs, createClub, joinClub } from "../hooks/useClub";
import { getAuth } from "firebase/auth";

export function ClubsScreen() {
  const { clubs, loading } = useClubs();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // "create" | "join"
  const [clubName, setClubName] = useState("");
  const [clubDesc, setClubDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const uid = getAuth().currentUser?.uid;

  const handleCreate = async () => {
    if (!clubName.trim()) return;
    setWorking(true); setError("");
    try {
      const { clubId } = await createClub({ name: clubName.trim(), description: clubDesc.trim() });
      setMode(null); setClubName(""); setClubDesc("");
      navigate(`/clubs/${clubId}`);
    } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setWorking(true); setError("");
    try {
      const { clubId } = await joinClub(joinCode.trim());
      setMode(null); setJoinCode("");
      navigate(`/clubs/${clubId}`);
    } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  };

  if (!uid) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🏓</div>
      <div>Sign in to create or join clubs.</div>
    </div>
  );

  return (
    <div style={{ padding: "1rem 1rem 5rem", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ paddingTop: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "var(--color-lime)", letterSpacing: 2, lineHeight: 1 }}>MY CLUBS</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>Create or join a club to track stats automatically</div>
      </div>

      {/* Action buttons — only show when user has clubs already (empty state has its own buttons) */}
      {!mode && clubs.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button className="pb" onClick={() => setMode("create")}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: "rgba(16,212,142,0.12)", border: "1px solid rgba(16,212,142,0.4)", borderRadius: 12, color: "var(--color-lime)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            <Plus size={16} /> CREATE CLUB
          </button>
          <button className="pb" onClick={() => setMode("join")}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            <LogIn size={16} /> JOIN CLUB
          </button>
        </div>
      )}

      {/* Create form */}
      {mode === "create" && (
        <div className="glass-card" style={{ borderRadius: 14, padding: "1.2rem", marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--color-lime)", fontWeight: 700, marginBottom: 12 }}>NEW CLUB</div>
          <input value={clubName} onChange={e => setClubName(e.target.value)}
            placeholder="Club name (e.g. SRM Pickleball)"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.05)", color: "var(--color-text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
          <input value={clubDesc} onChange={e => setClubDesc(e.target.value)}
            placeholder="Description (optional)"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.05)", color: "var(--color-text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
          {error && <div style={{ color: "var(--color-danger)", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pb" onClick={() => { setMode(null); setError(""); }}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 13 }}>
              CANCEL
            </button>
            <button className="pb" onClick={handleCreate} disabled={working || !clubName.trim()}
              style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "var(--color-lime)", color: "#0d0f0a", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: working ? 0.6 : 1 }}>
              {working ? "CREATING..." : "CREATE"}
            </button>
          </div>
        </div>
      )}

      {/* Join form */}
      {mode === "join" && (
        <div className="glass-card" style={{ borderRadius: 14, padding: "1.2rem", marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--color-cyan)", fontWeight: 700, marginBottom: 12 }}>JOIN A CLUB</div>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter club code"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "rgba(255,255,255,0.05)", color: "var(--color-text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box", letterSpacing: 3, fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, textAlign: "center" }} />
          {error && <div style={{ color: "var(--color-danger)", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pb" onClick={() => { setMode(null); setError(""); }}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: 13 }}>
              CANCEL
            </button>
            <button className="pb" onClick={handleJoin} disabled={working || !joinCode.trim()}
              style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "var(--color-cyan)", color: "#0d0f0a", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: working ? 0.6 : 1 }}>
              {working ? "JOINING..." : "JOIN"}
            </button>
          </div>
        </div>
      )}

      {/* Club list */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--color-muted)", padding: "2rem" }}>Loading...</div>
      ) : clubs.length === 0 && !mode ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "3rem 1.5rem", borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏓</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--color-lime)", letterSpacing: 2 }}>NO CLUBS YET</div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 8, marginBottom: 24 }}>Create a club to automatically track your group's wins, losses and titles.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="pb" onClick={() => setMode("create")}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: "rgba(16,212,142,0.12)", border: "1px solid rgba(16,212,142,0.4)", borderRadius: 12, color: "var(--color-lime)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <Plus size={15} /> CREATE
            </button>
            <button className="pb" onClick={() => setMode("join")}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <LogIn size={15} /> JOIN
            </button>
          </div>
        </div>
      ) : (
        clubs.map(club => (
          <div key={club.id} className="rh glass-card" onClick={() => navigate(`/clubs/${club.id}`)}
            style={{ borderRadius: 14, padding: "1.2rem", marginBottom: 12, cursor: "pointer", border: `1px solid ${club.themeColor || "var(--color-lime)"}33` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${club.themeColor || "#10d48e"}22`, border: `2px solid ${club.themeColor || "#10d48e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                🏓
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-text)", letterSpacing: 1, lineHeight: 1 }}>{club.name}</div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 3 }}>
                  <Users size={10} style={{ display: "inline", marginRight: 4 }} />
                  {club.memberCount || 1} members · Code: <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2, color: club.themeColor || "var(--color-lime)" }}>{club.code}</span>
                </div>
                {club.description && <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{club.description}</div>}
              </div>
              <div style={{ color: "var(--color-muted)", fontSize: 18 }}>›</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
