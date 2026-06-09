export const SEMANTIC_FLOOR = 0.8;
export const SEMANTIC_MAD_K = 3;
export const SEMANTIC_MIN_CANDIDATES = 5;

function medianOfSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

// CLIP image-image cosines sit on a corpus-dependent baseline (measured 0.722
// mean for random pairs on the dogfood corpus), so a fixed floor filters
// nothing. Gate per query at median + k*MAD of the candidate distribution,
// never below the absolute floor; tiny corpora fall back to the floor alone.
export function semanticGate(scores: number[]): number {
  if (scores.length < SEMANTIC_MIN_CANDIDATES) return SEMANTIC_FLOOR;
  const sorted = [...scores].sort((a, b) => a - b);
  const med = medianOfSorted(sorted);
  const deviations = sorted.map((s) => Math.abs(s - med)).sort((a, b) => a - b);
  const mad = medianOfSorted(deviations);
  return Math.max(med + SEMANTIC_MAD_K * mad, SEMANTIC_FLOOR);
}

export function percentileOf(sortedAsc: number[], score: number): number {
  if (sortedAsc.length === 0) return 0;
  let below = 0;
  for (const s of sortedAsc) {
    if (s < score) below++;
    else break;
  }
  return Math.round((below / sortedAsc.length) * 100);
}
