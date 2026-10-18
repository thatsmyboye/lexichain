import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import type { LoginStreakData } from "@/hooks/useLoginStreak";
import { SoundButton } from "@/components/effects/SoundSystem";
import { BarChart3, GraduationCap, LayoutGrid, LogIn, LogOut, Medal, Settings, Shield, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FloatingTiles, useFloatingTilesEnabled } from "@/components/effects/FloatingTiles";
import { Logo } from "@/components/brand/Logo";
import { DailyHub } from "@/components/daily/DailyHub";
import type { DailyGameMode } from "@/lib/gameModes";
import { cn } from "@/lib/utils";

interface TitleScreenProps {
  onPlayClick: () => void;
  onAdvancedModesClick?: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onStatsClick: () => void;
  onLeaderboardClick: () => void;
  onSettingsClick?: () => void;
  /** Start or resume today's Daily / Daily 5x5. Falls back to onPlayClick (mode select). */
  onPlayDaily?: (mode: DailyGameMode) => void;
  onTutorialClick?: () => void;
  streakData?: LoginStreakData | null;
  user?: User | null;
}
const TitleScreen = ({
  onPlayClick,
  onAdvancedModesClick,
  onLoginClick,
  onRegisterClick,
  onStatsClick,
  onLeaderboardClick,
  onSettingsClick,
  onPlayDaily,
  onTutorialClick,
  streakData,
  user: propUser
}: TitleScreenProps) => {
  const [user, setUser] = useState<User | null>(propUser || null);
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
  // Respects both the Settings toggle and prefers-reduced-motion.
  const floatingTilesEnabled = useFloatingTilesEnabled();

  const secondaryActions: { key: string; label: string; icon: ReactNode; onClick: () => void; className?: string }[] = [
    ...(user ? [
      { key: "stats", label: "Stats", icon: <BarChart3 />, onClick: onStatsClick },
      { key: "leaderboards", label: "Leaderboards", icon: <Medal />, onClick: onLeaderboardClick },
    ] : []),
    { key: "trophies", label: "Trophies", icon: <Trophy />, onClick: () => navigate("/trophies") },
    ...(onTutorialClick ? [{ key: "tutorial", label: "Tutorial", icon: <GraduationCap />, onClick: onTutorialClick }] : []),
    ...(onSettingsClick ? [{ key: "settings", label: "Settings", icon: <Settings />, onClick: onSettingsClick }] : []),
    ...(isAdmin ? [{
      key: "admin",
      label: "Admin",
      icon: <Shield />,
      onClick: () => navigate("/admin"),
      className: "border-primary/50 hover:border-primary hover:bg-primary/10",
    }] : []),
  ];

  return <main className="min-h-[100dvh] flex flex-col items-center bg-gradient-to-br from-background via-muted/30 to-background relative px-4 overflow-x-hidden">
      {/* Background: floating tiles or default gradient blobs */}
      {floatingTilesEnabled ? (
        <FloatingTiles />
      ) : (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl motion-safe:animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl motion-safe:animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        </div>
      )}

      <div className="relative z-10 flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 py-6 md:gap-7 md:py-10">
        <div className="relative flex w-full flex-col items-center gap-2 text-center">
          <div className="absolute -inset-6 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-500)/0.18),transparent_70%)] blur-2xl -z-10" aria-hidden="true"></div>
          <Logo as="h1" size="lg" animated />
          <p className="text-sm text-muted-foreground md:text-base">
            Trace words. Reuse a tile. Keep the chain going.
          </p>
        </div>

        <DailyHub
          user={user}
          streakData={streakData}
          onPlayDaily={onPlayDaily ?? (() => onPlayClick())}
          onSignInClick={user ? undefined : onLoginClick}
          className="max-w-md md:max-w-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-500"
        />

        <div className="flex w-full max-w-md flex-col gap-2.5 md:max-w-xl motion-safe:animate-in motion-safe:fade-in duration-700">
          <SoundButton
            variant="brand"
            size="lg"
            onClick={onPlayClick}
            className="w-full text-base font-bold"
          >
            <LayoutGrid aria-hidden="true" />
            All game modes
          </SoundButton>

          <nav aria-label="More options">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {secondaryActions.map(action => (
                <li key={action.key} className="min-w-0">
                  <SoundButton
                    variant="outline"
                    size="lg"
                    onClick={action.onClick}
                    className={cn("w-full px-3 bg-background/80 hover:bg-[hsl(var(--brand-500)/0.08)]", action.className)}
                  >
                    <span aria-hidden="true" className="contents">{action.icon}</span>
                    <span className="truncate">{action.label}</span>
                  </SoundButton>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <SoundButton
              variant="ghost"
              size="lg"
              onClick={user ? handleLogout : onLoginClick}
              className="px-4"
            >
              {user ? <LogOut aria-hidden="true" /> : <LogIn aria-hidden="true" />}
              {user ? "Log Out" : "Login"}
            </SoundButton>
            {!user && (
              <button
                type="button"
                onClick={onRegisterClick}
                className="inline-flex min-h-[44px] items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Register
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Version and Copyright footer */}
      <footer className="relative z-10 pb-3 text-center text-xs text-muted-foreground md:pb-6">
        <div>© {new Date().getFullYear()} Banton Games. All rights reserved.</div>
      </footer>

      {/* Interactive Tutorial - Hidden for now but retained for later use */}
    </main>;
};
export default TitleScreen;
