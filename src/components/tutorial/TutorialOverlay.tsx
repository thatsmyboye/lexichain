import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ChevronLeft, ChevronRight, Play, Target, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'wait' | 'custom';
  customAction?: () => void;
  skipable?: boolean;
  required?: boolean;
  icon?: React.ReactNode;
  highlight?: boolean;
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onStepChange?: (stepIndex: number) => void;
  className?: string;
}

export function TutorialOverlay({
  steps,
  isActive,
  onComplete,
  onSkip,
  onStepChange,
  className
}: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      onStepChange?.(currentStep);
    } else {
      setIsVisible(false);
    }
  }, [isActive, currentStep, onStepChange]);

  useEffect(() => {
    if (!isActive || !currentStepData?.target) return;

    // Find and highlight the target element
    const targetElement = document.querySelector(currentStepData.target) as HTMLElement;
    targetElementRef.current = targetElement;

    if (targetElement) {
      // Add highlight class
      targetElement.classList.add('tutorial-highlight');
      
      // Scroll element into view
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });

      // Calculate position for tooltip
      const rect = targetElement.getBoundingClientRect();
      const overlay = overlayRef.current;
      
      if (overlay) {
        const position = currentStepData.position || 'bottom';
        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = rect.top - overlay.offsetHeight - 20;
            left = rect.left + rect.width / 2 - overlay.offsetWidth / 2;
            break;
          case 'bottom':
            top = rect.bottom + 20;
            left = rect.left + rect.width / 2 - overlay.offsetWidth / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - overlay.offsetHeight / 2;
            left = rect.left - overlay.offsetWidth - 20;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - overlay.offsetHeight / 2;
            left = rect.right + 20;
            break;
          case 'center':
            top = window.innerHeight / 2 - overlay.offsetHeight / 2;
            left = window.innerWidth / 2 - overlay.offsetWidth / 2;
            break;
        }

        // Ensure tooltip stays within viewport
        top = Math.max(10, Math.min(top, window.innerHeight - overlay.offsetHeight - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - overlay.offsetWidth - 10));

        overlay.style.top = `${top}px`;
        overlay.style.left = `${left}px`;
      }
    }

    return () => {
      if (targetElementRef.current) {
        targetElementRef.current.classList.remove('tutorial-highlight');
      }
    };
  }, [currentStep, currentStepData, isActive]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const handleAction = () => {
    if (currentStepData?.customAction) {
      currentStepData.customAction();
    }
    
    // Auto-advance for certain action types
    if (currentStepData?.action === 'click' || currentStepData?.action === 'custom') {
      setTimeout(handleNext, 500);
    }
  };

  if (!isVisible || !isActive) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" />
      
      {/* Tutorial Overlay */}
      <div
        ref={overlayRef}
        className={cn(
          "fixed z-50 w-80 max-w-[90vw] transition-all duration-300",
          className
        )}
      >
        <Card className="shadow-2xl border-2 border-primary/20 bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentStepData?.icon}
                <CardTitle className="text-lg">{currentStepData?.title}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {currentStep + 1} of {steps.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStepData?.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </Button>
                
                {currentStepData?.action && (
                  <Button
                    size="sm"
                    onClick={handleAction}
                    className="flex items-center gap-1"
                  >
                    {currentStepData.action === 'click' && <Target className="h-3 w-3" />}
                    {currentStepData.action === 'custom' && <Play className="h-3 w-3" />}
                    {currentStepData.action === 'wait' && <Zap className="h-3 w-3" />}
                    {currentStepData.action === 'click' ? 'Click Here' : 
                     currentStepData.action === 'custom' ? 'Try It' :
                     currentStepData.action === 'wait' ? 'Continue' : 'Next'}
                  </Button>
                )}
              </div>
              
              <Button
                size="sm"
                onClick={handleNext}
                className="flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// CSS for highlighting elements
const tutorialStyles = `
.tutorial-highlight {
  position: relative;
  z-index: 45;
  box-shadow: 0 0 0 4px hsl(var(--primary) / 0.3), 0 0 0 8px hsl(var(--primary) / 0.1);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.tutorial-highlight::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  background: hsl(var(--primary) / 0.1);
  border-radius: 12px;
  z-index: -1;
  animation: tutorial-pulse 2s infinite;
}

@keyframes tutorial-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = tutorialStyles;
  document.head.appendChild(styleSheet);
}
