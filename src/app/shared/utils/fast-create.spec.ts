import { ExerciseType } from '../models/enums';
import { parseFastCreate, splitNumbered } from './fast-create';

describe('splitNumbered', () => {
  it('returns nothing for blank text', () => {
    expect(splitNumbered('   \n')).toEqual([]);
  });

  it('splits on 1. and 1) and strips the number', () => {
    expect(splitNumbered('1. one\n2) two')).toEqual(['one', 'two']);
  });

  it('attaches continuation lines to the item above', () => {
    expect(splitNumbered('1. first\nmore\n2. second')).toEqual(['first\nmore', 'second']);
  });

  it('drops text before the first numbered line', () => {
    expect(splitNumbered('Here are your answers:\n1. a\n2. b')).toEqual(['a', 'b']);
  });

  it('strips code fences', () => {
    expect(splitNumbered('```\n1. a\n2. b\n```')).toEqual(['a', 'b']);
  });
});

describe('parseFastCreate', () => {
  const mc = (text: string) => parseFastCreate(ExerciseType.MULTIPLE_CHOICE, text);

  it('keeps written-answer blocks as plain content', () => {
    const [q] = parseFastCreate(ExerciseType.TEXT_ANSWER, '1. Explain\nmore');
    expect(q).toEqual({ content: 'Explain\nmore', meta: {}, warnings: [] });
  });

  it('reads options and the starred correct answer', () => {
    const [q] = mc('1. Capital of France?\na) Berlin\n*b) Paris\nc) Rome');
    expect(q.content).toBe('Capital of France?');
    expect(q.meta['options']).toEqual([
      { text: 'Berlin', isCorrect: false },
      { text: 'Paris', isCorrect: true },
      { text: 'Rome', isCorrect: false },
    ]);
    expect(q.warnings).toEqual([]);
  });

  it('accepts a) a. A) A. as option markers', () => {
    const [q] = mc('1. Q\na) one\nb. two\nC) three\nD. four');
    expect(q.meta['options'].map((o: any) => o.text)).toEqual(['one', 'two', 'three', 'four']);
  });

  it('keeps multi-line question text before the first option', () => {
    const [q] = mc('1. Line one\nline two\na) x\nb) y');
    expect(q.content).toBe('Line one\nline two');
  });

  it('warns and marks nothing when no option is starred', () => {
    const [q] = mc('1. Q\na) x\nb) y');
    expect(q.meta['options'].some((o: any) => o.isCorrect)).toBeFalse();
    expect(q.warnings).toContain('No correct answer marked');
  });

  it('tops up to two options when fewer are given', () => {
    const [q] = mc('1. Q\n*a) only');
    expect(q.meta['options']).toEqual([
      { text: 'only', isCorrect: true },
      { text: '', isCorrect: false },
    ]);
    expect(q.warnings).toEqual(['Fewer than 2 options']);
  });

  it('keeps only the first six options', () => {
    const [q] = mc('1. Q\n*a) 1\nb) 2\nc) 3\nd) 4\ne) 5\nf) 6\na) 7');
    expect(q.meta['options'].length).toBe(6);
    expect(q.warnings).toEqual(['Only the first 6 options are kept']);
  });

  it('parses several questions separated by blank lines', () => {
    const qs = mc('1. A\n*a) x\nb) y\n\n2. B\na) p\n*b) q');
    expect(qs.map(q => q.content)).toEqual(['A', 'B']);
    expect(qs[1].meta['options'][1].isCorrect).toBeTrue();
  });
});
