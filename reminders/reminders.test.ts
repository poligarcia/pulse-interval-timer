import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorkoutReminderCalendar,
  createWorkoutReminderCalendarDataUrl,
  nextReminderDate,
  normalizeReminderDays,
  normalizeReminderTime,
} from './index.ts';

test('normalizes reminder days and time without accepting empty schedules', () => {
  assert.deepEqual(normalizeReminderDays([5, 1, 1, 9, '3']), [1, 5]);
  assert.deepEqual(normalizeReminderDays([]), [1, 3, 5]);
  assert.equal(normalizeReminderTime('07:05'), '07:05');
  assert.equal(normalizeReminderTime('27:00'), '18:00');
});

test('finds the next selected reminder in local time', () => {
  const mondayMorning = new Date(2026, 7, 31, 9, 0);
  const mondayEvening = nextReminderDate([1, 3, 5], '18:00', mondayMorning);
  const afterMondayReminder = nextReminderDate([1, 3, 5], '18:00', new Date(2026, 7, 31, 19, 0));

  assert.equal(mondayEvening.getDay(), 1);
  assert.equal(mondayEvening.getHours(), 18);
  assert.equal(afterMondayReminder.getDay(), 3);
});

test('creates a recurring iCalendar event with an operating-system alarm', () => {
  const calendar = createWorkoutReminderCalendar(
    [1, 3, 5],
    '18:00',
    new Date(2026, 7, 30, 12, 0),
  );

  assert.match(calendar, /BEGIN:VCALENDAR\r\n/);
  assert.match(calendar, /DTSTART:20260831T180000/);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/);
  assert.match(calendar, /BEGIN:VALARM\r\nTRIGGER:PT0M/);
  assert.match(calendar, /PRODID:-\/\/Laptiva Interval Timer\/\/Workout Reminders 1\.4\/\/EN/);
  assert.match(calendar, /SUMMARY:Laptiva workout/);
});

test('creates a text/calendar URL that browsers can open for calendar import', () => {
  const url = createWorkoutReminderCalendarDataUrl(
    [1, 3, 5],
    '18:00',
    new Date(2026, 7, 30, 12, 0),
  );
  const calendar = decodeURIComponent(url.slice(url.indexOf(',') + 1));

  assert.match(url, /^data:text\/calendar;charset=utf-8,/);
  assert.match(calendar, /BEGIN:VCALENDAR\r\n/);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/);
});

test('uses localized copy in calendar content while keeping recurrence codes stable', () => {
  const calendar = createWorkoutReminderCalendar(
    [1, 3, 5],
    '18:00',
    new Date(2026, 7, 30, 12, 0),
    {
      summary: 'Entrenamiento Laptiva',
      description: 'Abrí Laptiva y completá un entrenamiento por intervalos.',
      alarmDescription: 'Es hora de tu entrenamiento Laptiva.',
    },
  );

  assert.match(calendar, /SUMMARY:Entrenamiento Laptiva/);
  assert.match(calendar, /DESCRIPTION:Abrí Laptiva y completá/);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/);
});
