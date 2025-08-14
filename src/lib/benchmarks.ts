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
  const bronze = Math.round(150 * scale);
  const silver = Math.round(300 * scale);
  const gold = Math.round(500 * scale);
  const platinum = Math.round(800 * scale);
  const rating = wordCount >= 2 * kMin ? "Easy" : wordCount >= 1.2 * kMin ? "Medium" : "Hard";
  return { bronze, silver, gold, platinum, rating, wordCount };
}
