import { useState, useEffect } from 'react';
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

  const saveState = async (gameState: DailyChallengeGameState): Promise<void> => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Save to database for logged-in users
        const { error } = await supabase
          .from('daily_challenge_states')
          .upsert({
            user_id: user.id,
            challenge_date: challengeDate,
            game_state: gameState
          });
        
        if (error) {
          console.error('Error saving daily challenge state to database:', error);
          // Fallback to localStorage
          localStorage.setItem(`daily-challenge-${challengeDate}`, JSON.stringify(gameState));
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

  const loadState = async (): Promise<DailyChallengeGameState | null> => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Load from database for logged-in users
        try {
          const { data, error } = await supabase
            .from('daily_challenge_states')
            .select('game_state')
            .eq('user_id', user.id)
            .eq('challenge_date', challengeDate)
            .single();
          
          if (data && !error) {
            const gameState = data.game_state as DailyChallengeGameState;
            if (gameState.seed === challengeDate) {
              return gameState;
            }
          }
        } catch (e) {
          console.warn('Failed to load daily challenge state from database:', e);
          // Fallback to localStorage
        }
      }
      
      // Fallback to localStorage (for guests or if database fails)
      const savedState = localStorage.getItem(`daily-challenge-${challengeDate}`);
      if (savedState) {
        try {
          const gameState = JSON.parse(savedState) as DailyChallengeGameState;
          if (gameState.seed === challengeDate) {
            return gameState;
          }
        } catch (e) {
          console.warn('Failed to load daily challenge state from localStorage:', e);
        }
      }
      
      return null;
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
          // When user signs in, migrate localStorage state to database if it exists
          const localState = localStorage.getItem(`daily-challenge-${challengeDate}`);
          if (localState) {
            try {
              const gameState = JSON.parse(localState) as DailyChallengeGameState;
              await saveState(gameState);
              // Clear localStorage after successful migration
              localStorage.removeItem(`daily-challenge-${challengeDate}`);
            } catch (e) {
              console.error('Error migrating daily challenge state to database:', e);
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [challengeDate]);

  return {
    saveState,
    loadState,
    clearState,
    isLoading
  };
};