import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AchievementId } from '@/lib/achievements';

export type DailyChallengeGameState = {
  board: any[][];
  initialBoard: any[][]; // Store the initial board state
  specialTiles: any[][];
  usedWords: any[];
  score: number;
  streak: number;
  movesUsed: number;
  unlocked: any[];
  gameOver: boolean;
  finalGrade: any;
  lastWordTiles?: string[];
  seed: string;
  benchmarks?: any; // Store benchmark thresholds
  discoverableCount?: number; // Store total discoverable words
  boardAnalysis?: any; // Store board analysis data
  lastSaved?: number; // Timestamp of last save
};

export const useDailyChallengeState = (challengeDate: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'success' | 'error' | 'pending' | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced mobile-optimized state persistence
  const setupMobileOptimizations = useCallback(() => {
    // Mobile-specific event handlers for state preservation
    const handleBeforeUnload = () => {
      const state = localStorage.getItem(`daily-challenge-${challengeDate}`);
      if (state) {
        try {
          const gameState = JSON.parse(state) as DailyChallengeGameState;
          if (gameState && !gameState.gameOver) {
            // Mark as interrupted for recovery
            gameState.lastSaved = Date.now();
            localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(gameState));
          }
        } catch (e) {
          console.warn('Error saving state on beforeunload:', e);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App going to background - save immediately
        const state = localStorage.getItem(`daily-challenge-${challengeDate}`);
        if (state) {
          handleBeforeUnload();
        }
      }
    };

    // Add mobile-optimized event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [challengeDate]);

  // Debounced save function to prevent rapid database operations
  const debouncedSaveState = useCallback(async (gameState: DailyChallengeGameState): Promise<void> => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout to debounce the save operation
    saveTimeoutRef.current = setTimeout(async () => {
      await immediatelyRleeHaveStateImpl(gameState);
    }, 300); // 300ms debounce
  }, [challengeDate]);

  const immediatelyRleeHaveStateImpl = async (gameState: DailyChallengeGameState): Promise<void> => {
    setIsLoading(true);
    setLastSaveStatus('pending');
    
    try {
      // Enhanced state validation with progressive recovery
      const stateValid = gameState.seed === challengeDate && 
                        gameState.initialBoard && 
                        gameState.board &&
                        Array.isArray(gameState.usedWords) &&
                        typeof gameState.score === 'number';
      
      if (!stateValid) {
        console.warn('Invalid game state detected, attempting repair...');
        // Progressive state repair - keep what's valid
        if (!gameState.seed) gameState.seed = challengeDate;
        if (!Array.isArray(gameState.usedWords)) gameState.usedWords = [];
        if (typeof gameState.score !== 'number') gameState.score = 0;
      }

      // Add save timestamp for tracking
      gameState.lastSaved = Date.now();

      // Compress state for mobile storage optimization
      const compressedState = {
        ...gameState,
        // Remove redundant data that can be regenerated
        benchmarks: gameState.gameOver ? gameState.benchmarks : undefined
      };

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        let retries = 3;
        let saved = false;
        
        while (retries > 0 && !saved) {
          const { error } = await supabase
            .from('daily_challenge_states')
            .upsert({
              user_id: user.id,
              challenge_date: challengeDate,
              game_state: compressedState
            }, {
              onConflict: 'user_id,challenge_date',
              ignoreDuplicates: false
            });
          
          if (!error) {
            saved = true;
            setLastSaveStatus('success');
            // Sync to localStorage for consistency and offline access
            localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(compressedState));
          } else {
            console.error(`Error saving daily challenge state to database (attempt ${4-retries}):`, error);
            retries--;
            if (retries === 0) {
              setLastSaveStatus('error');
              // Final fallback to localStorage
              localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(compressedState));
            }
          }
        }
      } else {
        // Use localStorage for guests
        localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(compressedState));
        setLastSaveStatus('success');
      }
    } catch (e) {
      console.error('Error saving daily challenge state:', e);
      setLastSaveStatus('error');
      // Fallback to localStorage
      const fallbackState = { ...gameState, lastSaved: Date.now() };
      localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(fallbackState));
    } finally {
      setIsLoading(false);
    }
  };

  // Immediate save function for critical moments (game start, initial board creation)
  const saveState = useCallback(async (gameState: DailyChallengeGameState, immediate = false): Promise<void> => {
    if (immediate) {
      await immediatelyRleeHaveStateImpl(gameState);
    } else {
      await debouncedSaveState(gameState);
    }
  }, [debouncedSaveState]);

  const loadState = async (): Promise<DailyChallengeGameState | null> => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      let loadedState: DailyChallengeGameState | null = null;
      let partialState: Partial<DailyChallengeGameState> | null = null;
      
      if (user) {
        // Load from database for logged-in users
        try {
          const { data, error } = await supabase
            .from('daily_challenge_states')
            .select('game_state')
            .eq('user_id', user.id)
            .eq('challenge_date', challengeDate)
            .maybeSingle();
          
          if (data && !error) {
            const gameState = data.game_state as DailyChallengeGameState;
            // Enhanced validation with progressive recovery
            const hasValidCore = gameState.seed === challengeDate && 
                                gameState.initialBoard && 
                                gameState.board;
            
            if (hasValidCore) {
              loadedState = gameState;
            } else if (gameState.seed === challengeDate) {
              // Partial state - can be recovered
              partialState = gameState;
            }
          }
        } catch (e) {
          console.warn('Failed to load daily challenge state from database:', e);
        }
      }
      
      // Fallback to localStorage if database load failed or no user
      if (!loadedState && !partialState) {
        const savedState = localStorage.getItem(`daily-challenge-${challengeDate}`);
        if (savedState) {
          try {
            const gameState = JSON.parse(savedState) as DailyChallengeGameState;
            const hasValidCore = gameState.seed === challengeDate && 
                                gameState.initialBoard && 
                                gameState.board;
            
            if (hasValidCore) {
              loadedState = gameState;
              
              // Sync valid localStorage state to database if user is logged in
              if (user) {
                await immediatelyRleeHaveStateImpl(gameState);
              }
            } else if (gameState.seed === challengeDate) {
              partialState = gameState;
            }
          } catch (e) {
            console.warn('Failed to load daily challenge state from localStorage:', e);
          }
        }
      }
      
      // Return full state or partial state for recovery
      return loadedState || (partialState as DailyChallengeGameState);
    } finally {
      setIsLoading(false);
    }
  };

  const clearState = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        try {
          await supabase
            .from('daily_challenge_states')
            .delete()
            .eq('user_id', user.id)
            .eq('challenge_date', challengeDate);
        } catch (e) {
          console.error('Error clearing daily challenge state from database:', e);
        }
      }
      
      localStorage.removeItem(`daily-challenge-${challengeDate}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Periodic state snapshots for mobile optimization
  const startPeriodicSaves = useCallback((gameState: DailyChallengeGameState) => {
    if (periodicSaveRef.current) {
      clearInterval(periodicSaveRef.current);
    }
    
    // Save every 30 seconds during active gameplay
    periodicSaveRef.current = setInterval(() => {
      if (!gameState.gameOver) {
        debouncedSaveState(gameState);
      }
    }, 30000);
  }, [debouncedSaveState]);

  const stopPeriodicSaves = useCallback(() => {
    if (periodicSaveRef.current) {
      clearInterval(periodicSaveRef.current);
      periodicSaveRef.current = null;
    }
  }, []);

  // Enhanced state validation
  const validateGameState = useCallback((state: any): { isValid: boolean; canRecover: boolean; errors: string[] } => {
    const errors: string[] = [];
    let isValid = true;
    let canRecover = false;

    if (!state) {
      errors.push('State is null or undefined');
      return { isValid: false, canRecover: false, errors };
    }

    if (state.seed !== challengeDate) {
      errors.push('Seed mismatch');
      isValid = false;
    } else {
      canRecover = true;
    }

    if (!state.initialBoard || !Array.isArray(state.initialBoard)) {
      errors.push('Missing or invalid initial board');
      isValid = false;
    }

    if (!state.board || !Array.isArray(state.board)) {
      errors.push('Missing or invalid current board');
      isValid = false;
    }

    if (!Array.isArray(state.usedWords)) {
      errors.push('Missing or invalid used words');
      isValid = false;
    }

    if (typeof state.score !== 'number') {
      errors.push('Missing or invalid score');
      isValid = false;
    }

    return { isValid, canRecover, errors };
  }, [challengeDate]);

  // Auto-sync state when user authentication changes
  useEffect(() => {
    const cleanupMobile = setupMobileOptimizations();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // When user signs in, migrate localStorage state to database if it exists and is valid
          const localState = localStorage.getItem(`daily-challenge-${challengeDate}`);
          if (localState) {
            try {
              const gameState = JSON.parse(localState) as DailyChallengeGameState;
              const validation = validateGameState(gameState);
              
              if (validation.isValid) {
                await saveState(gameState, true); // Use immediate save for migration
              } else if (validation.canRecover) {
                console.log('Partial state found during login, available for recovery');
              }
            } catch (e) {
              console.error('Error migrating daily challenge state to database:', e);
            }
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      cleanupMobile();
      
      // Clear timeouts on cleanup
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (periodicSaveRef.current) {
        clearInterval(periodicSaveRef.current);
      }
    };
  }, [challengeDate, saveState, setupMobileOptimizations, validateGameState]);

  return {
    saveState,
    loadState,
    clearState,
    isLoading,
    lastSaveStatus,
    validateGameState,
    startPeriodicSaves,
    stopPeriodicSaves
  };
};
