export type ReminderDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ReminderDayOption = {
  value: ReminderDay;
  calendarCode: string;
};

export type WorkoutReminderCalendarCopy = {
  summary: string;
  description: string;
  alarmDescription: string;
};
