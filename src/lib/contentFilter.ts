interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Only truly inappropriate words - reduced to prevent false positives
const INAPPROPRIATE_WORDS = [
  // Basic profanity
  'fuck', 'shit', 'bitch', 'asshole', 'bastard',
  // Offensive terms
  'nazi', 'hitler', 'nigger', 'faggot', 'retard',
  // Sexual content
  'porn', 'nude', 'naked', 'dick', 'cock', 'pussy',
  // Drugs
  'cocaine', 'heroin', 'meth',
  // Spam/inappropriate
  'admin', 'moderator', 'official', 'support', 'bot'
];

// Common character substitutions used to bypass filters
const SUBSTITUTION_PATTERNS = [
  { pattern: /[4@]/g, replacement: 'a' },
  { pattern: /[3]/g, replacement: 'e' },
  { pattern: /[1!]/g, replacement: 'i' },
  { pattern: /[0]/g, replacement: 'o' },
  { pattern: /[5$]/g, replacement: 's' },
  { pattern: /[7]/g, replacement: 't' },
  { pattern: /[+]/g, replacement: 't' },
];

function normalizeText(text: string): string {
  let normalized = text.toLowerCase().trim();
  
  // Remove spaces, underscores, dashes, dots
  normalized = normalized.replace(/[\s_\-\.]/g, '');
  
  // Apply character substitutions
  SUBSTITUTION_PATTERNS.forEach(({ pattern, replacement }) => {
    normalized = normalized.replace(pattern, replacement);
  });
  
  return normalized;
}

function containsInappropriateContent(text: string): boolean {
  const normalized = normalizeText(text);
  
  return INAPPROPRIATE_WORDS.some(word => {
    // Use word boundaries to prevent false positives (e.g., "boy" in "thatsmyboye")
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(normalized);
  });
}

export function validateDisplayName(displayName: string): ValidationResult {
  console.log('Validating display name:', displayName);
  
  // Basic validation
  if (!displayName || displayName.trim().length === 0) {
    return { isValid: false, error: "Display name cannot be empty" };
  }
  
  if (displayName.trim().length < 2) {
    return { isValid: false, error: "Display name must be at least 2 characters long" };
  }
  
  if (displayName.trim().length > 30) {
    return { isValid: false, error: "Display name cannot be longer than 30 characters" };
  }
  
  // Content check with improved algorithm
  if (containsInappropriateContent(displayName)) {
    console.log('Display name failed content filter:', displayName);
    return { isValid: false, error: "Display name contains inappropriate content. Please choose a different name." };
  }
  
  // Check for excessive special characters or numbers
  const specialCharCount = (displayName.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (specialCharCount > displayName.length * 0.5) {
    return { isValid: false, error: "Display name contains too many special characters" };
  }
  
  console.log('Display name validation passed:', displayName);
  return { isValid: true };
}