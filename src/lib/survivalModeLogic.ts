/**
 * Survival Mode Game Logic
 *
 * This file contains the core game logic for the enhanced Survival mode,
 * including challenge validation, boss mechanics, power-up effects, and more.
 */

import {
  WaveChallenge,
  BossWave,
  PowerUp,
  ActivePowerUp,
  ComboState,
  PlayerPerformance,
  SurvivalState,
  ChoiceEvent,
  EventType,
  EventOption,
  EventEffect,
  ShopItem,
  BoardModifier,
  getRandomWaveChallenge,
  getRandomBossWave,
  getRandomPowerUp,
  calculateComboMultiplier,
  countVowels,
  countConsonants,
  hasRepeatedLetters,
  isCornerPosition,
  POWER_UPS,
  PowerUpType,
  PowerUpRarity,
  COMBO_MILESTONES
} from './survivalMode';

// ============================================================================
// CHALLENGE VALIDATION
// ============================================================================

export function validateWaveChallenge(
  challenge: WaveChallenge,
  word: string,
  pathPositions: { row: number; col: number }[],
  currentProgress: number,
  waveScore: number
): { valid: boolean; progress: number; message?: string } {
  switch (challenge.type) {
    case 'word_count':
      return {
        valid: true,
        progress: currentProgress + 1,
        message: `${currentProgress + 1}/${challenge.target} words found`
      };

    case 'min_length':
      if (word.length >= (challenge.minLength || 5)) {
        return {
          valid: true,
          progress: currentProgress + 1,
          message: `${currentProgress + 1}/${challenge.target} long words found`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        message: `Word too short! Need ${challenge.minLength}+ letters`
      };

    case 'score_target':
      const newScore = waveScore;
      return {
        valid: true,
        progress: newScore,
        message: `${newScore}/${challenge.target} points earned`
      };

    case 'speed_round':
      return {
        valid: true,
        progress: currentProgress + 1,
        message: `${currentProgress + 1}/${challenge.target} words in time!`
      };

    case 'vowel_hunt':
      const vowelCount = countVowels(word);
      if (vowelCount >= (challenge.minLength || 3)) {
        return {
          valid: true,
          progress: currentProgress + 1,
          message: `${currentProgress + 1}/${challenge.target} vowel-rich words`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        message: `Not enough vowels! Need ${challenge.minLength}+`
      };

    case 'consonant_chain':
      const consonantCount = countConsonants(word);
      if (consonantCount >= (challenge.minLength || 4)) {
        return {
          valid: true,
          progress: currentProgress + 1,
          message: `${currentProgress + 1}/${challenge.target} consonant words`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        message: `Not enough consonants! Need ${challenge.minLength}+`
      };

    case 'no_repeat_letters':
      if (!hasRepeatedLetters(word)) {
        return {
          valid: true,
          progress: currentProgress + 1,
          message: `${currentProgress + 1}/${challenge.target} unique letter words`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        message: 'Word has repeated letters!'
      };

    case 'long_path':
      if (pathPositions.length >= (challenge.minTiles || 6)) {
        return {
          valid: true,
          progress: currentProgress + 1,
          message: `${currentProgress + 1}/${challenge.target} long path words`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        message: `Path too short! Need ${challenge.minTiles}+ tiles`
      };

    case 'corner_to_corner':
      const firstPos = pathPositions[0];
      const lastPos = pathPositions[pathPositions.length - 1];
      if (isCornerPosition(firstPos.row, firstPos.col) && isCornerPosition(lastPos.row, lastPos.col)) {
        return {
          valid: true,
          progress: currentProgress + 1,
          message: `${currentProgress + 1}/${challenge.target} corner words`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        message: 'Must start and end in corners!'
      };

    case 'perfect_round':
      return {
        valid: true,
        progress: currentProgress + 1,
        message: `${currentProgress + 1}/${challenge.target} perfect words`
      };

    default:
      return { valid: true, progress: currentProgress + 1 };
  }
}

export function isChallengeComplete(challenge: WaveChallenge, progress: number): boolean {
  const target = challenge.target || 5;

  switch (challenge.type) {
    case 'score_target':
      return progress >= target;
    default:
      return progress >= target;
  }
}

// ============================================================================
// BOSS WAVE VALIDATION
// ============================================================================

export function validateBossWave(
  boss: BossWave,
  word: string,
  pathPositions: { row: number; col: number }[],
  currentProgress: number,
  waveScore: number
): { valid: boolean; progress: number; complete: boolean; message?: string } {
  switch (boss.type) {
    case 'word_length':
      if (word.length >= boss.requirement) {
        return {
          valid: true,
          progress: currentProgress + 1,
          complete: true,
          message: `${boss.icon} Boss defeated! ${word.length} letter word!`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        complete: false,
        message: `Need ${boss.requirement}+ letter word!`
      };

    case 'multi_word':
      if (word.length >= (boss.minLength || 6)) {
        const newProgress = currentProgress + 1;
        return {
          valid: true,
          progress: newProgress,
          complete: newProgress >= boss.requirement,
          message: `${boss.icon} ${newProgress}/${boss.requirement} boss words!`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        complete: false,
        message: `Need ${boss.minLength}+ letter words!`
      };

    case 'point_threshold':
      const complete = waveScore >= boss.requirement;
      return {
        valid: true,
        progress: waveScore,
        complete,
        message: complete
          ? `${boss.icon} Boss defeated! ${waveScore} points!`
          : `${waveScore}/${boss.requirement} points`
      };

    case 'time_trial':
      const newProgress = currentProgress + 1;
      return {
        valid: true,
        progress: newProgress,
        complete: newProgress >= boss.requirement,
        message: `${boss.icon} ${newProgress}/${boss.requirement} in time!`
      };

    case 'stone_gauntlet':
      const gauntletProgress = currentProgress + 1;
      return {
        valid: true,
        progress: gauntletProgress,
        complete: gauntletProgress >= boss.requirement,
        message: `${boss.icon} ${gauntletProgress}/${boss.requirement} through stones!`
      };

    case 'letter_lockout':
      const wordUpper = word.toUpperCase();
      const bannedLetters = boss.bannedLetters || [];
      const hasBannedLetter = bannedLetters.some(letter => wordUpper.includes(letter));

      if (hasBannedLetter) {
        return {
          valid: false,
          progress: currentProgress,
          complete: false,
          message: `Cannot use: ${bannedLetters.join(', ')}`
        };
      }

      const lockoutProgress = currentProgress + 1;
      return {
        valid: true,
        progress: lockoutProgress,
        complete: lockoutProgress >= boss.requirement,
        message: `${boss.icon} ${lockoutProgress}/${boss.requirement} valid words!`
      };

    case 'perfect_wave':
      const perfectProgress = currentProgress + 1;
      return {
        valid: true,
        progress: perfectProgress,
        complete: perfectProgress >= boss.requirement,
        message: `${boss.icon} ${perfectProgress}/${boss.requirement} perfect!`
      };

    case 'mega_word':
      if (word.length >= boss.requirement) {
        return {
          valid: true,
          progress: currentProgress + 1,
          complete: true,
          message: `${boss.icon} MEGA BOSS DEFEATED! ${word.length} letters!`
        };
      }
      return {
        valid: false,
        progress: currentProgress,
        complete: false,
        message: `Need ${boss.requirement}+ letter MEGA word!`
      };

    default:
      return { valid: true, progress: currentProgress + 1, complete: true };
  }
}

// ============================================================================
// COMBO SYSTEM
// ============================================================================

export function updateCombo(
  comboState: ComboState,
  isValid: boolean,
  hasSafetyNet: boolean = false
): { newCombo: ComboState; rewards: string[] } {
  const rewards: string[] = [];

  if (isValid) {
    const newCombo = comboState.currentCombo + 1;
    const multiplier = calculateComboMultiplier(newCombo);

    // Check for milestone rewards
    const milestone = COMBO_MILESTONES.find(m => m.combo === newCombo);
    if (milestone) {
      rewards.push(milestone.reward);
    }

    return {
      newCombo: {
        currentCombo: newCombo,
        maxCombo: Math.max(newCombo, comboState.maxCombo),
        comboMultiplier: multiplier,
        comboActive: true,
        lastWordTime: Date.now()
      },
      rewards
    };
  } else {
    // Safety net prevents combo break
    if (hasSafetyNet) {
      return {
        newCombo: { ...comboState },
        rewards: ['safety_net_used']
      };
    }

    // Combo broken
    return {
      newCombo: {
        currentCombo: 0,
        maxCombo: comboState.maxCombo,
        comboMultiplier: 1.0,
        comboActive: false,
        lastWordTime: Date.now()
      },
      rewards: []
    };
  }
}

// ============================================================================
// POWER-UP EFFECTS
// ============================================================================

export function applyPowerUpEffect(
  powerUpType: PowerUpType,
  state: Partial<SurvivalState>
): { success: boolean; message: string; effect?: any } {
  switch (powerUpType) {
    case 'extra_life':
      return {
        success: true,
        message: '❤️ Gained 1 life!',
        effect: { lives: 1 }
      };

    case 'stone_crusher':
      return {
        success: true,
        message: '🔨 Stone Crusher activated! Next word removes stones.',
        effect: { removeStones: true }
      };

    case 'board_refresh':
      return {
        success: true,
        message: '🔄 Board refreshed!',
        effect: { refreshBoard: true }
      };

    case 'shield':
      return {
        success: true,
        message: '🛡️ Shield activated!',
        effect: { shield: 1 }
      };

    case 'letter_reveal':
      return {
        success: true,
        message: '🔍 Revealing word positions...',
        effect: { revealHints: 3 }
      };

    case 'time_freeze':
      return {
        success: true,
        message: '❄️ Difficulty frozen for 3 waves!',
        effect: { freezeDifficulty: 3 }
      };

    case 'wildcard_tile':
      return {
        success: true,
        message: '🃏 Wildcard tile active!',
        effect: { wildcardActive: true }
      };

    case 'double_points':
      return {
        success: true,
        message: '💰 Double points activated!',
        effect: { pointsMultiplier: 2 }
      };

    case 'combo_boost':
      return {
        success: true,
        message: '🔥 Combo boost active!',
        effect: { comboBoost: true }
      };

    case 'life_link':
      return {
        success: true,
        message: '💚 Life link activated!',
        effect: { lifeLink: true }
      };

    case 'safety_net':
      return {
        success: true,
        message: '🛡️ Safety net active!',
        effect: { safetyNet: true }
      };

    default:
      return {
        success: false,
        message: 'Unknown power-up'
      };
  }
}

// ============================================================================
// LIFE RECOVERY SYSTEM
// ============================================================================

export function checkLifeRecovery(
  wave: number,
  perfectWaveStreak: number,
  lifeFragments: number,
  bossDefeated: boolean,
  comboAchieved: number
): { lives: number; fragments: number; message?: string } {
  let livesGained = 0;
  let newFragments = lifeFragments;
  const messages: string[] = [];

  // Perfect wave bonus (2 perfect waves = 1 life)
  if (perfectWaveStreak >= 2) {
    livesGained += 1;
    messages.push('✨ Perfect wave streak! +1 life');
  }

  // Milestone lives (every 10 waves)
  if (wave > 0 && wave % 10 === 0) {
    livesGained += 1;
    messages.push('🎯 Wave milestone reached! +1 life');
  }

  // Boss victory life
  if (bossDefeated) {
    livesGained += 1;
    messages.push('👑 Boss defeated! +1 life');
  }

  // Combo life fragments (10+ combo = fragment, 3 fragments = 1 life)
  if (comboAchieved >= 10) {
    newFragments += 1;
    if (newFragments >= 3) {
      livesGained += 1;
      newFragments -= 3;
      messages.push('💎 Life fragments combined! +1 life');
    } else {
      messages.push(`💎 Life fragment earned! (${newFragments}/3)`);
    }
  }

  return {
    lives: livesGained,
    fragments: newFragments,
    message: messages.join('\n')
  };
}

// ============================================================================
// SHOP SYSTEM
// ============================================================================

export function generateShopItems(wave: number, currentScore: number): ShopItem[] {
  const baseItems: ShopItem[] = [
    {
      type: 'extra_life',
      name: 'Extra Life',
      description: 'Gain 1 additional life',
      cost: 500,
      costType: 'points',
      icon: '❤️',
      rarity: 'rare',
      available: currentScore >= 500
    },
    {
      type: 'stone_eraser',
      name: 'Stone Eraser',
      description: 'Remove all stone tiles',
      cost: 300,
      costType: 'points',
      icon: '🧹',
      rarity: 'common',
      available: currentScore >= 300
    },
    {
      type: 'shield',
      name: 'Shield',
      description: 'Protect from losing 1 life',
      cost: 400,
      costType: 'points',
      icon: '🛡️',
      rarity: 'rare',
      available: currentScore >= 400
    },
    {
      type: 'time_freeze',
      name: 'Time Freeze',
      description: 'No difficulty increase for 3 waves',
      cost: 450,
      costType: 'points',
      icon: '❄️',
      rarity: 'epic',
      available: currentScore >= 450
    },
    {
      type: 'double_points',
      name: 'Double Points',
      description: '2x score multiplier for next wave',
      cost: 350,
      costType: 'points',
      icon: '💰',
      rarity: 'rare',
      available: currentScore >= 350
    },
    {
      type: 'power_up_random',
      name: 'Random Power-Up',
      description: 'Get a random power-up',
      cost: 200,
      costType: 'points',
      icon: '🎲',
      rarity: 'common',
      available: currentScore >= 200
    }
  ];

  // Add rare items at higher waves
  if (wave >= 15) {
    baseItems.push({
      type: 'power_up_rare',
      name: 'Rare Power-Up',
      description: 'Get a rare or epic power-up',
      cost: 600,
      costType: 'points',
      icon: '⭐',
      rarity: 'epic',
      available: currentScore >= 600
    });
  }

  return baseItems;
}

// ============================================================================
// CHOICE EVENTS SYSTEM
// ============================================================================

export function generateRandomEvent(wave: number): ChoiceEvent | null {
  if (wave < 3) return null;

  const eventTypes: EventType[] = ['merchant', 'blessing', 'curse', 'gambit', 'mystery'];
  const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  const events: Record<EventType, ChoiceEvent[]> = {
    merchant: [
      {
        wave,
        type: 'merchant',
        prompt: 'A mysterious merchant appears...',
        description: 'Trade resources for powerful benefits',
        icon: '🧙',
        options: [
          {
            text: 'Trade 1 life for removing all obstacles',
            effect: { lives: -1, removeStoneTiles: true },
            risk: 'high'
          },
          {
            text: 'Trade 200 points for a shield',
            effect: { score: -200, shield: 1 },
            risk: 'medium'
          },
          {
            text: 'Politely decline',
            effect: { blessing: 'small_score_boost' },
            risk: 'low'
          }
        ]
      }
    ],
    blessing: [
      {
        wave,
        type: 'blessing',
        prompt: 'A blessing from above!',
        description: 'Choose your fortune',
        icon: '✨',
        options: [
          {
            text: 'Receive a rare power-up',
            effect: { powerUp: 'combo_boost' },
            risk: 'low'
          },
          {
            text: 'Gain 300 points',
            effect: { score: 300 },
            risk: 'low'
          },
          {
            text: 'Skip 1 wave',
            effect: { skipWaves: 1 },
            risk: 'low'
          }
        ]
      }
    ],
    curse: [
      {
        wave,
        type: 'curse',
        prompt: 'A curse has been placed!',
        description: 'Choose the lesser evil',
        icon: '💀',
        options: [
          {
            text: 'Accept 3 stone tiles',
            effect: { addStoneTiles: 3 },
            risk: 'medium'
          },
          {
            text: 'Lose 100 points',
            effect: { score: -100 },
            risk: 'medium'
          },
          {
            text: 'Face an extra boss wave',
            effect: { curse: 'extra_boss' },
            risk: 'high'
          }
        ]
      }
    ],
    gambit: [
      {
        wave,
        type: 'gambit',
        prompt: 'High risk, high reward!',
        description: 'Test your luck',
        icon: '🎰',
        options: [
          {
            text: 'Risk 1 life for 2 lives (60% chance)',
            // BUG FIX #4: Mark as gamble, don't pre-roll
            effect: { gamble: 'life_gambit' },
            risk: 'high'
          },
          {
            text: 'Risk 300 points for 800 points (50% chance)',
            // BUG FIX #4: Mark as gamble, don't pre-roll
            effect: { gamble: 'score_gambit' },
            risk: 'high'
          },
          {
            text: 'Play it safe',
            effect: { shield: 1 },
            risk: 'low'
          }
        ]
      }
    ],
    mystery: [
      {
        wave,
        type: 'mystery',
        prompt: 'A mysterious box appears...',
        description: 'What could be inside?',
        icon: '📦',
        options: [
          {
            text: 'Open the box',
            // BUG FIX #4: Mark as mystery, don't pre-roll
            effect: { mystery: 'mystery_box' },
            risk: 'high'
          },
          {
            text: 'Leave it alone',
            effect: { blessing: 'small_boost' },
            risk: 'low'
          }
        ]
      }
    ]
  };

  const eventPool = events[randomType];
  return eventPool[Math.floor(Math.random() * eventPool.length)];
}

export function applyEventEffect(effect: EventEffect, state: Partial<SurvivalState>): string[] {
  const messages: string[] = [];

  if (effect.lives) {
    messages.push(effect.lives > 0 ? `❤️ +${effect.lives} life` : `💔 ${effect.lives} life`);
  }

  if (effect.score) {
    messages.push(effect.score > 0 ? `💰 +${effect.score} points` : `📉 ${effect.score} points`);
  }

  if (effect.removeStoneTiles) {
    messages.push('🧹 All stone tiles removed!');
  }

  if (effect.addStoneTiles) {
    messages.push(`🗿 +${effect.addStoneTiles} stone tiles added`);
  }

  if (effect.shield) {
    messages.push(`🛡️ +${effect.shield} shield`);
  }

  if (effect.powerUp) {
    const powerUp = POWER_UPS[effect.powerUp];
    messages.push(`⚡ Gained ${powerUp.name}!`);
  }

  if (effect.blessing) {
    messages.push('✨ Blessing applied!');
  }

  if (effect.curse) {
    messages.push('💀 Curse applied!');
  }

  if (effect.skipWaves) {
    messages.push(`⏭️ Skipped ${effect.skipWaves} wave(s)!`);
  }

  return messages;
}

// ============================================================================
// ADAPTIVE DIFFICULTY
// ============================================================================

export function calculateObstacleCount(
  wave: number,
  performance: PlayerPerformance,
  difficultyFrozen: boolean
): number {
  if (difficultyFrozen) return 0;

  let baseObstacles = Math.floor(wave / 5);

  // Adjust based on player performance
  if (performance.averageWordLength < 4.5 && wave > 5) {
    baseObstacles = Math.max(0, baseObstacles - 1); // Easier for struggling players
  }

  if (performance.averageCombo > 5) {
    baseObstacles += 1; // Harder for high performers
  }

  if (performance.successRate < 0.6) {
    baseObstacles = Math.max(0, baseObstacles - 1);
  } else if (performance.successRate > 0.9) {
    baseObstacles += 1;
  }

  return Math.max(0, Math.min(baseObstacles, 10)); // Cap at 10 obstacles
}

export function updatePerformance(
  performance: PlayerPerformance,
  word: string,
  combo: number,
  isSuccess: boolean,
  timeSpent: number
): PlayerPerformance {
  const weight = 0.2; // Moving average weight

  return {
    averageWordLength: performance.averageWordLength * (1 - weight) + word.length * weight,
    averageCombo: performance.averageCombo * (1 - weight) + combo * weight,
    successRate: performance.successRate * (1 - weight) + (isSuccess ? 1 : 0) * weight,
    averageTimePerWord: performance.averageTimePerWord * (1 - weight) + timeSpent * weight,
    mistakeCount: isSuccess ? performance.mistakeCount : performance.mistakeCount + 1
  };
}
