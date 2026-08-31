export const LABS_UNLOCK_TAPS = 7;
export const LABS_UNLOCK_WINDOW_MS = 5_000;

export type LabsUnlockSequence = {
  count: number;
  startedAt: number | null;
  lastAt: number | null;
  unlocked: boolean;
};

export type LabsUnlockTransition = {
  state: LabsUnlockSequence;
  remaining: number | null;
  justUnlocked: boolean;
};

export function createLabsUnlockSequence(unlocked = false): LabsUnlockSequence {
  return { count: 0, startedAt: null, lastAt: null, unlocked };
}

export function activateLabsUnlock(
  current: LabsUnlockSequence,
  now: number,
  source: 'version' | 'credits' = 'version',
): LabsUnlockTransition {
  if (source !== 'version' || current.unlocked) {
    return { state: current, remaining: null, justUnlocked: false };
  }

  const invalidTime = !Number.isFinite(now) || (current.lastAt !== null && now < current.lastAt);
  const expired = current.startedAt !== null && now - current.startedAt > LABS_UNLOCK_WINDOW_MS;
  const reset = invalidTime || expired;
  const startedAt = reset || current.startedAt === null ? now : current.startedAt;
  const count = (reset ? 0 : current.count) + 1;
  const unlocked = count >= LABS_UNLOCK_TAPS;
  const state = unlocked
    ? createLabsUnlockSequence(true)
    : { count, startedAt, lastAt: now, unlocked: false };

  return {
    state,
    remaining: count >= 3 && !unlocked ? LABS_UNLOCK_TAPS - count : null,
    justUnlocked: unlocked,
  };
}
