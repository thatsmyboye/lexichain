import React from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, HardDrive } from "lucide-react";
import type { SaveProgress } from "@/utils/dailyChallengeResultSaver";

interface DailyChallengeSaveIndicatorProps {
  progress?: SaveProgress;
  className?: string;
}

export function DailyChallengeSaveIndicator({ 
  progress, 
  className = "" 
}: DailyChallengeSaveIndicatorProps) {
  if (!progress) return null;

  const getIndicatorContent = () => {
    switch (progress.stage) {
      case 'validation':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: "Validating...",
          variant: "secondary" as const
        };
      
      case 'basic_save':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: "Saving core result...",
          variant: "secondary" as const
        };
      
      case 'enhanced_save':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: "Saving analytics...",
          variant: "secondary" as const
        };
      
      case 'backup':
        return {
          icon: <HardDrive className="h-3 w-3" />,
          text: "Saved locally",
          variant: "outline" as const
        };
      
      case 'complete':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: "Saved successfully!",
          variant: "default" as const
        };
      
      case 'failed':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: `Failed: ${progress.error || 'Unknown error'}`,
          variant: "destructive" as const
        };
      
      default:
        return null;
    }
  };

  const content = getIndicatorContent();
  if (!content) return null;

  return (
    <Badge variant={content.variant} className={`flex items-center gap-1 ${className}`}>
      {content.icon}
      <span className="text-xs">{content.text}</span>
    </Badge>
  );
}