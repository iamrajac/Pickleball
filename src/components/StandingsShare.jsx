import { useRef } from "react";
import { Download, X } from "lucide-react";
import html2canvas from "html2canvas";

const ACOLORS = ["#c8f135","#35c8f1","#f1c835","#f13565","#a78bfa","#f18835","#35f165","#c835f1"];

// Reuse same badge logic as StandingsTable
function getPlayoffBadge(name, playoffs, champion) {
  if (!playoffs) return null;
  if (champion && (champion === name || champion.includes(name))) return { symbol: "🏆", color: "#f1c835" };
  if (playoffs.final?.played) {
    const winA = playoffs.final.scoreA > playoffs.final.scoreB;
    const losers = winA ? playoffs.final.teamB : playoffs.final.teamA;
    if (losers?.includes(name)) return { symbol: "🥈", color: "#94a3b8" };
  }
  const mode = playoffs.mode;
  const checkMatch = (match) => {
    if (!match?.played) return false;
    const winA = match.scoreA > match.scoreB;
    return (winA ? match.teamB : match.teamA)?.includes(name);
  };
  if (mode === "elim_to_sf" && checkMatch(playoffs.sf1)) return { symbol: "🥉", color: "#cd7f32" };
  if (mode === "ipl6" && checkMatch(playoffs.elim)) return { symbol: "🥉", color: "#cd7f32" };
  if (mode === "ipl8" && checkMatch(playoffs.q2)) return { symbol: "🥉", color: "#cd7f32" };
  if (mode === "top8" && (checkMatch(playoffs.sf1) || checkMatch(playoffs.sf2))) return { symbol: "🥉", color: "#cd7f32" };
  if (mode === "top8_ipl" && checkMatch(playoffs.sf)) return { symbol: "🥉", color: "#cd7f32" };
  const eliminated = playoffs.eliminated || [];
  if (eliminated.includes(name)) return { symbol: "E", color: "#ef4444", isE: true };
  return null;
}

export function StandingsShareModal({ standings, onClose, playoffs = null, champion = null }) {
  const cardRef = useRef(null);
  const hasPlayoffs = !!(playoffs && (champion || playoffs.champion));

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
        <button onClick={onClose} style={{ position: "absolute", top: -40, right: 0, background: "none", border: "none", cursor: "pointer", color: "#7a8a65" }}>
          <X size={24} />
        </button>

        {/* Shareable card */}
        <div ref={cardRef} style={{ background: "#0d0f0a", borderRadius: 20, padding: "1.5rem", border: "1px solid rgba(200,241,53,0.3)" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "#c8f135", letterSpacing: 3, lineHeight: 1 }}>PICKLEBALL</div>
              <div style={{ fontSize: 10, color: "#7a8a65", letterSpacing: 2 }}>{hasPlayoffs ? "FINAL RESULTS" : "STANDINGS"}</div>
            </div>
            <div style={{ fontSize: 32 }}>🏓</div>
          </div>

          {/* Champion banner */}
          {hasPlayoffs && (champion || playoffs.champion) && (
            <div style={{ background: "rgba(241,200,53,0.15)", border: "1px solid rgba(241,200,53,0.4)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏆</span>
              <div>
                <div style={{ fontSize: 9, color: "#f1c835", letterSpacing: 2, fontWeight: 700 }}>TOURNAMENT CHAMPIONS</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#f1c835", letterSpacing: 2, lineHeight: 1.2 }}>{champion || playoffs.champion}</div>
              </div>
            </div>
          )}

          {/* Player rows */}
          {standings.map((s, i) => {
            const diff = s.scored - s.conceded;
            const top = i < 4;
            const badge = getPlayoffBadge(s.name, playoffs, champion);
            const isElim = badge?.isE;
            const isChamp = badge?.symbol === "🏆";
            const isRunner = badge?.symbol === "🥈";
            const is3rd = badge?.symbol === "🥉";

            const rowBg = isChamp ? "rgba(241,200,53,0.12)" :
                          isRunner ? "rgba(148,163,184,0.08)" :
                          is3rd ? "rgba(205,127,50,0.08)" :
                          isElim ? "rgba(239,68,68,0.06)" :
                          top ? "rgba(200,241,53,0.06)" : "rgba(255,255,255,0.02)";
            const rowBorder = isChamp ? "1px solid rgba(241,200,53,0.3)" :
                              isElim ? "1px solid rgba(239,68,68,0.2)" :
                              top ? "1px solid rgba(200,241,53,0.15)" : "1px solid rgba(255,255,255,0.04)";

            return (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: rowBg, marginBottom: 5, border: rowBorder, opacity: isElim ? 0.55 : 1 }}>
                {/* Rank / badge */}
                <div style={{ width: 28, textAlign: "center", flexShrink: 0 }}>
                  {badge && !badge.isE ? (
                    <span style={{ fontSize: 18 }}>{badge.symbol}</span>
                  ) : (
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: i === 0 ? "#c8f135" : i < 4 ? "#5a6a45" : "#3a3a3a" }}>{i + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: ACOLORS[i % ACOLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#0d0f0a", flexShrink: 0 }}>
                  {s.name[0]?.toUpperCase()}
                </div>

                {/* Name + record */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isElim ? "#ef4444" : top ? "#e8eddc" : "#7a8a65", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isElim ? "line-through" : "none" }}>{s.name}</span>
                    {isElim && <span style={{ fontSize: 8, background: "rgba(239,68,68,0.3)", color: "#ef4444", padding: "1px 4px", borderRadius: 3, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>E</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#5a6a45" }}>{s.won}W {s.lost}L · {diff > 0 ? "+" : ""}{diff}</div>
                </div>

                {/* Points */}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: isChamp ? "#f1c835" : isElim ? "#5a3a3a" : "#c8f135", flexShrink: 0 }}>{s.pts}</div>

                {/* Form tiles */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {s.form.slice(-5).map((f, fi) => (
                    <div key={fi} style={{ width: 13, height: 13, borderRadius: 3, background: f === "W" ? "#1a5c12" : "#5c1212", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: f === "W" ? "#6aff50" : "#ff5050" }}>{f}</div>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 14, textAlign: "center", fontSize: 10, color: "#3a3a3a", letterSpacing: 2 }}>pickleball-eosin.vercel.app</div>
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
