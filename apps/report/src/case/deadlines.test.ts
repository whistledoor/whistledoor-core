import { describe, expect, it } from 'vitest';
import { deadlines } from './deadlines';

const day = (year: number, month: number, date: number): Date => new Date(year, month - 1, date, 14, 30);

describe('deadlines', () => {
  it('adds 7 days and 3 months', () => {
    expect(deadlines(day(2026, 11, 8))).toEqual({ acknowledgeBy: day(2026, 11, 15), feedbackBy: day(2027, 2, 8) });
  });

  it('crosses a month and a year', () => {
    expect(deadlines(day(2026, 12, 28)).acknowledgeBy).toEqual(day(2027, 1, 4));
  });

  it('ends on the last day of a shorter month', () => {
    expect(deadlines(day(2026, 11, 30)).feedbackBy).toEqual(day(2027, 2, 28));
    expect(deadlines(day(2027, 11, 30)).feedbackBy).toEqual(day(2028, 2, 29));
    expect(deadlines(day(2027, 3, 31)).feedbackBy).toEqual(day(2027, 6, 30));
  });

  it('leaves the send time alone', () => {
    const sentAt = day(2026, 11, 8);
    deadlines(sentAt);
    expect(sentAt).toEqual(day(2026, 11, 8));
  });
});
