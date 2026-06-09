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

  // First check: must reach 11 before anything else matters
  if (high < 11) return { valid: false, error: "First to 11 — keep playing" };

  // 11-10: need to keep going
  if (high === 11 && low === 10) return { valid: false, error: "11-10 — play continues until 2-point lead (e.g. 12-10)" };

  // Valid standard win: 11-0 to 11-9
  if (high === 11 && low <= 9) return { valid: true };

  // Extended game (both reached 10+): must win by 2
  if (low >= 10 && diff >= 2) return { valid: true };

  // Extended game but not enough lead yet
  if (low >= 10 && diff < 2) return { valid: false, error: `Need a 2-point lead — next valid score: ${low + 2}-${low}` };

  return { valid: true };
}

export function scoreHint(a, b) {
  const sA = Number(a), sB = Number(b);
  if (isNaN(sA) || isNaN(sB) || a === "" || b === "") return null;
  const { valid, error } = validatePickleballScore(sA, sB);
  if (!valid) return error;
  return null;
}
