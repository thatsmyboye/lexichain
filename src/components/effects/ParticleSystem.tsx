import React, { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

interface ParticleSystemProps {
  particles: Particle[];
  className?: string;
}

export function ParticleSystem({ particles, className }: ParticleSystemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const animate = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particles.forEach((particle, index) => {
      // Update particle
      particle.x += particle.vx * deltaTime * 0.01;
      particle.y += particle.vy * deltaTime * 0.01;
      particle.life -= deltaTime * 0.001;
      particle.alpha = particle.life / particle.maxLife;

      // Remove dead particles
      if (particle.life <= 0) {
        particles.splice(index, 1);
        return;
      }

      // Draw particle
      ctx.save();
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Continue animation if there are particles
    if (particles.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [particles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Start animation if there are particles
    if (particles.length > 0) {
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [particles, animate]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{ zIndex: 10 }}
    />
  );
}

// Particle effects for different game events
export const createWordCompletionParticles = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
  
  for (let i = 0; i < 15; i++) {
    const angle = (Math.PI * 2 * i) / 15;
    const speed = 50 + Math.random() * 100;
    
    particles.push({
      id: Math.random(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 1,
      size: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    });
  }
  
  return particles;
};

export const createAchievementParticles = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  const colors = ['#fbbf24', '#f59e0b', '#d97706', '#92400e'];
  
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 80;
    
    particles.push({
      id: Math.random(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20, // Slight upward bias
      life: 1.5,
      maxLife: 1.5,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    });
  }
  
  return particles;
};

export const createScoreParticles = (x: number, y: number, score: number): Particle[] => {
  const particles: Particle[] = [];
  const colors = ['#10b981', '#059669', '#047857'];
  
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const speed = 40 + Math.random() * 60;
    
    particles.push({
      id: Math.random(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8,
      maxLife: 0.8,
      size: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    });
  }
  
  return particles;
};

// Hook for managing particle effects
export function useParticleEffects() {
  const [particles, setParticles] = React.useState<Particle[]>([]);

  const addParticles = useCallback((newParticles: Particle[]) => {
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const clearParticles = useCallback(() => {
    setParticles([]);
  }, []);

  const triggerWordCompletion = useCallback((x: number, y: number) => {
    const newParticles = createWordCompletionParticles(x, y);
    addParticles(newParticles);
  }, [addParticles]);

  const triggerAchievement = useCallback((x: number, y: number) => {
    const newParticles = createAchievementParticles(x, y);
    addParticles(newParticles);
  }, [addParticles]);

  const triggerScore = useCallback((x: number, y: number, score: number) => {
    const newParticles = createScoreParticles(x, y, score);
    addParticles(newParticles);
  }, [addParticles]);

  return {
    particles,
    addParticles,
    clearParticles,
    triggerWordCompletion,
    triggerAchievement,
    triggerScore
  };
}
