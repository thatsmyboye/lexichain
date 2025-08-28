import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateSessionId, validateConsumableId, checkRateLimit, createErrorResponse, logSecurityEvent } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bundle quantities mapping
const BUNDLE_QUANTITIES = {
  bundle_starter: { hint_revealer: 5, hammer: 2, score_multiplier: 1 },
  bundle_power: { hint_revealer: 10, hammer: 5, score_multiplier: 3, extra_moves: 2 },
  bundle_ultimate: { hint_revealer: 25, hammer: 15, score_multiplier: 10, extra_moves: 5 }
};

// Track processed sessions to prevent replay attacks
const processedSessions = new Set<string>();

// Maximum quantities validation
const MAX_CONSUMABLE_QUANTITIES = {
  hint_revealer: 100,
  score_multiplier: 50,
  hammer: 100,
  extra_moves: 50
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Initialize Supabase with service role for writing and logging
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let sessionId: string | undefined = undefined;

  try {
    // Rate limiting
    if (!checkRateLimit(`verify-${clientIP}`, 10, 300000)) { // 10 verifications per 5 minutes
      await logSecurityEvent("RATE_LIMIT_EXCEEDED", { ip: clientIP, endpoint: "verify-payment" }, "WARN", supabase, clientIP, userAgent);
      return createErrorResponse("Too many verification attempts", 429, corsHeaders);
    }

    await logSecurityEvent("PAYMENT_VERIFICATION_STARTED", { ip: clientIP }, "INFO", supabase, clientIP, userAgent);
    
    const body = await req.json().catch(() => ({}));
    sessionId = body.sessionId;
    
    // Validate session ID format
    if (!validateSessionId(sessionId)) {
      await logSecurityEvent("INVALID_SESSION_ID_FORMAT", { 
        sessionId: sessionId?.substring(0, 20), 
        ip: clientIP 
      }, "WARN", supabase, clientIP, userAgent);
      return createErrorResponse("Invalid session ID format", 400, corsHeaders);
    }

    // Check for replay attacks
    if (processedSessions.has(sessionId)) {
      await logSecurityEvent("REPLAY_ATTACK_DETECTED", { sessionId, ip: clientIP }, "ERROR", supabase, clientIP, userAgent);
      return createErrorResponse("Session already processed", 400, corsHeaders);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_PAYMENT") || "", {
      apiVersion: "2023-10-16",
    });

    // Get session details from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    await logSecurityEvent("STRIPE_SESSION_RETRIEVED", { 
      sessionId: session.id, 
      status: session.payment_status,
      ip: clientIP 
    }, "INFO", supabase, clientIP, userAgent);

    if (session.payment_status !== "paid") {
      await logSecurityEvent("UNPAID_SESSION_VERIFICATION", { 
        sessionId, 
        status: session.payment_status,
        ip: clientIP 
      }, "WARN", supabase, clientIP, userAgent);
      return new Response(JSON.stringify({ success: false, message: "Payment not completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { consumableId, userId, userEmail } = session.metadata || {};
    
    if (!consumableId || !userEmail) {
      await logSecurityEvent("MISSING_SESSION_METADATA", { sessionId, ip: clientIP }, "ERROR", supabase, clientIP, userAgent);
      return createErrorResponse("Invalid session metadata", 400, corsHeaders);
    }

    // Validate consumable ID from session metadata
    if (!validateConsumableId(consumableId)) {
      await logSecurityEvent("INVALID_CONSUMABLE_IN_SESSION", { 
        consumableId, 
        sessionId, 
        ip: clientIP 
      }, "ERROR", supabase, clientIP, userAgent);
      return createErrorResponse("Invalid consumable in session", 400, corsHeaders);
    }

    // If user is not guest, award consumables to their account
    if (userId && userId !== 'guest') {
      console.log("Awarding consumables to user:", userId);
      
      // Determine what to award
      let awards = [];
      
      if (consumableId.startsWith('bundle_')) {
        // Handle bundles
        const bundleItems = BUNDLE_QUANTITIES[consumableId as keyof typeof BUNDLE_QUANTITIES];
        if (bundleItems) {
          for (const [itemId, quantity] of Object.entries(bundleItems)) {
            awards.push({ consumable_id: itemId, quantity });
          }
        }
      } else {
        // Single consumable - award the pack quantity
        const quantities = {
          hint_revealer: 3,
          score_multiplier: 2,
          hammer: 3,
          extra_moves: 1
        };
        awards.push({ consumable_id: consumableId, quantity: quantities[consumableId as keyof typeof quantities] || 1 });
      }

      // Award each consumable with quantity validation
      for (const award of awards) {
        // Validate quantity limits
        const maxAllowed = MAX_CONSUMABLE_QUANTITIES[award.consumable_id as keyof typeof MAX_CONSUMABLE_QUANTITIES] || 10;
        if (award.quantity > maxAllowed) {
          await logSecurityEvent("EXCESSIVE_QUANTITY_DETECTED", {
            consumableId: award.consumable_id,
            quantity: award.quantity,
            maxAllowed,
            sessionId,
            userId,
            ip: clientIP
          }, "ERROR", supabase, clientIP, userAgent);
          continue; // Skip this award
        }

        // Check if user already has this consumable
        const { data: existing } = await supabase
          .from('user_consumables')
          .select('quantity')
          .eq('user_id', userId)
          .eq('consumable_id', award.consumable_id)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from('user_consumables')
            .update({ 
              quantity: existing.quantity + award.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('consumable_id', award.consumable_id);
        } else {
          // Insert new
          await supabase
            .from('user_consumables')
            .insert({
              user_id: userId,
              consumable_id: award.consumable_id,
              quantity: award.quantity
            });
        }

        // Record transaction
        await supabase
          .from('consumable_transactions')
          .insert({
            user_id: userId,
            consumable_id: award.consumable_id,
            quantity: award.quantity,
            transaction_type: 'earned',
            source: `stripe_purchase_${sessionId}`
          });
      }

      await logSecurityEvent("CONSUMABLES_AWARDED", { 
        userId, 
        awards: awards.length, 
        consumableId, 
        sessionId,
        ip: clientIP 
      }, "INFO", supabase, clientIP, userAgent);
    } else {
      await logSecurityEvent("GUEST_PURCHASE_VERIFIED", { 
        userEmail, 
        consumableId, 
        sessionId,
        ip: clientIP 
      }, "INFO", supabase, clientIP, userAgent);
    }

    // Mark session as processed to prevent replay attacks
    processedSessions.add(sessionId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Payment verified and consumables awarded",
      consumableId,
      userId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    await logSecurityEvent("PAYMENT_VERIFICATION_ERROR", { 
      error: error.message?.substring(0, 100),
      sessionId: sessionId || "unknown",
      ip: clientIP
    }, "ERROR", supabase, clientIP, userAgent);
    
    return createErrorResponse("Payment verification failed", 500, corsHeaders);
  }
});