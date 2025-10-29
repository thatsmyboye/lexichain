import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Verifying payment");
    
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_PAYMENT") || "", {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase with service role for writing
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get session details from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log("Retrieved session:", session.id, "Status:", session.payment_status);

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ success: false, message: "Payment not completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { consumableId, userId, userEmail } = session.metadata || {};
    
    if (!consumableId || !userEmail) {
      throw new Error("Missing payment metadata");
    }

    // If user is not guest, award consumables to their account
    if (userId && userId !== 'guest') {
      console.log("Awarding consumables to user:", userId);
      
      // Handle special unlock items
      if (consumableId === 'unlock_all_modes') {
        console.log("Unlocking all advanced game modes for user:", userId);
        
        // Unlock all advanced game modes
        const allAdvancedModes = ['time_attack', 'endless', 'puzzle', 'survival', 'zen'];
        
        for (const modeId of allAdvancedModes) {
          // Check if user already has this mode unlocked
          const { data: existing } = await supabase
            .from('user_unlocked_modes')
            .select('id')
            .eq('user_id', userId)
            .eq('mode_id', modeId)
            .single();

          if (!existing) {
            // Insert new unlocked mode
            await supabase
              .from('user_unlocked_modes')
              .insert({
                user_id: userId,
                mode_id: modeId,
                unlocked_at: new Date().toISOString(),
                source: `stripe_purchase_${sessionId}`
              });
          }
        }
        
        console.log(`Successfully unlocked all advanced game modes for user ${userId}`);
      } else {
        // Determine what to award for consumables
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

        // Award each consumable
        for (const award of awards) {
          // Check if user already has this consumable
          const { data: existing } = await supabase
            .from('user_consumables')
            .select('quantity')
            .eq('user_id', userId)
            .eq('consumable_id', award.consumable_id)
            .single();

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

        console.log(`Successfully awarded ${awards.length} consumable types to user ${userId}`);
      }
    }

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
    console.error("Payment verification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});