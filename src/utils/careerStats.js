// ── Career Stats Engine ────────────────────────────────────────────────────
// Computes all player stats across all saved tournaments

export function computeCareerStats(history) {
  const completedTournaments = history.filter(t => t.rounds && t.rounds.length > 0);
  
  const players = {}; // name -> stats
  const partnerships = {}; // "A|B" -> stats
  const h2h = {}; // "A|B" -> { aWins, bWins }

  const getPlayer = (name) => {
    if (!players[name]) players[name] = {
      name, matches: 0, wins: 0, losses: 0,
      scored: 0, conceded: 0, pts: 0,
      tournaments: 0, titles: 0,
      currentStreak: 0, bestStreak: 0, streakType: null,
      lastResults: [], // W/L array across all tournaments in order
      tournamentsPlayed: [],
    };
    return players[name];
  };

  const getPair = (a, b) => {
    const key = [a, b].sort().join("|");
    if (!partnerships[key]) partnerships[key] = { players: [a, b].sort(), matches: 0, wins: 0, losses: 0, scored: 0, conceded: 0 };
    return partnerships[key];
  };

  const getH2H = (a, b) => {
    const key = [a, b].sort().join("|");
    if (!h2h[key]) h2h[key] = { players: [a, b].sort(), aWins: 0, bWins: 0, matches: 0 };
    return h2h[key];
  };

  completedTournaments.forEach(t => {
    const tPlayers = new Set();

    // Count tournament participation
    if (t.players) t.players.forEach(p => {
      getPlayer(p).tournaments++;
      tPlayers.add(p);
    });

    // Count title
    if (t.champion) {
      const winners = t.champion.split(" & ").map(s => s.trim());
      winners.forEach(p => { if (players[p] || getPlayer(p)) getPlayer(p).titles++; });
    }

    // Process all matches
    if (t.rounds) {
      t.rounds.forEach(round => {
        round.forEach(m => {
          if (!m.played) return;
          const sA = Number(m.scoreA), sB = Number(m.scoreB);
          const winA = sA > sB;

          // Per-player stats
          [...m.teamA, ...m.teamB].forEach((p, idx) => {
            const inTeamA = idx < m.teamA.length;
            const myScore = inTeamA ? sA : sB;
            const oppScore = inTeamA ? sB : sA;
            const won = inTeamA ? winA : !winA;
            const pl = getPlayer(p);
            pl.matches++;
            pl.scored += myScore;
            pl.conceded += oppScore;
            pl.pts += won ? 2 : 0;
            if (won) pl.wins++; else pl.losses++;
            pl.lastResults.push(won ? "W" : "L");
          });

          // Partnership stats (teamA pair)
          if (m.teamA.length === 2) {
            const pair = getPair(m.teamA[0], m.teamA[1]);
            pair.matches++;
            pair.scored += sA; pair.conceded += sB;
            if (winA) pair.wins++; else pair.losses++;
          }
          if (m.teamB.length === 2) {
            const pair = getPair(m.teamB[0], m.teamB[1]);
            pair.matches++;
            pair.scored += sB; pair.conceded += sA;
            if (!winA) pair.wins++; else pair.losses++;
          }

          // H2H between all players across teams
          m.teamA.forEach(pa => {
            m.teamB.forEach(pb => {
              const rec = getH2H(pa, pb);
              rec.matches++;
              const sorted = [pa, pb].sort();
              const aIsFirst = sorted[0] === pa;
              if (winA) { if (aIsFirst) rec.aWins++; else rec.bWins++; }
              else { if (aIsFirst) rec.bWins++; else rec.aWins++; }
            });
          });
        });
      });
    }
  });

  // Compute streaks
  Object.values(players).forEach(p => {
    let cur = 0, best = 0, curType = null;
    p.lastResults.forEach(r => {
      if (r === curType) { cur++; if (cur > best) best = cur; }
      else { cur = 1; curType = r; }
    });
    p.currentStreak = cur;
    p.bestStreak = best;
    p.streakType = curType;
    p.winRate = p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : 0;
    p.avgScore = p.matches > 0 ? (p.scored / p.matches).toFixed(1) : 0;
    p.diff = p.scored - p.conceded;
  });

  // Find records
  const allMatches = completedTournaments.flatMap(t =>
    (t.rounds || []).flatMap(r => r.filter(m => m.played).map(m => ({
      ...m, tournamentDate: t.date, tournamentCode: t.code
    })))
  );

  const highestScoringMatch = allMatches.reduce((best, m) => {
    const total = Number(m.scoreA) + Number(m.scoreB);
    return total > (best ? Number(best.scoreA) + Number(best.scoreB) : 0) ? m : best;
  }, null);

  const biggestComeback = allMatches.reduce((best, m) => {
    const diff = Math.abs(Number(m.scoreA) - Number(m.scoreB));
    return diff > (best?.diff || 0) ? { ...m, diff } : best;
  }, null);

  return {
    players: Object.values(players).sort((a, b) => b.wins - a.wins || b.matches - a.matches),
    partnerships: Object.values(partnerships)
      .filter(p => p.matches >= 2)
      .sort((a, b) => (b.wins/Math.max(b.matches,1)) - (a.wins/Math.max(a.matches,1))),
    h2h,
    records: { highestScoringMatch, biggestComeback },
    totalTournaments: completedTournaments.length,
    totalMatches: allMatches.length,
  };
}

export function getH2HBetween(h2h, playerA, playerB) {
  const key = [playerA, playerB].sort().join("|");
  const rec = h2h[key];
  if (!rec) return { aWins: 0, bWins: 0, matches: 0 };
  const aIsFirst = rec.players[0] === playerA;
  return {
    aWins: aIsFirst ? rec.aWins : rec.bWins,
    bWins: aIsFirst ? rec.bWins : rec.aWins,
    matches: rec.matches
  };
}
