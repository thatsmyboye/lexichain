import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Star, 
  Target, 
  Zap, 
  Brain, 
  Sparkles,
  Lock,
  CheckCircle,
  Award,
  Crown,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  AdvancedAchievement, 
  AchievementProgress,
  ADVANCED_ACHIEVEMENTS,
  getAchievementsByCategory,
  getAchievementsByRarity,
  getUnlockedAchievements,
  getAvailableAchievements,
  calculateAchievementProgress,
  getRarityColor,
  getRarityIcon
} from '@/lib/advancedAchievements';
import { useSound } from '@/components/effects';

interface AdvancedAchievementsProps {
  gameStats: {
    totalScore: number;
    totalWords: number;
    uniqueWords: number;
    averageAccuracy: number;
    gamesPlayed: number;
    bestCombo: number;
    perfectGames: number;
  };
  playerLevel: number;
  onAchievementUnlocked?: (achievement: AdvancedAchievement) => void;
}

export function AdvancedAchievements({ 
  gameStats, 
  playerLevel,
  onAchievementUnlocked 
}: AdvancedAchievementsProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAchievement, setSelectedAchievement] = useState<AdvancedAchievement | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [completedAchievements, setCompletedAchievements] = useState<Set<string>>(new Set());
  const { playSound } = useSound();

  // Calculate achievement progress
  const achievementProgress = React.useMemo(() => {
    const progress = new Map<string, AchievementProgress>();
    
    for (const achievement of ADVANCED_ACHIEVEMENTS) {
      const prog = calculateAchievementProgress(achievement, gameStats);
      progress.set(achievement.id, prog);
      
      // Check for newly completed achievements
      if (prog.completed && !completedAchievements.has(achievement.id)) {
        setCompletedAchievements(prev => new Set(prev).add(achievement.id));
        onAchievementUnlocked?.(achievement);
        playSound('achievement_unlock');
      }
    }
    
    return progress;
  }, [gameStats, completedAchievements, onAchievementUnlocked, playSound]);

  const getFilteredAchievements = () => {
    let achievements = ADVANCED_ACHIEVEMENTS;
    
    // Filter by tab
    switch (activeTab) {
      case 'scoring':
        achievements = getAchievementsByCategory('scoring');
        break;
      case 'speed':
        achievements = getAchievementsByCategory('speed');
        break;
      case 'vocabulary':
        achievements = getAchievementsByCategory('vocabulary');
        break;
      case 'strategy':
        achievements = getAchievementsByCategory('strategy');
        break;
      case 'special':
        achievements = getAchievementsByCategory('special');
        break;
      case 'completed':
        achievements = getUnlockedAchievements(completedAchievements);
        break;
      case 'available':
        achievements = getAvailableAchievements(completedAchievements, playerLevel);
        break;
    }
    
    // Filter hidden achievements
    if (!showHidden) {
      achievements = achievements.filter(a => !a.hidden);
    }
    
    return achievements;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'scoring': return <Target className="h-4 w-4" />;
      case 'speed': return <Zap className="h-4 w-4" />;
      case 'vocabulary': return <Brain className="h-4 w-4" />;
      case 'strategy': return <Award className="h-4 w-4" />;
      case 'special': return <Sparkles className="h-4 w-4" />;
      default: return <Trophy className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'scoring': return 'bg-red-500';
      case 'speed': return 'bg-yellow-500';
      case 'vocabulary': return 'bg-blue-500';
      case 'strategy': return 'bg-green-500';
      case 'special': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getTierStars = (tier: number) => {
    return Array.from({ length: tier }, (_, i) => (
      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
    ));
  };

  const achievements = getFilteredAchievements();
  const completedCount = completedAchievements.size;
  const totalCount = ADVANCED_ACHIEVEMENTS.length;
  const completionRate = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
                Advanced Achievements
              </h1>
              <p className="text-muted-foreground mt-2">
                Master Lexichain and unlock legendary rewards
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">{completedCount}/{totalCount}</div>
                <div className="text-sm text-muted-foreground">Achievements</div>
                <Progress value={completionRate} className="w-32 h-2 mt-1" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
              >
                {showHidden ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showHidden ? 'Hide' : 'Show'} Hidden
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="scoring">Scoring</TabsTrigger>
            <TabsTrigger value="speed">Speed</TabsTrigger>
            <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
            <TabsTrigger value="strategy">Strategy</TabsTrigger>
            <TabsTrigger value="special">Special</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((achievement) => {
                const progress = achievementProgress.get(achievement.id);
                const isCompleted = progress?.completed || false;
                const isLocked = achievement.unlockLevel ? playerLevel < achievement.unlockLevel : false;
                const isHidden = achievement.hidden && !isCompleted;
                
                if (isHidden && !showHidden) return null;

                return (
                  <Card 
                    key={achievement.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isCompleted 
                        ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' 
                        : 'hover:shadow-md hover:scale-102'
                    } ${
                      isLocked ? 'opacity-50' : ''
                    }`}
                    onClick={() => setSelectedAchievement(achievement)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getCategoryColor(achievement.category)} text-white`}>
                            {getCategoryIcon(achievement.category)}
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {achievement.rewards.icon && (
                                <span className="text-xl">{achievement.rewards.icon}</span>
                              )}
                              {achievement.name}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                className="text-xs"
                                style={{ backgroundColor: getRarityColor(achievement.rarity) }}
                              >
                                {getRarityIcon(achievement.rarity)} {achievement.rarity}
                              </Badge>
                              <div className="flex items-center gap-1">
                                {getTierStars(achievement.tier)}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {isCompleted ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : isLocked ? (
                            <Lock className="h-6 w-6 text-muted-foreground" />
                          ) : (
                            <div className="text-sm font-medium">{achievement.rewards.xp} XP</div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {achievement.description}
                      </p>
                      
                      {progress && !isCompleted && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{progress.progress}%</span>
                          </div>
                          <Progress value={progress.progress} className="h-2" />
                          
                          <div className="text-xs text-muted-foreground">
                            {progress.requirements.filter(r => r.completed).length} / {progress.requirements.length} requirements met
                          </div>
                        </div>
                      )}
                      
                      {isLocked && (
                        <div className="text-xs text-muted-foreground">
                          Unlock at Level {achievement.unlockLevel}
                        </div>
                      )}
                      
                      {isCompleted && (
                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                          <CheckCircle className="h-4 w-4" />
                          Completed
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Achievement Detail Modal */}
        {selectedAchievement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${getCategoryColor(selectedAchievement.category)} text-white`}>
                      {getCategoryIcon(selectedAchievement.category)}
                    </div>
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        {selectedAchievement.rewards.icon && (
                          <span className="text-3xl">{selectedAchievement.rewards.icon}</span>
                        )}
                        {selectedAchievement.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          className="text-sm"
                          style={{ backgroundColor: getRarityColor(selectedAchievement.rarity) }}
                        >
                          {getRarityIcon(selectedAchievement.rarity)} {selectedAchievement.rarity}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {getTierStars(selectedAchievement.tier)}
                        </div>
                        {selectedAchievement.rewards.title && (
                          <Badge variant="outline" className="text-sm">
                            {selectedAchievement.rewards.title}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setSelectedAchievement(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <p className="text-lg text-muted-foreground">
                  {selectedAchievement.description}
                </p>
                
                <div>
                  <h4 className="font-medium mb-3">Requirements:</h4>
                  <div className="space-y-2">
                    {selectedAchievement.requirements.map((req, index) => {
                      const progress = achievementProgress.get(selectedAchievement.id);
                      const reqProgress = progress?.requirements[index];
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            {reqProgress?.completed ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                            )}
                            <span className="font-medium">{req.description}</span>
                          </div>
                          {reqProgress && (
                            <div className="text-sm text-muted-foreground">
                              {reqProgress.progress.toFixed(0)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Rewards:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{selectedAchievement.rewards.xp} XP</span>
                    </div>
                    {selectedAchievement.rewards.title && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                        <Crown className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">{selectedAchievement.rewards.title}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedAchievement.prerequisites && selectedAchievement.prerequisites.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Prerequisites:</h4>
                    <div className="space-y-1">
                      {selectedAchievement.prerequisites.map((prereqId) => {
                        const prereq = ADVANCED_ACHIEVEMENTS.find(a => a.id === prereqId);
                        return (
                          <div key={prereqId} className="text-sm text-muted-foreground">
                            • {prereq?.name || prereqId}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdvancedAchievements;

