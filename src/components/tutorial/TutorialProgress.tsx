import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TutorialProgressProps {
  progress: number;
  totalSteps: number;
  currentStep: number;
  onRestart?: () => void;
  onSkip?: () => void;
  className?: string;
}

export function TutorialProgress({
  progress,
  totalSteps,
  currentStep,
  onRestart,
  onSkip,
  className
}: TutorialProgressProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Tutorial Progress</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {currentStep} / {totalSteps}
        </Badge>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.round(progress)}% Complete</span>
        <div className="flex gap-2">
          {onRestart && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestart}
              className="h-6 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}
          {onSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-6 px-2 text-xs"
            >
              Skip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Tutorial step indicator
interface TutorialStepIndicatorProps {
  steps: Array<{ id: string; title: string; completed?: boolean; current?: boolean }>;
  className?: string;
}

export function TutorialStepIndicator({ steps, className }: TutorialStepIndicatorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg transition-colors",
            step.current && "bg-primary/10 border border-primary/20",
            step.completed && "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
          )}
        >
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
            step.completed && "bg-green-500 text-white",
            step.current && "bg-primary text-primary-foreground",
            !step.completed && !step.current && "bg-muted text-muted-foreground"
          )}>
            {step.completed ? "✓" : index + 1}
          </div>
          <span className={cn(
            "text-sm",
            step.completed && "text-green-700 dark:text-green-300",
            step.current && "text-primary font-medium",
            !step.completed && !step.current && "text-muted-foreground"
          )}>
            {step.title}
          </span>
        </div>
      ))}
    </div>
  );
}
