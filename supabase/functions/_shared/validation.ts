// Shared validation utilities for edge functions

// Email validation with security considerations
export function validateEmail(email: string): { isValid: boolean; sanitized: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, sanitized: '' };
  }
  
  // Sanitize email (trim whitespace, convert to lowercase)
  const sanitized = email.trim().toLowerCase();
  
  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isValid = emailRegex.test(sanitized) && sanitized.length <= 254; // RFC limit
  
  return { isValid, sanitized };
}

// Session ID validation (UUID format expected from Stripe)
export function validateSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  
  // Stripe session IDs start with 'cs_' followed by base64-like characters
  const sessionIdRegex = /^cs_[A-Za-z0-9_-]{40,}$/;
  return sessionIdRegex.test(sessionId) && sessionId.length <= 200;
}

// Consumable ID validation
export function validateConsumableId(consumableId: string): boolean {
  const validConsumables = [
    'hint_revealer', 'score_multiplier', 'hammer', 'extra_moves',
    'bundle_starter', 'bundle_power', 'bundle_ultimate'
  ];
  
  return typeof consumableId === 'string' && 
         validConsumables.includes(consumableId) &&
         consumableId.length <= 50;
}

// Rate limiting helper (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean old entries
  for (const [key, value] of requestCounts.entries()) {
    if (value.resetTime < windowStart) {
      requestCounts.delete(key);
    }
  }
  
  const current = requestCounts.get(identifier);
  if (!current) {
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

// Secure error response helper
export function createErrorResponse(message: string, status: number = 400, corsHeaders: Record<string, string>) {
  // Sanitize error message to prevent information leakage
  const sanitizedMessage = typeof message === 'string' ? 
    message.replace(/[<>]/g, '') : 'Invalid request';
  
  return new Response(
    JSON.stringify({ error: sanitizedMessage }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

// Security audit logging - now using database
export async function logSecurityEvent(
  event: string, 
  details: Record<string, any>, 
  level: 'INFO' | 'WARN' | 'ERROR' = 'INFO',
  supabase?: any,
  clientIP?: string,
  userAgent?: string
) {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.substring(0, 100) : value
    ])
  );
  
  // Always log to console for immediate debugging
  console.log(`[SECURITY-${level}] ${timestamp} - ${event}`, sanitizedDetails);
  
  // If supabase client is provided, log to database
  if (supabase) {
    try {
      await supabase
        .from('security_audit_log')
        .insert({
          event_type: event,
          event_level: level,
          event_details: sanitizedDetails,
          user_id: details.userId || null,
          client_ip: clientIP || null,
          user_agent: userAgent || null
        });
    } catch (error) {
      console.error('Failed to log security event to database:', error);
    }
  }
}