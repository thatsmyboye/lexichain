import { useEffect, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import TitleScreen from "@/components/TitleScreen";
import { FirstRunTutorial, shouldShowFirstRunTutorial } from "@/components/tutorial";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { useDailyStatus } from "@/components/daily/useDailyStatus";
import { DailyStatusBadge } from "@/components/daily/DailyStatusBadge";
import { usePersonalBests, useModesPlayed } from "@/lib/personalBests";
import { supabase } from "@/integrations/supabase/client";
import { useLoginStreak } from "@/hooks/useLoginStreak";
import type { User } from "@supabase/supabase-js";
import { AdvancedGameModes } from "@/components/game/AdvancedGameModes";
import { getModeName, DAILY_MODE_NAMES, MODE_BLURBS, type AdvancedGameMode, type DailyGameMode } from "@/lib/gameModes";
import PuzzleSelector from "@/components/game/PuzzleSelector";
import MiniMarathon from "@/components/game/MiniMarathon";
import WeeklyGauntlet from "@/components/game/WeeklyGauntlet";
import PrestigeEndless from "@/components/game/PrestigeEndless";
import { FloatingTiles } from "@/components/effects/FloatingTiles";
import { CalendarDays, ChevronRight, Grid3x3, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy load game component
const WordPathGame = lazy(() => import("@/components/game/WordPathGame"));

type SelectedGameMode = "classic" | "daily" | "daily_5x5" | "practice" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";

// Modes that can be deep-linked via ?mode=
const URL_MODES = ["time_attack", "endless", "puzzle", "survival", "zen", "chaos"] as const;
type UrlMode = typeof URL_MODES[number];
const isUrlMode = (mode: string): mode is UrlMode => (URL_MODES as readonly string[]).includes(mode);

// Display names for modes started from the main mode select (advanced modes use getModeName)
const BASIC_MODE_NAMES: Partial<Record<SelectedGameMode, string>> = {
  classic: "Classic",
  daily: "Daily Challenge",
  daily_5x5: "Daily Challenge 5x5",
  practice: "Challenge Practice"
};
const numberFormat = new Intl.NumberFormat();
const MODE_TILE_CLASS = "group relative flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-xl border bg-card/95 p-3 text-left text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-500)/0.6)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-col sm:items-start sm:p-4";
const MODE_ICON_CLASS = "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(265_80%_58%)] to-[hsl(265_84%_42%)] text-white shadow-sm";

// Daily tile on the mode select: icon, blurb, today's status and personal best
function DailyModeTile({ mode, onSelect }: { mode: DailyGameMode; onSelect: (mode: DailyGameMode) => void }) {
  const status = useDailyStatus(mode);
  const bests = usePersonalBests();
  const played = useModesPlayed();
  const best = bests[mode]?.score;
  // Today's saved game also counts as having played, before any result is recorded
  const isNew = !played.includes(mode) && status.state === "not_started";
  const Icon = mode === "daily" ? CalendarDays : Grid3x3;
  return <button type="button" onClick={() => onSelect(mode)} className={MODE_TILE_CLASS}>
      <span aria-hidden="true" className={MODE_ICON_CLASS}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-bold leading-tight">{DAILY_MODE_NAMES[mode]}</span>
          {isNew && <span className="rounded-full bg-[hsl(var(--brand-600))] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">New<span className="sr-only">, not played yet</span></span>}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{MODE_BLURBS[mode]}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <DailyStatusBadge status={status} />
          {best !== undefined && <span className="font-semibold tabular-nums">Best {numberFormat.format(best)}</span>}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
    </button>;
}

const Index = () => {
  const [showGame, setShowGame] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [showAdvancedModes, setShowAdvancedModes] = useState(false);
  const [showPuzzleSelector, setShowPuzzleSelector] = useState(false);
  const [showMiniMarathon, setShowMiniMarathon] = useState(false);
  const [showWeeklyGauntlet, setShowWeeklyGauntlet] = useState(false);
  const [showPrestigeEndless, setShowPrestigeEndless] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SelectedGameMode>("classic");
  const [selectedAdvancedMode, setSelectedAdvancedMode] = useState<AdvancedGameMode | null>(null);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Placeholder until the first-run tutorial is wired in by the lead
  // First visit opens the guided first game; the Tutorial button reopens it
  const [showTutorial, setShowTutorial] = useState(shouldShowFirstRunTutorial);
  const navigate = useNavigate();

  // Initialize login streak tracking
  const {
    streakData
  } = useLoginStreak(user);
  useEffect(() => {
    // Get current user and set up auth state listener
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      setUser(user);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.title = "Lexichain | Build word chains by reusing tiles";
    const desc = "Draw paths to make words. Each new word must reuse at least one tile. Keep chaining until no valid word remains.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
    const og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute("content", "Lexichain");
    const ogd = document.querySelector('meta[property="og:description"]');
    if (ogd) ogd.setAttribute("content", desc);
  }, []);

  // Check for URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode && isUrlMode(mode)) {
      setSelectedMode(mode);
      setSelectedAdvancedMode(mode);
      setShowGame(true);
    }
  }, []);
  const handlePlayClick = () => {
    setShowModeSelection(true);
  };
  const handleModeSelect = (mode: SelectedGameMode) => {
    setSelectedMode(mode);
    // Clear any previous advanced-mode selection so the header and back target match this mode
    setSelectedAdvancedMode(null);
    setShowModeSelection(false);
    setShowGame(true);
  };
  const handleBackToTitle = () => {
    setShowGame(false);
    setShowModeSelection(false);
    setShowAdvancedModes(false);
    setShowPuzzleSelector(false);
    setShowMiniMarathon(false);
    setShowWeeklyGauntlet(false);
    setShowPrestigeEndless(false);
    setSelectedPuzzleId(null);
  };
  const handleBackToAdvancedModes = () => {
    setShowGame(false);
    setShowAdvancedModes(true);
    setSelectedPuzzleId(null);
    // Keep selectedAdvancedMode set so user sees their last selection highlighted
  };
  const handleAdvancedModeSelect = (mode: AdvancedGameMode) => {
    // Special handling for puzzle mode
    if (mode === 'puzzle') {
      setShowAdvancedModes(false);
      setShowPuzzleSelector(true);
      return;
    }

    // Special handling for new advanced modes
    if (mode === 'mini_marathon') {
      setShowAdvancedModes(false);
      setShowMiniMarathon(true);
      return;
    }
    if (mode === 'weekly_gauntlet') {
      setShowAdvancedModes(false);
      setShowWeeklyGauntlet(true);
      return;
    }
    if (mode === 'prestige_endless') {
      setShowAdvancedModes(false);
      setShowPrestigeEndless(true);
      return;
    }
    setSelectedMode(mode); // Remaining modes (classic, time_attack, endless, survival, zen, chaos) are all SelectedGameMode
    setSelectedAdvancedMode(mode);
    setShowAdvancedModes(false);
    setShowGame(true);
  };
  const handlePuzzleSelect = (puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setSelectedMode('puzzle');
    setSelectedAdvancedMode('puzzle');
    setShowPuzzleSelector(false);
    setShowGame(true);
  };
  const handleBackToPuzzleSelector = () => {
    setShowPuzzleSelector(false);
    setShowAdvancedModes(true);
  };
  const handleShowAdvancedModes = () => {
    setShowModeSelection(false);
    setShowAdvancedModes(true);
  };
  const handleAdvancedModesFromTitle = () => {
    setShowAdvancedModes(true);
  };
  const handleBackToModeSelection = () => {
    setShowAdvancedModes(false);
    setShowModeSelection(true);
  };
  const handleLoginClick = () => {
    navigate("/auth?mode=login");
  };
  const handleRegisterClick = () => {
    navigate("/auth?mode=signup");
  };
  const handleStatsClick = () => {
    navigate("/stats");
  };
  const handleLeaderboardClick = () => {
    navigate("/leaderboard");
  };
  const handleSettingsClick = () => {
    navigate("/settings");
  };

  // Show new advanced modes
  if (showMiniMarathon) {
    return <MiniMarathon onBack={handleBackToTitle} />;
  }
  if (showWeeklyGauntlet) {
    return <WeeklyGauntlet onBack={handleBackToTitle} />;
  }
  if (showPrestigeEndless) {
    return <PrestigeEndless onBack={handleBackToTitle} />;
  }
  if (showPuzzleSelector) {
    return <PuzzleSelector onPuzzleSelect={handlePuzzleSelect} onBack={handleBackToPuzzleSelector} user={user} />;
  }
  if (showAdvancedModes) {
    return <AdvancedGameModes onModeSelect={handleAdvancedModeSelect} onBack={handleBackToModeSelection} />;
  }
  if (showGame) {
    const modeName = selectedAdvancedMode ? getModeName(selectedAdvancedMode) : BASIC_MODE_NAMES[selectedMode] ?? null;
    return <main>
        <header className="container mx-auto px-4 md:px-8 pt-3 md:pt-6 pb-2 md:pb-4 landscape-phone:sr-only">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Logo as="h1" size="sm" />
            {modeName && (
              <p className="text-base sm:text-lg md:text-xl font-semibold text-foreground/80">
                {modeName}
              </p>
            )}
          </div>
        </header>
        <Suspense fallback={<div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>}>
          <WordPathGame onBackToTitle={handleBackToTitle} onBackToAdvancedModes={selectedAdvancedMode ? handleBackToAdvancedModes : undefined} initialMode={selectedMode} initialPuzzleId={selectedPuzzleId || undefined} />
        </Suspense>
      </main>;
  }
  if (showModeSelection) {
    return <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted relative overflow-hidden px-4 py-8">
        <FloatingTiles />
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 text-center sm:gap-8">
          <Logo as="h1" size="md" />

          <section aria-labelledby="mode-select-title" className="w-full space-y-4">
            <h2 id="mode-select-title" className="text-xl font-semibold text-foreground sm:text-2xl">Choose a mode</h2>

            <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              <li className="flex"><DailyModeTile mode="daily" onSelect={handleModeSelect} /></li>
              <li className="flex"><DailyModeTile mode="daily_5x5" onSelect={handleModeSelect} /></li>
              <li className="flex">
                <button type="button" onClick={handleShowAdvancedModes} className={MODE_TILE_CLASS}>
                  <span aria-hidden="true" className={cn(MODE_ICON_CLASS, "from-slate-600 to-slate-800 dark:from-slate-500 dark:to-slate-700")}><LayoutGrid className="h-6 w-6" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold leading-tight">More modes</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">Classic, Time Attack, Survival, Zen and more.</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
                </button>
              </li>

              {/* PRESERVE FOR FUTURE USE - Challenge Practice Mode Temporarily Disabled
               <Button variant="outline" size="lg" onClick={() => handleModeSelect("practice")} className="px-12 py-4 text-lg">
                Challenge Practice
               </Button>
               */}
            </ul>

            <Button variant="ghost" size="lg" onClick={() => setShowModeSelection(false)} className="mt-2">
              Back
            </Button>
          </section>
        </div>
      </main>;
  }
  return <>
      <TitleScreen onPlayClick={handlePlayClick} onPlayDaily={handleModeSelect} onTutorialClick={() => setShowTutorial(true)} onAdvancedModesClick={handleAdvancedModesFromTitle} onLoginClick={handleLoginClick} onRegisterClick={handleRegisterClick} onStatsClick={handleStatsClick} onLeaderboardClick={handleLeaderboardClick} onSettingsClick={handleSettingsClick} streakData={streakData} user={user} />
      <FirstRunTutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
    </>;
};
export default Index;
