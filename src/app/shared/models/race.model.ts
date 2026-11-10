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
  options: string[];
  correctIndex: number;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRaceResultRequest {
  /** Null for a race over the whole course. */
  moduleId: string | null;
  finishMs: number;
  correctCount: number;
  wrongCount: number;
  seed: number;
}

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
