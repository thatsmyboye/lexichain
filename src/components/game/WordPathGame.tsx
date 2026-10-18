import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { computeBenchmarksFromWordCount, computeBoardSpecificBenchmarks, computeDynamicBenchmarks, type Benchmarks } from "@/lib/benchmarks";
import { analyzeBoardComposition } from "@/lib/boardAnalysis";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/achievements";
import { supabase } from "@/integrations/supabase/client";
import { useDailyChallengeState } from "@/hooks/useDailyChallengeState";
import { useGoals } from "@/hooks/useGoals";
import { useConsumables } from "@/hooks/useConsumables";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { ConsumableInventoryPanel, QuickUseBar } from "@/components/consumables/ConsumableInventory";
import { CONSUMABLES, type ConsumableId } from "@/lib/consumables";
import type { User } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ChevronDown, CircleHelp, Lightbulb, MoreVertical, Moon, Send, Sun, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { useTheme } from "next-themes";
import { getDailyChallengeDate } from "@/utils/dateUtils";
import { saveDailyChallengeResultBulletproof } from "@/utils/dailyChallengeResultSaver";
import { SpecialTilePreview } from "@/components/ui/special-tile-preview";
import { previewNextSpecialTiles } from "@/utils/specialTilePreview";
import { dictionaryManager } from "@/utils/dictionaryManager";
import { getPuzzleById, getNextPuzzle } from "@/lib/puzzleBoards";
import { useTileSkin } from "@/hooks/useTileSkin";
import { useSound } from "@/components/effects/SoundSystem";
import { useARIA } from "@/components/accessibility/ARIAComponents";
import { haptic } from "@/lib/feedback";
import { buildShareText, shareText } from "@/lib/share";
import { shareCardImage } from "@/lib/shareCard";
import { getPersonalBest, markModePlayed, recordResult } from "@/lib/personalBests";
import { recordTrophies } from "@/lib/trophies";
import { DefinableWord, DefinitionContent } from "./WordDefinition";
import {
  type WaveChallenge,
  type BossWave,
  type PowerUp,
  type ActivePowerUp,
  type ComboState,
  type ChoiceEvent,
  type PlayerPerformance,
  getRandomWaveChallenge,
  getRandomBossWave,
  getRandomPowerUp,
  POWER_UPS,
  shouldShowShop,
  shouldTriggerEvent
} from "@/lib/survivalMode";
import {
  validateWaveChallenge,
  isChallengeComplete,
  validateBossWave,
  updateCombo,
  applyPowerUpEffect,
  checkLifeRecovery,
  generateShopItems,
  generateRandomEvent,
  applyEventEffect,
  updatePerformance
} from "@/lib/survivalModeLogic";
import {
  LivesDisplay,
  WaveChallengeDisplay,
  BossWaveDisplay,
  ComboDisplay,
  PowerUpsInventory,
  ShopModal,
  ChoiceEventModal
} from "@/components/game/SurvivalModeUI";
import type { Pos, SpecialTile, SpecialTileType } from "@/types/game";
import { GameBoard, type BoardStamp, type PathTone } from "./GameBoard";
import { GameHud } from "./GameHud";
import { HowToPlayDialog } from "./HowToPlayDialog";
import { ResultsDialog, type ResultsSummary } from "./ResultsDialog";
import {
  ENHANCED_TILE_RARITIES, K_MIN_WORDS, MAX_DFS_NODES, SPECIAL_TILE_RARITIES,
  applyFreezeSpawnEffect, applyMagnetSpawnEffect, checkAndAwardAchievements,
  computeScoreBreakdown, constrainedRandomLetter, findPlayableWords,
  generateSolvableBoard, getDailyMovesLimit, getDailySeed, gradeForScore,
  handleBombBlast, handleShuffleTiles, handleXFactorTiles, isEnhancedPowerupsEnabled,
  keyOf, makeBoard, neighbors, probeGrid, processDecaySpread,
  seedRandom, validateAndFixQUAdjacency, within,
  type GameSettings, type Grade, type ScoreBreakdown,
} from "./wordPathEngine";

const MODE_LABELS: Record<string, string> = {
  classic: "Classic",
  daily: "Daily",
  daily_5x5: "Daily 5×5",
  practice: "Practice",
  time_attack: "Time Attack",
  endless: "Endless",
  puzzle: "Puzzle",
  survival: "Survival",
  zen: "Zen",
  chaos: "Chaos",
  target: "Target",
};

const LOADING_TIPS = [
  "Every word must reuse at least one tile from your previous word.",
  "Longer words score far more: a 7-letter word is worth about six 3-letter words.",
  "Rare letters like J, Q, X and Z add a big bonus.",
  "Tap tiles one by one, then tap the last tile again to submit.",
  "On a keyboard, just type the word and press Enter.",
  "Reusing more tiles from your last word raises the link multiplier.",
];

const GRADE_RANK: Record<Grade, number> = { None: 0, Bronze: 1, Silver: 2, Gold: 3, Platinum: 4 };

function reactionFor(points: number): string {
  if (points >= 400) return "Legendary";
  if (points >= 200) return "Huge";
  if (points >= 100) return "Great";
  return "Nice";
}

function offsetBenchmarks(bms: Benchmarks, offset: number): Benchmarks {
  if (!offset) return bms;
  return {
    ...bms,
    bronze: bms.bronze + offset,
    silver: bms.silver + offset,
    gold: bms.gold + offset,
    platinum: bms.platinum + offset,
  };
}

// Letters a path spells, respecting Ghost (no letter) and Mirror (repeat)
function wordForPath(path: Pos[], board: string[][] | null, specialTiles: SpecialTile[][]): string {
  if (!board) return "";
  const letters: string[] = [];
  for (const p of path) {
    const tile = specialTiles[p.r]?.[p.c];
    if (tile?.type === "ghost") continue;
    if (tile?.type === "mirror") {
      if (letters.length > 0) letters.push(letters[letters.length - 1]);
    } else {
      letters.push(board[p.r][p.c]);
    }
  }
  return letters.join("").toLowerCase();
}

const samePos = (a: Pos | undefined, b: Pos | undefined) => !!a && !!b && a.r === b.r && a.c === b.c;

function WordPathGame({
  onBackToTitle,
  onBackToAdvancedModes,
  initialMode = "classic",
  initialPuzzleId
}: {
  onBackToTitle?: () => void;
  onBackToAdvancedModes?: () => void;
  initialMode?: "classic" | "daily" | "daily_5x5" | "practice" | "time_attack" | "endless" | "puzzle" | "survival" | "zen" | "chaos";
  initialPuzzleId?: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  // Goal tracking runs for its side effects; no return values are consumed here.
  useGoals(user);
  const dailyChallengeState = useDailyChallengeState(getDailySeed());
  const dailyChallengeState5x5 = useDailyChallengeState(getDailySeed() + "-5x5");
  const {
    inventory: consumableInventory,
    activeEffects,
    // Not a hook: spends one item from the inventory
    useConsumable: spendConsumable,
    addActiveEffect,
    removeActiveEffect
  } = useConsumables(user);
  // Offline sync runs for its side effects; no return values are consumed here.
  useOfflineSync();
  const isMobile = useIsMobile();
  const { skin } = useTileSkin();
  const [size, setSize] = useState(4);
  const [board, setBoard] = useState<string[][] | null>(null);
  const [specialTiles, setSpecialTiles] = useState<SpecialTile[][]>(() => Array.from({
    length: size
  }, () => Array.from({
    length: size
  }, () => ({
    type: null
  }))));
  const [dailyChallengeInitialized, setDailyChallengeInitialized] = useState(false);
  const [path, setPath] = useState<Pos[]>([]);
  const [dragging, setDragging] = useState(false);
  const [usedWords, setUsedWords] = useState<{
    word: string;
    score: number;
    breakdown?: ScoreBreakdown;
  }[]>([]);
  const [lastWordTiles, setLastWordTiles] = useState<Set<string>>(new Set());
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [sorted, setSorted] = useState<string[] | null>(null);
  const [score, setScore] = useState(0);
  const [benchmarks, setBenchmarks] = useState<Benchmarks | null>(null);
  const [discoverableCount, setDiscoverableCount] = useState(0);
  const [unlocked, setUnlocked] = useState<Set<AchievementId>>(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [finalGrade, setFinalGrade] = useState<"None" | "Bronze" | "Silver" | "Gold" | "Platinum">("None");
  const [streak, setStreak] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [usedWordsExpanded, setUsedWordsExpanded] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    scoreThreshold: benchmarks?.bronze || 100,
    // Use Bronze threshold
    mode: "classic",
    targetTier: "silver",
    difficulty: "medium",
    gridSize: 4,
    dailyMovesLimit: getDailyMovesLimit()
  });
  const [showDifficultyDialog, setShowDifficultyDialog] = useState(false);
  const [affectedTiles, setAffectedTiles] = useState<Set<string>>(new Set());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [movesUsed, setMovesUsed] = useState(0);
  const [showWildDialog, setShowWildDialog] = useState(false);
  const [wildTileInputs, setWildTileInputs] = useState<Map<string, string>>(new Map());
  const [pendingWildPath, setPendingWildPath] = useState<Pos[] | null>(null);
  const [newWildTiles, setNewWildTiles] = useState<Set<string>>(new Set());

  // Consumable activation states
  const [activatedConsumables, setActivatedConsumables] = useState<Set<ConsumableId>>(new Set());

  // Advanced mode states
  const [timeAttackTimeRemaining, setTimeAttackTimeRemaining] = useState(60);
  const [timeAttackStarted, setTimeAttackStarted] = useState(false);
  const [timeAttackWordsFound, setTimeAttackWordsFound] = useState(0);
  const [timeAttackSpeedMultiplier, setTimeAttackSpeedMultiplier] = useState(1.0);
  const [endlessDifficulty, setEndlessDifficulty] = useState(1);

  // Enhanced Survival Mode State
  const [survivalLives, setSurvivalLives] = useState(3);
  const [survivalMaxLives, setSurvivalMaxLives] = useState(5);
  const [survivalWave, setSurvivalWave] = useState(1);
  const [survivalWordsThisWave, setSurvivalWordsThisWave] = useState(0);
  const [survivalBossWordRequired, setSurvivalBossWordRequired] = useState(false);
  const [survivalCurrentChallenge, setSurvivalCurrentChallenge] = useState<WaveChallenge | null>(null);
  const [survivalCurrentBoss, setSurvivalCurrentBoss] = useState<BossWave | null>(null);
  const [survivalChallengeProgress, setSurvivalChallengeProgress] = useState(0);
  const [survivalBossProgress, setSurvivalBossProgress] = useState(0);
  const [survivalWaveScore, setSurvivalWaveScore] = useState(0);
  const [survivalActivePowerUps, setSurvivalActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [survivalInventoryPowerUps, setSurvivalInventoryPowerUps] = useState<PowerUp[]>([]);
  const [survivalShields, setSurvivalShields] = useState(0);
  const [survivalComboState, setSurvivalComboState] = useState<ComboState>({
    currentCombo: 0,
    maxCombo: 0,
    comboMultiplier: 1.0,
    comboActive: false,
    lastWordTime: 0
  });
  const [survivalShowShop, setSurvivalShowShop] = useState(false);
  const [survivalPendingEvent, setSurvivalPendingEvent] = useState<ChoiceEvent | null>(null);
  const [survivalPerfectWaveStreak, setSurvivalPerfectWaveStreak] = useState(0);
  const [survivalLifeFragments, setSurvivalLifeFragments] = useState(0);
  const [survivalMistakesThisWave, setSurvivalMistakesThisWave] = useState(0);
  const [survivalPerformance, setSurvivalPerformance] = useState<PlayerPerformance>({
    averageWordLength: 4.5,
    averageCombo: 0,
    successRate: 1.0,
    averageTimePerWord: 5,
    mistakeCount: 0
  });
  const [survivalDifficultyFrozen, setSurvivalDifficultyFrozen] = useState(0);
  const [survivalChallengeTimeRemaining, setSurvivalChallengeTimeRemaining] = useState<number | undefined>(undefined);
  const [survivalPointsMultiplier, setSurvivalPointsMultiplier] = useState(1.0);

  const [zenHintsUsed, setZenHintsUsed] = useState(0);
  const [zenUndoStack, setZenUndoStack] = useState<Array<{board: string[][], specialTiles: SpecialTile[][], usedWords: typeof usedWords, score: number, lastWordTiles: Set<string>}>>([]);
  
  // Puzzle mode states
  const [puzzleMode, setPuzzleMode] = useState(false);
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string | null>(null);
  const [puzzleRequiredWords, setPuzzleRequiredWords] = useState<Set<string>>(new Set());
  const [puzzleFoundWords, setPuzzleFoundWords] = useState<Set<string>>(new Set());
  const [puzzleMovesRemaining, setPuzzleMovesRemaining] = useState(10);
  const [puzzleOptionalWords, setPuzzleOptionalWords] = useState<Set<string>>(new Set());
  const [endlessStarted, setEndlessStarted] = useState(false);
  const [survivalStarted, setSurvivalStarted] = useState(false);
  const [zenStarted, setZenStarted] = useState(false);
  const [chaosStarted, setChaosStarted] = useState(false);
  


  // Board interaction, feedback, and results
  const [focusPos, setFocusPos] = useState<Pos>({ r: 0, c: 0 });
  const [shakeKey, setShakeKey] = useState(0);
  const [stamp, setStamp] = useState<BoardStamp | null>(null);
  const [hintTiles, setHintTiles] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [wildError, setWildError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<ResultsSummary | null>(null);
  // Board at the start of the round, used for "words you missed" and daily resume
  const roundBoardRef = useRef<string[][] | null>(null);
  const timeAttackDeadlineRef = useRef(0);
  // Highest-scoring play this round, with the board it was played on (share card)
  const bestPlayRef = useRef<{ word: string; score: number; path: Pos[]; board: string[][] } | null>(null);
  // First-ever trophy unlocks earned this round, and whether we've already
  // celebrated beating the personal best
  const roundFirstTrophiesRef = useRef<AchievementId[]>([]);
  const bestCelebratedRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { playSound, isMuted, setMuted } = useSound();
  const { announce } = useARIA();
  const { resolvedTheme, setTheme } = useTheme();
  const loadingTip = useMemo(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)], []);

  // Initialize user auth
  useEffect(() => {
    const getUser = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => setUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);

  // Start daily challenge if initial mode is daily, start practice if practice mode
  useEffect(() => {
    if (initialMode === "daily") {
      setDailyChallengeInitialized(true);
      startDailyChallenge().catch(console.error);
    } else if (initialMode === "daily_5x5") {
      setDailyChallengeInitialized(true);
      startDaily5x5Challenge().catch(console.error);
    } else if (initialMode === "practice") {
      setDailyChallengeInitialized(true);
      startNewPracticeGame().catch(console.error);
    } else if (initialMode === "time_attack") {
      setSettings(prev => ({ ...prev, mode: "time_attack" }));
      setTimeAttackTimeRemaining(60);
      setTimeAttackStarted(false);
      setTimeAttackWordsFound(0);
      setTimeAttackSpeedMultiplier(1.0);
    } else if (initialMode === "endless") {
      setSettings(prev => ({ ...prev, mode: "endless" }));
      setEndlessDifficulty(1);
    } else if (initialMode === "puzzle") {
      setSettings(prev => ({ ...prev, mode: "puzzle" }));
      // Puzzle initialization is handled by loadPuzzle() when initialPuzzleId is provided
    } else if (initialMode === "survival") {
      setSettings(prev => ({ ...prev, mode: "survival" }));
      setSurvivalLives(3);
      setSurvivalWave(1);
    } else if (initialMode === "zen") {
      setSettings(prev => ({ ...prev, mode: "zen" }));
      setZenHintsUsed(0);
      setZenUndoStack([]);
      setZenStarted(true);
    } else if (initialMode === "chaos") {
      setSettings(prev => ({ ...prev, mode: "chaos" }));
    }
  }, [initialMode, dailyChallengeInitialized]);

  // Modes you've opened lose their "New" badge in the mode picker
  useEffect(() => {
    markModePlayed(initialMode);
  }, [initialMode]);

  // Time Attack clock: driven by a deadline so re-renders and word submissions
  // never gain or lose time. Word bonuses push the deadline out.
  useEffect(() => {
    if (settings.mode !== "time_attack" || !timeAttackStarted || gameOver) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timeAttackDeadlineRef.current - Date.now()) / 1000));
      setTimeAttackTimeRemaining(prev => (prev === remaining ? prev : remaining));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [settings.mode, timeAttackStarted, gameOver]);

  // Clock side effects (warnings, ticking, game over) run here, not inside a
  // state updater, so they fire exactly once per second boundary.
  const prevTimeRef = useRef(timeAttackTimeRemaining);
  useEffect(() => {
    const prev = prevTimeRef.current;
    prevTimeRef.current = timeAttackTimeRemaining;
    if (settings.mode !== "time_attack" || !timeAttackStarted || gameOver || prev === timeAttackTimeRemaining) return;
    if (timeAttackTimeRemaining === 30) announce("30 seconds remaining");
    if (timeAttackTimeRemaining === 10) announce("10 seconds left", "assertive");
    if (timeAttackTimeRemaining > 0 && timeAttackTimeRemaining <= 10) playSound("tick");
    if (timeAttackTimeRemaining <= 0) {
      endGame({ title: "Time's up!", reason: `You found ${timeAttackWordsFound} word${timeAttackWordsFound === 1 ? "" : "s"} against the clock.`, finalScore: score });
    }
  }, [timeAttackTimeRemaining, settings.mode, timeAttackStarted, gameOver]);

  // Save standard game result and update goals when game ends
  const saveGameResult = useCallback(async () => {
    if (settings.mode === "daily" || settings.mode === "daily_5x5" || settings.mode === "practice" || !gameOver) return;
    if (!user) {
      console.log("Cannot save game result - user not logged in");
      return;
    }

    const longestWord = usedWords.reduce((longest, wordEntry) => wordEntry.word.length > longest.length ? wordEntry.word : longest, "");

    try {
      const gameResult = {
        user_id: user.id,
        score: score,
        words_found: usedWords.length,
        longest_word: longestWord,
        moves_used: movesUsed,
        time_played: Math.round((Date.now() - gameStartTime) / 1000),
        achievement_grade: finalGrade,
        achievements_unlocked: Array.from(unlocked),
        grid_size: size,
        game_mode: settings.mode
      };

      const { error } = await supabase
        .from("standard_game_results")
        .insert(gameResult);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving game result:", error);
      toast.error("Failed to save game result");
    }
  }, [settings.mode, settings.difficulty, gameOver, user, usedWords, score, finalGrade, movesUsed, gameStartTime, size, unlocked]);

  // Bulletproof daily challenge result saving (handles both daily and daily_5x5)
  const saveDailyChallengeResult = async () => {
    if (!user || (settings.mode !== "daily" && settings.mode !== "daily_5x5") || !gameOver) return;
    
    // Prepare enhanced data for the progressive save strategy
    const detailedAnalysis = analyzeBoardComposition(board);
    const enhancedData = {
      board_analysis: {
        gridSize: detailedAnalysis.gridSize,
        wordCount: discoverableCount,
        rarityScore: detailedAnalysis.rarityScorePotential,
        avgWordLength: detailedAnalysis.avgWordLength,
        connectivityScore: detailedAnalysis.connectivityScore,
        maxScorePotential: detailedAnalysis.maxScorePotential,
        difficultyScore: detailedAnalysis.difficultyScore
      },
      word_count: discoverableCount,
      grid_size: board.length
    };
    
    // Save board analysis to database separately (non-blocking)
    try {
      const challengeDate = getDailyChallengeDate();
      await supabase.rpc('save_daily_challenge_board_analysis', {
        challenge_date: challengeDate,
        word_count: discoverableCount,
        grid_size: board.length,
        rarity_score_potential: detailedAnalysis.rarityScorePotential,
        avg_word_length: detailedAnalysis.avgWordLength,
        connectivity_score: detailedAnalysis.connectivityScore,
        max_score_potential: detailedAnalysis.maxScorePotential,
        letter_distribution: Object.fromEntries(detailedAnalysis.letterDistribution),
        // p_game_mode removed - not in RPC signature
      });
    } catch (boardAnalysisError) {
      console.warn('Failed to save board analysis (non-critical):', boardAnalysisError);
    }
    
    // Use bulletproof save (progress feedback UI was removed, so no onProgress callback)
    const saveSuccess = await saveDailyChallengeResultBulletproof(
      user,
      score,
      finalGrade,
      enhancedData,
      undefined,
      settings.mode
    );

    if (!saveSuccess) {
      console.log('[Daily Challenge] Result saved to local backup for later sync');
    }
  };

  // Save game result exactly once when game ends
  const resultSavedRef = useRef(false);
  useEffect(() => {
    if (!gameOver) {
      resultSavedRef.current = false;
      return;
    }
    if (resultSavedRef.current || !user) return;
    resultSavedRef.current = true;
    if (settings.mode === "daily" || settings.mode === "daily_5x5") {
      saveDailyChallengeResult();
    } else {
      saveGameResult();
    }
  }, [gameOver, user, settings.mode]);

  // Save daily challenge state (shared logic for both daily and daily_5x5 modes)
  const saveDailyStateForMode = async (
    mode: "daily" | "daily_5x5",
    initialBoardToSave?: string[][],
    immediate = false,
    options?: {
      skipModeCheck?: boolean;
      benchmarksOverride?: Benchmarks | null;
      discoverableCountOverride?: number;
      /** When starting a fresh game, pass full initial state to avoid stale closure values */
      initialState?: Record<string, unknown>;
    }
  ) => {
    if (!options?.skipModeCheck && settings.mode !== mode) return;
    const stateHook = mode === "daily" ? dailyChallengeState : dailyChallengeState5x5;
    const seed = mode === "daily" ? getDailySeed() : getDailySeed() + "-5x5";
    const gameState = options?.initialState
      ? { ...options.initialState, seed }
      : {
          board,
          // The board the day started with — needed to recompute benchmarks on resume
          initialBoard: initialBoardToSave ?? roundBoardRef.current ?? board,
          specialTiles,
          usedWords,
          score,
          streak,
          movesUsed,
          unlocked: Array.from(unlocked),
          gameOver,
          finalGrade,
          lastWordTiles: Array.from(lastWordTiles),
          seed,
          benchmarks: options?.benchmarksOverride !== undefined ? options.benchmarksOverride : benchmarks,
          discoverableCount: options?.discoverableCountOverride !== undefined ? options.discoverableCountOverride : discoverableCount
        };
    await stateHook.saveState(gameState as Parameters<typeof stateHook.saveState>[0], immediate);
  };


  // Load daily challenge state (shared logic for both daily and daily_5x5 modes)
  const loadDailyStateForMode = async (mode: "daily" | "daily_5x5") => {
    const stateHook = mode === "daily" ? dailyChallengeState : dailyChallengeState5x5;
    const gameState = await stateHook.loadState();
    if (gameState && gameState.board && gameState.initialBoard) {
      roundBoardRef.current = gameState.initialBoard;
      setGameStartTime(Date.now());
      setBoard(gameState.board);
      setSpecialTiles(gameState.specialTiles);
      setUsedWords(gameState.usedWords);
      setScore(gameState.score);
      setStreak(gameState.streak);
      setMovesUsed(gameState.movesUsed);
      setUnlocked(new Set(gameState.unlocked as AchievementId[]));
      setGameOver(gameState.gameOver);
      setFinalGrade(gameState.finalGrade);
      setLastWordTiles(new Set(gameState.lastWordTiles || []));

      if (gameState.benchmarks && gameState.discoverableCount !== undefined) {
        console.log("📊 Benchmarks restored from saved state:", gameState.benchmarks);
        setBenchmarks(gameState.benchmarks);
        setDiscoverableCount(gameState.discoverableCount);
      } else if (dict && sorted && gameState.initialBoard) {
        console.log("📊 Dictionary loaded, recalculating benchmarks from initialBoard...");
        const config = mode === "daily_5x5" ? DAILY_5X5_CONFIG : DIFFICULTY_CONFIG["medium"];
        const probe = probeGrid(gameState.initialBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        const bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        console.log("📊 Benchmarks recalculated from initialBoard:", bms);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
      } else {
        console.log("📊 No benchmarks in saved state, dictionary status:", {
          dict: !!dict,
          sorted: !!sorted,
          hasInitialBoard: !!gameState.initialBoard
        });
      }
      return { gameState, hasInitialBoard: true };
    }
    return false;
  };

  // Persist daily progress whenever it changes (the hook debounces writes).
  // Saving from an effect means the saved state is never one move behind.
  useEffect(() => {
    if (isInitializing || !board || board.length === 0 || !roundBoardRef.current) return;
    if (settings.mode !== "daily" && settings.mode !== "daily_5x5") return;
    saveDailyStateForMode(settings.mode, undefined, gameOver);
  }, [usedWords, score, gameOver, specialTiles, board, movesUsed, isInitializing, settings.mode]);

  // Puzzle mode helpers
  const savePuzzleCompletion = async (finalScore: number, movesRemaining: number, optionalFound: number) => {
    if (!user || !currentPuzzleId) return;
    const puzzle = getPuzzleById(currentPuzzleId);
    if (!puzzle) return;
    try {
      const { error } = await supabase
        .from('puzzle_completions')
        .upsert({
          user_id: user.id,
          puzzle_id: currentPuzzleId,
          moves_used: puzzle.maxMoves - movesRemaining,
          optional_words_found: optionalFound,
          score: finalScore,
          completed_at: new Date().toISOString()
        });
      if (error) throw error;
    } catch (err) {
      console.error('Error saving puzzle completion:', err);
    }
  };

  const loadPuzzle = (puzzleId: string) => {
    const puzzle = getPuzzleById(puzzleId);
    if (!puzzle || !dict || !sorted) return;
    
    setPuzzleMode(true);
    setCurrentPuzzleId(puzzleId);
    setPuzzleRequiredWords(new Set(puzzle.requiredWords.map(w => w.toUpperCase())));
    setPuzzleFoundWords(new Set());
    setPuzzleMovesRemaining(puzzle.maxMoves);
    setPuzzleOptionalWords(new Set((puzzle.optionalWords || []).map(w => w.toUpperCase())));
    
    // Set the fixed puzzle board
    setBoard(puzzle.board.map(row => [...row]));
    setSize(puzzle.board.length);
    setUsedWords([]);
    setScore(0);
    setStreak(0);
    setGameOver(false);
    setFinalGrade("None");
    clearPath();
    setSpecialTiles(createEmptySpecialTilesGrid(puzzle.board.length));
    setLastWordTiles(new Set());
    setMovesUsed(0);
    setUnlocked(new Set());
    markRoundStart(puzzle.board);
    
    // Calculate benchmarks for the puzzle board
    const probe = probeGrid(puzzle.board, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
    const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
    setBenchmarks(bms);
    setDiscoverableCount(probe.words.size);
    
    announce(`${puzzle.name} loaded. Find all required words in ${puzzle.maxMoves} moves.`);
  };

  // Enhanced dictionary loading useEffect
  useEffect(() => {
    let mounted = true;
    setIsInitializing(true);
    
    dictionaryManager.loadDictionary()
      .then(({ dict, sorted, status }) => {
        if (!mounted) return;
        
        setDict(dict);
        setSorted(sorted);
        console.log("📖 Enhanced dictionary loaded:", status);
        
          // Only generate a board for classic mode or when no specific mode is set
          // Daily mode handles its own board generation
          if (!initialMode || initialMode === "classic" || initialMode === "time_attack" || initialMode === "zen" || initialMode === "endless" || initialMode === "puzzle" || initialMode === "survival" || initialMode === "chaos") {
            setIsGenerating(true);
            let newBoard: string[][];
            let probe: ReturnType<typeof probeGrid>;
            let bms: Benchmarks | null = null;
            
            // Puzzle mode boards are loaded via loadPuzzle(), skip board generation here
            if (initialMode !== "puzzle") {
              newBoard = generateSolvableBoard(size, dict, sorted);
              probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
              bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
              
              if (!mounted) return;
              setBoard(newBoard);
              if (bms) setBenchmarks(bms);
              setDiscoverableCount(probe.words.size);
              setUnlocked(new Set());
              setGameOver(false);
              setFinalGrade("None");
              setPath([]);
              setDragging(false);
              setUsedWords([]);
              setLastWordTiles(new Set());
              setScore(0);
              setStreak(0);
              setMovesUsed(0);
              setIsGenerating(false);
              markRoundStart(newBoard);
              announce("Board ready");
              
              // Endless and Zen have no clock, so they start right away
              if (initialMode === "endless") {
                setEndlessStarted(true);
                setEndlessDifficulty(1);
              }
              if (initialMode === "zen") setZenStarted(true);
            } else {
              // Puzzle mode - just load dictionary, board will be loaded via loadPuzzle()
              setIsGenerating(false);
            }
          }
          setIsInitializing(false);
        })
        .catch((error) => {
          if (!mounted) return;
          console.error("Dictionary loading failed:", error);
          setIsInitializing(false);
          toast.error("Failed to load dictionary. Please refresh the page.");
        });
    
    return () => {
      mounted = false;
    };
  }, [initialMode, size]);
  
  // Puzzle mode initialization
  useEffect(() => {
    if (initialPuzzleId && dict && sorted && !puzzleMode) {
      loadPuzzle(initialPuzzleId);
    }
  }, [initialPuzzleId, dict, sorted]);

  // Dictionary-ready benchmark calculation for daily challenges
  useEffect(() => {
    if (dict && sorted && (settings.mode === "daily" || settings.mode === "daily_5x5") && board && !benchmarks && !isGenerating) {
      console.log("📊 Dictionary loaded, recalculating benchmarks for resumed daily challenge...");
      setIsGenerating(true);
      try {
        const config = settings.mode === "daily_5x5" ? DAILY_5X5_CONFIG : DIFFICULTY_CONFIG[settings.difficulty || "medium"];
        const probe = probeGrid(board, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        const bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        console.log("📊 Benchmarks recalculated:", bms);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        toast.success("Daily Challenge benchmarks loaded!");
      } catch (error) {
        console.error("Failed to recalculate benchmarks:", error);
        toast.error("Failed to load challenge benchmarks");
      } finally {
        setIsGenerating(false);
      }
    }
  }, [dict, sorted, settings.mode, board, benchmarks, isGenerating, settings.difficulty]);

  // Resolves the word from the path, handling Ghost (skip) and Mirror (copy previous) tiles
  const wordFromPath = useMemo(() => {
    if (!board) return "";
    const letters: string[] = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const tile = specialTiles[p.r][p.c];
      if (tile.type === "ghost") continue; // Ghost contributes no letter
      if (tile.type === "mirror") {
        if (letters.length > 0) {
          letters.push(letters[letters.length - 1]); // Copy previous letter
        }
        // If no previous letter exists, mirror contributes nothing
      } else {
        letters.push(board[p.r][p.c]);
      }
    }
    return letters.join("").toLowerCase();
  }, [path, board, specialTiles]);

  // Display version that shows ? for Wild, Ghost as a bridge icon, Mirror as mirrored letter
  const displayWordFromPath = useMemo(() => {
    const parts: string[] = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const tile = specialTiles[p.r][p.c];
      if (tile.type === "wild") {
        parts.push("?");
      } else if (tile.type === "ghost") {
        // Ghost is skipped in display — it contributes no letter
        continue;
      } else if (tile.type === "mirror" && parts.length > 0) {
        parts.push(parts[parts.length - 1]);
      } else {
        parts.push(board[p.r][p.c]);
      }
    }
    return parts.join("").toUpperCase();
  }, [path, board, specialTiles]);

  // Display-only status for the traced word — validation itself still happens
  // on submit; this just tells the player what will happen before they release.
  type PathWordStatus = { state: "short" | "wild" | "valid" | "invalid" | "used" | "nolink"; label: string };
  const pathWordStatus: PathWordStatus | null = useMemo(() => {
    if (!path.length || !board) return null;
    if (path.some(p => specialTiles[p.r][p.c].type === "wild")) {
      return { state: "wild", label: "Wild — pick letter on submit" };
    }
    const word = wordFromPath;
    if (word.length < 3) {
      const needed = 3 - word.length;
      return { state: "short", label: `${needed} more letter${needed === 1 ? "" : "s"}` };
    }
    if (!dict) return null;
    if (!dict.has(word)) return { state: "invalid", label: "Not a word" };
    if (usedWords.some(entry => entry.word === word)) return { state: "used", label: "Already used" };
    if (lastWordTiles.size > 0 && !path.some(p => lastWordTiles.has(keyOf(p)))) {
      return { state: "nolink", label: "Reuse a tile from last word" };
    }
    return { state: "valid", label: "Valid" };
  }, [path, board, specialTiles, wordFromPath, dict, usedWords, lastWordTiles]);

  // ---------------------------------------------------------------------------
  // Word submission. Every accepted word — traced, typed, or completed through
  // the Wild-letter dialog — goes through validateWordForPlay + commitWord, so
  // scoring and mode rules can't drift between paths.
  // ---------------------------------------------------------------------------

  const isDailyMode = settings.mode === "daily" || settings.mode === "daily_5x5";
  const isBoardLocked = !gameOver && (
    (settings.mode === "time_attack" && !timeAttackStarted) ||
    (settings.mode === "survival" && !survivalStarted) ||
    (settings.mode === "chaos" && !chaosStarted)
  );

  function markRoundStart(newBoard: string[][]) {
    setGameStartTime(Date.now());
    bestPlayRef.current = null;
    roundFirstTrophiesRef.current = [];
    bestCelebratedRef.current = false;
    roundBoardRef.current = newBoard.map(row => [...row]);
    setShowResults(false);
    setResults(null);
    setHintTiles(new Set());
    setFeedback(null);
    setStamp(null);
    setActivatedConsumables(new Set());
  }

  function flashFeedback(message: string) {
    setFeedback(message);
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 1800);
  }

  // Returns a reason the word can't be played, or null if it's playable
  function validateWordForPlay(word: string, wordPath: Pos[]): string | null {
    if (word.length < 3) return "Words need at least 3 letters";
    if (!dictionaryManager.validateWord(word).isValid) return `${word.toUpperCase()} is not a word`;
    if (usedWords.some(entry => entry.word === word)) return `${word.toUpperCase()} was already used`;
    if (wordPath.some(p => specialTiles[p.r][p.c].type === "stone")) return "Stone tiles are blocked";
    if (lastWordTiles.size > 0 && !wordPath.some(p => lastWordTiles.has(keyOf(p)))) {
      return "Reuse a tile from your last word";
    }
    return null;
  }

  // Invalid attempt: shake, buzz, red flash on the word bar, and (in Survival)
  // the combo breaks unless a Safety Net is active.
  function rejectWord(message: string, countsAsMistake = true) {
    setShakeKey(k => k + 1);
    flashFeedback(message);
    playSound("word_invalid");
    haptic("invalid");
    announce(message, "assertive");
    clearPath();
    if (countsAsMistake && settings.mode === "survival" && survivalStarted) {
      const hasSafetyNet = survivalActivePowerUps.some(ap => ap.powerUp.type === "safety_net" && (ap.remainingUses ?? 0) > 0);
      const { newCombo } = updateCombo(survivalComboState, false, hasSafetyNet);
      setSurvivalComboState(newCombo);
      setSurvivalMistakesThisWave(prev => prev + 1);
      if (hasSafetyNet) {
        setSurvivalActivePowerUps(prev => {
          let consumed = false;
          return prev.map(ap => {
            if (!consumed && ap.powerUp.type === "safety_net" && (ap.remainingUses ?? 0) > 0) {
              consumed = true;
              return { ...ap, remainingUses: (ap.remainingUses ?? 1) - 1 };
            }
            return ap;
          }).filter(ap => ap.remainingUses === undefined || ap.remainingUses > 0);
        });
        toast.info("🛡️ Safety Net kept your combo alive");
      } else if (survivalComboState.currentCombo > 1) {
        announce("Combo broken");
      }
    }
  }

  function wildPositionsOf(wordPath: Pos[]) {
    return wordPath.filter(p => specialTiles[p.r][p.c].type === "wild");
  }

  function handleWildSubmit() {
    if (!pendingWildPath || !dict || !board) return;
    const wildcardPositions = wildPositionsOf(pendingWildPath);
    if (wildcardPositions.length === 0) return;

    const submittedWildLetters = wildcardPositions.map(pos => (wildTileInputs.get(`${pos.r}-${pos.c}`) || "").toLowerCase());
    if (submittedWildLetters.some(letter => !/^[a-z]$/.test(letter))) {
      setWildError("Enter a letter for every Wild tile.");
      return;
    }

    // Build the word with the chosen letters, respecting Ghost/Mirror behavior
    const letters: string[] = [];
    let wildLetterIndex = 0;
    for (const p of pendingWildPath) {
      const tile = specialTiles[p.r][p.c];
      if (tile.type === "wild") {
        letters.push(submittedWildLetters[wildLetterIndex++] || "");
      } else if (tile.type === "ghost") {
        continue;
      } else if (tile.type === "mirror") {
        if (letters.length > 0) letters.push(letters[letters.length - 1]);
      } else {
        letters.push(board[p.r][p.c]);
      }
    }
    const testWord = letters.join("").toLowerCase();
    const reason = validateWordForPlay(testWord, pendingWildPath);
    if (reason) {
      setWildError(reason);
      return;
    }

    const submittedPath = [...pendingWildPath];
    setShowWildDialog(false);
    setWildTileInputs(new Map());
    setPendingWildPath(null);
    setWildError(null);
    commitWord(testWord, submittedPath, submittedWildLetters);
  }

  function cancelWildDialog() {
    setShowWildDialog(false);
    setWildTileInputs(new Map());
    setPendingWildPath(null);
    setWildError(null);
  }

  function commitWord(actualWord: string, wordPath: Pos[], wildLetters: string[]) {
    if (!board || !dict || !sorted || gameOver || isBoardLocked) return;
    const wildUsed = wildLetters.length > 0;
    const prevScore = score;
    const dailySeedForMode = settings.mode === "daily_5x5" ? getDailySeed() + "-5x5" : getDailySeed();
    const turnNumber = usedWords.length + 1;
    // Daily boards use seeded randomness for tile effects so every player who
    // reaches the same state sees the same result.
    const effectRng = isDailyMode ? seedRandom(`${dailySeedForMode}_effects_${turnNumber}`) : Math.random;

    // 1. Wild letters become permanent letters on the board
    let trackedBoard = board.map(row => [...row]);
    let trackedSpecialTiles = specialTiles.map(row => row.map(tile => ({ ...tile })));
    if (wildUsed) {
      const wildcardPositions = wildPositionsOf(wordPath);
      wildcardPositions.forEach((pos, i) => {
        if (wildLetters[i]) trackedBoard[pos.r][pos.c] = wildLetters[i].toUpperCase();
      });
      if (wildLetters.some(l => l.toUpperCase() === "Q")) {
        trackedBoard = validateAndFixQUAdjacency(trackedBoard, size, undefined, undefined, true).board;
      }
    }

    const playBoard = trackedBoard.map(row => [...row]);

    // 2. Score (one formula for every path)
    const breakdown = computeScoreBreakdown({
      actualWord,
      wordPath,
      board: trackedBoard,
      specialTiles: trackedSpecialTiles,
      lastWordTiles,
      streak,
      mode: settings.mode,
      timeAttackSpeedMultiplier,
      activeEffects,
      baseMode: "hybrid"
    });
    if (wildUsed) {
      wordPath.forEach(p => {
        if (trackedSpecialTiles[p.r][p.c].type === "wild") {
          trackedSpecialTiles[p.r][p.c] = { type: null, frozen: trackedSpecialTiles[p.r][p.c].frozen };
        }
      });
    }

    // 3. Zen undo snapshot of the pre-move state
    if (settings.mode === "zen") {
      setZenUndoStack(prev => [...prev.slice(-19), {
        board: board.map(row => [...row]),
        specialTiles: specialTiles.map(row => row.map(tile => ({ ...tile }))),
        usedWords: [...usedWords],
        score,
        lastWordTiles: new Set(lastWordTiles)
      }]);
    }

    // 4. The score multiplier consumable lasts for one word
    if (activeEffects.some(e => e.id === "score_multiplier")) {
      removeActiveEffect("score_multiplier");
      setActivatedConsumables(prev => {
        const next = new Set(prev);
        next.delete("score_multiplier");
        return next;
      });
    }

    // 5. Special tile effects, threading board state through each step
    const xFactorResult = handleXFactorTiles(wordPath, trackedSpecialTiles, trackedBoard, size, setBoard, setSpecialTiles, setAffectedTiles);
    const xChanged = xFactorResult.xChanged;
    trackedBoard = xFactorResult.board;
    trackedSpecialTiles = xFactorResult.specialTiles;
    trackedBoard = handleShuffleTiles(wordPath, trackedSpecialTiles, trackedBoard, size, setBoard, setAffectedTiles);
    for (const bombPos of wordPath.filter(p => trackedSpecialTiles[p.r][p.c].type === "bomb")) {
      const bombResult = handleBombBlast(bombPos, trackedBoard, trackedSpecialTiles, size, setBoard, setSpecialTiles, setAffectedTiles);
      trackedBoard = bombResult.board;
      trackedSpecialTiles = bombResult.specialTiles;
    }

    let newSpecialTiles = trackedSpecialTiles.map(row => row.map(tile => ({ ...tile })));
    wordPath.forEach(p => {
      if (newSpecialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = { ...newSpecialTiles[p.r][p.c], type: null };
      }
    });

    // Decay spreads in every mode where Decay tiles can appear (incl. daily)
    const decayResult = processDecaySpread(newSpecialTiles, trackedBoard, size, effectRng);
    newSpecialTiles = decayResult.tiles;
    trackedBoard = decayResult.board;

    newSpecialTiles = clearOrphanedFrozen(expireSpecialTiles(newSpecialTiles));

    // Survival: Stone Crusher clears every stone after the next word
    if (settings.mode === "survival" && survivalActivePowerUps.some(ap => ap.powerUp.type === "stone_crusher")) {
      newSpecialTiles = newSpecialTiles.map(row => row.map(tile => (tile.type === "stone" ? { type: null, frozen: tile.frozen } : tile)));
      announce("Stone Crusher cleared the stones");
    }

    // 6. Achievements
    const sharedTilesCount = lastWordTiles.size ? wordPath.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;
    const { newAchievements, achievementBonus } = checkAndAwardAchievements(
      actualWord, wordPath, usedWords, unlocked, 0, sharedTilesCount, multiplier, xChanged, wildUsed, board
    );

    // 7. Mode progression
    const gain = settings.mode === "survival" ? processSurvivalWord(actualWord, wordPath, breakdown.total) : breakdown.total;
    processTimeAttackWord(actualWord);
    const finalScore = score + gain + achievementBonus;
    const countsMove = isDailyMode || settings.mode === "puzzle" || settings.mode === "chaos" || settings.mode === "practice";
    const movesAfter = movesUsed + (countsMove ? 1 : 0);

    if (!bestPlayRef.current || gain > bestPlayRef.current.score) {
      bestPlayRef.current = { word: actualWord, score: gain, path: wordPath, board: playBoard };
    }
    const nextUsedWords = [...usedWords, { word: actualWord, score: gain, breakdown }];
    setUsedWords(nextUsedWords);
    setScore(finalScore);
    if (newAchievements.length) {
      setUnlocked(prev => {
        const next = new Set(prev);
        newAchievements.forEach(id => next.add(id));
        return next;
      });
    }
    setLastWordTiles(new Set(wordPath.map(keyOf)));
    if (countsMove) setMovesUsed(movesAfter);
    clearPath();

    // 8. Feedback
    const previousBest = getPersonalBest(settings.mode)?.score ?? null;
    const beatBest = previousBest !== null && !bestCelebratedRef.current && prevScore <= previousBest && finalScore > previousBest;
    if (beatBest) bestCelebratedRef.current = true;
    setStamp({ id: Date.now(), label: beatBest ? "New best!" : reactionFor(gain), points: gain });
    playSound("word_complete");
    haptic("valid");
    const prevGrade = gradeForScore(prevScore, benchmarks);
    const newGrade = gradeForScore(finalScore, benchmarks);
    const tierUp = settings.mode !== "endless" && settings.mode !== "puzzle" && GRADE_RANK[newGrade] > GRADE_RANK[prevGrade];
    if (tierUp) {
      setTimeout(() => playSound("tier_up"), 250);
      haptic("tierUp");
    }
    if (beatBest && !tierUp) {
      setTimeout(() => playSound("tier_up"), 250);
      haptic("tierUp");
    }
    announce(`${actualWord.toUpperCase()} accepted, plus ${gain} points. Score ${finalScore}.${tierUp ? ` ${newGrade} medal reached!` : ""}${beatBest ? " New personal best!" : ""}`);
    const firstUnlocks = recordTrophies(newAchievements);
    roundFirstTrophiesRef.current.push(...firstUnlocks);
    newAchievements.forEach(id => {
      const achievement = ACHIEVEMENTS[id];
      const rarityEmoji = { common: "🏆", rare: "⭐", epic: "💎", legendary: "👑" }[achievement.rarity];
      const first = firstUnlocks.includes(id);
      toast.success(`${rarityEmoji} ${first ? "New trophy: " : ""}${achievement.label} (+${achievement.scoreBonus} pts)`);
    });
    if (newAchievements.length) playSound("achievement");

    // 9. Special tiles spawn after every word
    let newWildPositions: string[] = [];
    const spawned: string[] = [];
    if (isDailyMode) {
      const result = introduceSeededSpecialTiles(newSpecialTiles, trackedBoard, turnNumber, size, dailySeedForMode);
      newSpecialTiles = result.tiles;
      trackedBoard = result.board;
      newWildPositions = result.newWildPositions;
      spawned.push(...result.spawned);
    } else {
      const emptyPositions: Pos[] = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (newSpecialTiles[r][c].type === null) emptyPositions.push({ r, c });
        }
      }
      const tilesToPlace = Math.min(Math.floor(Math.random() * 3) + 1, emptyPositions.length);
      for (let i = 0; i < tilesToPlace; i++) {
        const pos = emptyPositions.splice(Math.floor(Math.random() * emptyPositions.length), 1)[0];
        const specialTile = generateSpecialTile(score, settings.mode, settings.mode === "endless" ? endlessDifficulty : 1);
        if (specialTile.type === null) continue;
        const existingFrozen = newSpecialTiles[pos.r][pos.c].frozen;
        newSpecialTiles[pos.r][pos.c] = { ...specialTile, frozen: existingFrozen || specialTile.frozen };
        spawned.push(`${specialTile.type} at row ${pos.r + 1} column ${pos.c + 1}`);
        if (specialTile.type === "wild") newWildPositions.push(keyOf(pos));
        if (specialTile.type === "magnet") trackedBoard = applyMagnetSpawnEffect(pos, trackedBoard, newSpecialTiles, size);
        if (specialTile.type === "freeze") newSpecialTiles = applyFreezeSpawnEffect(pos, newSpecialTiles, size);
      }
    }
    if (spawned.length) announce(`New special tile${spawned.length > 1 ? "s" : ""}: ${spawned.join("; ")}`);
    if (newWildPositions.length > 0) {
      setNewWildTiles(prev => new Set([...prev, ...newWildPositions]));
      setTimeout(() => {
        setNewWildTiles(prev => {
          const updated = new Set(prev);
          newWildPositions.forEach(key => updated.delete(key));
          return updated;
        });
      }, 1200);
    }

    // 10. Chaos: reshuffle 3–7 unfrozen tiles after every word; sometimes a
    // special tile turns into a trap
    if (settings.mode === "chaos") {
      const chaos = applyChaosReshuffle(trackedBoard, newSpecialTiles);
      trackedBoard = chaos.board;
      newSpecialTiles = chaos.specialTiles;
    }

    setBoard(trackedBoard);
    setSpecialTiles(newSpecialTiles);

    // 11. Puzzle progress
    if (puzzleMode && currentPuzzleId) {
      const upper = actualWord.toUpperCase();
      const found = new Set([...puzzleFoundWords, upper]);
      const remainingMoves = puzzleMovesRemaining - 1;
      setPuzzleFoundWords(found);
      setPuzzleMovesRemaining(remainingMoves);
      const required = Array.from(puzzleRequiredWords);
      const foundRequired = required.filter(w => found.has(w)).length;
      if (foundRequired === required.length) {
        const puzzle = getPuzzleById(currentPuzzleId);
        const optionalFound = Array.from(found).filter(w => puzzleOptionalWords.has(w)).length;
        savePuzzleCompletion(finalScore, remainingMoves, optionalFound);
        endGame({
          title: "🧩 Puzzle complete!",
          reason: `All required words found${optionalFound ? ` plus ${optionalFound} bonus word${optionalFound === 1 ? "" : "s"}` : ""}${puzzle ? ` in ${puzzle.maxMoves - remainingMoves} moves` : ""}.`,
          finalScore,
          showGrade: false,
          words: nextUsedWords,
        });
        return;
      }
      if (remainingMoves <= 0) {
        endGame({
          title: "Puzzle incomplete",
          reason: `Out of moves. You found ${foundRequired}/${required.length} required words.`,
          finalScore,
          showGrade: false,
          words: nextUsedWords,
        });
        return;
      }
    }

    resolveTurnEnd({
      board: trackedBoard,
      specialTiles: newSpecialTiles,
      mustReuse: new Set(wordPath.map(keyOf)),
      used: new Set([...usedWords.map(entry => entry.word), actualWord]),
      finalScore,
      prevScore,
      movesAfter,
      words: nextUsedWords,
    });
  }

  function applyChaosReshuffle(currentBoard: string[][], tiles: SpecialTile[][]) {
    const newBoard = currentBoard.map(row => [...row]);
    let newTiles = tiles;
    const positions: Pos[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Freeze protects tiles from being replaced
        if (!tiles[r][c].frozen) positions.push({ r, c });
      }
    }
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const letterCounts = new Map<string, number>();
    for (const row of newBoard) for (const ch of row) letterCounts.set(ch, (letterCounts.get(ch) || 0) + 1);
    const changed = new Set<string>();
    const count = Math.min(Math.floor(Math.random() * 5) + 3, positions.length);
    for (let i = 0; i < count; i++) {
      const pos = positions[i];
      const old = newBoard[pos.r][pos.c];
      letterCounts.set(old, (letterCounts.get(old) || 1) - 1);
      newBoard[pos.r][pos.c] = constrainedRandomLetter(letterCounts);
      changed.add(keyOf(pos));
    }
    const validatedBoard = validateAndFixQUAdjacency(newBoard, size, undefined, undefined, false).board;

    // 20%: a helpful tile turns into a trap
    if (Math.random() < 0.2) {
      const specials: Pos[] = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const t = tiles[r][c].type;
          if (t === "multiplier" || t === "xfactor" || t === "wild") specials.push({ r, c });
        }
      }
      if (specials.length > 0) {
        const trapPos = specials[Math.floor(Math.random() * specials.length)];
        const trapType = tiles[trapPos.r][trapPos.c].type;
        newTiles = tiles.map(row => row.map(t => ({ ...t })));
        newTiles[trapPos.r][trapPos.c] = { type: null, frozen: newTiles[trapPos.r][trapPos.c].frozen };
        if (trapType === "multiplier" || trapType === "xfactor") {
          const emptyPos: Pos[] = [];
          for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (newTiles[r][c].type === null) emptyPos.push({ r, c });
          for (let i = 0; i < Math.min(3, emptyPos.length); i++) {
            const pos = emptyPos.splice(Math.floor(Math.random() * emptyPos.length), 1)[0];
            // Trap stones expire like every other stone
            newTiles[pos.r][pos.c] = { type: "stone", expiryTurns: Math.floor(Math.random() * 3) + 3 };
          }
          toast.warning("⚠️ Trap! A special tile spawned stones");
        } else {
          toast.warning("⚠️ Trap! A Wild tile fizzled out");
        }
      }
    }

    setAffectedTiles(changed);
    setTimeout(() => setAffectedTiles(new Set()), 700);
    return { board: validatedBoard, specialTiles: newTiles };
  }

  // After each word: end the round, or refresh the board, when moves run out
  // or no playable word remains. Stone, Wild, Ghost, and Mirror tiles and the
  // chain rule are all respected (see findPlayableWords).
  function resolveTurnEnd(state: {
    board: string[][];
    specialTiles: SpecialTile[][];
    mustReuse: Set<string>;
    used: Set<string>;
    finalScore: number;
    prevScore: number;
    movesAfter: number;
    words: { word: string; score: number }[];
  }) {
    if (!dict || !sorted) return;
    const { finalScore, prevScore, movesAfter, words: playedWords } = state;
    const end = (title: string, reason: string) =>
      endGame({ title, reason, finalScore, prevScore, words: playedWords, movesUsedFinal: movesAfter });

    if (isDailyMode && movesAfter >= settings.dailyMovesLimit) {
      end("Daily Challenge complete", `You used all ${settings.dailyMovesLimit} moves.`);
      return;
    }
    if (settings.mode === "practice" && movesAfter >= settings.dailyMovesLimit) {
      end("Practice complete", `You used all ${settings.dailyMovesLimit} moves.`);
      return;
    }
    if (settings.mode === "chaos" && movesAfter >= 15) {
      end("🔀 Chaos round complete", "You survived all 15 moves.");
      return;
    }

    const { words, truncated } = findPlayableWords({
      board: state.board,
      specialTiles: state.specialTiles,
      mustReuse: state.mustReuse,
      wordSet: dict,
      sortedArr: sorted,
      used: state.used,
      limit: 1,
    });
    if (words.length > 0 || truncated) return;

    // No playable word remains
    switch (settings.mode) {
      case "endless": {
        const nextLevel = endlessDifficulty + 1;
        setEndlessDifficulty(nextLevel);
        refreshBoard(finalScore);
        setStamp({ id: Date.now(), label: `Level ${nextLevel}`, points: 0 });
        announce(`Board cleared. Level ${nextLevel}.`);
        return;
      }
      case "zen":
      case "chaos":
      case "time_attack":
        refreshBoard(finalScore);
        toast.info("No words left — here's a fresh board. Your score carries over.");
        announce("No words left. New board.");
        return;
      case "survival":
        loseLife(finalScore, playedWords);
        return;
      default: {
        const unblocked = findPlayableWords({
          board: state.board,
          specialTiles: state.specialTiles.map(row => row.map(t => (t.type === "stone" ? { type: null } : t))),
          mustReuse: state.mustReuse,
          wordSet: dict,
          sortedArr: sorted,
          used: state.used,
          limit: 1,
        });
        end("Round over", unblocked.words.length ? "Stone tiles blocked every remaining word." : "No playable words remain.");
      }
    }
  }

  // Fresh solvable board for modes that carry score across boards. Tier
  // thresholds are recomputed for the new board and offset by the carried
  // score so the medal track measures progress on this board.
  function refreshBoard(carriedScore: number) {
    if (!dict || !sorted) return;
    const newBoard = generateSolvableBoard(size, dict, sorted);
    const probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
    setBoard(newBoard);
    setSpecialTiles(createEmptySpecialTilesGrid(size));
    setUsedWords([]);
    setLastWordTiles(new Set());
    setStreak(0);
    setBenchmarks(offsetBenchmarks(computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS), carriedScore));
    setDiscoverableCount(probe.words.size);
    roundBoardRef.current = newBoard.map(row => [...row]);
    setZenUndoStack([]);
    setAffectedTiles(new Set(newBoard.flatMap((row, r) => row.map((_, c) => keyOf({ r, c })))));
    setTimeout(() => setAffectedTiles(new Set()), 600);
  }

  // Survival: shields and Life Link absorb a hit before a life is lost
  function loseLife(finalScore: number, playedWords: { word: string; score: number }[]) {
    if (survivalShields > 0) {
      setSurvivalShields(prev => prev - 1);
      refreshBoard(finalScore);
      toast.success("🛡️ Your shield absorbed the hit — fresh board!");
      announce("Shield absorbed the hit. New board.");
      return;
    }
    const lifeLink = survivalActivePowerUps.find(ap => ap.powerUp.type === "life_link");
    if (lifeLink) {
      setSurvivalActivePowerUps(prev => prev.filter(ap => ap !== lifeLink));
      refreshBoard(finalScore);
      toast.success("💚 Life Link absorbed the hit — fresh board!");
      announce("Life Link absorbed the hit. New board.");
      return;
    }
    const newLives = survivalLives - 1;
    setSurvivalLives(Math.max(0, newLives));
    if (newLives <= 0) {
      endGame({
        title: "💀 Survival over",
        reason: `Out of lives on wave ${survivalWave}.`,
        finalScore,
        showGrade: false,
        words: playedWords,
        extraStats: [
          { label: "Wave reached", value: String(survivalWave) },
          { label: "Best combo", value: String(survivalComboState.maxCombo) },
        ],
      });
      return;
    }
    const newWave = survivalWave + 1;
    setSurvivalWave(newWave);
    refreshBoard(finalScore);
    setStamp({ id: Date.now(), label: `Wave ${newWave}`, points: 0 });
    toast.warning(`💔 No words left — you lost a life. ${newLives} remaining.`);
    announce(`No words left. You lost a life, ${newLives} remaining. Wave ${newWave}.`, "assertive");
  }

  function endGame(opts: {
    title: string;
    reason: string;
    finalScore: number;
    prevScore?: number;
    showGrade?: boolean;
    extraStats?: { label: string; value: string }[];
    words?: { word: string; score: number }[];
    movesUsedFinal?: number;
  }) {
    if (gameOver) return;
    let finalScore = opts.finalScore;
    // Clutch Finish: the final word of the round lifted you into a new tier
    if (
      opts.prevScore !== undefined && benchmarks && !unlocked.has("clutch") &&
      GRADE_RANK[gradeForScore(finalScore, benchmarks)] > GRADE_RANK[gradeForScore(opts.prevScore, benchmarks)]
    ) {
      finalScore += ACHIEVEMENTS.clutch.scoreBonus;
      setUnlocked(prev => new Set([...prev, "clutch" as AchievementId]));
      roundFirstTrophiesRef.current.push(...recordTrophies(["clutch"]));
      toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`);
    }
    const showGrade = opts.showGrade ?? (!!benchmarks && settings.mode !== "endless" && settings.mode !== "puzzle");
    const grade = showGrade ? gradeForScore(finalScore, benchmarks) : "None";

    setScore(finalScore);
    setFinalGrade(grade);
    setGameOver(true);
    clearPath();
    setHintTiles(new Set());

    const wordsList = opts.words ?? usedWords;
    const longestWord = wordsList.reduce((longest, w) => (w.word.length > longest.length ? w.word : longest), "");
    const bestWord = wordsList.reduce<{ word: string; score: number } | null>(
      (best, w) => (!best || w.score > best.score ? { word: w.word, score: w.score } : best), null);
    let missedWords: string[] = [];
    let discoverable = 0;
    const sourceBoard = roundBoardRef.current ?? board;
    if (dict && sorted && sourceBoard) {
      const usedSet = new Set(wordsList.map(w => w.word));
      const probe = probeGrid(sourceBoard, dict, sorted, 400, 60000);
      discoverable = Math.max(probe.words.size, wordsList.length);
      missedWords = Array.from(probe.words)
        .filter(w => !usedSet.has(w))
        .sort((a, b) => b.length - a.length || a.localeCompare(b))
        .slice(0, 10);
    }
    const pb = recordResult(settings.mode, { score: finalScore, words: wordsList.length, longestWord, grade });
    const stats = [...(opts.extraStats ?? [])];
    if (settings.mode === "endless") stats.push({ label: "Level reached", value: String(endlessDifficulty) });
    if (isDailyMode) stats.push({ label: "Moves used", value: `${Math.min(opts.movesUsedFinal ?? movesUsed, settings.dailyMovesLimit)}/${settings.dailyMovesLimit}` });

    setResults({
      title: opts.title,
      reason: opts.reason,
      grade,
      showGrade,
      score: finalScore,
      wordsFound: wordsList.length,
      discoverable,
      longestWord,
      bestWord,
      missedWords,
      stats,
      personalBest: { isNew: pb.isNewBest, previous: pb.previous?.score ?? null },
      newTrophies: [...roundFirstTrophiesRef.current],
    });
    // Let the last word's stamp land before the results appear
    setTimeout(() => setShowResults(true), 900);
    playSound("game_over");
    haptic("gameOver");
    announce(`${opts.title}. ${opts.reason} Final score ${finalScore}${showGrade && grade !== "None" ? `, ${grade} medal` : ""}.`, "assertive");
  }

  function clearPath() {
    pathRef.current = [];
    typedRef.current = null;
    setPath([]);
    setDragging(false);
  }

  // Special tile generation functions
  function generateSpecialTile(currentScore: number = 0, gameMode: string = "classic", endlessDifficultyLevel: number = 1): SpecialTile {
    const rand = Math.random();
    let cumulative = 0;

    // Use enhanced rarities if toggle is on and mode is not daily
    const useEnhanced = isEnhancedPowerupsEnabled() && gameMode !== "daily" && gameMode !== "daily_5x5";
    const baseRarities: Record<string, number> = useEnhanced ? { ...ENHANCED_TILE_RARITIES } : { ...SPECIAL_TILE_RARITIES };

    // Progressive stone spawning for classic mode
    if (gameMode === "classic") {
      // Progressive stone spawn rate: base 0.05 + (score/1000) * 0.10, capped at 0.35
      const baseStoneRate = 0.05;
      const progressiveRate = Math.min(0.25, (currentScore / 1000) * 0.10);
      baseRarities.stone = baseStoneRate + progressiveRate;
    } else if (gameMode === "endless") {
      // Endless mode: difficulty affects special tile rarities
      const difficultyFactor = Math.min(1.0, endlessDifficultyLevel / 10);

      const baseStoneRate = 0.15;
      const maxStoneRate = 0.40;
      baseRarities.stone = baseStoneRate + (maxStoneRate - baseStoneRate) * difficultyFactor;

      const helpfulReduction = 1 - difficultyFactor * 0.3;
      baseRarities.wild = (baseRarities.wild || 0.05) * helpfulReduction;
      baseRarities.multiplier = (baseRarities.multiplier || 0.12) * helpfulReduction;
      baseRarities.xfactor = (baseRarities.xfactor || 0.08) * helpfulReduction;

      // Normalize rarities to ensure they sum to a reasonable probability
      const totalRarity = Object.values(baseRarities).reduce((sum, r) => sum + r, 0);
      if (totalRarity > 0.5) {
        const scale = 0.5 / totalRarity;
        Object.keys(baseRarities).forEach(key => {
          baseRarities[key] *= scale;
        });
      }
    }

    for (const [type, rarity] of Object.entries(baseRarities)) {
      cumulative += rarity;
      if (rand <= cumulative) {
        // Calculate expiry turns based on tile type
        let expiryTurns: number;
        if (type === "stone" && gameMode === "endless") {
          const difficultyFactor = Math.min(1.0, endlessDifficultyLevel / 10);
          const baseMin = 3;
          const baseMax = 5;
          const maxMin = 8;
          const maxMax = 12;
          const minTurns = Math.floor(baseMin + (maxMin - baseMin) * difficultyFactor);
          const maxTurns = Math.floor(baseMax + (maxMax - baseMax) * difficultyFactor);
          expiryTurns = Math.floor(Math.random() * (maxTurns - minTurns + 1)) + minTurns;
        } else {
          // Tile-specific expiry ranges
          expiryTurns = getExpiryTurnsForType(type);
        }

        if (type === "multiplier") {
          const multiplierValues = [2, 3, 4];
          const value = multiplierValues[Math.floor(Math.random() * multiplierValues.length)];
          return {
            type: type as SpecialTileType,
            value,
            expiryTurns
          };
        }
        return {
          type: type as SpecialTileType,
          expiryTurns
        };
      }
    }
    return {
      type: null
    };
  }

  // Returns appropriate expiry turns for each tile type
  function getExpiryTurnsForType(type: string): number {
    switch (type) {
      case "freeze": return Math.floor(Math.random() * 3) + 3;   // 3-5
      case "decay": return 3;
      case "mirror": return Math.floor(Math.random() * 2) + 2;   // 2-3
      case "magnet": return Math.floor(Math.random() * 2) + 3;   // 3-4
      case "bomb": return 2;
      case "chain": return Math.floor(Math.random() * 2) + 3;    // 3-4
      case "ghost": return 2;
      case "tax": return Math.floor(Math.random() * 3) + 3;      // 3-5
      default: return Math.floor(Math.random() * 5) + 1;         // 1-5 (existing tiles)
    }
  }
  function shouldIntroduceSpecialTiles(wordCount: number): boolean {
    return wordCount >= 1;
  }

  // Seeded special tile generation for Daily Challenge mode
  // Ensures all players get the same special tiles at the same positions
  function generateSeededSpecialTile(rng: () => number): SpecialTile {
    const rand = rng();
    let cumulative = 0;
    
    // Daily challenge uses enhanced rarities (all special tile types)
    const dailyRarities = { ...ENHANCED_TILE_RARITIES };

    for (const [type, rarity] of Object.entries(dailyRarities)) {
      cumulative += rarity;
      if (rand <= cumulative) {
        // Use seeded random for expiry turns based on tile type
        const expiryTurns = Math.floor(rng() * 3) + 2;

        if (type === "multiplier") {
          const multiplierValues = [2, 3, 4];
          const value = multiplierValues[Math.floor(rng() * multiplierValues.length)];
          return {
            type: type as SpecialTileType,
            value,
            expiryTurns
          };
        }
        return {
          type: type as SpecialTileType,
          expiryTurns
        };
      }
    }
    return {
      type: null
    };
  }

  // Introduces special tiles deterministically for Daily Challenge mode.
  // All players with the same seed and word count get identical tiles, and
  // Freeze/Magnet spawn effects apply with seeded randomness, as in other modes.
  function introduceSeededSpecialTiles(
    currentSpecialTiles: SpecialTile[][],
    currentBoard: string[][],
    wordCount: number,
    gridSize: number,
    dailySeed: string
  ): { tiles: SpecialTile[][], board: string[][], newWildPositions: string[], spawned: string[] } {
    let updatedSpecialTiles = currentSpecialTiles.map(row => [...row]);
    let updatedBoard = currentBoard;
    const emptyPositions: Pos[] = [];

    // Consistent (row-major) ordering for deterministic position selection
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (updatedSpecialTiles[r][c].type === null) emptyPositions.push({ r, c });
      }
    }
    if (emptyPositions.length === 0) {
      return { tiles: updatedSpecialTiles, board: updatedBoard, newWildPositions: [], spawned: [] };
    }

    const tileCountRng = seedRandom(dailySeed + "_tiles_" + wordCount);
    const tilesToPlace = Math.min(Math.floor(tileCountRng() * 3) + 1, emptyPositions.length);
    const newWildPositions: string[] = [];
    const spawned: string[] = [];

    const shuffledPositions = [...emptyPositions];
    const shuffleRng = seedRandom(dailySeed + "_shuffle_" + wordCount);
    for (let i = shuffledPositions.length - 1; i > 0; i--) {
      const j = Math.floor(shuffleRng() * (i + 1));
      [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
    }

    for (let i = 0; i < tilesToPlace; i++) {
      const pos = shuffledPositions[i];
      const tileRng = seedRandom(dailySeed + "_tile_" + wordCount + "_" + i);
      const specialTile = generateSeededSpecialTile(tileRng);
      if (specialTile.type === null) continue;
      updatedSpecialTiles[pos.r][pos.c] = { ...specialTile, frozen: updatedSpecialTiles[pos.r][pos.c].frozen };
      spawned.push(`${specialTile.type} at row ${pos.r + 1} column ${pos.c + 1}`);
      if (specialTile.type === "wild") newWildPositions.push(keyOf(pos));
      if (specialTile.type === "magnet") updatedBoard = applyMagnetSpawnEffect(pos, updatedBoard, updatedSpecialTiles, gridSize, tileRng);
      if (specialTile.type === "freeze") updatedSpecialTiles = applyFreezeSpawnEffect(pos, updatedSpecialTiles, gridSize);
    }

    return { tiles: updatedSpecialTiles, board: updatedBoard, newWildPositions, spawned };
  }
  function createEmptySpecialTilesGrid(size: number): SpecialTile[][] {
    return Array.from({
      length: size
    }, () => Array.from({
      length: size
    }, () => ({
      type: null
    })));
  }
  function expireSpecialTiles(specialTiles: SpecialTile[][]): SpecialTile[][] {
    return specialTiles.map(row => row.map(tile => {
      if (tile.type !== null && tile.expiryTurns !== undefined) {
        const newExpiryTurns = tile.expiryTurns - 1;
        if (newExpiryTurns <= 0) {
          // Expire the tile but keep its frozen flag; clearOrphanedFrozen
          // removes it only if no adjacent Freeze tile remains
          return { type: null, frozen: tile.frozen };
        }
        return {
          ...tile,
          expiryTurns: newExpiryTurns
        };
      }
      return tile;
    }));
  }

  // Clear frozen flags from tiles whose adjacent Freeze tile is gone
  function clearOrphanedFrozen(tiles: SpecialTile[][]): SpecialTile[][] {
    const n = tiles.length;
    return tiles.map((row, r) => row.map((tile, c) => {
      if (!tile.frozen) return tile;
      const stillFrozen = [
        { r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 },
      ].some(adj => within(adj.r, adj.c, n) && tiles[adj.r][adj.c].type === "freeze");
      return stillFrozen ? tile : { ...tile, frozen: false };
    }));
  }

  // Difficulty configurations
  const DIFFICULTY_CONFIG = {
    easy: {
      gridSize: 4,
      minWords: 8,
      scoreMultiplier: 0.7
    },
    medium: {
      gridSize: 4,
      minWords: 12,
      scoreMultiplier: 1.0
    },
    hard: {
      gridSize: 5,
      minWords: 18,
      scoreMultiplier: 1.3
    },
    expert: {
      gridSize: 6,
      minWords: 25,
      scoreMultiplier: 1.6
    }
  };
  // 5x5 daily challenge uses minWords calibrated for 5x5 grids (hard config).
  // Using medium's minWords (12) would miscalibrate benchmarks since 5x5 has far more valid words.
  const DAILY_5X5_CONFIG = { minWords: DIFFICULTY_CONFIG.hard.minWords };
  function onNewGame() {
    setShowDifficultyDialog(true);
  }
  
  function onEndGame() {
    if (gameOver) return;
    endGame({ title: "Game ended", reason: "You ended the game.", finalScore: score });
  }
  
  function startGameWithDifficulty(difficulty: "easy" | "medium" | "hard" | "expert") {
    // An abandoned classic game in progress is saved as-is
    if (settings.mode === "classic" && !gameOver && (score > 0 || usedWords.length > 0)) {
      saveGameResult();
    }
    
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode: "classic"
    }));
    setSize(newSize);
    setShowDifficultyDialog(false);
    if (dict && sorted) {
      setIsGenerating(true);
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
      try {
        const newBoard = generateSolvableBoard(newSize, dict, sorted);
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES);
        const adjustedWordCount = Math.floor(probe.words.size * config.scoreMultiplier);
        const bms = computeBenchmarksFromWordCount(adjustedWordCount, config.minWords);
        setBoard(newBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        setUnlocked(new Set());
        setGameOver(false);
        setFinalGrade("None");
        markRoundStart(newBoard);
        announce(`New ${difficulty} board ready`);
      } finally {
        setIsGenerating(false);
      }
    } else {
      const nb = makeBoard(newSize);
      setBoard(nb);
      setBenchmarks(null);
      setDiscoverableCount(0);
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    }
  }
  async function startNewPracticeGame() {
    const difficulty = "medium"; // Challenge Practice uses same config as Daily Challenge
    const config = DIFFICULTY_CONFIG[difficulty];
    const newSize = config.gridSize;
    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode: "practice",
      dailyMovesLimit: getDailyMovesLimit() // Use same 10-move limit as Daily Challenge
    }));
    setSize(newSize);
    if (dict && sorted) {
      setIsGenerating(true);
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
      setGameOver(false);
      setFinalGrade("None");
      setUnlocked(new Set());
      try {
        const newBoard = generateSolvableBoard(newSize, dict, sorted);
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);

        // Use same benchmark calculation as Daily Challenge
        let bms: Benchmarks;
        try {
          if (probe.analysis && user) {
            const {
              supabase
            } = await import('@/integrations/supabase/client');
            bms = await computeDynamicBenchmarks(`practice-${Date.now()}`,
            // Unique seed for practice
            probe.words.size, config.minWords, probe.analysis, supabase, 'practice');
          } else {
            bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
          }
        } catch (error) {
          console.warn("Failed to compute dynamic benchmarks, falling back to static:", error);
          bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        }
        setBoard(newBoard);
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        markRoundStart(newBoard);
        announce("New practice board ready");
      } catch (error) {
        console.error("Failed to generate practice board:", error);
        toast.error("Failed to generate new practice board");
      } finally {
        setIsGenerating(false);
      }
    } else {
      const nb = makeBoard(newSize);
      setBoard(nb);
      setBenchmarks(null);
      setDiscoverableCount(0);
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      setPath([]);
      setDragging(false);
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    }
  }
  async function startDailyChallengeForMode(mode: "daily" | "daily_5x5") {
    const difficulty = "medium";
    const config = mode === "daily_5x5" ? DAILY_5X5_CONFIG : DIFFICULTY_CONFIG[difficulty];
    const newSize = mode === "daily" ? DIFFICULTY_CONFIG.medium.gridSize : 5;
    const dailySeed = mode === "daily" ? getDailySeed() : getDailySeed() + "-5x5";
    const dailyLabel = mode === "daily" ? "Daily Challenge" : "5x5 Daily Challenge";

    const loadResult = await loadDailyStateForMode(mode);
    if (loadResult && loadResult.gameState) {
      setSettings(prev => ({
        ...prev,
        difficulty,
        gridSize: newSize,
        mode,
        dailyMovesLimit: getDailyMovesLimit()
      }));
      setSize(newSize);
      announce(`${dailyLabel} resumed`);
      return;
    }

    setSettings(prev => ({
      ...prev,
      difficulty,
      gridSize: newSize,
      mode,
      dailyMovesLimit: getDailyMovesLimit()
    }));
    setSize(newSize);
    const newBoard = makeBoard(newSize, dailySeed);
    if (mode === "daily") {
      console.log(`Daily Challenge board generated with seed ${dailySeed}:`, newBoard[0].join(''), newBoard[1].join(''), newBoard[2].join(''), newBoard[3].join(''));
    }

    setPath([]);
    setDragging(false);
    setUsedWords([]);
    setLastWordTiles(new Set());
    setScore(0);
    setStreak(0);
    setMovesUsed(0);
    setUnlocked(new Set());
    setGameOver(false);
    setFinalGrade("None");
    setSpecialTiles(createEmptySpecialTilesGrid(newSize));
    setBoard(newBoard);
    markRoundStart(newBoard);

    if (dict && sorted) {
      setIsGenerating(true);
      try {
        const probe = probeGrid(newBoard, dict, sorted, config.minWords, MAX_DFS_NODES, true);
        let bms: Benchmarks;
        try {
          if (probe.analysis && user) {
            bms = await computeDynamicBenchmarks(dailySeed, probe.words.size, config.minWords, probe.analysis, supabase, mode);
          } else if (probe.analysis) {
            bms = computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis);
          } else {
            bms = computeBenchmarksFromWordCount(probe.words.size, config.minWords);
          }
        } catch (error) {
          console.error(`Error computing ${mode} benchmarks, falling back to static:`, error);
          bms = probe.analysis ? computeBoardSpecificBenchmarks(probe.words.size, config.minWords, probe.analysis) : computeBenchmarksFromWordCount(probe.words.size, config.minWords);
        }
        setBenchmarks(bms);
        setDiscoverableCount(probe.words.size);
        announce(`${dailyLabel} ready. ${getDailyMovesLimit()} moves to make your best score.`);

        const initialState = {
          board: newBoard,
          initialBoard: newBoard,
          specialTiles: createEmptySpecialTilesGrid(newSize),
          usedWords: [] as { word: string; score: number; breakdown?: ScoreBreakdown }[],
          score: 0,
          streak: 0,
          movesUsed: 0,
          unlocked: [] as AchievementId[],
          gameOver: false,
          finalGrade: "None" as const,
          lastWordTiles: [] as string[],
          benchmarks: bms,
          discoverableCount: probe.words.size
        };
        await saveDailyStateForMode(mode, newBoard, true, { skipModeCheck: true, initialState });
      } finally {
        setIsGenerating(false);
      }
    } else {
      setBenchmarks(null);
      setDiscoverableCount(0);
      const initialState = {
        board: newBoard,
        initialBoard: newBoard,
        specialTiles: createEmptySpecialTilesGrid(newSize),
        usedWords: [] as { word: string; score: number; breakdown?: ScoreBreakdown }[],
        score: 0,
        streak: 0,
        movesUsed: 0,
        unlocked: [] as AchievementId[],
        gameOver: false,
        finalGrade: "None" as const,
        lastWordTiles: [] as string[]
      };
      await saveDailyStateForMode(mode, newBoard, true, { skipModeCheck: true, initialState });
    }
  }

  async function startDailyChallenge() {
    return startDailyChallengeForMode("daily");
  }

  async function startDaily5x5Challenge() {
    return startDailyChallengeForMode("daily_5x5");
  }

  // Consumable handlers
  const handleUseConsumable = async (consumableId: ConsumableId) => {
    if (!user || gameOver) return;
    const consumable = CONSUMABLES[consumableId];

    // Check if consumable can be used in current mode
    if (consumable.dailyModeOnly && settings.mode !== "daily" && settings.mode !== "daily_5x5") {
      toast.error("This consumable can only be used in Daily Challenge mode");
      return;
    }

    // Check inventory
    if (!consumableInventory[consumableId] || consumableInventory[consumableId].quantity <= 0) {
      toast.error("You don't have any of this consumable");
      return;
    }

    // Handle different consumable activation patterns
    switch (consumableId) {
      case "hint_revealer": {
        // Only consume the item when there is something to reveal
        const candidates = playableNow();
        if (candidates.length === 0) {
          toast.info("No playable words to hint right now");
          return;
        }
        const success = await spendConsumable(consumableId);
        if (!success) {
          toast.error("Failed to use consumable");
          return;
        }
        handleHintRevealer(candidates);
        break;
      }
      case "extra_moves": {
        // Extra moves execute immediately on tap
        const successMoves = await spendConsumable(consumableId);
        if (!successMoves) {
          toast.error("Failed to use consumable");
          return;
        }
        handleExtraMoves();
        break;
      }
      case "hammer": {
        // Hammer immediately breaks all stone tiles on the grid
        if (path.length > 0) {
          toast.error("Cannot use hammer while a word is in progress");
          return;
        }
        
        // Check if user has hammer consumables in inventory
        if (!consumableInventory.hammer || consumableInventory.hammer.quantity <= 0) {
          toast.error("No hammer consumables available");
          return;
        }

        const brokenCount = await breakAllStoneTiles();
        if (brokenCount === 0) {
          toast.error("No stone tiles to break!");
          return;
        }
        break;
      }
      case "score_multiplier": {
        // Score multiplier activates/deactivates on tap, executes on word submission
        if (activatedConsumables.has(consumableId)) {
          // Deactivate if already activated
          setActivatedConsumables(prev => {
            const newSet = new Set(prev);
            newSet.delete(consumableId);
            return newSet;
          });
          removeActiveEffect(consumableId);
          toast.info("Score multiplier deactivated");
        } else {
          const successMultiplier = await spendConsumable(consumableId);
          if (!successMultiplier) {
            toast.error("Failed to use consumable");
            return;
          }
          setActivatedConsumables(prev => new Set([...prev, consumableId]));
          handleScoreMultiplier();
        }
        break;
      }
    }
  };


  // Words playable right now: respects stones, the chain rule, used words,
  // and Wild/Ghost/Mirror tiles, at any length.
  function playableNow(limit = 60) {
    if (!dict || !sorted || !board) return [];
    return findPlayableWords({
      board,
      specialTiles,
      mustReuse: lastWordTiles,
      wordSet: dict,
      sortedArr: sorted,
      used: new Set(usedWords.map(w => w.word)),
      limit,
    }).words;
  }

  function showHintTiles(tiles: Pos[], ms = 5000) {
    setHintTiles(new Set(tiles.map(keyOf)));
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHintTiles(new Set()), ms);
  }

  const handleHintRevealer = (candidates: { word: string; path: Pos[] }[]) => {
    // Prefer a short word so the hint nudges rather than solves
    const pick = [...candidates].sort((a, b) => a.word.length - b.word.length)[0];
    if (!pick) return;
    showHintTiles(pick.path);
    addActiveEffect({
      id: "hint_revealer",
      type: "hint_active",
      duration: 5000,
      expiresAt: new Date(Date.now() + 5000)
    });
    setTimeout(() => removeActiveEffect("hint_revealer"), 5000);
    playSound("hint_used");
    toast.success(`Hint: the path for "${pick.word.toUpperCase()}" is highlighted`);
    announce(`Hint: ${pick.word.toUpperCase()}, starting at row ${pick.path[0].r + 1}, column ${pick.path[0].c + 1}`);
  };

  function handleZenHint() {
    const candidates = playableNow();
    if (!candidates.length) {
      toast.info("No playable words right now");
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    showHintTiles(pick.path);
    setZenHintsUsed(prev => prev + 1);
    playSound("hint_used");
    announce(`Hint: ${pick.word.toUpperCase()}, ${pick.word.length} letters, starting at row ${pick.path[0].r + 1}, column ${pick.path[0].c + 1}`);
  }

  function handleZenUndo() {
    if (zenUndoStack.length === 0) return;
    const prevState = zenUndoStack[zenUndoStack.length - 1];
    setBoard(prevState.board);
    setSpecialTiles(prevState.specialTiles);
    setUsedWords(prevState.usedWords);
    setScore(prevState.score);
    setLastWordTiles(prevState.lastWordTiles);
    setZenUndoStack(prev => prev.slice(0, -1));
    clearPath();
    announce("Last word undone");
  }

  const handleScoreMultiplier = () => {
    addActiveEffect({
      id: "score_multiplier",
      type: "score_boost",
      duration: 0,
      // Until next word
      data: {
        multiplier: 2.0
      }
    });
    toast.success("Next word will have 2x score!");
  };
  // New function to break all stone tiles at once
  const breakAllStoneTiles = async (): Promise<number> => {
    // Scan entire grid for stone tiles
    const stonePositions: Pos[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (specialTiles[r][c].type === "stone") {
          stonePositions.push({ r, c });
        }
      }
    }

    if (stonePositions.length === 0) {
      return 0;
    }

    // Use one hammer consumable
    const success = await spendConsumable("hammer");
    if (!success) {
      toast.error("Failed to use hammer consumable");
      return 0;
    }

    // Break all stone tiles at once
    const newSpecialTiles = specialTiles.map(row => [...row]);
    stonePositions.forEach(pos => {
      newSpecialTiles[pos.r][pos.c] = { type: null };
    });
    setSpecialTiles(newSpecialTiles);

    const count = stonePositions.length;
    toast.success(`Broke ${count} stone tile${count > 1 ? 's' : ''}!`);
    return count;
  };
  const handleExtraMoves = () => {
    if (settings.mode !== "daily" && settings.mode !== "daily_5x5") {
      toast.error("Extra moves can only be used in Daily Challenge mode");
      return;
    }
    setSettings(prev => ({
      ...prev,
      dailyMovesLimit: prev.dailyMovesLimit + 3
    }));
    toast.success("Added 3 extra moves to your daily challenge!");
  };

  // ---------------------------------------------------------------------------
  // Input. One pointer-events path serves mouse, touch, and pen: a press on a
  // tile becomes a drag as soon as the pointer reaches another tile, otherwise
  // it is a tap. Move/up/cancel are tracked on window so releasing outside the
  // board always ends the gesture. Keyboard: type letters to auto-trace,
  // Enter submits, Backspace removes a letter, Escape clears.
  // ---------------------------------------------------------------------------
  const pathRef = useRef<Pos[]>([]);
  pathRef.current = path;
  const gestureRef = useRef<{ pointerId: number; start: Pos; dragged: boolean } | null>(null);
  // Letters typed on a keyboard since the path was last built by pointer
  const typedRef = useRef<string | null>(null);

  const canInteract = () => !gameOver && !isGenerating && !!board && !!dict && !isBoardLocked && !showWildDialog && !showResults;

  function setPathWithFeedback(next: Pos[]) {
    const prevLen = pathRef.current.length;
    pathRef.current = next;
    setPath(next);
    setFeedback(null);
    if (next.length > prevLen) {
      playSound("tile_select", next.length - 1);
      haptic("select");
    }
  }

  // The path with `pos` appended, or null when the move isn't legal
  function extendPath(current: Pos[], pos: Pos): Pos[] | null {
    if (specialTiles[pos.r][pos.c].type === "stone") return null;
    if (current.some(p => samePos(p, pos))) return null;
    if (current.length) {
      const last = current[current.length - 1];
      // Ghost tiles bridge to any tile
      const canSkipAdjacency = specialTiles[last.r][last.c].type === "ghost";
      if (!canSkipAdjacency && !neighbors(last, pos)) return null;
    }
    return [...current, pos];
  }

  // Hit-test a tile under the pointer. Only the inner circle of each tile
  // counts, so diagonal drags don't clip the corners of orthogonal neighbors.
  function tileAtPoint(x: number, y: number): Pos | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tile-pos]");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const dx = x - (rect.left + rect.width / 2);
    const dy = y - (rect.top + rect.height / 2);
    const radius = Math.min(rect.width, rect.height) * 0.46;
    if (dx * dx + dy * dy > radius * radius) return null;
    const [r, c] = (el.getAttribute("data-tile-pos") || "").split(",").map(Number);
    return Number.isFinite(r) && Number.isFinite(c) ? { r, c } : null;
  }

  function tapTile(pos: Pos) {
    if (!canInteract()) return;
    typedRef.current = null;
    const current = pathRef.current;
    const idx = current.findIndex(p => samePos(p, pos));
    if (idx !== -1 && idx === current.length - 1) {
      // Tapping the last tile again submits (or deselects a too-short word)
      if (wordForPath(current, board, specialTiles).length >= 3 || current.some(p => specialTiles[p.r][p.c].type === "wild")) {
        submitWord(current);
      } else {
        setPathWithFeedback(current.slice(0, -1));
      }
      return;
    }
    if (idx !== -1) {
      // Tapping an earlier tile trims the path back to it
      setPathWithFeedback(current.slice(0, idx + 1));
      return;
    }
    const next = extendPath(current, pos);
    if (next) {
      setPathWithFeedback(next);
      return;
    }
    if (specialTiles[pos.r][pos.c].type === "stone") {
      setShakeKey(k => k + 1);
      flashFeedback("Stone tiles are blocked");
      announce("Stone tiles are blocked");
      return;
    }
    // Not adjacent: start a new word from this tile
    setPathWithFeedback([pos]);
  }

  function onTilePointerDown(pos: Pos, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!canInteract()) return;
    // Prevent text selection and the emulated mouse events that follow touch
    e.preventDefault();
    // Touch pointers are implicitly captured by the pressed element; release
    // so the window listeners can hit-test whatever tile is under the finger.
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Not captured
    }
    gestureRef.current = { pointerId: e.pointerId, start: pos, dragged: false };
  }

  function handlePointerMove(e: PointerEvent) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    const pos = tileAtPoint(e.clientX, e.clientY);
    if (!pos) return;
    if (!g.dragged) {
      if (samePos(pos, g.start)) return;
      if (specialTiles[g.start.r][g.start.c].type === "stone") {
        gestureRef.current = null;
        return;
      }
      // Reaching a second tile turns the press into a drag. Dragging from the
      // tail of a tapped path continues it; otherwise start a new path.
      g.dragged = true;
      typedRef.current = null;
      setDragging(true);
      const current = pathRef.current;
      const base = samePos(current[current.length - 1], g.start) ? current : [g.start];
      if (base !== current) setPathWithFeedback(base);
    }
    const current = pathRef.current;
    if (samePos(pos, current[current.length - 1])) return;
    // Backtrack by moving onto the previous tile
    if (current.length >= 2 && samePos(pos, current[current.length - 2])) {
      setPathWithFeedback(current.slice(0, -1));
      return;
    }
    const next = extendPath(current, pos);
    if (next) setPathWithFeedback(next);
  }

  function handlePointerUp(e: PointerEvent) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    setDragging(false);
    if (g.dragged) {
      const current = pathRef.current;
      if (current.length >= 2) submitWord(current);
      else clearPath();
      return;
    }
    tapTile(g.start);
  }

  function handlePointerCancel(e: PointerEvent) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    setDragging(false);
    if (g.dragged) clearPath();
  }

  // Find a path spelling `typed`, preferring one that extends the current
  // path, then one that satisfies the chain rule.
  function findPathForTyped(typed: string): Pos[] | null {
    if (!board) return null;
    const N = board.length;
    const matches = (pos: Pos, ch: string, prev: string | undefined) => {
      const type = specialTiles[pos.r][pos.c].type;
      if (type === "stone" || type === "ghost") return false;
      if (type === "wild") return true;
      if (type === "mirror") return prev === ch;
      return board[pos.r][pos.c].toLowerCase() === ch;
    };
    let fallback: Pos[] | null = null;
    const search = (prefix: Pos[], depth: number): Pos[] | null => {
      if (depth === typed.length) {
        if (lastWordTiles.size === 0 || prefix.some(p => lastWordTiles.has(keyOf(p)))) return prefix;
        if (!fallback) fallback = prefix;
        return null;
      }
      const last = prefix[prefix.length - 1];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const pos = { r, c };
          if (last && !neighbors(last, pos)) continue;
          if (prefix.some(p => samePos(p, pos))) continue;
          if (!matches(pos, typed[depth], typed[depth - 1])) continue;
          const found = search([...prefix, pos], depth + 1);
          if (found) return found;
        }
      }
      return null;
    };
    const current = pathRef.current;
    if (typedRef.current && current.length === typed.length - 1) {
      const extended = search(current, current.length);
      if (extended) return extended;
    }
    return search([], 0) ?? fallback;
  }

  function typeLetter(ch: string) {
    const typed = (typedRef.current ?? "") + ch;
    const next = findPathForTyped(typed);
    if (!next) {
      setShakeKey(k => k + 1);
      flashFeedback(`No path spells ${typed.toUpperCase()}`);
      announce(`No path spells ${typed.toUpperCase()}`);
      return;
    }
    typedRef.current = typed;
    setPathWithFeedback(next);
  }

  function backspace() {
    if (typedRef.current) {
      const typed = typedRef.current.slice(0, -1);
      if (!typed) {
        clearPath();
        return;
      }
      const next = findPathForTyped(typed);
      typedRef.current = typed;
      setPathWithFeedback(next ?? pathRef.current.slice(0, -1));
      return;
    }
    if (pathRef.current.length) setPathWithFeedback(pathRef.current.slice(0, -1));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const onTile = !!target?.closest?.("[data-tile-pos]");
    if (!onTile && target?.closest?.('input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"]')) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    if (!canInteract()) return;
    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      typeLetter(e.key.toLowerCase());
    } else if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (e.key === "Enter") {
      // On a focused button other than a tile, let Enter activate it
      if (!onTile && target?.closest?.("button, a")) return;
      e.preventDefault();
      if (pathRef.current.length) submitWord(pathRef.current);
    } else if (e.key === "Escape" && pathRef.current.length) {
      e.preventDefault();
      clearPath();
    }
  }

  // Window listeners are attached once and always call the latest handlers
  const inputHandlersRef = useRef({ handlePointerMove, handlePointerUp, handlePointerCancel, handleKeyDown });
  inputHandlersRef.current = { handlePointerMove, handlePointerUp, handlePointerCancel, handleKeyDown };
  useEffect(() => {
    const move = (e: PointerEvent) => inputHandlersRef.current.handlePointerMove(e);
    const up = (e: PointerEvent) => inputHandlersRef.current.handlePointerUp(e);
    const cancel = (e: PointerEvent) => inputHandlersRef.current.handlePointerCancel(e);
    const key = (e: KeyboardEvent) => inputHandlersRef.current.handleKeyDown(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
    };
  }, []);

  function submitWord(wordPath: Pos[] = pathRef.current) {
    const typed = typedRef.current;
    typedRef.current = null;
    if (!canInteract() || !board) {
      clearPath();
      return;
    }
    if (wordPath.filter(p => specialTiles[p.r][p.c].type === "ghost").length > 1) {
      rejectWord("Only one Ghost tile per word");
      return;
    }
    const wilds = wildPositionsOf(wordPath);
    if (wilds.length > 0) {
      // Ask for the Wild letter(s); prefill from typed letters when available
      const inputs = new Map<string, string>();
      if (typed) {
        let letterIndex = 0;
        for (const p of wordPath) {
          const type = specialTiles[p.r][p.c].type;
          if (type === "ghost") continue;
          if (type === "wild" && typed[letterIndex]) inputs.set(`${p.r}-${p.c}`, typed[letterIndex].toUpperCase());
          letterIndex++;
        }
      }
      setWildTileInputs(inputs);
      setWildError(null);
      setPendingWildPath(wordPath);
      setShowWildDialog(true);
      clearPath();
      return;
    }
    const word = wordForPath(wordPath, board, specialTiles);
    if (word.length < 3) {
      if (wordPath.length > 1) rejectWord("Words need at least 3 letters", false);
      else clearPath();
      return;
    }
    const reason = validateWordForPlay(word, wordPath);
    if (reason) {
      rejectWord(reason);
      return;
    }
    commitWord(word, wordPath, []);
  }

  // Shared Time Attack progression — must run for every submitted word,
  // whether it came through submitWord or the wild-letter path.
  function processTimeAttackWord(actualWord: string) {
    if (settings.mode !== "time_attack" || !timeAttackStarted) return;
    const newWordsFound = timeAttackWordsFound + 1;
    setTimeAttackWordsFound(newWordsFound);

    // Speed multiplier increases every 3 words (1.0x -> 1.2x -> 1.4x -> 1.6x -> 2.0x max)
    const newMultiplier = Math.min(2.0, 1.0 + Math.floor(newWordsFound / 3) * 0.2);
    if (newMultiplier > timeAttackSpeedMultiplier) {
      setTimeAttackSpeedMultiplier(newMultiplier);
      announce(`Speed multiplier ${newMultiplier.toFixed(1)} times`);
    }

    // Time bonus: longer words give more time, capped at +5s and 60s total
    const timeBonus = Math.min(5, Math.floor(actualWord.length / 2));
    if (timeBonus > 0) {
      timeAttackDeadlineRef.current = Math.min(Date.now() + 60_000, timeAttackDeadlineRef.current + timeBonus * 1000);
      announce(`Plus ${timeBonus} seconds`);
    }
  }

  // Shared Survival progression — combo, challenge/boss validation, and wave
  // advancement. Must run for every submitted word, whether it came through
  // submitWord or the wild-letter path.
  function processSurvivalWord(actualWord: string, wordPath: Pos[], totalGain: number): number {
    let survivalGain = totalGain;
    // Enhanced Survival mode: Track words and check for challenge/boss completion
    if (settings.mode === "survival" && survivalStarted) {
      // Update combo system
      const hasSafetyNet = survivalActivePowerUps.some(ap => ap.powerUp.type === 'safety_net' && (ap.remainingUses || 0) > 0);

      // BUG FIX #3: Calculate time before updating combo (to use old timestamp)
      const timeSpent = survivalComboState.lastWordTime > 0
        ? (Date.now() - survivalComboState.lastWordTime) / 1000
        : 5; // Default 5 seconds for first word

      const { newCombo, rewards } = updateCombo(survivalComboState, true, hasSafetyNet);
      setSurvivalComboState(newCombo);

      // Apply combo multiplier to score
      const comboBoost = survivalActivePowerUps.some(ap => ap.powerUp.type === "combo_boost") ? 3 : 1;
      const comboScore = Math.floor(totalGain * newCombo.comboMultiplier * survivalPointsMultiplier * comboBoost);
      // Combo, double points and combo boost apply to the run score too
      survivalGain = comboScore;
      const waveScore = survivalWaveScore + comboScore;
      setSurvivalWaveScore(waveScore);

      // Update performance tracking
      const updatedPerf = updatePerformance(
        survivalPerformance,
        actualWord,
        newCombo.currentCombo,
        true,
        timeSpent
      );
      setSurvivalPerformance(updatedPerf);

      // Process combo rewards
      rewards.forEach(reward => {
        if (reward === 'common_powerup') {
          const powerUp = getRandomPowerUp('common');
          setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
          toast.success(`🎁 Combo reward: ${powerUp.name}!`);
        } else if (reward === 'rare_powerup') {
          const powerUp = getRandomPowerUp('rare');
          setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
          toast.success(`⭐ Rare combo reward: ${powerUp.name}!`);
        } else if (reward === 'epic_powerup') {
          const powerUp = getRandomPowerUp('epic');
          setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
          toast.success(`💎 Epic combo reward: ${powerUp.name}!`);
        } else if (reward === 'life_fragment') {
          const newFragments = survivalLifeFragments + 1;
          if (newFragments >= 3) {
            setSurvivalLives(prev => Math.min(prev + 1, survivalMaxLives));
            setSurvivalLifeFragments(0);
            toast.success('💎 Life fragments combined! +1 life');
          } else {
            setSurvivalLifeFragments(newFragments);
            toast.success(`💎 Life fragment earned! (${newFragments}/3)`);
          }
        } else if (reward === 'extra_life') {
          // BUG FIX #6: Handle 15-word combo reward
          setSurvivalLives(prev => Math.min(prev + 1, survivalMaxLives));
          toast.success('❤️ LEGENDARY COMBO! +1 Life!', { duration: 4000 });
        }
      });

      // Boss wave logic
      if (survivalBossWordRequired && survivalCurrentBoss) {
        const pathPositions = wordPath.map(p => ({ row: p.r, col: p.c }));
        const bossResult = validateBossWave(
          survivalCurrentBoss,
          actualWord,
          pathPositions,
          survivalBossProgress,
          waveScore
        );

        if (bossResult.valid) {
          setSurvivalBossProgress(bossResult.progress);

          if (bossResult.complete) {
            // Boss defeated!
            toast.success(bossResult.message || '👑 Boss defeated!', { duration: 3000 });

            // Wave complete - check for life recovery and rewards
            const perfectWave = survivalMistakesThisWave === 0;
            const newPerfectStreak = perfectWave ? survivalPerfectWaveStreak + 1 : 0;
            setSurvivalPerfectWaveStreak(newPerfectStreak);

            const recovery = checkLifeRecovery(
              survivalWave,
              newPerfectStreak,
              survivalLifeFragments,
              true, // boss defeated
              newCombo.currentCombo
            );

            if (recovery.lives > 0) {
              setSurvivalLives(prev => Math.min(prev + recovery.lives, survivalMaxLives));
              toast.success(recovery.message || `❤️ +${recovery.lives} life!`, { duration: 3000 });
            }
            setSurvivalLifeFragments(recovery.fragments);

            // Advance to next wave
            const nextWave = survivalWave + 1;
            setSurvivalWave(nextWave);
            setSurvivalWordsThisWave(0);
            setSurvivalChallengeProgress(0);
            setSurvivalBossProgress(0);
            setSurvivalWaveScore(0);
            setSurvivalMistakesThisWave(0);
            setSurvivalBossWordRequired(false);
            setSurvivalCurrentBoss(null);

            // Check for events or shop
            if (shouldShowShop(nextWave)) {
              setSurvivalShowShop(true);
            } else if (shouldTriggerEvent(nextWave)) {
              const event = generateRandomEvent(nextWave);
              if (event) {
                setSurvivalPendingEvent(event);
              }
            } else {
              // Generate next wave challenge
              const nextChallenge = getRandomWaveChallenge(nextWave);
              setSurvivalCurrentChallenge(nextChallenge);
              toast.info(`🌊 Wave ${nextWave}: ${nextChallenge.description}`, { duration: 4000 });
            }

            // BUG FIX #2: Properly expire power-ups and handle durations
            setSurvivalActivePowerUps(prev =>
              prev.map(ap => ({
                ...ap,
                remainingWaves: ap.remainingWaves !== undefined ? ap.remainingWaves - 1 : undefined
              })).filter(ap => ap.remainingWaves === undefined || ap.remainingWaves > 0)
            );

            if (survivalDifficultyFrozen > 0) {
              setSurvivalDifficultyFrozen(prev => prev - 1);
            }

            // BUG FIX #9: Reset double points multiplier after wave
            if (survivalPointsMultiplier > 1.0) {
              setSurvivalPointsMultiplier(1.0);
            }
          } else if (bossResult.message) {
            toast.info(bossResult.message);
          }
        } else if (bossResult.message) {
          toast.error(bossResult.message);
        }
      }
      // Regular challenge logic
      else if (survivalCurrentChallenge) {
        const pathPositions = wordPath.map(p => ({ row: p.r, col: p.c }));
        const challengeResult = validateWaveChallenge(
          survivalCurrentChallenge,
          actualWord,
          pathPositions,
          survivalChallengeProgress,
          waveScore
        );

        if (challengeResult.valid) {
          setSurvivalChallengeProgress(challengeResult.progress);
          if (challengeResult.message) {
            toast.info(challengeResult.message);
          }

          // Check if challenge is complete
          if (isChallengeComplete(survivalCurrentChallenge, challengeResult.progress)) {
            const nextWave = survivalWave + 1;

            // Check if next wave is a boss wave
            if (nextWave % 5 === 0) {
              // BUG FIX #1: Advance wave counter before boss
              setSurvivalWave(nextWave);
              setSurvivalWordsThisWave(0);
              setSurvivalChallengeProgress(0);
              setSurvivalWaveScore(0);
              setSurvivalMistakesThisWave(0);

              const boss = getRandomBossWave(nextWave);
              setSurvivalCurrentBoss(boss);
              setSurvivalBossWordRequired(true);
              setSurvivalCurrentChallenge(null);
              toast.warning(`${boss.icon} Boss Wave ${nextWave}! ${boss.description}`, { duration: 4000 });
            } else {
              // Regular wave complete
              const perfectWave = survivalMistakesThisWave === 0;
              const newPerfectStreak = perfectWave ? survivalPerfectWaveStreak + 1 : 0;
              setSurvivalPerfectWaveStreak(newPerfectStreak);

              const recovery = checkLifeRecovery(
                survivalWave,
                newPerfectStreak,
                survivalLifeFragments,
                false,
                newCombo.currentCombo
              );

              if (recovery.lives > 0) {
                setSurvivalLives(prev => Math.min(prev + recovery.lives, survivalMaxLives));
                toast.success(recovery.message || `❤️ +${recovery.lives} life!`, { duration: 3000 });
              }
              setSurvivalLifeFragments(recovery.fragments);

              // Advance wave
              setSurvivalWave(nextWave);
              setSurvivalWordsThisWave(0);
              setSurvivalChallengeProgress(0);
              setSurvivalWaveScore(0);
              setSurvivalMistakesThisWave(0);

              // Check for shop or events
              if (shouldShowShop(nextWave)) {
                setSurvivalShowShop(true);
              } else if (shouldTriggerEvent(nextWave)) {
                const event = generateRandomEvent(nextWave);
                if (event) {
                  setSurvivalPendingEvent(event);
                }
              } else {
                const nextChallenge = getRandomWaveChallenge(nextWave);
                setSurvivalCurrentChallenge(nextChallenge);
                toast.success(`✨ Wave ${survivalWave} complete!\n🌊 Wave ${nextWave}: ${nextChallenge.description}`, { duration: 4000 });
              }

              // BUG FIX #2: Properly expire power-ups
              setSurvivalActivePowerUps(prev =>
                prev.map(ap => ({
                  ...ap,
                  remainingWaves: ap.remainingWaves !== undefined ? ap.remainingWaves - 1 : undefined
                })).filter(ap => ap.remainingWaves === undefined || ap.remainingWaves > 0)
              );

              if (survivalDifficultyFrozen > 0) {
                setSurvivalDifficultyFrozen(prev => prev - 1);
              }

              // BUG FIX #9: Reset double points multiplier after wave
              if (survivalPointsMultiplier > 1.0) {
                setSurvivalPointsMultiplier(1.0);
              }
            }
          }
        } else if (challengeResult.message) {
          toast.error(challengeResult.message);
          setSurvivalMistakesThisWave(prev => prev + 1);
        }
      }

      setSurvivalWordsThisWave(prev => prev + 1);

      // BUG FIX #2: Properly expire word-based power-ups
      setSurvivalActivePowerUps(prev =>
        prev.map(ap => ({
          ...ap,
          remainingUses: ap.remainingUses !== undefined ? ap.remainingUses - 1 : undefined
        })).filter(ap => ap.remainingUses === undefined || ap.remainingUses > 0)
      );
    }
    return survivalGain;
  }

  // ---------------------------------------------------------------------------
  // Mode start / restart. Timed and scored modes keep the board locked behind
  // a Start overlay so nothing can be played before the clock runs.
  // ---------------------------------------------------------------------------
  function startTimeAttack() {
    timeAttackDeadlineRef.current = Date.now() + 60_000;
    setTimeAttackTimeRemaining(60);
    setTimeAttackStarted(true);
    setTimeAttackWordsFound(0);
    setTimeAttackSpeedMultiplier(1.0);
    setGameStartTime(Date.now());
    playSound("game_start");
    announce("Time Attack started. 60 seconds on the clock.");
  }

  function startSurvival() {
    setSurvivalStarted(true);
    setSurvivalLives(3);
    setSurvivalMaxLives(5);
    setSurvivalWave(1);
    setSurvivalWordsThisWave(0);
    setSurvivalChallengeProgress(0);
    setSurvivalWaveScore(0);
    setSurvivalMistakesThisWave(0);
    setSurvivalShields(0);
    setSurvivalLifeFragments(0);
    setSurvivalPerfectWaveStreak(0);
    setSurvivalActivePowerUps([]);
    setSurvivalInventoryPowerUps([]);
    setSurvivalPointsMultiplier(1.0);
    setSurvivalComboState({ currentCombo: 0, maxCombo: 0, comboMultiplier: 1.0, comboActive: false, lastWordTime: 0 });
    const firstChallenge = getRandomWaveChallenge(1);
    setSurvivalCurrentChallenge(firstChallenge);
    setSurvivalBossWordRequired(false);
    setSurvivalCurrentBoss(null);
    setGameStartTime(Date.now());
    playSound("game_start");
    announce(`Survival started. Wave 1: ${firstChallenge.description}`);
  }

  function startChaos() {
    setChaosStarted(true);
    setMovesUsed(0);
    setGameStartTime(Date.now());
    playSound("game_start");
    announce("Chaos started. The board reshuffles after every word. 15 moves.");
  }

  // "Play again" for modes with a fresh random board
  function restartRound() {
    if (settings.mode === "classic") {
      onNewGame();
      return;
    }
    if (settings.mode === "practice") {
      startNewPracticeGame().catch(console.error);
      return;
    }
    if (!dict || !sorted) return;
    setIsGenerating(true);
    try {
      const newBoard = generateSolvableBoard(size, dict, sorted);
      const probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
      setBoard(newBoard);
      setBenchmarks(computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS));
      setDiscoverableCount(probe.words.size);
      setSpecialTiles(createEmptySpecialTilesGrid(size));
      setUnlocked(new Set());
      setGameOver(false);
      setFinalGrade("None");
      clearPath();
      setUsedWords([]);
      setLastWordTiles(new Set());
      setScore(0);
      setStreak(0);
      setMovesUsed(0);
      markRoundStart(newBoard);
      switch (settings.mode) {
        case "time_attack":
          setTimeAttackStarted(false);
          setTimeAttackTimeRemaining(60);
          setTimeAttackWordsFound(0);
          setTimeAttackSpeedMultiplier(1.0);
          break;
        case "survival":
          setSurvivalStarted(false);
          break;
        case "chaos":
          setChaosStarted(true);
          break;
        case "endless":
          setEndlessDifficulty(1);
          setEndlessStarted(true);
          break;
        case "zen":
          setZenUndoStack([]);
          setZenHintsUsed(0);
          break;
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleActivatePowerUp(powerUp: PowerUp) {
    const result = applyPowerUpEffect(powerUp.type, {});
    if (!result.success || !result.effect) return;
    const effect = result.effect;
    toast.success(result.message);
    if (effect.lives) setSurvivalLives(prev => Math.min(prev + effect.lives, survivalMaxLives));
    if (effect.shield) setSurvivalShields(prev => prev + effect.shield);
    if (effect.removeStones) {
      setSurvivalActivePowerUps(prev => [...prev, { powerUp, remainingUses: 1, activatedAt: Date.now() }]);
    }
    if (effect.refreshBoard) refreshBoard(score);
    if (effect.revealHints) {
      const starts = playableNow(effect.revealHints).map(w => w.path[0]);
      if (starts.length) showHintTiles(starts, 6000);
      else toast.info("No playable words to reveal");
    }
    if (effect.freezeDifficulty) setSurvivalDifficultyFrozen(effect.freezeDifficulty);
    if (effect.wildcardActive) {
      const empty: Pos[] = [];
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (specialTiles[r][c].type === null) empty.push({ r, c });
      if (empty.length) {
        const pos = empty[Math.floor(Math.random() * empty.length)];
        setSpecialTiles(prev => prev.map((row, r) => row.map((tile, c) => (r === pos.r && c === pos.c ? { type: "wild", expiryTurns: 5, frozen: tile.frozen } : tile))));
        setNewWildTiles(prev => new Set([...prev, keyOf(pos)]));
        announce(`Wild tile placed at row ${pos.r + 1}, column ${pos.c + 1}`);
      }
    }
    if (effect.pointsMultiplier) setSurvivalPointsMultiplier(effect.pointsMultiplier);
    if (effect.comboBoost) {
      setSurvivalActivePowerUps(prev => [...prev, { powerUp, remainingUses: 5, activatedAt: Date.now() }]);
    }
    if (effect.lifeLink) {
      setSurvivalActivePowerUps(prev => [...prev, { powerUp, remainingWaves: 3, activatedAt: Date.now() }]);
    }
    if (effect.safetyNet) {
      setSurvivalActivePowerUps(prev => [...prev, { powerUp, remainingUses: 3, activatedAt: Date.now() }]);
    }
    setSurvivalInventoryPowerUps(prev => {
      const idx = prev.findIndex(p => p.id === powerUp.id);
      return idx >= 0 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : prev;
    });
  }

  const isGameReady = !!dict;
  const modeLabel = MODE_LABELS[settings.mode] ?? "Classic";

  function shareResult() {
    const grade = finalGrade !== "None" ? finalGrade : gradeForScore(score, benchmarks);
    const extra =
      settings.mode === "survival" ? `🌊 Wave ${survivalWave}`
        : settings.mode === "endless" ? `∞ Level ${endlessDifficulty}`
        : isDailyMode ? `🎯 ${movesUsed}/${settings.dailyMovesLimit} moves`
        : undefined;
    const text = buildShareText({ modeLabel, score, grade, words: usedWords, extra });
    shareText(`Lexichain ${modeLabel}`, text);
  }

  function shareResultImage() {
    const grade = finalGrade !== "None" ? finalGrade : gradeForScore(score, benchmarks);
    const extra =
      settings.mode === "survival" ? `Wave ${survivalWave}`
        : settings.mode === "endless" ? `Level ${endlessDifficulty}`
        : undefined;
    const text = buildShareText({ modeLabel, score, grade, words: usedWords, extra });
    shareCardImage({
      modeLabel,
      score,
      grade,
      wordCount: usedWords.length,
      best: bestPlayRef.current,
      // Daily boards are shared by everyone, so don't reveal the letters
      spoilerFree: isDailyMode,
      extra,
    }, text);
  }

  const pathTone: PathTone =
    !pathWordStatus ? "neutral"
      : pathWordStatus.state === "valid" ? "valid"
      : pathWordStatus.state === "invalid" ? "invalid"
      : pathWordStatus.state === "used" || pathWordStatus.state === "nolink" ? "warn"
      : "neutral";
  const canSubmit = path.length > 0 && (wordFromPath.length >= 3 || path.some(p => specialTiles[p.r]?.[p.c]?.type === "wild"));
  const timeLow = settings.mode === "time_attack" && timeAttackStarted && !gameOver && timeAttackTimeRemaining <= 10;
  const dailyPreview = isDailyMode && !gameOver && usedWords.length >= 1
    ? previewNextSpecialTiles(usedWords.length, settings.mode === "daily_5x5" ? getDailySeed() + "-5x5" : getDailySeed(), size, specialTiles)
    : [];

  // The one stat that matters most for this mode, pinned in the HUD
  const hudStat = (() => {
    const label = (text: string) => <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/75">{text}</div>;
    switch (settings.mode) {
      case "time_attack":
        return (
          <div>
            {label("Time")}
            <div className={`text-2xl font-extrabold leading-none tabular-nums ${timeAttackTimeRemaining <= 10 ? "text-[hsl(var(--bad))]" : timeAttackTimeRemaining <= 30 ? "text-[hsl(var(--warn))]" : ""}`}>
              {Math.floor(timeAttackTimeRemaining / 60)}:{(timeAttackTimeRemaining % 60).toString().padStart(2, "0")}
            </div>
            <div className="text-[11px] font-semibold text-foreground/80">⚡ {timeAttackSpeedMultiplier.toFixed(1)}x</div>
          </div>
        );
      case "survival":
        return (
          <div>
            {label(`Wave ${survivalWave}${survivalBossWordRequired ? " · Boss" : ""}`)}
            <div className="text-lg leading-none" role="img" aria-label={`${survivalLives} of ${survivalMaxLives} lives${survivalShields ? `, ${survivalShields} shield${survivalShields === 1 ? "" : "s"}` : ""}`}>
              <span aria-hidden="true">{"❤️".repeat(Math.max(0, survivalLives))}{survivalShields > 0 ? ` 🛡️${survivalShields}` : ""}</span>
            </div>
          </div>
        );
      case "daily":
      case "daily_5x5":
      case "practice":
        return (
          <div>
            {label("Moves left")}
            <div className="text-2xl font-extrabold leading-none tabular-nums">{Math.max(0, settings.dailyMovesLimit - movesUsed)}</div>
          </div>
        );
      case "chaos":
        return (
          <div>
            {label("Moves")}
            <div className={`text-2xl font-extrabold leading-none tabular-nums ${movesUsed >= 13 ? "text-[hsl(var(--bad))]" : ""}`}>{movesUsed}/15</div>
          </div>
        );
      case "endless":
        return (
          <div>
            {label("Level")}
            <div className="text-2xl font-extrabold leading-none tabular-nums">{endlessDifficulty}</div>
          </div>
        );
      case "puzzle": {
        const puzzle = currentPuzzleId ? getPuzzleById(currentPuzzleId) : null;
        return puzzle ? (
          <div>
            {label("Moves left")}
            <div className="text-2xl font-extrabold leading-none tabular-nums">{puzzleMovesRemaining}</div>
          </div>
        ) : null;
      }
      case "zen":
        return (
          <div>
            {label("Words")}
            <div className="text-2xl font-extrabold leading-none tabular-nums">{usedWords.length}</div>
          </div>
        );
      default:
        return (
          <div>
            {label("Words")}
            <div className="text-2xl font-extrabold leading-none tabular-nums">{usedWords.length}</div>
          </div>
        );
    }
  })();

  const lockOverlay = isBoardLocked && board && !isInitializing ? (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/70 p-4 text-center backdrop-blur-md">
      <p className="max-w-xs text-sm font-medium text-foreground">
        {settings.mode === "time_attack" && "60 seconds. Each word adds time and raises your speed multiplier."}
        {settings.mode === "survival" && "Complete wave challenges. Run out of words and you lose a life."}
        {settings.mode === "chaos" && "The board reshuffles after every word. You have 15 moves."}
      </p>
      <Button
        variant="hero"
        size="lg"
        disabled={!isGameReady || isGenerating}
        onClick={settings.mode === "time_attack" ? startTimeAttack : settings.mode === "survival" ? startSurvival : startChaos}
        autoFocus
      >
        {settings.mode === "time_attack" ? "Start the clock" : settings.mode === "survival" ? "Start Survival" : "Start Chaos"}
      </Button>
    </div>
  ) : null;

  const primaryNewGame =
    settings.mode === "classic" ? { label: "New game", onClick: onNewGame }
      : settings.mode === "practice" ? { label: "New practice board", onClick: () => startNewPracticeGame().catch(console.error) }
      : settings.mode === "puzzle" || isDailyMode ? null
      : { label: settings.mode === "chaos" && chaosStarted && !gameOver ? "Restart round" : "New round", onClick: restartRound };

  const resultsPrimary = (() => {
    if (puzzleMode && currentPuzzleId) {
      const next = getNextPuzzle(currentPuzzleId);
      return next && puzzleFoundWords.size >= puzzleRequiredWords.size
        ? { label: `Next puzzle: ${next.name}`, onClick: () => loadPuzzle(next.id) }
        : { label: "Replay puzzle", onClick: () => loadPuzzle(currentPuzzleId) };
    }
    if (isDailyMode) return undefined;
    return { label: "Play again", onClick: restartRound };
  })();

  return (
    <section className="container mx-auto max-w-6xl pb-32 lg:pb-8 landscape-phone:pb-4">

      <Dialog open={showDifficultyDialog} onOpenChange={setShowDifficultyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Difficulty</DialogTitle>
            <DialogDescription>Bigger grids hold more words and longer chains.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(Object.entries(DIFFICULTY_CONFIG) as [keyof typeof DIFFICULTY_CONFIG, (typeof DIFFICULTY_CONFIG)[keyof typeof DIFFICULTY_CONFIG]][]).map(([diff, config]) => <Button key={diff} variant="outline" onClick={() => startGameWithDifficulty(diff)} className="justify-between p-4 h-auto whitespace-normal">
                <div className="text-left">
                  <div className="font-semibold capitalize">{diff}</div>
                  <div className="text-sm text-foreground/75">
                    {config.gridSize}×{config.gridSize} grid • {config.minWords}+ discoverable words • {Math.round(config.scoreMultiplier * 100)}% scoring
                  </div>
                </div>
              </Button>)}
          </div>
        </DialogContent>
      </Dialog>

      <HowToPlayDialog open={showHowToPlay} onOpenChange={setShowHowToPlay} mode={settings.mode} />

      {/* Wild Letter Input Dialog */}
      <Dialog open={showWildDialog} onOpenChange={(open) => { if (!open) cancelWildDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Wild Tile Letter{pendingWildPath && wildPositionsOf(pendingWildPath).length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>Enter a letter for each Wild tile to complete your word.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleWildSubmit();
            }}
          >
            <div className="text-center" aria-hidden="true">
              <div className="text-lg font-mono bg-muted p-2 rounded tracking-widest">
                {pendingWildPath?.map((p, i) => {
                  const tile = specialTiles[p.r][p.c];
                  if (tile.type === "ghost") return null;
                  const isWild = tile.type === "wild";
                  const letter = isWild ? (wildTileInputs.get(`${p.r}-${p.c}`) || "?").toUpperCase() : board?.[p.r][p.c];
                  return <span key={i} className={isWild ? "text-purple-700 dark:text-purple-300 font-bold underline" : ""}>{letter}</span>;
                })}
              </div>
            </div>
            <div className="space-y-2">
              {(pendingWildPath ? wildPositionsOf(pendingWildPath) : []).map((wildPos, idx) => {
                const wildKey = `${wildPos.r}-${wildPos.c}`;
                return <Input
                  key={wildKey}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label={`Letter for Wild tile ${idx + 1}`}
                  value={wildTileInputs.get(wildKey) || ""}
                  onChange={e => {
                    const newInputs = new Map(wildTileInputs);
                    newInputs.set(wildKey, e.target.value.replace(/[^a-z]/gi, "").slice(-1).toUpperCase());
                    setWildTileInputs(newInputs);
                    setWildError(null);
                  }}
                  placeholder={`Wild tile ${idx + 1} letter (A-Z)`}
                  className="w-full text-center text-lg font-mono"
                  maxLength={1}
                  autoFocus={idx === 0}
                />;
              })}
            </div>
            {wildError && <p role="alert" className="text-sm font-medium text-[hsl(var(--bad))]">{wildError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={cancelWildDialog} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!pendingWildPath || wildPositionsOf(pendingWildPath).some(pos => !/^[A-Z]$/.test(wildTileInputs.get(`${pos.r}-${pos.c}`) || ""))}>
                Submit Word
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ResultsDialog
        open={showResults}
        onOpenChange={setShowResults}
        summary={results}
        primaryAction={resultsPrimary}
        onShare={shareResult}
        onShareImage={shareResultImage}
        secondaryActions={
          <div className="grid grid-cols-2 gap-2">
            {onBackToAdvancedModes ? (
              <Button variant="ghost" onClick={onBackToAdvancedModes}>More modes</Button>
            ) : (
              <Button variant="ghost" onClick={() => setShowResults(false)}>View board</Button>
            )}
            <Button variant="ghost" onClick={onBackToTitle}>Title screen</Button>
          </div>
        }
      />

      {/* On landscape phones the toolbar and HUD share one row */}
      <div className="contents landscape-phone:mb-2 landscape-phone:flex landscape-phone:items-center landscape-phone:gap-2">
      {/* Toolbar: one primary action, everything else in the overflow menu */}
      <div className="flex items-center gap-2 py-2 landscape-phone:order-2 landscape-phone:py-0">
        {primaryNewGame && (
          <Button variant="hero" size="sm" onClick={primaryNewGame.onClick} disabled={!isGameReady || isGenerating}>
            {isGenerating ? "Generating…" : primaryNewGame.label}
          </Button>
        )}
        {gameOver && results && !showResults && (
          <Button variant="brand" size="sm" onClick={() => setShowResults(true)}>Results</Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="How to play" onClick={() => setShowHowToPlay(true)}>
            <CircleHelp />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={isMuted ? "Turn sound on" : "Turn sound off"} aria-pressed={!isMuted} onClick={() => setMuted(!isMuted)}>
            {isMuted ? <VolumeX /> : <Volume2 />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Game menu">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {primaryNewGame && (
                <DropdownMenuItem onSelect={primaryNewGame.onClick} disabled={!isGameReady || isGenerating}>{primaryNewGame.label}</DropdownMenuItem>
              )}
              {settings.mode === "classic" && !gameOver && (
                <DropdownMenuItem onSelect={onEndGame}>End game</DropdownMenuItem>
              )}
              {settings.mode === "endless" && endlessStarted && !gameOver && (
                <DropdownMenuItem onSelect={() => endGame({ title: "Endless run complete", reason: `You reached level ${endlessDifficulty}.`, finalScore: score, showGrade: false })}>
                  End run
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setShowHowToPlay(true)}>How to play</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMuted(!isMuted)}>{isMuted ? "Turn sound on" : "Turn sound off"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onBackToAdvancedModes && (
                <DropdownMenuItem onSelect={onBackToAdvancedModes}>Back to game modes</DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onBackToTitle}>Back to title</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* HUD: score, medal track, and the mode's key stat stay above the board */}
      <GameHud
        className="sticky top-1 z-30 mb-3 landscape-phone:static landscape-phone:order-1 landscape-phone:mb-0 landscape-phone:flex-1"
        score={score}
        benchmarks={benchmarks}
        showTrack={settings.mode !== "endless" && settings.mode !== "puzzle"}
        stat={hudStat}
        best={getPersonalBest(settings.mode)?.score ?? null}
      />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] landscape-phone:grid-cols-[auto_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className={`relative rounded-2xl p-1 ${timeLow ? "animate-vignette" : ""} ${settings.mode === "survival" && survivalBossWordRequired ? "ring-4 ring-orange-500/70" : ""}`}>
            <GameBoard
              board={board}
              specialTiles={specialTiles}
              path={path}
              pathTone={pathTone}
              lastWordTiles={lastWordTiles}
              affectedTiles={affectedTiles}
              newWildTiles={newWildTiles}
              hintTiles={hintTiles}
              size={size}
              skin={skin}
              score={score}
              benchmarks={benchmarks}
              isInitializing={isInitializing}
              shakeKey={shakeKey}
              stamp={stamp}
              overlay={lockOverlay}
              focusPos={focusPos}
              onFocusPos={setFocusPos}
              onTilePointerDown={onTilePointerDown}
              onTileActivate={tapTile}
              loadingTip={loadingTip}
            />
          </div>

          {/* Action bar: pinned to the bottom on phones, inline on desktop */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:static lg:mt-3 lg:rounded-xl lg:border lg:p-3 landscape-phone:static landscape-phone:mt-3 landscape-phone:rounded-xl landscape-phone:border landscape-phone:p-2">
            <div className="mx-auto flex max-w-md items-center gap-2 lg:max-w-none">
              <div className={`min-w-0 flex-1 rounded-lg border px-3 py-1.5 ${feedback ? "border-[hsl(var(--bad))] bg-[hsl(var(--bad)/0.08)]" : "border-transparent bg-muted/60"}`}>
                <div className="truncate text-lg font-bold tracking-wide" aria-hidden="true">
                  {displayWordFromPath || (usedWords.length ? <span className="text-sm font-medium text-foreground/70">Reuse a ⛓ tile to chain</span> : <span className="text-sm font-medium text-foreground/70">Your chain starts here</span>)}
                </div>
                <div role="status" aria-live="polite" className="truncate text-xs font-semibold">
                  {feedback ? (
                    <span className="text-[hsl(var(--bad))]">✗ {feedback}</span>
                  ) : pathWordStatus ? (
                    <span className={
                      pathWordStatus.state === "valid" ? "text-[hsl(var(--ok))]"
                        : pathWordStatus.state === "invalid" ? "text-[hsl(var(--bad))]"
                        : pathWordStatus.state === "used" || pathWordStatus.state === "nolink" ? "text-[hsl(var(--warn))]"
                        : "text-foreground/75"
                    }>
                      <span className="sr-only">{displayWordFromPath}: </span>
                      {pathWordStatus.state === "valid" ? "✓ " : pathWordStatus.state === "invalid" ? "✗ " : ""}
                      {pathWordStatus.label}
                    </span>
                  ) : (
                    <span className="text-foreground/70">Drag, tap, or type a word</span>
                  )}
                </div>
              </div>
              {settings.mode === "zen" && (
                <>
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={`Undo last word (${zenUndoStack.length} available)`} disabled={zenUndoStack.length === 0 || gameOver} onClick={handleZenUndo}>
                    <Undo2 />
                  </Button>
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={`Hint (${zenHintsUsed} used)`} disabled={gameOver || !isGameReady} onClick={handleZenHint}>
                    <Lightbulb />
                  </Button>
                </>
              )}
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Clear word" disabled={path.length === 0} onClick={clearPath}>
                <X />
              </Button>
              <Button
                className="h-11 shrink-0 bg-[hsl(var(--ok))] px-4 text-white hover:bg-[hsl(var(--ok)/0.9)] disabled:bg-muted disabled:text-foreground/60 dark:text-gray-950"
                disabled={!canSubmit || gameOver}
                onClick={() => submitWord(pathRef.current)}
              >
                <Send />
                Submit
              </Button>
            </div>
          </div>

          {/* Mobile consumables + daily special tile preview */}
          {isMobile && (
            <div className="mt-3 flex items-center justify-center gap-2 lg:hidden">
              <QuickUseBar inventory={consumableInventory} onUseConsumable={handleUseConsumable} gameMode={settings.mode} gameState={{ gameOver, isGenerating }} disabled={gameOver || isGenerating} />
              {dailyPreview.length > 0 && <SpecialTilePreview tiles={dailyPreview} />}
            </div>
          )}
        </div>

        <aside className="space-y-3" aria-label="Game details">
          {/* Mode details */}
          {settings.mode === "time_attack" && timeAttackStarted && (
            <Card className="p-3 text-sm">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/75">Time Attack</h2>
              <p>Words: <strong>{timeAttackWordsFound}</strong> · Next ⚡ in {3 - (timeAttackWordsFound % 3)} word{3 - (timeAttackWordsFound % 3) === 1 ? "" : "s"}</p>
              <p className="text-foreground/75">Longer words add up to 5 seconds.</p>
            </Card>
          )}

          {settings.mode === "survival" && survivalStarted && (
            <Card className="space-y-3 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/75">
                Wave {survivalWave}{survivalBossWordRequired ? " · Boss" : ""}
              </h2>
              <LivesDisplay lives={survivalLives} maxLives={survivalMaxLives} shields={survivalShields} lifeFragments={survivalLifeFragments} />
              <ComboDisplay comboState={survivalComboState} />
              {survivalBossWordRequired && survivalCurrentBoss && (
                <BossWaveDisplay boss={survivalCurrentBoss} progress={survivalBossProgress} timeRemaining={survivalChallengeTimeRemaining} />
              )}
              {!survivalBossWordRequired && survivalCurrentChallenge && (
                <WaveChallengeDisplay challenge={survivalCurrentChallenge} progress={survivalChallengeProgress} timeRemaining={survivalChallengeTimeRemaining} />
              )}
              <PowerUpsInventory activePowerUps={survivalActivePowerUps} inventoryPowerUps={survivalInventoryPowerUps} onActivate={handleActivatePowerUp} />
              <div className="text-xs text-foreground/75">
                Wave score: <span className="font-bold text-foreground">{survivalWaveScore}</span>
              </div>
            </Card>
          )}

          {settings.mode === "zen" && (
            <Card className="p-3">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/75">Zen tip</h2>
              <p className="text-sm">
                {[
                  "Longer words (5+ letters) give bonus points!",
                  "Rare letters like Q, X, Z give extra score",
                  "Reusing tiles from your last word adds multipliers",
                  "Look for word endings like -ING, -TION, -ED",
                  "Try to chain words with shared letters",
                  "Special tiles can multiply your score",
                  "Use the Hint button if you're stuck!",
                  "Undo lets you try different strategies"
                ][usedWords.length % 8]}
              </p>
              <p className="mt-1 text-xs text-foreground/75">Hints used: {zenHintsUsed} · Undos available: {zenUndoStack.length}</p>
            </Card>
          )}

          {puzzleMode && currentPuzzleId && (() => {
            const puzzle = getPuzzleById(currentPuzzleId);
            if (!puzzle) return null;
            return (
              <Card className="space-y-1 p-3 text-sm">
                <h2 className="font-semibold">🧩 {puzzle.name}</h2>
                <p className="text-foreground/80">Moves: {puzzle.maxMoves - puzzleMovesRemaining}/{puzzle.maxMoves} · Required: {Array.from(puzzleRequiredWords).filter(w => puzzleFoundWords.has(w)).length}/{puzzleRequiredWords.size}</p>
                <ul className="flex flex-wrap gap-1 pt-1">
                  {puzzle.requiredWords.map(word => {
                    const found = puzzleFoundWords.has(word.toUpperCase());
                    return (
                      <li key={word} className={`rounded px-1.5 py-0.5 text-xs ${found ? "bg-[hsl(var(--ok)/0.15)] font-semibold text-[hsl(var(--ok))]" : "bg-muted text-foreground/80"}`}>
                        {found ? "✓ " : ""}{word}<span className="sr-only">{found ? ", found" : ", not found yet"}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })()}

          {dailyPreview.length > 0 && (
            <div className="hidden lg:block">
              <SpecialTilePreview tiles={dailyPreview} />
            </div>
          )}

          {/* Tier thresholds (the HUD shows progress; this lists exact targets) */}
          {benchmarks && settings.mode !== "endless" && settings.mode !== "puzzle" && (
            <Card className="p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/75">Medal targets</h2>
              <ul className="grid grid-cols-2 gap-1.5 text-xs">
                {([
                  ["Bronze", "🥉", benchmarks.bronze],
                  ["Silver", "🥈", benchmarks.silver],
                  ["Gold", "🥇", benchmarks.gold],
                  ["Platinum", "💎", benchmarks.platinum],
                ] as const).map(([name, emoji, target]) => {
                  const reached = score >= target;
                  return (
                    <li key={name} className={`flex items-center justify-between rounded px-2 py-1 ${reached ? "bg-[hsl(var(--brand-500)/0.12)] font-semibold" : "bg-muted/60 text-foreground/80"}`}>
                      <span><span aria-hidden="true">{emoji} </span>{name}</span>
                      <span className="tabular-nums">{target.toLocaleString()}{reached ? <span className="sr-only"> (reached)</span> : null}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {usedWords.length > 0 && (() => {
            const last = usedWords[usedWords.length - 1];
            const bd = last.breakdown;
            if (!bd) return null;
            return <Card className="p-3">
                <h2 className="text-xs text-foreground/75 mb-1">Last word breakdown</h2>
                <div className="text-sm font-medium mb-2">{last.word.toUpperCase()} <span className="text-foreground/75">+{last.score}</span></div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <div>Base</div><div className="text-right">+{bd.base}</div>
                  <div>Rarity</div><div className="text-right">+{Math.round(bd.rarity.bonus)}{bd.rarity.ultraCount > 0 ? <span className="ml-1 text-[10px]">(ultra {bd.rarity.ultraCount})</span> : null}</div>
                  <div>Link</div><div className="text-right">×{bd.linkMultiplier.toFixed(1)}</div>
                  <div>Length</div><div className="text-right">+{bd.lengthBonus}</div>
                  <div className="col-span-2 border-t my-1" />
                  <div>Subtotal</div><div className="text-right">+{bd.totalBeforeMultipliers}</div>
                  <div>Multipliers</div>
                  <div className="text-right">
                    {bd.multipliers.tileMultiplier}x tile {bd.multipliers.consumableMultiplier > 1 ? `· ${bd.multipliers.consumableMultiplier}x consumable` : ""}
                    <div className="text-[10px] text-foreground/75">Applied: {Number(bd.multipliers.combinedApplied.toFixed(2))}x</div>
                  </div>
                  <div className="col-span-2 border-t my-1" />
                  <div className="font-semibold">Total</div><div className="text-right font-semibold">+{last.score}</div>
                </div>
              </Card>;
          })()}

          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs text-foreground/75">Used words ({usedWords.length})</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSortAlphabetically(!sortAlphabetically)} className="h-8 px-2 text-xs" aria-label={sortAlphabetically ? "Sorted A to Z. Sort by latest" : "Sorted by latest. Sort A to Z"}>
                  {sortAlphabetically ? "A-Z" : "Latest"}
                </Button>
                {usedWords.length > 8 && (
                  <Button variant="ghost" size="sm" onClick={() => setUsedWordsExpanded(!usedWordsExpanded)} className="h-8 w-8 p-0" aria-expanded={usedWordsExpanded} aria-label={usedWordsExpanded ? "Show fewer words" : "Show all words"}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${usedWordsExpanded ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </div>
            </div>
            {(() => {
              if (!usedWords.length) {
                return <span className="text-foreground/75 text-xs">Your chain starts here — your words will appear in this list.</span>;
              }
              const limit = usedWordsExpanded ? usedWords.length : 8;
              if (sortAlphabetically) {
                const sortedWords = [...usedWords].sort((a, b) => a.word.localeCompare(b.word)).slice(0, limit);
                return <ul className="flex flex-wrap gap-1">
                    {sortedWords.map((entry, index) => (
                      <li key={`${entry.word}-${index}`}>
                        <DefinableWord word={entry.word} className="bg-secondary text-secondary-foreground" />
                      </li>
                    ))}
                  </ul>;
              }
              const latestWords = usedWords.slice(-limit).reverse();
              return <Accordion type="multiple" className="w-full">
                  {latestWords.map((entry, index) => (
                    <AccordionItem key={`${entry.word}-${index}`} value={`${entry.word}-${index}`} className="border-b-0">
                      <AccordionTrigger className="py-1.5 hover:no-underline">
                        <div className="w-full flex justify-between items-center text-xs pr-2">
                          <span className="font-medium">{entry.word.toUpperCase()}</span>
                          <span className="text-foreground/75">+{entry.score}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        {entry.breakdown ? (
                          <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                            <div>Base</div><div className="text-right">+{entry.breakdown.base}</div>
                            <div>Rarity</div><div className="text-right">+{Math.round(entry.breakdown.rarity.bonus)}</div>
                            <div>Link</div><div className="text-right">×{entry.breakdown.linkMultiplier.toFixed(1)}</div>
                            <div>Length</div><div className="text-right">+{entry.breakdown.lengthBonus}</div>
                            <div className="col-span-2 border-t my-1" />
                            <div className="font-semibold">Total</div><div className="text-right font-semibold">+{entry.score}</div>
                          </div>
                        ) : (
                          <div className="text-foreground/75">No breakdown available</div>
                        )}
                        <div className="mt-2 border-t pt-2">
                          <DefinitionContent word={entry.word} />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>;
            })()}
            {!usedWordsExpanded && usedWords.length > 8 && (
              <p className="mt-1 text-[11px] text-foreground/70">+{usedWords.length - 8} more</p>
            )}
          </Card>

          {/* Consumables Inventory */}
          <ConsumableInventoryPanel inventory={consumableInventory} onUseConsumable={handleUseConsumable} gameMode={settings.mode} disabled={gameOver || isGenerating} activatedConsumables={activatedConsumables} />
        </aside>
      </div>

      {/* Survival Mode Modals */}
      {settings.mode === "survival" && survivalStarted && (
        <>
          {/* Shop Modal */}
          {survivalShowShop && (
            <ShopModal
              items={generateShopItems(survivalWave, score)}
              currentScore={score}
              currentLives={survivalLives}
              onPurchase={(item) => {
                if (item.costType === 'points' && score >= item.cost) {
                  setScore(prev => prev - item.cost);

                  // Apply item effect
                  switch (item.type) {
                    case 'extra_life':
                      setSurvivalLives(prev => Math.min(prev + 1, survivalMaxLives));
                      toast.success('❤️ +1 Life!');
                      break;
                    case 'stone_eraser':
                      // Remove all stone tiles
                      setSpecialTiles(prev => prev.map(row => row.map(tile =>
                        tile.type === 'stone' ? { type: null } : tile
                      )));
                      toast.success('🧹 All stones removed!');
                      break;
                    case 'shield':
                      setSurvivalShields(prev => prev + 1);
                      toast.success('🛡️ +1 Shield!');
                      break;
                    case 'time_freeze':
                      setSurvivalDifficultyFrozen(3);
                      toast.success('❄️ Difficulty frozen for 3 waves!');
                      break;
                    case 'double_points':
                      setSurvivalPointsMultiplier(2.0);
                      toast.success('💰 Double points for next wave!');
                      break;
                    case 'power_up_random': {
                      const randomPU = getRandomPowerUp();
                      setSurvivalInventoryPowerUps(prev => [...prev, randomPU]);
                      toast.success(`🎲 Received ${randomPU.name}!`);
                      break;
                    }
                    case 'power_up_rare': {
                      const rarePU = getRandomPowerUp(Math.random() < 0.5 ? 'rare' : 'epic');
                      setSurvivalInventoryPowerUps(prev => [...prev, rarePU]);
                      toast.success(`⭐ Received ${rarePU.name}!`);
                      break;
                    }
                  }

                  setSurvivalShowShop(false);

                  // Generate next wave challenge
                  const nextChallenge = getRandomWaveChallenge(survivalWave);
                  setSurvivalCurrentChallenge(nextChallenge);
                  toast.info(`🌊 Wave ${survivalWave}: ${nextChallenge.description}`, { duration: 4000 });
                } else {
                  toast.error('Not enough resources!');
                }
              }}
              onClose={() => {
                setSurvivalShowShop(false);
                const nextChallenge = getRandomWaveChallenge(survivalWave);
                setSurvivalCurrentChallenge(nextChallenge);
                toast.info(`🌊 Wave ${survivalWave}: ${nextChallenge.description}`, { duration: 4000 });
              }}
            />
          )}

          {/* Choice Event Modal */}
          {survivalPendingEvent && (
            <ChoiceEventModal
              event={survivalPendingEvent}
              onChoice={(optionIndex) => {
                const option = survivalPendingEvent.options[optionIndex];

                // BUG FIX #4: Handle gambles and mysteries at choice time
                const actualEffect = { ...option.effect };

                if (option.effect.gamble === 'life_gambit') {
                  // 60% chance to gain 1 life, 40% chance to lose 1 life
                  actualEffect.lives = Math.random() < 0.6 ? 1 : -1;
                  actualEffect.gamble = undefined;
                } else if (option.effect.gamble === 'score_gambit') {
                  // 50% chance to gain 500 points, 50% chance to lose 300 points
                  actualEffect.score = Math.random() < 0.5 ? 500 : -300;
                  actualEffect.gamble = undefined;
                } else if (option.effect.mystery === 'mystery_box') {
                  // 50% chance for good outcome, 50% for bad
                  if (Math.random() < 0.5) {
                    actualEffect.powerUp = 'combo_boost';
                    actualEffect.lives = 1;
                  } else {
                    actualEffect.addStoneTiles = 2;
                    actualEffect.score = -100;
                  }
                  actualEffect.mystery = undefined;
                }

                const messages = applyEventEffect(actualEffect, {});

                // Apply effects
                if (actualEffect.lives) {
                  setSurvivalLives(prev => Math.max(0, Math.min(prev + actualEffect.lives, survivalMaxLives)));
                }
                if (actualEffect.score) {
                  setScore(prev => Math.max(0, prev + actualEffect.score));
                }
                if (actualEffect.removeStoneTiles) {
                  setSpecialTiles(prev => prev.map(row => row.map(tile =>
                    tile.type === 'stone' ? { type: null } : tile
                  )));
                }
                // BUG FIX #7: Implement addStoneTiles effect
                if (actualEffect.addStoneTiles) {
                  setSpecialTiles(prev => {
                    const newTiles = [...prev.map(row => [...row])];
                    const emptyPositions: Array<{r: number, c: number}> = [];

                    // Find all empty positions
                    for (let r = 0; r < size; r++) {
                      for (let c = 0; c < size; c++) {
                        if (newTiles[r][c].type === null) {
                          emptyPositions.push({ r, c });
                        }
                      }
                    }

                    // Add stone tiles to random empty positions
                    const stonesToAdd = Math.min(actualEffect.addStoneTiles, emptyPositions.length);
                    for (let i = 0; i < stonesToAdd; i++) {
                      const randomIndex = Math.floor(Math.random() * emptyPositions.length);
                      const pos = emptyPositions.splice(randomIndex, 1)[0];
                      newTiles[pos.r][pos.c] = { type: 'stone' };
                    }

                    return newTiles;
                  });
                }
                if (actualEffect.shield) {
                  setSurvivalShields(prev => prev + actualEffect.shield);
                }
                if (actualEffect.powerUp) {
                  const powerUp = POWER_UPS[actualEffect.powerUp];
                  setSurvivalInventoryPowerUps(prev => [...prev, powerUp]);
                }

                // Show messages
                messages.forEach(msg => toast.info(msg));

                setSurvivalPendingEvent(null);

                // Generate next wave challenge
                const nextChallenge = getRandomWaveChallenge(survivalWave);
                setSurvivalCurrentChallenge(nextChallenge);
                toast.info(`🌊 Wave ${survivalWave}: ${nextChallenge.description}`, { duration: 4000 });
              }}
            />
          )}
        </>
      )}

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-foreground/70">
        © {new Date().getFullYear()} Banton Games. All rights reserved.
      </footer>
    </section>
  );
}

export default WordPathGame;

