// ── Player name normalization ──────────────────────────────────────────────
// Normalize player names for consistent storage and comparison across tournaments

export const normalizePlayerName = (name) => {
  return String(name).trim().toLowerCase();
};

export const displayPlayerName = (name) => {
  return String(name).trim();
};

// Find duplicate names (case-insensitive) in a list
export const findDuplicatePlayerNames = (names) => {
  const normalized = {};
  const duplicates = [];

  names.forEach((name, idx) => {
    const norm = normalizePlayerName(name);
    if (norm === "") return; // Skip empty names

    if (normalized[norm] === undefined) {
      normalized[norm] = [];
    }
    normalized[norm].push(idx);
  });

  Object.entries(normalized).forEach(([norm, indices]) => {
    if (indices.length > 1) {
      duplicates.push({
        normalized: norm,
        displayNames: indices.map(i => names[i]),
        indices,
      });
    }
  });

  return duplicates;
};
