'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  COACH_PERSONALITIES,
  createCoachMemory,
  createDisplayMessageMemory,
  curateVoices,
  deriveCoachContext,
  makeCountdownSpeech,
  makeDisplayMessageSpeech,
  makePreviewSpeech,
  planCoachIntervention,
  resolveActiveCoach,
  resolveCoachPersonality,
  selectDisplayMessage,
  selectPhaseSpeech,
} from '@/coach';
import type {
  ActiveCoach,
  CoachMemory,
  CoachPersonalityPreference,
  CoachSpeech,
  DisplayMessage,
  DisplayMessageKind,
  DisplayMessageMemory,
  PhaseKind,
  VoicePreference,
} from '@/coach';

type TimerConfig = {
  id: string;
  name: string;
  nameIsCustom?: boolean;
  prepare: number;
  work: number;
  rest: number;
  rounds: number;
  cycles: number;
  cycleRest: number;
  cooldown: number;
};

type Settings = {
  soundEnabled: boolean;
  volume: number;
  ticking: boolean;
  voiceEnabled: boolean;
  voiceURI: string;
  coachPersonality: CoachPersonalityPreference;
  voicePreference: VoicePreference;
  lastAutomaticVoiceURI: string;
  ducking: boolean;
  rotation: boolean;
};

type WorkoutPhase = {
  kind: PhaseKind;
  label: string;
  duration: number;
  round: number;
  cycle: number;
};

type ScreenName = 'home' | 'library' | 'editor' | 'runner' | 'settings';
type ReturnScreen = 'home' | 'library';

const APP_VERSION = '1.2.0';
const TIMERS_STORAGE = 'pulse-timers-v2';
const LEGACY_TIMERS_STORAGE = 'pulse-timers-v1';
const SETTINGS_STORAGE = 'pulse-settings-v1';
const DISPLAY_MESSAGE_MEMORY_STORAGE = 'pulse-display-message-memory-v1';
const HOME_TIMER_LIMIT = 4;

function generatedTimerName(timer: Pick<TimerConfig, 'work' | 'rest' | 'rounds' | 'cycles'>) {
  const cycles = timer.cycles > 1 ? ` X ${timer.cycles}` : '';
  return `${timer.work}s work - ${timer.rest}s rest X ${timer.rounds}${cycles}`;
}

function makeDefaultTimer(work: number, rest: number, index: number): TimerConfig {
  const timer: TimerConfig = {
    id: `preset-${work}-${rest}-4-${index}`,
    name: '',
    nameIsCustom: false,
    prepare: 5,
    work,
    rest,
    rounds: 4,
    cycles: 1,
    cycleRest: 60,
    cooldown: 10,
  };
  timer.name = generatedTimerName(timer);
  return timer;
}

const DEFAULT_COMBINATIONS: Array<[number, number]> = [
  [10, 60], [10, 90], [15, 60], [15, 90], [20, 60], [20, 90], [20, 120],
  [30, 60], [30, 90], [30, 120], [40, 60], [40, 90], [50, 60], [50, 90],
];

const DEFAULT_TIMERS = DEFAULT_COMBINATIONS.map(([work, rest], index) => makeDefaultTimer(work, rest, index));

const LEGACY_DEFAULTS: TimerConfig[] = [
  { id: 'classic-30-60', name: 'Classic 30 / 60', prepare: 5, work: 30, rest: 60, rounds: 4, cycles: 1, cycleRest: 60, cooldown: 10 },
  { id: 'power-20-10', name: 'Power 20 / 10', prepare: 10, work: 20, rest: 10, rounds: 8, cycles: 2, cycleRest: 90, cooldown: 30 },
  { id: 'steady-45-15', name: 'Steady 45 / 15', prepare: 10, work: 45, rest: 15, rounds: 6, cycles: 1, cycleRest: 60, cooldown: 45 },
];

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  volume: 0.65,
  ticking: false,
  voiceEnabled: false,
  voiceURI: '',
  coachPersonality: 'focused',
  voicePreference: 'either',
  lastAutomaticVoiceURI: '',
  ducking: false,
  rotation: true,
};

function makeEmptyTimer(): TimerConfig {
  const timer: TimerConfig = {
    id: '',
    name: '',
    nameIsCustom: false,
    prepare: 10,
    work: 30,
    rest: 15,
    rounds: 6,
    cycles: 1,
    cycleRest: 60,
    cooldown: 30,
  };
  timer.name = generatedTimerName(timer);
  return timer;
}

const PHASE_META: Record<PhaseKind, { label: string; short: string }> = {
  prepare: { label: 'Prepare', short: 'Get ready' },
  work: { label: 'Work', short: 'Push' },
  rest: { label: 'Rest', short: 'Recover' },
  cycleRest: { label: 'Cycle rest', short: 'Reset' },
  cooldown: { label: 'Cooldown', short: 'Breathe' },
};

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function formatCompact(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return formatTime(seconds);
}

function workoutDuration(timer: TimerConfig) {
  const work = timer.work * timer.rounds * timer.cycles;
  const roundRests = timer.rest * Math.max(0, timer.rounds - 1) * timer.cycles;
  const cycleRests = timer.cycleRest * Math.max(0, timer.cycles - 1);
  return timer.prepare + work + roundRests + cycleRests + timer.cooldown;
}

function buildSequence(timer: TimerConfig): WorkoutPhase[] {
  const sequence: WorkoutPhase[] = [];
  if (timer.prepare > 0) {
    sequence.push({ kind: 'prepare', label: 'Prepare', duration: timer.prepare, round: 1, cycle: 1 });
  }

  for (let cycle = 1; cycle <= timer.cycles; cycle += 1) {
    for (let round = 1; round <= timer.rounds; round += 1) {
      sequence.push({ kind: 'work', label: 'Work', duration: timer.work, round, cycle });
      if (round < timer.rounds && timer.rest > 0) {
        sequence.push({ kind: 'rest', label: 'Rest', duration: timer.rest, round, cycle });
      }
    }

    if (cycle < timer.cycles && timer.cycleRest > 0) {
      sequence.push({ kind: 'cycleRest', label: 'Cycle rest', duration: timer.cycleRest, round: timer.rounds, cycle });
    }
  }

  if (timer.cooldown > 0) {
    sequence.push({ kind: 'cooldown', label: 'Cooldown', duration: timer.cooldown, round: timer.rounds, cycle: timer.cycles });
  }

  return sequence;
}

function isUnchangedLegacyDefault(timer: TimerConfig) {
  const original = LEGACY_DEFAULTS.find((candidate) => candidate.id === timer.id);
  if (!original) return false;
  return (['name', 'prepare', 'work', 'rest', 'rounds', 'cycles', 'cycleRest', 'cooldown'] as const)
    .every((key) => timer[key] === original[key]);
}

function migrateLegacyTimers(timers: TimerConfig[]) {
  const preserved = timers
    .filter((timer) => !isUnchangedLegacyDefault(timer))
    .map((timer) => ({
      ...timer,
      id: LEGACY_DEFAULTS.some((preset) => preset.id === timer.id) ? `migrated-${timer.id}` : timer.id,
      nameIsCustom: true,
    }));
  return [...DEFAULT_TIMERS, ...preserved];
}

function PlayGlyph() {
  return <span className="play-glyph" aria-hidden="true" />;
}

function PauseGlyph() {
  return <span className="pause-glyph" aria-hidden="true"><i /><i /></span>;
}

function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`switch ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
      <span className="switch-track"><span className="switch-thumb" /></span>
    </label>
  );
}

function MetricInput({
  label,
  helper,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  helper: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="metric-input">
      <span className="metric-copy"><strong>{label}</strong><small>{helper}</small></span>
      <span className="metric-control">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : min);
          }}
        />
        <span>{unit}</span>
      </span>
    </label>
  );
}

function TimerDetails({ timer, index }: { timer: TimerConfig; index: number }) {
  return (
    <>
      <span className={`timer-number color-${index % 3}`}>{String(index + 1).padStart(2, '0')}</span>
      <span className="timer-info">
        <strong>{timer.name}</strong>
        <small>{formatTime(workoutDuration(timer))} · {timer.rounds} rounds · {timer.cycles} {timer.cycles === 1 ? 'cycle' : 'cycles'}</small>
        <span className="interval-row">
          <span><i className="dot work-dot" /> Work {formatCompact(timer.work)}</span>
          <span><i className="dot rest-dot" /> Rest {formatCompact(timer.rest)}</span>
        </span>
      </span>
    </>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [returnScreen, setReturnScreen] = useState<ReturnScreen>('home');
  const [timers, setTimers] = useState<TimerConfig[]>(DEFAULT_TIMERS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<TimerConfig>(makeEmptyTimer());
  const [activeTimer, setActiveTimer] = useState<TimerConfig>(DEFAULT_TIMERS[0]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_TIMERS[0].prepare);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [runnerMessageSelection, setRunnerMessageSelection] = useState<{
    phaseIndex: number;
    kind: DisplayMessageKind;
    message: DisplayMessage;
  } | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeCoachRef = useRef<ActiveCoach | null>(null);
  const coachMemoryRef = useRef<CoachMemory>(createCoachMemory());
  const displayMessageMemoryRef = useRef<DisplayMessageMemory>(createDisplayMessageMemory());
  const deadlineRef = useRef(0);
  const transitionLockRef = useRef(false);
  const lastTickSecondRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const sequence = useMemo(() => buildSequence(activeTimer), [activeTimer]);
  const currentPhase = sequence[phaseIndex];
  const nextPhase = sequence[phaseIndex + 1];
  const curatedVoices = useMemo(() => curateVoices(availableVoices), [availableVoices]);
  const recommendedVoices = curatedVoices.filter(({ profile }) => profile.recommended && !profile.novelty);
  const otherVoices = curatedVoices.filter(({ profile }) => !profile.recommended || profile.novelty);

  useEffect(() => {
    let storedTimers: TimerConfig[] | null = null;
    let storedSettings: Settings | null = null;
    try {
      const savedTimers = window.localStorage.getItem(TIMERS_STORAGE);
      const legacyTimers = window.localStorage.getItem(LEGACY_TIMERS_STORAGE);
      const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE);
      const savedDisplayMessageMemory = window.localStorage.getItem(DISPLAY_MESSAGE_MEMORY_STORAGE);
      if (savedTimers) {
        const parsed = JSON.parse(savedTimers) as TimerConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) storedTimers = parsed;
      } else if (legacyTimers) {
        const parsed = JSON.parse(legacyTimers) as TimerConfig[];
        if (Array.isArray(parsed)) storedTimers = migrateLegacyTimers(parsed);
      }
      if (savedSettings) storedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      if (savedDisplayMessageMemory) {
        displayMessageMemoryRef.current = createDisplayMessageMemory(JSON.parse(savedDisplayMessageMemory));
      }
    } catch {
      // Keep safe defaults when device storage contains invalid data.
    }

    window.queueMicrotask(() => {
      if (storedTimers) setTimers(storedTimers);
      if (storedSettings) setSettings(storedSettings);
      setHydrated(true);
    });

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TIMERS_STORAGE, JSON.stringify(timers));
  }, [timers, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
  }, [settings, hydrated]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices.filter((voice) => voice.lang.toLowerCase().startsWith('en')));
    };
    const timer = window.setTimeout(refreshVoices, 0);
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
    };
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    if (!context) return null;
    try {
      if (context.state !== 'running') await context.resume();
      return context.state === 'running' ? context : null;
    } catch {
      return null;
    }
  }, []);

  const playTone = useCallback(async (frequency: number, duration = 0.11, volumeScale = 1) => {
    if (!settings.soundEnabled || settings.volume <= 0) return false;
    const context = await ensureAudio();
    if (!context) return false;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, settings.volume * 0.18 * volumeScale), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    return true;
  }, [ensureAudio, settings.soundEnabled, settings.volume]);

  const playCue = useCallback(async (kind: PhaseKind | 'complete') => {
    const frequencies: Record<PhaseKind | 'complete', number> = {
      prepare: 560,
      work: 920,
      rest: 330,
      cycleRest: 460,
      cooldown: 520,
      complete: 1040,
    };
    const played = await playTone(frequencies[kind], kind === 'complete' ? 0.3 : 0.16, 1.2);
    if (kind === 'complete' && played) {
      window.setTimeout(() => { void playTone(1240, 0.34, 1.2); }, 180);
    }
    return played;
  }, [playTone]);

  const speakCoach = useCallback((speech: CoachSpeech, options?: { interrupt?: boolean; voiceURI?: string }) => {
    if (!settings.voiceEnabled || !('speechSynthesis' in window)) return;
    if (options?.interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speech.text);
    const voiceURI = options?.voiceURI ?? activeCoachRef.current?.voiceURI ?? '';
    const liveVoices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const selectedVoice = liveVoices.find((voice) => voice.voiceURI === voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = selectedVoice?.lang ?? 'en-US';
    utterance.rate = speech.rate;
    utterance.pitch = speech.pitch;
    utterance.volume = settings.volume;
    window.speechSynthesis.speak(utterance);
  }, [availableVoices, settings.voiceEnabled, settings.volume]);

  const contextForPhase = useCallback((phase: WorkoutPhase, index: number, phaseRemaining = phase.duration) => (
    deriveCoachContext({
      phase,
      phaseIndex: index,
      sequence,
      remainingInPhase: phaseRemaining,
      totalRounds: activeTimer.rounds,
      totalCycles: activeTimer.cycles,
    })
  ), [activeTimer.cycles, activeTimer.rounds, sequence]);

  const announcePhase = useCallback((phase: WorkoutPhase, index: number) => {
    void playCue(phase.kind);
    const personality = activeCoachRef.current?.personality
      ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
    speakCoach(selectPhaseSpeech(personality, phase.kind, contextForPhase(phase, index)), { interrupt: true });
  }, [contextForPhase, playCue, settings.coachPersonality, speakCoach]);

  const resolveWorkoutCoach = useCallback(() => {
    if (activeCoachRef.current) return activeCoachRef.current;
    const liveVoices = availableVoices.length > 0
      ? availableVoices
      : ('speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    const personality = resolveCoachPersonality(settings.coachPersonality);
    const coach = resolveActiveCoach({
      voices: liveVoices,
      personality,
      preference: settings.voicePreference,
      selectedVoiceURI: settings.voiceURI,
      previousAutomaticVoiceURI: settings.lastAutomaticVoiceURI,
    });
    activeCoachRef.current = coach;
    if (!settings.voiceURI && coach.voiceURI && coach.voiceURI !== settings.lastAutomaticVoiceURI) {
      setSettings((current) => ({ ...current, lastAutomaticVoiceURI: coach.voiceURI }));
    }
    return coach;
  }, [availableVoices, settings.coachPersonality, settings.lastAutomaticVoiceURI, settings.voicePreference, settings.voiceURI]);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    try {
      wakeLockRef.current = await nav.wakeLock?.request('screen') ?? null;
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const applyOrientation = useCallback(async (allowRotation: boolean) => {
    try {
      if (allowRotation) {
        screenOrientation().unlock?.();
      } else {
        await screenOrientation().lock?.('portrait');
      }
    } catch {
      // iOS only allows orientation locks in supported standalone/fullscreen contexts.
    }
  }, []);

  function screenOrientation() {
    return window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
      unlock?: () => void;
    };
  }

  const selectRunnerMessage = useCallback((phase: WorkoutPhase, index: number) => {
    const kind: DisplayMessageKind | null = phase.kind === 'rest' || phase.kind === 'cycleRest'
      ? 'motivation'
      : phase.kind === 'cooldown'
        ? 'aspiration'
        : null;
    if (!kind) {
      setRunnerMessageSelection(null);
      return null;
    }

    const selection = selectDisplayMessage(kind, displayMessageMemoryRef.current);
    displayMessageMemoryRef.current = selection.memory;
    try {
      window.localStorage.setItem(DISPLAY_MESSAGE_MEMORY_STORAGE, JSON.stringify(selection.memory));
    } catch {
      // Message rotation still works when device storage is unavailable.
    }
    const runnerSelection = { phaseIndex: index, kind, message: selection.message };
    setRunnerMessageSelection(runnerSelection);
    return runnerSelection;
  }, []);

  const finishPhase = useCallback(() => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    const nextIndex = phaseIndex + 1;

    if (nextIndex >= sequence.length) {
      setRunning(false);
      setFinished(true);
      setRemaining(0);
      void playCue('complete');
      const personality = activeCoachRef.current?.personality
        ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
      const finishingFromCooldown = sequence[phaseIndex]?.kind === 'cooldown';
      speakCoach(selectPhaseSpeech(personality, 'complete'), { interrupt: !finishingFromCooldown });
      releaseWakeLock();
      transitionLockRef.current = false;
      return;
    }

    const upcoming = sequence[nextIndex];
    setPhaseIndex(nextIndex);
    setRemaining(upcoming.duration);
    lastTickSecondRef.current = upcoming.duration;
    deadlineRef.current = Date.now() + upcoming.duration * 1000;
    const messageSelection = selectRunnerMessage(upcoming, nextIndex);
    announcePhase(upcoming, nextIndex);
    if (messageSelection) {
      const personality = activeCoachRef.current?.personality
        ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
      speakCoach(makeDisplayMessageSpeech(personality, messageSelection.kind, messageSelection.message));
    }
    transitionLockRef.current = false;
  }, [announcePhase, phaseIndex, playCue, releaseWakeLock, selectRunnerMessage, sequence, settings.coachPersonality, speakCoach]);

  useEffect(() => {
    if (!running || !currentPhase) return;
    const interval = window.setInterval(() => {
      const millisecondsLeft = deadlineRef.current - Date.now();
      const nextRemaining = Math.max(0, Math.ceil(millisecondsLeft / 1000));

      if (nextRemaining !== lastTickSecondRef.current) {
        lastTickSecondRef.current = nextRemaining;
        setRemaining(nextRemaining);
        if (nextRemaining > 0 && settings.ticking) {
          void playTone(1180, 0.035, 0.34);
        }
        if ((currentPhase.kind === 'prepare' || currentPhase.kind === 'work' || currentPhase.kind === 'rest') && nextRemaining > 0 && nextRemaining <= 3) {
          const personality = activeCoachRef.current?.personality
            ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
          speakCoach(makeCountdownSpeech(personality, nextRemaining));
        }
        if (settings.voiceEnabled && currentPhase.kind === 'work') {
          const personality = activeCoachRef.current?.personality
            ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
          const context = contextForPhase(currentPhase, phaseIndex, nextRemaining);
          const plan = planCoachIntervention(personality, context, coachMemoryRef.current);
          coachMemoryRef.current = plan.memory;
          if (plan.speech) speakCoach(plan.speech);
        }
      }

      if (millisecondsLeft <= 0) finishPhase();
    }, 100);

    return () => window.clearInterval(interval);
  }, [contextForPhase, currentPhase, finishPhase, phaseIndex, playTone, running, settings.coachPersonality, settings.ticking, settings.voiceEnabled, speakCoach]);

  useEffect(() => () => {
    releaseWakeLock();
    window.speechSynthesis?.cancel();
  }, [releaseWakeLock]);

  const openEditor = (timer?: TimerConfig, origin?: ReturnScreen) => {
    const destination = origin ?? (screen === 'library' ? 'library' : 'home');
    setReturnScreen(destination);
    setDraft(timer ? { ...timer, nameIsCustom: timer.nameIsCustom ?? true } : makeEmptyTimer());
    setScreen('editor');
  };

  const updateDraftMetric = (key: keyof Pick<TimerConfig, 'prepare' | 'work' | 'rest' | 'rounds' | 'cycles' | 'cycleRest' | 'cooldown'>, value: number) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (!current.nameIsCustom) next.name = generatedTimerName(next);
      return next;
    });
  };

  const updateDraftName = (name: string) => {
    setDraft((current) => ({ ...current, name, nameIsCustom: name.trim() !== generatedTimerName(current) }));
  };

  const resetDraftName = () => {
    setDraft((current) => ({ ...current, name: generatedTimerName(current), nameIsCustom: false }));
  };

  const saveTimer = () => {
    const normalizedDraft = {
      ...draft,
      work: Math.max(1, draft.work),
      rounds: Math.max(1, draft.rounds),
      cycles: Math.max(1, draft.cycles),
    };
    const customName = normalizedDraft.name.trim();
    const automaticName = generatedTimerName(normalizedDraft);
    const safeTimer: TimerConfig = {
      ...normalizedDraft,
      id: draft.id || `timer-${Date.now()}`,
      name: customName || automaticName,
      nameIsCustom: Boolean(customName && customName !== automaticName),
    };

    setTimers((current) => {
      const exists = current.some((timer) => timer.id === safeTimer.id);
      return exists
        ? current.map((timer) => timer.id === safeTimer.id ? safeTimer : timer)
        : [safeTimer, ...current];
    });
    setScreen(returnScreen);
  };

  const deleteTimer = () => {
    if (!draft.id) return;
    setTimers((current) => current.filter((timer) => timer.id !== draft.id));
    setScreen('library');
  };

  const moveTimer = (index: number, offset: -1 | 1) => {
    setTimers((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(destination, 0, moved);
      return next;
    });
  };

  const beginWorkout = (timer: TimerConfig) => {
    const firstSequence = buildSequence(timer);
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    setRunnerMessageSelection(null);
    setActiveTimer(timer);
    setPhaseIndex(0);
    setRemaining(firstSequence[0]?.duration ?? 0);
    lastTickSecondRef.current = firstSequence[0]?.duration ?? 0;
    setRunning(false);
    setFinished(false);
    setScreen('runner');
    void applyOrientation(settings.rotation);
  };

  const toggleWorkout = async () => {
    if (finished) {
      activeCoachRef.current = null;
      coachMemoryRef.current = createCoachMemory();
      setRunnerMessageSelection(null);
      setPhaseIndex(0);
      setRemaining(sequence[0]?.duration ?? 0);
      lastTickSecondRef.current = sequence[0]?.duration ?? 0;
      setFinished(false);
      return;
    }

    if (running) {
      setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      setRunning(false);
      window.speechSynthesis?.cancel();
      releaseWakeLock();
    } else {
      await ensureAudio();
      resolveWorkoutCoach();
      deadlineRef.current = Date.now() + remaining * 1000;
      lastTickSecondRef.current = remaining;
      setRunning(true);
      if (currentPhase) {
        announcePhase(currentPhase, phaseIndex);
        if (runnerMessageSelection?.phaseIndex === phaseIndex) {
          const personality = activeCoachRef.current?.personality
            ?? resolveCoachPersonality(settings.coachPersonality, () => 0);
          speakCoach(makeDisplayMessageSpeech(personality, runnerMessageSelection.kind, runnerMessageSelection.message));
        }
      }
      void requestWakeLock();
    }
  };

  const resetWorkout = () => {
    setRunning(false);
    setFinished(false);
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    setRunnerMessageSelection(null);
    setPhaseIndex(0);
    setRemaining(sequence[0]?.duration ?? 0);
    lastTickSecondRef.current = sequence[0]?.duration ?? 0;
    window.speechSynthesis?.cancel();
    releaseWakeLock();
  };

  const leaveWorkout = () => {
    setRunning(false);
    activeCoachRef.current = null;
    coachMemoryRef.current = createCoachMemory();
    setRunnerMessageSelection(null);
    window.speechSynthesis?.cancel();
    releaseWakeLock();
    try { screenOrientation().unlock?.(); } catch { /* no-op */ }
    setScreen('home');
  };

  const openSettings = (origin: ReturnScreen) => {
    setReturnScreen(origin);
    setScreen('settings');
  };

  const previewCoach = () => {
    const liveVoices = availableVoices.length > 0
      ? availableVoices
      : ('speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
    const personality = resolveCoachPersonality(settings.coachPersonality);
    const preview = resolveActiveCoach({
      voices: liveVoices,
      personality,
      preference: settings.voicePreference,
      selectedVoiceURI: settings.voiceURI,
      previousAutomaticVoiceURI: '',
      random: () => 0,
    });
    speakCoach(makePreviewSpeech(personality), { interrupt: true, voiceURI: preview.voiceURI });
  };

  const totalRemaining = finished
    ? 0
    : remaining + sequence.slice(phaseIndex + 1).reduce((sum, phase) => sum + phase.duration, 0);

  const phaseProgress = currentPhase && currentPhase.duration > 0
    ? Math.min(1, Math.max(0, (currentPhase.duration - remaining) / currentPhase.duration))
    : finished ? 1 : 0;

  const currentMessageKind: DisplayMessageKind | null = currentPhase?.kind === 'rest' || currentPhase?.kind === 'cycleRest'
    ? 'motivation'
    : currentPhase?.kind === 'cooldown'
      ? 'aspiration'
      : null;
  const runnerMessage = runnerMessageSelection?.phaseIndex === phaseIndex && runnerMessageSelection.kind === currentMessageKind
    ? runnerMessageSelection.message
    : null;

  if (screen === 'editor') {
    return (
      <main className="app-shell editor-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen(returnScreen)}>Cancel</button>
          <div className="header-title"><span className="eyebrow">TIMER SETUP</span><strong>{draft.id ? 'Edit timer' : 'New timer'}</strong></div>
          <button className="text-button accent" onClick={saveTimer}>Save</button>
        </header>

        <section className="editor-content">
          <label className="name-field">
            <span>Workout name</span>
            <input value={draft.name} maxLength={48} onChange={(event) => updateDraftName(event.target.value)} placeholder={generatedTimerName(draft)} />
          </label>
          <div className="name-helper">
            <span>{draft.nameIsCustom ? 'Custom name' : 'Updates automatically with the intervals'}</span>
            {draft.nameIsCustom && <button onClick={resetDraftName}>Use automatic name</button>}
          </div>

          <div className="editor-section-title"><span>Intervals</span><small>SECONDS</small></div>
          <div className="metric-list">
            <MetricInput label="Prepare" helper="Countdown before you start" value={draft.prepare} unit="sec" min={0} max={600} onChange={(value) => updateDraftMetric('prepare', value)} />
            <MetricInput label="Work" helper="Move for this long" value={draft.work} unit="sec" min={1} max={3600} onChange={(value) => updateDraftMetric('work', value)} />
            <MetricInput label="Rest" helper="Between rounds" value={draft.rest} unit="sec" min={0} max={3600} onChange={(value) => updateDraftMetric('rest', value)} />
            <MetricInput label="Cooldown" helper="Once after the workout" value={draft.cooldown} unit="sec" min={0} max={3600} onChange={(value) => updateDraftMetric('cooldown', value)} />
          </div>

          <div className="editor-section-title"><span>Structure</span><small>REPEATS</small></div>
          <div className="metric-list">
            <MetricInput label="Rounds" helper="One round is one Work interval" value={draft.rounds} unit="×" min={1} max={99} onChange={(value) => updateDraftMetric('rounds', value)} />
            <MetricInput label="Cycles" helper={`One cycle repeats all ${draft.rounds} rounds`} value={draft.cycles} unit="×" min={1} max={20} onChange={(value) => updateDraftMetric('cycles', value)} />
            <MetricInput label="Rest between cycles" helper="Only inserted when cycles are 2 or more" value={draft.cycleRest} unit="sec" min={0} max={3600} onChange={(value) => updateDraftMetric('cycleRest', value)} />
          </div>

          <aside className="cycle-explainer">
            <span className="explainer-number">?</span>
            <div><strong>How cycles work</strong><p>Rounds are the Work intervals inside a block. A cycle repeats that whole block. The extra cycle rest is added only between blocks — never after the last one.</p></div>
          </aside>

          <div className="workout-summary"><span>Estimated duration</span><strong>{formatTime(workoutDuration(draft))}</strong></div>
          {draft.id && <button className="delete-button" onClick={deleteTimer}>Delete timer</button>}
        </section>
      </main>
    );
  }

  if (screen === 'settings') {
    return (
      <main className="app-shell settings-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen(returnScreen)}>Back</button>
          <div className="header-title"><span className="eyebrow">PREFERENCES</span><strong>Settings</strong></div>
          <button className="text-button accent" onClick={() => setScreen(returnScreen)}>Done</button>
        </header>

        <section className="settings-content">
          <div className="settings-group">
            <p className="settings-kicker">AUDIO</p>
            <div className="setting-row">
              <div><strong>Sound effects</strong><small>Phase cues and finish signal</small></div>
              <Switch label="Sound effects" checked={settings.soundEnabled} onChange={(soundEnabled) => setSettings((current) => ({ ...current, soundEnabled }))} />
            </div>
            <button className="setting-row setting-action" onClick={() => { void playCue('work'); }}>
              <div><strong>Sound scheme</strong><small>One built-in synthetic scheme</small></div>
              <span className="setting-value">Pulse beep <i className="mini-play"><PlayGlyph /></i></span>
            </button>
            <label className="volume-row">
              <span className="volume-icon">−</span>
              <input
                aria-label="App volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.volume}
                onChange={(event) => setSettings((current) => ({ ...current, volume: Number(event.target.value) }))}
                style={{ '--range-value': `${settings.volume * 100}%` } as CSSProperties}
              />
              <span className="volume-icon loud">＋</span>
              <output>{Math.round(settings.volume * 100)}%</output>
            </label>
            <div className="setting-row">
              <div><strong>Ticking sound</strong><small>One quiet tick every second</small></div>
              <Switch label="Ticking sound" checked={settings.ticking} onChange={(ticking) => setSettings((current) => ({ ...current, ticking }))} />
            </div>
            <p className="setting-note">On iPhone, synthetic Web Audio respects Silent Mode. Turn Silent Mode off to hear Pulse cues.</p>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">COACH VOICE</p>
            <div className="setting-row">
              <div><strong>Voice coach</strong><small>Phase cues, countdowns, and occasional coaching</small></div>
              <Switch label="Voice coach" checked={settings.voiceEnabled} onChange={(voiceEnabled) => setSettings((current) => ({ ...current, voiceEnabled }))} />
            </div>
            <fieldset className={`coach-choice-section ${!settings.voiceEnabled ? 'unavailable' : ''}`} disabled={!settings.voiceEnabled}>
              <legend>Coach personality</legend>
              <p>Sets the coach&apos;s wording and delivery for the workout.</p>
              <div className="personality-grid">
                {Object.values(COACH_PERSONALITIES).map((personality) => (
                  <button
                    type="button"
                    className={settings.coachPersonality === personality.id ? 'selected' : ''}
                    aria-pressed={settings.coachPersonality === personality.id}
                    key={personality.id}
                    onClick={() => setSettings((current) => ({ ...current, coachPersonality: personality.id }))}
                  >
                    <strong>{personality.label}</strong>
                    <small>{personality.description}</small>
                  </button>
                ))}
                <button
                  type="button"
                  className={`surprise-personality ${settings.coachPersonality === 'surprise' ? 'selected' : ''}`}
                  aria-pressed={settings.coachPersonality === 'surprise'}
                  onClick={() => setSettings((current) => ({ ...current, coachPersonality: 'surprise' }))}
                >
                  <strong>Surprise me</strong>
                  <small>Picks a personality when the workout starts and keeps it throughout</small>
                </button>
              </div>
            </fieldset>
            <fieldset className={`coach-choice-section compact ${!settings.voiceEnabled ? 'unavailable' : ''}`} disabled={!settings.voiceEnabled}>
              <legend>Voice preference</legend>
              <p>Used only when System voice is Automatic.</p>
              <div className="preference-grid">
                {([
                  ['female', 'Female'],
                  ['male', 'Male'],
                  ['either', 'Surprise me'],
                ] as Array<[VoicePreference, string]>).map(([preference, label]) => (
                  <button
                    type="button"
                    className={settings.voicePreference === preference ? 'selected' : ''}
                    aria-pressed={settings.voicePreference === preference}
                    key={preference}
                    onClick={() => setSettings((current) => ({ ...current, voicePreference: preference }))}
                  >{label}</button>
                ))}
              </div>
            </fieldset>
            <label className={`voice-select-row ${!settings.voiceEnabled ? 'unavailable' : ''}`}>
              <span><strong>System voice</strong><small>A specific voice overrides the preference above</small></span>
              <select
                aria-label="Coach voice"
                value={settings.voiceURI}
                disabled={!settings.voiceEnabled}
                onChange={(event) => setSettings((current) => ({ ...current, voiceURI: event.target.value }))}
              >
                <option value="">Automatic</option>
                {settings.voiceURI && !curatedVoices.some(({ voice }) => voice.voiceURI === settings.voiceURI) && (
                  <option value={settings.voiceURI}>Saved voice · unavailable on this device</option>
                )}
                {recommendedVoices.length > 0 && (
                  <optgroup label="Recommended">
                    {recommendedVoices.map(({ voice, profile }) => (
                      <option value={voice.voiceURI} key={voice.voiceURI}>
                        {voice.name} · {profile.gender ?? 'either'}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherVoices.length > 0 && (
                  <optgroup label="Other system voices">
                    {otherVoices.map(({ voice, profile }) => (
                      <option value={voice.voiceURI} key={voice.voiceURI}>
                        {voice.name} · {voice.lang}{profile.novelty ? ' · effect' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            <button className="setting-row setting-action" disabled={!settings.voiceEnabled} onClick={previewCoach}>
              <div><strong>Test coach</strong><small>Preview {settings.coachPersonality === 'surprise' ? 'a surprise personality' : 'this personality'} and voice</small></div>
              <span className="setting-value">Play <i className="mini-play"><PlayGlyph /></i></span>
            </button>
            <div className="setting-row unavailable">
              <div><strong>Ducking</strong><small>Reduce other music during cues</small></div>
              <Switch label="Ducking unavailable" checked={settings.ducking} onChange={() => undefined} disabled />
            </div>
            <p className="setting-note">Pulse uses this device&apos;s English system voices. Automatic avoids known effect voices and keeps one concrete voice for the entire workout.</p>
            <p className="setting-note secondary">Web apps on iOS cannot change the volume of Spotify, Apple Music or another app. Pulse can only control its own sounds.</p>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">DISPLAY</p>
            <div className="setting-row">
              <div><strong>Rotation</strong><small>Allow landscape during a workout</small></div>
              <Switch label="Allow screen rotation" checked={settings.rotation} onChange={(rotation) => setSettings((current) => ({ ...current, rotation }))} />
            </div>
            <p className="setting-note">Orientation locking depends on iOS and works best when Pulse is opened from the Home Screen.</p>
          </div>

          <footer className="version-card">
            <span className="brand-mark small">P</span>
            <div>
              <strong>Pulse</strong>
              <small>Version {APP_VERSION} · Installable PWA · <a href="./third-party-notices.txt" target="_blank" rel="noreferrer">Content credits</a></small>
            </div>
          </footer>
        </section>
      </main>
    );
  }

  if (screen === 'runner') {
    const phaseKind = finished ? 'complete' : currentPhase?.kind ?? 'prepare';
    const phaseClass = phaseKind === 'complete' ? 'complete' : phaseKind;
    return (
      <main className={`runner-screen phase-${phaseClass}`}>
        <header className="runner-header">
          <button className="round-icon-button" onClick={leaveWorkout} aria-label="Back to timers">←</button>
          <div><p>{activeTimer.name}</p><strong>{formatTime(totalRemaining)} left</strong></div>
          <button className="round-icon-button" onClick={resetWorkout} aria-label="Reset workout">↻</button>
        </header>

        <section className="runner-main" aria-live="polite" aria-atomic="true">
          <p className="phase-kicker">{finished ? 'SESSION' : PHASE_META[currentPhase?.kind ?? 'prepare'].short}</p>
          <h1>{finished ? 'Complete' : currentPhase?.label}</h1>
          <div className="giant-time">{finished ? '✓' : formatTime(remaining)}</div>
          {runnerMessage && (
            <figure className={`runner-message ${currentPhase?.kind === 'cooldown' ? 'reflection' : ''}`}>
              <blockquote>“{runnerMessage.text}”</blockquote>
              <figcaption>— {runnerMessage.author}</figcaption>
            </figure>
          )}
          <div className="phase-progress" aria-label={`${Math.round(phaseProgress * 100)} percent complete`}><span style={{ width: `${phaseProgress * 100}%` }} /></div>
        </section>

        <section className="runner-up-next">
          <div><span>{finished ? 'Workout' : 'Up next'}</span><strong>{finished ? `${formatTime(workoutDuration(activeTimer))} total` : nextPhase ? `${nextPhase.label} · ${formatTime(nextPhase.duration)}` : 'Finish'}</strong></div>
          <div className="mini-progress" aria-hidden="true"><span style={{ width: `${phaseProgress * 100}%` }} /></div>
        </section>

        <section className="runner-controls">
          <div className="runner-stat"><strong>{finished ? activeTimer.rounds : currentPhase?.round ?? 1}</strong><span>Round / {activeTimer.rounds}</span></div>
          <button className={`main-control ${running ? 'is-running' : ''}`} onClick={() => { void toggleWorkout(); }} aria-label={finished ? 'Restart workout' : running ? 'Pause workout' : 'Start workout'}>
            <span>{finished ? '↻' : running ? <PauseGlyph /> : <PlayGlyph />}</span>
            <small>{finished ? 'Again' : running ? 'Pause' : phaseIndex === 0 && remaining === sequence[0]?.duration ? 'Start' : 'Resume'}</small>
          </button>
          <div className="runner-stat"><strong>{finished ? activeTimer.cycles : currentPhase?.cycle ?? 1}</strong><span>Cycle / {activeTimer.cycles}</span></div>
        </section>
      </main>
    );
  }

  if (screen === 'library') {
    return (
      <main className="app-shell library-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen('home')}>Home</button>
          <div className="header-title"><span className="eyebrow">YOUR LIBRARY</span><strong>Timers</strong></div>
          <button className="text-button accent" onClick={() => openEditor(undefined, 'library')}>New</button>
        </header>

        <section className="library-content">
          <div className="library-intro"><div><p className="eyebrow">ALL PROGRAMS</p><h1>{timers.length} timers</h1></div><p>Run, edit, or move a timer. The first four become your Home shortcuts.</p></div>
          <div className="library-list">
            {timers.map((timer, index) => (
              <article className="library-card" key={timer.id}>
                <button className="library-run" onClick={() => beginWorkout(timer)} aria-label={`Start ${timer.name}`}>
                  <TimerDetails timer={timer} index={index} />
                  <span className="play-button"><PlayGlyph /></span>
                </button>
                <div className="library-actions">
                  <button onClick={() => moveTimer(index, -1)} disabled={index === 0} aria-label={`Move ${timer.name} up`}>↑</button>
                  <button onClick={() => moveTimer(index, 1)} disabled={index === timers.length - 1} aria-label={`Move ${timer.name} down`}>↓</button>
                  <button className="edit-action" onClick={() => openEditor(timer, 'library')} aria-label={`Edit ${timer.name}`}>Edit</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <button className="nav-item" onClick={() => setScreen('home')}><span>⌂</span>Home</button>
          <button className="nav-item active" onClick={() => setScreen('library')}><span>◴</span>Timers</button>
          <button className="nav-item" onClick={() => openSettings('library')}><span>⚙︎</span>Settings</button>
        </nav>
      </main>
    );
  }

  const homeTimers = timers.slice(0, HOME_TIMER_LIMIT);
  return (
    <main className="app-shell home-screen">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">P</span><div><p className="eyebrow">INTERVAL TRAINING</p><h1>Pulse</h1></div></div>
        <button className="icon-button" aria-label="Open settings" onClick={() => openSettings('home')}>⚙︎</button>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow dark">READY WHEN YOU ARE</p>
          <h2 id="hero-title">Make every<br />second count.</h2>
          <p>Build focused interval workouts and take them anywhere — even offline.</p>
        </div>
        <button className="new-timer-button" onClick={() => openEditor(undefined, 'home')}><span className="plus">+</span>New timer</button>
      </section>

      <section className="workouts" aria-labelledby="workouts-title">
        <div className="section-heading">
          <div><p className="eyebrow">QUICK START</p><h2 id="workouts-title">My timers</h2></div>
          <button className="manage-link" onClick={() => setScreen('library')}>Manage {timers.length} →</button>
        </div>

        {homeTimers.length === 0 ? (
          <div className="empty-state"><strong>No timers yet</strong><p>Create one and it will stay saved on this device.</p><button onClick={() => openEditor(undefined, 'home')}>Create timer</button></div>
        ) : (
          <div className="timer-list">
            {homeTimers.map((timer, index) => (
              <button className="timer-card timer-launch" key={timer.id} onClick={() => beginWorkout(timer)} aria-label={`Start ${timer.name}`}>
                <TimerDetails timer={timer} index={index} />
                <span className="play-button"><PlayGlyph /></span>
              </button>
            ))}
          </div>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <button className="nav-item active" onClick={() => setScreen('home')}><span>⌂</span>Home</button>
        <button className="nav-item" onClick={() => setScreen('library')}><span>◴</span>Timers</button>
        <button className="nav-item" onClick={() => openSettings('home')}><span>⚙︎</span>Settings</button>
      </nav>
    </main>
  );
}
