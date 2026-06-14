import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useClubs, syncProfileToClubs } from "../hooks/useClub";
import { ArrowLeft, Camera, ExternalLink, Edit2, Trash2, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  getPlayerByUid, claimUsername, validateUsername, savePlayerProfile,
} from "../utils/playerProfile";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { mergeIntoGlobal, syncGlobalProfilesToFirestore } from "../utils/globalProfiles";
import { normalizePlayerName } from "../utils/players";
import { firestore, auth } from "../firebase";
import { updateProfile } from "firebase/auth";
import { ACOLORS } from "../utils/theme";

const POPULAR_EMOJIS = [
  "😎","🔥","🚀","👑","🦄","🐼","🦊","🐯","🦖","👽","👻","🤖",
  "⚽","🎾","🏓","⚡","🌟","🍔","🎸","🎮","💪","🎯",
];

// ── Inline avatar picker ──────────────────────────────────────────────────────
function AvatarEditor({ avatar, googlePhotoURL, onChange }) {
  const [tab, setTab] = useState("emoji");
  const fileRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 160;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        onChange({ type: "image", value: canvas.toDataURL("image/jpeg", 0.75) });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>
        PROFILE AVATAR
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["emoji","😀 Emoji"],["color","🎨 Color"],["photo","📷 Photo"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "7px 0", borderRadius: "var(--radius-sm)", border: "none",
            background: tab === id ? "var(--accent)" : "var(--surface)",
            color: tab === id ? "#fff" : "var(--text-secondary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POPULAR_EMOJIS.map(e => (
            <button key={e} onClick={() => onChange({ ...avatar, type: "emoji", value: e })} style={{
              width: 38, height: 38, borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${avatar?.value === e ? "var(--accent)" : "var(--border)"}`,
              background: avatar?.value === e ? "var(--accent-dim)" : "var(--surface)",
              fontSize: 20, cursor: "pointer",
            }}>
              {e}
            </button>
          ))}
        </div>
      )}

      {tab === "color" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ACOLORS.map(c => (
            <button key={c} onClick={() => onChange({ ...avatar, color: c, type: avatar?.type === "emoji" ? "emoji" : "color" })} style={{
              width: 34, height: 34, borderRadius: "50%", background: c, cursor: "pointer",
              border: avatar?.color === c ? "3px solid var(--text)" : "3px solid transparent",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }} />
          ))}
        </div>
      )}

      {tab === "photo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {googlePhotoURL && (
            <button onClick={() => onChange({ type: "image", value: googlePhotoURL })} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: "var(--radius-md)", cursor: "pointer",
              background: avatar?.value === googlePhotoURL ? "var(--accent-dim)" : "var(--surface)",
              border: `1.5px solid ${avatar?.value === googlePhotoURL ? "var(--accent)" : "var(--border)"}`,
            }}>
              <img src={googlePhotoURL} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Use Google photo</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>From your Google account</div>
              </div>
              {avatar?.value === googlePhotoURL && <span style={{ marginLeft: "auto", color: "var(--accent)" }}>✓</span>}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", borderRadius: "var(--radius-md)", cursor: "pointer",
            background: "var(--surface)", border: "1.5px dashed var(--border)",
            color: "var(--text-secondary)", fontSize: 13, fontWeight: 600,
          }}>
            <Camera size={16} /> Upload from device
          </button>
          {avatar?.type === "image" && (
            <button onClick={() => onChange(null)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "8px", borderRadius: "var(--radius-md)", cursor: "pointer",
              background: "var(--danger-dim)", border: "1px solid var(--danger)",
              color: "var(--danger)", fontSize: 12, fontWeight: 600,
            }}>
              <Trash2 size={14} /> Remove photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit sheet (slides up as a modal) ────────────────────────────────────────
function EditSheet({ user, profile, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatar, setAvatar] = useState(profile?.avatar || null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    await onSave({ displayName: displayName.trim(), bio: bio.trim(), avatar });
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: "100%", maxHeight: "92vh", overflowY: "auto",
        background: "var(--bg)", borderRadius: "20px 20px 0 0",
        padding: "0 1rem 2rem",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 20px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 2, color: "var(--text)" }}>
            EDIT PROFILE
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Avatar preview + editor */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <PlayerAvatar name={displayName || "?"} profile={avatar} size={64} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--text)", letterSpacing: 1 }}>
              {displayName || "Your Name"}
            </div>
            {profile?.username && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>@{profile.username}</div>}
          </div>
        </div>

        {/* Display name */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 8 }}>DISPLAY NAME</div>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="input si"
            style={{ fontSize: 16, fontWeight: 600 }}
          />
        </div>

        {/* Avatar */}
        <div style={{ marginBottom: 16 }}>
          <AvatarEditor avatar={avatar} googlePhotoURL={user?.photoURL} onChange={setAvatar} />
        </div>

        {/* Bio */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 8 }}>
            BIO <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>(optional)</span>
          </div>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="A short line about you..."
            maxLength={100}
            rows={2}
            className="input si"
            style={{ fontSize: 14, resize: "none" }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>{bio.length}/100</div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving || !displayName.trim()} style={{
          width: "100%", padding: "16px", background: "var(--accent)", border: "none",
          borderRadius: "var(--radius-md)", color: "#fff",
          fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 2,
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "SAVING..." : "SAVE"}
        </button>
      </div>
    </div>
  );
}

// ── Username claim sheet ──────────────────────────────────────────────────────
function UsernameSheet({ user, displayName, onClaimed, onClose }) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const claim = async () => {
    const e = validateUsername(input);
    if (e) { setErr(e); return; }
    setLoading(true); setErr("");
    try {
      const u = await claimUsername(user.uid, input, displayName);
      onClaimed(u);
    } catch (e) { setErr(e.message || "Failed"); }
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: "100%", background: "var(--bg)", borderRadius: "20px 20px 0 0",
        padding: "0 1rem 2rem",
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 20px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 2 }}>CLAIM USERNAME</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={22} /></button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
          Get a public profile at <strong style={{ color: "var(--text)" }}>/player/you</strong> — your stats update automatically across all tournaments you're tagged in.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={input}
            onChange={e => { setInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setErr(""); }}
            placeholder="your_username"
            className="input si"
            style={{ flex: 1, fontSize: 16 }}
            onKeyDown={e => e.key === "Enter" && claim()}
          />
          <button onClick={claim} disabled={loading} style={{
            background: "var(--accent)", color: "#fff", border: "none",
            borderRadius: "var(--radius-md)", padding: "0 20px",
            fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 1,
            cursor: loading ? "not-allowed" : "pointer", flexShrink: 0,
          }}>
            {loading ? "..." : "CLAIM"}
          </button>
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 6 }}>{err}</div>}
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>3–20 chars · letters, numbers, underscores only</div>
      </div>
    </div>
  );
}

// ── Stat item ────────────────────────────────────────────────────────────────
function StatItem({ value, label }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)", letterSpacing: 1, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function AccountScreen() {
  const navigate = useNavigate();
  const { user, isGuest, signOutUser, signInWithGoogle, clearGuest } = useAuth();
  const [profile, setProfile] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showUsername, setShowUsername] = useState(false);
  const { clubs } = useClubs(); // must be before any early returns

  useEffect(() => {
    if (!user?.uid) return;
    getPlayerByUid(user.uid).then(p => {
      setProfile(p || {});
      // Push avatar into globalProfiles so it shows everywhere without needing to re-save
      if (p?.avatar && p?.displayName) {
        mergeIntoGlobal({ [normalizePlayerName(p.displayName)]: p.avatar });
        syncGlobalProfilesToFirestore(user.uid, firestore);
      }
    });
  }, [user?.uid]);

  const handleSave = async ({ displayName, bio, avatar }) => {
    await savePlayerProfile(user.uid, { displayName, bio, avatar });
    // Also update Firebase Auth display name so it shows everywhere immediately
    if (auth.currentUser && displayName !== auth.currentUser.displayName) {
      try { await updateProfile(auth.currentUser, { displayName }); } catch {}
    }
    if (avatar) {
      mergeIntoGlobal({ [normalizePlayerName(displayName)]: avatar });
      await syncGlobalProfilesToFirestore(user.uid, firestore);
    }
    // Push updated avatar to all club member docs so everyone sees it immediately
    if (clubs.length) {
      await syncProfileToClubs(user.uid, clubs.map(c => c.id), { displayName, avatar });
    }
    setProfile(prev => ({ ...prev, displayName, bio, avatar }));
    setShowEdit(false);
  };

  // ── Guest ───────────────────────────────────────────────────────────────────
  if (!user || isGuest) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "0 1rem 90px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: "2.5rem", paddingBottom: "1.5rem" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: 2, color: "var(--accent)" }}>ACCOUNT</div>
        </div>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 2, marginBottom: 8 }}>GUEST MODE</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28, lineHeight: 1.6 }}>
            Sign in with Google to get a profile, sync history across devices, and have your stats tracked automatically.
          </div>
          <button className="pb btn btn-primary" onClick={async () => { await signInWithGoogle(); clearGuest(); navigate("/"); }}
            style={{ width: "100%", marginBottom: 12 }}>
            SIGN IN WITH GOOGLE
          </button>
        </div>
      </div>
    </div>
  );

  const displayName = profile?.displayName || user.displayName || "";
  const avatar = profile?.avatar || null;
  const bio = profile?.bio || "";
  const username = profile?.username || "";

  // ── Profile view ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 1rem" }}>

        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "1.75rem", paddingBottom: "1rem" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 2, color: "var(--text)" }}>
            {username ? `@${username}` : "PROFILE"}
          </div>
          <div style={{ width: 30 }} />
        </div>

        {/* Avatar + name */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "1.5rem" }}>
          <div style={{ marginBottom: 14 }}>
            <PlayerAvatar name={displayName || "?"} profile={avatar} size={86} expandable />
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 1.5, color: "var(--text)", textAlign: "center", lineHeight: 1.1 }}>
            {displayName || user.displayName}
          </div>
          {bio ? (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, textAlign: "center", lineHeight: 1.5, maxWidth: 280 }}>
              {bio}
            </div>
          ) : null}
          {user.email && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{user.email}</div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button onClick={() => setShowEdit(true)} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px", borderRadius: "var(--radius-md)", cursor: "pointer",
            background: "var(--card)", border: "1px solid var(--border)",
            color: "var(--text)", fontSize: 14, fontWeight: 700,
          }}>
            <Edit2 size={15} /> Edit Profile
          </button>
          {username ? (
            <button onClick={() => navigate(`/player/${username}`)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: "var(--radius-md)", cursor: "pointer",
              background: "var(--card)", border: "1px solid var(--border)",
              color: "var(--text)", fontSize: 14, fontWeight: 700,
            }}>
              <ExternalLink size={15} /> View Profile
            </button>
          ) : (
            <button onClick={() => setShowUsername(true)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: "var(--radius-md)", cursor: "pointer",
              background: "var(--accent-dim)", border: "1px solid var(--accent)",
              color: "var(--accent)", fontSize: 14, fontWeight: 700,
            }}>
              @ Claim Username
            </button>
          )}
        </div>

        {/* My Clubs */}
        {clubs.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>MY CLUBS</div>
            {clubs.map(club => (
              <button key={club.id} onClick={() => navigate(`/clubs/${club.id}`)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${club.themeColor || "#10d48e"}22`, border: `1.5px solid ${club.themeColor || "#10d48e"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{club.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{club.memberCount || 1} members · {club.adminUid === user.uid ? "Admin" : "Member"}</div>
                </div>
                <span style={{ color: "var(--text-muted)" }}>›</span>
              </button>
            ))}
            <div style={{ height: 1, background: "var(--border)", margin: "16px 0 24px" }} />
          </>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", marginBottom: 24 }} />

        {/* Sign out */}
        <button className="pb btn btn-danger" onClick={signOutUser}
          style={{ width: "100%", fontSize: 14, padding: "13px" }}>
          SIGN OUT
        </button>

      </div>

      {/* Edit sheet */}
      {showEdit && (
        <EditSheet
          user={user}
          profile={{ ...profile, displayName, bio, avatar, username }}
          onSave={handleSave}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Username sheet */}
      {showUsername && (
        <UsernameSheet
          user={user}
          displayName={displayName}
          onClaimed={u => { setProfile(prev => ({ ...prev, username: u })); setShowUsername(false); }}
          onClose={() => setShowUsername(false)}
        />
      )}
    </div>
  );
}
