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

export type HistoricalPerformanceData = {
  score: number;
  achievement_level: string;
  challenge_date: string;
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

const benchmarkCache = new Map<string, { benchmarks: Benchmarks; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export async function computeDynamicBenchmarks(
  challengeDate: string,
  wordCount: number,
  kMin: number,
  analysis: BoardAnalysis,
  supabaseClient: any
): Promise<Benchmarks> {
  const cacheKey = `${challengeDate}-${wordCount}-${kMin}-${analysis.maxScorePotential}`;
  const cached = benchmarkCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.benchmarks;
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: historicalData, error } = await supabaseClient
      .from('daily_challenge_results')
      .select('score, achievement_level, challenge_date')
      .gte('challenge_date', thirtyDaysAgo.toISOString().split('T')[0])
      .lt('challenge_date', challengeDate)
      .order('score', { ascending: true });

    if (error) {
      console.error('Error fetching historical performance data:', error);
      return computeBoardSpecificBenchmarks(wordCount, kMin, analysis);
    }

    const targetPotential = analysis.maxScorePotential;
    const potentialRange = targetPotential * 0.2;
    
    const validScores = historicalData
      ?.map(d => d.score)
      .filter(score => score > 0) || [];

    if (validScores.length < 50) {
      console.log(`Insufficient historical data (${validScores.length} points), falling back to static benchmarks`);
      return computeBoardSpecificBenchmarks(wordCount, kMin, analysis);
    }

    // Calculate percentile-based thresholds
    const sortedScores = validScores.sort((a, b) => a - b);
    const bronzePercentile = getPercentile(sortedScores, 30);
    const silverPercentile = getPercentile(sortedScores, 60);
    const goldPercentile = getPercentile(sortedScores, 80);
    const platinumPercentile = getPercentile(sortedScores, 95);

    const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.4 : 2.0;
    const potentialScale = Math.max(0.15, Math.min(0.4, analysis.maxScorePotential / 15000));
    const connectivityModifier = Math.max(0.9, Math.min(1.15, analysis.connectivityScore));
    const rarityModifier = Math.max(0.85, Math.min(1.25, analysis.rarityScorePotential / 800));

    const boardModifier = potentialScale * connectivityModifier * rarityModifier * gridScale;
    
    const bronze = Math.round(bronzePercentile * boardModifier);
    const silver = Math.round(silverPercentile * boardModifier);
    const gold = Math.round(goldPercentile * boardModifier);
    const platinum = Math.round(platinumPercentile * boardModifier);

    const safeBronze = Math.max(100, Math.min(bronze, 2000));
    const safeSilver = Math.max(safeBronze + 100, Math.min(silver, 4000));
    const safeGold = Math.max(safeSilver + 200, Math.min(gold, 8000));
    const safePlatinum = Math.max(safeGold + 500, Math.min(platinum, 15000));

    const scoreRatio = analysis.maxScorePotential / Math.max(1, safeBronze);
    const rating: "Easy" | "Medium" | "Hard" = scoreRatio >= 8 ? "Easy" : 
                   scoreRatio >= 5 ? "Medium" : "Hard";

    const dynamicBenchmarks = { 
      bronze: safeBronze, 
      silver: safeSilver, 
      gold: safeGold, 
      platinum: safePlatinum, 
      rating, 
      wordCount 
    };

    benchmarkCache.set(cacheKey, { 
      benchmarks: dynamicBenchmarks, 
      timestamp: Date.now() 
    });

    console.log(`Dynamic benchmarks calculated for ${challengeDate}:`, dynamicBenchmarks);
    return dynamicBenchmarks;

  } catch (error) {
    console.error('Error computing dynamic benchmarks:', error);
    return computeBoardSpecificBenchmarks(wordCount, kMin, analysis);
  }
}

function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) {
    return sortedArray[lower];
  }
  
  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}
