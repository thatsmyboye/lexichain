import { useState } from "react";
import { FirstRunTutorial, shouldShowFirstRunTutorial } from "./FirstRunTutorial";

interface InteractiveTutorialProps {
  onComplete?: () => void;
  onSkip?: () => void;
  /** Open even if the player has already seen the tutorial. */
  forceOpen?: boolean;
}

/**
 * Drop-in first-run tutorial: opens itself the first time a player visits
 * and never again once they finish or skip it. Use FirstRunTutorial directly
 * to control `open` yourself (e.g. from a "How to play" button).
 */
export function InteractiveTutorial({ onComplete, onSkip, forceOpen = false }: InteractiveTutorialProps) {
  const [open, setOpen] = useState(() => forceOpen || shouldShowFirstRunTutorial());

  return (
    <FirstRunTutorial
      open={open}
      onClose={(completed) => {
        setOpen(false);
        if (completed) onComplete?.();
        else onSkip?.();
      }}
    />
  );
}

export default InteractiveTutorial;
