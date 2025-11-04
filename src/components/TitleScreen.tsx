import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import type { LoginStreakData } from "@/hooks/useLoginStreak";
import { getDailyChallengeDate } from "@/utils/dateUtils";
import { checkIncompleteGameState } from "@/utils/gameStateUtils";
import { InteractiveTutorial } from "@/components/tutorial/InteractiveTutorial";
import { SoundButton } from "@/components/effects/SoundSystem";
import { BookOpen, Settings, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
interface TitleScreenProps {
  onPlayClick: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onStatsClick: () => void;
  onStoreClick: () => void;
  onLeaderboardClick: () => void;
  onSettingsClick?: () => void;
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
  onSettingsClick,
  streakData,
  user: propUser
}: TitleScreenProps) => {
  const [user, setUser] = useState<User | null>(propUser || null);
  const [hasIncompleteChallenge, setHasIncompleteChallenge] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState<{
    score: number;
    movesUsed: number;
    lastSaved?: number;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      const {
        error
      } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Unexpected logout error:', error);
    }
  };
  // Enhanced state validation with progressive recovery
  useEffect(() => {
    const checkIncompleteChallenge = () => {
      const today = getDailyChallengeDate();
      const gameInfo = checkIncompleteGameState(today);
      setHasIncompleteChallenge(gameInfo.hasIncompleteGame);
      setChallengeProgress(gameInfo.progress || null);
    };
    checkIncompleteChallenge();

    // Check periodically in case state changes
    const interval = setInterval(checkIncompleteChallenge, 5000);
    return () => clearInterval(interval);
  }, []);
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

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        setIsAdmin(!!data);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [user]);
  return <div className="h-screen flex flex-col items-center bg-gradient-to-br from-background to-muted relative px-4">
      {/* Mobile: Compact layout with justify-between */}
      <div className="md:hidden h-full flex flex-col items-center justify-between py-[24px]">
        <div></div> {/* Top spacer */}
        
          <div className="text-center space-y-6 max-w-sm flex-shrink-0">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Lexichain
            </h1>
            
            {user && streakData && <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                🔥 {streakData.currentStreak} day streak!
              </div>}
            
            {hasIncompleteChallenge && challengeProgress && <div className="bg-accent/20 border border-accent/40 rounded-lg px-3 py-2 text-sm">
                <div className="text-accent-foreground font-medium">Daily Challenge in Progress</div>
                <div className="text-muted-foreground">
                  Score: {challengeProgress.score} • Moves: {challengeProgress.movesUsed}
                  {challengeProgress.lastSaved && <div className="text-xs mt-1">
                      Last saved: {new Date(challengeProgress.lastSaved).toLocaleTimeString()}
                    </div>}
                </div>
              </div>}
          
          <div className="flex items-center justify-center gap-3">
            <SoundButton variant={hasIncompleteChallenge ? "default" : "hero"} size="lg" onClick={onPlayClick} className="px-6">
              {hasIncompleteChallenge ? "Resume Daily Challenge" : "Play"}
            </SoundButton>
            <SoundButton variant="outline" size="lg" onClick={user ? handleLogout : onLoginClick} className="px-6">
              {user ? 'Log Out' : 'Login'}
            </SoundButton>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <SoundButton variant="outline" size="lg" onClick={onStoreClick} className="px-6">
              🛒 Store
            </SoundButton>
            
            {user && <>
                <SoundButton variant="outline" size="lg" onClick={onStatsClick} className="px-6">
                  📊 Stats
                </SoundButton>
                <SoundButton variant="outline" size="lg" onClick={onLeaderboardClick} className="px-6">
                  🏆 Leaderboards
                </SoundButton>
                {isAdmin && (
                  <SoundButton 
                    variant="outline" 
                    size="lg" 
                    onClick={() => navigate('/admin')} 
                    className="px-6 border-primary/50 hover:border-primary"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </SoundButton>
                )}
              </>}
            
            <div className="flex gap-2 mt-2">
              <SoundButton variant="ghost" size="sm" onClick={() => {}} className="px-3">
                <BookOpen className="h-4 w-4 mr-1" />
                Tutorial
              </SoundButton>
              {onSettingsClick && (
                <SoundButton variant="ghost" size="sm" onClick={onSettingsClick} className="px-3">
                  <Settings className="h-4 w-4" />
                </SoundButton>
              )}
            </div>
          </div>
          
          {!user && <div className="text-center">
              <button onClick={onRegisterClick} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Register
              </button>
            </div>}
        </div>
        
        <div></div> {/* Bottom spacer for footer */}
      </div>

      {/* Desktop: Centered layout with generous spacing */}
      <div className="hidden md:flex h-full flex-col items-center justify-center">
          <div className="text-center space-y-8 max-w-none">
            <h1 className="text-6xl lg:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Lexichain
            </h1>
            
            {user && streakData && <div className="text-lg text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
                🔥 {streakData.currentStreak} day streak!
              </div>}
            
            {hasIncompleteChallenge && challengeProgress && <div className="bg-accent/20 border border-accent/40 rounded-lg px-4 py-3">
                <div className="text-accent-foreground font-medium text-lg">Daily Challenge in Progress</div>
                
              </div>}
          
          <div className="flex items-center justify-center gap-4">
            <SoundButton variant={hasIncompleteChallenge ? "default" : "hero"} size="lg" onClick={onPlayClick} className="px-8">
              {hasIncompleteChallenge ? "Resume Daily Challenge" : "Play"}
            </SoundButton>
            <SoundButton variant="outline" size="lg" onClick={user ? handleLogout : onLoginClick} className="px-8">
              {user ? 'Log Out' : 'Login'}
            </SoundButton>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <SoundButton variant="outline" size="lg" onClick={onStoreClick} className="px-8">
              🛒 Store
            </SoundButton>
            
            {user && <>
                <SoundButton variant="outline" size="lg" onClick={onStatsClick} className="px-8">
                  📊 Stats
                </SoundButton>
                <SoundButton variant="outline" size="lg" onClick={onLeaderboardClick} className="px-8">
                  🏆 Leaderboards
                </SoundButton>
                {isAdmin && (
                  <SoundButton 
                    variant="outline" 
                    size="lg" 
                    onClick={() => navigate('/admin')} 
                    className="px-8 border-primary/50 hover:border-primary"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin Dashboard
                  </SoundButton>
                )}
              </>}
            
            <div className="flex gap-3 mt-2">
              <SoundButton variant="ghost" size="sm" onClick={() => {}} className="px-4">
                <BookOpen className="h-4 w-4 mr-2" />
                Tutorial
              </SoundButton>
              {onSettingsClick && (
                <SoundButton variant="ghost" size="sm" onClick={onSettingsClick} className="px-4">
                  <Settings className="h-4 w-4" />
                </SoundButton>
              )}
            </div>
          </div>
          
          {!user && <div className="text-center">
              <button onClick={onRegisterClick} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Register
              </button>
            </div>}
        </div>
      </div>
      
      {/* Version and Copyright footer */}
      <footer className="absolute bottom-2 md:bottom-6 text-center text-xs text-muted-foreground space-y-1">
        
        <div>© {new Date().getFullYear()} Banton Games. All rights reserved.</div>
      </footer>
      
      {/* Interactive Tutorial - Hidden for now but retained for later use */}
      {/* <InteractiveTutorial /> */}
    </div>;
};
export default TitleScreen;