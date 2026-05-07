const SK_HIST = "pkl_hist_v2";
const SK_MINE = "pkl_mine_v1";

export const loadH = () => {
  try {
    return JSON.parse(localStorage.getItem(SK_HIST)) || [];
  } catch {
    // Ignore error
    return [];
  }
};

export const saveH = (d) => {
  try {
    localStorage.setItem(SK_HIST, JSON.stringify(d));
  } catch {
    // Ignore error
  }
};

export const loadMyCodes = () => {
  try {
    return JSON.parse(localStorage.getItem(SK_MINE)) || [];
  } catch {
    // Ignore error
    return [];
  }
};

export const saveMyCodes = (d) => {
  try {
    localStorage.setItem(SK_MINE, JSON.stringify(d));
  } catch {
    // Ignore error
  }
};

export const registerAsCreator = (code) => {
  const codes = loadMyCodes();
  if (!codes.includes(code)) {
    codes.push(code);
    saveMyCodes(codes);
  }
};

export const isCreator = (code) => loadMyCodes().includes(code);

export const computeH2HMatrix = () => {
  const h2h = {};
  const hist = loadH();
  
  const processMatch = (m) => {
    if (!m || !m.played || !m.teamA || !m.teamB) return;
    if (m.scoreA === m.scoreB) return; // Ties not tracked as wins
    const aWon = m.scoreA > m.scoreB;
    
    m.teamA.forEach(a => {
      m.teamB.forEach(b => {
        const key1 = `${a}_${b}`;
        const key2 = `${b}_${a}`;
        if (!h2h[key1]) h2h[key1] = 0;
        if (!h2h[key2]) h2h[key2] = 0;
        
        if (aWon) {
          h2h[key1] += 1;
        } else {
          h2h[key2] += 1;
        }
      });
    });
  };

  hist.forEach(t => {
    if (t.rounds) {
      t.rounds.forEach(rnd => {
        if (rnd) rnd.forEach(processMatch);
      });
    }
    if (t.playoffs) {
      Object.values(t.playoffs).forEach(processMatch);
    }
  });
  
  return h2h;
};

export const getH2HStats = (p1, p2, h2hMatrix) => {
  if (!h2hMatrix) return null;
  const p1Wins = h2hMatrix[`${p1}_${p2}`] || 0;
  const p2Wins = h2hMatrix[`${p2}_${p1}`] || 0;
  
  if (p1Wins === 0 && p2Wins === 0) return null;
  
  if (p1Wins > p2Wins) return `${p1} leads ${p1Wins}-${p2Wins}`;
  if (p2Wins > p1Wins) return `${p2} leads ${p2Wins}-${p1Wins}`;
  return `Tied ${p1Wins}-${p2Wins}`;
};
