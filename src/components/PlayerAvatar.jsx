import { useState } from "react";
import { ACOLORS } from "../utils/theme";

function AvatarOverlay({ name, profile, color, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: 220, height: 220, borderRadius: "50%", flexShrink: 0,
        background: profile?.type === "image" ? "var(--color-surface)" : color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 100, fontWeight: 700, color: "var(--color-dark)",
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>
        {profile?.type === "image" || profile?.photo ? (
          <img src={profile.value || profile.photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : profile?.type === "emoji" ? (
          profile.value
        ) : (
          name?.[0]?.toUpperCase() || "?"
        )}
      </div>
    </div>
  );
}

export function PlayerAvatar({ name, profile, size = 30, fallbackIndex = 0, expandable = false }) {
  const [expanded, setExpanded] = useState(false);

  const getFallbackColor = () => {
    if (profile?.color) return profile.color;
    if (fallbackIndex !== undefined && fallbackIndex !== null) return ACOLORS[fallbackIndex % ACOLORS.length];
    let hash = 0;
    if (!name) return ACOLORS[0];
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return ACOLORS[Math.abs(hash) % ACOLORS.length];
  };

  const color = getFallbackColor();
  const radius = "50%";
  const st = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    background: profile?.type === 'image' ? 'var(--color-surface)' : color,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.45, fontWeight: 700, color: 'var(--color-dark)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    overflow: "hidden",
    cursor: expandable ? "pointer" : undefined,
  };

  const handleClick = expandable ? (e) => { e.stopPropagation(); setExpanded(true); } : undefined;

  return (
    <>
      <div style={st} onClick={handleClick}>
        {profile?.type === 'image' || profile?.photo ? (
          <img src={profile.value || profile.photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : profile?.type === 'emoji' ? (
          profile.value
        ) : (
          name?.[0]?.toUpperCase() || "?"
        )}
      </div>
      {expanded && (
        <AvatarOverlay name={name} profile={profile} color={color} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}
