// Distinct haptic patterns per game event. navigator.vibrate is a no-op on
// devices (and iOS Safari) that don't support it.
const PATTERNS = {
  select: 8,
  valid: [20, 30, 40],
  invalid: [60, 40, 60],
  tierUp: [30, 40, 30, 40, 80],
  gameOver: [80, 60, 120],
} as const;

export type HapticEvent = keyof typeof PATTERNS;

export function haptic(event: HapticEvent) {
  try {
    navigator.vibrate?.(PATTERNS[event] as number | number[]);
  } catch {
    // Some browsers throw when vibrate is called without a user gesture.
  }
}
