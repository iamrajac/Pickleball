import { useState } from "react";
import { X, Lock, Unlock, Copy } from "lucide-react";

// Generate a 4-digit PIN
export function generateScorerPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Store scorer PINs in localStorage
const SK_PINS = "pkl_scorer_pins";
export function saveScorerPin(code, pin) {
  try {
    const d = JSON.parse(localStorage.getItem(SK_PINS) || "{}");
    d[code] = pin;
    localStorage.setItem(SK_PINS, JSON.stringify(d));
  } catch {}
}
export function getScorerPin(code) {
  try {
    const d = JSON.parse(localStorage.getItem(SK_PINS) || "{}");
    return d[code] || null;
  } catch { return null; }
}
export function isScorerForCode(code, enteredPin) {
  const saved = getScorerPin(code);
  return saved && saved === enteredPin;
}

// Modal shown to creator to share PIN
export function ScorerPinModal({ code, pin, onClose }) {
  const [copied, setCopied] = useState(false);
  const msg = `🏓 Pickleball Scorer Access\nCode: ${code}\nScorer PIN: ${pin}\nOpen: ${window.location.origin}?join=${code}`;

  const copy = () => {
    navigator.clipboard?.writeText(pin).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
      <div className="glass-card fu" style={{ borderRadius: 20, padding: "2rem", width: "90%", maxWidth: 340, textAlign: "center", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}><X size={20} /></button>
        <div style={{ fontSize: 32, marginBottom: 8 }}><Unlock size={40} color="var(--color-gold)" style={{ margin: "0 auto" }} /></div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: "var(--color-gold)", marginBottom: 4 }}>SCORER ACCESS</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 20 }}>Share this PIN to let someone else enter scores</div>
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "16px", marginBottom: 20, border: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 2, marginBottom: 4 }}>SCORER PIN</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: "var(--color-gold)", letterSpacing: 8, lineHeight: 1 }}>{pin}</div>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 16 }}>They enter tournament code <strong style={{ color: "var(--color-cyan)" }}>{code}</strong> + this PIN to get scorer access</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="pb" onClick={copy} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", background: copied ? "rgba(200,241,53,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${copied ? "var(--color-lime)" : "var(--color-border)"}`, borderRadius: 10, color: copied ? "var(--color-lime)" : "var(--color-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Copy size={14} /> {copied ? "COPIED!" : "COPY PIN"}
          </button>
          <button className="pb" onClick={whatsapp} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.4)", borderRadius: 10, color: "#25d366", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            📤 WHATSAPP
          </button>
        </div>
      </div>
    </div>
  );
}

// PIN entry shown to joiners who want scorer access
export function ScorerPinEntry({ code, onGranted, onClose }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");

  const verify = () => {
    // Store the entered PIN and let App verify against Firebase
    onGranted(pin);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
      <div className="glass-card fu" style={{ borderRadius: 20, padding: "2rem", width: "90%", maxWidth: 320, textAlign: "center", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}><X size={20} /></button>
        <Lock size={36} color="var(--color-gold)" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-gold)", marginBottom: 4 }}>ENTER SCORER PIN</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 20 }}>Get the 4-digit PIN from the tournament creator</div>
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="_ _ _ _" maxLength={4} className="si"
          style={{ width: "100%", textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, letterSpacing: 12, color: "var(--color-gold)", background: "rgba(0,0,0,0.3)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px", boxSizing: "border-box", marginBottom: 8 }} />
        {err && <div style={{ fontSize: 12, color: "var(--color-danger)", marginBottom: 8 }}>{err}</div>}
        <button className="pb" onClick={verify} disabled={pin.length !== 4}
          style={{ width: "100%", padding: "14px", background: pin.length === 4 ? "var(--color-gold)" : "var(--color-border)", border: "none", borderRadius: 10, fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: pin.length === 4 ? "#0d0f0a" : "var(--color-muted)", cursor: pin.length === 4 ? "pointer" : "not-allowed" }}>
          UNLOCK SCORING
        </button>
      </div>
    </div>
  );
}
