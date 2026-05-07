// ── Schedule generator supporting any number of players ───────────────────
// For non-multiples of 4, players sit out (bye) in rotation

export function generateSchedule(players, numRounds) {
  const n = players.length;
  const courtsPerRound = Math.floor(n / 4); // how many 2v2 matches fit per round
  const byeCount = n % 4; // how many players sit out per round (0,1,2,3)

  // Build all possible 4-player group combos
  const allGroups = [];
  for (let a = 0; a < n; a++)
    for (let b = a+1; b < n; b++)
      for (let c = b+1; c < n; c++)
        for (let d = c+1; d < n; d++)
          allGroups.push([a, b, c, d]);

  // For each group, enumerate both match arrangements: (ab vs cd) and (ac vs bd)
  const allMatches = [];
  for (const [a,b,c,d] of allGroups) {
    allMatches.push([[a,b],[c,d]]);
    allMatches.push([[a,c],[b,d]]);
    allMatches.push([[a,d],[b,c]]);
  }

  const partnerCount = Array.from({length:n}, () => Array(n).fill(0));
  const oppCount     = Array.from({length:n}, () => Array(n).fill(0));
  const playCount    = Array(n).fill(0);
  const byeCount_p   = Array(n).fill(0); // how many times each player has had a bye
  let lastByePlayers = new Set(); // who sat out last round

  const rounds = [];

  for (let r = 0; r < numRounds; r++) {
    // Decide who sits out this round (if byeCount > 0)
    let byePlayers = new Set();
    if (byeCount > 0) {
      // Score each player for "most deserving bye" — least byes, but not last round's bye
      const byeCandidates = Array.from({length:n}, (_,i)=>i)
        .sort((a,b) => {
          const aLast = lastByePlayers.has(a) ? 1000 : 0;
          const bLast = lastByePlayers.has(b) ? 1000 : 0;
          return (byeCount_p[a] + aLast) - (byeCount_p[b] + bLast);
        });
      // Pick byeCount players who most deserve to sit out
      for (let i = 0; i < byeCount; i++) byePlayers.add(byeCandidates[i]);
      byePlayers.forEach(p => byeCount_p[p]++);
      lastByePlayers = byePlayers;
    }

    // Active players this round
    const active = new Set(Array.from({length:n}, (_,i)=>i).filter(i => !byePlayers.has(i)));

    // Score all matches among active players
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
    const sA = Number(m.scoreA);
    const sB = Number(m.scoreB);
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

export function initPlayoffs(standings) {
  const t = standings.map(s => s.name);
  const n = t.length;
  // Helper: make a match object
  const mk = (tA, tB, label, note) => ({
    teamA: tA, teamB: tB, scoreA: null, scoreB: null,
    played: false, label, note
  });
  // Safe player getter — fallback to avoid undefined
  const p = (i) => t[i] || t[Math.min(i, t.length - 1)];

  // Competitive seeding rule:
  // Always pair STRONGEST with WEAKEST so both teams are balanced
  // e.g. 1+4 vs 2+3, 5+8 vs 6+7, 9+12 vs 10+11

  // ── 4 players: single final (1+4 vs 2+3) ────────────────────────────
  if (n <= 4) {
    return {
      mode: "final_only",
      final: mk([p(0),p(3)], [p(1),p(2)], "GRAND FINAL", "1st+4th vs 2nd+3rd"),
      champion: null
    };
  }

  // ── 5–7 players: top 4 — semi final then final ───────────────────────
  // SF: 1+4 vs 2+3 → winner goes to final, loser goes to final (both sides play)
  // Since only 1 semi, winner gets title, no second chance
  if (n <= 7) {
    return {
      mode: "top4",
      sf1: mk([p(0),p(3)], [p(1),p(2)], "SEMI FINAL", "1st+4th vs 2nd+3rd"),
      final: mk(null, null, "GRAND FINAL", "Winner SF vs Runner-up SF"),
      champion: null
    };
  }

  // ── 8–11 players: full IPL bracket ───────────────────────────────────
  // Q1: 1+4 vs 2+3 (winner → Final, loser → Q2)
  // Elim: 5+8 vs 6+7 (loser out, winner → Q2)
  // Q2: Loser Q1 vs Winner Elim (winner → Final)
  // Final: Winner Q1 vs Winner Q2
  if (n <= 11) {
    return {
      mode: "ipl8",
      q1:   mk([p(0),p(3)], [p(1),p(2)], "QUALIFIER 1", "1st+4th vs 2nd+3rd"),
      elim: mk([p(4),p(7)], [p(5),p(6)], "ELIMINATOR",  "5th+8th vs 6th+7th"),
      q2:   mk(null, null,               "QUALIFIER 2",  "Loser Q1 vs Winner Elim"),
      final:mk(null, null,               "THE FINAL",    "Winner Q1 vs Winner Q2"),
      champion: null
    };
  }

  // ── 12–15 players: top 8 bracket ─────────────────────────────────────
  // QF1: 1+4 vs 2+3, QF2: 5+8 vs 6+7
  // SF1: Winner QF1 vs Winner QF2
  // SF2: 9+12 vs 10+11 (bottom 4 of top 8)
  // Final: Winner SF1 vs Winner SF2
  if (n <= 15) {
    return {
      mode: "top8",
      qf1:  mk([p(0),p(3)], [p(1),p(2)],   "QF 1",         "1st+4th vs 2nd+3rd"),
      qf2:  mk([p(4),p(7)], [p(5),p(6)],   "QF 2",         "5th+8th vs 6th+7th"),
      sf1:  mk(null, null,                   "SEMI FINAL 1", "Winner QF1 vs Winner QF2"),
      sf2:  mk([p(8),p(11)],[p(9),p(10)],  "SEMI FINAL 2", "9th+12th vs 10th+11th"),
      final:mk(null, null,                   "GRAND FINAL",  "Winner SF1 vs Winner SF2"),
      champion: null
    };
  }

  // ── 16–20 players: top 8 IPL-style ───────────────────────────────────
  // Q1: 1+4 vs 2+3 (winner → Final, loser → SF)
  // Q2: 5+8 vs 6+7 (winner → Final, loser out... or winner → SF)
  // Elim: 9+12 vs 10+11 (winner → SF, loser out)
  // SF: Loser Q1 vs Winner Elim
  // Final: Winner Q1 vs Winner Q2
  return {
    mode: "top8_ipl",
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
