import { PlayerAvatar } from "./PlayerAvatar";
import { getGlobalProfiles } from "../utils/globalProfiles";
import { normalizePlayerName } from "../utils/players";

// ── Team display ─────────────────────────────────────────────────────────────
function TeamBox({ team, score, isWinner, isLeft }) {
  const gp = getGlobalProfiles();
  if (!team) return <div style={{ height: 44 }} />;
  const names = Array.isArray(team) ? team : [team];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 10px", borderRadius: 8, minHeight: 44,
      background: isWinner ? "var(--accent-dim)" : "var(--surface)",
      border: `1.5px solid ${isWinner ? "var(--accent)" : "var(--border)"}`,
      flexDirection: isLeft ? "row" : "row-reverse",
      transition: "all 0.3s",
    }}>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {names.slice(0, 2).map((n, i) => (
          <PlayerAvatar key={i} name={n} profile={gp[normalizePlayerName(n)]} size={24} fallbackIndex={i} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: isLeft ? "left" : "right" }}>
        {names.map((n, i) => (
          <div key={i} style={{ fontSize: 12, fontWeight: 600, color: isWinner ? "var(--accent)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{n}</div>
        ))}
      </div>
      {score !== null && score !== undefined && (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: isWinner ? "var(--accent)" : "var(--text-muted)", letterSpacing: 1, flexShrink: 0 }}>
          {score}
        </div>
      )}
    </div>
  );
}

// ── Single match card ─────────────────────────────────────────────────────────
function MatchBox({ match, label, accent }) {
  if (!match) return null;
  const { teamA, teamB, scoreA, scoreB, played } = match;
  const aWin = played && Number(scoreA) > Number(scoreB);
  const bWin = played && Number(scoreB) > Number(scoreA);

  return (
    <div style={{
      background: "var(--card)", border: `1px solid ${played ? (accent || "var(--accent)") : "var(--border)"}`,
      borderRadius: 12, padding: 10, width: 220, flexShrink: 0,
      boxShadow: played ? "0 2px 12px rgba(16,212,142,0.12)" : "var(--shadow-sm)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: accent || "var(--accent)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <TeamBox team={teamA} score={played ? scoreA : null} isWinner={aWin} isLeft />
        <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
        <TeamBox team={teamB} score={played ? scoreB : null} isWinner={bWin} isLeft />
      </div>
    </div>
  );
}

// ── Connector SVG line between rounds ─────────────────────────────────────────
function Connector({ fromTop, fromBottom, toMid, height }) {
  const midX = 28;
  return (
    <svg width={56} height={height} style={{ flexShrink: 0 }}>
      <path
        d={`M 0 ${fromTop} L ${midX} ${fromTop} L ${midX} ${fromBottom} L 0 ${fromBottom}`}
        fill="none" stroke="var(--border)" strokeWidth={1.5} />
      <line x1={midX} y1={(fromTop + fromBottom) / 2} x2={56} y2={toMid}
        stroke="var(--border)" strokeWidth={1.5} />
    </svg>
  );
}

// ── Round column ──────────────────────────────────────────────────────────────
function RoundCol({ matches, labels, accents }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", height: "100%" }}>
      {matches.map((m, i) => m && (
        <MatchBox key={i} match={m} label={labels[i]} accent={accents?.[i]} />
      ))}
    </div>
  );
}

// ── Top 8 classic bracket ─────────────────────────────────────────────────────
function Top8Bracket({ playoffs }) {
  const { qf1, qf2, qf3, qf4, sf1, sf2, final, champion } = playoffs;
  const rowH = 120;
  const totalH = rowH * 4;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, minWidth: 900, height: totalH, padding: "8px 0" }}>
        {/* QF column */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", height: "100%" }}>
          {[{m:qf1,l:"QF 1"},{m:qf2,l:"QF 2"},{m:qf3,l:"QF 3"},{m:qf4,l:"QF 4"}].map(({m,l},i) => (
            <div key={i} style={{ height: rowH, display: "flex", alignItems: "center" }}>
              <MatchBox match={m} label={l} />
            </div>
          ))}
        </div>
        {/* QF→SF connectors */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Connector fromTop={rowH * 0.5} fromBottom={rowH * 1.5} toMid={rowH} height={rowH * 2} />
          <Connector fromTop={rowH * 0.5} fromBottom={rowH * 1.5} toMid={rowH} height={rowH * 2} />
        </div>
        {/* SF column */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", height: "100%" }}>
          {[{m:sf1,l:"SEMI FINAL 1",a:"var(--gold)"},{m:sf2,l:"SEMI FINAL 2",a:"var(--gold)"}].map(({m,l,a},i) => (
            <div key={i} style={{ height: rowH * 2, display: "flex", alignItems: "center" }}>
              <MatchBox match={m} label={l} accent={a} />
            </div>
          ))}
        </div>
        {/* SF→Final connector */}
        <div style={{ height: "100%" }}>
          <Connector fromTop={rowH} fromBottom={rowH * 3} toMid={rowH * 2} height={totalH} />
        </div>
        {/* Final */}
        <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <MatchBox match={final} label="🏆 GRAND FINAL" accent="var(--accent)" />
        </div>
      </div>
    </div>
  );
}

// ── IPL8 bracket ──────────────────────────────────────────────────────────────
function IPL8Bracket({ playoffs }) {
  const { q1, elim, q2, final, champion } = playoffs;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MatchBox match={q1} label="QUALIFIER 1" accent="var(--accent)" />
        <MatchBox match={elim} label="ELIMINATOR" accent="var(--upcoming)" />
      </div>
      {q2 && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MatchBox match={q2} label="QUALIFIER 2" accent="var(--gold)" />
        </div>
      )}
      {final && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MatchBox match={final} label="🏆 THE FINAL" accent="var(--accent)" />
        </div>
      )}
      {champion && (
        <div className="fu" style={{ textAlign: "center", padding: "1.5rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🏆</div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "var(--accent)", fontWeight: 700 }}>CHAMPION</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--accent)", letterSpacing: 2 }}>{champion}</div>
        </div>
      )}
    </div>
  );
}

// ── Simple 2-round (SF + Final) ───────────────────────────────────────────────
function SimpleBracket({ playoffs }) {
  const { sf1, final, q1, final: fin, champion } = playoffs;
  const semi = sf1 || q1;
  const grand = final || fin;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {semi && <MatchBox match={semi} label="SEMI FINAL" accent="var(--gold)" />}
      {grand && <MatchBox match={grand} label="🏆 GRAND FINAL" accent="var(--accent)" />}
      {champion && (
        <div style={{ textAlign: "center", padding: "1rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--accent)", letterSpacing: 2 }}>🏆 {champion}</div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function BracketTree({ playoffs, profiles }) {
  if (!playoffs) return null;
  const mode = playoffs.mode || "ipl8";

  if (mode === "top8" || mode === "top8_ipl") return <Top8Bracket playoffs={playoffs} />;
  if (mode === "ipl8" || mode === "ipl6") return <IPL8Bracket playoffs={playoffs} />;
  return <SimpleBracket playoffs={playoffs} />;
}
