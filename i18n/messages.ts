import type { PhaseKind } from '../coach/types.ts';
import type { ProgressMilestoneId, ProgressPeriod } from '../progress/types.ts';
import type { ReminderDay, WorkoutReminderCalendarCopy } from '../reminders/types.ts';
import type { Locale } from './locales.ts';

type PhaseCopy = Record<PhaseKind, { label: string; short: string }>;
type ReminderDayCopy = Record<ReminderDay, { label: string; short: string }>;
type MilestoneCopy = Record<ProgressMilestoneId, { title: string; description: string }>;

export type AppMessages = {
  shell: {
    title: string;
    description: string;
    openingPulse: string;
    splashTagline: string;
  };
  common: {
    back: string;
    cancel: string;
    done: string;
    edit: string;
    home: string;
    new: string;
    progress: string;
    save: string;
    settings: string;
    timers: string;
    primaryNavigation: string;
    openSettings: string;
    startTimer: (name: string) => string;
    moveTimerUp: (name: string) => string;
    moveTimerDown: (name: string) => string;
    editTimer: (name: string) => string;
  };
  phase: PhaseCopy;
  timerDetails: {
    automaticName: (work: number, rest: number, rounds: number, cycles: number) => string;
    structure: (rounds: number, cycles: number) => string;
    work: string;
    rest: string;
  };
  editor: {
    eyebrow: string;
    editTitle: string;
    newTitle: string;
    nameLabel: string;
    customName: string;
    automaticNameHelper: string;
    useAutomaticName: string;
    intervals: string;
    seconds: string;
    structure: string;
    repeats: string;
    prepare: string;
    prepareHelper: string;
    work: string;
    workHelper: string;
    rest: string;
    restHelper: string;
    cooldown: string;
    cooldownHelper: string;
    rounds: string;
    roundsHelper: string;
    cycles: string;
    cyclesHelper: (rounds: number) => string;
    cycleRest: string;
    cycleRestHelper: string;
    secondsUnit: string;
    cycleExplainerTitle: string;
    cycleExplainerBody: string;
    estimatedDuration: string;
    deleteTimer: string;
  };
  home: {
    brandEyebrow: string;
    readyEyebrow: string;
    heroFirstLine: string;
    heroSecondLine: string;
    description: string;
    newTimer: string;
    weeklyProgress: string;
    thisWeek: string;
    minutesUnit: string;
    dayStreak: string;
    quickStart: string;
    recentTimers: string;
    manage: (count: number) => string;
    emptyTitle: string;
    emptyBody: string;
    createTimer: string;
  };
  library: {
    eyebrow: string;
    allPrograms: string;
    timerCount: (count: number) => string;
    description: string;
  };
  progress: {
    eyebrow: string;
    period: Record<ProgressPeriod, string>;
    periodAria: string;
    minutesUnit: string;
    activeWorkAcross: (duration: string, workouts: number) => string;
    activityKicker: string;
    trainingRhythm: string;
    activeDays: (count: number) => string;
    consistencyKicker: string;
    keepShowingUp: string;
    activeDayStreak: string;
    bestDays: (count: number) => string;
    activeDaysPerWeek: string;
    goalWeeksInRow: (count: number) => string;
    milestonesKicker: string;
    buildRecord: string;
    unlockedCount: (unlocked: number, total: number) => string;
    milestones: MilestoneCopy;
    complete: string;
    workoutProgress: (current: number, target: number) => string;
    goalWeekProgress: (current: number, target: number) => string;
    hourProgress: (current: string, target: number) => string;
    journalKicker: string;
    workoutHistory: string;
    sessions: (count: number) => string;
    emptyTitle: string;
    emptyBody: string;
    chooseTimer: string;
    trainingAndActive: (training: string, active: string) => string;
    roundsAndCycles: (rounds: number, cycles: number) => string;
    delete: string;
    deleteFromHistory: (name: string) => string;
    durationSeconds: (seconds: number) => string;
    durationMinutes: (minutes: number) => string;
    durationHours: (hours: number, minutes: number) => string;
  };
  runner: {
    backToTimers: string;
    timeLeft: (time: string) => string;
    resetWorkout: string;
    sessionKicker: string;
    complete: string;
    trainingAdded: (time: string) => string;
    weeklySummary: (activeDays: number, goal: number, streak: number) => string;
    milestonesUnlocked: (count: number) => string;
    viewProgress: string;
    sessionComplete: string;
    stageProgress: (stage: string) => string;
    session: string;
    currentStage: string;
    workout: string;
    upNext: string;
    total: (time: string) => string;
    finish: string;
    workoutProgress: (round: number, rounds: number, cycle: number, cycles: number) => string;
    round: string;
    cycle: string;
    restartWorkout: string;
    pauseWorkout: string;
    startWorkout: string;
    again: string;
    pause: string;
    start: string;
    resume: string;
  };
  coachSettings: {
    kicker: string;
    voiceCoach: string;
    voiceCoachHelper: string;
    voiceCoachSwitch: string;
    coachingPhrases: string;
    coachingPhrasesHelper: string;
    coachingPhrasesSwitch: string;
    personality: string;
    personalityHelper: string;
    surpriseMe: string;
    surprisePersonalityHelper: string;
    voicePreference: string;
    automaticPreferenceHelper: string;
    preference: Record<'female' | 'male' | 'either', string>;
    systemVoice: string;
    systemVoiceHelper: string;
    coachVoiceAria: string;
    automatic: string;
    savedVoiceUnavailable: string;
    recommended: string;
    otherSystemVoices: string;
    effect: string;
    testCoach: string;
    previewCoach: (surprise: boolean) => string;
    play: string;
    ducking: string;
    duckingHelper: string;
    duckingUnavailable: string;
    voiceNote: (language: string) => string;
    noCompatibleVoice: (language: string) => string;
    musicNote: string;
  };
  audioSettings: {
    kicker: string;
    soundEffects: string;
    soundEffectsHelper: string;
    soundScheme: string;
    soundSchemeHelper: string;
    pulseBeep: string;
    appVolume: string;
    tickingSound: string;
    tickingHelper: string;
    silentModeNote: string;
  };
  displaySettings: {
    kicker: string;
    rotation: string;
    rotationHelper: string;
    rotationAria: string;
    orientationNote: string;
  };
  experimentalSettings: {
    kicker: string;
    labsHelper: string;
    open: string;
    labsNote: string;
  };
  about: {
    versionAria: (version: string) => string;
    version: string;
    installablePwa: string;
    contentCredits: string;
  };
  settings: {
    eyebrow: string;
    title: string;
    languageKicker: string;
    appLanguage: string;
    languageHelper: string;
    appLanguageAria: string;
    trainingKicker: string;
    activeDaysPerWeek: string;
    activeDaysGoalHelper: string;
    weeklyGoalAria: string;
    decreaseWeeklyGoal: string;
    increaseWeeklyGoal: string;
    perWeek: string;
    workoutReminders: string;
    reminderIntro: string;
    reminderDaysAria: string;
    reminderDays: ReminderDayCopy;
    reminderTime: string;
    calendarHandlesDelivery: string;
    reminderTimeAria: string;
    addRemindersToCalendar: string;
    worksAfterPulseCloses: string;
    reminderPrivacyNote: string;
    calendarEvent: WorkoutReminderCalendarCopy;
  };
  status: {
    openingLabs: string;
    labsUnlocked: string;
    tapsUntilLabs: (count: number) => string;
    calendarOpened: string;
    calendarError: string;
    deleteHistory: (timerName: string) => string;
  };
};

const en: AppMessages = {
  shell: {
    title: 'Pulse — Interval Timer',
    description: 'Custom interval workouts with rounds, cycles, progress, reminders, and offline support.',
    openingPulse: 'Opening Pulse', splashTagline: 'Interval training',
  },
  common: {
    back: 'Back', cancel: 'Cancel', done: 'Done', edit: 'Edit', home: 'Home', new: 'New',
    progress: 'Progress', save: 'Save', settings: 'Settings', timers: 'Timers',
    primaryNavigation: 'Primary navigation', openSettings: 'Open settings',
    startTimer: (name) => `Start ${name}`,
    moveTimerUp: (name) => `Move ${name} up`,
    moveTimerDown: (name) => `Move ${name} down`,
    editTimer: (name) => `Edit ${name}`,
  },
  phase: {
    prepare: { label: 'Prepare', short: 'Get ready' },
    work: { label: 'Work', short: 'Push' },
    rest: { label: 'Rest', short: 'Recover' },
    cycleRest: { label: 'Cycle rest', short: 'Reset' },
    cooldown: { label: 'Cooldown', short: 'Breathe' },
  },
  timerDetails: {
    automaticName: (work, rest, rounds, cycles) => `${work}s work - ${rest}s rest × ${rounds}${cycles > 1 ? ` × ${cycles}` : ''}`,
    structure: (rounds, cycles) => `${rounds} ${rounds === 1 ? 'round' : 'rounds'} · ${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`,
    work: 'Work', rest: 'Rest',
  },
  editor: {
    eyebrow: 'TIMER SETUP', editTitle: 'Edit timer', newTitle: 'New timer', nameLabel: 'Timer name',
    customName: 'Custom name', automaticNameHelper: 'Updates automatically with the intervals',
    useAutomaticName: 'Use automatic name', intervals: 'Intervals', seconds: 'SECONDS',
    structure: 'Structure', repeats: 'REPEATS', prepare: 'Prepare', prepareHelper: 'Countdown before you start',
    work: 'Work', workHelper: 'Move for this long', rest: 'Rest', restHelper: 'Between rounds',
    cooldown: 'Cooldown', cooldownHelper: 'Once after the workout', rounds: 'Rounds',
    roundsHelper: 'One round is one Work interval', cycles: 'Cycles',
    cyclesHelper: (rounds) => `One cycle repeats all ${rounds} rounds`,
    cycleRest: 'Rest between cycles', cycleRestHelper: 'Only inserted when cycles are 2 or more',
    secondsUnit: 'sec', cycleExplainerTitle: 'How cycles work',
    cycleExplainerBody: 'Rounds are the Work intervals inside a block. A cycle repeats that whole block. The extra cycle rest is added only between blocks — never after the last one.',
    estimatedDuration: 'Estimated duration', deleteTimer: 'Delete timer',
  },
  home: {
    brandEyebrow: 'INTERVAL TRAINING', readyEyebrow: 'READY WHEN YOU ARE', heroFirstLine: 'Make every',
    heroSecondLine: 'second count.', description: 'Build focused interval workouts and take them anywhere — even offline.',
    newTimer: 'New timer', weeklyProgress: 'Weekly progress', thisWeek: 'THIS WEEK', minutesUnit: 'min',
    dayStreak: 'day streak', quickStart: 'QUICK START', recentTimers: 'Recent timers',
    manage: (count) => `Manage ${count}`, emptyTitle: 'No timers yet',
    emptyBody: 'Create one and it will stay saved on this device.', createTimer: 'Create timer',
  },
  library: {
    eyebrow: 'YOUR LIBRARY', allPrograms: 'ALL PROGRAMS',
    timerCount: (count) => `${count} ${count === 1 ? 'timer' : 'timers'}`,
    description: 'Run, edit, or move a timer. Home keeps your four most recently used timers close.',
  },
  progress: {
    eyebrow: 'YOUR TRAINING',
    period: { day: 'Today', week: 'This week', month: 'This month' },
    periodAria: 'Progress period', minutesUnit: 'MIN',
    activeWorkAcross: (duration, workouts) => `${duration} active work across ${workouts} ${workouts === 1 ? 'workout' : 'workouts'}.`,
    activityKicker: 'ACTIVITY', trainingRhythm: 'Training rhythm',
    activeDays: (count) => `${count} active ${count === 1 ? 'day' : 'days'}`,
    consistencyKicker: 'CONSISTENCY', keepShowingUp: 'Keep showing up', activeDayStreak: 'active-day streak',
    bestDays: (count) => `Best: ${count} ${count === 1 ? 'day' : 'days'}`,
    activeDaysPerWeek: 'active days per week',
    goalWeeksInRow: (count) => `${count} goal ${count === 1 ? 'week' : 'weeks'} in a row`,
    milestonesKicker: 'MILESTONES', buildRecord: 'Build your record',
    unlockedCount: (unlocked, total) => `${unlocked}/${total} unlocked`,
    milestones: {
      'first-workout': { title: 'First step', description: 'Complete your first workout.' },
      'ten-workouts': { title: 'Momentum', description: 'Complete 10 workouts.' },
      'two-goal-weeks': { title: 'In rhythm', description: 'Reach your goal two weeks in a row.' },
      'five-hours': { title: 'Five-hour club', description: 'Accumulate five hours of training.' },
    },
    complete: 'Complete',
    workoutProgress: (current, target) => `${current} / ${target} ${target === 1 ? 'workout' : 'workouts'}`,
    goalWeekProgress: (current, target) => `${current} / ${target} goal ${target === 1 ? 'week' : 'weeks'}`,
    hourProgress: (current, target) => `${current} / ${target} hours`,
    journalKicker: 'JOURNAL', workoutHistory: 'Workout history',
    sessions: (count) => `${count} ${count === 1 ? 'session' : 'sessions'}`,
    emptyTitle: 'Your first workout starts the story.',
    emptyBody: 'Complete a timer and Pulse will add it here automatically.', chooseTimer: 'Choose a timer',
    trainingAndActive: (training, active) => `${training} training · ${active} active`,
    roundsAndCycles: (rounds, cycles) => `${rounds}R · ${cycles}C`,
    delete: 'Delete', deleteFromHistory: (name) => `Delete ${name} from history`,
    durationSeconds: (seconds) => `${seconds}s`, durationMinutes: (minutes) => `${minutes} min`,
    durationHours: (hours, minutes) => minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`,
  },
  runner: {
    backToTimers: 'Back to timers', timeLeft: (time) => `${time} left`, resetWorkout: 'Reset workout',
    sessionKicker: 'SESSION', complete: 'Complete', trainingAdded: (time) => `+${time} training`,
    weeklySummary: (activeDays, goal, streak) => `${activeDays} of ${goal} active days this week · ${streak}-day streak`,
    milestonesUnlocked: (count) => count === 1 ? 'Milestone unlocked' : `${count} milestones unlocked`,
    viewProgress: 'View progress', sessionComplete: 'Session complete', stageProgress: (stage) => `${stage} progress`,
    session: 'Session', currentStage: 'Current stage', workout: 'Workout', upNext: 'Up next',
    total: (time) => `${time} total`, finish: 'Finish',
    workoutProgress: (round, rounds, cycle, cycles) => `Workout progress. Round ${round} of ${rounds}, cycle ${cycle} of ${cycles}.`,
    round: 'Round', cycle: 'Cycle', restartWorkout: 'Restart workout', pauseWorkout: 'Pause workout',
    startWorkout: 'Start workout', again: 'Again', pause: 'Pause', start: 'Start', resume: 'Resume',
  },
  coachSettings: {
    kicker: 'COACH VOICE', voiceCoach: 'Voice coach', voiceCoachHelper: 'Phase cues and a spoken 3–2–1',
    voiceCoachSwitch: 'Voice coach', coachingPhrases: 'Coaching phrases',
    coachingPhrasesHelper: 'Read motivational, recovery, and contextual guidance', coachingPhrasesSwitch: 'Read coaching phrases',
    personality: 'Coach personality', personalityHelper: 'Sets the coach’s wording and delivery for the workout.',
    surpriseMe: 'Surprise me', surprisePersonalityHelper: 'Picks a personality when the workout starts and keeps it throughout',
    voicePreference: 'Voice preference', automaticPreferenceHelper: 'Used only when System voice is Automatic.',
    preference: { female: 'Female', male: 'Male', either: 'Surprise me' },
    systemVoice: 'System voice', systemVoiceHelper: 'A specific voice overrides the preference above', coachVoiceAria: 'Coach voice',
    automatic: 'Automatic', savedVoiceUnavailable: 'Saved voice · unavailable for this language', recommended: 'Recommended',
    otherSystemVoices: 'Other system voices', effect: 'effect', testCoach: 'Test coach',
    previewCoach: (surprise) => `Preview ${surprise ? 'a surprise personality' : 'this personality'} and voice`, play: 'Play',
    ducking: 'Ducking', duckingHelper: 'Reduce other music during cues', duckingUnavailable: 'Ducking unavailable',
    voiceNote: (language) => `Pulse uses this device’s ${language} system voices. Automatic avoids known effect voices and keeps one concrete voice for the entire workout.`,
    noCompatibleVoice: (language) => `No ${language} system voice was listed. Automatic will ask the device for its best available voice.`,
    musicNote: 'Web apps on iOS cannot change the volume of Spotify, Apple Music, or another app. Pulse can only control its own sounds.',
  },
  audioSettings: {
    kicker: 'AUDIO', soundEffects: 'Sound effects', soundEffectsHelper: 'Phase cues and finish signal',
    soundScheme: 'Sound scheme', soundSchemeHelper: 'One built-in synthetic scheme', pulseBeep: 'Pulse beep',
    appVolume: 'App volume', tickingSound: 'Ticking sound', tickingHelper: 'One quiet tick every second',
    silentModeNote: 'On iPhone, synthetic Web Audio respects Silent Mode. Turn Silent Mode off to hear Pulse cues.',
  },
  displaySettings: {
    kicker: 'DISPLAY', rotation: 'Rotation', rotationHelper: 'Allow landscape during a workout',
    rotationAria: 'Allow screen rotation',
    orientationNote: 'Orientation locking depends on iOS and works best when Pulse is opened from the Home Screen.',
  },
  experimentalSettings: {
    kicker: 'EXPERIMENTAL', labsHelper: 'Local Mentria text experiments and system-voice previews', open: 'Open',
    labsNote: 'Opening Labs never downloads or initializes a model. Model assets require a separate confirmation.',
  },
  about: {
    versionAria: (version) => `Pulse version ${version}`, version: 'Version',
    installablePwa: 'Installable PWA', contentCredits: 'Content credits',
  },
  settings: {
    eyebrow: 'PREFERENCES', title: 'Settings', languageKicker: 'LANGUAGE', appLanguage: 'App language',
    languageHelper: 'Changes Pulse on this device', appLanguageAria: 'App language',
    trainingKicker: 'TRAINING', activeDaysPerWeek: 'Active days per week',
    activeDaysGoalHelper: 'Sets your goal streak and milestone pace', weeklyGoalAria: 'Weekly active-day goal',
    decreaseWeeklyGoal: 'Decrease weekly active-day goal', increaseWeeklyGoal: 'Increase weekly active-day goal', perWeek: '/ week',
    workoutReminders: 'Workout reminders', reminderIntro: 'Choose a schedule, then add one recurring event to your device calendar.',
    reminderDaysAria: 'Reminder days',
    reminderDays: {
      0: { label: 'Sunday', short: 'S' }, 1: { label: 'Monday', short: 'M' },
      2: { label: 'Tuesday', short: 'T' }, 3: { label: 'Wednesday', short: 'W' },
      4: { label: 'Thursday', short: 'T' }, 5: { label: 'Friday', short: 'F' },
      6: { label: 'Saturday', short: 'S' },
    },
    reminderTime: 'Reminder time', calendarHandlesDelivery: 'Your calendar handles delivery',
    reminderTimeAria: 'Workout reminder time', addRemindersToCalendar: 'Add reminders to Calendar',
    worksAfterPulseCloses: 'Works after Pulse is closed',
    reminderPrivacyNote: 'Calendar reminders keep Pulse completely static and private. Edit or remove the recurring event in your calendar app.',
    calendarEvent: {
      summary: 'Pulse workout', description: 'Open Pulse and complete a focused interval workout.',
      alarmDescription: 'Time for your Pulse workout.',
    },
  },
  status: {
    openingLabs: 'Opening Pulse Labs…', labsUnlocked: 'Pulse Labs unlocked.',
    tapsUntilLabs: (count) => `${count} ${count === 1 ? 'tap' : 'taps'} until Pulse Labs.`,
    calendarOpened: 'Calendar opened. On iPhone, finish adding the recurring event.',
    calendarError: 'The calendar reminder could not be created on this device.',
    deleteHistory: (timerName) => `Delete ${timerName} from workout history?`,
  },
};

const esAR: AppMessages = {
  shell: {
    title: 'Pulse — Timer de intervalos',
    description: 'Entrenamientos por intervalos con rondas, ciclos, progreso, recordatorios y uso sin conexión.',
    openingPulse: 'Abriendo Pulse', splashTagline: 'Entrenamiento por intervalos',
  },
  common: {
    back: 'Atrás', cancel: 'Cancelar', done: 'Listo', edit: 'Editar', home: 'Inicio', new: 'Nuevo',
    progress: 'Progreso', save: 'Guardar', settings: 'Ajustes', timers: 'Timers',
    primaryNavigation: 'Navegación principal', openSettings: 'Abrir ajustes',
    startTimer: (name) => `Iniciar ${name}`,
    moveTimerUp: (name) => `Mover ${name} hacia arriba`,
    moveTimerDown: (name) => `Mover ${name} hacia abajo`,
    editTimer: (name) => `Editar ${name}`,
  },
  phase: {
    prepare: { label: 'Preparación', short: 'Preparate' },
    work: { label: 'Trabajo', short: 'Dale' },
    rest: { label: 'Descanso', short: 'Recuperá' },
    cycleRest: { label: 'Descanso entre ciclos', short: 'Reiniciá' },
    cooldown: { label: 'Vuelta a la calma', short: 'Respirá' },
  },
  timerDetails: {
    automaticName: (work, rest, rounds, cycles) => `${work}s trabajo - ${rest}s descanso × ${rounds}${cycles > 1 ? ` × ${cycles}` : ''}`,
    structure: (rounds, cycles) => `${rounds} ${rounds === 1 ? 'ronda' : 'rondas'} · ${cycles} ${cycles === 1 ? 'ciclo' : 'ciclos'}`,
    work: 'Trabajo', rest: 'Descanso',
  },
  editor: {
    eyebrow: 'CONFIGURAR TIMER', editTitle: 'Editar timer', newTitle: 'Nuevo timer', nameLabel: 'Nombre del timer',
    customName: 'Nombre personalizado', automaticNameHelper: 'Se actualiza automáticamente con los intervalos',
    useAutomaticName: 'Usar nombre automático', intervals: 'Intervalos', seconds: 'SEGUNDOS',
    structure: 'Estructura', repeats: 'REPETICIONES', prepare: 'Preparación', prepareHelper: 'Cuenta regresiva antes de empezar',
    work: 'Trabajo', workHelper: 'Movete durante este tiempo', rest: 'Descanso', restHelper: 'Entre rondas',
    cooldown: 'Vuelta a la calma', cooldownHelper: 'Una vez al terminar', rounds: 'Rondas',
    roundsHelper: 'Cada ronda contiene un intervalo de Trabajo', cycles: 'Ciclos',
    cyclesHelper: (rounds) => `Cada ciclo repite las ${rounds} rondas`,
    cycleRest: 'Descanso entre ciclos', cycleRestHelper: 'Se agrega solo cuando hay 2 ciclos o más',
    secondsUnit: 's', cycleExplainerTitle: 'Cómo funcionan los ciclos',
    cycleExplainerBody: 'Las rondas son los intervalos de Trabajo dentro de un bloque. Un ciclo repite todo el bloque. El descanso extra se agrega únicamente entre bloques, nunca después del último.',
    estimatedDuration: 'Duración estimada', deleteTimer: 'Eliminar timer',
  },
  home: {
    brandEyebrow: 'ENTRENAMIENTO POR INTERVALOS', readyEyebrow: 'CUANDO VOS QUIERAS', heroFirstLine: 'Hacé que cada',
    heroSecondLine: 'segundo cuente.', description: 'Armá entrenamientos por intervalos y llevalos a cualquier lugar, incluso sin conexión.',
    newTimer: 'Nuevo timer', weeklyProgress: 'Progreso semanal', thisWeek: 'ESTA SEMANA', minutesUnit: 'min',
    dayStreak: 'racha de días', quickStart: 'INICIO RÁPIDO', recentTimers: 'Timers recientes',
    manage: (count) => `Gestionar ${count}`, emptyTitle: 'Todavía no hay timers',
    emptyBody: 'Creá uno y quedará guardado en este dispositivo.', createTimer: 'Crear timer',
  },
  library: {
    eyebrow: 'TU BIBLIOTECA', allPrograms: 'TODOS LOS PROGRAMAS',
    timerCount: (count) => `${count} ${count === 1 ? 'timer' : 'timers'}`,
    description: 'Iniciá, editá o mové un timer. Inicio mantiene cerca los cuatro que usaste más recientemente.',
  },
  progress: {
    eyebrow: 'TU ENTRENAMIENTO',
    period: { day: 'Hoy', week: 'Esta semana', month: 'Este mes' },
    periodAria: 'Período de progreso', minutesUnit: 'MIN',
    activeWorkAcross: (duration, workouts) => `${duration} de trabajo activo en ${workouts} ${workouts === 1 ? 'entrenamiento' : 'entrenamientos'}.`,
    activityKicker: 'ACTIVIDAD', trainingRhythm: 'Ritmo de entrenamiento',
    activeDays: (count) => `${count} ${count === 1 ? 'día activo' : 'días activos'}`,
    consistencyKicker: 'CONSTANCIA', keepShowingUp: 'Seguí apareciendo', activeDayStreak: 'racha de días activos',
    bestDays: (count) => `Mejor: ${count} ${count === 1 ? 'día' : 'días'}`,
    activeDaysPerWeek: 'días activos por semana',
    goalWeeksInRow: (count) => `${count} ${count === 1 ? 'semana con objetivo cumplido' : 'semanas con objetivo cumplido'} seguidas`,
    milestonesKicker: 'HITOS', buildRecord: 'Construí tu recorrido',
    unlockedCount: (unlocked, total) => `${unlocked}/${total} desbloqueados`,
    milestones: {
      'first-workout': { title: 'Primer paso', description: 'Completá tu primer entrenamiento.' },
      'ten-workouts': { title: 'Impulso', description: 'Completá 10 entrenamientos.' },
      'two-goal-weeks': { title: 'En ritmo', description: 'Alcanzá tu objetivo dos semanas seguidas.' },
      'five-hours': { title: 'Club de las cinco horas', description: 'Acumulá cinco horas de entrenamiento.' },
    },
    complete: 'Completado',
    workoutProgress: (current, target) => `${current} / ${target} ${target === 1 ? 'entrenamiento' : 'entrenamientos'}`,
    goalWeekProgress: (current, target) => `${current} / ${target} ${target === 1 ? 'semana objetivo' : 'semanas objetivo'}`,
    hourProgress: (current, target) => `${current} / ${target} horas`,
    journalKicker: 'REGISTRO', workoutHistory: 'Historial de entrenamientos',
    sessions: (count) => `${count} ${count === 1 ? 'sesión' : 'sesiones'}`,
    emptyTitle: 'Tu primer entrenamiento empieza la historia.',
    emptyBody: 'Completá un timer y Pulse lo agregará acá automáticamente.', chooseTimer: 'Elegir un timer',
    trainingAndActive: (training, active) => `${training} de entrenamiento · ${active} activos`,
    roundsAndCycles: (rounds, cycles) => `${rounds}R · ${cycles}C`,
    delete: 'Eliminar', deleteFromHistory: (name) => `Eliminar ${name} del historial`,
    durationSeconds: (seconds) => `${seconds}s`, durationMinutes: (minutes) => `${minutes} min`,
    durationHours: (hours, minutes) => minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`,
  },
  runner: {
    backToTimers: 'Volver a timers', timeLeft: (time) => `${time} restantes`, resetWorkout: 'Reiniciar entrenamiento',
    sessionKicker: 'SESIÓN', complete: 'Completado', trainingAdded: (time) => `+${time} de entrenamiento`,
    weeklySummary: (activeDays, goal, streak) => `${activeDays} de ${goal} días activos esta semana · racha de ${streak} ${streak === 1 ? 'día' : 'días'}`,
    milestonesUnlocked: (count) => count === 1 ? 'Hito desbloqueado' : `${count} hitos desbloqueados`,
    viewProgress: 'Ver progreso', sessionComplete: 'Sesión completada', stageProgress: (stage) => `Progreso de ${stage}`,
    session: 'Sesión', currentStage: 'Etapa actual', workout: 'Entrenamiento', upNext: 'A continuación',
    total: (time) => `${time} en total`, finish: 'Finalizar',
    workoutProgress: (round, rounds, cycle, cycles) => `Progreso del entrenamiento. Ronda ${round} de ${rounds}, ciclo ${cycle} de ${cycles}.`,
    round: 'Ronda', cycle: 'Ciclo', restartWorkout: 'Reiniciar entrenamiento', pauseWorkout: 'Pausar entrenamiento',
    startWorkout: 'Iniciar entrenamiento', again: 'De nuevo', pause: 'Pausar', start: 'Empezar', resume: 'Continuar',
  },
  coachSettings: {
    kicker: 'VOZ DEL COACH', voiceCoach: 'Coach por voz', voiceCoachHelper: 'Indicaciones de fase y cuenta regresiva 3–2–1',
    voiceCoachSwitch: 'Coach por voz', coachingPhrases: 'Frases del coach',
    coachingPhrasesHelper: 'Lee mensajes motivacionales, de recuperación y según el contexto', coachingPhrasesSwitch: 'Leer frases del coach',
    personality: 'Personalidad del coach', personalityHelper: 'Define las palabras y la forma de hablar durante el entrenamiento.',
    surpriseMe: 'Sorprendeme', surprisePersonalityHelper: 'Elige una personalidad al comenzar y la mantiene durante todo el entrenamiento',
    voicePreference: 'Preferencia de voz', automaticPreferenceHelper: 'Se usa sólo cuando la voz del sistema está en Automático.',
    preference: { female: 'Femenina', male: 'Masculina', either: 'Sorprendeme' },
    systemVoice: 'Voz del sistema', systemVoiceHelper: 'Una voz específica reemplaza la preferencia anterior', coachVoiceAria: 'Voz del coach',
    automatic: 'Automático', savedVoiceUnavailable: 'Voz guardada · no disponible para este idioma', recommended: 'Recomendadas',
    otherSystemVoices: 'Otras voces del sistema', effect: 'efecto', testCoach: 'Probar coach',
    previewCoach: (surprise) => `Escuchá ${surprise ? 'una personalidad sorpresa' : 'esta personalidad'} y su voz`, play: 'Reproducir',
    ducking: 'Atenuación', duckingHelper: 'Reduce otra música durante las indicaciones', duckingUnavailable: 'Atenuación no disponible',
    voiceNote: (language) => `Pulse usa las voces del sistema en ${language} disponibles en este dispositivo. Automático evita voces con efectos y mantiene la misma voz durante todo el entrenamiento.`,
    noCompatibleVoice: (language) => `No se detectó una voz del sistema en ${language}. Automático le pedirá al dispositivo la mejor voz disponible.`,
    musicNote: 'Las apps web en iOS no pueden cambiar el volumen de Spotify, Apple Music u otra app. Pulse sólo puede controlar sus propios sonidos.',
  },
  audioSettings: {
    kicker: 'AUDIO', soundEffects: 'Efectos de sonido', soundEffectsHelper: 'Indicaciones de fase y señal final',
    soundScheme: 'Esquema de sonido', soundSchemeHelper: 'Un esquema sintético incorporado', pulseBeep: 'Beep de Pulse',
    appVolume: 'Volumen de la app', tickingSound: 'Sonido de tic', tickingHelper: 'Un tic suave por segundo',
    silentModeNote: 'En iPhone, el audio sintético respeta el modo Silencio. Desactivalo para escuchar las indicaciones de Pulse.',
  },
  displaySettings: {
    kicker: 'PANTALLA', rotation: 'Rotación', rotationHelper: 'Permite usar el entrenamiento en horizontal',
    rotationAria: 'Permitir rotación de pantalla',
    orientationNote: 'El bloqueo de orientación depende de iOS y funciona mejor cuando abrís Pulse desde la pantalla de inicio.',
  },
  experimentalSettings: {
    kicker: 'EXPERIMENTAL', labsHelper: 'Experimentos locales de texto de Mentria y pruebas de voces del sistema', open: 'Abrir',
    labsNote: 'Abrir Labs nunca descarga ni inicializa un modelo. Los archivos del modelo requieren una confirmación aparte.',
  },
  about: {
    versionAria: (version) => `Pulse versión ${version}`, version: 'Versión',
    installablePwa: 'PWA instalable', contentCredits: 'Créditos de contenido',
  },
  settings: {
    eyebrow: 'PREFERENCIAS', title: 'Ajustes', languageKicker: 'IDIOMA', appLanguage: 'Idioma de la app',
    languageHelper: 'Cambia Pulse en este dispositivo', appLanguageAria: 'Idioma de la app',
    trainingKicker: 'ENTRENAMIENTO', activeDaysPerWeek: 'Días activos por semana',
    activeDaysGoalHelper: 'Define el ritmo de tu objetivo y tus hitos', weeklyGoalAria: 'Objetivo semanal de días activos',
    decreaseWeeklyGoal: 'Reducir el objetivo semanal de días activos', increaseWeeklyGoal: 'Aumentar el objetivo semanal de días activos', perWeek: '/ semana',
    workoutReminders: 'Recordatorios de entrenamiento', reminderIntro: 'Elegí un horario y agregá un único evento recurrente al calendario de tu dispositivo.',
    reminderDaysAria: 'Días de los recordatorios',
    reminderDays: {
      0: { label: 'Domingo', short: 'D' }, 1: { label: 'Lunes', short: 'L' },
      2: { label: 'Martes', short: 'M' }, 3: { label: 'Miércoles', short: 'X' },
      4: { label: 'Jueves', short: 'J' }, 5: { label: 'Viernes', short: 'V' },
      6: { label: 'Sábado', short: 'S' },
    },
    reminderTime: 'Hora del recordatorio', calendarHandlesDelivery: 'Tu calendario se encarga de avisarte',
    reminderTimeAria: 'Hora del recordatorio de entrenamiento', addRemindersToCalendar: 'Agregar recordatorios al calendario',
    worksAfterPulseCloses: 'Funciona aunque cierres Pulse',
    reminderPrivacyNote: 'Los recordatorios de calendario mantienen Pulse completamente estático y privado. Editá o eliminá el evento recurrente desde tu app de calendario.',
    calendarEvent: {
      summary: 'Entrenamiento Pulse', description: 'Abrí Pulse y completá un entrenamiento por intervalos.',
      alarmDescription: 'Es hora de tu entrenamiento Pulse.',
    },
  },
  status: {
    openingLabs: 'Abriendo Pulse Labs…', labsUnlocked: 'Pulse Labs desbloqueado.',
    tapsUntilLabs: (count) => `${count} ${count === 1 ? 'toque' : 'toques'} para llegar a Pulse Labs.`,
    calendarOpened: 'Se abrió el calendario. En iPhone, terminá de agregar el evento recurrente.',
    calendarError: 'No se pudo crear el recordatorio de calendario en este dispositivo.',
    deleteHistory: (timerName) => `¿Eliminar ${timerName} del historial de entrenamientos?`,
  },
};

const ptBR: AppMessages = {
  shell: {
    title: 'Pulse — Timer intervalado',
    description: 'Treinos intervalados com rodadas, ciclos, progresso, lembretes e uso offline.',
    openingPulse: 'Abrindo o Pulse', splashTagline: 'Treino intervalado',
  },
  common: {
    back: 'Voltar', cancel: 'Cancelar', done: 'Concluir', edit: 'Editar', home: 'Início', new: 'Novo',
    progress: 'Progresso', save: 'Salvar', settings: 'Ajustes', timers: 'Timers',
    primaryNavigation: 'Navegação principal', openSettings: 'Abrir ajustes',
    startTimer: (name) => `Iniciar ${name}`,
    moveTimerUp: (name) => `Mover ${name} para cima`,
    moveTimerDown: (name) => `Mover ${name} para baixo`,
    editTimer: (name) => `Editar ${name}`,
  },
  phase: {
    prepare: { label: 'Preparação', short: 'Prepare-se' },
    work: { label: 'Trabalho', short: 'Vamos' },
    rest: { label: 'Descanso', short: 'Recupere-se' },
    cycleRest: { label: 'Descanso entre ciclos', short: 'Reinicie' },
    cooldown: { label: 'Volta à calma', short: 'Respire' },
  },
  timerDetails: {
    automaticName: (work, rest, rounds, cycles) => `${work}s trabalho - ${rest}s descanso × ${rounds}${cycles > 1 ? ` × ${cycles}` : ''}`,
    structure: (rounds, cycles) => `${rounds} ${rounds === 1 ? 'rodada' : 'rodadas'} · ${cycles} ${cycles === 1 ? 'ciclo' : 'ciclos'}`,
    work: 'Trabalho', rest: 'Descanso',
  },
  editor: {
    eyebrow: 'CONFIGURAR TIMER', editTitle: 'Editar timer', newTitle: 'Novo timer', nameLabel: 'Nome do timer',
    customName: 'Nome personalizado', automaticNameHelper: 'Atualiza automaticamente com os intervalos',
    useAutomaticName: 'Usar nome automático', intervals: 'Intervalos', seconds: 'SEGUNDOS',
    structure: 'Estrutura', repeats: 'REPETIÇÕES', prepare: 'Preparação', prepareHelper: 'Contagem regressiva antes de começar',
    work: 'Trabalho', workHelper: 'Treine durante este tempo', rest: 'Descanso', restHelper: 'Entre rodadas',
    cooldown: 'Volta à calma', cooldownHelper: 'Uma vez após o treino', rounds: 'Rodadas',
    roundsHelper: 'Cada rodada contém um intervalo de Trabalho', cycles: 'Ciclos',
    cyclesHelper: (rounds) => `Cada ciclo repete as ${rounds} rodadas`,
    cycleRest: 'Descanso entre ciclos', cycleRestHelper: 'Adicionado somente quando há 2 ciclos ou mais',
    secondsUnit: 's', cycleExplainerTitle: 'Como os ciclos funcionam',
    cycleExplainerBody: 'As rodadas são os intervalos de Trabalho dentro de um bloco. Um ciclo repete todo o bloco. O descanso extra é adicionado apenas entre os blocos, nunca depois do último.',
    estimatedDuration: 'Duração estimada', deleteTimer: 'Excluir timer',
  },
  home: {
    brandEyebrow: 'TREINO INTERVALADO', readyEyebrow: 'QUANDO VOCÊ QUISER', heroFirstLine: 'Faça cada',
    heroSecondLine: 'segundo valer.', description: 'Monte treinos intervalados e leve-os para qualquer lugar, mesmo sem conexão.',
    newTimer: 'Novo timer', weeklyProgress: 'Progresso semanal', thisWeek: 'ESTA SEMANA', minutesUnit: 'min',
    dayStreak: 'sequência de dias', quickStart: 'INÍCIO RÁPIDO', recentTimers: 'Timers recentes',
    manage: (count) => `Gerenciar ${count}`, emptyTitle: 'Ainda não há timers',
    emptyBody: 'Crie um e ele ficará salvo neste dispositivo.', createTimer: 'Criar timer',
  },
  library: {
    eyebrow: 'SUA BIBLIOTECA', allPrograms: 'TODOS OS PROGRAMAS',
    timerCount: (count) => `${count} ${count === 1 ? 'timer' : 'timers'}`,
    description: 'Inicie, edite ou mova um timer. O Início mantém por perto os quatro usados mais recentemente.',
  },
  progress: {
    eyebrow: 'SEU TREINO',
    period: { day: 'Hoje', week: 'Esta semana', month: 'Este mês' },
    periodAria: 'Período de progresso', minutesUnit: 'MIN',
    activeWorkAcross: (duration, workouts) => `${duration} de trabalho ativo em ${workouts} ${workouts === 1 ? 'treino' : 'treinos'}.`,
    activityKicker: 'ATIVIDADE', trainingRhythm: 'Ritmo de treino',
    activeDays: (count) => `${count} ${count === 1 ? 'dia ativo' : 'dias ativos'}`,
    consistencyKicker: 'CONSISTÊNCIA', keepShowingUp: 'Continue presente', activeDayStreak: 'sequência de dias ativos',
    bestDays: (count) => `Melhor: ${count} ${count === 1 ? 'dia' : 'dias'}`,
    activeDaysPerWeek: 'dias ativos por semana',
    goalWeeksInRow: (count) => `${count} ${count === 1 ? 'semana com meta cumprida' : 'semanas com meta cumprida'} seguidas`,
    milestonesKicker: 'MARCOS', buildRecord: 'Construa seu histórico',
    unlockedCount: (unlocked, total) => `${unlocked}/${total} desbloqueados`,
    milestones: {
      'first-workout': { title: 'Primeiro passo', description: 'Conclua seu primeiro treino.' },
      'ten-workouts': { title: 'Impulso', description: 'Conclua 10 treinos.' },
      'two-goal-weeks': { title: 'No ritmo', description: 'Alcance sua meta por duas semanas seguidas.' },
      'five-hours': { title: 'Clube das cinco horas', description: 'Acumule cinco horas de treino.' },
    },
    complete: 'Concluído',
    workoutProgress: (current, target) => `${current} / ${target} ${target === 1 ? 'treino' : 'treinos'}`,
    goalWeekProgress: (current, target) => `${current} / ${target} ${target === 1 ? 'semana de meta' : 'semanas de meta'}`,
    hourProgress: (current, target) => `${current} / ${target} horas`,
    journalKicker: 'REGISTRO', workoutHistory: 'Histórico de treinos',
    sessions: (count) => `${count} ${count === 1 ? 'sessão' : 'sessões'}`,
    emptyTitle: 'Seu primeiro treino começa a história.',
    emptyBody: 'Conclua um timer e o Pulse vai adicioná-lo aqui automaticamente.', chooseTimer: 'Escolher um timer',
    trainingAndActive: (training, active) => `${training} de treino · ${active} ativos`,
    roundsAndCycles: (rounds, cycles) => `${rounds}R · ${cycles}C`,
    delete: 'Excluir', deleteFromHistory: (name) => `Excluir ${name} do histórico`,
    durationSeconds: (seconds) => `${seconds}s`, durationMinutes: (minutes) => `${minutes} min`,
    durationHours: (hours, minutes) => minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`,
  },
  runner: {
    backToTimers: 'Voltar aos timers', timeLeft: (time) => `${time} restantes`, resetWorkout: 'Reiniciar treino',
    sessionKicker: 'SESSÃO', complete: 'Concluído', trainingAdded: (time) => `+${time} de treino`,
    weeklySummary: (activeDays, goal, streak) => `${activeDays} de ${goal} dias ativos nesta semana · sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'}`,
    milestonesUnlocked: (count) => count === 1 ? 'Marco desbloqueado' : `${count} marcos desbloqueados`,
    viewProgress: 'Ver progresso', sessionComplete: 'Sessão concluída', stageProgress: (stage) => `Progresso de ${stage}`,
    session: 'Sessão', currentStage: 'Etapa atual', workout: 'Treino', upNext: 'A seguir',
    total: (time) => `${time} no total`, finish: 'Finalizar',
    workoutProgress: (round, rounds, cycle, cycles) => `Progresso do treino. Rodada ${round} de ${rounds}, ciclo ${cycle} de ${cycles}.`,
    round: 'Rodada', cycle: 'Ciclo', restartWorkout: 'Reiniciar treino', pauseWorkout: 'Pausar treino',
    startWorkout: 'Iniciar treino', again: 'De novo', pause: 'Pausar', start: 'Iniciar', resume: 'Continuar',
  },
  coachSettings: {
    kicker: 'VOZ DO COACH', voiceCoach: 'Coach por voz', voiceCoachHelper: 'Avisos de fase e contagem regressiva 3–2–1',
    voiceCoachSwitch: 'Coach por voz', coachingPhrases: 'Frases do coach',
    coachingPhrasesHelper: 'Lê mensagens motivacionais, de recuperação e de contexto', coachingPhrasesSwitch: 'Ler frases do coach',
    personality: 'Personalidade do coach', personalityHelper: 'Define as palavras e a forma de falar durante o treino.',
    surpriseMe: 'Surpreenda-me', surprisePersonalityHelper: 'Escolhe uma personalidade ao iniciar e a mantém durante todo o treino',
    voicePreference: 'Preferência de voz', automaticPreferenceHelper: 'Usada somente quando a voz do sistema está em Automática.',
    preference: { female: 'Feminina', male: 'Masculina', either: 'Surpreenda-me' },
    systemVoice: 'Voz do sistema', systemVoiceHelper: 'Uma voz específica substitui a preferência acima', coachVoiceAria: 'Voz do coach',
    automatic: 'Automática', savedVoiceUnavailable: 'Voz salva · indisponível para este idioma', recommended: 'Recomendadas',
    otherSystemVoices: 'Outras vozes do sistema', effect: 'efeito', testCoach: 'Testar coach',
    previewCoach: (surprise) => `Ouça ${surprise ? 'uma personalidade surpresa' : 'esta personalidade'} e sua voz`, play: 'Reproduzir',
    ducking: 'Atenuação', duckingHelper: 'Reduz outra música durante os avisos', duckingUnavailable: 'Atenuação indisponível',
    voiceNote: (language) => `O Pulse usa as vozes do sistema em ${language} disponíveis neste dispositivo. A opção Automática evita vozes com efeitos e mantém a mesma voz durante todo o treino.`,
    noCompatibleVoice: (language) => `Nenhuma voz do sistema em ${language} foi detectada. A opção Automática solicitará ao dispositivo a melhor voz disponível.`,
    musicNote: 'Apps web no iOS não podem alterar o volume do Spotify, Apple Music ou outro app. O Pulse só pode controlar os próprios sons.',
  },
  audioSettings: {
    kicker: 'ÁUDIO', soundEffects: 'Efeitos sonoros', soundEffectsHelper: 'Avisos de fase e sinal de conclusão',
    soundScheme: 'Esquema de som', soundSchemeHelper: 'Um esquema sintético integrado', pulseBeep: 'Beep do Pulse',
    appVolume: 'Volume do app', tickingSound: 'Som de tique', tickingHelper: 'Um tique suave por segundo',
    silentModeNote: 'No iPhone, o áudio sintético respeita o modo Silencioso. Desative-o para ouvir os avisos do Pulse.',
  },
  displaySettings: {
    kicker: 'TELA', rotation: 'Rotação', rotationHelper: 'Permite usar o treino na horizontal',
    rotationAria: 'Permitir rotação da tela',
    orientationNote: 'O bloqueio de orientação depende do iOS e funciona melhor quando o Pulse é aberto pela Tela de Início.',
  },
  experimentalSettings: {
    kicker: 'EXPERIMENTAL', labsHelper: 'Experimentos locais de texto da Mentria e testes de vozes do sistema', open: 'Abrir',
    labsNote: 'Abrir o Labs nunca baixa nem inicializa um modelo. Os arquivos do modelo exigem uma confirmação separada.',
  },
  about: {
    versionAria: (version) => `Pulse versão ${version}`, version: 'Versão',
    installablePwa: 'PWA instalável', contentCredits: 'Créditos de conteúdo',
  },
  settings: {
    eyebrow: 'PREFERÊNCIAS', title: 'Ajustes', languageKicker: 'IDIOMA', appLanguage: 'Idioma do app',
    languageHelper: 'Altera o Pulse neste dispositivo', appLanguageAria: 'Idioma do app',
    trainingKicker: 'TREINO', activeDaysPerWeek: 'Dias ativos por semana',
    activeDaysGoalHelper: 'Define o ritmo da sua meta e dos seus marcos', weeklyGoalAria: 'Meta semanal de dias ativos',
    decreaseWeeklyGoal: 'Diminuir meta semanal de dias ativos', increaseWeeklyGoal: 'Aumentar meta semanal de dias ativos', perWeek: '/ semana',
    workoutReminders: 'Lembretes de treino', reminderIntro: 'Escolha um horário e adicione um único evento recorrente ao calendário do seu dispositivo.',
    reminderDaysAria: 'Dias dos lembretes',
    reminderDays: {
      0: { label: 'Domingo', short: 'D' }, 1: { label: 'Segunda-feira', short: 'S' },
      2: { label: 'Terça-feira', short: 'T' }, 3: { label: 'Quarta-feira', short: 'Q' },
      4: { label: 'Quinta-feira', short: 'Q' }, 5: { label: 'Sexta-feira', short: 'S' },
      6: { label: 'Sábado', short: 'S' },
    },
    reminderTime: 'Horário do lembrete', calendarHandlesDelivery: 'Seu calendário envia a notificação',
    reminderTimeAria: 'Horário do lembrete de treino', addRemindersToCalendar: 'Adicionar lembretes ao calendário',
    worksAfterPulseCloses: 'Funciona mesmo depois de fechar o Pulse',
    reminderPrivacyNote: 'Os lembretes do calendário mantêm o Pulse completamente estático e privado. Edite ou exclua o evento recorrente no seu app de calendário.',
    calendarEvent: {
      summary: 'Treino Pulse', description: 'Abra o Pulse e conclua um treino intervalado.',
      alarmDescription: 'Hora do seu treino Pulse.',
    },
  },
  status: {
    openingLabs: 'Abrindo o Pulse Labs…', labsUnlocked: 'Pulse Labs desbloqueado.',
    tapsUntilLabs: (count) => `${count} ${count === 1 ? 'toque' : 'toques'} para chegar ao Pulse Labs.`,
    calendarOpened: 'O calendário foi aberto. No iPhone, conclua a adição do evento recorrente.',
    calendarError: 'Não foi possível criar o lembrete de calendário neste dispositivo.',
    deleteHistory: (timerName) => `Excluir ${timerName} do histórico de treinos?`,
  },
};

const APP_MESSAGES: Record<Locale, AppMessages> = {
  en,
  'es-AR': esAR,
  'pt-BR': ptBR,
};

export function getMessages(locale: Locale): AppMessages {
  return APP_MESSAGES[locale];
}
