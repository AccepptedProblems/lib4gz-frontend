import { AfterViewInit, Component, DestroyRef, ElementRef, NgZone, OnDestroy, inject, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import Phaser from 'phaser';
import { firstValueFrom, fromEvent, takeUntil, timeout } from 'rxjs';
import { AuthService, MeService, RaceService } from '../../services';
import { RaceAppearance, RaceResultResponse } from '../../shared/models';
import { apiErrorMessage } from '../../shared/utils/api-error';
import { CourseLayoutComponent } from '../../components/course/course-layout/course-layout.component';
import { Bridge, BRIDGE_KEY, DealtRace, FinishedRace, RaceSave, RaceScope } from './bridge';
import { DEFAULT_APPEARANCE } from './look/catalogue';
import { C } from './engine/constants';
import { SCENES } from './scenes/index';

/**
 * The one Angular host of Lightning Kart: a theater band like YouTube's, the full width of
 * the content area, 16:9, its height capped so the page keeps its own background below; the
 * Phaser canvas fits inside it. Every screen of the game is drawn inside the canvas. This
 * component loads data, puts it on the bridge, answers the game's intents and its calls (the
 * deal and the answers); it has no other template and no other DOM.
 */
@Component({
  selector: 'app-lightning-kart',
  template: '<div #stage class="stage"></div>',
  styles: [
    `:host { display: block }`,
    `.stage { position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 80vh; overflow: hidden; background: #1b1038 }`,
    `.stage canvas { touch-action: none; user-select: none }`,
  ],
})
export class LightningKartComponent implements AfterViewInit, OnDestroy {
  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(CourseLayoutComponent);
  private readonly raceService = inject(RaceService);
  private readonly meService = inject(MeService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  private game: Phaser.Game | null = null;
  /** Set by ngOnDestroy; a game whose font finished loading after that is never created. */
  private destroyed = false;
  private bridge!: Bridge;
  /** The scope whose leaderboard was asked for last; an older answer is dropped. */
  private scope: RaceScope | null = null;
  /** Answer calls not yet settled; a finish waits for them. */
  private readonly answers = new Set<Promise<unknown>>();
  /** The race whose finish was sent last; a reply for an older one is dropped. */
  private finishing: string | null = null;
  /** Finishes waiting for answer calls to settle; sent at once if the host goes first. */
  private readonly held = new Set<FinishedRace>();

  ngAfterViewInit(): void {
    const user = this.authService.currentUser();
    this.bridge = new Bridge({
      loading: true,
      error: null,
      questions: [],
      modules: [],
      user: { id: user?.id ?? '', name: user?.name ?? '' },
      look: user?.raceAppearance ?? DEFAULT_APPEARANCE,
      lookError: null,
      leaderboard: null,
      leaderboardError: null,
      save: null,
      debug: pick(this.route.snapshot.queryParamMap.get('debug'), ['top', 'mode7']),
      track: pick(this.route.snapshot.queryParamMap.get('track'), ['lap', 'test']),
    }, {
      deal: (scope, questionCount, signal) => this.zone.run(() => this.deal(scope, questionCount, signal)),
      answer: (raceId, seq, choice) => this.zone.run(() => this.answer(raceId, seq, choice)),
    });
    this.bridge.onIntent('retry', () => this.zone.run(() => this.load()));
    this.bridge.onIntent('scopeChosen', scope => this.zone.run(() => this.loadLeaderboard(scope)));
    this.bridge.onIntent('lookChosen', look => this.zone.run(() => this.saveLook(look)));
    this.bridge.onIntent('finished', race => this.zone.run(() => this.saveResult(race)));

    const ratio = Math.min(window.devicePixelRatio || 1, C.ui.maxPixelRatio);
    const bridge = this.bridge;
    this.zone.runOutsideAngular(() => {
      // The canvas measures text with whatever font is registered when the game boots, so the
      // typeface loads first. A failed load still boots the game, on the fallback stack.
      void loadFont().then(() => {
        if (this.destroyed) return;
        this.game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: this.stage().nativeElement,
          width: Math.round(C.ui.stage.w * ratio),
          height: Math.round(C.ui.stage.h * ratio),
          backgroundColor: C.ui.colors.bg,
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
          // Every power-of-two texture (the track, the props, the vignettes) is created with this
          // filter over the mipmaps Phaser makes when it uploads one; the mode 7 view also sets
          // it on the track's texture itself, which is uploaded once per game.
          render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
          callbacks: { preBoot: game => game.registry.set(BRIDGE_KEY, bridge) },
          scene: SCENES,
        });
      });
    });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // A finish still held for an answer reply goes out now, unwaited and with no one to read
    // its reply: the player who leaves right after the line keeps the time.
    this.held.forEach(race => this.raceService.finishRace(this.layout.courseId(), race.raceId, { finishMs: race.finishMs }).subscribe({ error: () => undefined }));
    this.held.clear();
    this.game?.destroy(true);
    this.game = null;
    this.bridge?.destroy();
  }

  private load(): void {
    this.bridge.set({ loading: true, error: null });
    this.raceService
      .listQuestions(this.layout.courseId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: questions => {
          const modules = this.layout.modulesWithLessons().map(({ module }) => ({ id: module.id, title: module.title }));
          this.bridge.set({ loading: false, questions, modules });
        },
        error: err => this.bridge.set({ loading: false, error: apiErrorMessage(err, 'Could not load the race questions.') }),
      });
  }

  /** `keep` leaves the board on screen while the reload runs (after a finish); otherwise "loading" shows. */
  private loadLeaderboard(scope: RaceScope, keep = false): void {
    this.scope = scope;
    this.bridge.set({ leaderboard: keep ? this.bridge.data.leaderboard : null, leaderboardError: null });
    this.raceService
      .leaderboard(this.layout.courseId(), scope === 'course' ? undefined : scope)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: leaderboard => {
          if (this.scope === scope) this.bridge.set({ leaderboard });
        },
        error: err => {
          if (this.scope === scope) this.bridge.set({ leaderboardError: apiErrorMessage(err, 'Could not load the leaderboard.') });
        },
      });
  }

  /**
   * Deals a new race for `scope`. Rejects with a text for people: the server's own for a 4xx
   * or 503, otherwise a fixed line, also after `C.net.dealMs`; `signal` aborts the call.
   */
  private deal(scope: RaceScope, questionCount: number, signal: AbortSignal): Promise<DealtRace> {
    const call = this.raceService
      .startRace(this.layout.courseId(), { moduleId: scope === 'course' ? null : scope, questionCount })
      .pipe(timeout(C.net.dealMs), takeUntil(fromEvent(signal, 'abort')));
    return firstValueFrom(call).catch(err => Promise.reject(apiErrorMessage(err, 'The race could not start. Check your connection and press START again.')));
  }

  /** One attempt, within `C.net.answerMs`. Rejects on any failure, a 409 included, and on a reply for another question. */
  private answer(raceId: string, seq: number, choice: number | null): Promise<'right' | 'wrong'> {
    const call = firstValueFrom(this.raceService.answerRace(this.layout.courseId(), raceId, { seq, choice }).pipe(timeout(C.net.answerMs)))
      .then(reply => {
        if (reply.seq !== seq) throw new Error(`a reply for question ${reply.seq}, not ${seq}`);
        return reply.correct ? 'right' as const : 'wrong' as const;
      });
    this.answers.add(call);
    const settled = (): void => { this.answers.delete(call); };
    call.then(settled, settled);
    return call;
  }

  /**
   * Sends one finished race once every answer call still out has settled, within
   * `C.net.finishMs`, then reloads that scope's leaderboard so the result screen shows the new
   * row. A 409 is a finish already saved (a retry after a lost reply or a time-out), which has
   * no result to show. A failed save says whether Retry can help: not after a refusal (a 4xx
   * other than the 409), which would fail the same way again.
   */
  private saveResult(race: FinishedRace): void {
    this.finishing = race.raceId;
    this.report(race, { raceId: race.raceId, state: 'saving' });
    this.held.add(race);
    void Promise.allSettled([...this.answers]).then(() => {
      if (!this.held.delete(race)) return; // sent by the destroy
      this.raceService
        .finishRace(this.layout.courseId(), race.raceId, { finishMs: race.finishMs })
        .pipe(timeout(C.net.finishMs), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: result => this.saved(race, result),
          error: err => err instanceof HttpErrorResponse && err.status === 409
            ? this.saved(race, null)
            : this.report(race, { raceId: race.raceId, state: 'failed', error: apiErrorMessage(err, 'Could not save your time.'), retry: !refused(err) }),
        });
    });
  }

  /** The board reloads only while the finished race's scope is still the one shown: a held finish may land after the player picked another. */
  private saved(race: FinishedRace, result: RaceResultResponse | null): void {
    if (this.report(race, { raceId: race.raceId, state: 'saved', result }) && this.scope === race.scope) this.loadLeaderboard(race.scope, true);
  }

  /** Puts `save` on the bridge while `race` is the last one finished; false when it is not. */
  private report(race: FinishedRace, save: RaceSave): boolean {
    if (this.finishing !== race.raceId) return false;
    this.bridge.set({ save });
    return true;
  }

  /** Shows the pick at once, saves it, and puts the old one back if the save fails. */
  private saveLook(look: RaceAppearance): void {
    const before = this.bridge.data.look;
    this.bridge.set({ look, lookError: null });
    this.meService
      .updateMe({ raceAppearance: look })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: user => {
          this.authService.setCurrentUser(user);
          this.bridge.set({ look: user.raceAppearance ?? look });
        },
        error: err => this.bridge.set({ look: before, lookError: apiErrorMessage(err, 'Could not save your look. Please try again.') }),
      });
  }
}

/** Open Sans's subset files in `public/fonts/` and the characters each covers (Fontsource's ranges). */
const READ_SUBSETS: readonly [string, string][] = [
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
  ['vietnamese', 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'],
];

/**
 * Registers the game's typefaces from `public/fonts/`: Oswald, and Open Sans for the question
 * panel. Resolves either way: offline, or in a browser without `FontFace`, the canvas falls back
 * to the rest of `C.ui.font.stack` and `C.ui.read.stack`.
 */
function loadFont(): Promise<void> {
  if (typeof FontFace === 'undefined') return Promise.resolve();
  return Promise.all([
    loadFace(C.ui.font.family, '/fonts/oswald-variable.woff2', { weight: '200 700' }),
    ...READ_SUBSETS.map(([subset, unicodeRange]) =>
      loadFace(C.ui.read.family, `/fonts/open-sans-${subset}.woff2`, { weight: '300 800', unicodeRange })),
  ]).then(() => undefined);
}

function loadFace(family: string, url: string, descriptors: FontFaceDescriptors): Promise<void> {
  let face: FontFace;
  try {
    face = new FontFace(family, `url(${url})`, descriptors);
  } catch {
    return Promise.resolve();
  }
  return face.load().then(
    loaded => { (document.fonts as unknown as Set<FontFace>).add(loaded); }, // `add` is typed in dom.iterable, which tsconfig does not list
    () => undefined,
  );
}

/** A refusal the server worded for people (a 4xx): sending the same again gets the same answer. */
function refused(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500;
}

/** The value when it is one of `allowed`, otherwise null. */
function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}
