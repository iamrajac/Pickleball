import { useState, useEffect, useRef } from "react";
import { ref, push, onValue, remove } from "firebase/database";
import { db } from "../firebase";
import { X, ChevronDown, ChevronUp, Megaphone } from "lucide-react";

export function Announcements({ code, readOnly, scorerName = "Organizer" }) {
  const [announcements, setAnnouncements] = useState([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!code) return;
    const r = ref(db, `tournaments/${code}/announcements`);
    const unsub = onValue(r, (snap) => {
      const data = snap.val();
      if (!data) { setAnnouncements([]); return; }
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.ts - a.ts);
      setAnnouncements(list);
    });
    return () => unsub();
  }, [code]);

  // Track unread badge
  useEffect(() => {
    if (open) {
      setSeenCount(announcements.length);
      prevCountRef.current = announcements.length;
    }
  }, [open, announcements.length]);

  const unread = announcements.length - seenCount;

  const post = () => {
    const t = text.trim().slice(0, 200);
    if (!t) return;
    push(ref(db, `tournaments/${code}/announcements`), {
      text: t, ts: Date.now(), authorName: scorerName,
    });
    setText("");
  };

  const deleteAnn = (id) => {
    remove(ref(db, `tournaments/${code}/announcements/${id}`));
  };

  const relTime = (ts) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ margin: "0 0 8px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-surface)", overflow: "hidden" }}>
      {/* Header */}
      <button className="pb" onClick={() => { setOpen(o => !o); if (!open) setSeenCount(announcements.length); }}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: "var(--color-text)" }}>
        <Megaphone size={14} color="var(--color-gold)" />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5, color: "var(--color-gold)" }}>ANNOUNCEMENTS</span>
        {unread > 0 && (
          <span style={{ background: "var(--color-danger)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px", lineHeight: 1.4 }}>{unread}</span>
        )}
        {announcements.length > 0 && <span style={{ fontSize: 11, color: "var(--color-muted)", marginLeft: 2 }}>({announcements.length})</span>}
        <span style={{ marginLeft: "auto", color: "var(--color-muted)" }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          {/* Post input (organizer only) */}
          {!readOnly && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={text}
                onChange={e => setText(e.target.value.slice(0, 200))}
                onKeyDown={e => e.key === "Enter" && post()}
                placeholder="Post an announcement..."
                style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", padding: "8px 10px", fontSize: 12 }}
              />
              <button className="pb" onClick={post} disabled={!text.trim()}
                style={{ padding: "8px 14px", background: text.trim() ? "var(--color-gold)" : "rgba(245,158,11,0.2)", border: "none", borderRadius: "var(--radius-sm)", color: text.trim() ? "#000" : "var(--color-muted)", fontWeight: 700, fontSize: 12, cursor: text.trim() ? "pointer" : "not-allowed" }}>
                POST
              </button>
            </div>
          )}

          {/* Feed */}
          {announcements.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--color-muted)", textAlign: "center", padding: "12px 0" }}>No announcements yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {announcements.map(a => (
                <div key={a.id} style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "8px 10px", position: "relative", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-gold)" }}>{a.authorName}</span>
                    <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{relTime(a.ts)}</span>
                    {!readOnly && (
                      <button className="pb" onClick={() => deleteAnn(a.id)}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 2, display: "flex" }}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>{a.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
