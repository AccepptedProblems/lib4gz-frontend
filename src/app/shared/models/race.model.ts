/** Lightning Kart look: a character id and a kart id from the picker's catalogue. */
export interface RaceAppearance {
  characterId: string;
  kartId: string;
}

/** One question of the course bank sent on PUT. `id` null creates it; an id updates that question. */
export interface RaceQuestionItem {
  id: string | null;
  moduleId: string;
  content: string;
  options: string[];
  correctIndex: number;
}

/** The whole bank. A question whose id is absent from the list is hidden. */
export interface ReplaceRaceQuestionsRequest {
  questions: RaceQuestionItem[];
}

export interface RaceQuestionResponse {
  id: string;
  courseId: string;
  moduleId: string;
  content: string;
  /** Empty unless the caller teaches the course. */
  options: string[];
  /** The right option. Null unless the caller teaches the course. */
  correctIndex: number | null;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

/** POST a race: the server deals it. */
export interface StartRaceRequest {
  /** Null for a race over the whole course. */
  moduleId: string | null;
  /** How many questions the race needs; the server may deal fewer. */
  questionCount: number;
}

/** One dealt question. No key. */
export interface DealtQuestion {
  /** The question number, from 0; the same as its position in the list. */
  seq: number;
  questionId: string;
  moduleId: string;
  content: string;
  /** One to four, in the order to show. */
  options: string[];
}

export interface StartRaceResponse {
  raceId: string;
  seed: number;
  questions: DealtQuestion[];
}

export interface RaceAnswerRequest {
  seq: number;
  /** The shown option pressed, from 0; null when the countdown ran out. */
  choice: number | null;
}

export interface RaceAnswerResponse {
  seq: number;
  correct: boolean;
  correctCount: number;
  wrongCount: number;
}

export interface FinishRaceRequest {
  /** An integer. */
  finishMs: number;
}

/** The saved result, from the server's own counts. */
export interface RaceResultResponse {
  id: string;
  userId: string;
  courseId: string;
  moduleId: string | null;
  finishMs: number;
  correctCount: number;
  wrongCount: number;
  seed: number;
  createdAt: number;
  /**
   * One entry per question number: the right shown option, an index into that question's dealt
   * `options`, only for the first few questions the server judged wrong; null everywhere else.
   */
  answerKey: (number | null)[];
}

export interface LeaderboardRow {
  userId: string;
  username: string;
  name: string;
  /** The racer's look, or null when never chosen. */
  appearance: RaceAppearance | null;
  finishMs: number;
  correctCount: number;
  wrongCount: number;
  createdAt: number;
}

export interface LeaderboardResponse {
  /** Ten fastest people in the scope, best result each, fastest first. */
  rows: LeaderboardRow[];
  /** The caller's own best in the scope, or null when they have not finished a race there. */
  mine: LeaderboardRow | null;
}
