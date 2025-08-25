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

export function computeBoardSpecificBenchmarks(
  wordCount: number, 
  kMin: number, 
  analysis: BoardAnalysis
): Benchmarks {
  // Base difficulty from word count and grid size
  const richness = Math.max(1, wordCount) / Math.max(1, kMin);
  const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.4 : 2.0;
  
  // Board-specific difficulty modifiers
  const rarityModifier = Math.max(0.7, Math.min(1.5, analysis.rarityScorePotential / 1000));
  const lengthModifier = Math.max(0.8, Math.min(1.3, analysis.avgWordLength / 5.5));
  const connectivityModifier = Math.max(0.75, Math.min(1.4, analysis.connectivityScore));
  
  // Combined difficulty scale - emphasizes actual scoring potential
  const boardDifficultyScale = rarityModifier * lengthModifier * connectivityModifier;
  const potentialScale = Math.max(0.6, Math.min(2.0, analysis.maxScorePotential / 8000));
  
  // Dynamic thresholds based on actual board scoring potential
  const baseBronze = 400;
  const baseSilver = 900;
  const baseGold = 1800;
  const basePlatinum = 3200;
  
  const bronze = Math.round(baseBronze * boardDifficultyScale * gridScale * potentialScale);
  const silver = Math.round(baseSilver * boardDifficultyScale * gridScale * potentialScale);
  const gold = Math.round(baseGold * boardDifficultyScale * gridScale * potentialScale);
  const platinum = Math.round(basePlatinum * boardDifficultyScale * gridScale * potentialScale);
  
  // More sophisticated difficulty rating based on multiple factors
  const complexityScore = (rarityModifier + lengthModifier + connectivityModifier) / 3;
  const rating = complexityScore >= 1.2 ? "Easy" : 
                 complexityScore >= 0.95 ? "Medium" : "Hard";
  
  return { bronze, silver, gold, platinum, rating, wordCount };
}
