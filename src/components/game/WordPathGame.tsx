import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { computeBenchmarksFromWordCount, computeBoardSpecificBenchmarks, computeDynamicBenchmarks, type Benchmarks, type BoardAnalysis } from "@/lib/benchmarks";
import { analyzeBoardComposition } from "@/lib/boardAnalysis";
import { ACHIEVEMENTS, type AchievementId, vowelRatioOfWord } from "@/lib/achievements";
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { getDailyChallengeDate } from "@/utils/dateUtils";
import { saveDailyChallengeResultBulletproof } from "@/utils/dailyChallengeResultSaver";
import { SpecialTilePreview } from "@/components/ui/special-tile-preview";
import { previewNextSpecialTiles } from "@/utils/specialTilePreview";
import { dictionaryManager } from "@/utils/dictionaryManager";
import { getPuzzleById, getNextPuzzle } from "@/lib/puzzleBoards";
import { useTileSkin } from "@/hooks/useTileSkin";
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
import { GameBoard } from "./GameBoard";
import { LETTERS, letterRarity } from "@/lib/letterRarity";
import {
  CONSONANT_POOL, ENHANCED_TILE_RARITIES, K_MIN_WORDS, LOW_VALUE_LETTERS, MAGNET_VOWELS,
  MAX_ATTEMPTS, MAX_DFS_NODES, MUTATION_ROUNDS, RESPAWN_COUNT, SHARE_URL, SPECIAL_TILE_RARITIES,
  TARGET_VOWEL_MAX, TARGET_VOWEL_MIN, VOWELS, VOWEL_POOL,
  applyFreezeSpawnEffect, applyMagnetSpawnEffect, binaryHasPrefix, checkAndAwardAchievements,
  computeBoardAnalysis, computeScoreBreakdown, constrainedRandomLetter, countVowelRatio,
  generateSolvableBoard, getAdjacentPositions, getDailyMovesLimit, getDailySeed, getRarityScore,
  handleBombBlast, handleShuffleTiles, handleXFactorTiles, isEnhancedPowerupsEnabled, isVowel,
  keyOf, makeBoard, mutateGrid, neighbors, pickWeighted, probeGrid, processDecaySpread,
  randomConsonantWeighted, randomLetter, randomVowelWeighted, seedRandom, seededRandomLetter,
  validateAndFixQUAdjacency, within,
  type GameMode, type GameSettings, type ProbeResult, type ScoreBreakdown,
} from "./wordPathEngine";

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
    useConsumable,
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
  const [touchStartPos, setTouchStartPos] = useState<{
    x: number;
    y: number;
    timestamp?: number;
  } | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [movesUsed, setMovesUsed] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
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
  
  // Zen mode hint highlighting
  const [hintHighlight, setHintHighlight] = useState<Pos[] | null>(null);

  // Tap-to-select functionality
  const [isTapMode, setIsTapMode] = useState(isMobile);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapPos, setLastTapPos] = useState<Pos | null>(null);

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
    } else if (initialMode === "chaos") {
      setSettings(prev => ({ ...prev, mode: "chaos" }));
    }
  }, [initialMode, dailyChallengeInitialized]);

  // Reset game start time when new game starts
  useEffect(() => {
    setGameStartTime(Date.now());
  }, [board]);

  // Time Attack timer with visual warnings
  useEffect(() => {
    if (settings.mode === "time_attack" && timeAttackStarted && !gameOver) {
      const interval = setInterval(() => {
        setTimeAttackTimeRemaining(prev => {
          const newTime = prev - 1;
          
          // Visual warnings at 30s and 10s
          if (newTime === 30) {
            toast.warning('⏰ 30 seconds remaining!', { duration: 2000 });
          } else if (newTime === 10) {
            toast.error('⚡ 10 seconds left!', { duration: 2000 });
          }
          
          if (newTime <= 0) {
            
            
            
            
            // Show completion toast
            toast.success(`⏱️ Time Attack Complete! Score: ${score}`, {
              duration: 4000
            });
            
            setGameOver(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [settings.mode, timeAttackStarted, gameOver, usedWords, score, settings.difficulty]);

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
          board: initialBoardToSave ?? board,
          initialBoard: initialBoardToSave ?? board,
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
    await stateHook.saveState(gameState as any, immediate);
  };

  const saveDailyState = (initialBoardToSave?: string[][], immediate = false) =>
    saveDailyStateForMode("daily", initialBoardToSave, immediate);
  const saveDaily5x5State = (initialBoardToSave?: string[][], immediate = false) =>
    saveDailyStateForMode("daily_5x5", initialBoardToSave, immediate);

  // Load daily challenge state (shared logic for both daily and daily_5x5 modes)
  const loadDailyStateForMode = async (mode: "daily" | "daily_5x5") => {
    const stateHook = mode === "daily" ? dailyChallengeState : dailyChallengeState5x5;
    const gameState = await stateHook.loadState();
    if (gameState && gameState.board && gameState.initialBoard) {
      setBoard(gameState.board);
      setSpecialTiles(gameState.specialTiles);
      setUsedWords(gameState.usedWords);
      setScore(gameState.score);
      setStreak(gameState.streak);
      setMovesUsed(gameState.movesUsed);
      setUnlocked(new Set(gameState.unlocked));
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

  // Strategic save function that prevents saves during initialization
  const saveGameState = useCallback(() => {
    if (settings.mode === "daily" && !isInitializing && board && board.length > 0) {
      saveDailyState();
    } else if (settings.mode === "daily_5x5" && !isInitializing && board && board.length > 0) {
      saveDaily5x5State();
    }
  }, [settings.mode, isInitializing, board, saveDailyState, saveDaily5x5State]);
  
  // Puzzle mode helpers
  const savePuzzleCompletion = async (lastWord: string) => {
    if (!user || !currentPuzzleId) return;
    
    const puzzle = getPuzzleById(currentPuzzleId);
    if (!puzzle) return;
    
    const optionalFound = Array.from(puzzleFoundWords).filter(
      w => puzzle.optionalWords?.includes(w)
    ).length;
    
    try {
      const { error } = await supabase
        .from('puzzle_completions' as any)
        .upsert({
          user_id: user.id,
          puzzle_id: currentPuzzleId,
          moves_used: puzzle.maxMoves - puzzleMovesRemaining + 1,
          optional_words_found: optionalFound,
          score: score,
          completed_at: new Date().toISOString()
        });
      
      if (!error) {
        
        toast.success(`🧩 Puzzle Complete!`, {
          description: `All required words found! ${optionalFound} bonus words.`
        });
        
        setGameOver(true);
      }
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
    setPath([]);
    
    // Calculate benchmarks for the puzzle board
    const probe = probeGrid(puzzle.board, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
    const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
    setBenchmarks(bms);
    setDiscoverableCount(probe.words.size);
    
    toast.success(`🧩 ${puzzle.name} loaded! Find all required words in ${puzzle.maxMoves} moves.`);
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
            let probe: any;
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
              
              // Auto-start endless mode when board is ready
              if (initialMode === "endless") {
                setEndlessStarted(true);
                setEndlessDifficulty(1);
                toast.success('🎯 Endless Mode Started! Clear all words to advance!', { duration: 3000 });
              } else {
                toast.success(`Dictionary loaded (${status.wordCount.toLocaleString()} words). Board ready!`);
              }
            } else {
              // Puzzle mode - just load dictionary, board will be loaded via loadPuzzle()
              setIsGenerating(false);
            }
          } else {
            toast.success(`Dictionary loaded (${status.wordCount.toLocaleString()} words). Waiting for game mode initialization...`);
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

  function handleWildSubmit() {
    if (!pendingWildPath || !wildTileInputs.size || !dict) return;
    const wildcardPositions = pendingWildPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    if (wildcardPositions.length === 0) return;

    const submittedWildLetters = wildcardPositions.map(pos => {
      const wildKey = `${pos.r}-${pos.c}`;
      return (wildTileInputs.get(wildKey) || '').toLowerCase();
    });
    if (submittedWildLetters.some(letter => !/^[a-z]$/.test(letter))) {
      toast.error("Please enter a letter for every Wild tile.");
      return;
    }

    // Create the word with the user's chosen letter, respecting ghost/mirror behavior
    const letters: string[] = [];
    let wildLetterIndex = 0;
    for (let i = 0; i < pendingWildPath.length; i++) {
      const p = pendingWildPath[i];
      const tile = specialTiles[p.r][p.c];
      
      if (tile.type === "wild") {
        letters.push(submittedWildLetters[wildLetterIndex] || "");
        wildLetterIndex++;
      } else if (tile.type === "ghost") {
        continue; // Ghost contributes no letter
      } else if (tile.type === "mirror") {
        if (letters.length > 0) {
          letters.push(letters[letters.length - 1]); // Copy previous letter
        }
        // If no previous letter exists, mirror contributes nothing
      } else {
        letters.push(board[p.r][p.c]);
      }
    }
    const testWord = letters.join("").toLowerCase();

    // Validate the word using enhanced dictionary manager
    const validation = dictionaryManager.validateWord(testWord);
    if (!validation.isValid) {
      toast.error(`Not a valid word: ${testWord.toUpperCase()}`);
      return;
    }
    if (usedWords.some(entry => entry.word === testWord)) {
      toast.warning("Already used");
      return;
    }

    // Close dialog and continue with word submission logic
    setShowWildDialog(false);
    setWildTileInputs(new Map());

    // Set the path back and continue submission with the chosen word
    const submittedPath = [...pendingWildPath];
    setPath(submittedPath);
    setPendingWildPath(null);

    // Now continue with the normal submission process using the validated word
    setTimeout(() => {
      submitWordWithWildLetters(testWord, submittedPath, submittedWildLetters);
    }, 0);
  }
  function submitWordWithWildLetters(validatedWord: string, wordPath: Pos[], wildLetters: string[]) {
    if (gameOver) {
      toast.info("Round over");
      return;
    }

    // Check daily challenge move limit
    if ((settings.mode === "daily" || settings.mode === "daily_5x5") && movesUsed >= settings.dailyMovesLimit) {
      toast.error("Daily move limit reached!");
      return;
    }
    
    // Check puzzle mode move limit
    if (puzzleMode && puzzleMovesRemaining <= 0) {
      toast.error("Puzzle move limit reached!");
      return;
    }
    
    const actualWord = validatedWord;
    const hasStoneTile = wordPath.some(p => specialTiles[p.r][p.c].type === "stone");
    if (hasStoneTile) {
      toast.error("Cannot use words containing Stone tiles!");
      return;
    }
    if (lastWordTiles.size > 0) {
      const overlap = wordPath.some(p => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return;
      }
    }
    const breakdown = computeScoreBreakdown({
      actualWord,
      wordPath,
      board,
      specialTiles,
      lastWordTiles,
      streak,
      mode: settings.mode,
      timeAttackSpeedMultiplier,
      activeEffects,
      baseMode: "square"
    });
    const totalGain = breakdown.total;
    setUsedWords(prev => [...prev, {
      word: actualWord,
      score: totalGain,
      breakdown
    }]);

    // Save state after successful word submission
    saveGameState();

    // Legacy variables needed for achievements and toasts
    const sharedTilesCount = lastWordTiles.size ? wordPath.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;

    // Update the wild tile(s) with the chosen letter(s) permanently on the board
    const newBoard = board.map(row => [...row]);
    const wildcardPositions = wordPath.filter(p => specialTiles[p.r][p.c].type === "wild");
    
    wildcardPositions.forEach((wildPos, index) => {
      if (index < wildLetters.length) {
        newBoard[wildPos.r][wildPos.c] = wildLetters[index].toUpperCase();
      }
    });

    // Apply Q-U adjacency validation if any Q letters were placed
    const hasNewQ = wildcardPositions.some((wildPos, index) =>
      index < wildLetters.length && wildLetters[index].toUpperCase() === 'Q'
    );
    const validatedBoard = hasNewQ ?
      validateAndFixQUAdjacency(newBoard, size, undefined, undefined, true).board :
      newBoard;

    // Remove the wild tile special type since it's now a regular letter
    const specialTilesAfterWild = specialTiles.map(row => [...row]);
    wildcardPositions.forEach(wildPos => {
      specialTilesAfterWild[wildPos.r][wildPos.c] = {
        type: null
      };
    });

    setBoard(validatedBoard);
    setSpecialTiles(specialTilesAfterWild);
    // Increment moves for daily challenge
    if (settings.mode === "daily" || settings.mode === "daily_5x5") {
      setMovesUsed(prev => prev + 1);
    }
    
    // Save state for Zen mode undo (before making changes)
    if (settings.mode === "zen") {
      setZenUndoStack(prev => [...prev, {
        board: board ? board.map(row => [...row]) : [],
        specialTiles: specialTiles.map(row => row.map(tile => ({ ...tile }))),
        usedWords: [...usedWords],
        score: score,
        lastWordTiles: new Set(lastWordTiles)
      }]);
    }

    // Handle X-Factor tiles first and track board state through all effects
    let trackedBoard = validatedBoard.map(row => [...row]);
    const xFactorResult = handleXFactorTiles(
      wordPath, 
      specialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setSpecialTiles, 
      setAffectedTiles
    );
    const xChanged = xFactorResult.xChanged;
    trackedBoard = xFactorResult.board;
    let trackedSpecialTiles = xFactorResult.specialTiles;

    // Handle shuffle tiles (use updated board from X-factor)
    trackedBoard = handleShuffleTiles(
      wordPath, 
      trackedSpecialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setAffectedTiles
    );

    // Handle Bomb tile blasts (after scoring, before clearing path tiles)
    const bombTilesInPath = wordPath.filter(p => trackedSpecialTiles[p.r][p.c].type === "bomb");
    if (bombTilesInPath.length > 0) {
      for (const bombPos of bombTilesInPath) {
        const bombResult = handleBombBlast(bombPos, trackedBoard, trackedSpecialTiles, size, setBoard, setSpecialTiles, setAffectedTiles);
        trackedBoard = bombResult.board;
        trackedSpecialTiles = bombResult.specialTiles;
      }
    }

    let newSpecialTiles = trackedSpecialTiles.map(row => row.map(tile => ({ ...tile })));
    wordPath.forEach(p => {
      if (newSpecialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = {
          ...newSpecialTiles[p.r][p.c],
          type: null
        };
      }
    });

    // Process Decay spread before expiry (enhanced powerups only, not daily)
    if (isEnhancedPowerupsEnabled() && settings.mode !== "daily" && settings.mode !== "daily_5x5") {
      const decayResult = processDecaySpread(newSpecialTiles, trackedBoard, size);
      newSpecialTiles = decayResult.tiles;
      trackedBoard = decayResult.board;
      setBoard(trackedBoard);
    }

    newSpecialTiles = expireSpecialTiles(newSpecialTiles);

    // Clear frozen flags from tiles whose adjacent Freeze tile expired
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newSpecialTiles[r][c].frozen) {
          // Check if any adjacent tile is still a Freeze tile
          const orthogonal = [
            { r: r - 1, c: c }, { r: r + 1, c: c },
            { r: r, c: c - 1 }, { r: r, c: c + 1 },
          ];
          const stillFrozen = orthogonal.some(
            adj => within(adj.r, adj.c, size) && newSpecialTiles[adj.r][adj.c].type === "freeze"
          );
          if (!stillFrozen) {
            newSpecialTiles[r][c] = { ...newSpecialTiles[r][c], frozen: false };
          }
        }
      }
    }

    setSpecialTiles(newSpecialTiles);
    setLastWordTiles(new Set(wordPath.map(keyOf)));
    clearPath();

    // Check for new achievements using shared function
    const { newAchievements, achievementBonus } = checkAndAwardAchievements(
      actualWord,
      wordPath,
      usedWords,
      unlocked,
      0,
      sharedTilesCount,
      multiplier,
      xChanged,
      true,
      board
    );

    const finalScore = score + totalGain + achievementBonus;
    setScore(finalScore);
    // Remove streak dependency - no longer needed in length-based system

    setUnlocked(prev => {
      const next = new Set(prev);
      newAchievements.forEach(id => next.add(id));
      return next;
    });

    // Show achievement toasts
    newAchievements.forEach(id => {
      const achievement = ACHIEVEMENTS[id];
      const rarityEmoji = {
        common: "🏆",
        rare: "⭐",
        epic: "💎",
        legendary: "👑"
      }[achievement.rarity];
      toast.success(`${rarityEmoji} ${achievement.label} (+${achievement.scoreBonus} pts)`, {
        duration: 4000
      });
    });
    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (finalScore >= targetScore && !gameOver) {
        const grade = settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);
        
        
        
        
        setGameOver(true);
        toast.success(`🎯 Target reached: ${grade}`);
      }
    }
    navigator.vibrate?.(50);
    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);

    processTimeAttackWord(actualWord);

    processSurvivalWord(actualWord, wordPath, totalGain);

    // Introduce special tiles if conditions are met
    if (shouldIntroduceSpecialTiles(usedWords.length)) {
      let updatedSpecialTiles: SpecialTile[][];
      let newWildPositions: string[];

      if (settings.mode === "daily" || settings.mode === "daily_5x5") {
        // Use seeded special tiles for daily challenge - all players get same tiles
        const dailySeedForMode = settings.mode === "daily_5x5" ? getDailySeed() + "-5x5" : getDailySeed();
        const result = introduceSeededSpecialTiles(
          newSpecialTiles,
          usedWords.length + 1, // +1 because we just completed a word
          score,
          size,
          dailySeedForMode
        );
        updatedSpecialTiles = result.tiles;
        newWildPositions = result.newWildPositions;
      } else {
        // Non-daily modes use random special tiles
        updatedSpecialTiles = [...newSpecialTiles];
        const emptyPositions: Pos[] = [];

        // Find empty positions (tiles without special tiles)
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (updatedSpecialTiles[r][c].type === null) {
              emptyPositions.push({
                r,
                c
              });
            }
          }
        }

        // Randomly place special tiles (1-3 tiles per trigger)
        const numTilesToPlace = Math.floor(Math.random() * 3) + 1;
        const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);
        newWildPositions = [];
        let currentBoard = trackedBoard;
        for (let i = 0; i < tilesToPlace; i++) {
          const randomIndex = Math.floor(Math.random() * emptyPositions.length);
          const pos = emptyPositions.splice(randomIndex, 1)[0];
          const specialTile = generateSpecialTile(
            score,
            settings.mode,
            settings.mode === "endless" ? endlessDifficulty : 1
          );
          if (specialTile.type !== null) {
            // Preserve frozen flag if it exists
            const existingFrozen = updatedSpecialTiles[pos.r][pos.c].frozen;
            updatedSpecialTiles[pos.r][pos.c] = { ...specialTile, frozen: existingFrozen || specialTile.frozen };
            // Track newly spawned Wild tiles
            if (specialTile.type === "wild") {
              newWildPositions.push(keyOf(pos));
            }
            // Apply spawn effects for enhanced tiles
            if (specialTile.type === "magnet") {
              currentBoard = applyMagnetSpawnEffect(pos, currentBoard, updatedSpecialTiles, size);
              setBoard(currentBoard);
            }
            if (specialTile.type === "freeze") {
              updatedSpecialTiles = applyFreezeSpawnEffect(pos, updatedSpecialTiles, size);
            }
          }
        }
        trackedBoard = currentBoard;
      }

      setSpecialTiles(updatedSpecialTiles);
      // Add new Wild tiles to tracking set
      if (newWildPositions.length > 0) {
        setNewWildTiles(prev => {
          const updated = new Set(prev);
          newWildPositions.forEach(key => updated.add(key));
          return updated;
        });
        // Remove from tracking after blink animation completes (1.2s)
        setTimeout(() => {
          setNewWildTiles(prev => {
            const updated = new Set(prev);
            newWildPositions.forEach(key => updated.delete(key));
            return updated;
          });
        }, 1200);
      }
    }
    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = (settings.mode === "daily" || settings.mode === "daily_5x5") && movesUsed + 1 >= settings.dailyMovesLimit;
        // The just-played word is now the chain link: future words must reuse its tiles,
        // and it can no longer be replayed.
        const any = hasAnyValidMove(trackedBoard, new Set(wordPath.map(keyOf)), dict, sorted, new Set([...usedWords.map(entry => entry.word), validatedWord]));
        if (!any || dailyMovesExceeded) {
          if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = finalScore;
            
            // Handle endless mode - regenerate board instead of ending game
            if (settings.mode === "endless") {
              // Increment difficulty - linear progression is fine for now
              // Could be adjusted to exponential or step-based if needed
              setEndlessDifficulty(prev => prev + 1);
              // Regenerate board with increased difficulty
              setIsGenerating(true);
              if (dict && sorted) {
                const newBoard = generateSolvableBoard(size, dict, sorted);
                setBoard(newBoard);
                setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
                setUsedWords([]);
                setLastWordTiles(new Set());
                // FIX: Don't reset score in endless mode - it should accumulate
                setStreak(0);
                setIsGenerating(false);
              }
              toast.success(`🎯 New Board! Difficulty: ${endlessDifficulty + 1}`, { duration: 2000 });
              return;
            }
            
            // Handle survival mode - lose a life instead of ending game
            if (settings.mode === "survival") {
              setSurvivalLives(prev => {
                const newLives = prev - 1;
                if (newLives <= 0) {
                  
                  
                  
                  
                  // Show completion toast
                  toast.info(`💀 Survival Mode Complete! Wave ${survivalWave} • Score: ${score}`, {
                    duration: 4000
                  });
                  
                  setGameOver(true);
                  return 0;
                } else {
                  // Continue with new wave
                  const newWave = survivalWave + 1;
                  setSurvivalWave(newWave);
                  setIsGenerating(true);
                  if (dict && sorted) {
                    const newBoard = generateSolvableBoard(size, dict, sorted);
                    setBoard(newBoard);
                    setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
                    setUsedWords([]);
                    setLastWordTiles(new Set());
                    // FIX: Don't reset score in survival mode - it should accumulate
                    setStreak(0);
                    setIsGenerating(false);
                  }
                  toast.success(`🌊 Wave ${newWave}! ${newWave % 5 === 0 ? '⚡ Boss Wave - Find a 7+ letter word!' : ''}`, { duration: 3000 });
                  return newLives;
                }
              });
              return;
            }
            
            if (s >= benchmarks.platinum) grade = "Platinum";else if (s >= benchmarks.gold) grade = "Gold";else if (s >= benchmarks.silver) grade = "Silver";else if (s >= benchmarks.bronze) grade = "Bronze";
            setFinalGrade(grade === "None" ? "None" : grade);
            setGameOver(true);

            
            

            // Save state when game ends
            saveGameState();
            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! Final score: ${finalScore} (${grade})`);
            } else if (grade !== "None") {
              toast.info(`Game over • Grade: ${grade}`);
            } else {
              toast.info(`No valid words remain. Game over!`);
            }
            setUnlocked(prev => {
              const next = new Set(prev);
              let bonusScore = 0;
              if (!dailyMovesExceeded && !prev.has("clutch")) {
                next.add("clutch");
                bonusScore += ACHIEVEMENTS.clutch.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`, {
                  duration: 4000
                });
              }
              if (bonusScore > 0) {
                setScore(prevScore => prevScore + bonusScore);
              }
              return next;
            });
          } else {
            
            

            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete!`);
            } else {
              toast.info(`No valid words remain. Game over!`);
            }
            setGameOver(true);

            // Save state when game ends
            saveGameState();
          }
        }
      }
    }, 0);
  }

  function clearPath() {
    setPath([]);
    setDragging(false);
    setIsTapMode(false);
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
  function generateSeededSpecialTile(rng: () => number, currentScore: number = 0): SpecialTile {
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

  // Introduces special tiles deterministically for Daily Challenge mode
  // All players with the same seed and word count will get identical special tiles
  function introduceSeededSpecialTiles(
    currentSpecialTiles: SpecialTile[][],
    wordCount: number,
    currentScore: number,
    gridSize: number,
    dailySeed: string
  ): { tiles: SpecialTile[][], newWildPositions: string[] } {
    const updatedSpecialTiles = currentSpecialTiles.map(row => [...row]);
    const emptyPositions: Pos[] = [];

    // Find empty positions (tiles without special tiles)
    // Use consistent ordering (row-major) for deterministic position selection
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (updatedSpecialTiles[r][c].type === null) {
          emptyPositions.push({ r, c });
        }
      }
    }

    if (emptyPositions.length === 0) {
      return { tiles: updatedSpecialTiles, newWildPositions: [] };
    }

    // Create seeded RNG for this word count
    const tileCountRng = seedRandom(dailySeed + "_tiles_" + wordCount);
    
    // Deterministic number of tiles to place (1-3)
    const numTilesToPlace = Math.floor(tileCountRng() * 3) + 1;
    const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);
    const newWildPositions: string[] = [];

    // Create a shuffled copy of positions using seeded random
    const shuffledPositions = [...emptyPositions];
    const shuffleRng = seedRandom(dailySeed + "_shuffle_" + wordCount);
    for (let i = shuffledPositions.length - 1; i > 0; i--) {
      const j = Math.floor(shuffleRng() * (i + 1));
      [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
    }

    for (let i = 0; i < tilesToPlace; i++) {
      const pos = shuffledPositions[i];
      // Each tile gets its own seeded RNG based on word count and tile index
      const tileRng = seedRandom(dailySeed + "_tile_" + wordCount + "_" + i);
      const specialTile = generateSeededSpecialTile(tileRng, currentScore);
      
      if (specialTile.type !== null) {
        updatedSpecialTiles[pos.r][pos.c] = specialTile;
        if (specialTile.type === "wild") {
          newWildPositions.push(keyOf(pos));
        }
      }
    }

    return { tiles: updatedSpecialTiles, newWildPositions };
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
          return {
            type: null
          }; // Expire the tile
        }
        return {
          ...tile,
          expiryTurns: newExpiryTurns
        };
      }
      return tile;
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
  
  async function onEndGame() {
    if (settings.mode === "classic" && !gameOver && (score > 0 || usedWords.length > 0)) {
      
      
      
      setGameOver(true);
      
      await saveGameResult();
      
      toast.success(`Game ended! Score: ${score.toLocaleString()}`);
    } else if (gameOver) {
      toast.info("Game already ended!");
    } else {
      toast.info("No progress to save yet!");
    }
  }
  
  function startGameWithDifficulty(difficulty: "easy" | "medium" | "hard" | "expert") {
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
        toast.success(`New ${difficulty} board ready!`);
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
        toast.success("New practice board ready!");
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
    const newSize = mode === "daily" ? (config as any).gridSize ?? 4 : 5;
    const dailySeed = mode === "daily" ? getDailySeed() : getDailySeed() + "-5x5";
    const modeLabel = mode === "daily" ? "Daily Challenge" : "5x5 Daily Challenge";

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
      toast.success(`${modeLabel} resumed!`);
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
        toast.success(`${modeLabel} ready! ${getDailyMovesLimit()} moves to make your best score.`);

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
      case "hint_revealer":
        // Check if there are words available before consuming
        const availableWords = getAvailableWordsForHint();
        if (availableWords.length === 0) {
          
          
          
          toast.info(`No valid words remain. Game over!`);
          setGameOver(true);
          return;
        }

        // Words are available, consume the item and activate hint
        const success = await useConsumable(consumableId);
        if (!success) {
          toast.error("Failed to use consumable");
          return;
        }
        handleHintRevealer();
        break;
      case "extra_moves":
        // Extra moves execute immediately on tap
        const successMoves = await useConsumable(consumableId);
        if (!successMoves) {
          toast.error("Failed to use consumable");
          return;
        }
        handleExtraMoves();
        break;
      case "hammer":
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
      case "score_multiplier":
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
          const successMultiplier = await useConsumable(consumableId);
          if (!successMultiplier) {
            toast.error("Failed to use consumable");
            return;
          }
          setActivatedConsumables(prev => new Set([...prev, consumableId]));
          handleScoreMultiplier();
        }
        break;
    }
  };

  // Helper function to get available words for hinting (4 letters or fewer)
  const getAvailableWordsForHint = () => {
    if (!dict || !sorted || !board) return [];
    const probe = probeGrid(board, dict, sorted, 3, MAX_DFS_NODES);
    return Array.from(probe.words)
      .filter(word => !usedWords.some(used => used.word === word) && word.length >= 3 && word.length <= 4)
      .sort((a, b) => a.length - b.length); // Prefer shorter words
  };
  const handleHintRevealer = () => {
    if (!dict || !sorted || !board) return;
    const availableWords = getAvailableWordsForHint();
    if (availableWords.length === 0) {
      
      
      
      toast.info(`No valid words remain. Game over!`);
      setGameOver(true);
      return;
    }

    // Find the first valid word and illuminate its complete path
    const wordToReveal = availableWords[0];
    const tilesToHighlight = new Set<string>();

    // Find path for the word and highlight all tiles in the path
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c].toLowerCase() === wordToReveal[0].toLowerCase()) {
          // Found starting letter, now find the complete path for this word
          const path = findWordPath(wordToReveal, {
            r,
            c
          });
          if (path && path.length === wordToReveal.length) {
            // Highlight the entire word path
            path.forEach(pos => {
              tilesToHighlight.add(keyOf(pos));
            });
            break;
          }
        }
      }
      if (tilesToHighlight.size > 0) break;
    }
    setAffectedTiles(tilesToHighlight);
    addActiveEffect({
      id: "hint_revealer",
      type: "hint_active",
      duration: 5000,
      expiresAt: new Date(Date.now() + 5000)
    });
    setTimeout(() => {
      setAffectedTiles(new Set());
      removeActiveEffect("hint_revealer");
    }, 5000);
    toast.success(`Hint: Complete path for "${wordToReveal.toUpperCase()}" revealed!`);
  };

  // Helper function to find the path for a specific word
  const findWordPath = (word: string, startPos: Pos): Pos[] | null => {
    if (!board) return null;
    const visited = new Set<string>();
    const path: Pos[] = [startPos];
    const dfs = (pos: Pos, wordIndex: number): boolean => {
      if (wordIndex >= word.length) return true;
      const key = keyOf(pos);
      if (visited.has(key)) return false;
      if (board[pos.r][pos.c].toLowerCase() !== word[wordIndex].toLowerCase()) return false;
      visited.add(key);
      if (wordIndex === word.length - 1) return true;

      // Try all neighbors for next letter
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const newPos = {
            r: pos.r + dr,
            c: pos.c + dc
          };
          if (!within(newPos.r, newPos.c, size)) continue;
          if (visited.has(keyOf(newPos))) continue;
          path.push(newPos);
          if (dfs(newPos, wordIndex + 1)) return true;
          path.pop();
        }
      }
      visited.delete(key);
      return false;
    };
    return dfs(startPos, 0) ? path : null;
  };
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
    let stonePositions: Pos[] = [];
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
    const success = await useConsumable("hammer");
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
    console.log(`Successfully broke ${count} stone tiles`);
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
  function tryAddToPath(pos: Pos) {
    // Ghost tiles can bridge non-adjacent tiles - only when the last tile in path is a ghost
    const lastTile = path.length > 0 ? specialTiles[path[path.length - 1].r][path[path.length - 1].c] : null;
    const canSkipAdjacency = lastTile?.type === "ghost";
    
    if (path.length && !canSkipAdjacency && !neighbors(path[path.length - 1], pos)) return;
    if (path.find(p => p.r === pos.r && p.c === pos.c)) return;

    // Check if this is a stone tile and it's blocked
    const specialTile = specialTiles[pos.r][pos.c];
    if (specialTile.type === "stone") {
      toast.warning("Stone tile is blocked!");
      return;
    }
    setPath(p => [...p, pos]);
  }
  function onTilePointerDown(pos: Pos) {
    // Only start dragging if not in tap mode
    if (!isTapMode) {
      setDragging(true);
      setPath([pos]);
    }
  }
  function onTilePointerEnter(pos: Pos) {
    if (!dragging) return;
    // allow simple backtrack by moving onto previous-previous tile
    if (path.length >= 2) {
      const prev = path[path.length - 1];
      const prev2 = path[path.length - 2];
      if (pos.r === prev2.r && pos.c === prev2.c) {
        setPath(p => p.slice(0, -1));
        return;
      }
    }
    tryAddToPath(pos);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    // Only reset tap mode if we're not on mobile or if this was actually a drag gesture
    if (!isMobile) {
      setIsTapMode(false);
    }
    submitWord();
  }

  // Touch event handlers for mobile support
  // Store initial touch tile for hammer-aware gesture detection
  const [initialTouchTile, setInitialTouchTile] = useState<{pos: Pos, isStone: boolean} | null>(null);

  function onTouchStart(e: React.TouchEvent, pos: Pos) {
    // Prevent page scrolling while the game is active
    e.preventDefault();
    const touch = e.touches[0];
    setTouchStartPos({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    });

    // Store initial touch tile type for hammer-aware gesture detection
    const isStone = specialTiles[pos.r][pos.c].type === "stone";
    setInitialTouchTile({ pos, isStone });

    // On mobile, always start in tap mode - let gesture detection decide if it becomes a swipe
    if (isMobile) {
      setIsTapMode(true);
    } else {
      // On desktop, start dragging if not in tap mode
      if (!isTapMode) {
        onTilePointerDown(pos);
      }
    }

    // For hammer interactions with stone tiles, we still need to set up touch tracking
    // but we'll handle the hammer logic in onTouchEnd if it remains a tap
  }
  function onTouchMove(e: React.TouchEvent) {
    // Prevent page scrolling while the game is active
    e.preventDefault();
    if (!touchStartPos) return;
    const touch = e.touches[0];
    const currentPos = {
      x: touch.clientX,
      y: touch.clientY
    };

    // Calculate movement distance to detect swipe gesture
    const deltaX = Math.abs(currentPos.x - touchStartPos.x);
    const deltaY = Math.abs(currentPos.y - touchStartPos.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // More forgiving threshold and time-based detection for swipe vs tap
    const currentTime = Date.now();
    const touchDuration = touchStartPos.timestamp ? currentTime - touchStartPos.timestamp : 0;
    const MOVEMENT_THRESHOLD = 30; // Increased from 15px to 30px
    const MIN_SWIPE_TIME = 100; // Must be touching for at least 100ms to be considered a swipe

    // Only convert to swipe if significant movement AND sufficient time has passed
    if (isMobile && distance > MOVEMENT_THRESHOLD && touchDuration > MIN_SWIPE_TIME && isTapMode && !dragging) {
      console.log(`Converting tap to swipe: distance=${distance}px, duration=${touchDuration}ms`);
      setIsTapMode(false);
      setDragging(true);
    }

    // Only process move events if we're dragging
    if (!dragging) return;
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.closest('[data-tile-pos]')) {
      const tileElement = element.closest('[data-tile-pos]') as HTMLElement;
      const posStr = tileElement.getAttribute('data-tile-pos');
      if (posStr) {
        const [r, c] = posStr.split(',').map(Number);
        onTilePointerEnter({
          r,
          c
        });
      }
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    // Prevent page scrolling while the game is active
    e.preventDefault();
    const wasInTapMode = isTapMode;
    setTouchStartPos(null);
    setInitialTouchTile(null); // Clean up initial touch tile tracking

    // Handle drag mode - submit word if we were dragging
    if (dragging) {
      onPointerUp();
      return;
    }

    // Handle tap mode - this was a tap, not a swipe
    if (wasInTapMode && touchStartPos && !dragging) {
      // Use stored initial tile position for reliable tap detection (especially important for hammer)
      if (initialTouchTile) {
        console.log(`Processing tap on stored tile ${initialTouchTile.pos.r},${initialTouchTile.pos.c}`);
        onTileTap(initialTouchTile.pos);
      } else {
        // Fallback to coordinate detection if stored position is unavailable
        const touch = e.changedTouches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.closest('[data-tile-pos]')) {
          const tileElement = element.closest('[data-tile-pos]') as HTMLElement;
          const posStr = tileElement.getAttribute('data-tile-pos');
          if (posStr) {
            const [r, c] = posStr.split(',').map(Number);
            const pos = { r, c };
            console.log(`Processing tap on fallback tile ${r},${c}`);
            onTileTap(pos);
          }
        }
      }
    }
  }

  // Single tap handler for tile selection
  function onTileTap(pos: Pos) {
    const currentTime = Date.now();
    const isDoubleTap = lastTapPos && lastTapPos.r === pos.r && lastTapPos.c === pos.c && currentTime - lastTapTime < 300;

    // Set tap mode when user taps (not during drag)
    if (!dragging) {
      setIsTapMode(true);
    }
    if (isDoubleTap && path.length >= 3) {
      // Double tap to submit (only if we have 3+ letters)
      submitWord();
      return;
    }

    // Handle single tap logic
    if (path.length === 0) {
      // Start new path with tap
      setPath([pos]);
    } else {
      // Check if tile is already in path
      const existingIndex = path.findIndex(p => p.r === pos.r && p.c === pos.c);
      if (existingIndex !== -1) {
        // If tapping a tile already in path, remove it and all tiles after it
        setPath(path.slice(0, existingIndex));
      } else {
        // Try to add to path (must be adjacent to last tile, unless last tile is a ghost)
        const lastTile = specialTiles[path[path.length - 1].r][path[path.length - 1].c];
        const canSkipAdjacency = lastTile.type === "ghost";
        const isAdjacent = neighbors(path[path.length - 1], pos);
        
        if (path.length && (isAdjacent || canSkipAdjacency)) {
          // Check if this is a stone tile and it's blocked
          const specialTile = specialTiles[pos.r][pos.c];
          if (specialTile.type === "stone") {
            toast.warning("Stone tile is blocked!");
            return;
          }
          setPath([...path, pos]);
        } else if (path.length) {
          // Not adjacent and no ghost - show warning
          toast.warning("Must select adjacent tiles");
        }
      }
    }
    setLastTapTime(currentTime);
    setLastTapPos(pos);
  }

  // Submit word function for tap mode
  function submitTapWord() {
    if (path.length >= 3) {
      submitWord();
    }
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
      toast.success(`⚡ Speed Multiplier: ${newMultiplier.toFixed(1)}x!`, { duration: 2000 });
    }

    // Time bonus: longer words give more time, capped at +5s
    const timeBonus = Math.min(5, Math.floor(actualWord.length / 2));
    setTimeAttackTimeRemaining(prev => Math.min(60, prev + timeBonus));
    if (timeBonus > 0) {
      toast.info(`+${timeBonus}s time bonus!`, { duration: 1500 });
    }
  }

  // Shared Survival progression — combo, challenge/boss validation, and wave
  // advancement. Must run for every submitted word, whether it came through
  // submitWord or the wild-letter path.
  function processSurvivalWord(actualWord: string, wordPath: Pos[], totalGain: number) {
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
      const comboScore = Math.floor(totalGain * newCombo.comboMultiplier * survivalPointsMultiplier);
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
  }
  function submitWord() {
    if (gameOver) {
      toast.info("Round over");
      return clearPath();
    }

    // Check daily challenge move limit
    if ((settings.mode === "daily" || settings.mode === "daily_5x5") && movesUsed >= settings.dailyMovesLimit) {
      toast.error("Daily move limit reached!");
      return clearPath();
    }
    
    // Check puzzle mode move limit
    if (puzzleMode && puzzleMovesRemaining <= 0) {
      toast.error("Puzzle move limit reached!");
      return clearPath();
    }
    const actualWord = wordFromPath;

    // Ghost tile: maximum one per word (check before wild dialog to enforce limit)
    const ghostCount = path.filter(p => specialTiles[p.r][p.c].type === "ghost").length;
    if (ghostCount > 1) {
      toast.error("Only one Ghost tile per word!");
      return clearPath();
    }
    
    const hasWildTile = path.some(p => specialTiles[p.r][p.c].type === "wild");
    if (hasWildTile && dict) {
      const wildcardPositions = path.filter(p => specialTiles[p.r][p.c].type === "wild");
      if (wildcardPositions.length > 0) {
        // Show dialog to let user choose the letter(s)
        setPendingWildPath(path);
        setShowWildDialog(true);
        return clearPath();
      }
    }
    if (!dict) {
      return clearPath();
    }
    if (actualWord.length < 3) {
      return clearPath();
    }
    // Enhanced word validation with better error messages
    const validation = dictionaryManager.validateWord(actualWord);
    
    if (!validation.isValid) {
      navigator.vibrate?.([30, 10, 30]);
      toast.error(`"${actualWord.toUpperCase()}" is not a valid word`);
      return clearPath();
    }
    if (usedWords.some(entry => entry.word === actualWord)) {
      toast.warning("Already used");
      return clearPath();
    }
    const hasStoneTile = path.some(p => specialTiles[p.r][p.c].type === "stone");
    if (hasStoneTile) {
      toast.error("Cannot use words containing Stone tiles!");
      return clearPath();
    }
    if (lastWordTiles.size > 0) {
      const overlap = path.some(p => lastWordTiles.has(keyOf(p)));
      if (!overlap) {
        toast.error("Must reuse at least one tile from previous word");
        return clearPath();
      }
    }
    const breakdown = computeScoreBreakdown({
      actualWord,
      wordPath: path,
      board,
      specialTiles,
      lastWordTiles,
      streak,
      mode: settings.mode,
      timeAttackSpeedMultiplier,
      activeEffects,
      baseMode: "hybrid"
    });
    const totalGain = breakdown.total;
    setUsedWords(prev => [...prev, {
      word: actualWord,
      score: totalGain,
      breakdown
    }]);

    // Save state after successful word submission
    saveGameState();
    
    // Zen mode: save current state before processing word
    if (settings.mode === 'zen') {
      setZenUndoStack(prev => [...prev, {
        board: board.map(r => [...r]),
        specialTiles: specialTiles.map(r => [...r]),
        usedWords: [...usedWords],
        score,
        lastWordTiles: new Set(lastWordTiles)
      }]);
    }
    
    // Puzzle mode: check required words and decrement moves
    if (puzzleMode && currentPuzzleId) {
      setPuzzleFoundWords(prev => new Set([...prev, actualWord.toUpperCase()]));
      setPuzzleMovesRemaining(prev => prev - 1);
      
      // Check if all required words are now found
      const allRequiredFound = Array.from(puzzleRequiredWords).every(w => 
        puzzleFoundWords.has(w) || w === actualWord.toUpperCase()
      );
      
      if (allRequiredFound) {
        // Puzzle completed!
        setTimeout(() => {
          savePuzzleCompletion(actualWord);
        }, 1000);
        return;
      }
      
      if (puzzleMovesRemaining <= 1 && !allRequiredFound) {
        // Out of moves — count only required words, including the one just played
        const foundRequired = Array.from(puzzleRequiredWords).filter(w =>
          puzzleFoundWords.has(w) || w === actualWord.toUpperCase()
        ).length;
        setTimeout(() => {
          setGameOver(true);
          toast.error(`Puzzle incomplete! You found ${foundRequired}/${puzzleRequiredWords.size} required words.`);
        }, 1000);
      }
    }
    
    // Survival mode: full combo/challenge/boss/wave progression (shared with wild-letter path)
    processSurvivalWord(actualWord, path, totalGain);
    processTimeAttackWord(actualWord);

    // Legacy variables needed for achievements, toasts, and other legacy code
    const sharedTilesCount = lastWordTiles.size ? path.filter(p => lastWordTiles.has(keyOf(p))).length : 0;
    const multiplier = breakdown.multipliers.combinedApplied;

    // Increment moves for daily challenge, puzzle mode, and chaos mode
    if (settings.mode === "daily" || settings.mode === "daily_5x5" || settings.mode === "puzzle" || (settings.mode === "chaos" && chaosStarted)) {
      setMovesUsed(prev => prev + 1);
    }
    

    // Legacy scoring removed - now using breakdown.total

    // Remove score multiplier effect after use if it was active
    const scoreMultiplierEffect = activeEffects.find(e => e.id === "score_multiplier");
    if (scoreMultiplierEffect) {
      removeActiveEffect("score_multiplier");
      // Also remove from activated consumables
      setActivatedConsumables(prev => {
        const newSet = new Set(prev);
        newSet.delete("score_multiplier");
        return newSet;
      });
    }

    // Handle X-Factor tiles first and track board state through all effects
    let trackedBoard = board.map(row => [...row]);
    const xFactorResult = handleXFactorTiles(
      path, 
      specialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setSpecialTiles, 
      setAffectedTiles
    );
    const xChanged = xFactorResult.xChanged;
    trackedBoard = xFactorResult.board;
    let trackedSpecialTiles = xFactorResult.specialTiles;

    // Handle shuffle tiles (use updated board from X-factor)
    trackedBoard = handleShuffleTiles(
      path, 
      trackedSpecialTiles, 
      trackedBoard, 
      size, 
      setBoard, 
      setAffectedTiles
    );

    // Handle Bomb tile blasts (after scoring, before clearing path tiles)
    const bombTilesInPath = path.filter(p => trackedSpecialTiles[p.r][p.c].type === "bomb");
    if (bombTilesInPath.length > 0) {
      for (const bombPos of bombTilesInPath) {
        const bombResult = handleBombBlast(bombPos, trackedBoard, trackedSpecialTiles, size, setBoard, setSpecialTiles, setAffectedTiles);
        trackedBoard = bombResult.board;
        trackedSpecialTiles = bombResult.specialTiles;
      }
    }

    let newSpecialTiles = trackedSpecialTiles.map(row => row.map(tile => ({ ...tile })));
    path.forEach(p => {
      if (newSpecialTiles[p.r][p.c].type !== null) {
        newSpecialTiles[p.r][p.c] = {
          ...newSpecialTiles[p.r][p.c],
          type: null
        };
      }
    });

    // Process Decay spread before expiry (enhanced powerups only, not daily)
    if (isEnhancedPowerupsEnabled() && settings.mode !== "daily" && settings.mode !== "daily_5x5") {
      const decayResult = processDecaySpread(newSpecialTiles, trackedBoard, size);
      newSpecialTiles = decayResult.tiles;
      trackedBoard = decayResult.board;
      setBoard(trackedBoard);
    }

    newSpecialTiles = expireSpecialTiles(newSpecialTiles);

    // Clear frozen flags from tiles whose adjacent Freeze tile expired
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (newSpecialTiles[r][c].frozen) {
          // Check if any adjacent tile is still a Freeze tile
          const orthogonal = [
            { r: r - 1, c: c }, { r: r + 1, c: c },
            { r: r, c: c - 1 }, { r: r, c: c + 1 },
          ];
          const stillFrozen = orthogonal.some(
            adj => within(adj.r, adj.c, size) && newSpecialTiles[adj.r][adj.c].type === "freeze"
          );
          if (!stillFrozen) {
            newSpecialTiles[r][c] = { ...newSpecialTiles[r][c], frozen: false };
          }
        }
      }
    }

    setSpecialTiles(newSpecialTiles);
    setLastWordTiles(new Set(path.map(keyOf)));

    // Check for new achievements using shared function
    const { newAchievements: newAchievements2, achievementBonus: achievementBonus2 } = checkAndAwardAchievements(
      actualWord,
      path,
      usedWords,
      unlocked,
      0,
      sharedTilesCount,
      multiplier,
      xChanged,
      false,
      board
    );

    const finalScore = score + totalGain + achievementBonus2;
    setScore(finalScore);
    newAchievements2.forEach(id => {
      const rarityEmoji = ACHIEVEMENTS[id].rarity === "legendary" ? "🏆" : 
                         ACHIEVEMENTS[id].rarity === "epic" ? "💎" : 
                         ACHIEVEMENTS[id].rarity === "rare" ? "⭐" : "🎯";
      toast.success(`${rarityEmoji} Achievement: ${ACHIEVEMENTS[id].label}!`);
    });
    setUnlocked(prev => {
      const next = new Set(prev);
      newAchievements2.forEach(id => next.add(id));
      return next;
    });
    if (benchmarks && settings.mode === "target") {
      const targetScore = benchmarks[settings.targetTier];
      if (finalScore >= targetScore && !gameOver) {
        setGameOver(true);
        const grade = settings.targetTier[0].toUpperCase() + settings.targetTier.slice(1) as "Bronze" | "Silver" | "Gold" | "Platinum";
        setFinalGrade(grade);

        // Target reached, no firstWin achievement
        toast.success(`Target reached: ${grade}`);
      }
    }

    navigator.vibrate?.(50);
    toast.success(`✓ ${actualWord.toUpperCase()}${multiplier > 1 ? ` (${multiplier}x)` : ""}`);

    // Introduce special tiles if conditions are met
    if (shouldIntroduceSpecialTiles(usedWords.length)) {
      let updatedSpecialTiles: SpecialTile[][];
      let newWildPositions: string[];

      if (settings.mode === "daily" || settings.mode === "daily_5x5") {
        // Use seeded special tiles for daily challenge - all players get same tiles
        const dailySeedForMode = settings.mode === "daily_5x5" ? getDailySeed() + "-5x5" : getDailySeed();
        const result = introduceSeededSpecialTiles(
          newSpecialTiles,
          usedWords.length + 1, // +1 because we just completed a word
          score,
          size,
          dailySeedForMode
        );
        updatedSpecialTiles = result.tiles;
        newWildPositions = result.newWildPositions;
      } else {
        // Non-daily modes use random special tiles
        updatedSpecialTiles = [...newSpecialTiles];
        const emptyPositions: Pos[] = [];

        // Find empty positions (tiles without special tiles)
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (updatedSpecialTiles[r][c].type === null) {
              emptyPositions.push({
                r,
                c
              });
            }
          }
        }

        // Randomly place special tiles (1-3 tiles per trigger)
        const numTilesToPlace = Math.floor(Math.random() * 3) + 1;
        const tilesToPlace = Math.min(numTilesToPlace, emptyPositions.length);
        newWildPositions = [];
        let currentBoard = trackedBoard;
        for (let i = 0; i < tilesToPlace; i++) {
          const randomIndex = Math.floor(Math.random() * emptyPositions.length);
          const pos = emptyPositions.splice(randomIndex, 1)[0];
          const specialTile = generateSpecialTile(
            score,
            settings.mode,
            settings.mode === "endless" ? endlessDifficulty : 1
          );
          if (specialTile.type !== null) {
            // Preserve frozen flag if it exists
            const existingFrozen = updatedSpecialTiles[pos.r][pos.c].frozen;
            updatedSpecialTiles[pos.r][pos.c] = { ...specialTile, frozen: existingFrozen || specialTile.frozen };
            // Track newly spawned Wild tiles
            if (specialTile.type === "wild") {
              newWildPositions.push(keyOf(pos));
            }
            // Apply spawn effects for enhanced tiles
            if (specialTile.type === "magnet") {
              currentBoard = applyMagnetSpawnEffect(pos, currentBoard, updatedSpecialTiles, size);
              setBoard(currentBoard);
            }
            if (specialTile.type === "freeze") {
              updatedSpecialTiles = applyFreezeSpawnEffect(pos, updatedSpecialTiles, size);
            }
          }
        }
        trackedBoard = currentBoard;
      }

      setSpecialTiles(updatedSpecialTiles);
      // Add new Wild tiles to tracking set
      if (newWildPositions.length > 0) {
        setNewWildTiles(prev => {
          const updated = new Set(prev);
          newWildPositions.forEach(key => updated.add(key));
          return updated;
        });
        // Remove from tracking after blink animation completes (1.2s)
        setTimeout(() => {
          setNewWildTiles(prev => {
            const updated = new Set(prev);
            newWildPositions.forEach(key => updated.delete(key));
            return updated;
          });
        }, 1200);
      }
    }
    
    // Chaos Mode: Reshuffle board after every word (only if started)
    if (settings.mode === "chaos" && chaosStarted && dict && sorted) {
      setTimeout(() => {
        // Keep some random tiles, shuffle others
        const newBoard = trackedBoard.map(row => [...row]);
        const tilesToReshuffle = Math.floor(Math.random() * 5) + 3; // 3-7 tiles reshuffled
        const positions: Pos[] = [];
        
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            // Freeze protects tiles from being replaced/shuffled by other tile effects
            if (!newSpecialTiles[r][c].frozen) {
              positions.push({ r, c });
            }
          }
        }
        
        // Shuffle positions randomly
        for (let i = positions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // Track which tiles will be changed for visual effect
        const changedTileKeys = new Set<string>();
        
        // Replace random tiles with new letters
        const letterCounts = new Map<string, number>();
        for (let i = 0; i < Math.min(tilesToReshuffle, positions.length); i++) {
          const pos = positions[i];
          newBoard[pos.r][pos.c] = constrainedRandomLetter(letterCounts);
          changedTileKeys.add(keyOf(pos));
        }
        
        // Validate Q-U adjacency
        const validation = validateAndFixQUAdjacency(newBoard, size, undefined, undefined, false);
        const validatedBoard = validation.board;
        
        // Ensure at least 1 valid word exists
        const probe = probeGrid(validatedBoard, dict, sorted, 1, 1000);
        if (probe.words.size > 0) {
          setBoard(validatedBoard);
          
          // Show visual effect on changed tiles
          setAffectedTiles(changedTileKeys);
          setTimeout(() => setAffectedTiles(new Set()), 1000);
          
          // Chaos Mode: Occasionally turn special tiles into traps (20% chance)
          if (Math.random() < 0.2) {
            const updatedTraps = newSpecialTiles.map(row => [...row]);
            const specialPositions: Pos[] = [];
            
            for (let r = 0; r < size; r++) {
              for (let c = 0; c < size; c++) {
                if (updatedTraps[r][c].type !== null && updatedTraps[r][c].type !== 'stone') {
                  specialPositions.push({ r, c });
                }
              }
            }
            
            if (specialPositions.length > 0) {
              const trapPos = specialPositions[Math.floor(Math.random() * specialPositions.length)];
              const oldType = updatedTraps[trapPos.r][trapPos.c].type;
              
              // Convert special tile to trap - spawn stone tiles instead
              if (oldType === 'multiplier' || oldType === 'xfactor') {
                // Find empty positions for stone tiles
                const emptyPos: Pos[] = [];
                for (let r = 0; r < size; r++) {
                  for (let c = 0; c < size; c++) {
                    if (updatedTraps[r][c].type === null) {
                      emptyPos.push({ r, c });
                    }
                  }
                }
                
                // Spawn 3 stone tiles
                const stonesToSpawn = Math.min(3, emptyPos.length);
                for (let i = 0; i < stonesToSpawn; i++) {
                  const idx = Math.floor(Math.random() * emptyPos.length);
                  const pos = emptyPos.splice(idx, 1)[0];
                  updatedTraps[pos.r][pos.c] = { type: 'stone', expiryTurns: undefined };
                }
                
                // Remove the trap tile
                updatedTraps[trapPos.r][trapPos.c] = { type: null };
                setSpecialTiles(updatedTraps);
                toast.warning('⚠️ TRAP! Multiplier spawned stone tiles!', { duration: 3000 });
              } else if (oldType === 'wild') {
                // Wild tile trap: temporarily block vowels on next word
                toast.warning('⚠️ TRAP! Wild tile turned dangerous!', { duration: 3000 });
                // Remove wild tile
                updatedTraps[trapPos.r][trapPos.c] = { type: null };
                setSpecialTiles(updatedTraps);
              }
            }
          }
          
          toast.info('🔀 Chaos! Board reshuffled!', { duration: 2000 });
        }
      }, 500);
      
      // Check if Chaos mode move limit reached (15 moves)
      if (movesUsed + 1 >= 15) {
        setTimeout(() => {
          
          
          
          setFinalGrade("None");
          setGameOver(true);
          saveGameResult();
          
          toast.success(`🎊 Chaos Round Complete! Score: ${finalScore.toLocaleString()}`, { duration: 5000 });
        }, 1500);
      }
    }
    
    clearPath();
    
    // Check if game over due to stone tiles blocking all valid words (Classic, Zen, Chaos, or Endless mode)
    if ((settings.mode === "classic" || settings.mode === "zen" || (settings.mode === "chaos" && chaosStarted) || (settings.mode === "endless" && endlessStarted)) && dict && sorted) {
      // Create a test grid with stone tiles marked as blocked
      const testGrid = trackedBoard.map((row, r) => 
        row.map((letter, c) => 
          newSpecialTiles[r][c].type === "stone" ? "" : letter
        )
      );
      
      // Check if any valid words can still be formed
      const probe = probeGrid(testGrid, dict, sorted, 1, 100);
      if (probe.words.size === 0) {
        // Handle Zen and Chaos modes - regenerate board instead of ending game
        if (settings.mode === "zen" || settings.mode === "chaos") {
          setIsGenerating(true);
          if (dict && sorted) {
            const newBoard = generateSolvableBoard(size, dict, sorted);
            setBoard(newBoard);
            setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
            setUsedWords([]);
            setLastWordTiles(new Set());
            setScore(0);
            setStreak(0);
            setIsGenerating(false);
            toast.info(`${settings.mode === "chaos" ? "Chaos" : "Zen"} mode: New board generated - no valid words remained!`);
          }
        } else if (settings.mode === "endless" && endlessStarted) {
          // Endless mode: Stone tiles blocked all words - end the run
          
          
          
          setFinalGrade("None");
          setGameOver(true);
          saveGameResult();
          
          toast.error(`💎 Stone tiles blocked all words! Endless Run Complete • Reached Level ${endlessDifficulty} • Score: ${score.toLocaleString()}`, { duration: 5000 });
        } else {
          // Classic mode: Game over due to stones blocking all words
          
          
          
          setFinalGrade("None");
          setGameOver(true);
          toast.error(`💎 Stone tiles blocked all words! Game Over`);
        }
      }
    }
    setTimeout(() => {
      if (sorted && dict) {
        // Check if daily challenge is out of moves
        const dailyMovesExceeded = (settings.mode === "daily" || settings.mode === "daily_5x5") && movesUsed + 1 >= settings.dailyMovesLimit;
        // Check if puzzle mode is out of moves
        const puzzleMovesExceeded = puzzleMode && puzzleMovesRemaining <= 1;
        // The just-played word is now the chain link: future words must reuse its tiles,
        // and it can no longer be replayed.
        const any = hasAnyValidMove(trackedBoard, new Set(path.map(keyOf)), dict, sorted, new Set([...usedWords.map(entry => entry.word), actualWord]));
        if (!any || dailyMovesExceeded || puzzleMovesExceeded) {
          // Handle puzzle mode - check completion on move limit
          if (puzzleMode && puzzleMovesExceeded && currentPuzzleId) {
            const puzzle = getPuzzleById(currentPuzzleId);
            if (puzzle) {
              const allRequiredFound = Array.from(puzzleRequiredWords).every(word => 
                puzzleFoundWords.has(word)
              );
              if (!allRequiredFound) {
                setGameOver(true);
                setFinalGrade("None");
                toast.error("Puzzle incomplete! Move limit reached.");
              }
            }
            // If all required words found, completion is already handled in submitWord
          }
          // Handle Zen and Chaos mode - regenerate board instead of ending game
          if (settings.mode === "zen" || settings.mode === "chaos") {
            setIsGenerating(true);
            if (dict && sorted) {
              const newBoard = generateSolvableBoard(size, dict, sorted);
              setBoard(newBoard);
              setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
              setUsedWords([]);
              setLastWordTiles(new Set());
              setScore(0);
              setStreak(0);
              setIsGenerating(false);
              toast.info("Zen mode: New board generated - no valid words remained!");
            }
          } else if (benchmarks) {
            let grade: "Bronze" | "Silver" | "Gold" | "Platinum" | "None" = "None";
            const s = finalScore;
            if (s >= benchmarks.platinum) grade = "Platinum";else if (s >= benchmarks.gold) grade = "Gold";else if (s >= benchmarks.silver) grade = "Silver";else if (s >= benchmarks.bronze) grade = "Bronze";
            setFinalGrade(grade === "None" ? "None" : grade);
            setGameOver(true);
            if (dailyMovesExceeded) {
              toast.info(`Daily Challenge complete! Final score: ${finalScore} (${grade})`);
            } else if (grade !== "None") {
              toast.info(`Game over • Grade: ${grade}`);
            } else {
              toast.info("No valid words remain. Game over!");
            }
            setUnlocked(prev => {
              const next = new Set(prev);
              let bonusScore = 0;
              if (!dailyMovesExceeded && !prev.has("clutch")) {
                next.add("clutch");
                bonusScore += ACHIEVEMENTS.clutch.scoreBonus;
                toast.success(`💎 ${ACHIEVEMENTS.clutch.label} (+${ACHIEVEMENTS.clutch.scoreBonus} pts)`, {
                  duration: 4000
                });
              }
              if (bonusScore > 0) {
                setScore(prevScore => prevScore + bonusScore);
              }
              return next;
            });
          } else {
            if (dailyMovesExceeded) {
              toast.info("Daily Challenge complete!");
            } else {
              toast.info("No valid words remain. Game over!");
            }
            setGameOver(true);
          }
        }
      }
    }, 0);
  }

  function hasAnyValidMove(grid: string[][], mustReuse: Set<string>, wordSet: Set<string>, sortedArr: string[], used: Set<string>) {
    const N = grid.length;
    const dirs = [-1, 0, 1];
    const stack: {
      pos: Pos;
      path: Pos[];
      word: string;
      reuse: boolean;
    }[] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) stack.push({
      pos: {
        r,
        c
      },
      path: [],
      word: "",
      reuse: false
    });
    while (stack.length) {
      const cur = stack.pop()!;
      const {
        pos,
        path: pp,
        word,
        reuse
      } = cur;
      const k = keyOf(pos);
      if (pp.find(p => p.r === pos.r && p.c === pos.c)) continue;
      const nextPath = [...pp, pos];
      const nextWord = word + grid[pos.r][pos.c].toLowerCase();
      const nextReuse = reuse || mustReuse.has(k) || mustReuse.size === 0;
      if (nextWord.length >= 3 && nextReuse && wordSet.has(nextWord) && !used.has(nextWord)) return true;
      if (!binaryHasPrefix(sortedArr, nextWord)) continue;
      for (const dr of dirs) for (const dc of dirs) {
        if (dr === 0 && dc === 0) continue;
        const nr = pos.r + dr,
          nc = pos.c + dc;
        if (!within(nr, nc, N)) continue;
        // adjacency and no revisit
        if (nextPath.find(p => p.r === nr && p.c === nc)) continue;
        stack.push({
          pos: {
            r: nr,
            c: nc
          },
          path: nextPath,
          word: nextWord,
          reuse: nextReuse
        });
      }
    }
    return false;
  }
  const isGameReady = !!dict;
  const shareScoreInline = () => {
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const grade = finalGrade !== "None" ? finalGrade : score >= (benchmarks?.platinum || 0) ? "Platinum" : score >= (benchmarks?.gold || 0) ? "Gold" : score >= (benchmarks?.silver || 0) ? "Silver" : score >= (benchmarks?.bronze || 0) ? "Bronze" : "None";

    // Get emoji based on grade
    const gradeEmoji = grade === "Platinum" ? "💎" : grade === "Gold" ? "🥇" : grade === "Silver" ? "🥈" : grade === "Bronze" ? "🥉" : "📊";

    const is5x5 = settings.mode === "daily_5x5";
    const modeLabel = is5x5 ? "Lexichain Daily 5×5" : "Lexichain Daily";
    const shareTitle = is5x5 ? "Lexichain Daily 5×5 Challenge" : "Lexichain Daily Challenge";

    // Get highest single word score
    const topWordScore = usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0;
    const shareText = `🔤 ${modeLabel} ${date}\n${gradeEmoji} ${score} points (${grade})\n📝 Top word: ${topWordScore}\n\n${SHARE_URL}`;
    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: shareText
      });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Copied to clipboard!");
    }
  };
  return (
    <section className="container mx-auto py-4 max-w-7xl">

      <Dialog open={showDifficultyDialog} onOpenChange={setShowDifficultyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Difficulty</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {Object.entries(DIFFICULTY_CONFIG).map(([diff, config]) => <Button key={diff} variant="outline" onClick={() => startGameWithDifficulty(diff as any)} className="justify-between p-4 h-auto">
                <div className="text-left">
                  <div className="font-semibold capitalize">{diff}</div>
                  <div className="text-sm text-muted-foreground">
                    {config.gridSize}×{config.gridSize} grid • {config.minWords}+ discoverable words • {Math.round(config.scoreMultiplier * 100)}% scoring
                  </div>
                </div>
              </Button>)}
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2 mb-4">
        <div className="grid grid-cols-2 md:flex md:justify-start md:items-center gap-2">
          {settings.mode === "classic" && <Button variant="hero" onClick={onNewGame} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>}
          
          
          {settings.mode === "practice" && <Button variant="brand" onClick={() => {
          startNewPracticeGame().catch(console.error);
        }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              {isGenerating ? "Generating..." : "New Game"}
            </Button>}
          
          {settings.mode === "time_attack" && !timeAttackStarted && <Button variant="brand" onClick={() => {
            setTimeAttackStarted(true);
            setTimeAttackTimeRemaining(60);
            setTimeAttackWordsFound(0);
            setTimeAttackSpeedMultiplier(1.0);
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              Start Timer
            </Button>}
          
          
          {settings.mode === "survival" && !survivalStarted && <Button variant="brand" onClick={() => {
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
            setSurvivalComboState({
              currentCombo: 0,
              maxCombo: 0,
              comboMultiplier: 1.0,
              comboActive: false,
              lastWordTime: 0
            });

            // Generate first wave challenge
            const firstChallenge = getRandomWaveChallenge(1);
            setSurvivalCurrentChallenge(firstChallenge);
            setSurvivalBossWordRequired(false);
            setSurvivalCurrentBoss(null);

            toast.success(`💀 Survival Mode Started!\n${firstChallenge.description}`, { duration: 4000 });
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              Start Survival
            </Button>}
          
          {settings.mode === "zen" && !zenStarted && <Button variant="brand" onClick={() => {
            setZenStarted(true);
            toast.success('🧘 Zen Mode - Take your time, no pressure!', { duration: 3000 });
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              Begin Zen Practice
            </Button>}
          
          {settings.mode === "zen" && zenStarted && <Button variant="brand" onClick={() => {
            // Reset to previous state (FIX: removed the save that was creating infinite loop)
            if (zenUndoStack.length > 0) {
              const prevState = zenUndoStack[zenUndoStack.length - 1];
              setBoard(prevState.board);
              setSpecialTiles(prevState.specialTiles);
              setUsedWords(prevState.usedWords);
              setScore(prevState.score);
              setLastWordTiles(prevState.lastWordTiles);
              setZenUndoStack(prev => prev.slice(0, -1));
            }
          }} disabled={zenUndoStack.length === 0} size="sm">
              Undo ({zenUndoStack.length})
            </Button>}
          
          {settings.mode === "zen" && <Button variant="brand" onClick={() => {
            if (board && dict && sorted) {
              // Find a valid word and highlight it using probeGrid
              const probe = probeGrid(board, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
              const validWords = Array.from(probe.words).filter(w => !usedWords.some(uw => uw.word === w));
              if (validWords.length > 0) {
                const hintWord = validWords[Math.floor(Math.random() * validWords.length)];
                // Find the starting position for this word
                let hintPath: Pos[] | null = null;
                for (let r = 0; r < size && !hintPath; r++) {
                  for (let c = 0; c < size && !hintPath; c++) {
                    if (board[r][c].toLowerCase() === hintWord[0].toLowerCase()) {
                      hintPath = findWordPath(hintWord, { r, c });
                      if (hintPath && hintPath.length === hintWord.length) {
                        break;
                      } else {
                        hintPath = null;
                      }
                    }
                  }
                }
                if (hintPath) {
                  setPath(hintPath);
                  setHintHighlight(hintPath);
                  setTimeout(() => setHintHighlight(null), 5000);
                  setZenHintsUsed(prev => prev + 1);
                  toast.info(`Hint: ${hintWord.toUpperCase()} (${hintPath.length} letters)`);
                }
              }
            }
          }} size="sm">
              Hint ({zenHintsUsed})
          </Button>}
          
          {settings.mode === "chaos" && !chaosStarted && <Button variant="brand" onClick={() => {
            setChaosStarted(true);
            setMovesUsed(0);
            toast.success('🔀 Chaos Mode Started! Board reshuffles after each word. 15 moves!', { duration: 3000 });
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              Start Chaos
          </Button>}
          
          {settings.mode === "chaos" && (chaosStarted || gameOver) && <Button variant="hero" onClick={() => {
            if (dict && sorted) {
              setIsGenerating(true);
              const newBoard = generateSolvableBoard(size, dict, sorted);
              const probe = probeGrid(newBoard, dict, sorted, K_MIN_WORDS, MAX_DFS_NODES);
              const bms = computeBenchmarksFromWordCount(probe.words.size, K_MIN_WORDS);
              
              setBoard(newBoard);
              setBenchmarks(bms);
              setDiscoverableCount(probe.words.size);
              setSpecialTiles(Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: null }))));
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
              setChaosStarted(true);
              setIsGenerating(false);
              
              toast.success('🔀 New Chaos Round! 15 moves to survive!', { duration: 3000 });
            }
          }} disabled={!isGameReady || isGenerating} size="sm" className="col-span-2 md:col-span-1">
              {isGenerating ? "Generating..." : gameOver ? "New Round" : "Restart Round"}
          </Button>}
          
          <Button variant="brand" onClick={() => setShowHowToPlay(true)} size="sm">
            How to Play
          </Button>

          {onBackToAdvancedModes && (
            <Button variant="brand" onClick={onBackToAdvancedModes} size="sm">
              Back to Advanced Modes
            </Button>
          )}

          {settings.mode === "classic" && !gameOver && <Button variant="brand" onClick={onEndGame} size="sm">
            End Game
          </Button>}

          {settings.mode === "endless" && endlessStarted && !gameOver && <Button variant="brand" onClick={async () => {
            
            
            setGameOver(true);
            await saveGameResult();
            
            toast.success(`Endless Run Complete! Reached Level ${endlessDifficulty} • Score: ${score.toLocaleString()}`);
          }} size="sm">
            End Run
          </Button>}
          
          <Button variant="brand" onClick={onBackToTitle} size="sm">
            Back to Title
          </Button>
        </div>
        
      </div>

      {/* How to Play Modal */}
      <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
        <DialogContent className="w-[95vw] max-w-[425px] max-h-[90vh] overflow-y-auto sm:max-w-lg sm:max-h-[85vh] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>How to play</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {settings.mode === "endless" ? (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">(Almost) Endless Mode</h3>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Drag through adjacent tiles to form words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Words must be 3+ letters and valid</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Each word must reuse ≥1 tile from previous</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">When no words remain, a new board appears automatically</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Difficulty increases with each new board</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Strategy Tips</h3>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Your score accumulates across all boards - aim for high-scoring words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Plan ahead to maximize tile reuse and word chains</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Special tiles become more common as difficulty increases</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">There's no time limit - take your time to find the best words</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span className="text-sm">Try to clear each board completely before moving to the next</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Drag through adjacent tiles to form words</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Words must be 3+ letters and valid</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Each word must reuse ≥1 tile from previous</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Keep chaining until no valid word remains</span>
                </div>
              </div>
            )}
            
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between py-1 group">
                <h3 className="text-sm font-semibold text-foreground">Special Tiles</h3>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                      A
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Stone</div>
                      <div className="text-muted-foreground">Cannot be used</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center text-white text-xs font-bold">
                      ?
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Wild</div>
                      <div className="text-muted-foreground">Any letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold relative">
                      A
                      <div className="absolute top-0 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute top-0 right-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-0 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
                      <div className="absolute bottom-0 right-0 w-1 h-1 bg-white/30 rounded-full"></div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">X-Factor</div>
                      <div className="text-muted-foreground">Changes adjacent corner tiles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold relative">
                      A
                      <div className="absolute bottom-0 right-0 text-xs font-bold bg-white/20 px-0.5 rounded text-[10px]">
                        2x
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Multiplier</div>
                      <div className="text-muted-foreground">Boost word score</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-red-200 to-red-300 flex items-center justify-center text-red-800 text-xs font-bold relative">
                      A
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                          <div className="w-3 h-3 border border-red-700 rounded-full opacity-70"></div>
                          <div className="absolute inset-0.5 w-2 h-2 border border-red-700 rounded-full opacity-50"></div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Shuffle</div>
                      <div className="text-muted-foreground">Randomize all letters</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-300 to-blue-400 flex items-center justify-center text-white text-xs">
                      ❄️
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Freeze</div>
                      <div className="text-muted-foreground">Locks neighbors in place</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-300 to-green-500 flex items-center justify-center text-white text-xs">
                      🦠
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Decay</div>
                      <div className="text-muted-foreground">Spreads, degrades letters</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-200 to-gray-400 flex items-center justify-center text-gray-800 text-xs">
                      🪞
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Mirror</div>
                      <div className="text-muted-foreground">Copies previous letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-red-400 to-gray-400 flex items-center justify-center text-white text-xs">
                      🧲
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Magnet</div>
                      <div className="text-muted-foreground">Pulls vowels nearby</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-red-600 to-gray-900 flex items-center justify-center text-white text-xs">
                      💣
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Bomb</div>
                      <div className="text-muted-foreground">Blasts nearby tiles</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs">
                      ⛓️
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Chain</div>
                      <div className="text-muted-foreground">Bonus for long words</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-white/60 to-gray-200/60 flex items-center justify-center text-gray-400 text-xs opacity-70">
                      👻
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Ghost</div>
                      <div className="text-muted-foreground">Bridge tile, no letter</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white text-xs">
                      💰
                    </div>
                    <div className="text-xs">
                      <div className="font-medium">Tax</div>
                      <div className="text-muted-foreground">-30% word score</div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Special tiles appear after forming your first valid word and expire after a few turns.
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Consumable Items</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-sm">Tap a consumable in your inventory to use it</span>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔨</span>
                    <div className="text-xs">
                      <div className="font-medium">Hammer</div>
                      <div className="text-muted-foreground">Break stone tiles with a tap</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💡</span>
                    <div className="text-xs">
                      <div className="font-medium">Hint Revealer</div>
                      <div className="text-muted-foreground">Highlights 3-5 valid words for 10 seconds</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div className="text-xs">
                      <div className="font-medium">Score Multiplier</div>
                      <div className="text-muted-foreground">Doubles the score of your next word</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <div className="text-xs">
                      <div className="font-medium">Extra Moves</div>
                      <div className="text-muted-foreground">Adds 3 extra moves (Daily Challenge only)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wild Letter Input Dialog */}
      <Dialog open={showWildDialog} onOpenChange={setShowWildDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Wild Tile Letter{pendingWildPath?.filter(p => specialTiles[p.r][p.c].type === "wild").length === 1 ? "" : "s"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enter a letter for each Wild tile to complete your word:
            </div>
            <div className="text-center">
              <div className="text-lg font-mono bg-muted p-2 rounded">
                {pendingWildPath?.map((p, i) => {
                const isWild = specialTiles[p.r][p.c].type === "wild";
                const wildKey = `${p.r}-${p.c}`;
                const letter = isWild ? (wildTileInputs.get(wildKey) || "?").toUpperCase() : board[p.r][p.c];
                return <span key={i} className={isWild ? "text-purple-500 font-bold" : ""}>
                      {letter}
                    </span>;
              })}
              </div>
            </div>
            <div className="space-y-2">
              {(pendingWildPath?.filter(p => specialTiles[p.r][p.c].type === "wild") || []).map((wildPos, idx) => {
              const wildKey = `${wildPos.r}-${wildPos.c}`;
              return <Input key={wildKey} type="text" value={wildTileInputs.get(wildKey) || ''} onChange={e => {
                const newInputs = new Map(wildTileInputs);
                newInputs.set(wildKey, e.target.value.slice(0, 1).toUpperCase());
                setWildTileInputs(newInputs);
              }} onKeyDown={e => {
              const wildCount = pendingWildPath?.filter(p => specialTiles[p.r][p.c].type === "wild").length || 0;
              const allFilled = wildCount > 0 && (pendingWildPath?.filter(p => specialTiles[p.r][p.c].type === "wild") || []).every(pos => {
                const key = `${pos.r}-${pos.c}`;
                return /^[A-Z]$/.test(wildTileInputs.get(key) || '');
              });
              if (e.key === 'Enter' && allFilled) {
                handleWildSubmit();
              }
            }} placeholder={`Wild tile ${idx + 1} letter (A-Z)`} className="w-full text-center text-lg font-mono" maxLength={1} autoFocus={idx === 0} />;
            })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
              setShowWildDialog(false);
              setWildTileInputs(new Map());
              setPendingWildPath(null);
            }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleWildSubmit} disabled={(() => {
              const wildcardPositions = pendingWildPath?.filter(p => specialTiles[p.r][p.c].type === "wild") || [];
              if (wildcardPositions.length === 0) return true;
              return wildcardPositions.some(pos => {
                const wildKey = `${pos.r}-${pos.c}`;
                return !/^[A-Z]$/.test(wildTileInputs.get(wildKey) || '');
              });
            })()} className="flex-1">
                Submit Word
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Score Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Your Daily Challenge Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--brand-500))]">{score} points</div>
              <div className="text-sm text-muted-foreground">
                {usedWords.length} words • {movesUsed}/{settings.dailyMovesLimit} moves
              </div>
              <div className="text-sm text-muted-foreground">
                Grade: {finalGrade}
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-2">Share this:</div>
              <div className="text-sm font-mono">
                🔤 Lexichain Daily Challenge {getDailySeed()}<br />
                {finalGrade === "Platinum" ? "💎" : finalGrade === "Gold" ? "🥇" : finalGrade === "Silver" ? "🥈" : finalGrade === "Bronze" ? "🥉" : "📊"} {score} points ({finalGrade})<br />
                📝 Top word: {usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0}<br />
                🎯 {settings.dailyMovesLimit - movesUsed} moves remaining<br />
                <br />
                Play at {SHARE_URL}
              </div>
            </div>
            <Button onClick={() => {
            const gradeEmoji = finalGrade === "Platinum" ? "💎" : finalGrade === "Gold" ? "🥇" : finalGrade === "Silver" ? "🥈" : finalGrade === "Bronze" ? "🥉" : "📊";
            const topWordScore = usedWords.length > 0 ? Math.max(...usedWords.map(w => w.score)) : 0;
            const shareText = `🔤 Lexichain Daily Challenge ${getDailySeed()}\n${gradeEmoji} ${score} points (${finalGrade})\n📝 Top word: ${topWordScore}\n🎯 ${settings.dailyMovesLimit - movesUsed} moves remaining\n\nPlay at ${SHARE_URL}`;
            navigator.clipboard.writeText(shareText);
            toast.success("Copied to clipboard!");
            setShowShareDialog(false);
          }} className="w-full">
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-[auto,280px] gap-3 lg:gap-2 items-start">
        <div className="space-y-4">
          {/* Mobile QuickUse Bar + Special Tile Preview */}
          {isMobile && <div className="lg:hidden flex items-center justify-center gap-2 mb-3">
              <QuickUseBar inventory={consumableInventory} onUseConsumable={handleUseConsumable} gameMode={settings.mode} gameState={{
            gameOver,
            isGenerating
          }} disabled={gameOver || isGenerating} />
              {(settings.mode === "daily" || settings.mode === "daily_5x5") && !gameOver && usedWords.length >= 1 && (() => {
                const nextTiles = previewNextSpecialTiles(
                  usedWords.length,
                  settings.mode === "daily_5x5" ? getDailySeed() + "-5x5" : getDailySeed(),
                  size,
                  specialTiles
                );
                return nextTiles.length > 0 ? (
                  <SpecialTilePreview tiles={nextTiles} />
                ) : null;
              })()}
            </div>}
          
          
          <GameBoard
            board={board}
            specialTiles={specialTiles}
            path={path}
            lastWordTiles={lastWordTiles}
            affectedTiles={affectedTiles}
            newWildTiles={newWildTiles}
            size={size}
            skin={skin}
            score={score}
            benchmarks={benchmarks}
            isInitializing={isInitializing}
            onPointerUp={onPointerUp}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTilePointerDown={onTilePointerDown}
            onTilePointerEnter={onTilePointerEnter}
            onTileTouch={onTouchStart}
            onTileTap={onTileTap}
          />
            <div className="mt-4 flex items-center gap-3 p-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-lg border border-muted backdrop-blur-sm">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Current:</span>
              <span className="text-xl font-bold flex-1 bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-brand-600">{displayWordFromPath || "..."}</span>
              {pathWordStatus && (
                <span
                  role="status"
                  className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    pathWordStatus.state === "valid"
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : pathWordStatus.state === "invalid"
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : pathWordStatus.state === "used" || pathWordStatus.state === "nolink"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {pathWordStatus.state === "valid" ? "✓ " : pathWordStatus.state === "invalid" ? "✗ " : ""}
                  {pathWordStatus.label}
                </span>
              )}
            </div>

            {/* Submit Button for Tap Mode */}
            {(isTapMode || isMobile) && <div className="mt-3">
                <Button
                  onClick={submitTapWord}
                  disabled={path.length < 3}
                  variant={path.length >= 3 ? "default" : "outline"}
                  size="lg"
                  className={`w-full transition-all duration-300 ${
                    path.length >= 3
                      ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg hover:shadow-xl hover:scale-105"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  Submit Word
                </Button>
              </div>}
        </div>

        <aside className="space-y-2 lg:space-y-3">
          <Card className="p-4 bg-gradient-to-br from-card/95 to-muted/30 backdrop-blur-sm border-brand-500/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Score</div>
                <div className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-brand-600">{score}</div>
                
                {/* Mode-specific indicators */}
                {settings.mode === "time_attack" && timeAttackStarted && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Time Remaining</div>
                      <div className={`text-2xl font-bold rounded-full px-2 inline-flex items-center gap-1 ${timeAttackTimeRemaining <= 10 ? 'bg-red-500/15 text-red-500 animate-pulse' : timeAttackTimeRemaining <= 30 ? 'bg-orange-500/10 text-orange-500' : 'text-green-500'}`}>
                        ⏱️ {timeAttackTimeRemaining}s
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Speed Multiplier</div>
                      <div className={`text-lg font-bold ${timeAttackSpeedMultiplier >= 2.0 ? 'text-yellow-500' : timeAttackSpeedMultiplier >= 1.4 ? 'text-green-500' : 'text-blue-500'}`}>
                        ⚡ {timeAttackSpeedMultiplier.toFixed(1)}x
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                        <div 
                          className="bg-gradient-to-r from-blue-400 via-green-400 to-yellow-400 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (timeAttackSpeedMultiplier - 1) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Words: {timeAttackWordsFound} • Next ⚡ in {3 - (timeAttackWordsFound % 3)} word{3 - (timeAttackWordsFound % 3) === 1 ? "" : "s"}
                    </div>
                  </div>
                )}
                
                {settings.mode === "endless" && endlessStarted && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Difficulty Level</div>
                      <div className="text-lg font-bold text-purple-500 flex items-center gap-2">
                        <span className="text-2xl">∞</span> 
                        <span>Level {endlessDifficulty}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Stone Spawn Rate</div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                        <div 
                          className="bg-gradient-to-r from-gray-400 to-gray-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, 15 + (endlessDifficulty * 2.5))}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {Math.round(15 + Math.min(25, endlessDifficulty * 2.5))}%
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Words: {usedWords.length} • Boards: {endlessDifficulty}
                    </div>
                  </div>
                )}
                
                {settings.mode === "survival" && survivalStarted && (
                  <div className="mt-2 space-y-3">
                    {/* Wave Display */}
                    <div>
                      <div className="text-xs text-muted-foreground">Wave</div>
                      <div className="text-lg font-bold text-blue-500 flex items-center gap-2">
                        <span>Wave {survivalWave}</span>
                        {survivalWave % 5 === 0 && <span className="text-orange-500 animate-pulse">⚡ BOSS</span>}
                      </div>
                    </div>

                    {/* Lives Display */}
                    <LivesDisplay
                      lives={survivalLives}
                      maxLives={survivalMaxLives}
                      shields={survivalShields}
                      lifeFragments={survivalLifeFragments}
                    />

                    {/* Combo Display */}
                    <ComboDisplay comboState={survivalComboState} />

                    {/* Boss Wave Display */}
                    {survivalBossWordRequired && survivalCurrentBoss && (
                      <BossWaveDisplay
                        boss={survivalCurrentBoss}
                        progress={survivalBossProgress}
                        timeRemaining={survivalChallengeTimeRemaining}
                      />
                    )}

                    {/* Wave Challenge Display */}
                    {!survivalBossWordRequired && survivalCurrentChallenge && (
                      <WaveChallengeDisplay
                        challenge={survivalCurrentChallenge}
                        progress={survivalChallengeProgress}
                        timeRemaining={survivalChallengeTimeRemaining}
                      />
                    )}

                    {/* Power-Ups Inventory */}
                    <PowerUpsInventory
                      activePowerUps={survivalActivePowerUps}
                      inventoryPowerUps={survivalInventoryPowerUps}
                      onActivate={(powerUp) => {
                        const result = applyPowerUpEffect(powerUp.type, {});
                        if (result.success) {
                          toast.success(result.message);

                          // BUG FIX #5: Implement all power-up effects
                          if (result.effect.lives) {
                            setSurvivalLives(prev => Math.min(prev + result.effect.lives, survivalMaxLives));
                          }
                          if (result.effect.shield) {
                            setSurvivalShields(prev => prev + result.effect.shield);
                          }
                          if (result.effect.removeStones) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingUses: 1,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.refreshBoard) {
                            // Regenerate board
                            const newBoard = Array.from({ length: size }, () =>
                              Array.from({ length: size }, () => randomLetter())
                            );
                            setBoard(newBoard);
                          }
                          if (result.effect.revealHints) {
                            // TODO: Implement hint system
                            toast.info('Hint system coming soon!');
                          }
                          if (result.effect.freezeDifficulty) {
                            setSurvivalDifficultyFrozen(3);
                          }
                          if (result.effect.wildcardActive) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingWaves: 1,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.pointsMultiplier) {
                            setSurvivalPointsMultiplier(result.effect.pointsMultiplier);
                          }
                          if (result.effect.comboBoost) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingUses: 5,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.lifeLink) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingWaves: 3,
                              activatedAt: Date.now()
                            }]);
                          }
                          if (result.effect.safetyNet) {
                            setSurvivalActivePowerUps(prev => [...prev, {
                              powerUp,
                              remainingUses: 3,
                              activatedAt: Date.now()
                            }]);
                          }

                          // Remove from inventory
                          setSurvivalInventoryPowerUps(prev => {
                            const idx = prev.findIndex(p => p.id === powerUp.id);
                            if (idx >= 0) {
                              return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
                            }
                            return prev;
                          });
                        }
                      }}
                    />

                    {/* Wave Score */}
                    <div className="text-xs text-muted-foreground">
                      Wave Score: <span className="font-bold text-foreground">{survivalWaveScore}</span>
                    </div>
                  </div>
                )}
                
                {settings.mode === "zen" && zenStarted && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Zen Mode</div>
                      <div className="text-sm text-green-500">
                        🧘 No pressure
                      </div>
                    </div>
                    <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-xs text-green-600 dark:text-green-400">
                        💡 Tip: {(() => {
                          const tips = [
                            "Longer words (5+ letters) give bonus points!",
                            "Rare letters like Q, X, Z give extra score",
                            "Reusing tiles from your last word adds multipliers",
                            "Look for word endings like -ING, -TION, -ED",
                            "Try to chain words with shared letters",
                            "Special tiles can multiply your score",
                            "Use the Hint button if you're stuck!",
                            "Undo lets you try different strategies"
                          ];
                          return tips[usedWords.length % tips.length];
                        })()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Hints: {zenHintsUsed} | Undos available: {zenUndoStack.length}
                    </div>
                  </div>
                )}
                
                {benchmarks && settings.mode !== "endless" && settings.mode !== "puzzle" && <div className="mt-3 space-y-2 p-2 bg-muted/30 rounded-lg border border-muted">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Challenge Tiers</div>
                    <div className="space-y-1.5">
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.bronze
                          ? 'bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-600/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.bronze ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                          🥉 Bronze
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.bronze ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>{benchmarks.bronze}</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.silver
                          ? 'bg-gradient-to-r from-gray-400/20 to-gray-300/10 border border-gray-400/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.silver ? 'text-gray-600 dark:text-gray-300' : 'text-muted-foreground'}`}>
                          🥈 Silver
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.silver ? 'text-gray-600 dark:text-gray-300' : 'text-muted-foreground'}`}>{benchmarks.silver}</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.gold
                          ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-400/10 border border-yellow-500/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.gold ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                          🥇 Gold
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.gold ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>{benchmarks.gold}</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-all duration-300 ${
                        score >= benchmarks.platinum
                          ? 'bg-gradient-to-r from-purple-500/20 to-purple-400/10 border border-purple-500/30 shadow-sm'
                          : 'opacity-60'
                      }`}>
                        <span className={`flex items-center gap-1.5 font-medium ${score >= benchmarks.platinum ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                          💎 Platinum
                        </span>
                        <span className={`font-semibold ${score >= benchmarks.platinum ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>{benchmarks.platinum}</span>
                      </div>
                    </div>
                    {/* Enhanced Progress bar */}
                    <div className="w-full bg-secondary/30 rounded-full h-2.5 mt-2 overflow-hidden">
                      <div className={`h-2.5 rounded-full transition-all duration-500 ${
                        score >= benchmarks.platinum
                          ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                          : score >= benchmarks.gold
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                            : score >= benchmarks.silver
                              ? 'bg-gradient-to-r from-gray-400 to-gray-300'
                              : score >= benchmarks.bronze
                                ? 'bg-gradient-to-r from-orange-500 to-orange-400'
                                : 'bg-gradient-to-r from-primary/60 to-primary/40'
                      }`} style={{
                    width: `${Math.min(100, score / benchmarks.platinum * 100)}%`
                  }} />
                    </div>
                    <div className="text-xs text-center font-medium">
                      {score >= benchmarks.platinum ? (
                        <span className="text-purple-600 dark:text-purple-400 font-bold">✨ Platinum Achieved!</span>
                      ) : score >= benchmarks.gold ? (
                        <span className="text-yellow-600 dark:text-yellow-400">{benchmarks.platinum - score} to Platinum</span>
                      ) : score >= benchmarks.silver ? (
                        <span className="text-gray-600 dark:text-gray-400">{benchmarks.gold - score} to Gold</span>
                      ) : score >= benchmarks.bronze ? (
                        <span className="text-orange-600 dark:text-orange-400">{benchmarks.silver - score} to Silver</span>
                      ) : (
                        <span className="text-muted-foreground">{benchmarks.bronze - score} to Bronze</span>
                      )}
                    </div>
                  </div>}
                {false && <div className="mt-1 text-xs text-muted-foreground">
                    {(() => {
                  const grade = score >= benchmarks.platinum ? "Platinum" : score >= benchmarks.gold ? "Gold" : score >= benchmarks.silver ? "Silver" : score >= benchmarks.bronze ? "Bronze" : "None";
                  const nextTarget = score < benchmarks.bronze ? ["Bronze", benchmarks.bronze] : score < benchmarks.silver ? ["Silver", benchmarks.silver] : score < benchmarks.gold ? ["Gold", benchmarks.gold] : score < benchmarks.platinum ? ["Platinum", benchmarks.platinum] : null;
                  return <>
                          <span>Grade: {grade}</span>
                          {nextTarget && <span className="ml-2">• {(nextTarget[1] as number) - score} to {nextTarget[0] as string}</span>}
                          <span className="ml-2">• Board: {benchmarks.rating}</span>
                        </>;
                })()}
                  </div>}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {usedWords.length >= 1 ? "Special tiles active!" : ""}
                {gameOver && finalGrade !== "None" && <div className="mt-1 font-medium">Final: {finalGrade}</div>}
                {(settings.mode === "daily" || settings.mode === "daily_5x5") && (
                  <>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {settings.dailyMovesLimit - movesUsed} moves remaining
                    </div>
                    {!gameOver && usedWords.length >= 1 && (() => {
                      const nextTiles = previewNextSpecialTiles(
                        usedWords.length,
                        settings.mode === "daily_5x5" ? getDailySeed() + "-5x5" : getDailySeed(),
                        size,
                        specialTiles
                      );
                      return nextTiles.length > 0 ? (
                        <div className="mt-2 hidden lg:block">
                          <SpecialTilePreview tiles={nextTiles} />
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
                {settings.mode === "time_attack" && (
                  <div className="mt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${timeAttackTimeRemaining <= 10 ? 'bg-red-500/15 text-red-500 animate-pulse font-bold' : timeAttackTimeRemaining <= 30 ? 'bg-orange-500/10 text-orange-500 font-medium' : 'text-muted-foreground font-medium'}`}>
                        ⏰ {Math.floor(timeAttackTimeRemaining / 60)}:{(timeAttackTimeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                )}
                {settings.mode === "endless" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {endlessStarted ? (
                      <span className="flex items-center gap-1">
                        <span className="text-purple-500 font-medium">∞ Level {endlessDifficulty}</span>
                        <span>| Words: {usedWords.length}</span>
                      </span>
                    ) : (
                      <span>Endless mode ready</span>
                    )}
                  </div>
                )}
                {settings.mode === "survival" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {survivalStarted ? (
                      <span className="flex items-center gap-2">
                        <span>{'❤️'.repeat(survivalLives)}</span>
                        <span className="text-blue-500 font-medium">Wave {survivalWave}</span>
                        {survivalBossWordRequired && <span className="text-orange-500 font-medium animate-pulse">👑 BOSS</span>}
                      </span>
                    ) : (
                      <span>Press "Start Survival" to begin</span>
                    )}
                  </div>
                )}
                {settings.mode === "zen" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Hints used: {zenHintsUsed} | Undos: {zenUndoStack.length}
                  </div>
                )}
                {settings.mode === "chaos" && (
                  <div className="mt-1 text-xs">
                    {!chaosStarted ? (
                      <div className="text-muted-foreground">
                        Press "Start Chaos" to begin
                      </div>
                    ) : (
                      <div className={`font-medium ${movesUsed >= 13 ? 'text-red-500 animate-pulse' : movesUsed >= 10 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        🔀 Moves: {movesUsed}/15
                      </div>
                    )}
                  </div>
                )}
                {puzzleMode && currentPuzzleId && (() => {
                  const puzzle = getPuzzleById(currentPuzzleId);
                  if (!puzzle) return null;
                  return (
                    <div className="mt-1 text-xs space-y-1">
                      <div className="font-medium text-muted-foreground">
                        🧩 {puzzle.name}
                      </div>
                      <div className="text-muted-foreground">
                        Moves: {puzzle.maxMoves - puzzleMovesRemaining}/{puzzle.maxMoves}
                      </div>
                      <div className="text-muted-foreground">
                        Required words: {puzzleFoundWords.size}/{puzzleRequiredWords.size}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {puzzle.requiredWords.map(word => (
                          <span 
                            key={word}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              puzzleFoundWords.has(word.toUpperCase())
                                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {(settings.mode === "daily" || settings.mode === "daily_5x5") && gameOver && <Button variant="brand" size="sm" onClick={shareScoreInline} className="mt-2 h-6 px-2 text-xs">
                    Share
                  </Button>}
                {puzzleMode && gameOver && currentPuzzleId && (
                  <div className="mt-3 flex flex-col gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => loadPuzzle(currentPuzzleId)}
                      className="w-full text-xs"
                    >
                      🔄 Replay Puzzle
                    </Button>
                    {getNextPuzzle(currentPuzzleId) && (
                      <Button 
                        variant="hero" 
                        size="sm" 
                        onClick={() => {
                          const nextPuzzle = getNextPuzzle(currentPuzzleId);
                          if (nextPuzzle) {
                            loadPuzzle(nextPuzzle.id);
                          }
                        }}
                        className="w-full text-xs"
                      >
                        ➡️ Next Puzzle: {getNextPuzzle(currentPuzzleId)?.name}
                      </Button>
                    )}
                  </div>
                )}
          </div>
        </div>
          {usedWords.length > 0 && (() => {
            const last = usedWords[usedWords.length - 1];
            const bd = last.breakdown;
            if (!bd) return null;
            return <Card className="p-3 mb-3">
                <div className="text-xs text-muted-foreground mb-1">Last word breakdown</div>
                <div className="text-sm font-medium mb-2">{last.word.toUpperCase()} <span className="text-muted-foreground">+{last.score}</span></div>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <div>Base</div><div className="text-right">+{bd.base}</div>
                  <div>Rarity</div><div className="text-right">+{Math.round(bd.rarity.bonus)}{bd.rarity.ultraCount > 0 ? <span className="ml-1 text-[10px] opacity-70">(ultra {bd.rarity.ultraCount})</span> : null}</div>
                  <div>Link</div><div className="text-right">×{bd.linkMultiplier.toFixed(1)}</div>
                  <div>Length</div><div className="text-right">+{bd.lengthBonus}</div>
                  <div className="col-span-2 border-t my-1" />
                  <div>Subtotal</div><div className="text-right">+{bd.totalBeforeMultipliers}</div>
                  <div>Multipliers</div>
                  <div className="text-right">
                    {bd.multipliers.tileMultiplier}x tile {bd.multipliers.consumableMultiplier > 1 ? `· ${bd.multipliers.consumableMultiplier}x consumable` : ""}
                    <div className="text-[10px] text-muted-foreground">
                      Applied: {bd.multipliers.combinedApplied}x{bd.multipliers.capped ? <span className="ml-1 px-1 py-[1px] rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">capped at {bd.multipliers.cap}x</span> : null}
                    </div>
                  </div>
                  <div className="col-span-2 border-t my-1" />
                  <div className="font-semibold">Total</div><div className="text-right font-semibold">+{bd.total}</div>
                </div>
              </Card>;
          })()}

          </Card>
          

 
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">Used words ({usedWords.length})</div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSortAlphabetically(!sortAlphabetically)} className="h-5 px-2 text-xs">
                  {sortAlphabetically ? "A-Z" : "Latest"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setUsedWordsExpanded(!usedWordsExpanded)} className="h-5 w-5 p-0">
                  <ChevronDown className={`h-3 w-3 transition-transform ${usedWordsExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
            <div className={`transition-all duration-300 ease-out ${sortAlphabetically && !usedWordsExpanded ? 'max-h-16 overflow-hidden' : 'overflow-visible'}`} style={{
            maxHeight: sortAlphabetically && !usedWordsExpanded ? '4rem' : 'none'
          }}>
              {(() => {
              if (!usedWords.length) {
                return <span className="text-muted-foreground text-xs">None yet</span>;
              }
              if (sortAlphabetically) {
                const sortedWords = [...usedWords].sort((a, b) => a.word.localeCompare(b.word));
                return <div className="flex flex-wrap gap-1">
                      {sortedWords.map((entry, index) => (
                        <span key={`${entry.word}-${index}`} className="px-1.5 py-0.5 rounded text-xs bg-secondary">
                          {entry.word.toUpperCase()}
                        </span>
                      ))}
                    </div>;
              } else {
                // Latest sort - 2-column format
                const latestWords = usedWords.slice(-15).reverse();
                return <div className="space-y-1">
                      <Accordion type="multiple" className="w-full">
                        {latestWords.map((entry, index) => (
                          <AccordionItem key={`${entry.word}-${index}`} value={`${entry.word}-${index}`} className="border-b-0">
                            <AccordionTrigger className="py-1 hover:no-underline">
                              <div className="w-full flex justify-between items-center text-xs">
                                <span className="font-medium">{entry.word.toUpperCase()}</span>
                                <span className="text-muted-foreground">+{entry.score}</span>
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
                                  <div>Subtotal</div><div className="text-right">+{entry.breakdown.totalBeforeMultipliers}</div>
                                  <div>Multipliers</div>
                                  <div className="text-right">
                                    {entry.breakdown.multipliers.tileMultiplier}x tile {entry.breakdown.multipliers.consumableMultiplier > 1 ? `· ${entry.breakdown.multipliers.consumableMultiplier}x consumable` : ""}
                                    <div className="text-[10px] text-muted-foreground">
                                      Applied: {entry.breakdown.multipliers.combinedApplied}x{entry.breakdown.multipliers.capped ? (
                                        <span className="ml-1 px-1 py-[1px] rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">capped</span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="col-span-2 border-t my-1" />
                                  <div className="font-semibold">Total</div><div className="text-right font-semibold">+{entry.breakdown.total}</div>
                                </div>
                              ) : (
                                <div className="text-muted-foreground">No breakdown available</div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>;
              }
            })()}
            </div>
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
                    case 'power_up_random':
                      const randomPU = getRandomPowerUp();
                      setSurvivalInventoryPowerUps(prev => [...prev, randomPU]);
                      toast.success(`🎲 Received ${randomPU.name}!`);
                      break;
                    case 'power_up_rare':
                      const rarePU = getRandomPowerUp(Math.random() < 0.5 ? 'rare' : 'epic');
                      setSurvivalInventoryPowerUps(prev => [...prev, rarePU]);
                      toast.success(`⭐ Received ${rarePU.name}!`);
                      break;
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
                let actualEffect = { ...option.effect };

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
      <footer className="mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Banton Games. All rights reserved.
      </footer>
    </section>
  );
}

export default WordPathGame;
