import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDailyChallengeDate, isNetworkAvailable, retryWithBackoff } from "@/utils/dateUtils";
import type { User } from "@supabase/supabase-js";

export interface BasicDailyChallengeResult {
  user_id: string;
  challenge_date: string;
  score: number;
  achievement_level: string;
}

export interface EnhancedDailyChallengeResult extends BasicDailyChallengeResult {
  board_analysis?: Record<string, any>;
  word_count?: number;
  grid_size?: number;
}

export interface SaveProgress {
  stage: 'validation' | 'basic_save' | 'enhanced_save' | 'backup' | 'complete' | 'failed';
  error?: string;
  retryCount?: number;
}

/**
 * Device-specific optimizations for different browsers/platforms
 */
function getDeviceOptimizations() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|tablet/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isIOS = /iphone|ipad|ipod/.test(userAgent);

  return {
    isMobile,
    isSafari,
    isAndroid,
    isIOS,
    // Reduce timeout for mobile devices
    timeout: isMobile ? 8000 : 15000,
    // Increase retries for unstable mobile connections
    maxRetries: isMobile ? 5 : 3,
    // Use longer delays for mobile
    baseDelay: isMobile ? 2000 : 1000,
    // More aggressive local backup on mobile
    aggressiveBackup: isMobile
  };
}

/**
 * Validates the challenge date and ensures consistency
 */
function validateChallengeDate(): string {
  try {
    const challengeDate = getDailyChallengeDate();
    
    // Additional validation
    if (!challengeDate || !/^\d{4}-\d{2}-\d{2}$/.test(challengeDate)) {
      throw new Error(`Invalid challenge date format: ${challengeDate}`);
    }
    
    // Ensure date is not in the future
    const today = new Date();
    const challengeDateObj = new Date(challengeDate + 'T00:00:00-05:00'); // Eastern time
    
    if (challengeDateObj > today) {
      console.warn(`Challenge date ${challengeDate} is in the future, using today's date`);
      return getDailyChallengeDate(); // Fallback to current date
    }
    
    return challengeDate;
  } catch (error) {
    console.error('Challenge date validation failed:', error);
    // Ultimate fallback - use local date
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
}

/**
 * Creates a local backup of the result
 */
function createLocalBackup(result: BasicDailyChallengeResult, prefix = 'daily-challenge-result-backup'): void {
  try {
    const backupKey = `${prefix}-${result.challenge_date}-${Date.now()}`;
    const backupData = {
      ...result,
      timestamp: new Date().toISOString(),
      synced: false,
      deviceInfo: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        url: window.location.href
      }
    };
    
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    console.log(`[Daily Challenge] Result backed up locally: ${backupKey}`);
  } catch (error) {
    console.error('[Daily Challenge] Failed to create local backup:', error);
  }
}

/**
 * Progressive save strategy: try enhanced save first, fallback to basic save
 */
async function progressiveSave(
  basicResult: BasicDailyChallengeResult,
  enhancedData?: Partial<EnhancedDailyChallengeResult>,
  onProgress?: (progress: SaveProgress) => void
): Promise<boolean> {
  const deviceOpts = getDeviceOptimizations();
  
  // Stage 1: Try enhanced save first
  if (enhancedData) {
    onProgress?.({ stage: 'enhanced_save' });
    
    try {
      const enhancedResult = { ...basicResult, ...enhancedData };
      
      const { error } = await supabase
        .from("daily_challenge_results")
        .upsert(enhancedResult, {
          onConflict: 'user_id,challenge_date',
          ignoreDuplicates: false
        });
      
      if (!error) {
        console.log('[Daily Challenge] Enhanced save successful');
        return true;
      }
      
      console.warn('[Daily Challenge] Enhanced save failed, trying basic save:', error);
    } catch (error) {
      console.warn('[Daily Challenge] Enhanced save error:', error);
    }
  }
  
  // Stage 2: Fallback to basic save
  onProgress?.({ stage: 'basic_save' });
  
  try {
    const { error } = await supabase
      .from("daily_challenge_results")
      .upsert(basicResult, {
        onConflict: 'user_id,challenge_date',
        ignoreDuplicates: false
      });
    
    if (!error) {
      console.log('[Daily Challenge] Basic save successful');
      return true;
    }
    
    console.error('[Daily Challenge] Basic save failed:', error);
    return false;
  } catch (error) {
    console.error('[Daily Challenge] Basic save error:', error);
    return false;
  }
}

/**
 * Main bulletproof save function
 */
export async function saveDailyChallengeResultBulletproof(
  user: User,
  score: number,
  achievementLevel: string,
  enhancedData?: Partial<EnhancedDailyChallengeResult>,
  onProgress?: (progress: SaveProgress) => void
): Promise<boolean> {
  
  onProgress?.({ stage: 'validation' });
  
  // Early validation
  if (!user?.id) {
    console.error('[Daily Challenge] No user provided');
    return false;
  }
  
  if (typeof score !== 'number' || score < 0) {
    console.error('[Daily Challenge] Invalid score:', score);
    return false;
  }
  
  const deviceOpts = getDeviceOptimizations();
  let challengeDate: string;
  
  try {
    challengeDate = validateChallengeDate();
  } catch (error) {
    console.error('[Daily Challenge] Date validation failed:', error);
    onProgress?.({ stage: 'failed', error: 'Date validation failed' });
    return false;
  }
  
  const basicResult: BasicDailyChallengeResult = {
    user_id: user.id,
    challenge_date: challengeDate,
    score,
    achievement_level: achievementLevel
  };
  
  // Create immediate backup on mobile devices
  if (deviceOpts.aggressiveBackup) {
    createLocalBackup(basicResult, 'daily-challenge-result-immediate');
  }
  
  // Check network before attempting save
  if (!isNetworkAvailable()) {
    console.log('[Daily Challenge] No network, creating backup');
    createLocalBackup(basicResult);
    onProgress?.({ stage: 'backup' });
    toast.info("Result saved locally - will sync when connection is restored");
    return false; // Not saved to server, but backed up
  }
  
  // Attempt save with retries
  try {
    const success = await retryWithBackoff(
      () => progressiveSave(basicResult, enhancedData, onProgress),
      deviceOpts.maxRetries,
      deviceOpts.baseDelay
    );
    
    if (success) {
      onProgress?.({ stage: 'complete' });
      toast.success("Daily Challenge result saved!");
      
      // Clean up any existing backups for this date
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.includes(`daily-challenge-result`) && key.includes(challengeDate));
      backupKeys.forEach(key => localStorage.removeItem(key));
      
      return true;
    } else {
      throw new Error('All save attempts failed');
    }
    
  } catch (error) {
    console.error('[Daily Challenge] Final save failure:', error);
    
    // Create backup as final fallback
    onProgress?.({ stage: 'backup' });
    createLocalBackup(basicResult);
    
    toast.error("Failed to save result online, but saved locally for later sync");
    return false;
  }
}

/**
 * Enhanced offline sync specifically for Daily Challenge results
 */
export async function syncOfflineDailyChallengeResults(): Promise<number> {
  if (!isNetworkAvailable()) return 0;
  
  const backupKeys = Object.keys(localStorage)
    .filter(key => key.startsWith('daily-challenge-result-'));
  
  if (backupKeys.length === 0) return 0;
  
  console.log(`[Daily Challenge Sync] Found ${backupKeys.length} results to sync`);
  let syncedCount = 0;
  
  for (const key of backupKeys) {
    try {
      const backupData = JSON.parse(localStorage.getItem(key) || '{}');
      
      if (backupData.synced) {
        localStorage.removeItem(key);
        continue;
      }
      
      // Validate required fields
      if (!backupData.user_id || !backupData.challenge_date || typeof backupData.score !== 'number') {
        console.warn(`[Daily Challenge Sync] Invalid backup data in ${key}`, backupData);
        localStorage.removeItem(key);
        continue;
      }
      
      // Attempt sync
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
        localStorage.removeItem(key);
        syncedCount++;
        console.log(`[Daily Challenge Sync] Synced result for ${backupData.challenge_date}`);
      } else {
        console.error(`[Daily Challenge Sync] Failed to sync ${key}:`, error);
      }
      
    } catch (error) {
      console.error(`[Daily Challenge Sync] Error processing ${key}:`, error);
      localStorage.removeItem(key); // Remove corrupted data
    }
  }
  
  if (syncedCount > 0) {
    toast.success(`Synced ${syncedCount} offline Daily Challenge results!`);
  }
  
  return syncedCount;
}

/**
 * Get statistics about local backups
 */
export function getLocalBackupStats() {
  const backupKeys = Object.keys(localStorage)
    .filter(key => key.startsWith('daily-challenge-result-'));
  
  return {
    totalBackups: backupKeys.length,
    backupKeys,
    oldestBackup: backupKeys.length > 0 ? Math.min(...backupKeys.map(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        return new Date(data.timestamp || 0).getTime();
      } catch {
        return Date.now();
      }
    })) : null
  };
}