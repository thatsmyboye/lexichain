import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Lightbulb, 
  Target, 
  Eye, 
  Zap, 
  Brain, 
  Search,
  ArrowRight,
  Sparkles,
  Clock,
  Award,
  HelpCircle
} from 'lucide-react';
import { useSound } from '@/components/effects';

export interface HintData {
  id: string;
  type: 'word' | 'pattern' | 'strategy' | 'letter' | 'path';
  priority: 'low' | 'medium' | 'high';
  content: string;
  confidence: number; // 0-100
  cost: number; // XP cost
  cooldown: number; // seconds
  category: 'scoring' | 'efficiency' | 'discovery' | 'strategy';
}

export interface BoardAnalysis {
  availableWords: number;
  bestWords: Array<{
    word: string;
    score: number;
    path: Array<{ row: number; col: number }>;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  patterns: Array<{
    type: string;
    description: string;
    locations: Array<{ row: number; col: number }>;
  }>;
  efficiency: {
    scorePerMove: number;
    optimalStrategy: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface SmartHintsProps {
  board: string[][];
  usedWords: string[];
  currentScore: number;
  gameMode: string;
  onHintUsed: (hint: HintData) => void;
  availableXp: number;
  unlockedHints: Set<string>;
  onUnlockHint: (hintId: string, cost: number) => void;
}

export function SmartHints({
  board,
  usedWords,
  currentScore,
  gameMode,
  onHintUsed,
  availableXp,
  unlockedHints,
  onUnlockHint
}: SmartHintsProps) {
  const [activeHint, setActiveHint] = useState<HintData | null>(null);
  const [hintCooldowns, setHintCooldowns] = useState<Map<string, number>>(new Map());
  const [showAnalysis, setShowAnalysis] = useState(false);
  const { playSound } = useSound();

  // Analyze the current board state
  const boardAnalysis: BoardAnalysis = useMemo(() => {
    // This is a simplified analysis - in reality, you'd use actual word-finding algorithms
    const analysis: BoardAnalysis = {
      availableWords: Math.floor(Math.random() * 20) + 5, // Simulated
      bestWords: [
        {
          word: 'EXAMPLE',
          score: 150,
          path: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }],
          difficulty: 'medium'
        },
        {
          word: 'WORD',
          score: 80,
          path: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }],
          difficulty: 'easy'
        }
      ],
      patterns: [
        {
          type: 'vowel_cluster',
          description: 'High concentration of vowels in this area',
          locations: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }]
        },
        {
          type: 'rare_letters',
          description: 'Rare letters (Q, X, Z) present',
          locations: [{ row: 2, col: 2 }]
        }
      ],
      efficiency: {
        scorePerMove: Math.round(currentScore / Math.max(usedWords.length, 1)),
        optimalStrategy: 'Focus on longer words with rare letters',
        riskLevel: 'medium'
      }
    };

    return analysis;
  }, [board, usedWords, currentScore]);

  // Generate hints based on board analysis
  const availableHints: HintData[] = useMemo(() => {
    const hints: HintData[] = [
      {
        id: 'word_suggestion',
        type: 'word',
        priority: 'high',
        content: `Try finding words like "${boardAnalysis.bestWords[0]?.word || 'EXAMPLE'}" for high scores`,
        confidence: 85,
        cost: 10,
        cooldown: 30,
        category: 'scoring'
      },
      {
        id: 'pattern_highlight',
        type: 'pattern',
        priority: 'medium',
        content: 'Look for vowel clusters in the top-left area',
        confidence: 70,
        cost: 5,
        cooldown: 20,
        category: 'discovery'
      },
      {
        id: 'strategy_advice',
        type: 'strategy',
        priority: 'medium',
        content: 'Focus on longer words to maximize your score multiplier',
        confidence: 90,
        cost: 8,
        cooldown: 45,
        category: 'strategy'
      },
      {
        id: 'letter_focus',
        type: 'letter',
        priority: 'low',
        content: 'The letter Q is worth extra points - try to use it',
        confidence: 95,
        cost: 3,
        cooldown: 15,
        category: 'efficiency'
      },
      {
        id: 'path_suggestion',
        type: 'path',
        priority: 'high',
        content: 'Start from the center and work outward for better word options',
        confidence: 80,
        cost: 12,
        cooldown: 60,
        category: 'strategy'
      }
    ];

    return hints.filter(hint => unlockedHints.has(hint.id));
  }, [boardAnalysis, unlockedHints]);

  // Update cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      setHintCooldowns(prev => {
        const newCooldowns = new Map(prev);
        for (const [hintId, timeLeft] of newCooldowns) {
          if (timeLeft > 0) {
            newCooldowns.set(hintId, timeLeft - 1);
          } else {
            newCooldowns.delete(hintId);
          }
        }
        return newCooldowns;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUseHint = (hint: HintData) => {
    if (hintCooldowns.has(hint.id)) {
      playSound('error');
      return;
    }

    if (availableXp < hint.cost) {
      playSound('error');
      return;
    }

    setActiveHint(hint);
    setHintCooldowns(prev => new Map(prev).set(hint.id, hint.cooldown));
    onHintUsed(hint);
    playSound('hint_used');
  };

  const handleUnlockHint = (hint: HintData) => {
    if (availableXp >= hint.cost) {
      onUnlockHint(hint.id, hint.cost);
      playSound('skill_unlock');
    } else {
      playSound('error');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'scoring': return <Target className="h-4 w-4" />;
      case 'efficiency': return <Zap className="h-4 w-4" />;
      case 'discovery': return <Search className="h-4 w-4" />;
      case 'strategy': return <Brain className="h-4 w-4" />;
      default: return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500';
    if (confidence >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-yellow-500" />
            Smart Hints
          </h2>
          <p className="text-muted-foreground">
            AI-powered assistance to improve your gameplay
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            {availableXp} XP
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalysis(!showAnalysis)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showAnalysis ? 'Hide' : 'Show'} Analysis
          </Button>
        </div>
      </div>

      {/* Board Analysis */}
      {showAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Board Analysis
            </CardTitle>
            <CardDescription>
              AI analysis of current board state and opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-2">Available Words</h4>
                <div className="text-2xl font-bold text-primary">
                  {boardAnalysis.availableWords}
                </div>
                <div className="text-sm text-muted-foreground">
                  words remaining
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Efficiency</h4>
                <div className="text-2xl font-bold text-green-500">
                  {boardAnalysis.efficiency.scorePerMove}
                </div>
                <div className="text-sm text-muted-foreground">
                  points per word
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Risk Level</h4>
                <Badge 
                  className={`${
                    boardAnalysis.efficiency.riskLevel === 'low' ? 'bg-green-500' :
                    boardAnalysis.efficiency.riskLevel === 'medium' ? 'bg-yellow-500' :
                    'bg-red-500'
                  } text-white`}
                >
                  {boardAnalysis.efficiency.riskLevel}
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  {boardAnalysis.efficiency.optimalStrategy}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Hints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableHints.map((hint) => {
          const isOnCooldown = hintCooldowns.has(hint.id);
          const canAfford = availableXp >= hint.cost;
          const timeLeft = hintCooldowns.get(hint.id) || 0;

          return (
            <Card 
              key={hint.id}
              className={`transition-all duration-200 ${
                isOnCooldown ? 'opacity-50' : 'hover:shadow-md'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getPriorityColor(hint.priority)} text-white`}>
                      {getCategoryIcon(hint.category)}
                    </div>
                    <div>
                      <CardTitle className="text-lg capitalize">
                        {hint.type} Hint
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {hint.category}
                        </Badge>
                        <Badge 
                          className={`text-xs ${getPriorityColor(hint.priority)} text-white`}
                        >
                          {hint.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-medium">{hint.cost} XP</div>
                    <div className={`text-xs ${getConfidenceColor(hint.confidence)}`}>
                      {hint.confidence}% confidence
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {hint.content}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={hint.confidence} 
                      className="w-20 h-2" 
                    />
                    <span className="text-xs text-muted-foreground">
                      {hint.confidence}%
                    </span>
                  </div>
                  
                  {isOnCooldown ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {timeLeft}s
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleUseHint(hint)}
                      disabled={!canAfford}
                      className="flex items-center gap-1"
                    >
                      <Lightbulb className="h-3 w-3" />
                      Use Hint
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlockable Hints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Unlock New Hints
          </CardTitle>
          <CardDescription>
            Spend XP to unlock advanced hint capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: 'advanced_patterns',
                name: 'Advanced Pattern Recognition',
                description: 'Identify complex word patterns and letter combinations',
                cost: 25,
                category: 'discovery'
              },
              {
                id: 'score_optimization',
                name: 'Score Optimization',
                description: 'Get hints for maximum scoring potential',
                cost: 30,
                category: 'scoring'
              },
              {
                id: 'time_efficiency',
                name: 'Time Efficiency',
                description: 'Hints for faster word finding in timed modes',
                cost: 20,
                category: 'efficiency'
              },
              {
                id: 'strategic_planning',
                name: 'Strategic Planning',
                description: 'Long-term strategy advice for complex games',
                cost: 40,
                category: 'strategy'
              }
            ].map((hint) => (
              <div
                key={hint.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {getCategoryIcon(hint.category)}
                  </div>
                  <div>
                    <h4 className="font-medium">{hint.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {hint.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{hint.cost} XP</span>
                  <Button
                    size="sm"
                    onClick={() => handleUnlockHint(hint as any)}
                    disabled={availableXp < hint.cost}
                  >
                    Unlock
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Hint Display */}
      {activeHint && (
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lightbulb className="h-5 w-5" />
              Active Hint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-lg font-medium">{activeHint.content}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveHint(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SmartHints;

