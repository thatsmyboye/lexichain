/**
 * Dictionary manager for enhanced word validation with debugging capabilities
 */

interface DictionaryStatus {
  loaded: boolean;
  wordCount: number;
  loadTime?: number;
  errors?: string[];
}

interface WordValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

class DictionaryManager {
  private dictionary: Set<string> = new Set();
  private sortedWords: string[] = [];
  private status: DictionaryStatus = { loaded: false, wordCount: 0 };
  private loadPromise: Promise<void> | null = null;
  
  async loadDictionary(): Promise<{ dict: Set<string>; sorted: string[]; status: DictionaryStatus }> {
    if (this.loadPromise) {
      await this.loadPromise;
      return { dict: this.dictionary, sorted: this.sortedWords, status: this.status };
    }

    this.loadPromise = this.performLoad();
    await this.loadPromise;
    return { dict: this.dictionary, sorted: this.sortedWords, status: this.status };
  }

  private async performLoad(): Promise<void> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log("🔄 Loading dictionary from /words.txt...");
      
      const response = await fetch("/words.txt");
      if (!response.ok) {
        throw new Error(`Failed to fetch dictionary: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || text.length < 1000) {
        throw new Error("Dictionary file appears to be empty or corrupted");
      }

      // Process words with enhanced validation
      const rawWords = text.split(/\r?\n/);
      const processedWords = new Set<string>();
      let invalidWords = 0;

      for (const rawWord of rawWords) {
        const word = rawWord.trim().toLowerCase();
        
        // Skip empty lines and very short words
        if (!word || word.length < 2) continue;
        
        // Basic validation - only letters and apostrophes
        if (!/^[a-z']+$/.test(word)) {
          invalidWords++;
          continue;
        }
        
        // Add valid words of 3+ characters to dictionary
        if (word.length >= 3) {
          processedWords.add(word);
        }
      }

      this.dictionary = processedWords;
      this.sortedWords = Array.from(processedWords).sort();
      
      const loadTime = Date.now() - startTime;
      this.status = {
        loaded: true,
        wordCount: processedWords.size,
        loadTime,
        errors: invalidWords > 0 ? [`Skipped ${invalidWords} invalid words`] : undefined
      };

      console.log(`✅ Dictionary loaded successfully:`, {
        totalWords: processedWords.size,
        loadTime: `${loadTime}ms`,
        invalidWordsSkipped: invalidWords,
        sampleWords: this.sortedWords.slice(0, 5)
      });

      // Validate dictionary integrity
      this.validateDictionaryIntegrity();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      this.status = {
        loaded: false,
        wordCount: 0,
        errors
      };

      console.error("❌ Dictionary loading failed:", errorMessage);
      throw error;
    }
  }

  private validateDictionaryIntegrity(): void {
    const testWords = ['the', 'and', 'cat', 'dog', 'house'];
    const missingCommonWords = testWords.filter(word => !this.dictionary.has(word));
    
    if (missingCommonWords.length > 2) {
      console.warn("⚠️ Dictionary may be incomplete - missing common words:", missingCommonWords);
    }

    // Verify sorted array matches dictionary
    if (this.sortedWords.length !== this.dictionary.size) {
      console.error("❌ Dictionary integrity error: sorted array size mismatch");
    }
  }

  validateWord(word: string): WordValidationResult {
    const normalizedWord = word.toLowerCase().trim();
    
    if (!this.status.loaded) {
      return { isValid: false, reason: "Dictionary not loaded" };
    }

    if (normalizedWord.length < 3) {
      return { isValid: false, reason: "Word must be at least 3 letters" };
    }

    if (!/^[a-z']+$/.test(normalizedWord)) {
      return { isValid: false, reason: "Word contains invalid characters" };
    }

    const isValid = this.dictionary.has(normalizedWord);
    
    if (!isValid) {
      // Generate suggestions for similar words
      const suggestions = this.findSimilarWords(normalizedWord);
      return { 
        isValid: false, 
        reason: "Word not found in dictionary",
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };
    }

    return { isValid: true };
  }

  private findSimilarWords(word: string, maxSuggestions: number = 3): string[] {
    if (word.length < 3) return [];
    
    const suggestions: string[] = [];
    
    // Look for words that start with the same 2-3 letters
    const prefix = word.substring(0, Math.min(3, word.length));
    
    for (const dictWord of this.sortedWords) {
      if (suggestions.length >= maxSuggestions) break;
      
      if (dictWord.startsWith(prefix) && 
          Math.abs(dictWord.length - word.length) <= 2 &&
          dictWord !== word) {
        suggestions.push(dictWord);
      }
    }
    
    return suggestions;
  }

  getStatus(): DictionaryStatus {
    return { ...this.status };
  }

  getDictionary(): Set<string> {
    return this.dictionary;
  }

  getSortedWords(): string[] {
    return this.sortedWords;
  }

  // Debug method to test specific words
  debugWord(word: string): void {
    console.log(`🔍 Debug word "${word}":`, {
      normalized: word.toLowerCase().trim(),
      inDictionary: this.dictionary.has(word.toLowerCase().trim()),
      validation: this.validateWord(word),
      dictionarySize: this.dictionary.size,
      dictionaryLoaded: this.status.loaded
    });
  }
}

// Export singleton instance
export const dictionaryManager = new DictionaryManager();

// Export utility functions for backwards compatibility
export async function loadEnhancedDictionary(): Promise<{ dict: Set<string>; sorted: string[]; status: DictionaryStatus }> {
  return dictionaryManager.loadDictionary();
}

export function validateWordEnhanced(word: string): WordValidationResult {
  return dictionaryManager.validateWord(word);
}

export function debugWordValidation(word: string): void {
  dictionaryManager.debugWord(word);
}