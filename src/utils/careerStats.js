// ── Career Stats Engine ────────────────────────────────────────────────────
// Computes all player stats across all saved tournaments

import { normalizePlayerName } from "./players";

export function computeCareerStats(history) {
  const completedTournaments = history.filter(t => t.rounds && t.rounds.length > 0);
  
  const players = {}; // normalized name -> stats (with display name preserved)
  const partnerships = {}; // "normA|normB" -> stats
  const h2h = {}; // "normA|normB" -> { aWins, bWins }

  const getPlayer = (name) => {
    const norm = normalizePlayerName(name);
    if (!players[norm]) players[norm] = {
      name,
      matches: 0, wins: 0, losses: 0,
      scored: 0, conceded: 0, pts: 0,
      tournaments: 0, titles: 0,
      currentStreak: 0, bestStreak: 0, streakType: null,
      lastResults: [],
      tournamentsPlayed: [], // { code, date, wins, losses, name }
      roundStats: {},        // { roundIndex: { wins, losses } }
    };
    return players[norm];
  };

  const getPair = (a, b) => {
    const normA = normalizePlayerName(a);
    const normB = normalizePlayerName(b);
    const key = [normA, normB].sort().join("|");
    if (!partnerships[key]) partnerships[key] = { players: [a, b].sort((x, y) => normalizePlayerName(x).localeCompare(normalizePlayerName(y))), matches: 0, wins: 0, losses: 0, scored: 0, conceded: 0 };
    return partnerships[key];
  };

  const getH2H = (a, b) => {
    const normA = normalizePlayerName(a);
    const normB = normalizePlayerName(b);
    const key = [normA, normB].sort().join("|");
    if (!h2h[key]) h2h[key] = { players: [a, b].sort((x, y) => normalizePlayerName(x).localeCompare(normalizePlayerName(y))), aWins: 0, bWins: 0, matches: 0 };
    return h2h[key];
  };

  completedTournaments.forEach(t => {
    const tPlayers = new Set();

    // Count tournament participation
    if (t.players && Array.isArray(t.players)) t.players.forEach(p => {
      getPlayer(p).tournaments++;
      tPlayers.add(p);
    });

    // Count title
    if (t.champion) {
      const winners = t.champion.split(" & ").map(s => s.trim());
      winners.forEach(p => { if (players[p] || getPlayer(p)) getPlayer(p).titles++; });
    }

    // Helper to process a single match
    const processMatch = (m) => {
          if (!m || !m.played) return;
          if (!m.teamA || !m.teamB) return;
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
    };

    // Track per-tournament win/loss per player
    const tMatchResults = {}; // playerName -> { wins, losses }

    // Process group stage matches
    if (t.rounds && Array.isArray(t.rounds)) {
      t.rounds.forEach((round, roundIdx) => {
        if (!round || !Array.isArray(round)) return;
        round.forEach(m => {
          processMatch(m);
          if (!m?.played || !m.teamA || !m.teamB) return;
          const sA = Number(m.scoreA), sB = Number(m.scoreB);
          const winA = sA > sB;
          [...m.teamA, ...m.teamB].forEach((p, idx) => {
            const inTeamA = idx < m.teamA.length;
            const won = inTeamA ? winA : !winA;
            const pl = getPlayer(p);
            // Round stats
            if (!pl.roundStats[roundIdx]) pl.roundStats[roundIdx] = { wins: 0, losses: 0 };
            if (won) pl.roundStats[roundIdx].wins++; else pl.roundStats[roundIdx].losses++;
            // Tournament stats
            if (!tMatchResults[p]) tMatchResults[p] = { wins: 0, losses: 0 };
            if (won) tMatchResults[p].wins++; else tMatchResults[p].losses++;
          });
        });
      });
    }

    // Save per-tournament record for each player
    Object.entries(tMatchResults).forEach(([name, rec]) => {
      getPlayer(name).tournamentsPlayed.push({
        code: t.code, name: t.name || t.code,
        date: t.date, wins: rec.wins, losses: rec.losses,
        winRate: rec.wins + rec.losses > 0 ? Math.round((rec.wins / (rec.wins + rec.losses)) * 100) : 0,
      });
    });

    // Process playoff matches
    if (t.playoffs) {
      const playoffStages = ["q1", "elim", "sf1", "q2", "qf1", "qf2", "sf2", "q2_b", "sf", "final"];
      playoffStages.forEach(stage => {
        if (t.playoffs[stage]) processMatch(t.playoffs[stage]);
      });
    }
  });

  // Compute nemesis, best partner, worst partner per player
  Object.values(players).forEach(p => {
    const norm = normalizePlayerName(p.name);

    // Nemesis: player who beats you most (min 2 matches)
    let nemesis = null, nemesisLosses = 0;
    Object.values(h2h).forEach(rec => {
      if (!rec.players.some(x => normalizePlayerName(x) === norm)) return;
      const aIsP = normalizePlayerName(rec.players[0]) === norm;
      const myWins = aIsP ? rec.aWins : rec.bWins;
      const theirWins = aIsP ? rec.bWins : rec.aWins;
      if (rec.matches < 2) return;
      if (theirWins > nemesisLosses) {
        nemesisLosses = theirWins;
        nemesis = { name: aIsP ? rec.players[1] : rec.players[0], theirWins, myWins, matches: rec.matches };
      }
    });
    p.nemesis = nemesis;

    // Best & worst partner (min 2 matches together)
    const myPartnerships = Object.values(partnerships).filter(pr =>
      pr.players.some(x => normalizePlayerName(x) === norm) && pr.matches >= 2
    );
    if (myPartnerships.length > 0) {
      const sorted = [...myPartnerships].sort((a, b) => (b.wins/b.matches) - (a.wins/a.matches));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      p.bestPartner = { name: best.players.find(x => normalizePlayerName(x) !== norm), winRate: Math.round((best.wins / best.matches) * 100), matches: best.matches };
      p.worstPartner = worst !== best ? { name: worst.players.find(x => normalizePlayerName(x) !== norm), winRate: Math.round((worst.wins / worst.matches) * 100), matches: worst.matches } : null;
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
    (t.rounds || []).flatMap(r => {
      if (!Array.isArray(r)) return [];
      return r.filter(m => m && m.played).map(m => ({
        ...m, tournamentDate: t.date, tournamentCode: t.code
      }));
    })
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
  const normA = normalizePlayerName(playerA);
  const normB = normalizePlayerName(playerB);
  const key = [normA, normB].sort().join("|");
  const rec = h2h[key];
  if (!rec) return { aWins: 0, bWins: 0, matches: 0 };
  const aIsFirst = normalizePlayerName(rec.players[0]) === normA;
  return {
    aWins: aIsFirst ? rec.aWins : rec.bWins,
    bWins: aIsFirst ? rec.bWins : rec.aWins,
    matches: rec.matches
  };
}
