/**
 * Freshness tokens for the client-side course cache.
 *
 * Served by `GET /v1/courses/{courseId}/last-updates`. Tokens are opaque
 * server-issued values (epoch millis; `0` = "never bumped") compared by strict
 * equality against previously stored server tokens — never against the client
 * clock and never with `<`/`>`.
 */
export type CacheResourceType = 'SYLLABUS' | 'LESSON' | 'SUMMARY' | 'EXERCISE' | 'SUBMISSION';

export interface LastUpdatesResponse {
  courseId: string;
  lastUpdates: Record<CacheResourceType, number>;
}
