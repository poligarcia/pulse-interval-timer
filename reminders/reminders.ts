import type { ReminderDay, ReminderDayOption, WorkoutReminderCalendarCopy } from './types.ts';

export const REMINDER_DAY_OPTIONS: ReminderDayOption[] = [
  { value: 1, calendarCode: 'MO' },
  { value: 2, calendarCode: 'TU' },
  { value: 3, calendarCode: 'WE' },
  { value: 4, calendarCode: 'TH' },
  { value: 5, calendarCode: 'FR' },
  { value: 6, calendarCode: 'SA' },
  { value: 0, calendarCode: 'SU' },
];

const DEFAULT_CALENDAR_COPY: WorkoutReminderCalendarCopy = {
  summary: 'Laptiva workout',
  description: 'Open Laptiva and complete a focused interval workout.',
  alarmDescription: 'Time for your Laptiva workout.',
};

export const DEFAULT_REMINDER_DAYS: ReminderDay[] = [1, 3, 5];
export const DEFAULT_REMINDER_TIME = '18:00';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function normalizeReminderDays(value: unknown): ReminderDay[] {
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_DAYS];
  const selected = new Set(value.filter((day): day is ReminderDay => (
    Number.isInteger(day) && day >= 0 && day <= 6
  )));
  const normalized = REMINDER_DAY_OPTIONS
    .map(({ value: day }) => day)
    .filter((day) => selected.has(day));
  return normalized.length > 0 ? normalized : [...DEFAULT_REMINDER_DAYS];
}

export function normalizeReminderTime(value: unknown) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : DEFAULT_REMINDER_TIME;
}

export function nextReminderDate(days: ReminderDay[], time: string, now = new Date()) {
  const normalizedDays = normalizeReminderDays(days);
  const normalizedTime = normalizeReminderTime(time);
  const [hour, minute] = normalizedTime.split(':').map(Number);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour,
      minute,
      0,
      0,
    );
    if (candidate > now && normalizedDays.includes(candidate.getDay() as ReminderDay)) return candidate;
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, hour, minute, 0, 0);
}

function localCalendarDate(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function utcCalendarDate(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function createWorkoutReminderCalendar(
  days: ReminderDay[],
  time: string,
  now = new Date(),
  copy: WorkoutReminderCalendarCopy = DEFAULT_CALENDAR_COPY,
) {
  const normalizedDays = normalizeReminderDays(days);
  const start = nextReminderDate(normalizedDays, time, now);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const byDay = REMINDER_DAY_OPTIONS
    .filter(({ value }) => normalizedDays.includes(value))
    .map(({ calendarCode }) => calendarCode)
    .join(',');
  const uidDays = normalizedDays.join('-');
  const uidTime = normalizeReminderTime(time).replace(':', '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Laptiva Interval Timer//Workout Reminders 1.4//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:pulse-workout-${uidDays}-${uidTime}@pulse-interval-timer`,
    `DTSTAMP:${utcCalendarDate(now)}`,
    `DTSTART:${localCalendarDate(start)}`,
    `DTEND:${localCalendarDate(end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
    `SUMMARY:${copy.summary}`,
    `DESCRIPTION:${copy.description}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${copy.alarmDescription}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function createWorkoutReminderCalendarDataUrl(
  days: ReminderDay[],
  time: string,
  now = new Date(),
  copy: WorkoutReminderCalendarCopy = DEFAULT_CALENDAR_COPY,
) {
  const calendar = createWorkoutReminderCalendar(days, time, now, copy);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(calendar)}`;
}
