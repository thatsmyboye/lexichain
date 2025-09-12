import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isNetworkAvailable, waitForNetwork, getDailyChallengeDate } from '@/utils/dateUtils';
import { syncOfflineDailyChallengeResults } from '@/utils/dailyChallengeResultSaver';

/**
 * Hook for handling offline sync of daily challenge results
 * Automatically syncs backup results when network becomes available
 */
export function useOfflineSync() {
  const syncBackupResults = useCallback(async () => {
    if (!isNetworkAvailable()) return;
    
    try {
      // Use the bulletproof sync function
      const syncedCount = await syncOfflineDailyChallengeResults();
      console.log(`[Offline Sync] Synced ${syncedCount} results`);
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