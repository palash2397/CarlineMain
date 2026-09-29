// A recurring booking (series) stays ACTIVE and keeps creating rides until the
// passenger pauses it or cancels the whole series.
export enum RecurringStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export const RECURRING_EDITABLE_STATUSES = [
  RecurringStatus.ACTIVE,
  RecurringStatus.PAUSED,
];
