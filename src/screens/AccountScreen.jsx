import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, ExternalLink, Save, Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  getPlayerByUid, claimUsername, validateUsername,
  savePlayerProfile,
} from "../utils/playerProfile";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { mergeIntoGlobal, syncGlobalProfilesToFirestore } from "../utils/globalProfiles";
import { normalizePlayerName } from "../utils/players";
import { firestore } from "../firebase";
import { ACOLORS } from "../utils/theme";

const POPULAR_EMOJIS = [
  "😎","🔥","🚀","👑","🦄","🐼","🦊","🐯","🦖","👽","👻","🤖",
  "⚽","🎾","🏓","⚡","🌟","🍔","🎸","🎮","💪","🎯",
];

// ── Inline avatar picker ──────────────────────────────────────────────────────
function AvatarEditor({ avatar, googlePhotoURL, onChange }) {
  const [tab, setTab] = useState("emoji"); // "emoji" | "color" | "photo"
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
    <div className="card" style={{ padding: "1.25rem" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 14 }}>
        PROFILE AVATAR
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["emoji","😀 Emoji"],["color","🎨 Color"],["photo","📷 Photo"]].map(([id,label]) => (
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
              width: 38, height: 38, borderRadius: "var(--radius-sm)", border: `1.5px solid ${avatar?.value === e ? "var(--accent)" : "var(--border)"}`,
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
            <button key={c} onClick={() => onChange({ ...avatar, type: "color", color: c })} style={{
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
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: "var(--radius-md)", cursor: "pointer",
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

// ── Main screen ───────────────────────────────────────────────────────────────
export function AccountScreen() {
  const navigate = useNavigate();
  const { user, isGuest, signOutUser, signInWithGoogle, clearGuest } = useAuth();

  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameErr, setUsernameErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [claimingUsername, setClaimingUsername] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing profile on mount
  useEffect(() => {
    if (!user?.uid) return;
    getPlayerByUid(user.uid).then(p => {
      if (p) {
        setProfile(p);
        setDisplayName(p.displayName || user.displayName || "");
        setBio(p.bio || "");
        setAvatar(p.avatar || null);
        setUsername(p.username || "");
      } else {
        setDisplayName(user.displayName || "");
      }
    });
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user?.uid || !displayName.trim()) return;
    setSaving(true);
    try {
      await savePlayerProfile(user.uid, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar,
      });
      // Push avatar into globalProfiles so it shows in all tournaments
      const avatarData = avatar ? { type: avatar.type, value: avatar.value, color: avatar.color } : null;
      if (avatarData) {
        mergeIntoGlobal({ [normalizePlayerName(displayName.trim())]: avatarData });
        await syncGlobalProfilesToFirestore(user.uid, firestore);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Save profile failed:", e);
    }
    setSaving(false);
  };

  const handleClaimUsername = async () => {
    const err = validateUsername(usernameInput);
    if (err) { setUsernameErr(err); return; }
    setClaimingUsername(true); setUsernameErr("");
    try {
      const u = await claimUsername(user.uid, usernameInput, displayName || user.displayName);
      setUsername(u);
      setUsernameInput("");
    } catch (e) {
      setUsernameErr(e.message || "Failed to claim username");
    }
    setClaimingUsername(false);
  };

  // ── Guest screen ────────────────────────────────────────────────────────────
  if (!user || isGuest) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "0 1rem 90px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: "2.5rem", paddingBottom: "1.5rem" }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
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

  // ── Signed-in screen ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 1rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: "2rem", paddingBottom: "1.5rem" }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: 2, color: "var(--accent)" }}>
            MY PROFILE
          </div>
        </div>

        {/* Profile preview */}
        <div className="card" style={{ padding: "1.5rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flexShrink: 0 }}>
            <PlayerAvatar name={displayName || user.displayName} profile={avatar} size={64} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 1.5, color: "var(--text)", lineHeight: 1.1 }}>
              {displayName || user.displayName || "Your Name"}
            </div>
            {username && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>@{username}</div>
            )}
            {bio && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{bio}</div>}
          </div>
          {username && (
            <button onClick={() => navigate(`/player/${username}`)} style={{
              background: "var(--accent-dim)", border: "1px solid var(--accent)",
              borderRadius: "var(--radius-sm)", padding: "7px 10px",
              color: "var(--accent)", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
            }}>
              VIEW <ExternalLink size={12} />
            </button>
          )}
        </div>

        {/* Display name */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>
            DISPLAY NAME
          </div>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="input si"
            style={{ fontSize: 16, fontWeight: 600 }}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            This name will appear in tournaments and on your profile.
          </div>
        </div>

        {/* Avatar editor */}
        <div style={{ marginBottom: 12 }}>
          <AvatarEditor
            avatar={avatar}
            googlePhotoURL={user.photoURL}
            onChange={setAvatar}
          />
        </div>

        {/* Bio */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>
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
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "right" }}>
            {bio.length}/100
          </div>
        </div>

        {/* Username */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>
            USERNAME
          </div>
          {username ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 1.5, color: "var(--accent)" }}>
                  @{username}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Public at /player/{username}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                Claim a unique username so others can find and tag you in tournaments.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setUsernameErr(""); }}
                  placeholder="your_username"
                  className="input si"
                  style={{ flex: 1, fontSize: 15 }}
                  onKeyDown={e => e.key === "Enter" && handleClaimUsername()}
                />
                <button onClick={handleClaimUsername} disabled={claimingUsername} style={{
                  background: "var(--accent)", color: "#fff", border: "none",
                  borderRadius: "var(--radius-md)", padding: "0 18px",
                  fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: 1,
                  cursor: claimingUsername ? "not-allowed" : "pointer", flexShrink: 0,
                }}>
                  {claimingUsername ? "..." : "CLAIM"}
                </button>
              </div>
              {usernameErr && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8 }}>{usernameErr}</div>}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                3–20 chars · letters, numbers, underscores only
              </div>
            </>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
          style={{
            width: "100%", padding: "16px", marginBottom: 12,
            background: saved ? "var(--accent)" : "var(--accent)",
            border: "none", borderRadius: "var(--radius-md)", color: "#fff",
            fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 2,
            cursor: saving || !displayName.trim() ? "not-allowed" : "pointer",
            opacity: saving || !displayName.trim() ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.2s",
          }}>
          {saved ? "✓ SAVED" : saving ? "SAVING..." : <><Save size={18} /> SAVE PROFILE</>}
        </button>

        {/* Sign out */}
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", marginBottom: 10 }}>
            ACCOUNT
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
            {user.email}
          </div>
          <button className="pb btn btn-danger" onClick={signOutUser} style={{ width: "100%", fontSize: 14, padding: "12px" }}>
            SIGN OUT
          </button>
        </div>

      </div>
    </div>
  );
}
