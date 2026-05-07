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
