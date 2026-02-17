import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PUZZLE_BOARDS, PuzzleBoard } from "@/lib/puzzleBoards";
import { Check, Lock, Trophy, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { FloatingTiles } from "@/components/effects/FloatingTiles";

interface PuzzleSelectorProps {
  onPuzzleSelect: (puzzleId: string) => void;
  onBack: () => void;
  user: User | null;
}

interface PuzzleCompletion {
  puzzle_id: string;
  moves_used: number;
  optional_words_found: number;
  completed_at: string;
}

export default function PuzzleSelector({ onPuzzleSelect, onBack, user }: PuzzleSelectorProps) {
  const [completions, setCompletions] = useState<PuzzleCompletion[]>([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleBoard | null>(null);

  useEffect(() => {
    if (user) {
      loadCompletions();
    }
  }, [user]);

  const loadCompletions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('puzzle_completions' as any)
      .select('*')
      .eq('user_id', user.id);

    if (!error && data) {
      setCompletions(data as any as PuzzleCompletion[]);
    }
  };

  const isCompleted = (puzzleId: string) => {
    return completions.some(c => c.puzzle_id === puzzleId);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'hard': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'expert': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleStartPuzzle = () => {
    if (selectedPuzzle) {
      onPuzzleSelect(selectedPuzzle.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4 relative overflow-hidden">
      <FloatingTiles />

      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top duration-500">
          <div>
            <div className="relative inline-block">
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))] drop-shadow-lg">
                Puzzle Mode
              </h1>
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-400/10 to-brand-600/10 blur-xl -z-10"></div>
            </div>
            <p className="text-muted-foreground mt-2 font-medium">
              Find all required words within the move limit
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onBack}
            className="hover:bg-muted/80 transition-all duration-300"
          >
            Back
          </Button>
        </div>

        <Card className="p-6 mb-6 bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm shadow-lg border-brand-500/20 animate-in fade-in slide-in-from-bottom duration-500 delay-100">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-6 h-6 text-brand-400 mt-1 flex-shrink-0 animate-pulse" />
            <div>
              <h3 className="font-semibold text-lg mb-3">How to Play</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 font-bold">•</span>
                  <span>Each puzzle has specific words you must find</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 font-bold">•</span>
                  <span>You have a limited number of moves (word submissions)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 font-bold">•</span>
                  <span>Find bonus words for extra XP!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 font-bold">•</span>
                  <span>Complete puzzles to unlock achievements</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PUZZLE_BOARDS.map((puzzle, index) => {
            const completed = isCompleted(puzzle.id);

            return (
              <Card
                key={puzzle.id}
                className={`p-4 cursor-pointer transition-all duration-300 relative overflow-hidden group animate-in fade-in slide-in-from-bottom ${
                  selectedPuzzle?.id === puzzle.id
                    ? 'ring-2 ring-brand-400 bg-gradient-to-br from-brand-500/15 to-brand-600/10 shadow-xl scale-105'
                    : 'hover:bg-card/90 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1'
                } ${completed ? 'border-green-500/40 bg-green-500/5' : ''}`}
                style={{ animationDelay: `${index * 100 + 200}ms`, animationDuration: '500ms' }}
                onClick={() => setSelectedPuzzle(puzzle)}
              >
                {/* Gradient overlay on hover */}
                {!completed && selectedPuzzle?.id !== puzzle.id && (
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-400/0 to-brand-600/0 group-hover:from-brand-400/5 group-hover:to-brand-600/5 transition-all duration-300 pointer-events-none"></div>
                )}

                <div className="flex items-start justify-between mb-3 relative z-10">
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-300">{puzzle.name}</h3>
                    <Badge className={`mt-1.5 ${getDifficultyColor(puzzle.difficulty)} font-semibold shadow-sm`}>
                      {puzzle.difficulty}
                    </Badge>
                  </div>
                  {completed && (
                    <div className="flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/30">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Required Words:</span>
                    <span>{puzzle.requiredWords.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Max Moves:</span>
                    <span>{puzzle.maxMoves}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-brand-400" />
                    <span>{puzzle.xpReward} XP</span>
                  </div>
                </div>

                {puzzle.hint && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                    <span className="font-medium">Hint:</span> {puzzle.hint}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {selectedPuzzle && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom duration-500">
            <Button
              size="lg"
              onClick={handleStartPuzzle}
              className="px-10 py-6 text-lg font-bold shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500"
            >
              Start {selectedPuzzle.name}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
