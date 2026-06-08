import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, query, limitToLast } from "firebase/database";
import { db } from "../firebase";
import { X, Send } from "lucide-react";

const MAX_MESSAGES = 500;
const QUICK_EMOJIS = ["👍", "🎉", "🔥", "😮"];

export function TournamentChat({ code, readOnly, currentUserName, isOrganizer, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!code) return;
    const r = query(ref(db, `tournaments/${code}/chat`), limitToLast(MAX_MESSAGES));
    const unsub = onValue(r, (snap) => {
      const data = snap.val();
      if (!data) { setMessages([]); return; }
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => a.ts - b.ts);
      setMessages(list);
    });
    return () => unsub();
  }, [code]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (msg) => {
    const t = (msg || text).trim().slice(0, 500);
    if (!t) return;
    push(ref(db, `tournaments/${code}/chat`), {
      text: t, authorName: currentUserName || "Guest", ts: Date.now(), isOrganizer: !!isOrganizer,
    });
    setText("");
  };

  const relTime = (ts) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderRadius: "20px 20px 0 0", maxHeight: "75vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: "#34d399" }}>MATCH CHAT</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--color-muted)", fontSize: 13, padding: "2rem 0" }}>No messages yet — say hi! 👋</div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: m.isOrganizer ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: m.isOrganizer ? "#34d399" : "var(--color-muted)", flexShrink: 0 }}>
                {(m.authorName || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.isOrganizer ? "#34d399" : "var(--color-text)" }}>{m.authorName}</span>
                  {m.isOrganizer && (
                    <span style={{ fontSize: 9, background: "rgba(52,211,153,0.2)", color: "#34d399", borderRadius: 4, padding: "1px 5px", fontWeight: 700, letterSpacing: 1 }}>ORGANIZER</span>
                  )}
                  <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{relTime(m.ts)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.4, wordBreak: "break-word" }}>{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick emojis */}
        <div style={{ display: "flex", gap: 8, padding: "8px 14px 0", borderTop: "1px solid var(--color-border)" }}>
          {QUICK_EMOJIS.map(e => (
            <button key={e} className="pb" onClick={() => send(e)}
              style={{ fontSize: 20, background: "none", border: "1px solid var(--color-border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
              {e}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 8, padding: "10px 14px 16px" }}>
          <input
            value={text}
            onChange={e => setText(e.target.value.slice(0, 500))}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder={`Message as ${currentUserName || "Guest"}...`}
            style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", padding: "10px 12px", fontSize: 13 }}
          />
          <button className="pb" onClick={() => send()} disabled={!text.trim()}
            style={{ padding: "10px 14px", background: text.trim() ? "#34d399" : "rgba(52,211,153,0.2)", border: "none", borderRadius: "var(--radius-sm)", color: text.trim() ? "#000" : "var(--color-muted)", cursor: text.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center" }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
