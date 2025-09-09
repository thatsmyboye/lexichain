import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeRewardsRequest {
  target_week_start?: string; // Optional, defaults to previous week
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

    const { target_week_start }: DistributeRewardsRequest = await req.json().catch(() => ({}));
    
    // Default to previous week start if no target_week_start provided
    let weekStart: string;
    if (target_week_start) {
      weekStart = target_week_start;
    } else {
      // Calculate previous week start (Sunday)
      const now = new Date();
      const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToSubtract = currentDayOfWeek + 7; // Go back to previous Sunday
      const previousWeekStart = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
      weekStart = previousWeekStart.toISOString().split('T')[0];
    }

    console.log(`Distributing weekly rewards for week starting: ${weekStart}`);

    // Call the database function to distribute rewards
    const { data, error } = await supabase.rpc('distribute_weekly_leaderboard_rewards', {
      target_week_start: weekStart
    });

    if (error) {
      console.error('Error distributing weekly rewards:', error);
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

    console.log('Weekly rewards distribution result:', data);

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
    console.error('Error in distribute-weekly-rewards function:', error);
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