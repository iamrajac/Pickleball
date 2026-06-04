import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem("pkl_install_dismissed");
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      if (!dismissed || Date.now() - parseInt(dismissed) > weekMs) {
        setTimeout(() => setShow(true), 3000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShow(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pkl_install_dismissed", Date.now().toString());
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", bottom: 88, left: 12, right: 12,
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px",
      boxShadow: "var(--shadow-lg)", zIndex: 200,
      display: "flex", alignItems: "center", gap: 12,
      animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>🏓</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: 1.5, marginBottom: 2 }}>
          INSTALL APP
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          Play offline · Faster launch · Home screen icon
        </div>
      </div>
      <button onClick={install} style={{
        background: "var(--accent)", color: "#fff", border: "none",
        borderRadius: "var(--radius-md)", padding: "8px 14px", flexShrink: 0,
        fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 1,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
      }}>
        <Download size={13} /> GET
      </button>
      <button onClick={dismiss} style={{
        background: "none", border: "none", color: "var(--text-muted)",
        cursor: "pointer", padding: 4, flexShrink: 0,
      }}>
        <X size={15} />
      </button>
    </div>
  );
}
