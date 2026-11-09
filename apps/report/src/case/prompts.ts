/**
 * Adds a labelled line for one of the optional questions below the description,
 * such as "Wann: ". Starts a new line unless the text is empty or already ends with one.
 */
export function appendPrompt(text: string, label: string): string {
  const line = `${label}: `;
  if (text === '' || text.endsWith('\n')) {
    return `${text}${line}`;
  }
  return `${text}\n${line}`;
}
