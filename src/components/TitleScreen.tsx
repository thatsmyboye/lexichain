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
import { FloatingTiles } from "@/components/effects/FloatingTiles";
interface TitleScreenProps {
  onPlayClick: () => void;
  onAdvancedModesClick?: () => void;
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
  onAdvancedModesClick,
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
    if (!user) {
      setHasIncompleteChallenge(false);
      setChallengeProgress(null);
      return;
    }
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
  }, [user]);
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
  const [floatingTilesEnabled] = useState(() => {
    return localStorage.getItem('lexichain-floating-tiles') !== 'false';
  });

  return <div className="h-screen flex flex-col items-center bg-gradient-to-br from-background via-muted/30 to-background relative px-4 overflow-hidden">
      {/* Background: floating tiles or default gradient blobs */}
      {floatingTilesEnabled ? (
        <FloatingTiles />
      ) : (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        </div>
      )}

      {/* Mobile: Compact layout with justify-between */}
      <div className="md:hidden h-full flex flex-col items-center justify-between py-[24px] relative z-10">
        <div></div> {/* Top spacer */}

          <div className="text-center space-y-6 max-w-sm flex-shrink-0">
            <div className="relative">
              <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))] drop-shadow-lg animate-in fade-in slide-in-from-top duration-700">
                Lexichain
              </h1>
              <div className="absolute -inset-6 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-500)/0.18),transparent_70%)] blur-2xl -z-10"></div>
            </div>
            
            {user && streakData && <div className="text-sm font-medium bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400 rounded-lg px-4 py-2.5 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-bottom duration-500">
                <span className="inline-block animate-pulse">🔥</span> {streakData.currentStreak} day streak!
              </div>}

            {hasIncompleteChallenge && challengeProgress && <div className="bg-gradient-to-br from-accent/30 via-accent/20 to-accent/10 border border-accent/50 rounded-lg px-4 py-3 text-sm shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-500 delay-150">
                <div className="text-accent-foreground font-semibold flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  Daily Challenge in Progress
                </div>
                <div className="text-muted-foreground mt-1.5 flex items-center gap-3">
                  <span className="font-medium">Score: <span className="text-foreground">{challengeProgress.score}</span></span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="font-medium">Moves: <span className="text-foreground">{challengeProgress.movesUsed}</span></span>
                </div>
                {challengeProgress.lastSaved && <div className="text-xs mt-1.5 text-muted-foreground/70">
                    Last saved: {new Date(challengeProgress.lastSaved).toLocaleTimeString()}
                  </div>}
              </div>}
          
          <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
            <div className="flex items-center justify-center gap-3">
              <SoundButton
                variant={hasIncompleteChallenge ? "default" : "hero"}
                size="lg"
                onClick={onPlayClick}
                className="px-8 py-6 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {hasIncompleteChallenge ? "Resume Daily Challenge" : "Play"}
              </SoundButton>
              <SoundButton
                variant="outline"
                size="lg"
                onClick={user ? handleLogout : onLoginClick}
                className="px-6 hover:bg-muted/80 transition-all duration-300"
              >
                {user ? 'Log Out' : 'Login'}
              </SoundButton>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2.5 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
            <SoundButton
              variant="outline"
              size="lg"
              onClick={onStoreClick}
              className="px-6 hover:bg-gradient-to-r hover:from-brand-500/10 hover:to-brand-600/10 hover:border-brand-500/50 transition-all duration-300"
            >
              🛒 Store
            </SoundButton>
            
            {user && <>
                <SoundButton
                  variant="outline"
                  size="lg"
                  onClick={onStatsClick}
                  className="px-6 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-blue-600/10 hover:border-blue-500/50 transition-all duration-300"
                >
                  📊 Stats
                </SoundButton>
                <SoundButton
                  variant="outline"
                  size="lg"
                  onClick={onLeaderboardClick}
                  className="px-6 hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-yellow-600/10 hover:border-yellow-500/50 transition-all duration-300"
                >
                  🏆 Leaderboards
                </SoundButton>
                {isAdmin && (
                  <SoundButton
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/admin')}
                    className="px-6 border-primary/50 hover:border-primary hover:bg-primary/10 transition-all duration-300"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </SoundButton>
                )}
              </>}

            <div className="flex gap-2 mt-2">
              <SoundButton
                variant="ghost"
                size="sm"
                onClick={() => {}}
                className="px-3 hover:bg-brand-500/10 transition-all duration-300"
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Tutorial
              </SoundButton>
              {onSettingsClick && (
                <SoundButton
                  variant="ghost"
                  size="sm"
                  onClick={onSettingsClick}
                  className="px-3 hover:bg-brand-500/10 transition-all duration-300"
                >
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
      <div className="hidden md:flex h-full flex-col items-center justify-center relative z-10">
          <div className="text-center space-y-8 max-w-none">
            <div className="relative">
              <h1 className="text-7xl lg:text-9xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))] drop-shadow-2xl animate-in fade-in slide-in-from-top duration-700">
                Lexichain
              </h1>
              <div className="absolute -inset-2 bg-gradient-to-r from-brand-400/20 to-brand-600/20 blur-2xl -z-10"></div>
            </div>

            {user && streakData && <div className="text-base font-medium bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-600 dark:text-orange-400 rounded-lg px-6 py-3.5 backdrop-blur-sm shadow-lg inline-block animate-in fade-in slide-in-from-bottom duration-500">
                <span className="inline-block animate-pulse text-xl mr-1">🔥</span> {streakData.currentStreak} day streak!
              </div>}

            {hasIncompleteChallenge && challengeProgress && <div className="bg-gradient-to-br from-accent/30 via-accent/20 to-accent/10 border border-accent/50 rounded-lg px-6 py-4 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-500 delay-150">
                <div className="text-accent-foreground font-semibold text-lg flex items-center justify-center gap-2">
                  <span className="text-2xl">⚡</span>
                  Daily Challenge in Progress
                </div>
                <div className="text-muted-foreground mt-2 flex items-center justify-center gap-3">
                  <span className="font-medium">Score: <span className="text-foreground">{challengeProgress.score}</span></span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="font-medium">Moves: <span className="text-foreground">{challengeProgress.movesUsed}</span></span>
                </div>
                {challengeProgress.lastSaved && <div className="text-xs mt-2 text-center text-muted-foreground/70">
                    Last saved: {new Date(challengeProgress.lastSaved).toLocaleTimeString()}
                  </div>}
              </div>}
          
          <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
            <div className="flex items-center justify-center gap-4">
              <SoundButton
                variant={hasIncompleteChallenge ? "default" : "hero"}
                size="lg"
                onClick={onPlayClick}
                className="px-12 py-6 text-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                {hasIncompleteChallenge ? "Resume Daily Challenge" : "Play"}
              </SoundButton>
              <SoundButton
                variant="outline"
                size="lg"
                onClick={user ? handleLogout : onLoginClick}
                className="px-8 hover:bg-muted/80 transition-all duration-300"
              >
                {user ? 'Log Out' : 'Login'}
              </SoundButton>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
            <SoundButton
              variant="outline"
              size="lg"
              onClick={onStoreClick}
              className="px-8 hover:bg-gradient-to-r hover:from-brand-500/10 hover:to-brand-600/10 hover:border-brand-500/50 transition-all duration-300"
            >
              🛒 Store
            </SoundButton>

            {user && <>
                <SoundButton
                  variant="outline"
                  size="lg"
                  onClick={onStatsClick}
                  className="px-8 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-blue-600/10 hover:border-blue-500/50 transition-all duration-300"
                >
                  📊 Stats
                </SoundButton>
                <SoundButton
                  variant="outline"
                  size="lg"
                  onClick={onLeaderboardClick}
                  className="px-8 hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-yellow-600/10 hover:border-yellow-500/50 transition-all duration-300"
                >
                  🏆 Leaderboards
                </SoundButton>
                {isAdmin && (
                  <SoundButton
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/admin')}
                    className="px-8 border-primary/50 hover:border-primary hover:bg-primary/10 transition-all duration-300"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Admin Dashboard
                  </SoundButton>
                )}
              </>}

            <div className="flex gap-3 mt-2">
              <SoundButton
                variant="ghost"
                size="sm"
                onClick={() => {}}
                className="px-4 hover:bg-brand-500/10 transition-all duration-300"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Tutorial
              </SoundButton>
              {onSettingsClick && (
                <SoundButton
                  variant="ghost"
                  size="sm"
                  onClick={onSettingsClick}
                  className="px-4 hover:bg-brand-500/10 transition-all duration-300"
                >
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