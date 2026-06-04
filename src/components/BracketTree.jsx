import { PlayerAvatar } from "./PlayerAvatar";
import { getGlobalProfiles } from "../utils/globalProfiles";
import { normalizePlayerName } from "../utils/players";

// ── Team row inside a match ───────────────────────────────────────────────────
function TeamRow({ team, score, isWinner }) {
  const gp = getGlobalProfiles();
  if (!team) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "var(--surface)", border: "1px dashed var(--border)", opacity: 0.5 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--border)" }} />
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>TBD</div>
    </div>
  );
  const names = Array.isArray(team) ? team : [team];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
      borderRadius: 6, transition: "all 0.3s",
      background: isWinner ? "var(--accent-dim)" : "var(--surface)",
      border: `1.5px solid ${isWinner ? "var(--accent)" : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {names.slice(0, 2).map((n, i) => (
          <PlayerAvatar key={i} name={n} profile={gp[normalizePlayerName(n)]} size={22} fallbackIndex={i} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: isWinner ? "var(--accent)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {names.join(" & ")}
        </div>
      </div>
      {score != null && (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: isWinner ? "var(--accent)" : "var(--text-muted)", letterSpacing: 1, flexShrink: 0, minWidth: 20, textAlign: "right" }}>
          {score}
        </div>
      )}
      {isWinner && <div style={{ fontSize: 14, flexShrink: 0 }}>✓</div>}
    </div>
  );
}

// ── Single match card ─────────────────────────────────────────────────────────
function MatchCard({ match, label, accent, sublabel }) {
  if (!match) return null;
  const { teamA, teamB, scoreA, scoreB, played } = match;
  const aWin = played && Number(scoreA) > Number(scoreB);
  const bWin = played && Number(scoreB) > Number(scoreA);

  return (
    <div style={{
      background: "var(--card)", borderRadius: 12, overflow: "hidden",
      border: `1px solid ${played ? (accent || "var(--accent)") : "var(--border)"}`,
      boxShadow: played ? `0 0 0 1px ${accent || "var(--accent)"}22` : "var(--shadow-sm)",
    }}>
      <div style={{
        padding: "6px 12px", background: played ? `${accent || "var(--accent)"}18` : "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: accent || "var(--accent)" }}>{label}</div>
        {sublabel && <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>{sublabel}</div>}
        {played && <div style={{ fontSize: 9, color: "var(--accent)", fontWeight: 700, letterSpacing: 1 }}>DONE</div>}
      </div>
      <div style={{ padding: "8px 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
        <TeamRow team={teamA} score={played ? scoreA : null} isWinner={aWin} />
        <div style={{ textAlign: "center", fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1 }}>VS</div>
        <TeamRow team={teamB} score={played ? scoreB : null} isWinner={bWin} />
      </div>
    </div>
  );
}

// ── Flow arrow connector ──────────────────────────────────────────────────────
function Arrow({ label, color, dimmed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", opacity: dimmed ? 0.4 : 1 }}>
      <div style={{ width: 2, height: 20, background: color || "var(--border)", borderRadius: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: color || "var(--text-muted)", letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

// ── IPL8 flow diagram ─────────────────────────────────────────────────────────
function IPL8Bracket({ playoffs }) {
  const { q1, elim, q2, final, champion } = playoffs;
  const q1Done = q1?.played;
  const elimDone = elim?.played;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Row 1: Q1 and Eliminator side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MatchCard match={q1} label="QUALIFIER 1" accent="var(--accent)" sublabel="2 chances to Final" />
        <MatchCard match={elim} label="ELIMINATOR" accent="var(--upcoming)" sublabel="1 chance — must win" />
      </div>

      {/* Flow labels from Q1 and Elim */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <Arrow label="WINNER → FINAL" color="var(--accent)" />
          <Arrow label="LOSER → Q2" color="var(--gold)" dimmed={!q1Done} />
        </div>
        <div>
          <Arrow label="WINNER → Q2" color="var(--gold)" dimmed={!elimDone} />
          <Arrow label="LOSER → ELIMINATED" color="var(--danger)" dimmed={!elimDone} />
        </div>
      </div>

      {/* Q2 */}
      {(q2 || (q1Done && elimDone)) && (
        <div style={{ maxWidth: "50%", margin: "0 auto", width: "100%" }}>
          <MatchCard match={q2} label="QUALIFIER 2" accent="var(--gold)" sublabel="Last chance for Final" />
          <Arrow label="WINNER → FINAL" color="var(--accent)" dimmed={!q2?.played} />
          <Arrow label="LOSER → ELIMINATED" color="var(--danger)" dimmed={!q2?.played} />
        </div>
      )}

      {/* Final */}
      {final && (
        <div style={{ marginTop: 4 }}>
          <MatchCard match={final} label="🏆 THE FINAL" accent="var(--accent)" sublabel="Winner(Q1) vs Winner(Q2)" />
        </div>
      )}

      {/* Champion */}
      {champion && (
        <div className="fu" style={{ textAlign: "center", padding: "1.25rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12, marginTop: 8 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: "var(--accent)", fontWeight: 700 }}>CHAMPION</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--accent)", letterSpacing: 2 }}>{champion}</div>
        </div>
      )}
    </div>
  );
}

// ── IPL6 bracket ──────────────────────────────────────────────────────────────
function IPL6Bracket({ playoffs }) {
  const { q1, elim, final, champion } = playoffs;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <MatchCard match={q1} label="QUALIFIER 1" accent="var(--accent)" sublabel="Top 2 — 2 chances" />
        <MatchCard match={elim} label="ELIMINATOR" accent="var(--upcoming)" sublabel="Must win to survive" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <Arrow label="WINNER → FINAL" color="var(--accent)" />
          <Arrow label="LOSER → ELIMINATED" color="var(--danger)" dimmed={!q1?.played} />
        </div>
        <div>
          <Arrow label="WINNER → FINAL" color="var(--accent)" dimmed={!elim?.played} />
          <Arrow label="LOSER → ELIMINATED" color="var(--danger)" dimmed={!elim?.played} />
        </div>
      </div>
      {final && <MatchCard match={final} label="🏆 THE FINAL" accent="var(--accent)" />}
      {champion && (
        <div style={{ textAlign: "center", padding: "1rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12, marginTop: 8 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--accent)", letterSpacing: 2 }}>🏆 {champion}</div>
        </div>
      )}
    </div>
  );
}

// ── Top 8 classic bracket ─────────────────────────────────────────────────────
function Top8Bracket({ playoffs }) {
  const { qf1, qf2, qf3, qf4, sf1, sf2, final, champion } = playoffs;

  const QFPair = ({ mA, lA, mB, lB, sf, sfLabel }) => (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {/* QF column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <MatchCard match={mA} label={lA} />
        <MatchCard match={mB} label={lB} />
      </div>
      {/* connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 4px" }}>
        <div style={{ width: 1, flex: 1, background: "var(--border)" }} />
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>WINNER</div>
        <div style={{ width: 1, flex: 1, background: "var(--border)" }} />
      </div>
      {/* SF */}
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <MatchCard match={sf} label={sfLabel} accent="var(--gold)" />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <QFPair mA={qf1} lA="QF 1" mB={qf2} lB="QF 2" sf={sf1} sfLabel="SEMI FINAL 1" />
      <Arrow label="WINNER → FINAL" color="var(--accent)" />
      <QFPair mA={qf3} lA="QF 3" mB={qf4} lB="QF 4" sf={sf2} sfLabel="SEMI FINAL 2" />
      <Arrow label="WINNER → FINAL" color="var(--accent)" />
      {final && <MatchCard match={final} label="🏆 GRAND FINAL" accent="var(--accent)" />}
      {champion && (
        <div style={{ textAlign: "center", padding: "1rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--accent)", letterSpacing: 2 }}>🏆 {champion}</div>
        </div>
      )}
    </div>
  );
}

// ── Simple (SF + Final or just Final) ────────────────────────────────────────
function SimpleBracket({ playoffs }) {
  const { sf1, q1, final, champion } = playoffs;
  const semi = sf1 || q1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {semi && <>
        <MatchCard match={semi} label="SEMI FINAL" accent="var(--gold)" />
        <Arrow label="WINNER → FINAL" color="var(--accent)" />
      </>}
      {final && <MatchCard match={final} label="🏆 GRAND FINAL" accent="var(--accent)" />}
      {champion && (
        <div style={{ textAlign: "center", padding: "1rem", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--accent)", letterSpacing: 2 }}>🏆 {champion}</div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function BracketTree({ playoffs }) {
  if (!playoffs) return null;
  const mode = playoffs.mode || "ipl8";
  if (mode === "top8" || mode === "top8_ipl") return <Top8Bracket playoffs={playoffs} />;
  if (mode === "ipl8") return <IPL8Bracket playoffs={playoffs} />;
  if (mode === "ipl6") return <IPL6Bracket playoffs={playoffs} />;
  return <SimpleBracket playoffs={playoffs} />;
}
