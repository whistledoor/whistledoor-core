// HSchG: receipt is confirmed within 7 days, feedback follows within 3 months.

const ACKNOWLEDGE_DAYS = 7;
const FEEDBACK_MONTHS = 3;

export interface Deadlines {
  acknowledgeBy: Date;
  feedbackBy: Date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Same day of the month, or the month's last day if it has fewer: 30 November gives 28 February. */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/** The latest dates for both answers, counted from when the report was sent. */
export function deadlines(sentAt: Date): Deadlines {
  return { acknowledgeBy: addDays(sentAt, ACKNOWLEDGE_DAYS), feedbackBy: addMonths(sentAt, FEEDBACK_MONTHS) };
}
