import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface SoundContextType {
  /**
   * Play a sound effect. `index` is optional and only used by sounds that vary
   * per call — e.g. `playSound('tile_select', n)` raises the pitch by n semitones.
   */
  playSound: (soundType: SoundType, index?: number) => void;
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
  | 'notification'
  | 'skill_unlock'
  | 'theme_change'
  | 'achievement_unlock'
  | 'hint_used'
  | 'tile_select'
  | 'tier_up'
  | 'tick';

const SoundContext = createContext<SoundContextType | undefined>(undefined);

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

// Web Audio API sound generator.
// The AudioContext is created lazily on the first play (which happens inside a
// user gesture), so browsers' autoplay policies don't leave it suspended.
class SoundGenerator {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioContext) {
      const AudioContextCtor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextCtor) return null;
      try {
        this.audioContext = new AudioContextCtor();
      } catch {
        return null;
      }
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // Ignore: resume can be rejected outside a user gesture; next play will retry.
      });
    }

    return this.audioContext;
  }

  close() {
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
  }

  private createOscillator(frequency: number, type: OscillatorType = 'sine', gainScale: number = 1) {
    if (this.muted) return null;
    const ctx = this.getContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.3 * gainScale, ctx.currentTime + 0.005);

    return { ctx, oscillator, gainNode };
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    fadeOut: boolean = true,
    gainScale: number = 1
  ) {
    const sound = this.createOscillator(frequency, type, gainScale);
    if (!sound) return;

    const { ctx, oscillator, gainNode } = sound;

    oscillator.start(ctx.currentTime);

    if (fadeOut) {
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    }

    oscillator.stop(ctx.currentTime + duration);
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

  playTileSelect(index: number = 0) {
    // Short soft blip; rises one semitone per letter (capped at two octaves)
    const step = Math.max(0, Math.min(24, Math.floor(index)));
    const frequency = 440 * Math.pow(2, step / 12);
    this.playTone(frequency, 0.07, 'sine', true, 0.6);
  }

  playTierUp() {
    // Short, bright major arpeggio
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, index === notes.length - 1 ? 0.18 : 0.09, 'triangle'), index * 55);
    });
  }

  playTick() {
    // Very short click for countdowns
    this.playTone(1200, 0.02, 'square', true, 0.4);
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setMuted] = useState(true); // opt-in: muted until user enables in settings
  const soundGeneratorRef = useRef<SoundGenerator | null>(null);

  useEffect(() => {
    // No AudioContext is created here; SoundGenerator creates it on first play.
    const generator = new SoundGenerator();
    soundGeneratorRef.current = generator;

    // Load user preferences; default to muted if no saved preference
    const savedVolume = localStorage.getItem('lexichain-sound-volume');
    const savedMuted = localStorage.getItem('lexichain-sound-muted');

    if (savedVolume) {
      const vol = parseFloat(savedVolume);
      if (!Number.isNaN(vol)) {
        setVolume(vol);
        generator.setVolume(vol);
      }
    }

    const muted = savedMuted !== null ? savedMuted === 'true' : true;
    setMuted(muted);
    generator.setMuted(muted);

    return () => {
      generator.close();
      soundGeneratorRef.current = null;
    };
  }, []);

  const handleSetVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    soundGeneratorRef.current?.setVolume(newVolume);
    localStorage.setItem('lexichain-sound-volume', newVolume.toString());
  }, []);

  const handleSetMuted = useCallback((muted: boolean) => {
    setMuted(muted);
    soundGeneratorRef.current?.setMuted(muted);
    localStorage.setItem('lexichain-sound-muted', muted.toString());
  }, []);

  const playSound = useCallback((soundType: SoundType, index?: number) => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    switch (soundType) {
      case 'word_complete':
        generator.playWordComplete();
        break;
      case 'word_invalid':
        generator.playWordInvalid();
        break;
      case 'achievement':
      case 'achievement_unlock':
        generator.playAchievement();
        break;
      case 'button_click':
        generator.playButtonClick();
        break;
      case 'button_hover':
        generator.playButtonHover();
        break;
      case 'game_start':
        generator.playGameStart();
        break;
      case 'game_over':
        generator.playGameOver();
        break;
      case 'level_up':
        generator.playLevelUp();
        break;
      case 'error':
        generator.playError();
        break;
      case 'success':
      case 'skill_unlock':
        generator.playSuccess();
        break;
      case 'notification':
      case 'theme_change':
      case 'hint_used':
        generator.playNotification();
        break;
      case 'tile_select':
        generator.playTileSelect(index ?? 0);
        break;
      case 'tier_up':
        generator.playTierUp();
        break;
      case 'tick':
        generator.playTick();
        break;
    }
  }, []);

  const value = useMemo<SoundContextType>(() => ({
    playSound,
    setVolume: handleSetVolume,
    setMuted: handleSetMuted,
    isMuted,
    volume
  }), [playSound, handleSetVolume, handleSetMuted, isMuted, volume]);

  return (
    <SoundContext.Provider value={value}>
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
  const { volume, isMuted, setVolume, setMuted, playSound } = useSound();
  const switchId = useId();
  const volumeId = useId();
  const descriptionId = useId();

  const handleToggle = (enabled: boolean) => {
    setMuted(!enabled);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <label htmlFor={switchId} className="text-sm font-medium">Sound Effects</label>
          <p id={descriptionId} className="text-xs text-muted-foreground">
            Sounds are off by default. Turn them on to hear feedback for tiles, words, and timers.
          </p>
        </div>
        <Switch
          id={switchId}
          checked={!isMuted}
          onCheckedChange={handleToggle}
          aria-label="Sound effects"
          aria-describedby={descriptionId}
        />
      </div>

      {!isMuted && (
        <div className="space-y-2">
          <label htmlFor={volumeId} className="text-sm font-medium">Volume</label>
          <input
            id={volumeId}
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            onPointerUp={() => playSound('tile_select', 4)}
            onKeyUp={(e) => {
              if (e.key.startsWith('Arrow') || ['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                playSound('tile_select', 4);
              }
            }}
            aria-valuetext={`${Math.round(volume * 100)}%`}
            className="w-full accent-[hsl(var(--brand-500))]"
          />
          <div className="text-xs text-muted-foreground text-center" aria-hidden="true">
            {Math.round(volume * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}
