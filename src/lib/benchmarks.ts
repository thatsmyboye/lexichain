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
  // Fixed benchmark thresholds
  const bronze = 1500;
  const silver = 2500;
  const gold = 4000;
  const platinum = 6000;
  
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
  // Fixed benchmark thresholds
  const bronze = 1500;
  const silver = 2500;
  const gold = 4000;
  const platinum = 6000;
  
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
    
    // Use the enhanced benchmark function that includes board analysis
    const { data: benchmarkData, error } = await supabaseClient.rpc('get_enhanced_benchmark_data', {
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

    // Fixed benchmark thresholds
    const safeBronze = 1500;
    const safeSilver = 2500;
    const safeGold = 4000;
    const safePlatinum = 6000;

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
