import { useEffect, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import TitleScreen from "@/components/TitleScreen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLoginStreak } from "@/hooks/useLoginStreak";
import { useProfile } from "@/hooks/useProfile";
import { calculateLevel } from "@/lib/progression";
import type { User } from "@supabase/supabase-js";
import { AdvancedGameModes, AdvancedGameMode } from "@/components/game/AdvancedGameModes";
import { getModeName } from "@/lib/gameModes";
import PuzzleSelector from "@/components/game/PuzzleSelector";
import MiniMarathon from "@/components/game/MiniMarathon";
import WeeklyGauntlet from "@/components/game/WeeklyGauntlet";
import PrestigeEndless from "@/components/game/PrestigeEndless";
import { FloatingTiles } from "@/components/effects/FloatingTiles";

// Lazy load game component
const WordPathGame = lazy(() => import("@/components/game/WordPathGame"));
const Index = () => {
  const [showGame, setShowGame] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [showAdvancedModes, setShowAdvancedModes] = useState(false);
  const [showPuzzleSelector, setShowPuzzleSelector] = useState(false);
  const [showMiniMarathon, setShowMiniMarathon] = useState(false);
  const [showWeeklyGauntlet, setShowWeeklyGauntlet] = useState(false);
  const [showPrestigeEndless, setShowPrestigeEndless] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"classic" | "daily" | "daily_5x5" | "practice" | "blitz" | "time_attack" | "endless" | "puzzle" | "survival" | "zen">("classic");
  const [selectedAdvancedMode, setSelectedAdvancedMode] = useState<AdvancedGameMode | null>(null);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Initialize login streak tracking
  const {
    streakData
  } = useLoginStreak(user);

  // Fetch user profile for XP and level calculation
  const {
    profile,
    refreshProfile
  } = useProfile(user);
  useEffect(() => {
    // Get current user and set up auth state listener
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      setUser(user);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check admin status separately to avoid hook ordering issues
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const {
          data
        } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        setIsAdmin(!!data);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user]);
  useEffect(() => {
    document.title = "Lexichain | Build word chains by reusing tiles";
    const desc = "Draw paths to make words. Each new word must reuse at least one tile. Keep chaining until no valid word remains.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", desc);
    const og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute("content", "Lexichain");
    const ogd = document.querySelector('meta[property="og:description"]');
    if (ogd) ogd.setAttribute("content", desc);
  }, []);

  // Check for URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode && ['time_attack', 'endless', 'puzzle', 'survival', 'zen', 'chaos'].includes(mode)) {
      setSelectedMode(mode as any);
      setSelectedAdvancedMode(mode as AdvancedGameMode);
      setShowGame(true);
    }
  }, []);
  const handlePlayClick = () => {
    setShowModeSelection(true);
  };
  const handleModeSelect = (mode: "classic" | "daily" | "daily_5x5" | "practice" | "blitz" | "time_attack" | "endless" | "puzzle" | "survival" | "zen") => {
    setSelectedMode(mode);
    setShowModeSelection(false);
    setShowGame(true);
  };
  const handleBackToTitle = () => {
    setShowGame(false);
    setShowModeSelection(false);
    setShowAdvancedModes(false);
    setShowPuzzleSelector(false);
    setShowMiniMarathon(false);
    setShowWeeklyGauntlet(false);
    setShowPrestigeEndless(false);
    setSelectedPuzzleId(null);
    // Refresh profile to get updated XP
    refreshProfile();
  };
  const handleBackToAdvancedModes = () => {
    setShowGame(false);
    setShowAdvancedModes(true);
    setSelectedPuzzleId(null);
    // Keep selectedAdvancedMode set so user sees their last selection highlighted
    refreshProfile();
  };
  const handleAdvancedModeSelect = (mode: AdvancedGameMode) => {
    // Special handling for puzzle mode
    if (mode === 'puzzle') {
      setShowAdvancedModes(false);
      setShowPuzzleSelector(true);
      return;
    }

    // Special handling for new advanced modes
    if (mode === 'mini_marathon') {
      setShowAdvancedModes(false);
      setShowMiniMarathon(true);
      return;
    }
    if (mode === 'weekly_gauntlet') {
      setShowAdvancedModes(false);
      setShowWeeklyGauntlet(true);
      return;
    }
    if (mode === 'prestige_endless') {
      setShowAdvancedModes(false);
      setShowPrestigeEndless(true);
      return;
    }
    setSelectedMode(mode as any); // Convert AdvancedGameMode to broader type
    setSelectedAdvancedMode(mode);
    setShowAdvancedModes(false);
    setShowGame(true);
  };
  const handlePuzzleSelect = (puzzleId: string) => {
    setSelectedPuzzleId(puzzleId);
    setSelectedMode('puzzle');
    setSelectedAdvancedMode('puzzle');
    setShowPuzzleSelector(false);
    setShowGame(true);
  };
  const handleBackToPuzzleSelector = () => {
    setShowPuzzleSelector(false);
    setShowAdvancedModes(true);
  };
  const handleShowAdvancedModes = () => {
    setShowModeSelection(false);
    setShowAdvancedModes(true);
  };
  const handleAdvancedModesFromTitle = () => {
    setShowAdvancedModes(true);
  };
  const handleBackToModeSelection = () => {
    setShowAdvancedModes(false);
    setShowModeSelection(true);
  };
  const handleLoginClick = () => {
    navigate("/auth?mode=login");
  };
  const handleRegisterClick = () => {
    navigate("/auth?mode=signup");
  };
  const handleStatsClick = () => {
    navigate("/stats");
  };
  const handleStoreClick = () => {
    navigate("/store");
  };
  const handleLeaderboardClick = () => {
    navigate("/leaderboard");
  };
  const handleSettingsClick = () => {
    navigate("/settings");
  };

  // Show new advanced modes
  if (showMiniMarathon) {
    return <MiniMarathon onBack={handleBackToTitle} />;
  }
  if (showWeeklyGauntlet) {
    return <WeeklyGauntlet onBack={handleBackToTitle} />;
  }
  if (showPrestigeEndless) {
    return <PrestigeEndless onBack={handleBackToTitle} />;
  }
  if (showPuzzleSelector) {
    return <PuzzleSelector onPuzzleSelect={handlePuzzleSelect} onBack={handleBackToPuzzleSelector} user={user} />;
  }
  const playerLevel = profile ? calculateLevel(profile.total_xp) : {
    level: 1,
    xp: 0,
    xpToNext: 100,
    totalXp: 0,
    title: "Word Novice",
    color: "text-gray-500",
    unlockedFeatures: []
  };
  if (showAdvancedModes) {
    return <AdvancedGameModes onModeSelect={handleAdvancedModeSelect} onBack={handleBackToModeSelection} userLevel={playerLevel.level} totalXp={profile?.total_xp || 0} user={user} isAdmin={isAdmin} />;
  }
  if (showGame) {
    return <main>
        <header className="container mx-auto pt-4 md:pt-10 pb-2 md:pb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">Lexichain</h1>
          {selectedAdvancedMode && (
            <p className="text-lg md:text-xl font-semibold text-muted-foreground mt-2 text-center">
              {getModeName(selectedAdvancedMode)}
            </p>
          )}
        </header>
        <Suspense fallback={<div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>}>
          <WordPathGame onBackToTitle={handleBackToTitle} onBackToAdvancedModes={selectedAdvancedMode ? handleBackToAdvancedModes : undefined} initialMode={selectedMode} initialPuzzleId={selectedPuzzleId || undefined} />
        </Suspense>
      </main>;
  }
  if (showModeSelection) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted relative overflow-hidden">
        <FloatingTiles />
        <div className="text-center space-y-8 relative z-10">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Lexichain
          </h1>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Choose Game Mode</h2>
            
            <div className="flex flex-col gap-3">
              <Button variant="hero" size="lg" onClick={() => handleModeSelect("daily")} className="px-12 py-4 text-lg">
                Daily Challenge
              </Button>

              <Button
                size="lg"
                onClick={() => handleModeSelect("daily_5x5")}
                className="px-12 py-4 text-lg bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow hover:brightness-110 hover:scale-[1.02] transition-all duration-200"
              >
                Daily Challenge 5x5
              </Button>

              <Button variant="outline" size="lg" onClick={handleShowAdvancedModes} className="px-12 py-4 text-lg">
                More Game Modes
              </Button>
              
              {/* PRESERVE FOR FUTURE USE - Challenge Practice Mode Temporarily Disabled
               <Button variant="outline" size="lg" onClick={() => handleModeSelect("practice")} className="px-12 py-4 text-lg">
                Challenge Practice
               </Button>
               */}
            </div>
            
            <Button variant="ghost" onClick={() => setShowModeSelection(false)} className="mt-4">
              Back
            </Button>
          </div>
        </div>
      </div>;
  }
  return <TitleScreen onPlayClick={handlePlayClick} onAdvancedModesClick={handleAdvancedModesFromTitle} onLoginClick={handleLoginClick} onRegisterClick={handleRegisterClick} onStatsClick={handleStatsClick} onStoreClick={handleStoreClick} onLeaderboardClick={handleLeaderboardClick} onSettingsClick={handleSettingsClick} streakData={streakData} user={user} />;
};
export default Index;