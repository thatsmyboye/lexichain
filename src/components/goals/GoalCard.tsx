import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Target, Calendar, Zap, X } from "lucide-react";
import { GOAL_DEFINITIONS, type GoalCategory, type GoalDifficulty } from "@/lib/goals";
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

type GoalCardProps = {
  goal: PlayerGoal;
  onDismiss?: (goalId: string) => void;
  showDismiss?: boolean;
};

export function GoalCard({ goal, onDismiss, showDismiss = true }: GoalCardProps) {
  const goalDef = GOAL_DEFINITIONS[goal.goal_id];
  
  if (!goalDef) {
    return null;
  }

  const Icon = categoryIcons[goalDef.category];
  const progressPercentage = (goal.current_progress / goal.target_value) * 100;
  const isCompleted = goal.status === "completed";
  const isExpired = goal.expires_at && new Date(goal.expires_at) < new Date();

  return (
    <Card className={`relative ${isCompleted ? "bg-green-50 border-green-200" : isExpired ? "bg-gray-50 border-gray-200" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base leading-tight">{goalDef.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{goalDef.description}</p>
            </div>
          </div>
          {showDismiss && !isCompleted && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-50 hover:opacity-100"
              onClick={() => onDismiss(goal.goal_id)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className={difficultyColors[goalDef.difficulty]}>
            {goalDef.difficulty}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {goalDef.category}
          </Badge>
          {goalDef.timeLimit && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {goalDef.timeLimit}h limit
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {goal.current_progress} / {goal.target_value}
              {isCompleted && " ✓"}
            </span>
          </div>
          
          <Progress 
            value={progressPercentage} 
            className={`h-2 ${isCompleted ? "bg-green-100" : ""}`}
          />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Reward: +{goalDef.reward.value} points</span>
            {isExpired && <span className="text-red-500">Expired</span>}
            {isCompleted && goal.completed_at && (
              <span>Completed {new Date(goal.completed_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}