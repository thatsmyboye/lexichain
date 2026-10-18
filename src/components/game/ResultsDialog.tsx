import type React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Grade } from "./wordPathEngine";
import { DefinableWord } from "./WordDefinition";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/achievements";

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
  personalBest?: { isNew: boolean; previous: number | null };
  newTrophies?: AchievementId[];
}

export function ResultsDialog({
  open,
  onOpenChange,
  summary,
  primaryAction,
  onShare,
  onShareImage,
  secondaryActions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ResultsSummary | null;
  primaryAction?: { label: string; onClick: () => void };
  onShare: () => void;
  onShareImage?: () => void;
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
          {summary.personalBest?.isNew && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--brand-500)/0.15)] px-3 py-1 text-sm font-bold text-[hsl(var(--brand-600))] animate-in zoom-in-75 duration-500">
              <span aria-hidden="true">🏅</span> New personal best!
              {summary.personalBest.previous ? <span className="font-medium"> (was {summary.personalBest.previous.toLocaleString()})</span> : null}
            </div>
          )}
          {summary.personalBest && !summary.personalBest.isNew && summary.personalBest.previous !== null && (
            <div className="mt-1 text-xs text-foreground/75">Your best: {summary.personalBest.previous.toLocaleString()}</div>
          )}
        </div>

        {summary.newTrophies && summary.newTrophies.length > 0 && (
          <div className="rounded-lg border border-[hsl(var(--brand-500)/0.4)] bg-[hsl(var(--brand-500)/0.08)] p-2">
            <h3 className="mb-1 text-sm font-semibold">New trophies</h3>
            <ul className="space-y-0.5 text-sm">
              {summary.newTrophies.map(id => (
                <li key={id}><span aria-hidden="true">🏆 </span>{ACHIEVEMENTS[id].label}</li>
              ))}
            </ul>
          </div>
        )}

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
            <h3 className="mb-1 text-sm font-semibold">Words you missed <span className="font-normal text-foreground/70">(tap for meaning)</span></h3>
            <ul className="flex flex-wrap gap-1.5">
              {summary.missedWords.map(w => (
                <li key={w}>
                  <DefinableWord word={w} className="bg-secondary text-secondary-foreground" />
                </li>
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
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={onShare} className={onShareImage ? "" : "col-span-2"}>
              Share text
            </Button>
            {onShareImage && (
              <Button variant="outline" size="lg" onClick={onShareImage}>
                Share image
              </Button>
            )}
          </div>
          {secondaryActions}
        </div>
      </DialogContent>
    </Dialog>
  );
}
