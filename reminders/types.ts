export type ReminderDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ReminderDayOption = {
  value: ReminderDay;
  label: string;
  shortLabel: string;
  calendarCode: string;
};
