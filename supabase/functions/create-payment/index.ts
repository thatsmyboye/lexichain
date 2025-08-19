import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Consumable pricing in USD cents
const CONSUMABLE_PRICES = {
  hint_revealer: 99, // $0.99
  score_multiplier: 199, // $1.99
  letter_shuffle: 79, // $0.79
  extra_moves: 299, // $2.99
  bundle_starter: 499, // $4.99 - 5 hints, 2 shuffles, 1 multiplier
  bundle_power: 999, // $9.99 - 10 hints, 5 shuffles, 3 multipliers, 2 extra moves
  bundle_ultimate: 1999 // $19.99 - 25 hints, 15 shuffles, 10 multipliers, 5 extra moves
};

const CONSUMABLE_QUANTITIES = {
  hint_revealer: 1,
  score_multiplier: 1, 
  letter_shuffle: 1,
  extra_moves: 1,
  bundle_starter: { hint_revealer: 5, letter_shuffle: 2, score_multiplier: 1 },
  bundle_power: { hint_revealer: 10, letter_shuffle: 5, score_multiplier: 3, extra_moves: 2 },
  bundle_ultimate: { hint_revealer: 25, letter_shuffle: 15, score_multiplier: 10, extra_moves: 5 }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing payment request");
    
    const { consumableId, guestEmail } = await req.json();
    
    if (!consumableId || !CONSUMABLE_PRICES[consumableId as keyof typeof CONSUMABLE_PRICES]) {
      throw new Error("Invalid consumable ID");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_PAYMENT") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Supabase client for auth check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    let userEmail = guestEmail;
    let userId = null;

    // Check if user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseClient.auth.getUser(token);
        if (data.user?.email) {
          userEmail = data.user.email;
          userId = data.user.id;
          console.log("Authenticated user:", userEmail);
        }
      } catch (error) {
        console.log("No valid auth token, proceeding as guest");
      }
    }

    if (!userEmail) {
      throw new Error("Email is required for purchase");
    }

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Found existing customer:", customerId);
    }

    // Get product details
    const price = CONSUMABLE_PRICES[consumableId as keyof typeof CONSUMABLE_PRICES];
    const productName = consumableId.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: `${productName} - Word Game Consumable`,
              description: `Enhance your word game experience with ${productName.toLowerCase()}`
            },
            unit_amount: price,
          },
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

    console.log("Created checkout session:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});