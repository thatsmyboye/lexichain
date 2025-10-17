import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

// Fade in animation
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 300, className }: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-opacity duration-300 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

// Slide in animation
interface SlideInProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  className?: string;
}

export function SlideIn({ 
  children, 
  direction = 'up', 
  delay = 0, 
  duration = 300, 
  className 
}: SlideInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getTransform = () => {
    if (!isVisible) {
      switch (direction) {
        case 'up': return 'translateY(20px)';
        case 'down': return 'translateY(-20px)';
        case 'left': return 'translateX(20px)';
        case 'right': return 'translateX(-20px)';
        default: return 'translateY(20px)';
      }
    }
    return 'translateY(0) translateX(0)';
  };

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms`,
        transform: getTransform()
      }}
    >
      {children}
    </div>
  );
}

// Scale in animation
interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  scale?: number;
  className?: string;
}

export function ScaleIn({ 
  children, 
  delay = 0, 
  duration = 300, 
  scale = 0.8, 
  className 
}: ScaleInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible ? "opacity-100 scale-100" : "opacity-0",
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms`,
        transform: isVisible ? 'scale(1)' : `scale(${scale})`
      }}
    >
      {children}
    </div>
  );
}

// Bounce animation
interface BounceProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function Bounce({ children, delay = 0, className }: BounceProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isVisible ? "animate-bounce" : "opacity-0 scale-50",
        className
      )}
    >
      {children}
    </div>
  );
}

// Pulse animation
interface PulseProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function Pulse({ children, delay = 0, className }: PulseProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible ? "animate-pulse" : "opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

// Shake animation
interface ShakeProps {
  children: React.ReactNode;
  trigger?: boolean;
  className?: string;
}

export function Shake({ children, trigger = false, className }: ShakeProps) {
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsShaking(true);
      const timer = setTimeout(() => {
        setIsShaking(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <div
      className={cn(
        "transition-all duration-200",
        isShaking && "animate-shake",
        className
      )}
    >
      {children}
    </div>
  );
}

// Glow effect
interface GlowProps {
  children: React.ReactNode;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export function Glow({ 
  children, 
  color = 'primary', 
  intensity = 'medium', 
  className 
}: GlowProps) {
  const getGlowClass = () => {
    const baseClass = 'shadow-lg';
    switch (intensity) {
      case 'low': return `${baseClass} shadow-${color}/20`;
      case 'medium': return `${baseClass} shadow-${color}/40`;
      case 'high': return `${baseClass} shadow-${color}/60`;
      default: return `${baseClass} shadow-${color}/40`;
    }
  };

  return (
    <div className={cn(getGlowClass(), className)}>
      {children}
    </div>
  );
}

// Typewriter effect
interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({ text, speed = 50, delay = 0, className }: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, speed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentIndex(0);
      setDisplayedText('');
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <span className={className}>
      {displayedText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// Floating animation
interface FloatingProps {
  children: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export function Floating({ 
  children, 
  intensity = 'medium', 
  className 
}: FloatingProps) {
  const getAnimationClass = () => {
    switch (intensity) {
      case 'low': return 'animate-float-low';
      case 'medium': return 'animate-float-medium';
      case 'high': return 'animate-float-high';
      default: return 'animate-float-medium';
    }
  };

  return (
    <div className={cn(getAnimationClass(), className)}>
      {children}
    </div>
  );
}

// Custom CSS animations
const animationStyles = `
@keyframes float-low {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}

@keyframes float-medium {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

@keyframes float-high {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-12px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.animate-float-low {
  animation: float-low 3s ease-in-out infinite;
}

.animate-float-medium {
  animation: float-medium 2.5s ease-in-out infinite;
}

.animate-float-high {
  animation: float-high 2s ease-in-out infinite;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = animationStyles;
  document.head.appendChild(styleSheet);
}
