import type React from "react";
import type { Benchmarks } from "@/lib/benchmarks";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { gradeForScore } from "./wordPathEngine";
import { Medal } from "./Medal";

const TIERS = [
  { key: "bronze", label: "Bronze" },
  { key: "silver", label: "Silver" },
  { key: "gold", label: "Gold" },
  { key: "platinum", label: "Platinum" },
] as const;

// One medal track instead of four stacked tier rows: markers sit at each
// threshold along a bar scaled to the Platinum target.
function MedalTrack({ score, benchmarks, best }: { score: number; benchmarks: Benchmarks; best?: number | null }) {
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
            // An unreached tier keeps its own shape, grayed, so the next
            // milestone can be read at a glance.
            <span
              key={t.key}
              aria-hidden="true"
              title={`${t.label}: ${benchmarks[t.key]}`}
              className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm transition-[filter,opacity] duration-300 ${reached ? "" : "opacity-55 grayscale"}`}
              style={{ left: `${left}%` }}
            >
              <Medal tier={t.label} className="block h-5 w-5" />
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 truncate text-[11px] font-medium text-foreground/80">
        {next ? `${(benchmarks[next.key] - score).toLocaleString()} to ${next.label}` : "✨ Platinum reached"}
        {best ? <span className="text-foreground/70"> · {score > best ? "New best!" : `Best ${best.toLocaleString()}`}</span> : null}
      </div>
    </div>
  );
}

export function GameHud({
  score,
  benchmarks,
  showTrack,
  stat,
  best,
  className = "",
}: {
  score: number;
  benchmarks: Benchmarks | null;
  showTrack: boolean;
  stat?: React.ReactNode;
  best?: number | null;
  className?: string;
}) {
  const shown = useAnimatedNumber(score);

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-card/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 ${className}`}>
      <div className="shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/75">Score</div>
        <div className="font-display-num text-2xl font-extrabold leading-none tabular-nums text-[hsl(var(--brand-600))]" aria-live="off">
          {shown.toLocaleString()}
        </div>
        <span className="sr-only">{score} points</span>
      </div>
      {showTrack && benchmarks ? (
        <MedalTrack score={score} benchmarks={benchmarks} best={best} />
      ) : (
        <div className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/75">
          {best ? (score > best ? "New personal best!" : `Personal best ${best.toLocaleString()}`) : null}
        </div>
      )}
      {stat && <div className="shrink-0 text-right">{stat}</div>}
    </div>
  );
}
