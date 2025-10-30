import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PUZZLE_BOARDS, PuzzleBoard } from "@/lib/puzzleBoards";
import { Check, Lock, Trophy, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Puzzle Mode
            </h1>
            <p className="text-muted-foreground mt-2">
              Find all required words within the move limit
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>

        <Card className="p-6 mb-6 bg-card/50 backdrop-blur">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-brand-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-2">How to Play</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Each puzzle has specific words you must find</li>
                <li>• You have a limited number of moves (word submissions)</li>
                <li>• Find bonus words for extra XP!</li>
                <li>• Complete puzzles to unlock achievements</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PUZZLE_BOARDS.map((puzzle) => {
            const completed = isCompleted(puzzle.id);
            
            return (
              <Card
                key={puzzle.id}
                className={`p-4 cursor-pointer transition-all hover:scale-105 ${
                  selectedPuzzle?.id === puzzle.id
                    ? 'ring-2 ring-brand-400 bg-brand-500/10'
                    : 'hover:bg-card/80'
                } ${completed ? 'border-green-500/50' : ''}`}
                onClick={() => setSelectedPuzzle(puzzle)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{puzzle.name}</h3>
                    <Badge className={`mt-1 ${getDifficultyColor(puzzle.difficulty)}`}>
                      {puzzle.difficulty}
                    </Badge>
                  </div>
                  {completed && (
                    <div className="flex items-center gap-1 text-green-400">
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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
            <Button
              size="lg"
              onClick={handleStartPuzzle}
              className="shadow-lg"
            >
              Start {selectedPuzzle.name}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
