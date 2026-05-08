// ── Schedule generator supporting any number of players ───────────────────

export function generateSchedule(players, numRounds) {
  const n = players.length;
  const courtsPerRound = Math.floor(n / 4);
  const byeCount = n % 4;

  const allGroups = [];
  for (let a = 0; a < n; a++)
    for (let b = a+1; b < n; b++)
      for (let c = b+1; c < n; c++)
        for (let d = c+1; d < n; d++)
          allGroups.push([a, b, c, d]);

  const allMatches = [];
  for (const [a,b,c,d] of allGroups) {
    allMatches.push([[a,b],[c,d]]);
    allMatches.push([[a,c],[b,d]]);
    allMatches.push([[a,d],[b,c]]);
  }

  const partnerCount = Array.from({length:n}, () => Array(n).fill(0));
  const oppCount     = Array.from({length:n}, () => Array(n).fill(0));
  const playCount    = Array(n).fill(0);
  const byeCount_p   = Array(n).fill(0);
  let lastByePlayers = new Set();

  const rounds = [];

  for (let r = 0; r < numRounds; r++) {
    let byePlayers = new Set();
    if (byeCount > 0) {
      const byeCandidates = Array.from({length:n}, (_,i)=>i)
        .sort((a,b) => {
          const aLast = lastByePlayers.has(a) ? 1000 : 0;
          const bLast = lastByePlayers.has(b) ? 1000 : 0;
          return (byeCount_p[a] + aLast) - (byeCount_p[b] + bLast);
        });
      for (let i = 0; i < byeCount; i++) byePlayers.add(byeCandidates[i]);
      byePlayers.forEach(p => byeCount_p[p]++);
      lastByePlayers = byePlayers;
    }

    const active = new Set(Array.from({length:n}, (_,i)=>i).filter(i => !byePlayers.has(i)));

    const used = new Set();
    const scored = allMatches
      .filter(([[a1,a2],[b1,b2]]) => active.has(a1)&&active.has(a2)&&active.has(b1)&&active.has(b2))
      .map(m => {
        const [[a1,a2],[b1,b2]] = m;
        const p4 = [a1,a2,b1,b2];
        if (p4.some(p => used.has(p))) return {m, s:-Infinity};
        const partnerPen = (partnerCount[a1][a2] + partnerCount[b1][b2]) * 100;
        const oppPen = ([b1,b2].flatMap(o=>[oppCount[a1][o],oppCount[a2][o]]).reduce((a,b)=>a+b,0)) * 10;
        const playPen = p4.reduce((a,p)=>a+playCount[p],0) * 5;
        const s = -(partnerPen + oppPen + playPen) + Math.random() * 2;
        return {m, s};
      })
      .sort((a,b) => b.s - a.s);

    const rm = [];
    for (const {m, s} of scored) {
      if (s === -Infinity || rm.length >= courtsPerRound) break;
      const [[a1,a2],[b1,b2]] = m;
      const p4 = [a1,a2,b1,b2];
      if (p4.some(p => used.has(p))) continue;
      rm.push(m);
      p4.forEach(p => used.add(p));
      partnerCount[a1][a2]++; partnerCount[a2][a1]++;
      partnerCount[b1][b2]++; partnerCount[b2][b1]++;
      [b1,b2].forEach(o => { oppCount[a1][o]++; oppCount[a2][o]++; oppCount[o][a1]++; oppCount[o][a2]++; });
      p4.forEach(p => playCount[p]++);
    }

    const byeNames = [...byePlayers].map(i => players[i]);
    rounds.push(rm.map(([[a1,a2],[b1,b2]]) => ({
      teamA: [players[a1], players[a2]],
      teamB: [players[b1], players[b2]],
      scoreA: null, scoreB: null, played: false, duration: null,
      bye: byeNames.length > 0 ? byeNames : null
    })));
  }

  return rounds;
}

export function computeStandings(players, rounds) {
  const s = {};
  players.forEach(p => {
    s[p] = { name: p, pts: 0, scored: 0, conceded: 0, played: 0, won: 0, lost: 0, form: [] };
  });
  if (!rounds) return [];
  rounds.forEach(r => r.forEach(m => {
    if (!m.played) return;
    const sA = Number(m.scoreA), sB = Number(m.scoreB);
    m.teamA.forEach(p => {
      if (!s[p]) return;
      s[p].played++; s[p].scored += sA; s[p].conceded += sB;
      if (sA > sB) { s[p].pts += 2; s[p].won++; s[p].form.push("W"); }
      else { s[p].lost++; s[p].form.push("L"); }
    });
    m.teamB.forEach(p => {
      if (!s[p]) return;
      s[p].played++; s[p].scored += sB; s[p].conceded += sA;
      if (sB > sA) { s[p].pts += 2; s[p].won++; s[p].form.push("W"); }
      else { s[p].lost++; s[p].form.push("L"); }
    });
  }));
  return Object.values(s).sort((a,b) => b.pts - a.pts || (b.scored-b.conceded) - (a.scored-a.conceded) || b.scored - a.scored);
}

// ── Smart Playoff Init ─────────────────────────────────────────────────────
//
// RULE: Always collapse to the nearest clean bracket size by eliminating
// bottom players directly. No match needed — they're just out by standings.
//
// Clean bracket sizes and their formats:
//   4  → Grand Final only        (1+4 vs 2+3)
//   5  → Semi + Final            (eliminate 5th)
//   6  → Q1 + Elim + Final       (no elimination)
//   7  → Q1 + Elim + Final       (eliminate 7th, same as 6)
//   8  → Full IPL                (no elimination)
//   9  → Full IPL                (eliminate 9th)
//  10  → Full IPL                (eliminate 9th+10th)
//  11  → Full IPL                (eliminate 11th)
//  12  → Top 8 bracket           (eliminate 9th-12th)
//  16  → Top 8 IPL               (eliminate 9th-16th)
//
// For 6/7: Q1(1+4 vs 2+3) → winner→Final, loser→Elim
//          Elim: Loser Q1 vs 5+6 → winner→Final
//          Final: Winner Q1 vs Winner Elim

export function initPlayoffs(standings) {
  const t = standings.map(s => s.name);
  const n = t.length;

  const mk = (tA, tB, label, note) => ({
    teamA: tA, teamB: tB, scoreA: null, scoreB: null,
    played: false, label, note
  });
  const p = (i) => t[i] || null;

  // ── 4 players ────────────────────────────────────────────────────────────
  if (n <= 4) {
    return {
      mode: "final_only",
      eliminated: [],
      final: mk([p(0),p(3)], [p(1),p(2)], "GRAND FINAL", "1st+4th vs 2nd+3rd"),
      champion: null
    };
  }

  // ── 5 players: eliminate 5th → SF + Final ────────────────────────────────
  if (n === 5) {
    return {
      mode: "elim_to_sf",
      eliminated: [p(4)],
      sf1: mk([p(0),p(3)], [p(1),p(2)], "SEMI FINAL", "1st+4th vs 2nd+3rd"),
      final: mk(null, null, "GRAND FINAL", "Winner SF vs Runner-up SF"),
      champion: null
    };
  }

  // ── 6 players: Q1 + Elim(Loser Q1 vs 5+6) + Final ───────────────────────
  if (n === 6) {
    return {
      mode: "ipl6",
      eliminated: [],
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(5)], null,         "ELIMINATOR",  "5th+6th vs Loser Q1"),
      final:mk(null, null,                "THE FINAL",   "Winner Q1 vs Winner Elim"),
      champion: null
    };
  }

  // ── 7 players: eliminate 7th → same as 6 ────────────────────────────────
  if (n === 7) {
    return {
      mode: "ipl6",
      eliminated: [p(6)],
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(5)], null,         "ELIMINATOR",  "5th+6th vs Loser Q1"),
      final:mk(null, null,                "THE FINAL",   "Winner Q1 vs Winner Elim"),
      champion: null
    };
  }

  // ── 8 players: full IPL ──────────────────────────────────────────────────
  if (n === 8) {
    return {
      mode: "ipl8",
      eliminated: [],
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(7)], [p(5),p(6)], "ELIMINATOR",  "5th+8th vs 6th+7th"),
      q2:   mk(null, null,               "QUALIFIER 2",  "Loser Q1 vs Winner Elim"),
      final:mk(null, null,               "THE FINAL",    "Winner Q1 vs Winner Q2"),
      champion: null
    };
  }

  // ── 9 players: eliminate 9th → same as 8 ────────────────────────────────
  if (n === 9) {
    return {
      mode: "ipl8",
      eliminated: [p(8)],
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(7)], [p(5),p(6)], "ELIMINATOR",  "5th+8th vs 6th+7th"),
      q2:   mk(null, null,               "QUALIFIER 2",  "Loser Q1 vs Winner Elim"),
      final:mk(null, null,               "THE FINAL",    "Winner Q1 vs Winner Q2"),
      champion: null
    };
  }

  // ── 10 players: eliminate 9th+10th → same as 8 ──────────────────────────
  if (n === 10) {
    return {
      mode: "ipl8",
      eliminated: [p(8), p(9)],
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(7)], [p(5),p(6)], "ELIMINATOR",  "5th+8th vs 6th+7th"),
      q2:   mk(null, null,               "QUALIFIER 2",  "Loser Q1 vs Winner Elim"),
      final:mk(null, null,               "THE FINAL",    "Winner Q1 vs Winner Q2"),
      champion: null
    };
  }

  // ── 11 players: eliminate 11th → same as 10 ─────────────────────────────
  if (n === 11) {
    return {
      mode: "ipl8",
      eliminated: [p(10)],
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(7)], [p(5),p(6)], "ELIMINATOR",  "5th+8th vs 6th+7th"),
      q2:   mk(null, null,               "QUALIFIER 2",  "Loser Q1 vs Winner Elim"),
      final:mk(null, null,               "THE FINAL",    "Winner Q1 vs Winner Q2"),
      champion: null
    };
  }

  // ── 12–15 players: top 8 bracket (eliminate rest) ───────────────────────
  if (n <= 15) {
    const elim = [];
    for (let i = 8; i < n; i++) elim.push(p(i));
    return {
      mode: "top8",
      eliminated: elim,
      qf1:  mk([p(0),p(3)], [p(1),p(2)],  "QF 1",         "1st+4th vs 2nd+3rd"),
      qf2:  mk([p(4),p(7)], [p(5),p(6)],  "QF 2",         "5th+8th vs 6th+7th"),
      sf1:  mk(null, null,                  "SEMI FINAL 1", "Winner QF1 vs Winner QF2"),
      sf2:  mk([p(8)??p(0),p(11)??p(3)], [p(9)??p(1),p(10)??p(2)], "SEMI FINAL 2", "9th+12th vs 10th+11th"),
      final:mk(null, null,                  "GRAND FINAL",  "Winner SF1 vs Winner SF2"),
      champion: null
    };
  }

  // ── 16–20 players: top 8 IPL (eliminate rest) ───────────────────────────
  const elim = [];
  for (let i = 8; i < n; i++) elim.push(p(i));
  return {
    mode: "top8_ipl",
    eliminated: elim,
    q1:   mk([p(0),p(3)],  [p(1),p(2)],  "QUALIFIER 1",  "1st+4th vs 2nd+3rd"),
    q2_b: mk([p(4),p(7)],  [p(5),p(6)],  "QUALIFIER 2",  "5th+8th vs 6th+7th"),
    elim: mk([p(8),p(11)], [p(9),p(10)], "ELIMINATOR",   "9th+12th vs 10th+11th"),
    sf:   mk(null, null,                   "SEMI FINAL",   "Loser Q1 vs Winner Elim"),
    final:mk(null, null,                   "THE FINAL",    "Winner Q1 vs Winner Q2"),
    champion: null
  };
}

export function genCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}
