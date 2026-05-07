import { useRef } from "react";
import { X, Image as ImageIcon, Trash2 } from "lucide-react";
import { ACOLORS } from "../utils/theme";

const POPULAR_EMOJIS = [
  "😎", "🔥", "🚀", "👑", "🦄", "🐼", "🦊", "🐯", "🦖", "👽", "👻", "🤖",
  "⚽", "🎾", "🏓", "⚡", "🌟", "🍔", "🍕", "🎸", "🎮"
];

export function AvatarPickerModal({ name, currentProfile, onSave, onClose }) {
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_SIZE = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        onSave({ ...currentProfile, type: "image", value: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20 }}>
      <div className="glass-card fu" style={{ width: "100%", maxWidth: 360, borderRadius: "var(--radius-lg)", padding: 24, position: "relative" }}>
        <button onClick={onClose} className="pb" style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "var(--color-muted)" }}><X size={24} /></button>
        
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: "var(--color-lime)", marginBottom: 20 }}>CUSTOMIZE {name}</div>
        
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--color-muted)", marginBottom: 8, fontWeight: 600 }}>1. CHOOSE COLOR</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ACOLORS.map(c => (
              <div key={c} onClick={() => onSave({ ...currentProfile, type: currentProfile?.type === 'image' ? null : currentProfile?.type, color: c })} className="pb" style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: currentProfile?.color === c ? "2px solid white" : "none", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--color-muted)", marginBottom: 8, fontWeight: 600 }}>2. CHOOSE EMOJI</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {POPULAR_EMOJIS.map(e => (
              <div key={e} onClick={() => onSave({ ...currentProfile, type: "emoji", value: e })} className="pb" style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer", border: currentProfile?.value === e ? "1px solid var(--color-lime)" : "1px solid var(--color-border)" }}>{e}</div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--color-muted)", marginBottom: 8, fontWeight: 600 }}>3. OR UPLOAD PHOTO</div>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleImageUpload} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pb" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: 12, background: "var(--color-surface)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
              <ImageIcon size={18} /> GALLERY
            </button>
            {currentProfile?.type && (
              <button className="pb" onClick={() => onSave({})} style={{ padding: "0 16px", background: "rgba(255,85,85,0.1)", border: "1px solid rgba(255,85,85,0.3)", borderRadius: "var(--radius-sm)", color: "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Reset to default">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
