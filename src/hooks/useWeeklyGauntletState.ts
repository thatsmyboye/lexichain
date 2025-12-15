import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type PuzzleState = {
  day: DayOfWeek;
  theme: string;
  constraint: string;
  seed: string;
  board: any[][];
  specialTiles: any[][];
  usedWords: any[];
  score: number;
  movesUsed: number;
  movesLimit: number;
  timeLimit?: number;
  timeRemaining?: number;
  startTime?: number;
  completed: boolean;
  completedAt?: number;
  grade?: 'bronze' | 'silver' | 'gold' | 'platinum';
};

export type WeeklyGauntletState = {
  weekIdentifier: string;
  puzzles: {
    monday: PuzzleState | null;
    tuesday: PuzzleState | null;
    wednesday: PuzzleState | null;
    thursday: PuzzleState | null;
    friday: PuzzleState | null;
    saturday: PuzzleState | null;
    sunday: PuzzleState | null;
  };
  completedPuzzles: Set<DayOfWeek>;
  puzzleScores: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
  totalScore: number;
  completionBonus: number;
  weeklyGrade?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null;
  isWeekComplete: boolean;
  lastSaved?: number;
};

export const useWeeklyGauntletState = (weekIdentifier: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'success' | 'error' | 'pending' | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSaveState = useCallback(async (gameState: WeeklyGauntletState): Promise<void> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await immediatelySaveStateImpl(gameState);
    }, 300);
  }, [weekIdentifier]);

  const immediatelySaveStateImpl = async (gameState: WeeklyGauntletState): Promise<void> => {
    setIsLoading(true);
    setLastSaveStatus('pending');

    try {
      const stateValid = gameState.weekIdentifier === weekIdentifier;

      if (!stateValid) {
        console.warn('Invalid game state detected');
        setLastSaveStatus('error');
        return;
      }

      gameState.lastSaved = Date.now();

      // Convert Set to Array for JSON serialization
      const serializableState = {
        ...gameState,
        completedPuzzles: Array.from(gameState.completedPuzzles)
      };

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        let retries = 3;
        let saved = false;

        while (retries > 0 && !saved) {
          const { error } = await (supabase
            .from as any)('weekly_gauntlet_states')
            .upsert({
              user_id: user.id,
              week_identifier: weekIdentifier,
              game_state: serializableState
            }, {
              onConflict: 'user_id,week_identifier',
              ignoreDuplicates: false
            });

          if (!error) {
            saved = true;
            setLastSaveStatus('success');
            localStorage.setItem(`weekly-gauntlet-${weekIdentifier}`, JSON.stringify(serializableState));
          } else {
            console.error(`Error saving weekly gauntlet state (attempt ${4 - retries}):`, error);
            retries--;
            if (retries === 0) {
              setLastSaveStatus('error');
              localStorage.setItem(`weekly-gauntlet-${weekIdentifier}`, JSON.stringify(serializableState));
            }
          }
        }
      } else {
        localStorage.setItem(`weekly-gauntlet-${weekIdentifier}`, JSON.stringify(serializableState));
        setLastSaveStatus('success');
      }
    } catch (e) {
      console.error('Error saving weekly gauntlet state:', e);
      setLastSaveStatus('error');
      const serializableState = {
        ...gameState,
        completedPuzzles: Array.from(gameState.completedPuzzles),
        lastSaved: Date.now()
      };
      localStorage.setItem(`weekly-gauntlet-${weekIdentifier}`, JSON.stringify(serializableState));
    } finally {
      setIsLoading(false);
    }
  };

  const saveState = useCallback(async (gameState: WeeklyGauntletState, immediate = false): Promise<void> => {
    if (immediate) {
      await immediatelySaveStateImpl(gameState);
    } else {
      await debouncedSaveState(gameState);
    }
  }, [debouncedSaveState]);

  const loadState = async (): Promise<WeeklyGauntletState | null> => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let loadedState: WeeklyGauntletState | null = null;

      if (user) {
        try {
          const { data, error } = await (supabase
            .from as any)('weekly_gauntlet_states')
            .select('game_state')
            .eq('user_id', user.id)
            .eq('week_identifier', weekIdentifier)
            .maybeSingle();

          if (data && !error) {
            const gameState = data.game_state as any;
            loadedState = {
              ...gameState,
              completedPuzzles: new Set(gameState.completedPuzzles || [])
            };
          }
        } catch (e) {
          console.warn('Failed to load weekly gauntlet state from database:', e);
        }
      }

      if (!loadedState) {
        const savedState = localStorage.getItem(`weekly-gauntlet-${weekIdentifier}`);
        if (savedState) {
          try {
            const gameState = JSON.parse(savedState);
            loadedState = {
              ...gameState,
              completedPuzzles: new Set(gameState.completedPuzzles || [])
            };

            if (user && loadedState) {
              await immediatelySaveStateImpl(loadedState);
            }
          } catch (e) {
            console.warn('Failed to load weekly gauntlet state from localStorage:', e);
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
            .from as any)('weekly_gauntlet_states')
            .delete()
            .eq('user_id', user.id)
            .eq('week_identifier', weekIdentifier);
        } catch (e) {
          console.error('Error clearing weekly gauntlet state from database:', e);
        }
      }

      localStorage.removeItem(`weekly-gauntlet-${weekIdentifier}`);
    } finally {
      setIsLoading(false);
    }
  };

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

// Helper function to get current week identifier
export const getWeekIdentifier = (date: Date = new Date()): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7) + 1;
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
};
