function SkeletonBox({ width = "100%", height = 16, radius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "var(--surface)",
      backgroundImage: "linear-gradient(90deg, var(--surface) 25%, var(--card-hover, #213248) 50%, var(--surface) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      flexShrink: 0,
      ...style,
    }} />
  );
}

export function TournamentCardSkeleton() {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "16px 18px",
      marginBottom: 10, position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SkeletonBox width="55%" height={18} />
        <SkeletonBox width={58} height={18} radius={12} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <SkeletonBox width={72} height={13} />
        <SkeletonBox width={96} height={13} />
      </div>
      <div style={{ marginTop: 10 }}>
        <SkeletonBox width={52} height={11} />
      </div>
    </div>
  );
}

export function MatchCardSkeleton() {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)", padding: "14px 16px",
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SkeletonBox width="40%" height={16} />
        <SkeletonBox width={40} height={16} />
        <SkeletonBox width="40%" height={16} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <SkeletonBox width={60} height={36} radius={6} />
        <SkeletonBox width={20} height={36} radius={4} />
        <SkeletonBox width={60} height={36} radius={6} />
      </div>
    </div>
  );
}
