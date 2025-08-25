export type Benchmarks = {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  rating: "Easy" | "Medium" | "Hard";
  wordCount: number;
};

export type BoardAnalysis = {
  rarityScorePotential: number;
  avgWordLength: number;
  connectivityScore: number;
  letterDistribution: Map<string, number>;
  maxScorePotential: number;
};

export function computeBenchmarksFromWordCount(wordCount: number, kMin: number): Benchmarks {
  const richness = Math.max(1, wordCount) / Math.max(1, kMin);
  const scale = Math.min(1.5, Math.max(0.7, 0.8 + 0.2 * (richness - 1)));
  
  // Enhanced grid difficulty scaling - larger grids get significantly higher multipliers
  const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.4 : 2.0;
  
  // RECALIBRATED: Much higher thresholds to match quadratic scoring system
  // These should align with what players can realistically achieve with the new scoring
  const bronze = Math.round(1000 * scale * gridScale);
  const silver = Math.round(2400 * scale * gridScale);
  const gold = Math.round(4500 * scale * gridScale);
  const platinum = Math.round(8000 * scale * gridScale);
  
  // For standard 4x4 grids (kMin = 12), ensure it shows as Medium by default
  const rating = kMin === 12 && wordCount >= 10 ? "Medium" : 
                 wordCount >= 2 * kMin ? "Easy" : 
                 wordCount >= 1.2 * kMin ? "Medium" : "Hard";
  return { bronze, silver, gold, platinum, rating, wordCount };
}

export function computeBoardSpecificBenchmarks(
  wordCount: number, 
  kMin: number, 
  analysis: BoardAnalysis
): Benchmarks {
  // Base difficulty from word count and grid size
  const richness = Math.max(1, wordCount) / Math.max(1, kMin);
  const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.4 : 2.0;
  
  // Board-specific difficulty modifiers (more conservative ranges)
  const rarityModifier = Math.max(0.85, Math.min(1.25, analysis.rarityScorePotential / 800));
  const lengthModifier = Math.max(0.9, Math.min(1.2, analysis.avgWordLength / 5.0));
  const connectivityModifier = Math.max(0.9, Math.min(1.15, analysis.connectivityScore));
  
  // Use actual scoring potential as primary scaling factor
  const potentialScale = Math.max(0.15, Math.min(0.4, analysis.maxScorePotential / 15000));
  
  // RECALIBRATED: Much higher base thresholds to match actual scoring system
  // Bronze: 6-8 basic words, Silver: requires strategy, Gold: good play, Platinum: excellent play
  const baseBronze = 1200;
  const baseSilver = 2800; 
  const baseGold = 5200;
  const basePlatinum = 9000;
  
  const bronze = Math.round(baseBronze * potentialScale * gridScale);
  const silver = Math.round(baseSilver * potentialScale * gridScale);
  const gold = Math.round(baseGold * potentialScale * gridScale);
  const platinum = Math.round(basePlatinum * potentialScale * gridScale);
  
  // Difficulty rating based on scoring potential relative to thresholds
  const scoreRatio = analysis.maxScorePotential / Math.max(1, bronze);
  const rating = scoreRatio >= 8 ? "Easy" : 
                 scoreRatio >= 5 ? "Medium" : "Hard";
  
  return { bronze, silver, gold, platinum, rating, wordCount };
}
