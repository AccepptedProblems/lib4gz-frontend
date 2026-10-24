import { ExerciseType } from '../models/enums';

/**
 * Parsers behind the two paste boxes: Fast Create (exercise editor) and Fast Fill
 * (exercise attempt). Both split on numbered lines; only Fast Create reads the
 * block after the number for exercise-type-specific content.
 */

export interface ParsedQuestion {
  content: string;
  meta: Record<string, any>;
  /** Human-readable problems the teacher may want to fix. Does not block adding. */
  warnings: string[];
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

const NUMBERED = /^\s*(\d+)\s*[.)]\s*/;
const CODE_FENCE = /^\s*```/;
/** `a)` `a.` `A)` `A.`, optionally preceded by `*` marking the correct option. */
const OPTION = /^\s*(\*)?\s*([a-fA-F])\s*[.)]\s*/;

/**
 * Split text into numbered items. A line starting with `1.` or `1)` opens a new item;
 * other lines continue the item above. Lines before the first numbered line and code
 * fences are dropped. Each item is returned trimmed, with its number prefix removed.
 */
export function splitNumbered(text: string): string[] {
  if (!text.trim()) return [];

  const result: string[] = [];
  let current: string[] | null = null;

  for (const line of text.split('\n')) {
    if (CODE_FENCE.test(line)) continue;
    const match = NUMBERED.exec(line);
    if (match) {
      if (current) flush(current, result);
      current = [line.slice(match[0].length)];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) flush(current, result);
  return result;
}

function flush(lines: string[], into: string[]): void {
  const joined = lines.join('\n').trim();
  if (joined) into.push(joined);
}

/** Parse a Fast Create paste for the given exercise type. */
export function parseFastCreate(type: ExerciseType, text: string): ParsedQuestion[] {
  const blocks = splitNumbered(text);
  return type === ExerciseType.MULTIPLE_CHOICE
    ? blocks.map(parseMultipleChoiceBlock)
    : blocks.map(block => ({ content: block, meta: {}, warnings: [] }));
}

function parseMultipleChoiceBlock(block: string): ParsedQuestion {
  const contentLines: string[] = [];
  const options: { text: string; isCorrect: boolean }[] = [];
  const warnings: string[] = [];

  for (const line of block.split('\n')) {
    const match = OPTION.exec(line);
    if (match && options.length < MAX_OPTIONS) {
      options.push({ text: line.slice(match[0].length).trim(), isCorrect: match[1] === '*' });
    } else if (match) {
      warnings.push(`Only the first ${MAX_OPTIONS} options are kept`);
    } else if (options.length === 0) {
      contentLines.push(line);
    } else {
      // Text after an option continues that option.
      const last = options[options.length - 1];
      last.text = `${last.text}\n${line}`.trim();
    }
  }

  while (options.length < MIN_OPTIONS) {
    options.push({ text: '', isCorrect: false });
    if (!warnings.includes('Fewer than 2 options')) warnings.push('Fewer than 2 options');
  }
  if (!options.some(o => o.isCorrect)) warnings.push('No correct answer marked');

  return {
    content: contentLines.join('\n').trim(),
    meta: { options },
    warnings: Array.from(new Set(warnings)),
  };
}
