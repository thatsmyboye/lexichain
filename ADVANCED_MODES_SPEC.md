# Advanced Game Modes - Implementation Specification

## Table of Contents
1. [Daily Mini-Marathon](#1-daily-mini-marathon)
2. [Prestige Endless](#2-prestige-endless)
3. [Weekly Gauntlet](#3-weekly-gauntlet)
4. [Database Schema](#4-database-schema)
5. [Implementation Roadmap](#5-implementation-roadmap)

---

## 1. Daily Mini-Marathon

### Overview
Three quick 5-move puzzles with connected scoring. Takes ~5-7 minutes total. Perfect for lunch breaks and quick engagement.

### Core Mechanics

**Structure:**
- 3 sequential seeded boards (same for all players daily)
- Each board: 5 moves maximum
- Each board: 60-second timer
- Combo multiplier carries between boards
- Aggregate scoring determines daily ranking

**Seed Generation:**
```typescript
const seed1 = `${challengeDate}-marathon-1`
const seed2 = `${challengeDate}-marathon-2`
const seed3 = `${challengeDate}-marathon-3`
```

**Scoring Formula:**
```typescript
// Board 1: Base multiplier 1.0x
board1Score = baseScore × 1.0

// Board 2: Carries combo from board 1
board2Multiplier = 1.0 + (board1ComboBonus × 0.1) // Max 1.1x if perfect board 1
board2Score = baseScore × board2Multiplier

// Board 3: Carries combo from boards 1+2
board3Multiplier = 1.0 + ((board1ComboBonus + board2ComboBonus) × 0.15) // Max 1.3x
board3Score = baseScore × board3Multiplier

// Final Score
totalScore = board1Score + board2Score + board3Score

// Combo Bonus Calculation (per board)
comboBonus = min(5, wordsFound) // Max 5 words = perfect combo
```

**Grading Thresholds:**
```typescript
Bronze:    2,500 points (aggregate)
Silver:    4,000 points
Gold:      6,500 points
Platinum:  10,000 points
```

**XP/Rewards:**
- Mode XP Multiplier: 1.5x
- Score Multiplier: 1.2x
- Difficulty: Medium
- Unlock Requirement: Level 0 (always available)

### Technical Implementation

#### State Management

**Hook: `useMiniMarathonState.ts`**
```typescript
export type MiniMarathonGameState = {
  marathonDate: string;
  boards: {
    board1: BoardState;
    board2: BoardState;
    board3: BoardState;
  };
  currentBoard: 1 | 2 | 3;
  scores: {
    board1: number;
    board2: number;
    board3: number;
    total: number;
  };
  comboBonuses: {
    board1: number;
    board2: number;
  };
  movesUsedPerBoard: {
    board1: number;
    board2: number;
    board3: number;
  };
  completedBoards: Set<1 | 2 | 3>;
  startTime: number;
  boardStartTimes: {
    board1?: number;
    board2?: number;
    board3?: number;
  };
  gameOver: boolean;
  finalGrade?: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  benchmarks?: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
};

type BoardState = {
  board: any[][];
  specialTiles: any[][];
  usedWords: any[];
  score: number;
  movesUsed: number;
  seed: string;
  timeRemaining?: number;
};
```

**Key Methods:**
```typescript
// Generate all 3 boards at start (deterministic)
const generateMarathonBoards = (date: string) => {
  return {
    board1: generateSeededBoard(`${date}-marathon-1`, 4), // 4x4 medium
    board2: generateSeededBoard(`${date}-marathon-2`, 4),
    board3: generateSeededBoard(`${date}-marathon-3`, 4),
  };
};

// Transition between boards
const advanceToNextBoard = (currentState: MiniMarathonGameState) => {
  const nextBoard = (currentState.currentBoard + 1) as 1 | 2 | 3;

  if (nextBoard > 3) {
    // Marathon complete
    return finishMarathon(currentState);
  }

  return {
    ...currentState,
    currentBoard: nextBoard,
    boardStartTimes: {
      ...currentState.boardStartTimes,
      [`board${nextBoard}`]: Date.now(),
    },
  };
};

// Calculate combo carry-over
const getCarryoverMultiplier = (
  currentBoard: 1 | 2 | 3,
  comboBonuses: { board1: number; board2: number }
): number => {
  switch (currentBoard) {
    case 1:
      return 1.0; // No carry-over
    case 2:
      return 1.0 + (comboBonuses.board1 × 0.1);
    case 3:
      return 1.0 + ((comboBonuses.board1 + comboBonuses.board2) × 0.15);
    default:
      return 1.0;
  }
};
```

#### UI Components

**Component: `MiniMarathonGame.tsx`**
```typescript
// Key UI elements:
- Marathon progress bar (Board 1/3, 2/3, 3/3)
- Per-board timer (60s countdown)
- Live combo multiplier display
- "Next Board" transition animation
- Aggregate score display (always visible)
- Final results screen with:
  - Per-board breakdown
  - Combo visualization
  - Total time taken
  - Grade achievement
  - Leaderboard position
```

**Visual Flow:**
1. **Pre-Start Screen:**
   - Shows "Today's Mini-Marathon" with date
   - Preview of 3 board icons (locked/unlocked)
   - "Start Marathon" button
   - Leaderboard preview (top 5)

2. **Board Transition:**
   - 3-second countdown: "Board 2 starting in 3... 2... 1..."
   - Display upcoming combo multiplier
   - Quick board preview (letters fade in)

3. **Active Board:**
   - Standard game UI
   - Additional HUD: Marathon progress, combo meter, aggregate score

4. **Results Screen:**
   - Animated score reveal per board
   - Combo multiplier visualization (bars showing 1.0x → 1.1x → 1.3x)
   - Grade unlock animation
   - Leaderboard position update
   - Share button

#### Database Integration

**Table: `mini_marathon_states`**
```sql
CREATE TABLE mini_marathon_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  marathon_date DATE NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, marathon_date)
);

CREATE INDEX idx_mini_marathon_states_user_date
  ON mini_marathon_states(user_id, marathon_date);
```

**Table: `mini_marathon_results`**
```sql
CREATE TABLE mini_marathon_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  marathon_date DATE NOT NULL,
  board1_score INTEGER NOT NULL,
  board2_score INTEGER NOT NULL,
  board3_score INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  grade VARCHAR(20), -- bronze, silver, gold, platinum
  total_time_seconds INTEGER, -- Total time taken
  combo_bonus_1 INTEGER,
  combo_bonus_2 INTEGER,
  final_multiplier DECIMAL(4,2),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, marathon_date)
);

CREATE INDEX idx_mini_marathon_results_date_score
  ON mini_marathon_results(marathon_date, total_score DESC);
CREATE INDEX idx_mini_marathon_results_user
  ON mini_marathon_results(user_id, marathon_date);
```

**Leaderboard Query:**
```sql
-- Daily Marathon Leaderboard
SELECT
  u.username,
  u.avatar_url,
  mr.total_score,
  mr.grade,
  mr.total_time_seconds,
  mr.final_multiplier,
  RANK() OVER (ORDER BY mr.total_score DESC, mr.total_time_seconds ASC) as rank
FROM mini_marathon_results mr
JOIN users u ON mr.user_id = u.id
WHERE mr.marathon_date = CURRENT_DATE
ORDER BY mr.total_score DESC, mr.total_time_seconds ASC
LIMIT 100;
```

---

## 2. Prestige Endless

### Overview
Enhanced Endless mode with persistent meta-progression. Players earn permanent buffs through waves and can "prestige" to reset for exclusive rewards.

### Core Mechanics

**Wave Structure:**
- Endless waves (10 words per wave)
- Difficulty increases every wave
- Special "Prestige Milestone" waves at 10, 25, 50, 100, 200

**Buff System:**
- Every 10 waves: Choose 1 buff from 3 random options
- Buffs carry over to next run (persistent)
- Max 20 active buffs (must choose wisely)

**Prestige System:**
- Can prestige after wave 50
- Resets all buffs
- Grants prestige currency (Prestige Points)
- Prestige Points unlock exclusive cosmetics and abilities
- Prestige level displayed (P1, P2, P3, etc.)

**Buff Types:**

| Category | Buff Name | Effect | Rarity |
|----------|-----------|--------|--------|
| **Scoring** | Score Surge | +10% base score | Common |
| **Scoring** | Multiplier Master | +15% special tile multipliers | Rare |
| **Scoring** | Rare Letter Focus | +25% rare letter bonus | Rare |
| **Tiles** | Wild Spawn | +3% wild tile spawn rate | Epic |
| **Tiles** | Stone Breaker | -5% stone tile spawn rate | Common |
| **Tiles** | Multiplier Magnet | +2% multiplier tile spawn | Rare |
| **Defense** | Extra Life | +1 life per 20 waves | Epic |
| **Defense** | Stone Shield | Start each wave with 1 hammer charge | Legendary |
| **Offense** | Chain Reaction | +10% link multiplier effectiveness | Rare |
| **Offense** | Length Prodigy | +5 bonus points per letter (5+ letter words) | Common |
| **Utility** | Hint Oracle | 1 free hint per wave | Epic |
| **Utility** | Time Extension | +15s timer in boss waves | Rare |

**Prestige Rewards (Prestige Points):**
- Wave 50: 100 PP
- Wave 75: 150 PP
- Wave 100: 250 PP
- Wave 150: 400 PP
- Wave 200+: 500 PP + (wave - 200) × 10 PP

**Prestige Shop:**
```typescript
{
  cosmetics: {
    'Prestige Badge P1': 100 PP,
    'Prestige Badge P2': 250 PP,
    'Prestige Badge P5': 500 PP,
    'Prestige Badge P10': 1000 PP,
    'Golden Tile Theme': 300 PP,
    'Prismatic Particle Effects': 400 PP,
  },
  abilities: {
    'Prestige Aura (+5% XP permanently)': 500 PP,
    'Second Chance (revive once per run)': 750 PP,
    'Buff Reroll (reroll buff choices 1x/run)': 600 PP,
  }
}
```

**Leaderboards:**
- All-time highest wave reached
- Current season highest wave
- Fastest to wave 50
- Total prestige points earned

### Technical Implementation

#### State Management

**Hook: `usePrestigeEndlessState.ts`**
```typescript
export type PrestigeEndlessState = {
  sessionId: string; // Unique ID per run
  currentWave: number;
  wordsInWave: number; // 0-10
  totalScore: number;
  lives: number;
  activeBuffs: ActiveBuff[];
  availableBuffChoices?: BuffChoice[]; // Shown at wave milestones
  prestigeLevel: number;
  prestigePoints: number;
  highestWaveEver: number;
  sessionStartTime: number;
  lastWaveTime?: number;
  board: any[][];
  specialTiles: any[][];
  usedWords: any[];
  currentScore: number; // Current wave score
  gameOver: boolean;
  canPrestige: boolean;
};

type ActiveBuff = {
  id: string;
  name: string;
  effect: string;
  value: number;
  category: string;
  icon: string;
  acquiredAtWave: number;
};

type BuffChoice = {
  id: string;
  name: string;
  description: string;
  effect: string;
  value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
};
```

**Key Methods:**
```typescript
// Wave advancement
const advanceWave = (state: PrestigeEndlessState): PrestigeEndlessState => {
  const nextWave = state.currentWave + 1;
  const isBuffMilestone = nextWave % 10 === 0;

  const newState = {
    ...state,
    currentWave: nextWave,
    wordsInWave: 0,
    currentScore: 0,
    lastWaveTime: Date.now(),
    canPrestige: nextWave >= 50,
  };

  if (isBuffMilestone) {
    // Offer buff choices
    newState.availableBuffChoices = generateBuffChoices(state.activeBuffs);
  }

  // Regenerate board with increased difficulty
  newState.board = generateEndlessBoard(nextWave);
  newState.specialTiles = generateSpecialTiles(nextWave);

  return newState;
};

// Buff selection
const selectBuff = (
  state: PrestigeEndlessState,
  buffChoice: BuffChoice
): PrestigeEndlessState => {
  return {
    ...state,
    activeBuffs: [
      ...state.activeBuffs.slice(0, 19), // Max 20 buffs
      {
        id: buffChoice.id,
        name: buffChoice.name,
        effect: buffChoice.effect,
        value: buffChoice.value,
        category: buffChoice.rarity,
        icon: buffChoice.icon,
        acquiredAtWave: state.currentWave,
      }
    ],
    availableBuffChoices: undefined,
  };
};

// Prestige action
const executePrestige = async (
  state: PrestigeEndlessState
): Promise<PrestigeEndlessState> => {
  const prestigePoints = calculatePrestigePoints(state.currentWave);

  // Save prestige run to database
  await savePrestigeRun({
    wave: state.currentWave,
    score: state.totalScore,
    prestigeLevel: state.prestigeLevel,
    prestigePointsEarned: prestigePoints,
    buffsUsed: state.activeBuffs,
    timeElapsed: Date.now() - state.sessionStartTime,
  });

  return {
    sessionId: generateSessionId(),
    currentWave: 1,
    wordsInWave: 0,
    totalScore: 0,
    lives: 3,
    activeBuffs: [], // RESET BUFFS
    prestigeLevel: state.prestigeLevel + 1,
    prestigePoints: state.prestigePoints + prestigePoints,
    highestWaveEver: Math.max(state.highestWaveEver, state.currentWave),
    sessionStartTime: Date.now(),
    board: generateEndlessBoard(1),
    specialTiles: generateSpecialTiles(1),
    usedWords: [],
    currentScore: 0,
    gameOver: false,
    canPrestige: false,
  };
};

// Buff effect application
const applyBuffEffects = (
  baseScore: number,
  buffs: ActiveBuff[],
  context: GameContext
): number => {
  let modifiedScore = baseScore;

  buffs.forEach(buff => {
    switch (buff.effect) {
      case 'score_multiplier':
        modifiedScore *= (1 + buff.value);
        break;
      case 'rare_letter_bonus':
        if (context.hasRareLetter) {
          modifiedScore *= (1 + buff.value);
        }
        break;
      case 'length_bonus':
        if (context.wordLength >= 5) {
          modifiedScore += buff.value * context.wordLength;
        }
        break;
      // ... other effects
    }
  });

  return Math.floor(modifiedScore);
};
```

#### UI Components

**Component: `PrestigeEndlessGame.tsx`**
```typescript
// Key UI elements:
- Wave counter (prominent, animated on wave advance)
- Lives display (hearts or similar)
- Active buffs sidebar (scrollable, max 20)
- Prestige button (glowing when available)
- Buff selection modal (every 10 waves)
  - Shows 3 choices with rarity-colored borders
  - Hover for detailed effect description
  - Confirmation required
- Prestige confirmation modal
  - Shows current stats
  - Preview of prestige points earned
  - "Are you sure?" prompt
```

**Buff Selection Modal:**
```typescript
<BuffSelectionModal>
  <Title>Wave {currentWave} Milestone - Choose Your Buff!</Title>
  <BuffChoiceGrid>
    {buffChoices.map(choice => (
      <BuffCard rarity={choice.rarity}>
        <Icon>{choice.icon}</Icon>
        <Name>{choice.name}</Name>
        <Description>{choice.description}</Description>
        <Effect>Effect: {choice.effect}</Effect>
        <RarityBadge>{choice.rarity}</RarityBadge>
        <SelectButton onClick={() => selectBuff(choice)}>
          Choose
        </SelectButton>
      </BuffCard>
    ))}
  </BuffChoiceGrid>
</BuffSelectionModal>
```

#### Database Integration

**Table: `prestige_endless_states`**
```sql
CREATE TABLE prestige_endless_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- Only one active session per user
);

CREATE INDEX idx_prestige_endless_states_user
  ON prestige_endless_states(user_id);
```

**Table: `prestige_endless_runs`**
```sql
CREATE TABLE prestige_endless_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  final_wave INTEGER NOT NULL,
  total_score BIGINT NOT NULL,
  prestige_level INTEGER NOT NULL,
  prestige_points_earned INTEGER NOT NULL,
  buffs_used JSONB, -- Array of buff objects
  total_time_seconds INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prestige_endless_runs_wave
  ON prestige_endless_runs(final_wave DESC);
CREATE INDEX idx_prestige_endless_runs_user
  ON prestige_endless_runs(user_id, completed_at DESC);
```

**Table: `prestige_endless_player_stats`**
```sql
CREATE TABLE prestige_endless_player_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prestige_level INTEGER DEFAULT 0,
  total_prestige_points INTEGER DEFAULT 0,
  highest_wave_ever INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  purchased_items JSONB DEFAULT '[]', -- Array of shop item IDs
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prestige_player_stats_highest_wave
  ON prestige_endless_player_stats(highest_wave_ever DESC);
```

**Leaderboard Queries:**
```sql
-- All-time highest wave
SELECT
  u.username,
  u.avatar_url,
  ps.highest_wave_ever,
  ps.prestige_level,
  ps.total_runs,
  RANK() OVER (ORDER BY ps.highest_wave_ever DESC) as rank
FROM prestige_endless_player_stats ps
JOIN users u ON ps.user_id = u.id
ORDER BY ps.highest_wave_ever DESC
LIMIT 100;

-- Fastest to wave 50
SELECT
  u.username,
  r.total_time_seconds,
  r.final_wave,
  r.completed_at,
  RANK() OVER (ORDER BY r.total_time_seconds ASC) as rank
FROM prestige_endless_runs r
JOIN users u ON r.user_id = u.id
WHERE r.final_wave >= 50
ORDER BY r.total_time_seconds ASC
LIMIT 100;
```

---

## 3. Weekly Gauntlet

### Overview
7 pre-seeded daily puzzles unlocked every Monday. Each puzzle has unique constraints. Complete all 7 by Sunday for maximum rewards.

### Core Mechanics

**Structure:**
- 7 puzzles unlock Monday 00:00 ET
- Each puzzle has unique theme/constraint
- Can be played in any order
- Aggregate scoring across all 7 puzzles
- Weekly leaderboard (resets Monday)

**Daily Themes/Constraints:**

| Day | Theme | Constraint | Moves | Timer |
|-----|-------|-----------|-------|-------|
| **Monday** | "Fresh Start" | Standard rules | 10 | None |
| **Tuesday** | "Vowel Valley" | Only words with 50%+ vowels | 8 | 120s |
| **Wednesday** | "Consonant Crush" | Only words with 50%+ consonants | 8 | 120s |
| **Thursday** | "Rarity Raid" | Only words with rare letters (J,Q,X,Z,K,V,W,Y) | 12 | 90s |
| **Friday** | "Length Challenge" | Only 5+ letter words | 10 | None |
| **Saturday** | "Speed Run" | No constraint, but 60s timer | 15 | 60s |
| **Sunday** | "Boss Battle" | Expert board, must score 5000+ | 15 | 180s |

**Scoring System:**
```typescript
// Per-puzzle scoring
puzzleScore = baseScore × dayMultiplier × completionBonus

// Day multipliers
dayMultipliers = {
  monday: 1.0,
  tuesday: 1.2,   // Vowel constraint
  wednesday: 1.2, // Consonant constraint
  thursday: 1.5,  // Rarity constraint (hardest)
  friday: 1.3,    // Length constraint
  saturday: 1.1,  // Speed focus
  sunday: 1.4,    // Boss battle
};

// Completion bonuses
completionBonus = {
  1-3 puzzles: 1.0x,
  4-5 puzzles: 1.1x (all completed puzzles),
  6 puzzles: 1.2x (all completed puzzles),
  7 puzzles: 1.5x (all completed puzzles) + 1000 bonus points
};

// Aggregate score
weeklyScore = sum(puzzle1Score, puzzle2Score, ..., puzzle7Score) × completionBonus
```

**Grading (Weekly Aggregate):**
```typescript
Bronze:    15,000 points
Silver:    25,000 points
Gold:      40,000 points
Platinum:  65,000 points
Diamond:   100,000 points (new tier!)
```

**Rewards:**
- XP Multiplier: 2.5x (highest retention mode)
- Score Multiplier: 1.8x
- Special "Gauntlet Champion" badge for Diamond
- Exclusive cosmetics for completing all 7 puzzles
- Prestige Points: 50 PP for Bronze, 100 PP for Silver, 200 PP for Gold, 400 PP for Platinum, 750 PP for Diamond

### Technical Implementation

#### State Management

**Hook: `useWeeklyGauntletState.ts`**
```typescript
export type WeeklyGauntletState = {
  weekIdentifier: string; // e.g., "2025-W23" (ISO week)
  puzzles: {
    monday: PuzzleState | null;
    tuesday: PuzzleState | null;
    wednesday: PuzzleState | null;
    thursday: PuzzleState | null;
    friday: PuzzleState | null;
    saturday: PuzzleState | null;
    sunday: PuzzleState | null;
  };
  completedPuzzles: Set<DayOfWeek>;
  puzzleScores: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  };
  totalScore: number;
  completionBonus: number;
  weeklyGrade?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | null;
  isWeekComplete: boolean;
};

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type PuzzleState = {
  day: DayOfWeek;
  theme: string;
  constraint: string;
  seed: string;
  board: any[][];
  specialTiles: any[][];
  usedWords: any[];
  score: number;
  movesUsed: number;
  movesLimit: number;
  timeLimit?: number;
  timeRemaining?: number;
  completed: boolean;
  completedAt?: number;
  grade?: 'bronze' | 'silver' | 'gold' | 'platinum';
};

// Constraint validators
type ConstraintValidator = (word: string, tiles: Tile[]) => {
  isValid: boolean;
  reason?: string;
};

const CONSTRAINTS: Record<DayOfWeek, ConstraintValidator> = {
  monday: () => ({ isValid: true }), // No constraint

  tuesday: (word) => {
    const vowels = word.match(/[aeiou]/gi)?.length || 0;
    const vowelPercent = vowels / word.length;
    return {
      isValid: vowelPercent >= 0.5,
      reason: vowelPercent < 0.5 ? 'Word must be 50%+ vowels' : undefined,
    };
  },

  wednesday: (word) => {
    const consonants = word.match(/[bcdfghjklmnpqrstvwxyz]/gi)?.length || 0;
    const consonantPercent = consonants / word.length;
    return {
      isValid: consonantPercent >= 0.5,
      reason: consonantPercent < 0.5 ? 'Word must be 50%+ consonants' : undefined,
    };
  },

  thursday: (word, tiles) => {
    const rareLetters = 'jqxzkvwy';
    const hasRare = tiles.some(t => rareLetters.includes(t.letter.toLowerCase()));
    return {
      isValid: hasRare,
      reason: !hasRare ? 'Word must contain a rare letter (J,Q,X,Z,K,V,W,Y)' : undefined,
    };
  },

  friday: (word) => {
    return {
      isValid: word.length >= 5,
      reason: word.length < 5 ? 'Word must be 5+ letters' : undefined,
    };
  },

  saturday: () => ({ isValid: true }), // Speed focus, no constraint

  sunday: () => ({ isValid: true }), // Boss battle, no constraint (just hard board)
};
```

**Key Methods:**
```typescript
// Generate week identifier (ISO 8601 week)
const getWeekIdentifier = (date: Date): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1;
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
};

// Generate puzzle for specific day
const generateGauntletPuzzle = (
  weekId: string,
  day: DayOfWeek
): PuzzleState => {
  const config = GAUNTLET_CONFIGS[day];
  const seed = `${weekId}-${day}`;

  return {
    day,
    theme: config.theme,
    constraint: config.constraint,
    seed,
    board: generateSeededBoard(seed, config.gridSize, config.difficulty),
    specialTiles: generateSpecialTiles(seed),
    usedWords: [],
    score: 0,
    movesUsed: 0,
    movesLimit: config.movesLimit,
    timeLimit: config.timeLimit,
    completed: false,
  };
};

// Calculate completion bonus
const getCompletionBonus = (completedCount: number): number => {
  if (completedCount >= 7) return 1.5;
  if (completedCount === 6) return 1.2;
  if (completedCount >= 4) return 1.1;
  return 1.0;
};

// Calculate total weekly score
const calculateWeeklyScore = (state: WeeklyGauntletState): number => {
  const puzzleScores = Object.values(state.puzzleScores);
  const baseTotal = puzzleScores.reduce((sum, score) => sum + score, 0);
  const bonus = state.completedPuzzles.size === 7 ? 1000 : 0;
  return Math.floor(baseTotal * state.completionBonus + bonus);
};

// Validate word against day's constraint
const validateWordForDay = (
  day: DayOfWeek,
  word: string,
  tiles: Tile[]
): { isValid: boolean; reason?: string } => {
  return CONSTRAINTS[day](word, tiles);
};
```

#### UI Components

**Component: `WeeklyGauntletHub.tsx`**
```typescript
// Main hub showing all 7 puzzles
<GauntletHub>
  <WeekHeader>
    <Title>Weekly Gauntlet - Week {weekNumber}</Title>
    <Timer>Time Remaining: {daysLeft} days {hoursLeft} hours</Timer>
    <Progress>{completedCount}/7 Puzzles Complete</Progress>
  </WeekHeader>

  <PuzzleGrid>
    {daysOfWeek.map(day => (
      <PuzzleCard
        day={day}
        theme={config.theme}
        constraint={config.constraint}
        completed={completedPuzzles.has(day)}
        score={puzzleScores[day]}
        isLocked={!isWeekActive}
      >
        <DayBadge>{day}</DayBadge>
        <ThemeIcon>{getThemeIcon(day)}</ThemeIcon>
        <ThemeName>{config.theme}</ThemeName>
        <ConstraintBadge>{config.constraint}</ConstraintBadge>
        <Difficulty>{config.difficulty}</Difficulty>

        {completed ? (
          <CompletedBadge>
            ✓ {score} pts
            <ReplayButton>Replay (no score)</ReplayButton>
          </CompletedBadge>
        ) : (
          <PlayButton onClick={() => startPuzzle(day)}>
            Start Puzzle
          </PlayButton>
        )}
      </PuzzleCard>
    ))}
  </PuzzleGrid>

  <WeeklySummary>
    <TotalScore>Total: {totalScore} pts</TotalScore>
    <CompletionBonus>Bonus: {completionBonus}x</CompletionBonus>
    <Grade>Grade: {weeklyGrade || 'In Progress'}</Grade>
  </WeeklySummary>

  <WeeklyLeaderboard />
</GauntletHub>
```

**Component: `GauntletPuzzleGame.tsx`**
```typescript
// Individual puzzle game screen
<PuzzleGame>
  <PuzzleHeader>
    <DayBadge>{currentDay}</DayBadge>
    <Theme>{theme}</Theme>
    <ConstraintDisplay>{constraint}</ConstraintDisplay>
    <MovesCounter>{movesRemaining}/{movesLimit}</MovesCounter>
    {timeLimit && <Timer>{timeRemaining}s</Timer>}
  </PuzzleHeader>

  {/* Standard WordPathGame component with constraint overlay */}
  <WordPathGame
    mode="gauntlet"
    seed={seed}
    constraintValidator={(word, tiles) => validateWordForDay(currentDay, word, tiles)}
    onWordRejected={(reason) => showConstraintError(reason)}
    movesLimit={movesLimit}
    timeLimit={timeLimit}
  />

  {/* Constraint violation feedback */}
  {constraintError && (
    <ConstraintErrorToast>
      ❌ {constraintError}
    </ConstraintErrorToast>
  )}
</PuzzleGame>
```

#### Database Integration

**Table: `weekly_gauntlet_states`**
```sql
CREATE TABLE weekly_gauntlet_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL, -- e.g., "2025-W23"
  game_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_identifier)
);

CREATE INDEX idx_weekly_gauntlet_states_user_week
  ON weekly_gauntlet_states(user_id, week_identifier);
```

**Table: `weekly_gauntlet_results`**
```sql
CREATE TABLE weekly_gauntlet_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  puzzles_completed INTEGER NOT NULL, -- 0-7
  puzzle_scores JSONB NOT NULL, -- { monday: 1000, tuesday: 1200, ... }
  total_score INTEGER NOT NULL,
  completion_bonus DECIMAL(3,2),
  grade VARCHAR(20), -- bronze, silver, gold, platinum, diamond
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_identifier)
);

CREATE INDEX idx_weekly_gauntlet_results_week_score
  ON weekly_gauntlet_results(week_identifier, total_score DESC);
CREATE INDEX idx_weekly_gauntlet_results_user
  ON weekly_gauntlet_results(user_id, week_identifier);
```

**Table: `weekly_gauntlet_daily_completions`**
```sql
CREATE TABLE weekly_gauntlet_daily_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  day_of_week VARCHAR(10) NOT NULL, -- monday, tuesday, etc.
  score INTEGER NOT NULL,
  moves_used INTEGER,
  time_taken_seconds INTEGER,
  words_found INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_identifier, day_of_week)
);

CREATE INDEX idx_gauntlet_daily_user_week
  ON weekly_gauntlet_daily_completions(user_id, week_identifier);
```

**Leaderboard Query:**
```sql
-- Weekly Gauntlet Leaderboard
SELECT
  u.username,
  u.avatar_url,
  wgr.total_score,
  wgr.puzzles_completed,
  wgr.grade,
  wgr.completion_bonus,
  RANK() OVER (
    ORDER BY
      wgr.total_score DESC,
      wgr.puzzles_completed DESC,
      wgr.completed_at ASC
  ) as rank
FROM weekly_gauntlet_results wgr
JOIN users u ON wgr.user_id = u.id
WHERE wgr.week_identifier = '2025-W23' -- Current week
ORDER BY rank
LIMIT 100;

-- Per-day leaderboard (for specific puzzle)
SELECT
  u.username,
  dc.score,
  dc.moves_used,
  dc.time_taken_seconds,
  dc.words_found,
  RANK() OVER (ORDER BY dc.score DESC, dc.time_taken_seconds ASC) as rank
FROM weekly_gauntlet_daily_completions dc
JOIN users u ON dc.user_id = u.id
WHERE dc.week_identifier = '2025-W23'
  AND dc.day_of_week = 'thursday'
ORDER BY rank
LIMIT 100;
```

---

## 4. Database Schema

### Complete Schema Summary

```sql
-- ============================================
-- MINI-MARATHON TABLES
-- ============================================

CREATE TABLE mini_marathon_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  marathon_date DATE NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, marathon_date)
);

CREATE TABLE mini_marathon_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  marathon_date DATE NOT NULL,
  board1_score INTEGER NOT NULL,
  board2_score INTEGER NOT NULL,
  board3_score INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  grade VARCHAR(20),
  total_time_seconds INTEGER,
  combo_bonus_1 INTEGER,
  combo_bonus_2 INTEGER,
  final_multiplier DECIMAL(4,2),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, marathon_date)
);

-- ============================================
-- PRESTIGE ENDLESS TABLES
-- ============================================

CREATE TABLE prestige_endless_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE prestige_endless_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  final_wave INTEGER NOT NULL,
  total_score BIGINT NOT NULL,
  prestige_level INTEGER NOT NULL,
  prestige_points_earned INTEGER NOT NULL,
  buffs_used JSONB,
  total_time_seconds INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prestige_endless_player_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prestige_level INTEGER DEFAULT 0,
  total_prestige_points INTEGER DEFAULT 0,
  highest_wave_ever INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  purchased_items JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WEEKLY GAUNTLET TABLES
-- ============================================

CREATE TABLE weekly_gauntlet_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_identifier)
);

CREATE TABLE weekly_gauntlet_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  puzzles_completed INTEGER NOT NULL,
  puzzle_scores JSONB NOT NULL,
  total_score INTEGER NOT NULL,
  completion_bonus DECIMAL(3,2),
  grade VARCHAR(20),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_identifier)
);

CREATE TABLE weekly_gauntlet_daily_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_identifier TEXT NOT NULL,
  day_of_week VARCHAR(10) NOT NULL,
  score INTEGER NOT NULL,
  moves_used INTEGER,
  time_taken_seconds INTEGER,
  words_found INTEGER,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_identifier, day_of_week)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Mini-Marathon Indexes
CREATE INDEX idx_mini_marathon_states_user_date ON mini_marathon_states(user_id, marathon_date);
CREATE INDEX idx_mini_marathon_results_date_score ON mini_marathon_results(marathon_date, total_score DESC);

-- Prestige Endless Indexes
CREATE INDEX idx_prestige_endless_runs_wave ON prestige_endless_runs(final_wave DESC);
CREATE INDEX idx_prestige_endless_runs_user ON prestige_endless_runs(user_id, completed_at DESC);
CREATE INDEX idx_prestige_player_stats_highest_wave ON prestige_endless_player_stats(highest_wave_ever DESC);

-- Weekly Gauntlet Indexes
CREATE INDEX idx_weekly_gauntlet_states_user_week ON weekly_gauntlet_states(user_id, week_identifier);
CREATE INDEX idx_weekly_gauntlet_results_week_score ON weekly_gauntlet_results(week_identifier, total_score DESC);
CREATE INDEX idx_gauntlet_daily_user_week ON weekly_gauntlet_daily_completions(user_id, week_identifier);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE mini_marathon_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_marathon_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestige_endless_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestige_endless_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestige_endless_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_gauntlet_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_gauntlet_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_gauntlet_daily_completions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can read own mini_marathon_states"
  ON mini_marathon_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mini_marathon_states"
  ON mini_marathon_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mini_marathon_states"
  ON mini_marathon_states FOR UPDATE
  USING (auth.uid() = user_id);

-- (Repeat similar policies for all tables)

-- Leaderboard data is publicly readable
CREATE POLICY "Anyone can read marathon results"
  ON mini_marathon_results FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read gauntlet results"
  ON weekly_gauntlet_results FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read prestige runs"
  ON prestige_endless_runs FOR SELECT
  USING (true);
```

---

## 5. Implementation Roadmap

### Phase 1: Mini-Marathon (Sprint 1-2, ~2-3 weeks)

**Week 1: Core Infrastructure**
- [ ] Database schema creation (`mini_marathon_states`, `mini_marathon_results`)
- [ ] State management hook (`useMiniMarathonState.ts`)
- [ ] Seed generation for 3 boards
- [ ] Board transition logic
- [ ] Combo carry-over calculation

**Week 2: UI & Polish**
- [ ] Marathon hub UI component
- [ ] Board transition animations
- [ ] Results screen with breakdown
- [ ] Leaderboard integration
- [ ] Testing & bug fixes

**Week 3: Integration & Launch**
- [ ] Add to AdvancedGameModes menu
- [ ] Analytics tracking
- [ ] Beta testing with small group
- [ ] Documentation
- [ ] Production deployment

---

### Phase 2: Weekly Gauntlet (Sprint 3-5, ~3-4 weeks)

**Week 1: Foundation**
- [ ] Database schema (`weekly_gauntlet_*` tables)
- [ ] Week identifier logic (ISO week calculation)
- [ ] Constraint validators for each day
- [ ] Puzzle generation per day

**Week 2: Puzzle Mechanics**
- [ ] Constraint validation during gameplay
- [ ] Constraint error feedback UI
- [ ] Per-puzzle state management
- [ ] Aggregate scoring system

**Week 3: Hub & UI**
- [ ] Gauntlet hub with 7 puzzle cards
- [ ] Week timer / countdown
- [ ] Completion tracking
- [ ] Individual puzzle game screens

**Week 4: Integration & Polish**
- [ ] Weekly leaderboard (overall + per-day)
- [ ] Reward system integration
- [ ] Testing all 7 constraints
- [ ] Production deployment

---

### Phase 3: Prestige Endless (Sprint 6-9, ~4-5 weeks)

**Week 1: Core Systems**
- [ ] Database schema (`prestige_endless_*` tables)
- [ ] Wave progression logic
- [ ] Lives system
- [ ] Buff catalog definition

**Week 2: Buff System**
- [ ] Buff selection modal
- [ ] Buff effect application to scoring
- [ ] Active buffs display
- [ ] Buff persistence across waves

**Week 3: Prestige Mechanic**
- [ ] Prestige confirmation flow
- [ ] Prestige Points calculation
- [ ] Prestige shop items
- [ ] Prestige level display

**Week 4: UI & Polish**
- [ ] Wave counter & lives display
- [ ] Buff selection animations
- [ ] Prestige button (glowing when ready)
- [ ] Run summary screen

**Week 5: Integration & Launch**
- [ ] Leaderboards (highest wave, fastest to 50, etc.)
- [ ] Prestige shop UI
- [ ] Analytics & balancing
- [ ] Production deployment

---

### Testing Strategy

**Unit Tests:**
- Seed generation determinism (same seed = same board)
- Scoring calculations (combo multipliers, buffs)
- Constraint validators (Weekly Gauntlet)
- Prestige Points calculation

**Integration Tests:**
- State persistence (save/load)
- Board transitions (Mini-Marathon)
- Wave advancement (Prestige Endless)
- Leaderboard queries

**User Testing:**
- Playtest all 7 Weekly Gauntlet constraints
- Balance testing (are thresholds achievable?)
- UX feedback on buff selection
- Performance testing (large prestige runs)

---

### Balancing Considerations

**Mini-Marathon:**
- Adjust grading thresholds based on first week data
- Monitor average completion time (target: 5-7 min)
- Ensure boards 1-3 have similar solvability

**Weekly Gauntlet:**
- Constraint difficulty should feel fair
- Thursday (Rarity) might be too hard → adjust
- Weekly thresholds may need tuning after launch

**Prestige Endless:**
- Buff power scaling (avoid runaway OP builds)
- Wave difficulty curve (should feel challenging but fair)
- Prestige Point economy (how long to earn cosmetics?)

---

### Analytics Tracking

**Key Metrics:**

**Mini-Marathon:**
- Daily active users (DAU)
- Completion rate (% who finish all 3 boards)
- Average time per marathon
- Grade distribution (Bronze/Silver/Gold/Platinum)
- Retention: D1, D7, D30

**Weekly Gauntlet:**
- Weekly active users (WAU)
- Puzzles completed per user (average)
- 7/7 completion rate
- Most/least popular days
- Retention: W1, W4, W8

**Prestige Endless:**
- Average wave reached
- Prestige rate (% who prestige)
- Buff diversity (which buffs are chosen most)
- Session length
- Long-term engagement (P1+ players)

---

## Summary

These three modes provide:

1. **Mini-Marathon**: Quick daily engagement (5-7 min), complements Daily Challenge
2. **Weekly Gauntlet**: Deep weekly commitment, variety through constraints, high retention
3. **Prestige Endless**: Long-term progression, meta-game for hardcore players

All three leverage Lexichain's existing strengths (seeded boards, special tiles, strategic depth) while adding fresh mechanics that drive different types of engagement.

**Recommended Launch Order:**
1. Mini-Marathon (quickest to build, immediate value)
2. Weekly Gauntlet (high retention potential)
3. Prestige Endless (complex but creates long-term sticky players)
