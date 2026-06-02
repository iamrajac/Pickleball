import { ACOLORS } from "../utils/theme";

export function PlayerAvatar({ name, profile, size = 30, fallbackIndex = 0 }) {
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
    overflow: "hidden"
  };

  if (profile?.type === 'image') {
    return (
      <div style={st}>
        <img src={profile.value} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  if (profile?.type === 'emoji') {
    return <div style={st}>{profile.value}</div>;
  }

  return (
    <div style={st}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}
