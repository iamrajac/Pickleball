export function computeElo(players, rounds) {
  const elos = {};
  players.forEach(p => elos[p] = 1200);

  if (!rounds) return elos;

  rounds.forEach(r => {
    r.forEach(m => {
      if (!m.played || !m.teamA || !m.teamB || m.teamA.length === 0 || m.teamB.length === 0) return;
      
      let aElo = m.teamA.reduce((sum, p) => sum + (elos[p] || 1200), 0) / m.teamA.length;
      let bElo = m.teamB.reduce((sum, p) => sum + (elos[p] || 1200), 0) / m.teamB.length;
      
      const expectedA = 1 / (1 + Math.pow(10, (bElo - aElo) / 400));
      const expectedB = 1 / (1 + Math.pow(10, (aElo - bElo) / 400));
      
      const sA = Number(m.scoreA);
      const sB = Number(m.scoreB);
      // Ignore ties for Elo calculation (though pickleball rarely has ties)
      if (sA === sB) return;
      
      const actualA = sA > sB ? 1 : 0;
      const actualB = sB > sA ? 1 : 0;
      
      const K = 32;
      const aDiff = K * (actualA - expectedA);
      const bDiff = K * (actualB - expectedB);
      
      m.teamA.forEach(p => elos[p] = Math.round((elos[p] || 1200) + aDiff));
      m.teamB.forEach(p => elos[p] = Math.round((elos[p] || 1200) + bDiff));
    });
  });

  return elos;
}
