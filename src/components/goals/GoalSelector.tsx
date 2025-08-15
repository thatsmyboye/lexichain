import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Target, Calendar, Zap, Plus } from "lucide-react";
import { GOAL_DEFINITIONS, getAvailableGoals, type GoalCategory } from "@/lib/goals";
import type { PlayerGoal } from "@/hooks/useGoals";

const categoryIcons = {
  achievement: Trophy,
  exploration: Star,
  progressive: Target,
  daily: Calendar,
  skill: Zap
};

const difficultyColors = {
  easy: "bg-green-500/10 text-green-700 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", 
  hard: "bg-red-500/10 text-red-700 border-red-500/20",
  expert: "bg-purple-500/10 text-purple-700 border-purple-500/20"
};

type GoalSelectorProps = {
  activeGoals: PlayerGoal[];
  completedGoals: PlayerGoal[];
  onAddGoal: (goalId: string) => Promise<boolean>;
  maxActiveGoals?: number;
};

export function GoalSelector({ activeGoals, completedGoals, onAddGoal, maxActiveGoals = 5 }: GoalSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory>("achievement");
  
  const completedGoalIds = completedGoals.map(g => g.goal_id);
  const activeGoalIds = activeGoals.map(g => g.goal_id);
  const availableGoals = getAvailableGoals(completedGoalIds).filter(g => !activeGoalIds.includes(g.id));
  
  const canAddMore = activeGoals.length < maxActiveGoals;
  
  const goalsByCategory = {
    achievement: availableGoals.filter(g => g.category === "achievement"),
    exploration: availableGoals.filter(g => g.category === "exploration"), 
    progressive: availableGoals.filter(g => g.category === "progressive"),
    daily: availableGoals.filter(g => g.category === "daily"),
    skill: availableGoals.filter(g => g.category === "skill")
  };

  const handleAddGoal = async (goalId: string) => {
    const success = await onAddGoal(goalId);
    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full"
          disabled={!canAddMore}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Goal {!canAddMore && `(${activeGoals.length}/${maxActiveGoals})`}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Your Next Goal</DialogTitle>
        </DialogHeader>
        
        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as GoalCategory)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="achievement" className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              Achievement
            </TabsTrigger>
            <TabsTrigger value="exploration" className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              Exploration
            </TabsTrigger>
            <TabsTrigger value="progressive" className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Progressive
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Daily
            </TabsTrigger>
            <TabsTrigger value="skill" className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Skill
            </TabsTrigger>
          </TabsList>
          
          {Object.entries(goalsByCategory).map(([category, goals]) => (
            <TabsContent key={category} value={category} className="mt-4">
              {goals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="mb-2">No available goals in this category</div>
                  <div className="text-sm">Complete prerequisites or try other categories</div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {goals.map((goal) => {
                    const Icon = categoryIcons[goal.category];
                    return (
                      <Card key={goal.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <Icon className="h-5 w-5 text-muted-foreground mt-1" />
                              <div>
                                <CardTitle className="text-base">{goal.title}</CardTitle>
                                <CardDescription className="text-sm mt-1">
                                  {goal.description}
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className={difficultyColors[goal.difficulty]}>
                              {goal.difficulty}
                            </Badge>
                            {goal.timeLimit && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {goal.timeLimit}h limit
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Reward: +{goal.reward.value} points
                            </span>
                            <Button 
                              size="sm"
                              onClick={() => handleAddGoal(goal.id)}
                            >
                              Add Goal
                            </Button>
                          </div>
                          
                          {goal.prerequisites && goal.prerequisites.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Prerequisites: {goal.prerequisites.map(prereq => 
                                GOAL_DEFINITIONS[prereq]?.title || prereq
                              ).join(", ")}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}