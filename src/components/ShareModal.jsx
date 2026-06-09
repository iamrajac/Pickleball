import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import emailjs from "@emailjs/browser";
import { X, Copy, Download, MessageCircle, Mail } from "lucide-react";

const EMAILJS_SERVICE_ID  = "service_2k7c608";
const EMAILJS_INVITE_TEMPLATE = "template_invite"; // create this in EmailJS dashboard

export function ShareModal({ code, isPublic = true, onClose, tournamentName, playerCount, standings, currentRound, totalRounds }) {
  const [copied, setCopied] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const joinUrl = `${window.location.origin}?join=${code}`;
  const publicUrl = `${window.location.origin}${window.location.pathname}#/tournament/${code}`;
  const shareUrl = isPublic ? publicUrl : joinUrl;

  const copyCode = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const whatsapp = () => {
    const name = tournamentName || "Pickleball Tournament";
    const players = playerCount ? `👥 ${playerCount} players` : "";
    const round = (currentRound && totalRounds) ? `· Round ${currentRound}/${totalRounds}` : "";
    const playersRound = [players, round].filter(Boolean).join(" ");

    let msg;
    if (isPublic) {
      const top3 = (standings || []).slice(0, 3).map((s, i) => `${i + 1}. ${s.name} (${s.pts}pts)`).join("  ");
      msg = `*${name}* is LIVE! 🏓`;
      if (playersRound) msg += `\n${playersRound}`;
      if (top3) msg += `\nTop 3: ${top3}`;
      msg += `\nWatch live: ${publicUrl}`;
    } else {
      msg = `Join *${name}*! 🏓`;
      if (playersRound) msg += `\n${playersRound}`;
      msg += `\nCode: *${code}*\nJoin here: ${window.location.origin}${window.location.pathname}#/tournament/${code}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const sendInviteEmail = async () => {
    const emails = emailInput.split(/[\s,;]+/).map(e => e.trim()).filter(e => e.includes("@"));
    if (!emails.length) return;
    setEmailSending(true);
    try {
      await Promise.all(emails.map(to_email =>
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_INVITE_TEMPLATE, {
          to_email,
          tournament_name: tournamentName || "Pickleball Tournament",
          tournament_code: code,
          join_url: `${window.location.origin}${window.location.pathname}#/tournament/${code}`,
          player_count: playerCount || "",
        }, "AGOjtqPLUOj6uw_RW")
      ));
      setEmailSent(true);
      setTimeout(() => { setEmailSent(false); setShowEmailForm(false); setEmailInput(""); }, 2500);
    } catch (e) {
      console.error("Invite email failed:", e);
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
      <div className="glass-card fu" style={{ borderRadius: 20, padding: "2rem", width: "90%", maxWidth: 360, textAlign: "center", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}>
          <X size={20} />
        </button>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: "var(--color-lime)", marginBottom: 4 }}>SHARE TOURNAMENT</div>
        {tournamentName && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 2 }}>{tournamentName}</div>}
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 24 }}>Scan QR or share the code</div>

        {/* QR Code */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, display: "inline-block", marginBottom: 20 }}>
          <QRCodeSVG value={shareUrl} size={180} fgColor="#0d0f0a" bgColor="#ffffff" />
        </div>

        {/* Code display */}
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "12px 20px", marginBottom: 20, border: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 10, color: "var(--color-muted)", letterSpacing: 2, marginBottom: 4 }}>TOURNAMENT CODE</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "var(--color-cyan)", letterSpacing: 6 }}>{code}</div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button className="pb" onClick={copyCode} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: copied ? "rgba(200,241,53,0.15)" : "var(--surface)", border: `1px solid ${copied ? "var(--color-lime)" : "var(--color-border)"}`, borderRadius: 10, color: copied ? "var(--color-lime)" : "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Copy size={14} /> {copied ? "COPIED!" : "COPY CODE"}
          </button>
          <button className="pb" onClick={whatsapp} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.4)", borderRadius: 10, color: "#25d366", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <MessageCircle size={14} /> WHATSAPP
          </button>
        </div>

        {/* Email invite */}
        <button className="pb" onClick={() => setShowEmailForm(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", background: "rgba(147,197,253,0.1)", border: "1px solid rgba(147,197,253,0.3)", borderRadius: 10, color: "#93c5fd", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Mail size={14} /> INVITE BY EMAIL
        </button>

        {showEmailForm && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              placeholder="Enter email(s), separated by comma"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--surface)", color: "var(--color-text)", fontSize: 13, boxSizing: "border-box" }}
            />
            <button className="pb" onClick={sendInviteEmail} disabled={emailSending || !emailInput.trim()}
              style={{ padding: "10px", borderRadius: 8, border: "none", background: emailSent ? "rgba(200,241,53,0.2)" : "rgba(147,197,253,0.2)", color: emailSent ? "var(--color-lime)" : "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {emailSent ? "✓ INVITES SENT!" : emailSending ? "SENDING..." : "SEND INVITES"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
