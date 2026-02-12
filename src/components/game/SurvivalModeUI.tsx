/**
 * Survival Mode UI Components
 *
 * UI elements for displaying the enhanced Survival mode features including
 * challenges, bosses, power-ups, shop, events, and combos.
 */

import React from 'react';
import {
  WaveChallenge,
  BossWave,
  PowerUp,
  ActivePowerUp,
  ComboState,
  ShopItem,
  ChoiceEvent,
  SurvivalState
} from '@/lib/survivalMode';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  Heart,
  Zap,
  Flame,
  Star,
  Clock,
  Award,
  ShoppingCart,
  Gift
} from 'lucide-react';

// ============================================================================
// LIVES DISPLAY
// ============================================================================

interface LivesDisplayProps {
  lives: number;
  maxLives: number;
  shields: number;
  lifeFragments: number;
}

export function LivesDisplay({ lives, maxLives, shields, lifeFragments }: LivesDisplayProps) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Lives</div>
        <div className="flex items-center gap-1">
          {Array.from({ length: maxLives }).map((_, i) => (
            <span
              key={i}
              className={`text-xl transition-all duration-300 ${
                i < lives ? '' : 'opacity-30 grayscale'
              }`}
            >
              ❤️
            </span>
          ))}
        </div>
      </div>

      {shields > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-400 font-medium">×{shields}</span>
        </div>
      )}

      {lifeFragments > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-lg border border-purple-500/30">
          <span className="text-sm">💎</span>
          <span className="text-sm text-purple-400 font-medium">{lifeFragments}/3</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WAVE CHALLENGE DISPLAY
// ============================================================================

interface WaveChallengeDisplayProps {
  challenge: WaveChallenge;
  progress: number;
  timeRemaining?: number;
}

export function WaveChallengeDisplay({ challenge, progress, timeRemaining }: WaveChallengeDisplayProps) {
  const target = challenge.target || 5;
  const progressPercent = challenge.type === 'score_target'
    ? Math.min(100, (progress / target) * 100)
    : Math.min(100, (progress / target) * 100);

  return (
    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-400">Wave Challenge</span>
        </div>
        {timeRemaining !== undefined && (
          <div className="flex items-center gap-1 text-sm text-orange-400">
            <Clock className="w-3 h-3" />
            <span>{timeRemaining}s</span>
          </div>
        )}
      </div>

      <div className="text-sm text-foreground mb-2">{challenge.description}</div>

      <div className="space-y-1">
        <Progress value={progressPercent} className="h-2" />
        <div className="text-xs text-muted-foreground">
          {challenge.type === 'score_target'
            ? `${progress}/${target} points`
            : `${progress}/${target} complete`}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BOSS WAVE DISPLAY
// ============================================================================

interface BossWaveDisplayProps {
  boss: BossWave;
  progress: number;
  timeRemaining?: number;
}

export function BossWaveDisplay({ boss, progress, timeRemaining }: BossWaveDisplayProps) {
  return (
    <div className="p-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg border-2 border-orange-500/50 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{boss.icon}</span>
          <div>
            <div className="text-lg font-bold text-orange-500">BOSS WAVE!</div>
            <div className="text-xs text-muted-foreground">{boss.description}</div>
          </div>
        </div>
        {timeRemaining !== undefined && (
          <div className="flex items-center gap-1 text-lg text-orange-400 font-bold">
            <Clock className="w-5 h-5" />
            <span>{timeRemaining}s</span>
          </div>
        )}
      </div>

      {boss.type === 'letter_lockout' && boss.bannedLetters && boss.bannedLetters.length > 0 && (
        <div className="mt-2 p-2 bg-red-500/20 rounded border border-red-500/30">
          <div className="text-xs text-red-400">Banned Letters:</div>
          <div className="text-sm font-bold text-red-500">
            {boss.bannedLetters.join(', ')}
          </div>
        </div>
      )}

      {(boss.type === 'multi_word' || boss.type === 'time_trial' || boss.type === 'stone_gauntlet' || boss.type === 'letter_lockout' || boss.type === 'perfect_wave') && (
        <div className="mt-2 text-sm text-orange-400 font-medium">
          Progress: {progress}/{boss.requirement}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMBO DISPLAY
// ============================================================================

interface ComboDisplayProps {
  comboState: ComboState;
}

export function ComboDisplay({ comboState }: ComboDisplayProps) {
  if (comboState.currentCombo < 3) return null;

  const getComboColor = (combo: number) => {
    if (combo >= 15) return 'from-purple-500 to-pink-500';
    if (combo >= 10) return 'from-red-500 to-orange-500';
    if (combo >= 7) return 'from-orange-500 to-yellow-500';
    if (combo >= 5) return 'from-yellow-500 to-green-500';
    return 'from-green-500 to-blue-500';
  };

  const getComboLabel = (combo: number) => {
    if (combo >= 15) return 'LEGENDARY COMBO!';
    if (combo >= 10) return 'EPIC COMBO!';
    if (combo >= 7) return 'MEGA COMBO!';
    if (combo >= 5) return 'SUPER COMBO!';
    return 'COMBO!';
  };

  return (
    <div className={`p-3 bg-gradient-to-r ${getComboColor(comboState.currentCombo)}/20 rounded-lg border-2 border-current animate-bounce`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <div>
            <div className="text-sm font-bold text-orange-500">{getComboLabel(comboState.currentCombo)}</div>
            <div className="text-xs text-muted-foreground">
              {comboState.currentCombo} words • {comboState.comboMultiplier.toFixed(1)}x multiplier
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold text-orange-500">
          {comboState.currentCombo}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// POWER-UPS INVENTORY
// ============================================================================

interface PowerUpsInventoryProps {
  activePowerUps: ActivePowerUp[];
  inventoryPowerUps: PowerUp[];
  onActivate: (powerUp: PowerUp) => void;
}

export function PowerUpsInventory({ activePowerUps, inventoryPowerUps, onActivate }: PowerUpsInventoryProps) {
  if (activePowerUps.length === 0 && inventoryPowerUps.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Active Power-Ups */}
      {activePowerUps.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Active Power-Ups</div>
          <div className="flex gap-2 flex-wrap">
            {activePowerUps.map((ap, idx) => (
              <div
                key={idx}
                className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1 ${
                  ap.powerUp.rarity === 'epic'
                    ? 'bg-purple-500/20 border-purple-500/30'
                    : ap.powerUp.rarity === 'rare'
                    ? 'bg-blue-500/20 border-blue-500/30'
                    : 'bg-green-500/20 border-green-500/30'
                }`}
              >
                <span>{ap.powerUp.icon}</span>
                <span className={ap.powerUp.color}>{ap.powerUp.name}</span>
                {ap.remainingUses !== undefined && <span className="text-muted-foreground">×{ap.remainingUses}</span>}
                {ap.remainingWaves !== undefined && <span className="text-muted-foreground">({ap.remainingWaves}w)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Power-Ups */}
      {inventoryPowerUps.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Inventory</div>
          <div className="flex gap-2 flex-wrap">
            {inventoryPowerUps.map((pu, idx) => (
              <button
                key={idx}
                onClick={() => onActivate(pu)}
                className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1 hover:scale-105 transition-transform ${
                  pu.rarity === 'epic'
                    ? 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20'
                    : pu.rarity === 'rare'
                    ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20'
                    : 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                }`}
                title={pu.description}
              >
                <span>{pu.icon}</span>
                <span className={pu.color}>{pu.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SHOP MODAL
// ============================================================================

interface ShopModalProps {
  items: ShopItem[];
  currentScore: number;
  currentLives: number;
  onPurchase: (item: ShopItem) => void;
  onClose: () => void;
}

export function ShopModal({ items, currentScore, currentLives, onPurchase, onClose }: ShopModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg border border-border max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold">Wave Shop</h2>
            </div>
            <div className="text-sm text-muted-foreground">
              Your Score: <span className="font-bold text-foreground">{currentScore}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  item.available
                    ? 'bg-card hover:bg-accent/50 cursor-pointer transition-colors'
                    : 'bg-muted/30 opacity-50 cursor-not-allowed'
                }`}
                onClick={() => item.available && onPurchase(item)}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{item.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{item.name}</div>
                    <div className="text-xs text-muted-foreground mb-2">{item.description}</div>
                    <div className="flex items-center justify-between">
                      <div className={`text-sm font-bold ${
                        item.rarity === 'epic' ? 'text-purple-500' :
                        item.rarity === 'rare' ? 'text-blue-500' :
                        'text-green-500'
                      }`}>
                        {item.costType === 'points' ? '💰' : '❤️'} {item.cost}
                      </div>
                      {!item.available && (
                        <span className="text-xs text-red-500">Not enough {item.costType}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline">
              Close Shop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CHOICE EVENT MODAL
// ============================================================================

interface ChoiceEventModalProps {
  event: ChoiceEvent;
  onChoice: (optionIndex: number) => void;
}

export function ChoiceEventModal({ event, onChoice }: ChoiceEventModalProps) {
  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'border-green-500/30 hover:bg-green-500/10';
      case 'medium': return 'border-yellow-500/30 hover:bg-yellow-500/10';
      case 'high': return 'border-red-500/30 hover:bg-red-500/10';
    }
  };

  const getRiskLabel = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return '🟢 Low Risk';
      case 'medium': return '🟡 Medium Risk';
      case 'high': return '🔴 High Risk';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg border border-border max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl">{event.icon}</div>
            <div>
              <h2 className="text-xl font-bold">{event.prompt}</h2>
              <p className="text-sm text-muted-foreground">{event.description}</p>
            </div>
          </div>

          <div className="space-y-3">
            {event.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => onChoice(idx)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${getRiskColor(option.risk)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-medium flex-1">{option.text}</div>
                  <div className="text-xs ml-2">{getRiskLabel(option.risk)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// WAVE COMPLETE MODAL
// ============================================================================

interface WaveCompleteModalProps {
  wave: number;
  score: number;
  wordsFound: number;
  perfectWave: boolean;
  livesGained: number;
  powerUpsEarned: PowerUp[];
  onContinue: () => void;
}

export function WaveCompleteModal({
  wave,
  score,
  wordsFound,
  perfectWave,
  livesGained,
  powerUpsEarned,
  onContinue
}: WaveCompleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg border border-border max-w-md w-full">
        <div className="p-6 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">Wave {wave} Complete!</h2>

          <div className="space-y-3 my-6">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Words Found</span>
              <span className="font-bold">{wordsFound}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Wave Score</span>
              <span className="font-bold">{score}</span>
            </div>

            {perfectWave && (
              <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                <div className="text-sm font-bold text-yellow-500">✨ PERFECT WAVE! ✨</div>
                <div className="text-xs text-muted-foreground">No mistakes!</div>
              </div>
            )}

            {livesGained > 0 && (
              <div className="p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                <div className="text-sm font-bold text-green-500">❤️ +{livesGained} Life</div>
              </div>
            )}

            {powerUpsEarned.length > 0 && (
              <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <div className="text-sm font-bold text-purple-500 mb-2">Power-Ups Earned!</div>
                <div className="flex gap-2 justify-center flex-wrap">
                  {powerUpsEarned.map((pu, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-xs">
                      <span>{pu.icon}</span>
                      <span>{pu.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button onClick={onContinue} className="w-full" size="lg">
            Continue to Wave {wave + 1}
          </Button>
        </div>
      </div>
    </div>
  );
}
