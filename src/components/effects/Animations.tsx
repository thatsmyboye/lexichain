import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 300, className }: FadeInProps) {
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setIsVisible(true); return; }
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reducedMotion]);

  return (
    <div
      className={cn(
        !reducedMotion && "transition-opacity ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
      style={!reducedMotion ? { transitionDuration: `${duration}ms` } : undefined}
    >
      {children}
    </div>
  );
}

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
  className,
}: SlideInProps) {
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setIsVisible(true); return; }
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reducedMotion]);

  const getTransform = () => {
    if (reducedMotion || isVisible) return 'translateY(0) translateX(0)';
    switch (direction) {
      case 'up': return 'translateY(20px)';
      case 'down': return 'translateY(-20px)';
      case 'left': return 'translateX(20px)';
      case 'right': return 'translateX(-20px)';
      default: return 'translateY(20px)';
    }
  };

  return (
    <div
      className={cn(
        !reducedMotion && "transition-all ease-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
      style={!reducedMotion ? { transitionDuration: `${duration}ms`, transform: getTransform() } : undefined}
    >
      {children}
    </div>
  );
}

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
  className,
}: ScaleInProps) {
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setIsVisible(true); return; }
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reducedMotion]);

  return (
    <div
      className={cn(
        !reducedMotion && "transition-all ease-out",
        isVisible ? "opacity-100 scale-100" : "opacity-0",
        className
      )}
      style={!reducedMotion ? {
        transitionDuration: `${duration}ms`,
        transform: isVisible ? 'scale(1)' : `scale(${scale})`,
      } : undefined}
    >
      {children}
    </div>
  );
}

interface BounceProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function Bounce({ children, delay = 0, className }: BounceProps) {
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setIsVisible(true); return; }
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reducedMotion]);

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isVisible ? (reducedMotion ? "" : "animate-bounce") : "opacity-0 scale-50",
        className
      )}
    >
      {children}
    </div>
  );
}

interface PulseProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function Pulse({ children, delay = 0, className }: PulseProps) {
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) { setIsVisible(true); return; }
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay, reducedMotion]);

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isVisible ? (reducedMotion ? "" : "animate-pulse") : "opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

interface ShakeProps {
  children: React.ReactNode;
  trigger?: boolean;
  className?: string;
}

export function Shake({ children, trigger = false, className }: ShakeProps) {
  const reducedMotion = useReducedMotion();
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (reducedMotion || !trigger) return;
    setIsShaking(true);
    const timer = setTimeout(() => setIsShaking(false), 500);
    return () => clearTimeout(timer);
  }, [trigger, reducedMotion]);

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

interface GlowProps {
  children: React.ReactNode;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export function Glow({ children, color = 'primary', intensity = 'medium', className }: GlowProps) {
  const getGlowClass = () => {
    const baseClass = 'shadow-lg';
    switch (intensity) {
      case 'low': return `${baseClass} shadow-${color}/20`;
      case 'medium': return `${baseClass} shadow-${color}/40`;
      case 'high': return `${baseClass} shadow-${color}/60`;
      default: return `${baseClass} shadow-${color}/40`;
    }
  };

  return <div className={cn(getGlowClass(), className)}>{children}</div>;
}

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({ text, speed = 50, delay = 0, className }: TypewriterProps) {
  const reducedMotion = useReducedMotion();
  const [displayedText, setDisplayedText] = useState(reducedMotion ? text : '');
  const [currentIndex, setCurrentIndex] = useState(reducedMotion ? text.length : 0);

  useEffect(() => {
    if (reducedMotion) { setDisplayedText(text); return; }
    const timer = setTimeout(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }
    }, speed);
    return () => clearTimeout(timer);
  }, [currentIndex, text, speed, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => { setCurrentIndex(0); setDisplayedText(''); }, delay);
    return () => clearTimeout(timer);
  }, [delay, reducedMotion]);

  return (
    <span className={className}>
      {displayedText}
      {!reducedMotion && <span className="animate-pulse">|</span>}
    </span>
  );
}

interface FloatingProps {
  children: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export function Floating({ children, intensity = 'medium', className }: FloatingProps) {
  const reducedMotion = useReducedMotion();

  const getAnimationClass = () => {
    if (reducedMotion) return '';
    switch (intensity) {
      case 'low': return 'animate-float-low';
      case 'medium': return 'animate-float-medium';
      case 'high': return 'animate-float-high';
      default: return 'animate-float-medium';
    }
  };

  return <div className={cn(getAnimationClass(), className)}>{children}</div>;
}

// Custom CSS animations (injected once)
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
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes tile-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.045); }
}
@keyframes tile-tick {
  0%, 88%, 100% { transform: rotate(0deg); }
  91% { transform: rotate(-2.5deg); }
  94% { transform: rotate(2.5deg); }
  97% { transform: rotate(-1.5deg); }
}
@keyframes tile-fade {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 0.55; }
}
.animate-float-low { animation: float-low 3s ease-in-out infinite; }
.animate-float-medium { animation: float-medium 2.5s ease-in-out infinite; }
.animate-float-high { animation: float-high 2s ease-in-out infinite; }
.animate-shake { animation: shake 0.5s ease-in-out; }
.animate-blink-twice { animation: blink 0.6s ease-in-out 2; }
.animate-tile-pulse { animation: tile-pulse 2.2s ease-in-out infinite; }
.animate-tile-tick { animation: tile-tick 1.8s ease-in-out infinite; }
.animate-tile-fade { animation: tile-fade 2.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .animate-float-low,
  .animate-float-medium,
  .animate-float-high,
  .animate-shake,
  .animate-bounce,
  .animate-pulse,
  .animate-spin,
  .animate-blink-twice,
  .animate-tile-pulse,
  .animate-tile-tick,
  .animate-tile-fade {
    animation: none !important;
  }
  * {
    transition-duration: 0.01ms !important;
  }
}
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = animationStyles;
  document.head.appendChild(styleSheet);
}
