interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Common inappropriate words and patterns
const INAPPROPRIATE_WORDS = [
  // Basic profanity
  'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap',
  // Offensive terms
  'nazi', 'hitler', 'racist', 'nigger', 'faggot', 'retard', 'gay',
  // Sexual content
  'sex', 'porn', 'nude', 'naked', 'boobs', 'dick', 'cock', 'pussy',
  // Drugs
  'weed', 'cocaine', 'heroin', 'meth', 'drugs',
  // Violence
  'kill', 'murder', 'die', 'death', 'suicide', 'bomb', 'terrorist',
  // Spam/inappropriate
  'admin', 'moderator', 'official', 'support', 'bot', 'null', 'undefined'
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
    // Check if the inappropriate word appears in the normalized text
    return normalized.includes(word);
  });
}

// Fix content filter - too strict on common words
export function validateDisplayName(displayName: string): ValidationResult {
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
  
  // More lenient content check - only block truly inappropriate content
  const normalized = normalizeText(displayName);
  const severeWords = ['fuck', 'shit', 'nazi', 'hitler', 'nigger', 'faggot', 'retard'];
  const hasSevereContent = severeWords.some(word => normalized.includes(word));
  
  if (hasSevereContent) {
    return { isValid: false, error: "Display name contains inappropriate content. Please choose a different name." };
  }
  
  // Check for excessive special characters or numbers
  const specialCharCount = (displayName.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (specialCharCount > displayName.length * 0.5) {
    return { isValid: false, error: "Display name contains too many special characters" };
  }
  
  return { isValid: true };
}