import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Star, 
  Zap, 
  Target, 
  Clock, 
  Lightbulb, 
  Sparkles, 
  Palette,
  Lock,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { 
  calculateLevel, 
  PlayerLevel, 
  SkillTree, 
  SkillNode, 
  SKILL_TREES,
  canUnlockSkill,
  getSkillEffect
} from '@/lib/progression';
import { useSound } from '@/components/effects';

interface ProgressionSystemProps {
  currentXp: number;
  onXpUpdate: (newXp: number) => void;
  unlockedSkills?: Set<string>;
  onSkillUnlock?: (skillId: string, cost: number) => void;
}

export function ProgressionSystem({ 
  currentXp, 
  onXpUpdate, 
  unlockedSkills = new Set(),
  onSkillUnlock 
}: ProgressionSystemProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSkill, setSelectedSkill] = useState<SkillNode | null>(null);
  const { playSound } = useSound();

  const playerLevel = calculateLevel(currentXp);
  const availableXp = currentXp; // In a real app, this would be separate from total XP

  const handleSkillClick = (skill: SkillNode) => {
    setSelectedSkill(skill);
    playSound('button_click');
  };

  const handleUnlockSkill = (skill: SkillNode) => {
    if (canUnlockSkill(skill.id, playerLevel.level, availableXp, unlockedSkills)) {
      onSkillUnlock?.(skill.id, skill.cost);
      onXpUpdate(currentXp - skill.cost);
      playSound('skill_unlock');
      setSelectedSkill(null);
    } else {
      playSound('error');
    }
  };

  const getSkillIcon = (category: string) => {
    switch (category) {
      case 'scoring': return <Target className="h-4 w-4" />;
      case 'time': return <Clock className="h-4 w-4" />;
      case 'hints': return <Lightbulb className="h-4 w-4" />;
      case 'special': return <Zap className="h-4 w-4" />;
      case 'cosmetic': return <Palette className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'scoring': return 'bg-red-500';
      case 'time': return 'bg-blue-500';
      case 'hints': return 'bg-yellow-500';
      case 'special': return 'bg-purple-500';
      case 'cosmetic': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Progression System
          </h1>
          <p className="text-muted-foreground mt-2">
            Level up and unlock powerful abilities
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skill Trees</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Level Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <Trophy className="h-6 w-6 text-yellow-500" />
                      Level {playerLevel.level}
                    </CardTitle>
                    <CardDescription className={`text-lg font-medium ${playerLevel.color}`}>
                      {playerLevel.title}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{playerLevel.xp} XP</div>
                    <div className="text-sm text-muted-foreground">Total Experience</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress to Level {playerLevel.level + 1}</span>
                      <span>{playerLevel.xpToNext} XP needed</span>
                    </div>
                    <Progress 
                      value={playerLevel.xpToNext > 0 ? ((playerLevel.xp - (playerLevel.xp - playerLevel.xpToNext)) / playerLevel.xpToNext) * 100 : 100} 
                      className="h-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{playerLevel.level}</div>
                      <div className="text-xs text-muted-foreground">Current Level</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{playerLevel.xpToNext}</div>
                      <div className="text-xs text-muted-foreground">XP to Next</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{unlockedSkills.size}</div>
                      <div className="text-xs text-muted-foreground">Skills Unlocked</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{playerLevel.unlockedFeatures.length}</div>
                      <div className="text-xs text-muted-foreground">Features Unlocked</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Unlocked Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Unlocked Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {playerLevel.unlockedFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium capitalize">
                        {feature.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills" className="space-y-6">
            {SKILL_TREES.map((tree) => (
              <Card key={tree.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getSkillIcon(tree.id)}
                        {tree.name}
                      </CardTitle>
                      <CardDescription>{tree.description}</CardDescription>
                    </div>
                    <Badge variant={playerLevel.level >= tree.unlockLevel ? "default" : "secondary"}>
                      Level {tree.unlockLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {playerLevel.level < tree.unlockLevel ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span>Unlock at Level {tree.unlockLevel}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tree.nodes.map((skill) => {
                        const isUnlocked = unlockedSkills.has(skill.id);
                        const canUnlock = canUnlockSkill(skill.id, playerLevel.level, availableXp, unlockedSkills);
                        
                        return (
                          <div
                            key={skill.id}
                            className={`p-4 rounded-lg border transition-all cursor-pointer ${
                              isUnlocked 
                                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                                : canUnlock 
                                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:shadow-md' 
                                  : 'bg-muted border-border opacity-50'
                            }`}
                            onClick={() => handleSkillClick(skill)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{skill.icon}</span>
                                <div>
                                  <h4 className="font-medium">{skill.name}</h4>
                                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${getCategoryColor(skill.category)} text-white`}>
                                    {getSkillIcon(skill.category)}
                                    {skill.category}
                                  </div>
                                </div>
                              </div>
                              {isUnlocked && <CheckCircle className="h-5 w-5 text-green-500" />}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-3">
                              {skill.description}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="text-sm">
                                <div className="font-medium">Cost: {skill.cost} XP</div>
                                <div className="text-muted-foreground">
                                  Level {skill.currentLevel}/{skill.maxLevel}
                                </div>
                              </div>
                              {!isUnlocked && canUnlock && (
                                <Button size="sm" onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlockSkill(skill);
                                }}>
                                  Unlock
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Achievement System
                </CardTitle>
                <CardDescription>
                  Coming soon! Advanced achievement tracking and rewards.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Advanced achievements coming in Phase 3.2</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Skill Detail Modal */}
        {selectedSkill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{selectedSkill.icon}</span>
                  {selectedSkill.name}
                </CardTitle>
                <CardDescription>{selectedSkill.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Effects:</h4>
                  {selectedSkill.effects.map((effect, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      • {effect.description}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Cost: {selectedSkill.cost} XP</div>
                    <div className="text-sm text-muted-foreground">
                      Max Level: {selectedSkill.maxLevel}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelectedSkill(null)}>
                      Close
                    </Button>
                    {canUnlockSkill(selectedSkill.id, playerLevel.level, availableXp, unlockedSkills) && (
                      <Button onClick={() => handleUnlockSkill(selectedSkill)}>
                        Unlock Skill
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProgressionSystem;

