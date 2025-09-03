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
  
  // RECALIBRATED: Align with new percentile distribution targets
  // Bronze: 30th percentile, Silver: 50th percentile (median), Gold: 85th percentile, Platinum: 98th percentile
  const bronze = Math.round(1000 * scale * gridScale);
  const silver = Math.round(1750 * scale * gridScale);   // Closer to Bronze (median)
  const gold = Math.round(5400 * scale * gridScale);     // Significantly higher for 85th percentile
  const platinum = Math.round(10000 * scale * gridScale); // Much higher for 98th percentile
  
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
  
  // RECALIBRATED: Align with new percentile targets for better distribution
  // Bronze: 30th percentile, Silver: 50th percentile, Gold: 85th percentile, Platinum: 98th percentile
  const baseBronze = 1200;    // Accessible threshold
  const baseSilver = 2100;    // Median performance (reduced gap from Bronze)
  const baseGold = 6500;      // Above average strategic play (increased for 85th percentile)
  const basePlatinum = 12000; // Exceptional performance (significantly increased for 98th percentile)
  
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
  
  // Clear cache to ensure fresh calculations after the data access fix
  const cached = benchmarkCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached benchmarks for ${challengeDate}:`, cached.benchmarks);
    return cached.benchmarks;
  }

  try {
    console.log(`Calculating dynamic benchmarks for ${challengeDate} using service function...`);
    
    // Use the new service-level function that bypasses RLS to access all players' data
    const { data: benchmarkData, error } = await supabaseClient.rpc('get_benchmark_data', {
      challenge_date: challengeDate
    });

    if (error) {
      console.error('Error calling benchmark service function:', error);
      return computeBoardSpecificBenchmarks(wordCount, kMin, analysis);
    }

    if (!benchmarkData) {
      console.warn('No benchmark data returned from service function');
      return computeBoardSpecificBenchmarks(wordCount, kMin, analysis);
    }

    console.log(`Historical benchmark data for ${challengeDate}:`, {
      totalScores: benchmarkData.totalScores,
      percentiles: {
        bronze: benchmarkData.bronzePercentile,
        silver: benchmarkData.silverPercentile,
        gold: benchmarkData.goldPercentile,
        platinum: benchmarkData.platinumPercentile
      }
    });

    // Ensure we have sufficient data for reliable benchmarks
    if (benchmarkData.totalScores < 50) {
      console.log(`Insufficient historical data (${benchmarkData.totalScores} scores), falling back to static benchmarks`);
      return computeBoardSpecificBenchmarks(wordCount, kMin, analysis);
    }

    // Use percentiles calculated by the service function - RECALIBRATED for better distribution  
    const bronzePercentile = benchmarkData.bronzePercentile;  // 30th percentile - Keep accessible
    const silverPercentile = benchmarkData.silverPercentile;  // 50th percentile - Median performance
    const goldPercentile = benchmarkData.goldPercentile;     // 85th percentile - Above average, strategic play
    const platinumPercentile = benchmarkData.platinumPercentile; // 98th percentile - Exceptional performance

    const gridScale = kMin <= 12 ? 1.0 : kMin <= 20 ? 1.4 : 2.0;
    const potentialScale = Math.max(0.15, Math.min(0.4, analysis.maxScorePotential / 15000));
    const connectivityModifier = Math.max(0.9, Math.min(1.15, analysis.connectivityScore));
    const rarityModifier = Math.max(0.85, Math.min(1.25, analysis.rarityScorePotential / 800));

    const boardModifier = potentialScale * connectivityModifier * rarityModifier * gridScale;
    
    const bronze = Math.round(bronzePercentile * boardModifier);
    const silver = Math.round(silverPercentile * boardModifier);
    const gold = Math.round(goldPercentile * boardModifier);
    const platinum = Math.round(platinumPercentile * boardModifier);

    // Enhanced safeguards for recalibrated distribution
    // Ensure proper progression with appropriate gaps for new percentile targets
    const safeBronze = Math.max(100, Math.min(bronze, 2500));
    const safeSilver = Math.max(safeBronze + 150, Math.min(silver, 5000));   // Closer to Bronze (median)
    const safeGold = Math.max(safeSilver + 400, Math.min(gold, 12000));     // Larger gap for 85th percentile
    const safePlatinum = Math.max(safeGold + 800, Math.min(platinum, 20000)); // Much larger gap for 98th percentile

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
