import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeRewardsRequest {
  target_year?: number;
  target_month?: number;
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

    const { target_year, target_month }: DistributeRewardsRequest = await req.json().catch(() => ({}));
    
    // Default to previous month if no target provided
    let year: number;
    let month: number;
    
    if (target_year && target_month) {
      year = target_year;
      month = target_month;
    } else {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      year = previousMonth.getFullYear();
      month = previousMonth.getMonth() + 1; // JavaScript months are 0-indexed
    }

    console.log(`Distributing monthly rewards for: ${year}-${month.toString().padStart(2, '0')}`);

    // Call the database function to distribute rewards
    const { data, error } = await supabase.rpc('distribute_monthly_leaderboard_rewards', {
      target_year: year,
      target_month: month
    });

    if (error) {
      console.error('Error distributing monthly rewards:', error);
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

    console.log('Monthly rewards distribution result:', data);

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
    console.error('Error in distribute-monthly-rewards function:', error);
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