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
  
  // Enhanced grid difficulty scaling - larger grids get significantly higher multipliers
  const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.4 : 2.0;
  
  // SIGNIFICANTLY RECALIBRATED: Much higher thresholds for the generous scoring system
  const bronze = Math.round(500 * scale * gridScale);
  const silver = Math.round(1200 * scale * gridScale);
  const gold = Math.round(2200 * scale * gridScale);
  const platinum = Math.round(4000 * scale * gridScale);
  
  // For standard 4x4 grids (kMin = 12), ensure it shows as Medium by default
  const rating = kMin === 12 && wordCount >= 10 ? "Medium" : 
                 wordCount >= 2 * kMin ? "Easy" : 
                 wordCount >= 1.2 * kMin ? "Medium" : "Hard";
  return { bronze, silver, gold, platinum, rating, wordCount };
}
