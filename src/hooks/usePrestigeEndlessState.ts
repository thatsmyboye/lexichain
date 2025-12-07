import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ActiveBuff = {
  id: string;
  name: string;
  effect: string;
  value: number;
  category: string;
  icon: string;
  acquiredAtWave: number;
};

export type BuffChoice = {
  id: string;
  name: string;
  description: string;
  effect: string;
  value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
};

export type PrestigeEndlessState = {
  sessionId: string;
  currentWave: number;
  wordsInWave: number;
  totalScore: number;
  lives: number;
  activeBuffs: ActiveBuff[];
  availableBuffChoices?: BuffChoice[];
  prestigeLevel: number;
  prestigePoints: number;
  highestWaveEver: number;
  sessionStartTime: number;
  lastWaveTime?: number;
  board: any[][];
  specialTiles: any[][];
  usedWords: any[];
  currentScore: number;
  gameOver: boolean;
  canPrestige: boolean;
  lastSaved?: number;
};

export const usePrestigeEndlessState = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'success' | 'error' | 'pending' | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSaveState = useCallback(async (gameState: PrestigeEndlessState): Promise<void> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await immediatelySaveStateImpl(gameState);
    }, 300);
  }, []);

  const immediatelySaveStateImpl = async (gameState: PrestigeEndlessState): Promise<void> => {
    setIsLoading(true);
    setLastSaveStatus('pending');

    try {
      gameState.lastSaved = Date.now();

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        let retries = 3;
        let saved = false;

        while (retries > 0 && !saved) {
          const { error } = await supabase
            .from('prestige_endless_states')
            .upsert({
              user_id: user.id,
              session_id: gameState.sessionId,
              game_state: gameState
            }, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            });

          if (!error) {
            saved = true;
            setLastSaveStatus('success');
            localStorage.setItem(`prestige-endless-${user.id}`, JSON.stringify(gameState));
          } else {
            console.error(`Error saving prestige endless state (attempt ${4 - retries}):`, error);
            retries--;
            if (retries === 0) {
              setLastSaveStatus('error');
              localStorage.setItem(`prestige-endless-${user.id}`, JSON.stringify(gameState));
            }
          }
        }
      } else {
        localStorage.setItem('prestige-endless-guest', JSON.stringify(gameState));
        setLastSaveStatus('success');
      }
    } catch (e) {
      console.error('Error saving prestige endless state:', e);
      setLastSaveStatus('error');
      const fallbackState = { ...gameState, lastSaved: Date.now() };
      localStorage.setItem('prestige-endless-guest', JSON.stringify(fallbackState));
    } finally {
      setIsLoading(false);
    }
  };

  const saveState = useCallback(async (gameState: PrestigeEndlessState, immediate = false): Promise<void> => {
    if (immediate) {
      await immediatelySaveStateImpl(gameState);
    } else {
      await debouncedSaveState(gameState);
    }
  }, [debouncedSaveState]);

  const loadState = async (): Promise<PrestigeEndlessState | null> => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let loadedState: PrestigeEndlessState | null = null;

      if (user) {
        try {
          const { data, error } = await supabase
            .from('prestige_endless_states')
            .select('game_state')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data && !error) {
            loadedState = data.game_state as PrestigeEndlessState;
          }
        } catch (e) {
          console.warn('Failed to load prestige endless state from database:', e);
        }

        // Fallback to localStorage
        if (!loadedState) {
          const savedState = localStorage.getItem(`prestige-endless-${user.id}`);
          if (savedState) {
            try {
              loadedState = JSON.parse(savedState);
              if (loadedState) {
                await immediatelySaveStateImpl(loadedState);
              }
            } catch (e) {
              console.warn('Failed to load prestige endless state from localStorage:', e);
            }
          }
        }
      } else {
        const savedState = localStorage.getItem('prestige-endless-guest');
        if (savedState) {
          try {
            loadedState = JSON.parse(savedState);
          } catch (e) {
            console.warn('Failed to load prestige endless state from localStorage:', e);
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
          await supabase
            .from('prestige_endless_states')
            .delete()
            .eq('user_id', user.id);
        } catch (e) {
          console.error('Error clearing prestige endless state from database:', e);
        }
        localStorage.removeItem(`prestige-endless-${user.id}`);
      } else {
        localStorage.removeItem('prestige-endless-guest');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlayerStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('prestige_endless_player_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading prestige player stats:', error);
        return null;
      }

      return data;
    } catch (e) {
      console.error('Error loading prestige player stats:', e);
      return null;
    }
  };

  const savePlayerStats = async (stats: {
    prestige_level: number;
    total_prestige_points: number;
    highest_wave_ever: number;
    total_runs: number;
    total_waves_completed?: number;
    purchased_items?: string[];
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('prestige_endless_player_stats')
        .upsert({
          user_id: user.id,
          ...stats
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error saving prestige player stats:', error);
      }
    } catch (e) {
      console.error('Error saving prestige player stats:', e);
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
    loadPlayerStats,
    savePlayerStats,
    isLoading,
    lastSaveStatus
  };
};

// Helper to generate unique session ID
export const generateSessionId = (): string => {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
