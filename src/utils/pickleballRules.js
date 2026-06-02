// ── Pickleball scoring rules ───────────────────────────────────────────────
// Win condition: first to 11, must win by 2
// If 10-10, play continues until 2 point lead
// Standard: 11-0, 11-5, 11-9 ✓ | 11-10 ✗ | 12-10 ✓ | 13-11 ✓

export function validatePickleballScore(a, b) {
  const sA = Number(a), sB = Number(b);
  if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0) return { valid: false, error: "Scores must be positive numbers" };
  if (sA === sB) return { valid: false, error: "Scores can't be equal — someone must win" };

  const high = Math.max(sA, sB);
  const low = Math.min(sA, sB);
  const diff = high - low;

  // Must win by at least 2
  if (diff < 2) return { valid: false, error: `Need a 2-point lead (e.g. ${high}-${high - 2})` };

  // Below 11 — only valid if one side has 11+ or it's a valid extended game
  if (high < 11) return { valid: false, error: `First to 11 — highest score must be at least 11` };

  // If both below 10 when high reaches 11, fine (e.g. 11-0 to 11-9)
  if (high === 11 && low <= 9) return { valid: true };

  // If low is 10 or more, this is an extended game — need 2 point lead
  if (low >= 10 && diff >= 2) return { valid: true };

  // Edge case: high is 11 but low is 10 → need more points
  if (high === 11 && low === 10) return { valid: false, error: "Score is 11-10 — play continues until 2-point lead (e.g. 12-10)" };

  return { valid: true };
}

export function scoreHint(a, b) {
  const sA = Number(a), sB = Number(b);
  if (isNaN(sA) || isNaN(sB) || a === "" || b === "") return null;
  const { valid, error } = validatePickleballScore(sA, sB);
  if (!valid) return error;
  return null;
}
