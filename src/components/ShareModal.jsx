import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { X, Copy, Download, MessageCircle } from "lucide-react";

export function ShareModal({ code, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}?join=${code}`;

  const copyCode = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const whatsapp = () => {
    const msg = `🏓 Join my Pickleball Tournament!\nCode: *${code}*\nOpen: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
      <div className="glass-card fu" style={{ borderRadius: 20, padding: "2rem", width: "90%", maxWidth: 360, textAlign: "center", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}>
          <X size={20} />
        </button>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: "var(--color-lime)", marginBottom: 4 }}>SHARE TOURNAMENT</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 24 }}>Scan QR or share the code</div>

        {/* QR Code */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, display: "inline-block", marginBottom: 20 }}>
          <QRCodeSVG value={url} size={180} fgColor="#0d0f0a" bgColor="#ffffff" />
        </div>

        {/* Code display */}
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "12px 20px", marginBottom: 20, border: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 2, marginBottom: 4 }}>TOURNAMENT CODE</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "var(--color-cyan)", letterSpacing: 6 }}>{code}</div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="pb" onClick={copyCode} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: copied ? "rgba(200,241,53,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${copied ? "var(--color-lime)" : "var(--color-border)"}`, borderRadius: 10, color: copied ? "var(--color-lime)" : "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Copy size={14} /> {copied ? "COPIED!" : "COPY CODE"}
          </button>
          <button className="pb" onClick={whatsapp} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.4)", borderRadius: 10, color: "#25d366", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <MessageCircle size={14} /> WHATSAPP
          </button>
        </div>
      </div>
    </div>
  );
}
