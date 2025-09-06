import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import type { LoginStreakData } from "@/hooks/useLoginStreak";

interface TitleScreenProps {
  onPlayClick: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onStatsClick: () => void;
  onStoreClick: () => void;
  onLeaderboardClick: () => void;
  streakData?: LoginStreakData | null;
  user?: User | null;
}
const TitleScreen = ({
  onPlayClick,
  onLoginClick,
  onRegisterClick,
  onStatsClick,
  onStoreClick,
  onLeaderboardClick,
  streakData,
  user: propUser
}: TitleScreenProps) => {
  const [user, setUser] = useState<User | null>(propUser || null);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Unexpected logout error:', error);
    }
  };
  useEffect(() => {
    if (propUser !== undefined) {
      setUser(propUser);
      return;
    }

    // Set up auth state listener
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    // Check for existing session
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [propUser]);
  return <div className="h-screen flex flex-col items-center bg-gradient-to-br from-background to-muted relative px-4">
      {/* Mobile: Compact layout with justify-between */}
      <div className="md:hidden h-full flex flex-col items-center justify-between py-[24px]">
        <div></div> {/* Top spacer */}
        
          <div className="text-center space-y-6 max-w-sm flex-shrink-0">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Lexichain
            </h1>
            
            {user && streakData && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                🔥 {streakData.currentStreak} day streak!
              </div>
            )}
          
          <div className="flex items-center justify-center gap-3">
            <Button variant="hero" size="lg" onClick={onPlayClick} className="px-6">
              Play
            </Button>
            <Button variant="outline" size="lg" onClick={user ? handleLogout : onLoginClick} className="px-6">
              {user ? 'Log Out' : 'Login'}
            </Button>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <Button variant="outline" size="lg" onClick={onStoreClick} className="px-6">
              🛒 Store
            </Button>
            
            {user && (
              <>
                <Button variant="outline" size="lg" onClick={onStatsClick} className="px-6">
                  📊 Stats
                </Button>
                <Button variant="outline" size="lg" onClick={onLeaderboardClick} className="px-6">
                  🏆 Leaderboards
                </Button>
              </>
            )}
          </div>
          
          {!user && (
            <div className="text-center">
              <button onClick={onRegisterClick} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Register
              </button>
            </div>
          )}
        </div>
        
        <div></div> {/* Bottom spacer for footer */}
      </div>

      {/* Desktop: Centered layout with generous spacing */}
      <div className="hidden md:flex h-full flex-col items-center justify-center">
          <div className="text-center space-y-8 max-w-none">
            <h1 className="text-6xl lg:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Lexichain
            </h1>
            
            {user && streakData && (
              <div className="text-lg text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
                🔥 {streakData.currentStreak} day streak!
              </div>
            )}
          
          <div className="flex items-center justify-center gap-4">
            <Button variant="hero" size="lg" onClick={onPlayClick} className="px-8">
              Play
            </Button>
            <Button variant="outline" size="lg" onClick={user ? handleLogout : onLoginClick} className="px-8">
              {user ? 'Log Out' : 'Login'}
            </Button>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <Button variant="outline" size="lg" onClick={onStoreClick} className="px-8">
              🛒 Store
            </Button>
            
            {user && (
              <>
                <Button variant="outline" size="lg" onClick={onStatsClick} className="px-8">
                  📊 Stats
                </Button>
                <Button variant="outline" size="lg" onClick={onLeaderboardClick} className="px-8">
                  🏆 Leaderboards
                </Button>
              </>
            )}
          </div>
          
          {!user && (
            <div className="text-center">
              <button onClick={onRegisterClick} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Register
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Version and Copyright footer */}
      <footer className="absolute bottom-2 md:bottom-6 text-center text-xs text-muted-foreground space-y-1">
        
        <div>© {new Date().getFullYear()} Banton Games. All rights reserved.</div>
      </footer>
    </div>;
};
export default TitleScreen;
