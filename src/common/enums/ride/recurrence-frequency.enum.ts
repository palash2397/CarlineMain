// How a recurring booking repeats: DAILY on every day, WEEKLY on the selected
// weekdays (Mon - Fri is the weekdays 1 - 5), MONTHLY on the selected days of
// the month (the app has no monthly day picker, so the day of the month comes
// from the start date).
export enum RecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}
