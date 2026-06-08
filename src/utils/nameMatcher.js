// Returns 0-1 score of how well slotName matches displayName
export function fuzzyMatchScore(slotName, displayName) {
  if (!slotName || !displayName) return 0;
  const a = slotName.toLowerCase().trim();
  const b = displayName.toLowerCase().trim();
  if (a === b) return 1;
  if (b.startsWith(a) || a.startsWith(b)) return 0.9;
  if (b.includes(a) || a.includes(b)) return 0.7;
  // Check first name match
  const bFirst = b.split(" ")[0];
  const aFirst = a.split(" ")[0];
  if (aFirst === bFirst) return 0.85;
  if (bFirst.startsWith(aFirst) || aFirst.startsWith(bFirst)) return 0.7;
  return 0;
}

export function findBestMatches(playerNames, displayName, threshold = 0.6) {
  return playerNames
    .map(name => ({ name, score: fuzzyMatchScore(name, displayName) }))
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
