import React from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Clock, Puzzle, Infinity as InfinityIcon, Star, Flame, Shuffle, Flag, Sword, TrendingUp, Leaf } from 'lucide-react';
import { useSound } from '@/components/effects';
import { FloatingTiles } from '@/components/effects/FloatingTiles';
import { usePersonalBests, useModesPlayed } from '@/lib/personalBests';
import { MODE_BLURBS, getPersonalBestKey, type AdvancedGameMode } from '@/lib/gameModes';
import { cn } from '@/lib/utils';
export type { AdvancedGameMode } from '@/lib/gameModes';
interface AdvancedModeConfig {
  id: AdvancedGameMode;
  name: string;
  description: string;
  icon: React.ReactNode;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  timeLimit?: number;
  specialRules: string[];
  rewards: {
    scoreMultiplier: number;
  };
}
const ADVANCED_MODES: AdvancedModeConfig[] = [{
  id: 'classic',
  name: 'Classic',
  description: 'The original Lexichain experience. No time limits, no pressure. Just pure word chaining.',
  icon: <Star className="h-6 w-6" />,
  difficulty: 'Easy',
  specialRules: ['No time limit', 'Standard scoring rules', 'Available to all players', 'Perfect for beginners'],
  rewards: {
    scoreMultiplier: 1.0,
  }
}, {
  id: 'time_attack',
  name: 'Time Attack',
  description: 'Race against the clock! Find as many words as possible in the time limit.',
  icon: <Clock className="h-6 w-6" />,
  difficulty: 'Medium',
  timeLimit: 60,
  specialRules: ['60-second time limit', 'No pause between words', 'Time bonus for quick completion', 'Speed multiplier increases with each word'],
  rewards: {
    scoreMultiplier: 1.2,
  }
}, {
  id: 'endless',
  name: '(Almost) Endless',
  description: 'Keep playing until you can\'t find any more words. How long can you last?',
  icon: <InfinityIcon className="h-6 w-6" />,
  difficulty: 'Hard',
  specialRules: ['No time limit', 'Board regenerates when no words remain', 'Difficulty increases over time', 'Special tiles become more common'],
  rewards: {
    scoreMultiplier: 1.5,
  }
}, {
  id: 'puzzle',
  name: 'Puzzle',
  description: 'Solve pre-designed puzzles with specific word requirements.',
  icon: <Puzzle className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: ['Pre-designed board layouts', 'Specific words must be found', 'Limited moves available', 'Perfect solutions only'],
  rewards: {
    scoreMultiplier: 2.0,
  }
}, {
  id: 'survival',
  name: 'Survival',
  description: 'A roguelike word game adventure! Complete dynamic challenges, defeat bosses, collect power-ups, and manage resources to survive as long as possible.',
  icon: <Flame className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: [
    'Dynamic wave challenges each round',
    'Boss waves every 5 rounds with varied mechanics',
    'Lives system with multiple recovery methods',
    'Combo system with escalating rewards',
    'Power-ups and strategic shop system',
    'Random events with meaningful choices',
    'Adaptive difficulty scaling',
    'Meta-progression between runs'
  ],
  rewards: {
    scoreMultiplier: 1.8,
  }
}, {
  id: 'zen',
  name: 'Zen',
  description: 'Relaxed gameplay with no pressure. Perfect for learning and practice.',
  icon: <Leaf className="h-6 w-6" />,
  difficulty: 'Easy',
  specialRules: ['No time pressure', 'Hints available', 'Unlimited undo', 'Focus on learning'],
  rewards: {
    scoreMultiplier: 0.5,
  }
}, {
  id: 'chaos',
  name: 'Chaos',
  description: 'The board reshuffles after every word! Special tiles may turn into traps.',
  icon: <Shuffle className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: ['Board reshuffles after each word', 'New letters may swap in', 'Special tiles can become traps', 'At least 1 valid word always available'],
  rewards: {
    scoreMultiplier: 2.2,
  }
}, {
  id: 'mini_marathon',
  name: 'Mini-Marathon',
  description: 'Three quick 5-move boards with combo carry-over. Perfect for a quick challenge!',
  icon: <Flag className="h-6 w-6" />,
  difficulty: 'Medium',
  specialRules: ['3 sequential boards', '5 moves per board, 60s timer', 'Combo multiplier carries between boards', 'Aggregate scoring with daily leaderboard'],
  rewards: {
    scoreMultiplier: 1.2,
  }
}, {
  id: 'weekly_gauntlet',
  name: 'Weekly Gauntlet',
  description: '7 daily puzzles with unique constraints. Complete all for maximum rewards!',
  icon: <Sword className="h-6 w-6" />,
  difficulty: 'Hard',
  specialRules: ['7 themed daily puzzles (Monday-Sunday)', 'Unique constraints per day', 'Completion bonus for finishing all 7', 'New Diamond tier for top performers'],
  rewards: {
    scoreMultiplier: 1.8,
  }
}, {
  id: 'prestige_endless',
  name: 'Prestige Endless',
  description: 'Enhanced Endless with persistent buffs and prestige system. Long-term meta-progression!',
  icon: <TrendingUp className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: ['Earn permanent buffs every 10 waves', 'Prestige after wave 50 for exclusive rewards', 'Prestige Points unlock cosmetics', 'Multiple leaderboards (highest wave, speed runs)'],
  rewards: {
    scoreMultiplier: 2.5,
  }
}];
interface AdvancedGameModesProps {
  onModeSelect: (mode: AdvancedGameMode) => void;
  onBack: () => void;
}

const numberFormat = new Intl.NumberFormat();

// Dark text on light tints (and the inverse in dark mode) keeps badges at >= 4.5:1 contrast.
const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100';
    case 'Medium':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
    case 'Hard':
      return 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100';
    case 'Expert':
      return 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100';
    default:
      return 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100';
  }
};

interface ModeTileProps {
  mode: AdvancedModeConfig;
  best: number | null;
  isNew: boolean;
  onStart: (mode: AdvancedGameMode) => void;
}

function ModeTile({ mode, best, isNew, onStart }: ModeTileProps) {
  const blurbId = React.useId();
  const metaId = React.useId();
  const [open, setOpen] = React.useState(false);

  return <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card/95 text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onStart(mode.id)}
        aria-label={`Play ${mode.name}`}
        aria-describedby={`${blurbId} ${metaId}`}
        className="group flex min-h-[44px] w-full items-start gap-3 p-3 text-left transition-colors hover:bg-[hsl(var(--brand-500)/0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
      >
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(265_80%_58%)] to-[hsl(265_84%_42%)] text-white shadow-sm [&_svg]:h-6 [&_svg]:w-6">
          {mode.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-bold leading-tight">{mode.name}</span>
            {isNew && <span className="rounded-full bg-[hsl(var(--brand-600))] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">
                New
              </span>}
          </span>
          <span id={blurbId} className="mt-0.5 block text-sm text-muted-foreground">
            {MODE_BLURBS[mode.id]}
          </span>
          <span id={metaId} className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={cn('rounded-full px-2 py-0.5 font-semibold', getDifficultyColor(mode.difficulty))}>
              {mode.difficulty}
            </span>
            {best !== null && <span className="font-semibold tabular-nums text-foreground">
                Best {numberFormat.format(best)}
              </span>}
            {isNew && <span className="sr-only">Not played yet.</span>}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="mt-3 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-auto border-t">
        <CollapsibleTrigger className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4">
          <span>Rules & details<span className="sr-only"> for {mode.name}</span></span>
          <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 text-sm sm:px-4">
          <p className="text-muted-foreground">{mode.description}</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {mode.specialRules.map(rule => <li key={rule} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-[hsl(var(--brand-500))]">•</span>
                <span>{rule}</span>
              </li>)}
          </ul>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs">
            <div className="flex gap-1">
              <dt className="text-muted-foreground">Score multiplier</dt>
              <dd className="font-semibold">{mode.rewards.scoreMultiplier}x</dd>
            </div>
            {mode.timeLimit && <div className="flex items-center gap-1">
                <dt className="flex items-center gap-1 text-muted-foreground"><Clock aria-hidden="true" className="h-3 w-3" />Time limit</dt>
                <dd className="font-semibold">{mode.timeLimit}s</dd>
              </div>}
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </li>;
}

export function AdvancedGameModes({
  onModeSelect,
  onBack
}: AdvancedGameModesProps) {
  const {
    playSound
  } = useSound();
  const bests = usePersonalBests();
  const played = useModesPlayed();

  const handleStart = (mode: AdvancedGameMode) => {
    playSound('game_start');
    onModeSelect(mode);
  };

  return <main className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background px-4 py-6 sm:p-6 relative overflow-hidden">
      <FloatingTiles />

      <div className="container mx-auto max-w-5xl px-0 relative z-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6 sm:mb-8 sm:items-center sm:gap-4">
          <Button variant="outline" onClick={onBack} className="h-11 shrink-0 hover:bg-muted/80">
            <span aria-hidden="true">←</span> Back
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              More modes
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Pick a mode to start. Open "Rules & details" to learn more.
            </p>
          </div>
        </div>

        {/* Mode tiles */}
        <ul className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {ADVANCED_MODES.filter(mode => mode.id !== 'weekly_gauntlet').map(mode => {
            const bestKey = getPersonalBestKey(mode.id);
            const best = bestKey ? bests[bestKey]?.score ?? null : null;
            // Modes without tracked results never get marked played, so only badge tracked ones
            const isNew = bestKey !== null && !played.includes(bestKey);
            return <ModeTile key={mode.id} mode={mode} best={best} isNew={isNew} onStart={handleStart} />;
          })}
        </ul>
      </div>
    </main>;
}
export default AdvancedGameModes;
