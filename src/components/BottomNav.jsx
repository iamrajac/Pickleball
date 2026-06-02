import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { path: "/",        icon: HomeIcon,    label: "HOME"    },
  { path: "/history", icon: HistoryIcon, label: "HISTORY" },
  { path: "/career",  icon: StatsIcon,   label: "STATS"   },
  { path: "/account", icon: PersonIcon,  label: "ACCOUNT" },
];

export function BottomNav() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = pathname === path || (path !== "/" && pathname.startsWith(path));
        return (
          <button key={path} className={`bottom-nav-item${active ? " active" : ""}`}
            onClick={() => navigate(path)}>
            <Icon size={22} active={active} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── SVG icons (inline, no dependency) ── */
function HomeIcon({ size, active }) {
  const c = active ? "var(--accent)" : "var(--text-muted)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {active
        ? <path fill={c} stroke="none" d="M3 12l9-9 9 9v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        : <><path d="M3 12l9-9 9 9v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><polyline points="9 22 9 12 15 12 15 22" /></>
      }
    </svg>
  );
}
function HistoryIcon({ size, active }) {
  const c = active ? "var(--accent)" : "var(--text-muted)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill={active ? c : "none"} fillOpacity={active ? 0.15 : 0} />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function StatsIcon({ size, active }) {
  const c = active ? "var(--accent)" : "var(--text-muted)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}
function PersonIcon({ size, active }) {
  const c = active ? "var(--accent)" : "var(--text-muted)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" fill={active ? c : "none"} fillOpacity={active ? 0.2 : 0} />
    </svg>
  );
}
