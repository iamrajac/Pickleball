import { useState, useEffect, useRef } from "react";
import { searchPlayers } from "../utils/playerProfile";

// Wraps the player name input with a live username search dropdown.
// If a registered player is selected, their uid/username is passed back via onLink.
export function PlayerSearchInput({ value, onChange, onLink, placeholder, style }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (value.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      const r = await searchPlayers(value);
      setResults(r);
      setOpen(r.length > 0);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (player) => {
    onChange(player.displayName || player.username);
    onLink?.(player);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); onLink?.(null); }}
        onFocus={() => results.length > 0 && setOpen(true)}
        style={{ ...style, background: "transparent", border: "none", outline: "none", width: "100%" }}
      />
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: -14, right: -14,
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
          zIndex: 300, overflow: "hidden",
        }}>
          {results.map(p => (
            <button key={p.uid} onMouseDown={() => select(p)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", background: "none", border: "none",
              cursor: "pointer", textAlign: "left",
              borderBottom: "1px solid var(--border)",
              transition: "background 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--card-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "var(--accent-dim)", border: "1px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
              }}>
                {(p.displayName || p.username)?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                  {p.displayName || p.username}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{p.username}</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: 1 }}>
                LINKED
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
