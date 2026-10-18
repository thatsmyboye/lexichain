import type React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Grade } from "./wordPathEngine";

const MEDALS: Record<Grade, { emoji: string; ring: string; label: string }> = {
  Platinum: { emoji: "💎", ring: "from-purple-400 to-fuchsia-500", label: "Platinum" },
  Gold: { emoji: "🥇", ring: "from-yellow-300 to-amber-500", label: "Gold" },
  Silver: { emoji: "🥈", ring: "from-gray-200 to-gray-400", label: "Silver" },
  Bronze: { emoji: "🥉", ring: "from-orange-300 to-amber-700", label: "Bronze" },
  None: { emoji: "🔤", ring: "from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]", label: "No medal" },
};

export interface ResultsSummary {
  title: string;
  reason: string;
  grade: Grade;
  showGrade: boolean;
  score: number;
  wordsFound: number;
  discoverable: number;
  longestWord: string;
  bestWord: { word: string; score: number } | null;
  missedWords: string[];
  stats?: { label: string; value: string }[];
}

export function ResultsDialog({
  open,
  onOpenChange,
  summary,
  primaryAction,
  onShare,
  secondaryActions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ResultsSummary | null;
  primaryAction?: { label: string; onClick: () => void };
  onShare: () => void;
  secondaryActions?: React.ReactNode;
}) {
  if (!summary) return null;
  const medal = MEDALS[summary.grade];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90dvh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="items-center text-center">
          <div
            aria-hidden="true"
            className={`mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${medal.ring} text-5xl shadow-lg animate-in zoom-in-50 spin-in-12 duration-700`}
          >
            {summary.showGrade ? medal.emoji : "🔤"}
          </div>
          <DialogTitle className="text-2xl">{summary.title}</DialogTitle>
          <DialogDescription className="text-foreground/80">{summary.reason}</DialogDescription>
        </DialogHeader>

        <div className="text-center">
          <div className="text-4xl font-extrabold tabular-nums text-[hsl(var(--brand-600))]">{summary.score.toLocaleString()}</div>
          <div className="text-sm text-foreground/80">
            points{summary.showGrade ? ` · ${medal.label}` : ""}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-foreground/75">Words found</dt>
            <dd className="font-semibold tabular-nums">
              {summary.wordsFound}{summary.discoverable > 0 ? ` / ${summary.discoverable}` : ""}
            </dd>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-foreground/75">Longest word</dt>
            <dd className="font-semibold uppercase">{summary.longestWord || "—"}</dd>
          </div>
          <div className="rounded-lg bg-muted p-2 col-span-2">
            <dt className="text-xs text-foreground/75">Best-scoring word</dt>
            <dd className="font-semibold">
              {summary.bestWord ? <><span className="uppercase">{summary.bestWord.word}</span> · +{summary.bestWord.score}</> : "—"}
            </dd>
          </div>
          {summary.stats?.map(stat => (
            <div key={stat.label} className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-foreground/75">{stat.label}</dt>
              <dd className="font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {summary.missedWords.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Words you missed</h3>
            <ul className="flex flex-wrap gap-1.5">
              {summary.missedWords.map(w => (
                <li key={w} className="rounded bg-secondary px-2 py-0.5 text-xs font-medium uppercase text-secondary-foreground">{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {primaryAction && (
            <Button variant="hero" size="lg" onClick={primaryAction.onClick} className="w-full">
              {primaryAction.label}
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={onShare} className="w-full">
            Share result
          </Button>
          {secondaryActions}
        </div>
      </DialogContent>
    </Dialog>
  );
}
