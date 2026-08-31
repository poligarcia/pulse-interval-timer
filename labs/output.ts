export const MAX_GENERATED_PHRASE_LENGTH = 220;

export type CleanPhraseResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function cleanGeneratedPhrase(value: unknown): CleanPhraseResult {
  if (typeof value !== 'string') return { ok: false, error: 'The model returned malformed output. Try again.' };

  let cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|[^|]*\|>/g, '')
    .trim();

  const quotePairs: Array<[string, string]> = [['"', '"'], ['“', '”'], ['‘', '’']];
  for (const [opening, closing] of quotePairs) {
    if (cleaned.startsWith(opening) && cleaned.endsWith(closing) && cleaned.length >= 2) {
      cleaned = cleaned.slice(opening.length, -closing.length).trim();
      break;
    }
  }

  if (!cleaned) return { ok: false, error: 'The model returned an empty phrase. Try again.' };
  if (/\r?\n\s*\r?\n/.test(cleaned)) {
    return { ok: false, error: 'The model returned multiple paragraphs. Try a shorter request.' };
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length > MAX_GENERATED_PHRASE_LENGTH) {
    return { ok: false, error: `The phrase is longer than ${MAX_GENERATED_PHRASE_LENGTH} characters. Try again.` };
  }
  return { ok: true, text: cleaned };
}
