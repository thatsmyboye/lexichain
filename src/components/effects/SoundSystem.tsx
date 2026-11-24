import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface SoundContextType {
  /**
   * Play a sound effect. `index` is optional and only used by sounds that vary
   * per call — e.g. `playSound('tile_select', n)` plays the nth step of a rising scale.
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

// Recorded effects in public/sounds, rendered by scripts/sfx/render_sfx.py.
const SAMPLE_NAMES = [
  'tile_select_1',
  'tile_select_2',
  'tile_select_3',
  'word_complete',
  'word_invalid',
  'tier_up',
  'achievement',
  'game_start',
  'game_over',
  'hint_used',
  'tick',
  'button_click',
  'button_hover',
  'level_up',
  'success',
  'notification',
  'error',
  'page_turn',
] as const;

type SampleName = typeof SAMPLE_NAMES[number];

interface Sample {
  buffer: AudioBuffer;
  /** Seconds of encoder padding to skip so the attack lands on time. */
  offset: number;
}

const TILE_SELECT_VARIANTS: SampleName[] = ['tile_select_1', 'tile_select_2', 'tile_select_3'];
// The tile sample is an A5 marimba note. Each letter of a word steps up a
// C major pentatonic scale from C5, so any run of taps is in key with the
// word-complete chime. Values are semitones relative to the sample.
const TILE_SCALE = [-9, -7, -5, -2, 0, 3, 5, 7, 10, 12, 15];

// Web Audio API sound player.
// Plays the recorded samples, and falls back to synthesized tones while they
// are still loading or if they can't be fetched.
// The AudioContext is created lazily on the first play (which happens inside a
// user gesture), so browsers' autoplay policies don't leave it suspended.
class SoundGenerator {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5;
  private muted: boolean = false;
  private samples = new Map<SampleName, Sample>();
  private samplesRequested = false;
  private tileVariant = 0;

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    // Sound is opt-in, so nothing is downloaded until it is switched on.
    if (!muted) this.loadSamples();
  }

  private loadSamples() {
    if (this.samplesRequested || typeof window === 'undefined') return;
    this.samplesRequested = true;

    // Decoding on an OfflineAudioContext avoids creating the real context
    // outside a user gesture; the buffers play on any context.
    const OfflineCtor = window.OfflineAudioContext;
    if (!OfflineCtor) return;
    let decoder: OfflineAudioContext;
    try {
      decoder = new OfflineCtor(1, 1, 44100);
    } catch {
      return;
    }

    SAMPLE_NAMES.forEach(async name => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}sounds/${name}.mp3`);
        if (!response.ok) return;
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
        const data = buffer.getChannelData(0);
        let first = 0;
        while (first < data.length && Math.abs(data[first]) < 0.004) first++;
        const offset = first < data.length ? Math.max(0, first / buffer.sampleRate - 0.001) : 0;
        this.samples.set(name, { buffer, offset });
      } catch {
        // Leave this sound on its synthesized fallback.
      }
    });
  }

  /** Returns false when the sample isn't available, so the caller can fall back. */
  private playSample(name: SampleName, semitones: number = 0, gainScale: number = 1): boolean {
    if (this.muted) return true;
    const sample = this.samples.get(name);
    if (!sample) return false;
    const ctx = this.getContext();
    if (!ctx) return false;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = sample.buffer;
    source.playbackRate.value = Math.pow(2, semitones / 12);
    gainNode.gain.value = this.volume * gainScale;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(ctx.currentTime, sample.offset);
    return true;
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

    // Anything other than "running" needs a resume: "suspended" (created
    // outside a user gesture) and also iOS's "interrupted", which the engine
    // enters after a call, Siri, or the app going to the background.
    if (this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(() => {
        // Ignore: resume can be rejected outside a user gesture; next play will retry.
      });
    }

    return this.audioContext;
  }

  /**
   * Call from the tap that switches sound on. That tap is a user gesture, so
   * the audio engine can be started here for certain, and a short sound tells
   * the player it is on. Without this the engine first starts on the next tile
   * touch, which iOS does not always accept as a gesture (a drag is not one).
   */
  confirmEnabled() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // A silent one-sample buffer started inside the gesture: the long-standing
    // way to unlock audio on iOS, alongside the resume() above.
    try {
      const silence = ctx.createBufferSource();
      silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silence.connect(ctx.destination);
      silence.start();
    } catch {
      // The confirmation below still tries to play.
    }

    // The recordings start downloading on this same tap. Wait briefly for the
    // tile note so the confirmation is the real sound, not the fallback tone;
    // the engine is already running, so playing a moment later is allowed.
    const play = (attempt: number) => {
      if (this.muted) return;
      if (this.samples.has('tile_select_1') || attempt >= 10) this.playTileSelect(4);
      else window.setTimeout(() => play(attempt + 1), 100);
    };
    play(0);
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
    if (this.playSample('word_complete')) return;
    // Ascending major chord
    this.playChord([523.25, 659.25, 783.99], 0.3, 'sine');
  }

  playWordInvalid() {
    if (this.playSample('word_invalid')) return;
    // Descending minor chord
    this.playChord([523.25, 466.16, 415.30], 0.2, 'sawtooth');
  }

  playAchievement() {
    if (this.playSample('achievement')) return;
    // Triumphant fanfare
    this.playTone(523.25, 0.1, 'square');
    setTimeout(() => this.playTone(659.25, 0.1, 'square'), 100);
    setTimeout(() => this.playTone(783.99, 0.1, 'square'), 200);
    setTimeout(() => this.playTone(1046.50, 0.3, 'square'), 300);
  }

  playButtonClick() {
    if (this.playSample('button_click')) return;
    this.playTone(800, 0.1, 'square');
  }

  playButtonHover() {
    if (this.playSample('button_hover')) return;
    this.playTone(600, 0.05, 'sine');
  }

  playGameStart() {
    if (this.playSample('game_start')) return;
    // Upward arpeggio
    this.playTone(261.63, 0.2, 'sine');
    setTimeout(() => this.playTone(329.63, 0.2, 'sine'), 200);
    setTimeout(() => this.playTone(392.00, 0.2, 'sine'), 400);
    setTimeout(() => this.playTone(523.25, 0.4, 'sine'), 600);
  }

  playGameOver() {
    if (this.playSample('game_over')) return;
    // Descending arpeggio
    this.playTone(523.25, 0.3, 'sine');
    setTimeout(() => this.playTone(392.00, 0.3, 'sine'), 300);
    setTimeout(() => this.playTone(329.63, 0.3, 'sine'), 600);
    setTimeout(() => this.playTone(261.63, 0.5, 'sine'), 900);
  }

  playLevelUp() {
    if (this.playSample('level_up')) return;
    // Ascending scale
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.15, 'sine'), index * 100);
    });
  }

  playError() {
    if (this.playSample('error')) return;
    // Low buzz
    this.playTone(150, 0.5, 'sawtooth');
  }

  playSuccess() {
    if (this.playSample('success')) return;
    // High chime
    this.playTone(1046.50, 0.2, 'sine');
    setTimeout(() => this.playTone(1318.51, 0.2, 'sine'), 200);
  }

  playNotification() {
    if (this.playSample('notification')) return;
    // Gentle ping
    this.playTone(800, 0.1, 'sine');
    setTimeout(() => this.playTone(1000, 0.1, 'sine'), 100);
  }

  playHint() {
    if (this.playSample('hint_used')) return;
    this.playNotification();
  }

  playThemeChange() {
    if (this.playSample('page_turn')) return;
    this.playNotification();
  }

  playTileSelect(index: number = 0) {
    // Marimba tap that climbs the scale as the word grows
    const degree = Math.max(0, Math.min(TILE_SCALE.length - 1, Math.floor(index)));
    const variant = TILE_SELECT_VARIANTS[this.tileVariant++ % TILE_SELECT_VARIANTS.length];
    if (this.playSample(variant, TILE_SCALE[degree])) return;

    // Fallback: short soft blip; rises one semitone per letter (capped at two octaves)
    const step = Math.max(0, Math.min(24, Math.floor(index)));
    const frequency = 440 * Math.pow(2, step / 12);
    this.playTone(frequency, 0.07, 'sine', true, 0.6);
  }

  playTierUp() {
    if (this.playSample('tier_up')) return;
    // Short, bright major arpeggio
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, index === notes.length - 1 ? 0.18 : 0.09, 'triangle'), index * 55);
    });
  }

  playTick() {
    if (this.playSample('tick')) return;
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
    if (!muted) soundGeneratorRef.current?.confirmEnabled();
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
        generator.playNotification();
        break;
      case 'theme_change':
        generator.playThemeChange();
        break;
      case 'hint_used':
        generator.playHint();
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
