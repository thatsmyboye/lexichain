import { DailyChallengeLeaderboard } from "@/components/leaderboard/DailyChallengeLeaderboard";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export default function LeaderboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Leaderboards</h1>
          <p className="text-muted-foreground">
            See how you stack up against other players
          </p>
        </div>
        
        <DailyChallengeLeaderboard currentUser={user} />
        
        <div className="text-center mt-8 space-y-4 sm:space-y-0 sm:flex sm:gap-4 sm:justify-center">
          {user && (
            <Button variant="outline" onClick={() => navigate("/account")}>
              👤 My Account
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate("/")}>
            🏠 Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}