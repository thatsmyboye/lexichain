import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Target, Zap, Puzzle, Infinity, Star, Trophy, Flame, Shield, Shuffle, Flag, Sword, TrendingUp } from 'lucide-react';
import { useSound } from '@/components/effects';
import { XP_REQUIREMENTS, calculateLevel } from '@/lib/progression';
import { useUnlockedModes } from '@/hooks/useUnlockedModes';
import type { User } from '@supabase/supabase-js';
import { FloatingTiles } from '@/components/effects/FloatingTiles';
export type AdvancedGameMode = 'classic' | 'time_attack' | 'endless' | 'puzzle' | 'survival' | 'zen' | 'chaos' | 'mini_marathon' | 'weekly_gauntlet' | 'prestige_endless';
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
const ADVANCED_MODES: AdvancedModeConfig[] = [{
  id: 'classic',
  name: 'Classic',
  description: 'The original Lexichain experience. No time limits, no pressure. Just pure word chaining.',
  icon: <Star className="h-6 w-6" />,
  difficulty: 'Easy',
  specialRules: ['No time limit', 'Standard scoring rules', 'Available to all players', 'Perfect for beginners'],
  rewards: {
    xpMultiplier: 1.0,
    scoreMultiplier: 1.0,
    unlockRequirement: 0
  }
}, {
  id: 'time_attack',
  name: 'Time Attack',
  description: 'Race against the clock! Find as many words as possible in the time limit.',
  icon: <Clock className="h-6 w-6" />,
  difficulty: 'Medium',
  timeLimit: 60,
  specialRules: ['60-second time limit', 'No pause between words', 'Time bonus for quick completion', 'Speed multiplier increases with each word'],
  rewards: {
    xpMultiplier: 1.5,
    scoreMultiplier: 1.2,
    unlockRequirement: 0
  }
}, {
  id: 'endless',
  name: '(Almost) Endless',
  description: 'Keep playing until you can\'t find any more words. How long can you last?',
  icon: <Infinity className="h-6 w-6" />,
  difficulty: 'Hard',
  specialRules: ['No time limit', 'Board regenerates when no words remain', 'Difficulty increases over time', 'Special tiles become more common'],
  rewards: {
    xpMultiplier: 2.0,
    scoreMultiplier: 1.5,
    unlockRequirement: 5
  }
}, {
  id: 'puzzle',
  name: 'Puzzle',
  description: 'Solve pre-designed puzzles with specific word requirements.',
  icon: <Puzzle className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: ['Pre-designed board layouts', 'Specific words must be found', 'Limited moves available', 'Perfect solutions only'],
  rewards: {
    xpMultiplier: 3.0,
    scoreMultiplier: 2.0,
    unlockRequirement: 10
  }
}, {
  id: 'survival',
  name: 'Survival',
  description: 'A roguelike word game adventure! Complete dynamic challenges, defeat bosses, collect power-ups, and manage resources to survive as long as possible.',
  icon: <Flame className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: [
    'Dynamic wave challenges each round',
    'Boss waves every 5 rounds with varied mechanics',
    'Lives system with multiple recovery methods',
    'Combo system with escalating rewards',
    'Power-ups and strategic shop system',
    'Random events with meaningful choices',
    'Adaptive difficulty scaling',
    'Meta-progression between runs'
  ],
  rewards: {
    xpMultiplier: 2.5,
    scoreMultiplier: 1.8,
    unlockRequirement: 8
  }
}, {
  id: 'zen',
  name: 'Zen',
  description: 'Relaxed gameplay with no pressure. Perfect for learning and practice.',
  icon: <Star className="h-6 w-6" />,
  difficulty: 'Easy',
  specialRules: ['No time pressure', 'Hints available', 'Unlimited undo', 'Focus on learning'],
  rewards: {
    xpMultiplier: 0.8,
    scoreMultiplier: 0.5,
    unlockRequirement: 0
  }
}, {
  id: 'chaos',
  name: 'Chaos',
  description: 'The board reshuffles after every word! Special tiles may turn into traps.',
  icon: <Shuffle className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: ['Board reshuffles after each word', 'New letters may swap in', 'Special tiles can become traps', 'At least 1 valid word always available'],
  rewards: {
    xpMultiplier: 2.8,
    scoreMultiplier: 2.2,
    unlockRequirement: 12
  }
}, {
  id: 'mini_marathon',
  name: 'Mini-Marathon',
  description: 'Three quick 5-move boards with combo carry-over. Perfect for a quick challenge!',
  icon: <Flag className="h-6 w-6" />,
  difficulty: 'Medium',
  specialRules: ['3 sequential boards', '5 moves per board, 60s timer', 'Combo multiplier carries between boards', 'Aggregate scoring with daily leaderboard'],
  rewards: {
    xpMultiplier: 1.5,
    scoreMultiplier: 1.2,
    unlockRequirement: 0
  }
}, {
  id: 'weekly_gauntlet',
  name: 'Weekly Gauntlet',
  description: '7 daily puzzles with unique constraints. Complete all for maximum rewards!',
  icon: <Sword className="h-6 w-6" />,
  difficulty: 'Hard',
  specialRules: ['7 themed daily puzzles (Monday-Sunday)', 'Unique constraints per day', 'Completion bonus for finishing all 7', 'New Diamond tier for top performers'],
  rewards: {
    xpMultiplier: 2.5,
    scoreMultiplier: 1.8,
    unlockRequirement: 5
  }
}, {
  id: 'prestige_endless',
  name: 'Prestige Endless',
  description: 'Enhanced Endless with persistent buffs and prestige system. Long-term meta-progression!',
  icon: <TrendingUp className="h-6 w-6" />,
  difficulty: 'Expert',
  specialRules: ['Earn permanent buffs every 10 waves', 'Prestige after wave 50 for exclusive rewards', 'Prestige Points unlock cosmetics', 'Multiple leaderboards (highest wave, speed runs)'],
  rewards: {
    xpMultiplier: 3.5,
    scoreMultiplier: 2.5,
    unlockRequirement: 10
  }
}];
interface AdvancedGameModesProps {
  onModeSelect: (mode: AdvancedGameMode) => void;
  onBack: () => void;
  userLevel?: number;
  totalXp?: number;
  user?: User | null;
  unlockedModes?: Set<AdvancedGameMode>; // Optional override for testing
  isAdmin?: boolean; // Admin users have all modes unlocked
}
export function AdvancedGameModes({
  onModeSelect,
  onBack,
  userLevel = 1,
  totalXp = 0,
  user = null,
  unlockedModes: overrideUnlockedModes,
  isAdmin = false
}: AdvancedGameModesProps) {
  const [selectedMode, setSelectedMode] = useState<AdvancedGameMode | null>(null);
  const {
    playSound
  } = useSound();

  // Calculate level data from total XP
  const levelData = calculateLevel(totalXp);
  const currentLevelXp = userLevel > 0 ? XP_REQUIREMENTS[userLevel - 1] : 0;
  const nextLevelXp = userLevel < XP_REQUIREMENTS.length ? XP_REQUIREMENTS[userLevel] : XP_REQUIREMENTS[XP_REQUIREMENTS.length - 1];
  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercentage = xpNeededForNextLevel > 0 ? xpInCurrentLevel / xpNeededForNextLevel * 100 : 0;

  // Get purchased unlocks from database
  const {
    unlockedModes: purchasedUnlocks,
    isLoading: isLoadingUnlocks
  } = useUnlockedModes(user);

  // Combine purchased unlocks with level-based unlocks
  const unlockedModes = overrideUnlockedModes || new Set([...Array.from(purchasedUnlocks),
  // Always include classic and zen modes (unlock requirement 0)
  'classic', 'zen',
  // Include time_attack by default
  'time_attack',
  // TEMPORARY: Chaos mode unlocked for all players
  'chaos']);
  const handleModeClick = (mode: AdvancedModeConfig) => {
    if (!isModeUnlocked(mode)) {
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
  const isModeUnlocked = (_mode: AdvancedModeConfig) => {
    // All modes are available to all logged-in users
    return true;
  };
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Hard':
        return 'bg-orange-500';
      case 'Expert':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-6 relative overflow-hidden">
      <FloatingTiles />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 animate-in fade-in slide-in-from-top duration-500">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2 hover:bg-muted/80 transition-all duration-300">
            ← Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="relative">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))] drop-shadow-lg">
                  Advanced Modes
                </h1>
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-400/10 to-brand-600/10 blur-xl -z-10"></div>
              </div>
              {isAdmin && <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin Mode - All Unlocked
                </Badge>}
            </div>
            <p className="text-muted-foreground mt-2">
              Challenge yourself with specialized game modes
            </p>
          </div>
        </div>

        {/* User Level Display */}
        <Card className="mb-8 border-brand-500/20 bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-bottom duration-500 delay-100">
          
        </Card>

        {/* XP Earning Guide */}
        <Card className="mb-8 border-blue-500/30 bg-gradient-to-br from-blue-50/50 via-blue-100/30 to-blue-50/50 dark:from-blue-950/50 dark:via-blue-900/30 dark:to-blue-950/50 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-500 delay-200">
          
          
        </Card>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {ADVANCED_MODES.filter(mode => mode.id !== 'weekly_gauntlet').map((mode, index) => {
          const isUnlocked = isModeUnlocked(mode);
          const isSelected = selectedMode === mode.id;
          return <Card key={mode.id} className={`cursor-pointer transition-all duration-300 relative overflow-hidden group animate-in fade-in slide-in-from-bottom ${isSelected ? 'ring-2 ring-primary shadow-2xl scale-105 bg-gradient-to-br from-primary/10 to-primary/5' : 'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1'} ${!isUnlocked ? 'opacity-60 cursor-not-allowed grayscale-[0.3]' : ''}`} style={{
            animationDelay: `${index * 100}ms`,
            animationDuration: '500ms'
          }} onClick={() => handleModeClick(mode)}>
                {/* Gradient overlay on hover */}
                {isUnlocked && !isSelected && <div className="absolute inset-0 bg-gradient-to-br from-brand-400/0 to-brand-600/0 group-hover:from-brand-400/5 group-hover:to-brand-600/5 transition-all duration-300 pointer-events-none"></div>}
                <CardHeader className="relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg transition-all duration-300 ${isSelected ? 'bg-primary text-primary-foreground shadow-lg scale-110' : 'bg-gradient-to-br from-muted to-muted/70 group-hover:from-brand-500/20 group-hover:to-brand-600/20'}`}>
                        {mode.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors duration-300">{mode.name}</CardTitle>
                        <Badge className={`text-xs mt-1 ${getDifficultyColor(mode.difficulty)} text-white font-semibold shadow-sm`}>
                          {mode.difficulty}
                        </Badge>
                      </div>
                    </div>
                    {!isUnlocked && <div className="flex flex-col items-end gap-0.5 bg-muted/50 px-2 py-1 rounded-lg">
                        <Badge variant="outline" className="text-xs border-yellow-500/50 bg-yellow-500/10">
                          Level {mode.rewards.unlockRequirement}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({XP_REQUIREMENTS[mode.rewards.unlockRequirement || 0]} XP)
                        </span>
                      </div>}
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
                        {mode.specialRules.map((rule, index) => <li key={index} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{rule}</span>
                          </li>)}
                      </ul>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        <div>XP: {mode.rewards.xpMultiplier}x</div>
                        <div>Score: {mode.rewards.scoreMultiplier}x</div>
                      </div>
                      {mode.timeLimit && <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {mode.timeLimit}s
                        </div>}
                    </div>
                  </div>
                </CardContent>
              </Card>;
        })}
        </div>

        {/* Start Button */}
        {selectedMode && <div className="flex justify-center animate-in fade-in slide-in-from-bottom duration-500">
            <Button size="lg" onClick={handleStartGame} className="px-10 py-6 text-lg font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500">
              <Zap className="h-5 w-5 mr-2 animate-pulse" />
              Start {ADVANCED_MODES.find(m => m.id === selectedMode)?.name}
            </Button>
          </div>}
      </div>
    </div>;
}
export default AdvancedGameModes;