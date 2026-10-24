/**
 * Sentences for the dialogs that confirm deleting a module, lesson or exercise.
 * One home so every delete dialog words the loss the same way.
 */

/** Student submissions inside the item: a number, still loading, or unknown when the count failed. */
export type SubmissionCount = number | 'loading' | 'unknown';

export function countOf(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * What goes with the item, e.g. "Its summary and 7 exercises will be deleted with it."
 * `parts` lists [count, singular noun]; a boolean count stands for a thing it has one or none
 * of, named without a number. The first numbered noun names the empty case.
 */
export function contentsWarning(parts: [number | boolean, string][]): string {
  const named = parts.flatMap(([n, noun]) =>
    n === true ? [noun] : typeof n === 'number' && n > 0 ? [countOf(n, noun)] : []);
  const emptyNoun = (parts.find(([n]) => typeof n === 'number') ?? parts[0])[1];
  return named.length
    ? `Its ${named.join(' and ')} will be deleted with it.`
    : `It has no ${emptyNoun}s.`;
}

/** `place` is "module", "lesson" or "exercise". */
export function submissionsWarning(count: SubmissionCount, place: string): string {
  if (count === 'loading') return 'Counting student submissions…';
  if (count === 'unknown') return `Any student submissions in this ${place} will disappear too.`;
  if (count === 0) return `There are no student submissions in this ${place}.`;
  return `${countOf(count, 'student submission')} in this ${place}, including drafts, will disappear too.`;
}

export const NO_UNDO_WARNING = 'The app cannot undo this.';
