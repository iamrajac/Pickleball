import { useRef } from "react";
import { Download, X } from "lucide-react";
import html2canvas from "html2canvas";

const ACOLORS = ["#c8f135","#35c8f1","#f1c835","#f13565","#a78bfa","#f18835","#35f165","#c835f1"];

export function StandingsShareModal({ standings, onClose }) {
  const cardRef = useRef(null);

  const download = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: "#0d0f0a", scale: 2 });
    const link = document.createElement("a");
    link.download = "pickleball-standings.png";
    link.href = canvas.toDataURL();
    link.click();
  };

  const share = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: "#0d0f0a", scale: 2 });
    canvas.toBlob(async (blob) => {
      if (navigator.share && blob) {
        try {
          await navigator.share({ files: [new File([blob], "standings.png", { type: "image/png" })], title: "Pickleball Standings" });
        } catch { download(); }
      } else { download(); }
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: "1rem", overflowY: "auto" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 480 }}>
        <button onClick={onClose} style={{ position: "absolute", top: -40, right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)" }}>
          <X size={24} />
        </button>

        {/* The shareable card */}
        <div ref={cardRef} style={{ background: "#0d0f0a", borderRadius: 20, padding: "1.5rem", border: "1px solid rgba(200,241,53,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#c8f135", letterSpacing: 3, lineHeight: 1 }}>PICKLEBALL</div>
              <div style={{ fontSize: 10, color: "#7a8a65", letterSpacing: 2 }}>STANDINGS</div>
            </div>
            <div style={{ fontSize: 32 }}>🏓</div>
          </div>

          {standings.map((s, i) => {
            const diff = s.scored - s.conceded;
            const top = i < 4;
            return (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: top ? "rgba(200,241,53,0.06)" : "rgba(255,255,255,0.02)", marginBottom: 6, border: top ? "1px solid rgba(200,241,53,0.15)" : "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: i === 0 ? "#c8f135" : i < 4 ? "#5a6a45" : "#3a3a3a", width: 28, textAlign: "center" }}>{i + 1}</div>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: ACOLORS[i % ACOLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#0d0f0a", flexShrink: 0 }}>
                  {s.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: top ? "#e8eddc" : "#7a8a65" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: "#5a6a45" }}>{s.won}W {s.lost}L · {diff > 0 ? "+" : ""}{diff}</div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "#c8f135" }}>{s.pts}</div>
                <div style={{ display: "flex", gap: 2 }}>
                  {s.form.slice(-5).map((f, fi) => (
                    <div key={fi} style={{ width: 14, height: 14, borderRadius: 3, background: f === "W" ? "#1a5c12" : "#5c1212", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: f === "W" ? "#6aff50" : "#ff5050" }}>{f}</div>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#3a3a3a", letterSpacing: 2 }}>pickleball-eosin.vercel.app</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="pb" onClick={download} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Download size={16} /> DOWNLOAD
          </button>
          <button className="pb" onClick={share} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "var(--color-lime)", border: "none", borderRadius: 12, color: "#0d0f0a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            📤 SHARE IMAGE
          </button>
        </div>
      </div>
    </div>
  );
}
