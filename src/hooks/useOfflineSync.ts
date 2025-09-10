import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNetworkAvailable, waitForNetwork, getDailyChallengeDate } from '@/utils/dateUtils';

/**
 * Hook for handling offline sync of daily challenge results
 * Automatically syncs backup results when network becomes available
 */
export function useOfflineSync() {
  const syncBackupResults = useCallback(async () => {
    if (!isNetworkAvailable()) return;
    
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('daily-challenge-result-backup-'));
      
      if (backupKeys.length === 0) return;
      
      console.log(`[Offline Sync] Found ${backupKeys.length} backup results to sync`);
      
      for (const key of backupKeys) {
        try {
          const backupData = JSON.parse(localStorage.getItem(key) || '{}');
          
          if (backupData.synced) {
            // Already synced, clean up
            localStorage.removeItem(key);
            continue;
          }
          
          // Attempt to sync
          const { error } = await supabase
            .from('daily_challenge_results')
            .upsert({
              user_id: backupData.user_id,
              challenge_date: backupData.challenge_date,
              score: backupData.score,
              achievement_level: backupData.achievement_level
            }, {
              onConflict: 'user_id,challenge_date',
              ignoreDuplicates: false
            });
          
          if (!error) {
            // Mark as synced and remove from localStorage
            localStorage.removeItem(key);
            console.log(`[Offline Sync] Successfully synced backup result for ${backupData.challenge_date}`);
            
            toast.success(`Synced offline Daily Challenge result!`);
          } else {
            console.error(`[Offline Sync] Failed to sync ${key}:`, error);
          }
        } catch (parseError) {
          console.error(`[Offline Sync] Failed to parse backup ${key}:`, parseError);
          // Remove corrupted backup
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('[Offline Sync] Error during sync:', error);
    }
  }, []);
  
  // Sync when component mounts (if online)
  useEffect(() => {
    syncBackupResults();
  }, [syncBackupResults]);
  
  // Sync when network becomes available
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Offline Sync] Network reconnected, syncing backup results...');
      syncBackupResults();
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncBackupResults]);
  
  return { syncBackupResults };
}