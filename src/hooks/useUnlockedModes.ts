import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type AdvancedGameMode = 'time_attack' | 'endless' | 'puzzle' | 'survival' | 'zen';

export function useUnlockedModes(user: User | null) {
  const [unlockedModes, setUnlockedModes] = useState<Set<AdvancedGameMode>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUnlockedModes(new Set());
      setIsLoading(false);
      return;
    }

    const fetchUnlockedModes = async () => {
      try {
        const { data, error } = await supabase
          .from('user_unlocked_modes')
          .select('mode_id')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching unlocked modes:', error);
          return;
        }

        const modes = new Set(data?.map(item => item.mode_id as AdvancedGameMode) || []);
        setUnlockedModes(modes);
      } catch (error) {
        console.error('Error fetching unlocked modes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnlockedModes();
  }, [user]);

  return { unlockedModes, isLoading };
}
