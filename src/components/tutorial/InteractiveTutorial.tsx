import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Target, Trophy, Zap, BookOpen, CheckCircle } from 'lucide-react';
import { TutorialOverlay } from './TutorialOverlay';
import { useTutorial } from './TutorialSteps';
import { cn } from '@/lib/utils';

interface InteractiveTutorialProps {
  onComplete?: () => void;
  onSkip?: () => void;
  className?: string;
}

export function InteractiveTutorial({ onComplete, onSkip, className }: InteractiveTutorialProps) {
  const {
    isActive,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    getTutorialSteps
  } = useTutorial();

  const [showWelcome, setShowWelcome] = useState(false);
  const [tutorialProgress, setTutorialProgress] = useState(0);

  useEffect(() => {
    // Show welcome screen for new users
    if (!hasCompletedTutorial) {
      setShowWelcome(true);
    }
  }, [hasCompletedTutorial]);

  const handleStartTutorial = () => {
    setShowWelcome(false);
    startTutorial('main');
  };

  const handleCompleteTutorial = () => {
    completeTutorial();
    onComplete?.();
  };

  const handleSkipTutorial = () => {
    setShowWelcome(false);
    skipTutorial();
    onSkip?.();
  };

  const handleStepChange = (stepIndex: number) => {
    const progress = ((stepIndex + 1) / getTutorialSteps().length) * 100;
    setTutorialProgress(progress);
  };

  if (showWelcome && !isActive) {
    return (
      <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
        <Card className="w-full max-w-md mx-4 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to Lexichain!</CardTitle>
            <p className="text-muted-foreground">
              Let's take a quick tour to get you started with this word-chaining puzzle game.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Draw Word Paths</p>
                  <p className="text-xs text-muted-foreground">Connect letters to form words</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Trophy className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Chain Words Together</p>
                  <p className="text-xs text-muted-foreground">Each word must reuse a tile from the previous</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Earn Achievements</p>
                  <p className="text-xs text-muted-foreground">Unlock rewards and climb leaderboards</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSkipTutorial}
                className="flex-1"
              >
                Skip Tutorial
              </Button>
              <Button
                onClick={handleStartTutorial}
                className="flex-1 flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TutorialOverlay
      steps={getTutorialSteps()}
      isActive={isActive}
      onComplete={handleCompleteTutorial}
      onSkip={handleSkipTutorial}
      onStepChange={handleStepChange}
      className={className}
    />
  );
}

// Tutorial progress indicator component
export function TutorialProgress({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Tutorial Progress</span>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

// Tutorial completion celebration
export function TutorialCompletion({ onClose }: { onClose: () => void }) {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setShowCelebration(true);
    const timer = setTimeout(() => {
      setShowCelebration(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="text-center">
          <div className={cn(
            "mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center transition-all duration-500",
            showCelebration && "scale-110"
          )}>
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Tutorial Complete!</CardTitle>
          <p className="text-muted-foreground">
            You're ready to start playing Lexichain. Good luck and have fun!
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              Ready to Play
            </Badge>
          </div>
          
          <Button
            onClick={onClose}
            className="w-full"
          >
            Start Playing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
