import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Target, Zap, Puzzle, Infinity, Star, Trophy, Flame } from 'lucide-react';
import { useSound } from '@/components/effects';
import { XP_REQUIREMENTS } from '@/lib/progression';
import { useUnlockedModes } from '@/hooks/useUnlockedModes';
import type { User } from '@supabase/supabase-js';

export type AdvancedGameMode = 'classic' | 'time_attack' | 'endless' | 'puzzle' | 'survival' | 'zen';

interface AdvancedModeConfig {
  id: AdvancedGameMode;
  name: string;
  description: string;
  icon: React.ReactNode;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  timeLimit?: number;
  specialRules: string[];
  rewards: {
    xpMultiplier: number;
    scoreMultiplier: number;
    unlockRequirement?: number;
  };
}

const ADVANCED_MODES: AdvancedModeConfig[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The original Lexichain experience. No time limits, no pressure. Just pure word chaining.',
    icon: <Star className="h-6 w-6" />,
    difficulty: 'Easy',
    specialRules: [
      'No time limit',
      'Standard scoring rules',
      'Available to all players',
      'Perfect for beginners'
    ],
    rewards: {
      xpMultiplier: 1.0,
      scoreMultiplier: 1.0,
      unlockRequirement: 0
    }
  },
  {
    id: 'time_attack',
    name: 'Time Attack',
    description: 'Race against the clock! Find as many words as possible in the time limit.',
    icon: <Clock className="h-6 w-6" />,
    difficulty: 'Medium',
    timeLimit: 60,
    specialRules: [
      '60-second time limit',
      'No pause between words',
      'Time bonus for quick completion',
      'Speed multiplier increases with each word'
    ],
    rewards: {
      xpMultiplier: 1.5,
      scoreMultiplier: 1.2,
      unlockRequirement: 0
    }
  },
  {
    id: 'endless',
    name: '(Almost) Endless',
    description: 'Keep playing until you can\'t find any more words. How long can you last?',
    icon: <Infinity className="h-6 w-6" />,
    difficulty: 'Hard',
    specialRules: [
      'No time limit',
      'Board regenerates when no words remain',
      'Difficulty increases over time',
      'Special tiles become more common'
    ],
    rewards: {
      xpMultiplier: 2.0,
      scoreMultiplier: 1.5,
      unlockRequirement: 5
    }
  },
  {
    id: 'puzzle',
    name: 'Puzzle',
    description: 'Solve pre-designed puzzles with specific word requirements.',
    icon: <Puzzle className="h-6 w-6" />,
    difficulty: 'Expert',
    specialRules: [
      'Pre-designed board layouts',
      'Specific words must be found',
      'Limited moves available',
      'Perfect solutions only'
    ],
    rewards: {
      xpMultiplier: 3.0,
      scoreMultiplier: 2.0,
      unlockRequirement: 10
    }
  },
  {
    id: 'survival',
    name: 'Survival',
    description: 'Survive as long as possible with increasing difficulty and special challenges.',
    icon: <Flame className="h-6 w-6" />,
    difficulty: 'Expert',
    specialRules: [
      'Difficulty increases every 5 words',
      'Special challenge rounds',
      'Limited lives system',
      'Boss word requirements'
    ],
    rewards: {
      xpMultiplier: 2.5,
      scoreMultiplier: 1.8,
      unlockRequirement: 8
    }
  },
  {
    id: 'zen',
    name: 'Zen',
    description: 'Relaxed gameplay with no pressure. Perfect for learning and practice.',
    icon: <Star className="h-6 w-6" />,
    difficulty: 'Easy',
    specialRules: [
      'No time pressure',
      'Hints available',
      'Unlimited undo',
      'Focus on learning'
    ],
    rewards: {
      xpMultiplier: 0.8,
      scoreMultiplier: 0.5,
      unlockRequirement: 0
    }
  }
];

interface AdvancedGameModesProps {
  onModeSelect: (mode: AdvancedGameMode) => void;
  onBack: () => void;
  userLevel?: number;
  user?: User | null;
  unlockedModes?: Set<AdvancedGameMode>; // Optional override for testing
}

export function AdvancedGameModes({ 
  onModeSelect, 
  onBack, 
  userLevel = 1,
  user = null,
  unlockedModes: overrideUnlockedModes
}: AdvancedGameModesProps) {
  const [selectedMode, setSelectedMode] = useState<AdvancedGameMode | null>(null);
  const { playSound } = useSound();
  
  // Get purchased unlocks from database
  const { unlockedModes: purchasedUnlocks, isLoading: isLoadingUnlocks } = useUnlockedModes(user);
  
  // Combine purchased unlocks with level-based unlocks
  const unlockedModes = overrideUnlockedModes || new Set([
    ...Array.from(purchasedUnlocks),
    // Always include classic and zen modes (unlock requirement 0)
    'classic',
    'zen',
    // Include time_attack by default
    'time_attack'
  ]);

  const handleModeClick = (mode: AdvancedModeConfig) => {
    if (!unlockedModes.has(mode.id)) {
      playSound('error');
      return;
    }
    
    setSelectedMode(mode.id);
    playSound('button_click');
  };

  const handleStartGame = () => {
    if (selectedMode) {
      playSound('game_start');
      onModeSelect(selectedMode);
    }
  };

  const isModeUnlocked = (mode: AdvancedModeConfig) => {
    // Check if mode is purchased or unlocked by level
    return unlockedModes.has(mode.id) || userLevel >= (mode.rewards.unlockRequirement || 0);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Hard': return 'bg-orange-500';
      case 'Expert': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            ← Back
          </Button>
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Advanced Modes
            </h1>
            <p className="text-muted-foreground mt-2">
              Challenge yourself with specialized game modes
            </p>
          </div>
        </div>

        {/* User Level Display */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Level {userLevel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">
                    {unlockedModes.size} modes unlocked
                  </span>
                </div>
              </div>
              <div className="md:text-right">
                <div className="text-sm text-muted-foreground">Next Level</div>
                <Progress value={((userLevel % 10) / 10) * 100} className="w-full md:w-32 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* XP Earning Guide */}
        <Card className="mb-8 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              How to Earn XP & Unlock Modes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                <Target className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Play Any Game</h4>
                  <p className="text-xs text-muted-foreground">Earn 1 XP per 10 points scored</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                <Star className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Find Words</h4>
                  <p className="text-xs text-muted-foreground">+2 XP per word found</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                <Trophy className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Daily Challenge</h4>
                  <p className="text-xs text-muted-foreground">1.2x XP multiplier</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                <Flame className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Long Words</h4>
                  <p className="text-xs text-muted-foreground">+3 XP per letter in longest word</p>
                </div>
              </div>
            </div>
            <div className="text-center pt-2 border-t">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                💡 Tip: Play Daily Challenge to level up faster and unlock more modes!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {ADVANCED_MODES.map((mode) => {
            const isUnlocked = isModeUnlocked(mode);
            const isSelected = selectedMode === mode.id;
            
            return (
              <Card 
                key={mode.id}
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected 
                    ? 'ring-2 ring-primary shadow-lg scale-105' 
                    : 'hover:shadow-md hover:scale-102'
                } ${
                  !isUnlocked 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
                onClick={() => handleModeClick(mode)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {mode.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{mode.name}</CardTitle>
                        <Badge 
                          className={`text-xs ${getDifficultyColor(mode.difficulty)} text-white`}
                        >
                          {mode.difficulty}
                        </Badge>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge variant="outline" className="text-xs">
                          Level {mode.rewards.unlockRequirement}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({XP_REQUIREMENTS[mode.rewards.unlockRequirement || 0]} XP)
                        </span>
                      </div>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    {mode.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Special Rules:</h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {mode.specialRules.map((rule, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        <div>XP: {mode.rewards.xpMultiplier}x</div>
                        <div>Score: {mode.rewards.scoreMultiplier}x</div>
                      </div>
                      {mode.timeLimit && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {mode.timeLimit}s
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Start Button */}
        {selectedMode && (
          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={handleStartGame}
              className="px-8 py-3 text-lg"
            >
              <Zap className="h-5 w-5 mr-2" />
              Start {ADVANCED_MODES.find(m => m.id === selectedMode)?.name}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdvancedGameModes;

