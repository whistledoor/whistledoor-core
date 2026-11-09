import { describe, expect, it } from 'vitest';
import { appendPrompt } from './prompts';

describe('appendPrompt', () => {
  it('starts an empty description with the label', () => {
    expect(appendPrompt('', 'Wann')).toBe('Wann: ');
  });

  it('adds a new line after existing text', () => {
    expect(appendPrompt('Rechnungen doppelt freigegeben', 'Wo')).toBe('Rechnungen doppelt freigegeben\nWo: ');
  });

  it('does not add a second line break', () => {
    expect(appendPrompt('Erste Zeile\n', 'Wer war beteiligt')).toBe('Erste Zeile\nWer war beteiligt: ');
  });
});
