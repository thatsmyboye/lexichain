import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Centralized timezone and date utility functions for Daily Challenge
 * This ensures consistency across all daily challenge operations
 */

const EASTERN_TIMEZONE = 'America/New_York';

/**
 * Get the current date in Eastern Time formatted as YYYY-MM-DD
 * This is the authoritative function for daily challenge dates
 */
export function getDailyChallengeDate(): string {
  const easternTime = toZonedTime(new Date(), EASTERN_TIMEZONE);
  const formattedDate = format(easternTime, 'yyyy-MM-dd');
  
  // Log for debugging timezone issues
  const localTime = new Date();
  console.log(`[Date Utils] Local time: ${localTime.toISOString()}, Eastern: ${formattedDate}`);
  
  return formattedDate;
}

/**
 * Get Eastern Time zone identifier
 */
export function getEasternTimezone(): string {
  return EASTERN_TIMEZONE;
}

/**
 * Convert a date to Eastern Time and format as YYYY-MM-DD
 */
export function formatDateForChallenge(date: Date): string {
  const easternTime = toZonedTime(date, EASTERN_TIMEZONE);
  return format(easternTime, 'yyyy-MM-dd');
}

/**
 * Check if network is available (for mobile compatibility)
 */
export function isNetworkAvailable(): boolean {
  return navigator.onLine;
}

/**
 * Wait for network to become available
 */
export function waitForNetwork(): Promise<void> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve();
      return;
    }
    
    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      resolve();
    };
    
    window.addEventListener('online', handleOnline);
  });
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Validate that a date string is in the expected YYYY-MM-DD format
 */
export function validateChallengeDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString + 'T00:00:00Z');
  return !isNaN(date.getTime());
}