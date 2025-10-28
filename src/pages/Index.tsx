import { useEffect, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import TitleScreen from "@/components/TitleScreen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLoginStreak } from "@/hooks/useLoginStreak";
import type { User } from "@supabase/supabase-js";
import { AdvancedGameModes, AdvancedGameMode } from "@/components/game/AdvancedGameModes";

// Lazy load game component
const WordPathGame = lazy(() => import("@/components/game/WordPathGame"));
const Index = () => {
  const [showGame, setShowGame] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [showAdvancedModes, setShowAdvancedModes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"classic" | "daily" | "practice" | "blitz">("classic");
  const [selectedAdvancedMode, setSelectedAdvancedMode] = useState<AdvancedGameMode | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // Initialize login streak tracking
  const { streakData } = useLoginStreak(user);

  useEffect(() => {
    // Get current user and set up auth state listener
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
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
  const handlePlayClick = () => {
    setShowModeSelection(true);
  };
  const handleModeSelect = (mode: "classic" | "daily" | "practice" | "blitz") => {
    setSelectedMode(mode);
    setShowModeSelection(false);
    setShowGame(true);
  };
  const handleBackToTitle = () => {
    setShowGame(false);
    setShowModeSelection(false);
    setShowAdvancedModes(false);
  };

  const handleAdvancedModeSelect = (mode: AdvancedGameMode) => {
    setSelectedAdvancedMode(mode);
    setShowAdvancedModes(false);
    setShowGame(true);
  };

  const handleShowAdvancedModes = () => {
    setShowModeSelection(false);
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

  if (showAdvancedModes) {
    return <AdvancedGameModes 
      onModeSelect={handleAdvancedModeSelect}
      onBack={handleBackToModeSelection}
      userLevel={1}
      unlockedModes={new Set(['time_attack', 'zen'])}
    />;
  }

  if (showGame) {
    return <main>
        <header className="container mx-auto pt-10 pb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">Lexichain</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">Make as many valid words as you can by drawing paths through the letter grid. Each new word must reuse at least one tile from the previous word. Balance your strategy between reusing letters and making longer words, and go for a Platinum score!</p>
          
        </header>
        <Suspense fallback={<div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          </div>}>
          <WordPathGame onBackToTitle={handleBackToTitle} initialMode={selectedMode} />
        </Suspense>
      </main>;
  }
  if (showModeSelection) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted relative">
        <div className="text-center space-y-8">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Lexichain
          </h1>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Choose Game Mode</h2>
            
            <div className="flex flex-col gap-3">
              <Button variant="hero" size="lg" onClick={() => handleModeSelect("daily")} className="px-12 py-4 text-lg">
                Daily Challenge
              </Button>
              
              <Button variant="outline" size="lg" onClick={handleShowAdvancedModes} className="px-12 py-4 text-lg">
                More Game Modes
              </Button>
              
              <Button variant="outline" size="lg" onClick={() => handleModeSelect("practice")} className="px-12 py-4 text-lg">
                Challenge Practice
              </Button>
              
              <Button variant="outline" size="lg" onClick={() => handleModeSelect("classic")} className="px-12 py-4 text-lg">
                Classic
              </Button>
            </div>
            
            <Button variant="ghost" onClick={() => setShowModeSelection(false)} className="mt-4">
              Back
            </Button>
          </div>
        </div>
      </div>;
  }
  return <TitleScreen 
    onPlayClick={handlePlayClick} 
    onLoginClick={handleLoginClick} 
    onRegisterClick={handleRegisterClick} 
    onStatsClick={handleStatsClick} 
    onStoreClick={handleStoreClick}
    onLeaderboardClick={handleLeaderboardClick}
    streakData={streakData}
    user={user}
  />;
};
export default Index;