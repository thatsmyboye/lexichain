import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeRewardsRequest {
  target_date?: string; // Optional, defaults to previous day
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { target_date }: DistributeRewardsRequest = await req.json().catch(() => ({}));
    
    // Default to previous day if no target_date provided
    const targetDate = target_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Distributing daily rewards for date: ${targetDate}`);

    // Call the database function to distribute rewards
    const { data, error } = await supabase.rpc('distribute_daily_leaderboard_rewards', {
      target_date: targetDate
    });

    if (error) {
      console.error('Error distributing daily rewards:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log('Daily rewards distribution result:', data);

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in distribute-daily-rewards function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);