import { useState, useEffect, useRef } from "react";
import { ref, push, onValue } from "firebase/database";
import { db } from "../firebase";

const EMOJIS = ["🔥", "👏", "💪", "😮", "🎉", "👑", "⚡", "🏓"];

export function ReactionsOverlay({ code }) {
  const [open, setOpen] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const timerRef = useRef(null);

  // Listen for reactions from Firebase
  useEffect(() => {
    if (!code) return;
    const r = ref(db, `reactions/${code}`);
    let lastKeys = new Set();

    const unsub = onValue(r, snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      const entries = Object.entries(data);
      const newEntries = entries.filter(([k]) => !lastKeys.has(k));
      entries.forEach(([k]) => lastKeys.add(k));

      newEntries.forEach(([k, v]) => {
        // only show if recent (last 3s)
        if (Date.now() - (v.ts || 0) < 3000) {
          addFloater(v.emoji, k);
        }
      });
    });
    return () => unsub();
  }, [code]);

  const addFloater = (emoji, key) => {
    const id = key || Date.now() + Math.random();
    const x = 20 + Math.random() * 60; // random horizontal %
    setFloaters(f => [...f, { id, emoji, x }]);
    setTimeout(() => setFloaters(f => f.filter(item => item.id !== id)), 2000);
  };

  const sendReaction = (emoji) => {
    if (!code) return;
    push(ref(db, `reactions/${code}`), { emoji, ts: Date.now() });
    // show locally immediately
    addFloater(emoji, "local-" + Date.now());
    // close picker after 5s auto, or reset timer
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), 5000);
  };

  const handleToggle = () => {
    setOpen(o => {
      const next = !o;
      if (next) {
        // auto-close after 5s
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setOpen(false), 5000);
      }
      return next;
    });
  };

  return (
    <>
      {/* Floating emojis */}
      <div style={{ position: "fixed", bottom: 80, right: 0, left: 0, pointerEvents: "none", zIndex: 400, overflow: "hidden", height: 200 }}>
        {floaters.map(f => (
          <div key={f.id} style={{
            position: "absolute", bottom: 0, left: `${f.x}%`,
            fontSize: 32, animation: "reactionFloat 2s ease-out forwards",
            userSelect: "none"
          }}>
            {f.emoji}
          </div>
        ))}
      </div>

      {/* Emoji picker — expands upward */}
      <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {open && (
          <div className="fu glass-card" style={{ borderRadius: 50, padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 220, justifyContent: "center", border: "1px solid var(--color-border)" }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => sendReaction(e)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 26, padding: "4px 6px", borderRadius: 8,
                transition: "transform 0.1s",
                lineHeight: 1,
              }}
                onMouseDown={el => el.currentTarget.style.transform = "scale(0.8)"}
                onMouseUp={el => el.currentTarget.style.transform = "scale(1)"}
                onTouchStart={el => el.currentTarget.style.transform = "scale(0.8)"}
                onTouchEnd={el => el.currentTarget.style.transform = "scale(1)"}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Main toggle button */}
        <button onClick={handleToggle} style={{
          width: 52, height: 52, borderRadius: "50%",
          background: open ? "var(--color-lime)" : "rgba(13,15,10,0.9)",
          border: `2px solid ${open ? "var(--color-lime)" : "var(--color-border)"}`,
          backdropFilter: "blur(16px)",
          fontSize: 24, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s", transform: open ? "rotate(15deg)" : "none",
          boxShadow: open ? "0 0 20px rgba(200,241,53,0.4)" : "0 4px 16px rgba(0,0,0,0.5)",
        }}>
          🏓
        </button>
      </div>
    </>
  );
}
