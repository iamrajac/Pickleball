import { useState } from "react";

export function AuthModal({ onGoogle, onGuest }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleGoogle = async () => {
    setLoading(true); setErr("");
    try { await onGoogle(); }
    catch { setErr("Sign-in failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "2rem",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🏓</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 52, color: "var(--accent)", letterSpacing: 4, lineHeight: 1 }}>
          PICKLEBALL
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, letterSpacing: 1 }}>
          TOURNAMENT MANAGER
        </div>
      </div>

      {/* Auth card */}
      <div className="card" style={{ width: "100%", maxWidth: 360, padding: "2rem" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 2, marginBottom: 6 }}>
          GET STARTED
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28 }}>
          Sign in to save your history across devices, or continue as a guest.
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            padding: "14px", borderRadius: "var(--radius-md)",
            background: loading ? "var(--card-hover)" : "var(--surface)",
            border: "1.5px solid var(--border-strong)",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 15, fontWeight: 600, color: "var(--text)",
            transition: "all 0.15s", marginBottom: 12,
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

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Guest */}
        <button onClick={onGuest}
          style={{
            width: "100%", padding: "13px",
            borderRadius: "var(--radius-md)",
            background: "transparent",
            border: "1.5px solid var(--border)",
            fontSize: 14, fontWeight: 600, color: "var(--text-secondary)",
            cursor: "pointer", transition: "all 0.15s",
          }}>
          Continue as Guest
        </button>

        {err && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--danger)", textAlign: "center" }}>{err}</div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>
          Guest mode saves data on this device only.
          <br />Sign in with Google to sync across devices.
        </div>
      </div>
    </div>
  );
}
