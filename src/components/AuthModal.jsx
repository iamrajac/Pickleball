import { useState } from "react";

const FEATURES = [
  { emoji: "⚡", text: "Live scores sync in real time" },
  { emoji: "🏆", text: "Auto-generate playoffs & brackets" },
  { emoji: "📊", text: "Standings, stats & career history" },
  { emoji: "📱", text: "Join as spectator with a 4-letter code" },
];

export function AuthModal({ onGoogle, onGuest }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleGoogle = async () => {
    setLoading(true); setErr("");
    try { await onGoogle(); }
    catch (e) {
      const msg = e?.code === "auth/unauthorized-domain"
        ? "This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains."
        : e?.code === "auth/popup-blocked"
        ? "Popup was blocked. Please allow popups for this site."
        : e?.code === "auth/popup-closed-by-user"
        ? "Sign-in cancelled."
        : `Sign-in failed: ${e?.code || e?.message || "unknown error"}`;
      setErr(msg);
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", flexDirection: "column",
      overflowY: "auto",
    }}>
      {/* Hero */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "3rem 2rem 1.5rem", textAlign: "center",
      }}>
        <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>🏓</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 54,
          color: "var(--accent)", letterSpacing: 4, lineHeight: 1,
        }}>
          PICKLEBALL
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-muted)",
          letterSpacing: 3, marginTop: 6, marginBottom: 32,
          fontWeight: 600, textTransform: "uppercase",
        }}>
          Tournament Manager
        </div>

        {/* Feature pills */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 10, width: "100%", maxWidth: 360, marginBottom: 36,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 10,
              textAlign: "left",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{f.emoji}</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auth card — pinned to bottom */}
      <div style={{ padding: "0 1.5rem 2rem" }}>
        <div style={{ maxWidth: 360, margin: "0 auto" }}>
          <div className="card" style={{ padding: "1.75rem" }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 20,
              letterSpacing: 2, marginBottom: 5,
            }}>
              GET STARTED
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 22, lineHeight: 1.5 }}>
              Sign in to sync history across all your devices, or play as a guest on this device.
            </div>

            {/* Google */}
            <button onClick={handleGoogle} disabled={loading} style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 12, padding: "14px",
              borderRadius: "var(--radius-md)",
              background: loading ? "var(--card-hover)" : "var(--surface)",
              border: "1.5px solid var(--border-strong)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15, fontWeight: 600, color: "var(--text)",
              transition: "all 0.15s", marginBottom: 10,
            }}>
              {loading ? (
                <span style={{ fontSize: 18 }}>⏳</span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <button onClick={onGuest} style={{
              width: "100%", padding: "13px",
              borderRadius: "var(--radius-md)", background: "transparent",
              border: "1.5px solid var(--border)",
              fontSize: 14, fontWeight: 600, color: "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.15s",
            }}>
              Continue as Guest
            </button>

            {err && (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", textAlign: "center" }}>
                {err}
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
              Guest mode saves data on this device only.
              <br />Google sync works across all devices.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
