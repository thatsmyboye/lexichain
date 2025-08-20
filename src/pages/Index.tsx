import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WordPathGame from "@/components/game/WordPathGame";
import TitleScreen from "@/components/TitleScreen";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [showGame, setShowGame] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"classic" | "daily" | "blitz">("classic");
  const navigate = useNavigate();

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

  const handleModeSelect = (mode: "classic" | "daily" | "blitz") => {
    setSelectedMode(mode);
    setShowModeSelection(false);
    setShowGame(true);
  };

  const handleBackToTitle = () => {
    setShowGame(false);
    setShowModeSelection(false);
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

  if (showGame) {
    return (
      <main>
        <header className="container mx-auto pt-10 pb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">Lexichain</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">Make as many valid words as you can by drawing paths through the letter grid. Each new word must reuse at least one tile from the previous word.</p>
          <p className="mt-1 text-muted-foreground max-w-2xl text-sm">This game is in early development, and will undergo frequent changes.</p>
        </header>
        <WordPathGame onBackToTitle={handleBackToTitle} initialMode={selectedMode} />
      </main>
    );
  }

  if (showModeSelection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted relative">
        <div className="text-center space-y-8">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Lexichain
          </h1>
          
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Choose Game Mode</h2>
            
            <div className="flex flex-col gap-3">
              <Button 
                variant="hero" 
                size="lg"
                onClick={() => handleModeSelect("daily")}
                className="px-12 py-4 text-lg"
              >
                Daily Challenge
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => handleModeSelect("classic")}
                className="px-12 py-4 text-lg"
              >
                Classic
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => handleModeSelect("blitz")}
                className="px-12 py-4 text-lg"
              >
                Blitz
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              onClick={() => setShowModeSelection(false)}
              className="mt-4"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <TitleScreen onPlayClick={handlePlayClick} onLoginClick={handleLoginClick} onRegisterClick={handleRegisterClick} onStatsClick={handleStatsClick} onStoreClick={handleStoreClick} />;
};

export default Index;
