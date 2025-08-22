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
};

export const useDailyChallengeState = (challengeDate: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    try {
      // Validate state before saving - be more lenient
      if (!gameState.seed || gameState.seed !== challengeDate) {
        console.warn('Invalid game state: seed mismatch, but attempting to save anyway');
      }

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
              game_state: gameState
            }, {
              onConflict: 'user_id,challenge_date',
              ignoreDuplicates: false
            });
          
          if (!error) {
            saved = true;
            // Sync to localStorage for consistency
            localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(gameState));
          } else {
            console.error(`Error saving daily challenge state to database (attempt ${4-retries}):`, error);
            retries--;
            if (retries === 0) {
              // Final fallback to localStorage
              localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(gameState));
            }
          }
        }
      } else {
        // Use localStorage for guests
        localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(gameState));
      }
    } catch (e) {
      console.error('Error saving daily challenge state:', e);
      // Fallback to localStorage
      localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(gameState));
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
      
      if (user) {
        // Load from database for logged-in users
        try {
          const { data, error } = await supabase
            .from('daily_challenge_states')
            .select('game_state')
            .eq('user_id', user.id)
            .eq('challenge_date', challengeDate)
            .maybeSingle(); // Use maybeSingle to avoid errors when no data exists
          
          if (data && !error) {
            const gameState = data.game_state as DailyChallengeGameState;
            // Validate state before using it
            if (gameState.seed === challengeDate && gameState.initialBoard && gameState.board) {
              loadedState = gameState;
            }
          }
        } catch (e) {
          console.warn('Failed to load daily challenge state from database:', e);
        }
      }
      
      // Fallback to localStorage if database load failed or no user
      if (!loadedState) {
        const savedState = localStorage.getItem(`daily-challenge-${challengeDate}`);
        if (savedState) {
          try {
            const gameState = JSON.parse(savedState) as DailyChallengeGameState;
            // Validate state before using it
            if (gameState.seed === challengeDate && gameState.initialBoard && gameState.board) {
              loadedState = gameState;
              
              // Sync valid localStorage state to database if user is logged in
              if (user) {
                await immediatelyRleeHaveStateImpl(gameState);
              }
            }
          } catch (e) {
            console.warn('Failed to load daily challenge state from localStorage:', e);
          }
        }
      }
      
      return loadedState;
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

  // Auto-sync state when user authentication changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // When user signs in, migrate localStorage state to database if it exists and is valid
          const localState = localStorage.getItem(`daily-challenge-${challengeDate}`);
          if (localState) {
            try {
              const gameState = JSON.parse(localState) as DailyChallengeGameState;
              // Validate before migration
              if (gameState.seed === challengeDate && gameState.initialBoard && gameState.board) {
                await saveState(gameState, true); // Use immediate save for migration
                // Keep localStorage as backup, don't remove it
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
      // Clear timeout on cleanup
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [challengeDate, saveState]);

  return {
    saveState,
    loadState,
    clearState,
    isLoading
  };
};
