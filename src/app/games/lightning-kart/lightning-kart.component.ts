import { AfterViewInit, Component, DestroyRef, ElementRef, NgZone, OnDestroy, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import Phaser from 'phaser';
import { AuthService, MeService, RaceService } from '../../services';
import { RaceAppearance } from '../../shared/models';
import { apiErrorMessage } from '../../shared/utils/api-error';
import { CourseLayoutComponent } from '../../components/course/course-layout/course-layout.component';
import { Bridge, BRIDGE_KEY, FinishedRace, RaceScope } from './bridge';
import { DEFAULT_APPEARANCE } from './catalogue';
import { C } from './engine/constants';
import { SCENES } from './scenes/index';

/**
 * The one Angular host of Lightning Kart: a theater band like YouTube's, the full width of
 * the content area, 16:9, its height capped so the page keeps its own background below; the
 * Phaser canvas fits inside it. Every screen of the game is drawn inside the canvas. This
 * component loads data, puts it on the bridge, and answers the game's intents; it has no
 * other template and no other DOM.
 */
@Component({
  selector: 'app-lightning-kart',
  template: '<div #stage class="stage"></div>',
  styles: [
    `:host { display: block }`,
    `.stage { position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 80vh; overflow: hidden; background: #161a24 }`,
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
  private bridge!: Bridge;
  /** The scope whose leaderboard was asked for last; an older answer is dropped. */
  private scope: RaceScope | null = null;

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
      saveError: null,
      fontFamily: getComputedStyle(document.body).fontFamily,
      debug: pick(this.route.snapshot.queryParamMap.get('debug'), ['top', 'mode7']),
      track: pick(this.route.snapshot.queryParamMap.get('track'), ['lap', 'test']),
    });
    this.bridge.onIntent('retry', () => this.zone.run(() => this.load()));
    this.bridge.onIntent('scopeChosen', scope => this.zone.run(() => this.loadLeaderboard(scope)));
    this.bridge.onIntent('lookChosen', look => this.zone.run(() => this.saveLook(look)));
    this.bridge.onIntent('finished', race => this.zone.run(() => this.saveResult(race)));

    const ratio = Math.min(window.devicePixelRatio || 1, C.ui.maxPixelRatio);
    const bridge = this.bridge;
    this.zone.runOutsideAngular(() => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: this.stage().nativeElement,
        width: Math.round(C.ui.stage.w * ratio),
        height: Math.round(C.ui.stage.h * ratio),
        backgroundColor: C.ui.colors.bg,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
        callbacks: { preBoot: game => game.registry.set(BRIDGE_KEY, bridge) },
        scene: SCENES,
      });
    });

    this.load();
  }

  ngOnDestroy(): void {
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

  /** Posts one finished race, then reloads that scope's leaderboard so the result screen shows the new row. */
  private saveResult(race: FinishedRace): void {
    this.bridge.set({ saveError: null });
    this.raceService
      .saveResult(this.layout.courseId(), {
        moduleId: race.scope === 'course' ? null : race.scope,
        finishMs: race.finishMs,
        correctCount: race.correctCount,
        wrongCount: race.wrongCount,
        seed: race.seed,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadLeaderboard(race.scope, true),
        error: err => this.bridge.set({ saveError: apiErrorMessage(err, 'Could not save your time.') }),
      });
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

/** The value when it is one of `allowed`, otherwise null. */
function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}
