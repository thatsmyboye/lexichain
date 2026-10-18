import type React from "react";
import type { Benchmarks } from "@/lib/benchmarks";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { gradeForScore } from "./wordPathEngine";

const TIERS = [
  { key: "bronze", label: "Bronze", emoji: "🥉", color: "bg-orange-500" },
  { key: "silver", label: "Silver", emoji: "🥈", color: "bg-gray-400" },
  { key: "gold", label: "Gold", emoji: "🥇", color: "bg-yellow-400" },
  { key: "platinum", label: "Platinum", emoji: "💎", color: "bg-purple-500" },
] as const;

// One medal track instead of four stacked tier rows: markers sit at each
// threshold along a bar scaled to the Platinum target.
function MedalTrack({ score, benchmarks }: { score: number; benchmarks: Benchmarks }) {
  const max = Math.max(1, benchmarks.platinum);
  const pct = Math.min(100, (score / max) * 100);
  const grade = gradeForScore(score, benchmarks);
  const next = TIERS.find(t => score < benchmarks[t.key]);
  const fill =
    grade === "Platinum" ? "from-purple-500 to-fuchsia-400"
      : grade === "Gold" ? "from-yellow-500 to-yellow-300"
      : grade === "Silver" ? "from-gray-500 to-gray-300"
      : grade === "Bronze" ? "from-orange-600 to-orange-400"
      : "from-[hsl(var(--brand-600))] to-[hsl(var(--brand-400))]";

  return (
    <div className="min-w-0 flex-1">
      <div
        className="relative h-2.5 rounded-full bg-muted"
        role="progressbar"
        aria-label="Medal progress"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(score, max)}
        aria-valuetext={next ? `${next.label} in ${benchmarks[next.key] - score} points` : "Platinum reached"}
      >
        <div className={`h-full rounded-full bg-gradient-to-r ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
        {TIERS.map(t => {
          const left = Math.min(100, (benchmarks[t.key] / max) * 100);
          const reached = score >= benchmarks[t.key];
          return (
            <span
              key={t.key}
              aria-hidden="true"
              title={`${t.label}: ${benchmarks[t.key]}`}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background text-[11px] shadow ${reached ? t.color : "bg-muted"} ${reached ? "" : "grayscale opacity-70"}`}
              style={{ left: `${left}%` }}
            >
              {t.emoji}
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 truncate text-[11px] font-medium text-foreground/80">
        {next ? `${(benchmarks[next.key] - score).toLocaleString()} to ${next.label}` : "✨ Platinum reached"}
      </div>
    </div>
  );
}

export function GameHud({
  score,
  benchmarks,
  showTrack,
  stat,
  className = "",
}: {
  score: number;
  benchmarks: Benchmarks | null;
  showTrack: boolean;
  stat?: React.ReactNode;
  className?: string;
}) {
  const shown = useAnimatedNumber(score);

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-card/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 ${className}`}>
      <div className="shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/75">Score</div>
        <div className="text-2xl font-extrabold leading-none tabular-nums text-[hsl(var(--brand-600))]" aria-live="off">
          {shown.toLocaleString()}
        </div>
        <span className="sr-only">{score} points</span>
      </div>
      {showTrack && benchmarks ? <MedalTrack score={score} benchmarks={benchmarks} /> : <div className="flex-1" />}
      {stat && <div className="shrink-0 text-right">{stat}</div>}
    </div>
  );
}
