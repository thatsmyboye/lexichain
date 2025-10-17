import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface SoundContextType {
  playSound: (soundType: SoundType) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  isMuted: boolean;
  volume: number;
}

export type SoundType = 
  | 'word_complete'
  | 'word_invalid'
  | 'achievement'
  | 'button_click'
  | 'button_hover'
  | 'game_start'
  | 'game_over'
  | 'level_up'
  | 'error'
  | 'success'
  | 'notification';

const SoundContext = createContext<SoundContextType | undefined>(undefined);

// Web Audio API sound generator
class SoundGenerator {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  private createOscillator(frequency: number, type: OscillatorType = 'sine') {
    if (!this.audioContext || this.muted) return null;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
    
    return { oscillator, gainNode };
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', fadeOut: boolean = true) {
    const sound = this.createOscillator(frequency, type);
    if (!sound) return;

    const { oscillator, gainNode } = sound;
    
    oscillator.start(this.audioContext!.currentTime);
    
    if (fadeOut) {
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + duration);
    }
    
    oscillator.stop(this.audioContext!.currentTime + duration);
  }

  private playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine') {
    frequencies.forEach(freq => {
      this.playTone(freq, duration, type);
    });
  }

  playWordComplete() {
    // Ascending major chord
    this.playChord([523.25, 659.25, 783.99], 0.3, 'sine');
  }

  playWordInvalid() {
    // Descending minor chord
    this.playChord([523.25, 466.16, 415.30], 0.2, 'sawtooth');
  }

  playAchievement() {
    // Triumphant fanfare
    this.playTone(523.25, 0.1, 'square');
    setTimeout(() => this.playTone(659.25, 0.1, 'square'), 100);
    setTimeout(() => this.playTone(783.99, 0.1, 'square'), 200);
    setTimeout(() => this.playTone(1046.50, 0.3, 'square'), 300);
  }

  playButtonClick() {
    this.playTone(800, 0.1, 'square');
  }

  playButtonHover() {
    this.playTone(600, 0.05, 'sine');
  }

  playGameStart() {
    // Upward arpeggio
    this.playTone(261.63, 0.2, 'sine');
    setTimeout(() => this.playTone(329.63, 0.2, 'sine'), 200);
    setTimeout(() => this.playTone(392.00, 0.2, 'sine'), 400);
    setTimeout(() => this.playTone(523.25, 0.4, 'sine'), 600);
  }

  playGameOver() {
    // Descending arpeggio
    this.playTone(523.25, 0.3, 'sine');
    setTimeout(() => this.playTone(392.00, 0.3, 'sine'), 300);
    setTimeout(() => this.playTone(329.63, 0.3, 'sine'), 600);
    setTimeout(() => this.playTone(261.63, 0.5, 'sine'), 900);
  }

  playLevelUp() {
    // Ascending scale
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.15, 'sine'), index * 100);
    });
  }

  playError() {
    // Low buzz
    this.playTone(150, 0.5, 'sawtooth');
  }

  playSuccess() {
    // High chime
    this.playTone(1046.50, 0.2, 'sine');
    setTimeout(() => this.playTone(1318.51, 0.2, 'sine'), 200);
  }

  playNotification() {
    // Gentle ping
    this.playTone(800, 0.1, 'sine');
    setTimeout(() => this.playTone(1000, 0.1, 'sine'), 100);
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setMuted] = useState(false);
  const soundGeneratorRef = useRef<SoundGenerator | null>(null);

  useEffect(() => {
    soundGeneratorRef.current = new SoundGenerator();
    
    // Load user preferences
    const savedVolume = localStorage.getItem('lexichain-sound-volume');
    const savedMuted = localStorage.getItem('lexichain-sound-muted');
    
    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      setVolume(vol);
      soundGeneratorRef.current.setVolume(vol);
    }
    
    if (savedMuted) {
      const muted = savedMuted === 'true';
      setMuted(muted);
      soundGeneratorRef.current.setMuted(muted);
    }

    return () => {
      soundGeneratorRef.current = null;
    };
  }, []);

  const handleSetVolume = (newVolume: number) => {
    setVolume(newVolume);
    soundGeneratorRef.current?.setVolume(newVolume);
    localStorage.setItem('lexichain-sound-volume', newVolume.toString());
  };

  const handleSetMuted = (muted: boolean) => {
    setMuted(muted);
    soundGeneratorRef.current?.setMuted(muted);
    localStorage.setItem('lexichain-sound-muted', muted.toString());
  };

  const playSound = (soundType: SoundType) => {
    if (!soundGeneratorRef.current) return;

    switch (soundType) {
      case 'word_complete':
        soundGeneratorRef.current.playWordComplete();
        break;
      case 'word_invalid':
        soundGeneratorRef.current.playWordInvalid();
        break;
      case 'achievement':
        soundGeneratorRef.current.playAchievement();
        break;
      case 'button_click':
        soundGeneratorRef.current.playButtonClick();
        break;
      case 'button_hover':
        soundGeneratorRef.current.playButtonHover();
        break;
      case 'game_start':
        soundGeneratorRef.current.playGameStart();
        break;
      case 'game_over':
        soundGeneratorRef.current.playGameOver();
        break;
      case 'level_up':
        soundGeneratorRef.current.playLevelUp();
        break;
      case 'error':
        soundGeneratorRef.current.playError();
        break;
      case 'success':
        soundGeneratorRef.current.playSuccess();
        break;
      case 'notification':
        soundGeneratorRef.current.playNotification();
        break;
    }
  };

  return (
    <SoundContext.Provider
      value={{
        playSound,
        setVolume: handleSetVolume,
        setMuted: handleSetMuted,
        isMuted,
        volume
      }}
    >
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}

// Sound button component
import { Button, ButtonProps } from '@/components/ui/button';

export interface SoundButtonProps extends ButtonProps {
  soundType?: SoundType;
}

export function SoundButton({ 
  children, 
  soundType = 'button_click', 
  onClick, 
  disabled = false,
  ...props
}: SoundButtonProps) {
  const { playSound } = useSound();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      playSound(soundType);
      onClick?.(e);
    }
  };

  const handleMouseEnter = () => {
    if (!disabled) {
      playSound('button_hover');
    }
  };

  return (
    <Button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      disabled={disabled}
      {...props}
    >
      {children}
    </Button>
  );
}

// Sound settings component
export function SoundSettings() {
  const { volume, isMuted, setVolume, setMuted } = useSound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Sound Effects</label>
        <button
          onClick={() => setMuted(!isMuted)}
          className={`w-12 h-6 rounded-full transition-colors ${
            isMuted ? 'bg-muted' : 'bg-primary'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              isMuted ? 'translate-x-1' : 'translate-x-6'
            }`}
          />
        </button>
      </div>
      
      {!isMuted && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground text-center">
            {Math.round(volume * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}
