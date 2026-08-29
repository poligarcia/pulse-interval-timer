'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type TimerConfig = {
  id: string;
  name: string;
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
  ducking: boolean;
  rotation: boolean;
};

type PhaseKind = 'prepare' | 'work' | 'rest' | 'cycleRest' | 'cooldown';

type WorkoutPhase = {
  kind: PhaseKind;
  label: string;
  duration: number;
  round: number;
  cycle: number;
};

type ScreenName = 'home' | 'editor' | 'runner' | 'settings';

const APP_VERSION = '1.0.0';
const TIMERS_STORAGE = 'pulse-timers-v1';
const SETTINGS_STORAGE = 'pulse-settings-v1';

const DEFAULT_TIMERS: TimerConfig[] = [
  {
    id: 'classic-30-60',
    name: 'Classic 30 / 60',
    prepare: 5,
    work: 30,
    rest: 60,
    rounds: 4,
    cycles: 1,
    cycleRest: 60,
    cooldown: 10,
  },
  {
    id: 'power-20-10',
    name: 'Power 20 / 10',
    prepare: 10,
    work: 20,
    rest: 10,
    rounds: 8,
    cycles: 2,
    cycleRest: 90,
    cooldown: 30,
  },
  {
    id: 'steady-45-15',
    name: 'Steady 45 / 15',
    prepare: 10,
    work: 45,
    rest: 15,
    rounds: 6,
    cycles: 1,
    cycleRest: 60,
    cooldown: 45,
  },
];

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  volume: 0.65,
  ticking: false,
  ducking: false,
  rotation: true,
};

const EMPTY_TIMER: TimerConfig = {
  id: '',
  name: 'New interval',
  prepare: 10,
  work: 30,
  rest: 15,
  rounds: 6,
  cycles: 1,
  cycleRest: 60,
  cooldown: 30,
};

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
      sequence.push({
        kind: 'cycleRest',
        label: 'Cycle rest',
        duration: timer.cycleRest,
        round: timer.rounds,
        cycle,
      });
    }
  }

  if (timer.cooldown > 0) {
    sequence.push({
      kind: 'cooldown',
      label: 'Cooldown',
      duration: timer.cooldown,
      round: timer.rounds,
      cycle: timer.cycles,
    });
  }

  return sequence;
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
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
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
      <span className="metric-copy">
        <strong>{label}</strong>
        <small>{helper}</small>
      </span>
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

export default function Home() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [timers, setTimers] = useState<TimerConfig[]>(DEFAULT_TIMERS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<TimerConfig>(EMPTY_TIMER);
  const [activeTimer, setActiveTimer] = useState<TimerConfig>(DEFAULT_TIMERS[0]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(DEFAULT_TIMERS[0].prepare);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [voiceInfoOpen, setVoiceInfoOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const deadlineRef = useRef(0);
  const transitionLockRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const sequence = useMemo(() => buildSequence(activeTimer), [activeTimer]);
  const currentPhase = sequence[phaseIndex];
  const nextPhase = sequence[phaseIndex + 1];

  useEffect(() => {
    let storedTimers: TimerConfig[] | null = null;
    let storedSettings: Settings | null = null;
    try {
      const savedTimers = window.localStorage.getItem(TIMERS_STORAGE);
      const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE);
      if (savedTimers) {
        const parsed = JSON.parse(savedTimers) as TimerConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) storedTimers = parsed;
      }
      if (savedSettings) storedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    } catch {
      // Keep safe defaults when device storage contains invalid data.
    }

    window.queueMicrotask(() => {
      if (storedTimers) setTimers(storedTimers);
      if (storedSettings) setSettings(storedSettings);
      setHydrated(true);
    });

    if ('serviceWorker' in navigator) {
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

  const ensureAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) audioContextRef.current = new AudioContextClass();
    }
    audioContextRef.current?.resume().catch(() => undefined);
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency: number, duration = 0.11, volumeScale = 1) => {
    if (!settings.soundEnabled || settings.volume <= 0) return;
    const context = ensureAudio();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, settings.volume * 0.18 * volumeScale),
      context.currentTime + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, [ensureAudio, settings.soundEnabled, settings.volume]);

  const playCue = useCallback((kind: PhaseKind | 'complete') => {
    const frequencies: Record<PhaseKind | 'complete', number> = {
      prepare: 560,
      work: 920,
      rest: 330,
      cycleRest: 460,
      cooldown: 520,
      complete: 1040,
    };
    playTone(frequencies[kind], kind === 'complete' ? 0.3 : 0.16, 1.2);
    if (kind === 'complete') {
      window.setTimeout(() => playTone(1240, 0.34, 1.2), 180);
    }
  }, [playTone]);

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

  const finishPhase = useCallback(() => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;

    setPhaseIndex((currentIndex) => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= sequence.length) {
        setRunning(false);
        setFinished(true);
        setRemaining(0);
        playCue('complete');
        releaseWakeLock();
        transitionLockRef.current = false;
        return currentIndex;
      }

      const upcoming = sequence[nextIndex];
      setRemaining(upcoming.duration);
      deadlineRef.current = Date.now() + upcoming.duration * 1000;
      playCue(upcoming.kind);
      transitionLockRef.current = false;
      return nextIndex;
    });
  }, [playCue, releaseWakeLock, sequence]);

  useEffect(() => {
    if (!running || !currentPhase) return;
    let lastDisplayed = remaining;

    const interval = window.setInterval(() => {
      const millisecondsLeft = deadlineRef.current - Date.now();
      const nextRemaining = Math.max(0, Math.ceil(millisecondsLeft / 1000));

      if (nextRemaining !== lastDisplayed) {
        if (settings.ticking && nextRemaining > 0 && nextRemaining <= 5) {
          playTone(1180, 0.035, 0.34);
        }
        lastDisplayed = nextRemaining;
        setRemaining(nextRemaining);
      }

      if (millisecondsLeft <= 0) finishPhase();
    }, 100);

    return () => window.clearInterval(interval);
  }, [currentPhase, finishPhase, playTone, remaining, running, settings.ticking]);

  useEffect(() => () => releaseWakeLock(), [releaseWakeLock]);

  const openEditor = (timer?: TimerConfig) => {
    setDraft(timer ? { ...timer } : { ...EMPTY_TIMER, id: '' });
    setScreen('editor');
  };

  const updateDraft = (key: keyof TimerConfig, value: string | number) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveTimer = () => {
    const safeTimer: TimerConfig = {
      ...draft,
      id: draft.id || `timer-${Date.now()}`,
      name: draft.name.trim() || 'Untitled timer',
      work: Math.max(1, draft.work),
      rounds: Math.max(1, draft.rounds),
      cycles: Math.max(1, draft.cycles),
    };

    setTimers((current) => {
      const exists = current.some((timer) => timer.id === safeTimer.id);
      return exists
        ? current.map((timer) => timer.id === safeTimer.id ? safeTimer : timer)
        : [safeTimer, ...current];
    });
    setScreen('home');
  };

  const deleteTimer = () => {
    if (!draft.id) return;
    setTimers((current) => current.filter((timer) => timer.id !== draft.id));
    setScreen('home');
  };

  const beginWorkout = (timer: TimerConfig) => {
    const firstSequence = buildSequence(timer);
    setActiveTimer(timer);
    setPhaseIndex(0);
    setRemaining(firstSequence[0]?.duration ?? 0);
    setRunning(false);
    setFinished(false);
    setScreen('runner');
    applyOrientation(settings.rotation);
  };

  const toggleWorkout = () => {
    ensureAudio();
    if (finished) {
      setPhaseIndex(0);
      setRemaining(sequence[0]?.duration ?? 0);
      setFinished(false);
      return;
    }

    if (running) {
      setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      setRunning(false);
      releaseWakeLock();
    } else {
      deadlineRef.current = Date.now() + remaining * 1000;
      setRunning(true);
      playCue(currentPhase?.kind ?? 'prepare');
      requestWakeLock();
    }
  };

  const resetWorkout = () => {
    setRunning(false);
    setFinished(false);
    setPhaseIndex(0);
    setRemaining(sequence[0]?.duration ?? 0);
    releaseWakeLock();
  };

  const leaveWorkout = () => {
    setRunning(false);
    releaseWakeLock();
    try { screenOrientation().unlock?.(); } catch { /* no-op */ }
    setScreen('home');
  };

  const totalRemaining = finished
    ? 0
    : remaining + sequence.slice(phaseIndex + 1).reduce((sum, phase) => sum + phase.duration, 0);

  const phaseProgress = currentPhase && currentPhase.duration > 0
    ? Math.min(1, Math.max(0, (currentPhase.duration - remaining) / currentPhase.duration))
    : finished ? 1 : 0;

  if (screen === 'editor') {
    return (
      <main className="app-shell editor-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen('home')}>Cancel</button>
          <div className="header-title"><span className="eyebrow">TIMER SETUP</span><strong>{draft.id ? 'Edit timer' : 'New timer'}</strong></div>
          <button className="text-button accent" onClick={saveTimer}>Save</button>
        </header>

        <section className="editor-content">
          <label className="name-field">
            <span>Workout name</span>
            <input
              value={draft.name}
              maxLength={36}
              onChange={(event) => updateDraft('name', event.target.value)}
              placeholder="My interval timer"
            />
          </label>

          <div className="editor-section-title"><span>Intervals</span><small>SECONDS</small></div>
          <div className="metric-list">
            <MetricInput label="Prepare" helper="Countdown before you start" value={draft.prepare} unit="sec" min={0} max={600} onChange={(value) => updateDraft('prepare', value)} />
            <MetricInput label="Work" helper="Move for this long" value={draft.work} unit="sec" min={1} max={3600} onChange={(value) => updateDraft('work', value)} />
            <MetricInput label="Rest" helper="Between rounds" value={draft.rest} unit="sec" min={0} max={3600} onChange={(value) => updateDraft('rest', value)} />
            <MetricInput label="Cooldown" helper="Once after the workout" value={draft.cooldown} unit="sec" min={0} max={3600} onChange={(value) => updateDraft('cooldown', value)} />
          </div>

          <div className="editor-section-title"><span>Structure</span><small>REPEATS</small></div>
          <div className="metric-list">
            <MetricInput label="Rounds" helper="One round is one Work interval" value={draft.rounds} unit="×" min={1} max={99} onChange={(value) => updateDraft('rounds', value)} />
            <MetricInput label="Cycles" helper={`One cycle repeats all ${draft.rounds} rounds`} value={draft.cycles} unit="×" min={1} max={20} onChange={(value) => updateDraft('cycles', value)} />
            <MetricInput label="Rest between cycles" helper="Only inserted when cycles are 2 or more" value={draft.cycleRest} unit="sec" min={0} max={3600} onChange={(value) => updateDraft('cycleRest', value)} />
          </div>

          <aside className="cycle-explainer">
            <span className="explainer-number">?</span>
            <div>
              <strong>How cycles work</strong>
              <p>Rounds are the Work intervals inside a block. A cycle repeats that whole block. The extra cycle rest is added only between blocks — never after the last one.</p>
            </div>
          </aside>

          <div className="workout-summary">
            <span>Estimated duration</span>
            <strong>{formatTime(workoutDuration(draft))}</strong>
          </div>

          {draft.id && <button className="delete-button" onClick={deleteTimer}>Delete timer</button>}
        </section>
      </main>
    );
  }

  if (screen === 'settings') {
    return (
      <main className="app-shell settings-screen">
        <header className="screen-header">
          <button className="text-button muted" onClick={() => setScreen('home')}>Back</button>
          <div className="header-title"><span className="eyebrow">PREFERENCES</span><strong>Settings</strong></div>
          <button className="text-button accent" onClick={() => setScreen('home')}>Done</button>
        </header>

        <section className="settings-content">
          <div className="settings-group">
            <p className="settings-kicker">AUDIO</p>
            <div className="setting-row">
              <div><strong>Sound effects</strong><small>Phase cues and finish signal</small></div>
              <Switch label="Sound effects" checked={settings.soundEnabled} onChange={(soundEnabled) => setSettings((current) => ({ ...current, soundEnabled }))} />
            </div>
            <button className="setting-row setting-action" onClick={() => playCue('work')}>
              <div><strong>Sound scheme</strong><small>One built-in synthetic scheme</small></div>
              <span className="setting-value">Pulse beep <i>▶</i></span>
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
              <div><strong>Ticking sound</strong><small>Last five seconds of every interval</small></div>
              <Switch label="Ticking sound" checked={settings.ticking} onChange={(ticking) => setSettings((current) => ({ ...current, ticking }))} />
            </div>
          </div>

          <div className="settings-group">
            <p className="settings-kicker">VOICE & MUSIC</p>
            <button className="setting-row setting-action" onClick={() => setVoiceInfoOpen((open) => !open)} aria-expanded={voiceInfoOpen}>
              <div><strong>Voice</strong><small>Not included in this version</small></div>
              <span className="coming-soon">Coming later <i>{voiceInfoOpen ? '−' : '+'}</i></span>
            </button>
            {voiceInfoOpen && (
              <div className="info-panel">
                <strong>What multiple voices would involve</strong>
                <p>The browser can use iOS system voices through Speech Synthesis, but the available names and quality change by device and language. A consistent voice catalogue would require bundled recordings or a text-to-speech service, plus downloads, locale choices, caching and a privacy decision.</p>
              </div>
            )}
            <div className="setting-row unavailable">
              <div><strong>Ducking</strong><small>Reduce other music during cues</small></div>
              <Switch label="Ducking unavailable" checked={settings.ducking} onChange={() => undefined} disabled />
            </div>
            <p className="setting-note">Web apps on iOS cannot change the volume of Spotify, Apple Music or another app. Pulse can only control its own sounds.</p>
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
            <div><strong>Pulse</strong><small>Version {APP_VERSION} · Installable PWA</small></div>
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
          <div>
            <p>{activeTimer.name}</p>
            <strong>{formatTime(totalRemaining)} left</strong>
          </div>
          <button className="round-icon-button" onClick={resetWorkout} aria-label="Reset workout">↻</button>
        </header>

        <section className="runner-main" aria-live="polite" aria-atomic="true">
          <p className="phase-kicker">{finished ? 'SESSION' : PHASE_META[currentPhase?.kind ?? 'prepare'].short}</p>
          <h1>{finished ? 'Complete' : currentPhase?.label}</h1>
          <div className="giant-time">{finished ? '✓' : formatTime(remaining)}</div>
          <div className="phase-progress" aria-label={`${Math.round(phaseProgress * 100)} percent complete`}>
            <span style={{ width: `${phaseProgress * 100}%` }} />
          </div>
        </section>

        <section className="runner-up-next">
          <div>
            <span>{finished ? 'Workout' : 'Up next'}</span>
            <strong>{finished ? `${formatTime(workoutDuration(activeTimer))} total` : nextPhase ? `${nextPhase.label} · ${formatTime(nextPhase.duration)}` : 'Finish'}</strong>
          </div>
          <div className="mini-progress" aria-hidden="true"><span style={{ width: `${phaseProgress * 100}%` }} /></div>
        </section>

        <section className="runner-controls">
          <div className="runner-stat"><strong>{finished ? activeTimer.rounds : currentPhase?.round ?? 1}</strong><span>Round / {activeTimer.rounds}</span></div>
          <button className={`main-control ${running ? 'is-running' : ''}`} onClick={toggleWorkout} aria-label={finished ? 'Restart workout' : running ? 'Pause workout' : 'Start workout'}>
            <span>{finished ? '↻' : running ? 'Ⅱ' : '▶'}</span>
            <small>{finished ? 'Again' : running ? 'Pause' : phaseIndex === 0 && remaining === sequence[0]?.duration ? 'Start' : 'Resume'}</small>
          </button>
          <div className="runner-stat"><strong>{finished ? activeTimer.cycles : currentPhase?.cycle ?? 1}</strong><span>Cycle / {activeTimer.cycles}</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell home-screen">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">P</span>
          <div><p className="eyebrow">INTERVAL TRAINING</p><h1>Pulse</h1></div>
        </div>
        <button className="icon-button" aria-label="Open settings" onClick={() => setScreen('settings')}>⚙</button>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow dark">READY WHEN YOU ARE</p>
          <h2 id="hero-title">Make every<br />second count.</h2>
          <p>Build focused interval workouts and take them anywhere — even offline.</p>
        </div>
        <button className="new-timer-button" onClick={() => openEditor()}>
          <span className="plus">+</span>New timer
        </button>
      </section>

      <section className="workouts" aria-labelledby="workouts-title">
        <div className="section-heading">
          <div><p className="eyebrow">YOUR LIBRARY</p><h2 id="workouts-title">My timers</h2></div>
          <span className="count-badge">{timers.length}</span>
        </div>

        {timers.length === 0 ? (
          <div className="empty-state"><strong>No timers yet</strong><p>Create one and it will stay saved on this device.</p><button onClick={() => openEditor()}>Create timer</button></div>
        ) : (
          <div className="timer-list">
            {timers.map((timer, index) => (
              <article className="timer-card" key={timer.id}>
                <button className="timer-edit-zone" onClick={() => openEditor(timer)} aria-label={`Edit ${timer.name}`}>
                  <span className={`timer-number color-${index % 3}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="timer-info">
                    <strong>{timer.name}</strong>
                    <small>{formatTime(workoutDuration(timer))} · {timer.rounds} rounds · {timer.cycles} {timer.cycles === 1 ? 'cycle' : 'cycles'}</small>
                    <span className="interval-row">
                      <span><i className="dot work-dot" /> Work {formatCompact(timer.work)}</span>
                      <span><i className="dot rest-dot" /> Rest {formatCompact(timer.rest)}</span>
                    </span>
                  </span>
                </button>
                <button className="play-button" aria-label={`Start ${timer.name}`} onClick={() => beginWorkout(timer)}>▶</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <button className="nav-item active" onClick={() => setScreen('home')}><span>◴</span>Timers</button>
        <button className="nav-item" onClick={() => openEditor()}><span>＋</span>Create</button>
        <button className="nav-item" onClick={() => setScreen('settings')}><span>⚙</span>Settings</button>
      </nav>
    </main>
  );
}
