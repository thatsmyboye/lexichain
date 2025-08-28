import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateEmail, validateConsumableId, checkRateLimit, createErrorResponse, logSecurityEvent } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe Product ID mapping
const STRIPE_PRODUCT_IDS = {
  hint_revealer: "prod_SthEhnHmdseZ0n", // Hint Revealer Pack
  score_multiplier: "prod_SthFPxmVVjUmfD", // Score Multiplier Pack  
  hammer: "prod_SthG4SRT642LLF", // Hammer Pack
  extra_moves: "prod_SthGCLvy8W4Hud", // Extra Moves
  bundle_starter: "prod_SthCxac579yETl", // Starter Bundle
  bundle_power: "prod_SthDdoI1YZSCJ6", // Power Bundle
  bundle_ultimate: "prod_SthDObEI5Zyo21" // Ultimate Bundle
};

const CONSUMABLE_QUANTITIES = {
  hint_revealer: 3,
  score_multiplier: 2, 
  hammer: 3,
  extra_moves: 1,
  bundle_starter: { hint_revealer: 5, hammer: 2, score_multiplier: 1 },
  bundle_power: { hint_revealer: 10, hammer: 5, score_multiplier: 3, extra_moves: 2 },
  bundle_ultimate: { hint_revealer: 25, hammer: 15, score_multiplier: 10, extra_moves: 5 }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  
  // Initialize Supabase client first for logging
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  
  try {
    // Rate limiting by IP
    if (!checkRateLimit(`payment-${clientIP}`, 5, 300000)) { // 5 requests per 5 minutes
      await logSecurityEvent("RATE_LIMIT_EXCEEDED", { ip: clientIP, endpoint: "create-payment" }, "WARN", supabaseClient, clientIP, userAgent);
      return createErrorResponse("Too many requests. Please try again later.", 429, corsHeaders);
    }

    await logSecurityEvent("PAYMENT_REQUEST_STARTED", { ip: clientIP }, "INFO", supabaseClient, clientIP, userAgent);
    
    const body = await req.json().catch(() => ({}));
    const { consumableId, guestEmail } = body;
    
    // Validate consumable ID
    if (!validateConsumableId(consumableId)) {
      await logSecurityEvent("INVALID_CONSUMABLE_ID", { consumableId: consumableId?.substring(0, 20), ip: clientIP }, "WARN", supabaseClient, clientIP, userAgent);
      return createErrorResponse("Invalid consumable ID", 400, corsHeaders);
    }

    // Validate Stripe product mapping
    if (!STRIPE_PRODUCT_IDS[consumableId as keyof typeof STRIPE_PRODUCT_IDS]) {
      await logSecurityEvent("MISSING_STRIPE_PRODUCT", { consumableId, ip: clientIP }, "ERROR", supabaseClient, clientIP, userAgent);
      return createErrorResponse("Product not available", 400, corsHeaders);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_PAYMENT") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Supabase client for auth check (anon key for auth only)
    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    let userEmail = guestEmail;
    let userId = null;
    let isAuthenticated = false;

    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseAuthClient.auth.getUser(token);
        if (data.user?.email) {
          userEmail = data.user.email;
          userId = data.user.id;
          isAuthenticated = true;
          await logSecurityEvent("AUTHENTICATED_PURCHASE", { userId, ip: clientIP }, "INFO", supabaseClient, clientIP, userAgent);
        }
      } catch (error) {
        await logSecurityEvent("INVALID_AUTH_TOKEN", { ip: clientIP }, "WARN", supabaseClient, clientIP, userAgent);
      }
    }

    // Validate email for guest purchases
    if (!isAuthenticated) {
      if (!guestEmail) {
        return createErrorResponse("Email is required for guest purchases", 400, corsHeaders);
      }
      
      const emailValidation = validateEmail(guestEmail);
      if (!emailValidation.isValid) {
        await logSecurityEvent("INVALID_GUEST_EMAIL", { email: guestEmail?.substring(0, 10), ip: clientIP }, "WARN", supabaseClient, clientIP, userAgent);
        return createErrorResponse("Invalid email format", 400, corsHeaders);
      }
      
      userEmail = emailValidation.sanitized;
      await logSecurityEvent("GUEST_PURCHASE", { email: userEmail, ip: clientIP }, "INFO", supabaseClient, clientIP, userAgent);
    }

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Found existing customer:", customerId);
    }

    // Get Stripe product ID
    const productId = STRIPE_PRODUCT_IDS[consumableId as keyof typeof STRIPE_PRODUCT_IDS];
    console.log("Using Stripe product:", productId);

    // Get the default price for this product
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1
    });

    if (prices.data.length === 0) {
      throw new Error(`No active price found for product ${productId}`);
    }

    const priceId = prices.data[0].id;
    console.log("Using price:", priceId);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&consumable=${consumableId}&user_id=${userId || 'guest'}`,
      cancel_url: `${req.headers.get("origin")}/payment-canceled`,
      metadata: {
        consumableId,
        userId: userId || 'guest',
        userEmail
      }
    });

    await logSecurityEvent("CHECKOUT_SESSION_CREATED", { 
      sessionId: session.id, 
      userId, 
      consumableId, 
      isAuthenticated, 
      ip: clientIP 
    }, "INFO", supabaseClient, clientIP, userAgent);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    await logSecurityEvent("PAYMENT_CREATION_ERROR", { 
      error: error.message?.substring(0, 100),
      userId,
      consumableId,
      ip: clientIP
    }, "ERROR", supabaseClient, clientIP, userAgent);
    
    return createErrorResponse("Unable to process payment request", 500, corsHeaders);
  }
});