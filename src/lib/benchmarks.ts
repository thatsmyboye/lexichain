export type Benchmarks = {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  rating: "Easy" | "Medium" | "Hard";
  wordCount: number;
};

export function computeBenchmarksFromWordCount(wordCount: number, kMin: number): Benchmarks {
  const richness = Math.max(1, wordCount) / Math.max(1, kMin);
  const scale = Math.min(1.5, Math.max(0.7, 0.8 + 0.2 * (richness - 1)));
  
  // Grid difficulty scaling - larger grids get higher multipliers
  const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.3 : 1.6;
  
  // RECALIBRATED: Higher thresholds to account for generous scoring system
  const bronze = Math.round(200 * scale * gridScale);
  const silver = Math.round(450 * scale * gridScale);
  const gold = Math.round(800 * scale * gridScale);
  const platinum = Math.round(1400 * scale * gridScale);
  
  // For standard 4x4 grids (kMin = 12), ensure it shows as Medium by default
  const rating = kMin === 12 && wordCount >= 10 ? "Medium" : 
                 wordCount >= 2 * kMin ? "Easy" : 
                 wordCount >= 1.2 * kMin ? "Medium" : "Hard";
  return { bronze, silver, gold, platinum, rating, wordCount };
}
