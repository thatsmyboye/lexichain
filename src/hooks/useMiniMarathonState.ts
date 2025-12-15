import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BoardState = {
  board: any[][];
  specialTiles: any[][];
  usedWords: any[];
  score: number;
  movesUsed: number;
  seed: string;
  timeRemaining?: number;
  startTime?: number;
};

export type MiniMarathonGameState = {
  marathonDate: string;
  boards: {
    board1: BoardState | null;
    board2: BoardState | null;
    board3: BoardState | null;
  };
  currentBoard: 1 | 2 | 3;
  scores: {
    board1: number;
    board2: number;
    board3: number;
    total: number;
  };
  comboBonuses: {
    board1: number;
    board2: number;
  };
  movesUsedPerBoard: {
    board1: number;
    board2: number;
    board3: number;
  };
  completedBoards: Set<1 | 2 | 3>;
  startTime: number;
  boardStartTimes: {
    board1?: number;
    board2?: number;
    board3?: number;
  };
  gameOver: boolean;
  finalGrade?: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  benchmarks?: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  lastSaved?: number;
};

export const useMiniMarathonState = (marathonDate: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'success' | 'error' | 'pending' | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save function
  const debouncedSaveState = useCallback(async (gameState: MiniMarathonGameState): Promise<void> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await immediatelySaveStateImpl(gameState);
    }, 300);
  }, [marathonDate]);

  const immediatelySaveStateImpl = async (gameState: MiniMarathonGameState): Promise<void> => {
    setIsLoading(true);
    setLastSaveStatus('pending');

    try {
      // Validate state
      const stateValid = gameState.marathonDate === marathonDate;

      if (!stateValid) {
        console.warn('Invalid game state detected');
        setLastSaveStatus('error');
        return;
      }

      // Add save timestamp
      gameState.lastSaved = Date.now();

      // Convert Set to Array for JSON serialization
      const serializableState = {
        ...gameState,
        completedBoards: Array.from(gameState.completedBoards)
      };

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        let retries = 3;
        let saved = false;

        while (retries > 0 && !saved) {
          const { error } = await (supabase
            .from as any)('mini_marathon_states')
            .upsert({
              user_id: user.id,
              marathon_date: marathonDate,
              game_state: serializableState
            }, {
              onConflict: 'user_id,marathon_date',
              ignoreDuplicates: false
            });

          if (!error) {
            saved = true;
            setLastSaveStatus('success');
            localStorage.setItem(`mini-marathon-${marathonDate}`, JSON.stringify(serializableState));
          } else {
            console.error(`Error saving mini-marathon state (attempt ${4 - retries}):`, error);
            retries--;
            if (retries === 0) {
              setLastSaveStatus('error');
              localStorage.setItem(`mini-marathon-${marathonDate}`, JSON.stringify(serializableState));
            }
          }
        }
      } else {
        // Guest - use localStorage only
        localStorage.setItem(`mini-marathon-${marathonDate}`, JSON.stringify(serializableState));
        setLastSaveStatus('success');
      }
    } catch (e) {
      console.error('Error saving mini-marathon state:', e);
      setLastSaveStatus('error');
      const serializableState = {
        ...gameState,
        completedBoards: Array.from(gameState.completedBoards),
        lastSaved: Date.now()
      };
      localStorage.setItem(`mini-marathon-${marathonDate}`, JSON.stringify(serializableState));
    } finally {
      setIsLoading(false);
    }
  };

  const saveState = useCallback(async (gameState: MiniMarathonGameState, immediate = false): Promise<void> => {
    if (immediate) {
      await immediatelySaveStateImpl(gameState);
    } else {
      await debouncedSaveState(gameState);
    }
  }, [debouncedSaveState]);

  const loadState = async (): Promise<MiniMarathonGameState | null> => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let loadedState: MiniMarathonGameState | null = null;

      if (user) {
        try {
          const { data, error } = await (supabase
            .from as any)('mini_marathon_states')
            .select('game_state')
            .eq('user_id', user.id)
            .eq('marathon_date', marathonDate)
            .maybeSingle();

          if (data && !error) {
            const gameState = data.game_state as any;
            // Restore Set from Array
            loadedState = {
              ...gameState,
              completedBoards: new Set(gameState.completedBoards || [])
            };
          }
        } catch (e) {
          console.warn('Failed to load mini-marathon state from database:', e);
        }
      }

      // Fallback to localStorage
      if (!loadedState) {
        const savedState = localStorage.getItem(`mini-marathon-${marathonDate}`);
        if (savedState) {
          try {
            const gameState = JSON.parse(savedState);
            loadedState = {
              ...gameState,
              completedBoards: new Set(gameState.completedBoards || [])
            };

            // Sync to database if user is logged in
            if (user && loadedState) {
              await immediatelySaveStateImpl(loadedState);
            }
          } catch (e) {
            console.warn('Failed to load mini-marathon state from localStorage:', e);
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
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          await (supabase
            .from as any)('mini_marathon_states')
            .delete()
            .eq('user_id', user.id)
            .eq('marathon_date', marathonDate);
        } catch (e) {
          console.error('Error clearing mini-marathon state from database:', e);
        }
      }

      localStorage.removeItem(`mini-marathon-${marathonDate}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveState,
    loadState,
    clearState,
    isLoading,
    lastSaveStatus
  };
};
