import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Gamepad2, 
  TrendingUp, 
  Palette, 
  Trophy, 
  Lightbulb,
  BarChart3,
  Star,
  Zap,
  Crown
} from 'lucide-react';
import { AdvancedGameModes } from '@/components/game/AdvancedGameModes';
import { ProgressionSystem } from '@/components/progression/ProgressionSystem';
import { AdvancedAnalytics } from '@/components/analytics/AdvancedAnalytics';
import { ThemeCustomizer } from '@/components/customization/ThemeCustomizer';
import { AdvancedAchievements } from '@/components/achievements/AdvancedAchievements';
import { SmartHints } from '@/components/assistance/SmartHints';
import { calculateLevel } from '@/lib/progression';
import { useSound } from '@/components/effects';

interface Phase3IntegrationProps {
  user: any;
  gameStats: {
    totalScore: number;
    totalWords: number;
    uniqueWords: number;
    averageAccuracy: number;
    gamesPlayed: number;
    bestCombo: number;
    perfectGames: number;
  };
  onBack: () => void;
}

export function Phase3Integration({ user, gameStats, onBack }: Phase3IntegrationProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentXp, setCurrentXp] = useState(0);
  const [unlockedSkills, setUnlockedSkills] = useState<Set<string>>(new Set());
  const [unlockedThemes, setUnlockedThemes] = useState<Set<string>>(new Set(['default', 'dark']));
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [unlockedHints, setUnlockedHints] = useState<Set<string>>(new Set(['word_suggestion', 'pattern_highlight']));
  const [currentTheme, setCurrentTheme] = useState({
    id: 'default',
    name: 'Classic',
    description: 'The original Lexichain theme',
    category: 'preset' as const,
    colors: {
      primary: 'hsl(221, 83%, 53%)',
      secondary: 'hsl(210, 40%, 98%)',
      accent: 'hsl(47, 96%, 53%)',
      background: 'hsl(0, 0%, 100%)',
      surface: 'hsl(0, 0%, 98%)',
      text: 'hsl(222, 84%, 5%)',
      muted: 'hsl(215, 20%, 65%)'
    },
    particles: {
      enabled: true,
      intensity: 50,
      color: '#3b82f6',
      type: 'sparkles' as const
    },
    animations: {
      enabled: true,
      speed: 50,
      easing: 'ease-out' as const
    },
    isUnlocked: true
  });
  const { playSound } = useSound();

  const playerLevel = calculateLevel(currentXp);

  // Load saved data from localStorage
  useEffect(() => {
    const savedXp = localStorage.getItem('lexichain_xp');
    if (savedXp) {
      setCurrentXp(parseInt(savedXp));
    }

    const savedSkills = localStorage.getItem('lexichain_skills');
    if (savedSkills) {
      setUnlockedSkills(new Set(JSON.parse(savedSkills)));
    }

    const savedThemes = localStorage.getItem('lexichain_themes');
    if (savedThemes) {
      setUnlockedThemes(new Set(JSON.parse(savedThemes)));
    }

    const savedAchievements = localStorage.getItem('lexichain_achievements');
    if (savedAchievements) {
      setUnlockedAchievements(new Set(JSON.parse(savedAchievements)));
    }

    const savedHints = localStorage.getItem('lexichain_hints');
    if (savedHints) {
      setUnlockedHints(new Set(JSON.parse(savedHints)));
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('lexichain_xp', currentXp.toString());
    localStorage.setItem('lexichain_skills', JSON.stringify([...unlockedSkills]));
    localStorage.setItem('lexichain_themes', JSON.stringify([...unlockedThemes]));
    localStorage.setItem('lexichain_achievements', JSON.stringify([...unlockedAchievements]));
    localStorage.setItem('lexichain_hints', JSON.stringify([...unlockedHints]));
  }, [currentXp, unlockedSkills, unlockedThemes, unlockedAchievements, unlockedHints]);

  const handleXpUpdate = (newXp: number) => {
    setCurrentXp(newXp);
  };

  const handleSkillUnlock = (skillId: string, cost: number) => {
    setUnlockedSkills(prev => new Set(prev).add(skillId));
    playSound('skill_unlock');
  };

  const handleThemeChange = (theme: any) => {
    setCurrentTheme(theme);
    playSound('theme_change');
  };

  const handleAchievementUnlocked = (achievement: any) => {
    setUnlockedAchievements(prev => new Set(prev).add(achievement.id));
    playSound('achievement_unlock');
  };

  const handleHintUsed = (hint: any) => {
    // Handle hint usage
    playSound('hint_used');
  };

  const handleHintUnlock = (hintId: string, cost: number) => {
    setUnlockedHints(prev => new Set(prev).add(hintId));
    playSound('skill_unlock');
  };

  const handleModeSelect = (mode: string) => {
    playSound('game_start');
    // Launch the game with the selected advanced mode
    window.location.href = `/?mode=${mode}`;
  };

  const getFeatureStatus = (feature: string) => {
    switch (feature) {
      case 'advanced_modes':
        return playerLevel.level >= 2;
      case 'skill_trees':
        return playerLevel.level >= 5;
      case 'custom_themes':
        return playerLevel.level >= 10;
      case 'achievement_categories':
        return playerLevel.level >= 15;
      case 'premium_features':
        return playerLevel.level >= 20;
      case 'exclusive_modes':
        return playerLevel.level >= 25;
      default:
        return false;
    }
  };

  if (activeTab === 'advanced_modes') {
    return (
      <AdvancedGameModes
        onModeSelect={handleModeSelect}
        onBack={() => setActiveTab('overview')}
        userLevel={playerLevel.level}
        user={user}
        unlockedModes={new Set(['time_attack', 'zen'])}
      />
    );
  }

  if (activeTab === 'progression') {
    return (
      <ProgressionSystem
        currentXp={currentXp}
        onXpUpdate={handleXpUpdate}
        unlockedSkills={unlockedSkills}
        onSkillUnlock={handleSkillUnlock}
      />
    );
  }

  if (activeTab === 'analytics') {
    return (
      <AdvancedAnalytics
        gameSessions={[]} // Would be populated with actual game data
        onExportData={() => playSound('success')}
      />
    );
  }

  if (activeTab === 'themes') {
    return (
      <ThemeCustomizer
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        userLevel={playerLevel.level}
        unlockedThemes={unlockedThemes}
      />
    );
  }

  if (activeTab === 'achievements') {
    return (
      <AdvancedAchievements
        gameStats={gameStats}
        playerLevel={playerLevel.level}
        onAchievementUnlocked={handleAchievementUnlocked}
      />
    );
  }

  if (activeTab === 'hints') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8">
            <Button variant="outline" onClick={() => setActiveTab('overview')} className="mb-4">
              ← Back to Overview
            </Button>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Smart Hints
            </h1>
            <p className="text-muted-foreground mt-2">
              AI-powered assistance to improve your gameplay
            </p>
          </div>
          <SmartHints
            board={[['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']]} // Sample board
            usedWords={['ABC', 'DEF']}
            currentScore={150}
            gameMode="classic"
            onHintUsed={handleHintUsed}
            availableXp={currentXp}
            unlockedHints={unlockedHints}
            onUnlockHint={handleHintUnlock}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            ← Back to Game
          </Button>
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
              Phase 3 Features
            </h1>
            <p className="text-muted-foreground mt-2">
              Advanced gameplay mechanics and enhanced user experience
            </p>
          </div>
        </div>

        {/* Player Level Display */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-6 w-6 text-yellow-500" />
                  <span className="text-2xl font-bold">Level {playerLevel.level}</span>
                  <Badge className="text-sm">{playerLevel.title}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-blue-500" />
                  <span className="text-lg font-semibold">{currentXp} XP</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Next Level</div>
                <div className="text-lg font-semibold">{playerLevel.xpToNext} XP needed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="advanced_modes">Modes</TabsTrigger>
            <TabsTrigger value="progression">Progression</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Feature Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => setActiveTab('advanced_modes')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-blue-500" />
                    Advanced Game Modes
                  </CardTitle>
                  <CardDescription>
                    Time Attack, Endless, Puzzle, Survival, and Zen modes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={getFeatureStatus('advanced_modes') ? 'default' : 'secondary'}>
                      {getFeatureStatus('advanced_modes') ? 'Unlocked' : 'Level 2'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => setActiveTab('progression')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Progression System
                  </CardTitle>
                  <CardDescription>
                    Level up, earn XP, and unlock powerful skills
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={getFeatureStatus('skill_trees') ? 'default' : 'secondary'}>
                      {getFeatureStatus('skill_trees') ? 'Unlocked' : 'Level 5'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => setActiveTab('analytics')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    Advanced Analytics
                  </CardTitle>
                  <CardDescription>
                    Deep insights into your gameplay performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="default">Available</Badge>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => setActiveTab('themes')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-pink-500" />
                    Theme Customizer
                  </CardTitle>
                  <CardDescription>
                    Customize colors, particles, and visual effects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={getFeatureStatus('custom_themes') ? 'default' : 'secondary'}>
                      {getFeatureStatus('custom_themes') ? 'Unlocked' : 'Level 10'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => setActiveTab('achievements')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Advanced Achievements
                  </CardTitle>
                  <CardDescription>
                    Complex achievement system with categories and tiers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={getFeatureStatus('achievement_categories') ? 'default' : 'secondary'}>
                      {getFeatureStatus('achievement_categories') ? 'Unlocked' : 'Level 15'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-all duration-200"
                onClick={() => setActiveTab('hints')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-orange-500" />
                    Smart Hints
                  </CardTitle>
                  <CardDescription>
                    AI-powered gameplay assistance and strategy tips
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="default">Available</Badge>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>
                  Your current progress across all Phase 3 features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{unlockedSkills.size}</div>
                    <div className="text-sm text-muted-foreground">Skills Unlocked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-500">{unlockedThemes.size}</div>
                    <div className="text-sm text-muted-foreground">Themes Unlocked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-500">{unlockedAchievements.size}</div>
                    <div className="text-sm text-muted-foreground">Achievements</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">{unlockedHints.size}</div>
                    <div className="text-sm text-muted-foreground">Hints Available</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Phase3Integration;

