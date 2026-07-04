# Client-Side Cache with Server Freshness Tokens — Lib4GZ LMS

**Author:** Senior Architecture Review
**Date:** 2026-07-04
**Scope:** Backend (`lib4gz/`) + Frontend (`lib4gz-fe/`)
**Status:** Approved design — bump table + Hibernate event listener

---

## Executive Summary

### The problem
Switching tabs in the course detail view (Summary, Exercises, Lessons, teacher Submissions) refires HTTP requests on every tab and lesson switch, even though the underlying data rarely changes between switches. There is **no caching anywhere in the frontend today** — every service method returns a raw `HttpClient` observable straight to the network. This wastes Cloud Run requests and makes tab navigation feel slower than it should.

### The fix in one sentence
The backend keeps one `lastUpdate` timestamp per `(courseId, resourceType)` in a new table — **maintained automatically by a single Hibernate event listener that observes all entity writes** — and the client stores responses in **IndexedDB** tagged with the server token seen at fetch time, re-validating all five types with **one cheap `GET /v1/courses/{id}/last-updates` call** (memoized 30 s in memory) and refetching a resource only when its token changed.

### Core invariants
- Freshness tokens are **opaque server-issued values compared by strict equality** against previously stored server tokens. The client clock is never compared against a server timestamp — clock skew is impossible by construction.
- Bumps are **generated at the persistence layer, not hand-coded in services**. Every mutation flows through Hibernate, so the listener structurally cannot miss an invalidation, and future mutations are covered automatically. Zero changes to existing service files.

### Projected behavior
| Scenario | Requests before | Requests after |
|---|---|---|
| Tab switch within 30 s of last check | 1 data call | **0** |
| Tab switch after 30 s, nothing changed | 1 data call | 1 tiny `last-updates` call |
| Tab switch after a teacher edit | 1 data call | 1 `last-updates` + 1 data call |
| Lesson switch A→B→A (unchanged course) | 3+ data calls | 0–1 `last-updates` calls |

### Decisions taken
1. **Granularity: per `(courseId, resourceType)`** with types `SYLLABUS, LESSON, SUMMARY, EXERCISE, SUBMISSION`. Coarse — a teacher edit invalidates that type course-wide — but the schema stays tiny and one check call covers the whole course. Per-lesson granularity is a documented future refinement.
2. **Submissions: cache only the teacher lesson-submissions tab.** The listener bumps `SUBMISSION` only for non-`DRAFT` submissions — the student's 2-second autosave writes `DRAFT` rows and never moves the token. Student `mySubmission` / exercise-attempt data stays uncached.
3. **IndexedDB via the `idb` npm library** (~1 KB promise wrapper; one new dependency).
4. **Bump table over derived aggregates** (computing `MAX(updated_at)`/`COUNT(*)` per check): the check endpoint is the hottest path in the system — checks outnumber mutations by orders of magnitude — so reads must be O(1), not O(course size). Materialize on write, read cheap.
5. **Hibernate event listener over hand-written `bump()` calls in services**: plan v1 required ~25 call sites across 8 services plus a hand-maintained cross-type matrix — a permanent forgotten-bump risk. The listener collapses that matrix into one declarative map in one file. (Postgres triggers were considered — even more bulletproof, but there is no migration tooling to manage them, the join logic would hide in PL/pgSQL, and only one application writes this database.)

---

## 1. Backend (`lib4gz/`)

### 1.1 New entity — `courses/model/entity/CourseResourceFreshness.kt`

Table `course_resource_freshness`, id prefix `frs` (unused; follows `IdGenerator.generate` convention). `courseId` is a **plain string column, not a `@ManyToOne`** — freshness rows are metadata, not domain aggregates; this avoids the `@Where(deleted_at IS NULL)` soft-delete filter on `Course` and keeps the native upsert trivial. `ddl-auto: update` auto-creates the table and unique constraint — no migration tooling exists or is needed.

```kotlin
@Entity
@Table(
    name = "course_resource_freshness",
    uniqueConstraints = [UniqueConstraint(columnNames = ["course_id", "resource_type"])]
)
data class CourseResourceFreshness(
    @Id @Column(length = 50)
    val id: String = IdGenerator.generate("frs"),

    @Column(name = "course_id", nullable = false, length = 50)
    val courseId: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 50)
    val resourceType: FreshnessResourceType,

    @Column(name = "last_update", nullable = false)
    var lastUpdate: Long = Instant.now().toEpochMilli()
)

enum class FreshnessResourceType { SYLLABUS, LESSON, SUMMARY, EXERCISE, SUBMISSION }
```

No `createdAt`/`updatedAt`/`@PreUpdate` — `lastUpdate` is the only timestamp that matters and is written explicitly. **Important:** this entity must be excluded from the listener's own entity map (trivially true — it just isn't in the map) so bumps never recurse.

### 1.2 New repo — `courses/repo/CourseResourceFreshnessRepo.kt`

**Concurrency decision: Postgres native upsert, not read-modify-write.** Two concurrent bumps under read-modify-write either race into a duplicate-key error on double insert or silently lose an update. `INSERT … ON CONFLICT DO UPDATE` is a single atomic statement resolved by Postgres row locking, and last-writer-wins is exactly the semantics we want. The project is Postgres-only (the soft-delete `@SQLDelete` SQL is already PG-specific), so a native query is consistent.

```kotlin
@Repository
interface CourseResourceFreshnessRepo : JpaRepository<CourseResourceFreshness, String> {

    fun findByCourseId(courseId: String): List<CourseResourceFreshness>

    @Modifying
    @Query(
        value = """
            INSERT INTO course_resource_freshness (id, course_id, resource_type, last_update)
            VALUES (:id, :courseId, :resourceType, :lastUpdate)
            ON CONFLICT (course_id, resource_type)
            DO UPDATE SET last_update = EXCLUDED.last_update
        """,
        nativeQuery = true
    )
    fun upsert(id: String, courseId: String, resourceType: String, lastUpdate: Long)
}
```

### 1.3 New payload — `courses/model/payload/FreshnessPayload.kt`

```kotlin
data class LastUpdatesResponse(
    val courseId: String,
    val lastUpdates: Map<FreshnessResourceType, Long>   // always all 5 keys; 0 when no row yet
)
```

### 1.4 New service — `courses/service/FreshnessService.kt`

Follows the codebase pattern: interface + `@Service @Transactional` impl.

```kotlin
interface FreshnessService {
    /** Blocking; joins the caller's transaction. Called by FreshnessEntityListener, not by feature services. */
    fun bump(courseId: String, types: Set<FreshnessResourceType>)

    fun getLastUpdates(courseId: String, userId: String): Mono<LastUpdatesResponse>
}
```

- `bump`: one `Instant.now().toEpochMilli()`, then `upsert(IdGenerator.generate("frs"), courseId, type.name, now)` per type. The generated id is only used when the row doesn't exist yet.
- `getLastUpdates`: `Mono.fromCallable { … }.subscribeOn(Schedulers.boundedElastic())`; load course (404 if missing); access guard **mirrors `SyllabusService`'s read access** — allow if `course.visibility == Visibility.PUBLIC` or `enrollmentService.isEnrolledInCourse(courseId, userId)` (covers creator + active enrollment); return `FreshnessResourceType.entries.associateWith { rows[it] ?: 0L }`.

**Guard rationale:** the check endpoint must be readable by everyone who can read the *cached* endpoints. Syllabus allows non-enrolled viewers of PUBLIC courses; a stricter guard would give those users a permanent 401 on the check (harmless — the client falls back to network — but a designed-in cache bypass).

**Bootstrap semantics — why `0` for missing rows:** the table starts empty, including for courses mutated before the feature ships. The client caches data with `token = 0`; as long as nothing changes, `0 === 0` keeps serving from cache. The first post-ship mutation upserts a real epoch-millis value → mismatch → forced refetch, exactly when needed. `0` is a deterministic server answer, not a client default, so all clients agree.

### 1.5 New controller — `courses/controller/FreshnessController.kt`

```kotlin
@RestController
@RequestMapping("/v1")
class FreshnessController(private val freshnessService: FreshnessService) {

    @GetMapping("/courses/{courseId}/last-updates")
    fun getLastUpdates(
        @PathVariable courseId: String,
        @RequestHeader(PZRequestHeader.USER_ID) userId: String
    ): Mono<LastUpdatesResponse> = freshnessService.getLastUpdates(courseId, userId)
}
```

`X-User-Id` is injected by `JwtAuthFilter` — same pattern as `SyllabusController`. **No `security.json` change**: the catch-all `anyRequest().authenticated()` covers it. Fully backward compatible — old clients simply never call it.

### 1.6 The bump engine — `common/freshness/FreshnessEntityListener.kt` (+ registrar)

**Zero changes to existing service files.** A single Hibernate listener observes every entity write and generates bumps from a declarative map. Lives in `common/` because it is cross-cutting (imports entities from both the `courses` and `exercise` slices; `common` importing feature slices avoids a `courses ↔ exercise` cycle).

#### 1.6.1 The declarative map (the whole former "bump matrix", now one place)

| Entity written | Bumps | Why the cross-type entries |
|---|---|---|
| `Course` | `SYLLABUS` | syllabus embeds course title/description/visibility |
| `Module` | `SYLLABUS` | modules are structural syllabus content |
| `Lesson` | `LESSON`, `SYLLABUS` | syllabus embeds every lesson (title, orderIndex, lessonCount) |
| `Summary` | `SUMMARY`, `LESSON`, `SYLLABUS` | `hasSummary` lives in `LessonResponse` on the lesson-detail payload **and** inside syllabus lessons |
| `Exercise` | `EXERCISE`, `LESSON`, `SYLLABUS` | `exerciseCount` lives in lesson-detail and syllabus lesson payloads |
| `Question` | `EXERCISE`, `SUBMISSION` | exercise payloads carry questions/`questionCount`; the teacher submissions tab expands `questions` |
| `Submission` | `SUBMISSION` — **only when `status != DRAFT`** | the autosave rule: student typing writes `DRAFT` rows and must not thrash the teacher tab; `submitForReview` flips status to `SUBMITTED` in the same update, so the transition itself bumps |
| `StudentAnswer` | `SUBMISSION` — **only when owning `submission.status != DRAFT`** | covers teacher comments (`addTeacherComment` mutates the answer); the owning submission is already managed in-session during these flows, so reading its status costs no query |
| `Enrollment` | `SYLLABUS` | syllabus embeds `enrollmentCount` and `myEnrollment` — an approved student must not be served a cached "PENDING" syllabus |
| `User`, `CourseResourceFreshness` | — (not in map) | not course content; excluding the freshness entity itself prevents recursion |

**Deliberately not bumped:** lesson visits (`Enrollment.recordVisit` *does* update the enrollment row and will bump `SYLLABUS` — see the accepted-cost note in §3) and `DRAFT` submission writes. Per-user syllabus fields (`completed` flags, `progress`) drifting inside another user's action window are already masked by the optimistic `ProgressService` localStorage layer merged in `course-layout.component.ts`.

#### 1.6.2 Listener mechanics

`FreshnessEntityListener` implements `PostInsertEventListener`, `PostUpdateEventListener`, `PostDeleteEventListener` (Hibernate 6.x; `requiresPostCommitHandling` returns `false` — we fire during the transaction, not after commit).

- **Soft deletes come for free:** `@SQLDelete` still fires Hibernate's delete event, so lesson/module/exercise/question deletions bump correctly with no special handling.
- **Resolving `courseId` without initializing lazy proxies.** Inside a flush event, never navigate `lesson.module.course`. Instead:
  - For entities whose direct parent *is* the course (`Module.course`, `Enrollment.course`), read the proxy's identifier via `HibernateProxy.hibernateLazyInitializer.identifier` (or the entity id if already initialized) — no query, no init.
  - For deeper entities, read the direct-parent FK the same way (`lesson.module` → moduleId; `exercise.lesson` → lessonId; `summary.lesson` → lessonId; `submission.exercise` → exerciseId; `question.exerciseId` is already a plain string column), then resolve `moduleId/lessonId/exerciseId → courseId` through a **relationship cache**: a `ConcurrentHashMap<String, String>` in the listener, filled on miss by one indexed native query executed on `event.session` (e.g. `SELECT m.course_id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE l.id = ?`). These relationships are immutable (a lesson never moves course), so entries never invalidate; at LMS scale the map stays small (upgrade to Caffeine `maximumSize` only if memory ever matters).
- **Buffer + dedupe per transaction.** The listener does not upsert per event. It accumulates `(courseId, FreshnessResourceType)` pairs into a transaction-scoped `MutableSet` bound via `TransactionSynchronizationManager` (services are `@Transactional` and the JPA work runs on the `boundedElastic` thread that owns the transaction, so synchronizations are available). On the first pair of a transaction it registers a `TransactionSynchronization` whose `beforeCommit` flushes the deduped set through `FreshnessService.bump(...)` — inside the same transaction, so the bump commits or rolls back atomically with the mutation. A batch save of 20 questions produces **one** upsert, not 20, and each transaction takes the freshness row lock once, at the very end, for the shortest possible time (the hot-row mitigation). Guard: if no transaction synchronization is active (shouldn't happen in this codebase), bump immediately — never drop silently.
- **Failure isolation:** an exception while resolving/bumping must not turn a successful domain write into a 500 for a cache hint. Catch, log at WARN, continue. Worst case is one missed invalidation until the next real mutation — same failure envelope as any cache.

#### 1.6.3 Registration — `common/freshness/FreshnessListenerRegistrar.kt`

Hibernate does not discover listeners from the Spring context; register explicitly:

```kotlin
@Component
class FreshnessListenerRegistrar(
    private val emf: EntityManagerFactory,
    private val listener: FreshnessEntityListener
) {
    @PostConstruct
    fun register() {
        val registry = emf.unwrap(SessionFactoryImplementor::class.java)
            .serviceRegistry.getService(EventListenerRegistry::class.java)
        registry.appendListeners(EventType.POST_INSERT, listener)
        registry.appendListeners(EventType.POST_UPDATE, listener)
        registry.appendListeners(EventType.POST_DELETE, listener)
    }
}
```

This is the most framework-deep code in the codebase — give both classes a header comment explaining the event flow (`entity write → flush event → map lookup → courseId resolution → tx-scoped buffer → beforeCommit upsert`) and pin behavior with the unit tests in §5.

---

## 2. Frontend (`lib4gz-fe/`)

### 2.1 Prerequisites

- `npm install idb` (v8; not currently in `package.json`).
- `src/app/services/auth.service.ts` — the cache must be user-scoped, but `AuthService` only persists `user_name`/`user_role` today, while `LoginResponse.user.id` exists:
  - `storeLoginData`: add `localStorage.setItem('user_id', response.user.id)`
  - `logout()`: remove `user_id` and call `courseCache.clearAll()` fire-and-forget (`.catch(() => {})`)
  - **DI direction:** `AuthService` injects `CourseCacheService`; the cache service reads `localStorage.getItem('user_id')` directly (same precedent as AuthService's own localStorage reads) — no cycle.
  - Sessions created before this ships have no `user_id` → cache service passes through to pure network until next login. Safe default, self-heals.

### 2.2 New model — `src/app/shared/models/freshness.model.ts` (+ barrel export in `shared/models/index.ts`)

```ts
export type CacheResourceType = 'SYLLABUS' | 'LESSON' | 'SUMMARY' | 'EXERCISE' | 'SUBMISSION';

export interface LastUpdatesResponse {
  courseId: string;
  lastUpdates: Record<CacheResourceType, number>;
}
```

### 2.3 New service — `src/app/services/course-cache.service.ts` (+ barrel export in `services/index.ts`)

Model the ergonomics on `progress.service.ts`: `providedIn: 'root'`, `inject(HttpClient)`, every storage touch guarded, failures degrade silently.

```ts
const DB_NAME = 'lib4gz-cache';
// Cache-schema version. Bump whenever any cached payload shape changes;
// upgrade() drops and recreates the store => whole-cache eviction on deploy.
const DB_VERSION = 1;
const STORE = 'responses';
const FRESHNESS_TTL_MS = 30_000;

interface CacheEntry<T = unknown> {
  key: string;                 // `${userId}:${courseId}:${resourceType}:${cacheKey}`
  userId: string;
  courseId: string;
  resourceType: CacheResourceType;
  token: number;               // server lastUpdate observed at fetch time (0 = "never bumped")
  data: T;
  cachedAt: number;            // client time — diagnostics only, never used for freshness
}

@Injectable({ providedIn: 'root' })
export class CourseCacheService {
  cachedGet<T>(opts: {
    courseId: string;
    resourceType: CacheResourceType;
    cacheKey: string;
    fetch$: Observable<T>;
  }): Observable<T> { /* … */ }

  bustFreshness(): void {}       // drop the in-memory last-updates memo (all courses)
  clearAll(): Promise<void> {}   // wipe the object store (logout)
}
```

Implementation notes:

- **DB open (lazy, memoized promise):** `openDB(DB_NAME, DB_VERSION, { upgrade(db) { … delete all stores, recreate STORE with keyPath 'key' } })`. This *is* the schema-versioning and eviction story: bump `DB_VERSION` → old entries vanish. No LRU machinery — the working set (a handful of courses × 5 types × per-lesson keys) is far below quota. On `QuotaExceededError` during a write: `clear()` the store and continue (data loss is only a cache miss).
- **Freshness memo (the 30 s TTL):** per-course `Map<courseId, { fetchedAt, tokens$ }>` where `tokens$ = http.get<LastUpdatesResponse>(…/last-updates).pipe(map(r => r.lastUpdates), shareReplay(1))`. `shareReplay` gives in-flight dedup for free: three tabs mounting simultaneously share one HTTP call, and rapid tab switches inside 30 s make **zero** requests. This memo is the only place a client clock appears, and it compares client-time to client-time.
- **`cachedGet` flow:**
  1. `userId = localStorage.getItem('user_id')`; absent → return `opts.fetch$` untouched.
  2. `getTokens(courseId)` → `serverToken = tokens[resourceType] ?? 0`.
  3. Read `CacheEntry` from IDB by key. Entry exists and `entry.token === serverToken` (**strict equality — opaque token; never `<`/`>`, never vs `Date.now()`**) → `of(entry.data as T)`.
  4. Else → `opts.fetch$.pipe(tap(data => void write({ …, token: serverToken, data, cachedAt: Date.now() }).catch(() => {})))`.
  5. Whole pipeline wrapped in `catchError(() => opts.fetch$)` — a `last-updates` failure, IDB unavailable (private browsing), quota error, or corrupt entry all collapse to plain network. **The cache can never break the app.**
- **Race-safety (document in the service header):** tokens are fetched *before* data, so a mutation landing in between stores a token *older* than the cached data — the only possible error direction is one unnecessary refetch later, never serving stale data.
- **Multi-tab:** IDB is shared; the memo is per-tab. Worst case is one extra `last-updates` call per tab per 30 s.

### 2.4 Adoption in domain services (minimal component churn)

Pattern: read methods gain an optional `courseId`; **cache only when `courseId` is provided and (where relevant) no `expand` is used**. Without `courseId`, behavior is byte-identical to today. Callers that must stay uncached (exercise-attempt's `listByLesson({expand:['questions','mySubmission']})`, `getMySubmission`) never pass `courseId` and/or use `expand`, so they bypass automatically.

| File | Change |
|---|---|
| `src/app/services/course.service.ts` | `getSyllabus(id)` → `cachedGet({ courseId: id, resourceType: 'SYLLABUS', cacheKey: 'syllabus', fetch$ })`; `create/update/delete` → `.pipe(tap(() => cache.bustFreshness()))` |
| `src/app/services/lesson.service.ts` | options gain `courseId?: string`; `get(lessonId, opts)` cached when `courseId && !expand?.length`, type `LESSON`, key `lesson:${lessonId}`; `create/update/delete` bust |
| `src/app/services/summary.service.ts` | `get(lessonId, courseId?)` cached when set, type `SUMMARY`, key `summary:${lessonId}`; `createOrUpdate` busts |
| `src/app/services/exercise.service.ts` | `listByLesson` cached when `courseId && !expand`, type `EXERCISE`, key `exercises:${lessonId}`; `create/update/delete` bust |
| `src/app/services/submission.service.ts` | `listByLesson` cached when `courseId` set, type `SUBMISSION`, key `lesson-submissions:${lessonId}:${expand.join(',')}`; `submit/approve/requestRevision/addComment` bust; **`createOrUpdate` (autosave) does NOT bust** — mirrors the backend DRAFT rule |
| `src/app/services/question.service.ts` | mutation methods bust |
| `src/app/services/enrollment.service.ts` | request/approve/reject/update/remove bust |

**Why bust-only invalidation suffices after own mutations:** the backend bump commits in the same transaction as the mutation (via the listener's `beforeCommit` flush), so the server token is already new. The client only needs to forget its ≤30 s memo; the next `cachedGet` re-checks, sees the mismatch, refetches, and overwrites the IDB entry. No targeted IDB deletes, no courseId plumbing into mutators.

### 2.5 Component one-liners (the only component edits)

- `src/app/components/course/course-lesson/course-lesson.component.ts`: `lessonService.get(lessonId, { courseId: this.courseId() })`
- `src/app/components/course/lesson-summary/lesson-summary.component.ts`: pass the injected parent's `courseId()` to `summaryService.get`
- `src/app/components/course/lesson-exercises/lesson-exercises.component.ts`: `listByLesson(lesson.id, { courseId: this.parent.courseId() })`
- `src/app/components/course/lesson-submissions/lesson-submissions.component.ts`: add `courseId` to the existing options object
- `course-layout.component.ts`: **no change** — `getSyllabus(id)` already carries the courseId
- `exercise-attempt.component.ts`: **no change** — its expanded calls stay network-only by design

### 2.6 OpenSpec docs — `documents/network/`

- `api-endpoints.yaml`: add a `freshness` block — `id: freshness.last-updates`, `GET /v1/courses/{courseId}/last-updates`, `auth: true`, response `LastUpdatesResponse`, description covering the 0-bootstrap semantics; service `CourseCacheService` (`src/app/services/course-cache.service.ts`).
- `models.yaml`: add `LastUpdatesResponse`.
- Same PR, fix known drift: document the existing `GET /v1/courses/{id}/syllabus` and `GET /v1/lessons/{id}/submissions` endpoints, and update the `logout` snippet (localStorage keys now include `user_id`).

---

## 3. Edge cases & rollout

| Case | Behavior |
|---|---|
| First load / empty cache | `last-updates` fires, IDB miss → network fetch → entry stored with observed token |
| Pre-ship courses | No stale rows possible (new table). No row → server answers `0`; cache trusted until the first post-ship mutation writes a real timestamp, which forces refetch everywhere |
| Clock skew | Impossible by construction — server tokens compared only by equality to stored server tokens; the 30 s memo is client-clock vs client-clock |
| Backward compat | Endpoint additive; old clients ignore it; `security.json` untouched; no response-shape changes |
| Failure modes | `last-updates` 4xx/5xx, IDB unavailable, quota exceeded, corrupt entry → plain network via `catchError`; listener failures log WARN and never fail the domain write |
| User scoping / logout | Keys embed `userId`; logout wipes the whole DB (shared-machine privacy) and removes `user_id` |
| Lesson visits bump SYLLABUS | `recordVisit` updates the `Enrollment` row, so browsing bumps the course's SYLLABUS token (over-invalidation, never staleness). Cost: an occasional extra syllabus refetch. If it proves noisy, exclude updates whose only dirty properties are `lastVisitedLessonId`/`lastVisitedAt`/`updatedAt` (the `PostUpdateEvent` exposes dirty-property indexes) — a listener-only, 5-line refinement |
| Accepted staleness | Another user's submission won't refresh my cached syllabus `completed` flags until a `SYLLABUS` bump; my own progress is covered by `bustFreshness` + the optimistic `ProgressService` layer |
| Scale hardening (future) | If the freshness row ever becomes a lock hotspot (mass-submit spikes), move the flush from `beforeCommit` to `afterCommit` + debounce — the synchronization point is already the single place to change |

---

## 4. Implementation order

**Backend first (the client is useless without the endpoint):**
1. `courses/model/entity/CourseResourceFreshness.kt` (entity + enum)
2. `courses/repo/CourseResourceFreshnessRepo.kt` (finder + native upsert)
3. `courses/model/payload/FreshnessPayload.kt`
4. `courses/service/FreshnessService.kt` (interface + impl + guard)
5. `courses/controller/FreshnessController.kt`
6. `common/freshness/FreshnessEntityListener.kt` (declarative map + courseId resolution + tx buffer) and `common/freshness/FreshnessListenerRegistrar.kt`
7. Backend tests (§5)

**Frontend:**
8. `npm install idb`
9. `src/app/shared/models/freshness.model.ts` + barrel export
10. `src/app/services/course-cache.service.ts` + barrel export
11. `auth.service.ts`: `user_id` persistence + logout wipe
12. Read-path adoption + mutation busts in the seven services (§2.4)
13. Component one-liners (§2.5)
14. `documents/network/` updates (§2.6)
15. Frontend tests (§5)

No existing backend service file is modified.

---

## 5. Verification

**Manual** (backend `./gradlew bootRun`, frontend `npm run start:local`):
1. Fresh login (so `user_id` lands in localStorage). Open a course → DevTools Network shows `syllabus` + `last-updates`; Application → IndexedDB → `lib4gz-cache/responses` has entries.
2. Open a lesson, switch Summary ↔ Exercises repeatedly: within 30 s of the last check, **zero** network requests; after 30 s, exactly one `last-updates` call and no data calls.
3. Second browser as teacher: edit the lesson summary. Learner browser: after the memo lapses (or reload), tab switch shows `last-updates` + a real `summary` refetch with new content. Verify in `show-sql` output that the summary save produced exactly one freshness upsert (dedupe works).
4. Teacher creates a module/lesson or edits the course title → learner syllabus refetches. Teacher **deletes** a lesson → learner syllabus refetches (soft-delete event path).
5. Teacher Submissions tab: student typing (autosave `POST /exercises/{id}/submissions`) does **not** change `last-updates.SUBMISSION` (DRAFT rule); clicking Submit does → teacher tab refetches. A teacher comment (`addTeacherComment`) also moves the token (StudentAnswer path).
6. Student attempt screen: `exercises?expand=questions,mySubmission` and `my-submission` always hit the network and never appear in IDB.
7. Logout → IndexedDB store empty; a different user on the same browser gets no cross-user cache hits (keys differ anyway).
8. `curl` `last-updates` on an untouched course → all five types `0`.

**Backend unit tests** (plain JUnit 5 + Mockito from `spring-boot-starter-test`, no Spring context — the existing test surface is thin, so keep it lean):
- `courses/service/FreshnessServiceImplTest.kt`: `bump` upserts once per type with `.name`; `getLastUpdates` 0-fills an empty repo, merges existing rows, 404s on missing course, 401s non-enrolled on PRIVATE, allows PUBLIC.
- `common/freshness/FreshnessEntityListenerTest.kt` (pins the map + rules with mocked events): `Lesson` event → `{LESSON, SYLLABUS}`; `Summary` → `{SUMMARY, LESSON, SYLLABUS}`; `Submission(status=DRAFT)` → nothing; `Submission(status=SUBMITTED)` → `{SUBMISSION}`; `StudentAnswer` follows its submission's status; unmapped entity (`User`) → nothing; two events for the same `(courseId, type)` in one tx → one upsert; resolver exception → WARN, no throw.

**Frontend unit tests** (Karma/Jasmine run in real Chrome → real IndexedDB; `provideHttpClientTesting`):
- `src/app/services/course-cache.service.spec.ts`: miss → fetch fires + entry stored; equal-token hit → no data request; changed token → refetch + overwrite; `last-updates` error → falls back to `fetch$`; no `user_id` → passthrough, nothing stored; two `cachedGet` within TTL → one `last-updates` request; `clearAll` empties the store. Use a per-spec unique DB name (make `DB_NAME` overridable) for isolation.

---

## 6. Alternatives considered

- **Derived tokens (no table):** compute `COUNT(*) + MAX(GREATEST(updated_at, deleted_at))` per type at check time. Least code and structurally can't miss an invalidation, but puts O(course size) aggregate work on the hottest path in the system — wrong trade at scale. Kept as a possible *reconciliation auditor* (nightly job recomputing tokens to detect listener drift) rather than the hot path.
- **Hand-written `bump()` calls in each service (plan v1):** ~25 call sites across 8 files with a hand-maintained cross-type matrix; every future mutation is a forgotten-bump risk. Superseded by the listener.
- **Postgres triggers:** bulletproof (covers non-app writes) but unmanageable without migration tooling, hides logic in PL/pgSQL, and can't express the DRAFT rule readably. Right answer only when multiple apps write the DB.
- **HTTP ETag/`If-None-Match` per endpoint:** standard, but per-endpoint conditional handling and always one round trip per resource; the check endpoint amortizes one tiny call across all five types and the 30 s memo drops rapid switches to zero requests.

## 7. Future refinements (out of scope for v1)

- Per-lesson freshness rows (`(lessonId, resourceType)`) if course-wide invalidation proves too coarse in practice.
- Per-user tokens for `SYLLABUS` so enrollment changes only invalidate the affected user.
- Per-user `MY_SUBMISSION` token (bumped by the writer's own DRAFT autosaves) to safely cache the student exercise-attempt screen — considered and declined for v1 (2026-07-04): the attempt screen is where students actively write, so the caching gain is smallest there.
- Dirty-property filter in the listener to stop `recordVisit` from bumping `SYLLABUS`.
- `BroadcastChannel` to share the freshness memo across tabs.
- `afterCommit` + debounced bumps if the freshness row becomes a lock hotspot.
