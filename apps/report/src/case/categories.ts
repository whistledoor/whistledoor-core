// Fixed list for now (docs/report-app.md). The id goes into the encrypted report.
export const CATEGORIES = [
  'corruption',
  'fraud',
  'competition',
  'data_protection',
  'workplace_safety',
  'environment',
  'harassment',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ReportKind = 'anonymous' | 'confidential';

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}
