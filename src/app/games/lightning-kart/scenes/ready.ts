import Phaser from 'phaser';
import { bridgeOf, DealtRace, GameData } from '../bridge';
import { C } from '../engine/constants';
import { hasWebGL, NO_WEBGL, renderMode } from '../render/mode7';
import { trackTexturePasses } from '../render/track-texture';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { buildTrack } from '../track/track-def';
import { RaceStart, ScopeChoice } from './data';
import { SCENE } from './keys';
import { Loading, LoadStep } from './loading';
import { reducedMotion } from './motion';
import { Button, backdrop, button, cornerButton, fit, leaderboard, panel, setupStage, title, wrapText } from './widgets';

const UI = C.ui;
const BOARD_PAD = 16;
const BOARD_TOP = 84;
const BOARD_W = 640;
const BOARD_ROWS = 11; // the top ten and the own row below them
const TITLE_MAX_W = 690; // up to the two corner buttons
const NOTE_W = 320; // left of START

const LOAD_FAILED = 'Something went wrong. Press START to try again.';

/**
 * The scope's leaderboard on a board and Start. START runs the work the race needs behind the
 * loading panel (`loading.ts`): the road, then the server's deal, during which alone Back and
 * Scope work (and cancel it); then it starts the race. `again` (Result's Race again) presses
 * START as the scene opens.
 */
export class ReadyScene extends Phaser.Scene {
  private choice!: ScopeChoice;
  private again = false;
  private table: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private loading: Loading | null = null;
  private starting = false;
  private note: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENE.ready);
  }

  init(data: ScopeChoice & { again?: boolean }): void {
    const { again, ...choice } = data;
    this.choice = choice;
    this.again = !!again;
  }

  create(): void {
    setupStage(this);
    backdrop(this);
    const bridge = bridgeOf(this);
    title(this, UI.pad, UI.pad + 20, this.choice.name.toUpperCase(), { originX: 0, maxWidth: TITLE_MAX_W });
    this.buttons = [
      cornerButton(this, 'Back', () => this.scene.start(SCENE.home)),
      cornerButton(this, 'Scope', () => this.scene.start(SCENE.scope), 1),
    ];
    panel(this, UI.pad - BOARD_PAD, BOARD_TOP, BOARD_W + 2 * BOARD_PAD, BOARD_ROWS * UI.leaderboard.rowH + 2 * BOARD_PAD);
    this.buttons.push(button(this, UI.stage.w / 2, UI.stage.h - UI.pad - UI.button.h / 2, 'START', () => this.startRace()));
    this.loading = null;
    this.starting = false;
    this.note = null;

    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    // A load cut short leaves nothing under the texture's key and gives its canvas back. The
    // game's destroy does not shut the scene down, so it stops the load too.
    const stop = (): void => this.loading?.stop();
    this.events.once(Phaser.Scenes.Events.DESTROY, stop);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      stop();
      this.events.off(Phaser.Scenes.Events.DESTROY, stop);
    });
    this.render(bridge.data);
    if (this.again) this.startRace();
  }

  override update(): void {
    this.loading?.tick();
  }

  /**
   * One load at a time: the road and the deal behind the loading panel, then the Race scene with
   * the dealt race, which lives only in this call. No deal on the canvas renderer (`renderMode`).
   */
  startRace(): void {
    if (this.starting) return;
    this.note?.destroy();
    this.note = null;
    if (renderMode(this) === 'canvas') {
      this.showNote(NO_WEBGL);
      return;
    }
    this.starting = true;
    const controller = new AbortController();
    let dealt: DealtRace | null = null;
    const deal: LoadStep = {
      line: 'Dealing your questions…',
      slices: [say => {
        this.setLeave(true);
        // A server asleep takes a while to wake; the line says so instead of looking stuck.
        const waking = this.time.delayedCall(C.net.wakeMs, () => say('Waking the server up…'));
        return bridgeOf(this).calls.deal(this.choice.scope, C.world.rowsPerLap * C.laps, controller.signal).then(race => {
          waking.remove();
          if (controller.signal.aborted) return; // a load stopped meanwhile: its scene may be gone
          dealt = race;
          this.setLeave(false);
        }, error => {
          waking.remove();
          throw error;
        });
      }],
      cancel: () => controller.abort(),
    };
    const start: LoadStep = { line: 'Starting the engine…', slices: [() => { this.scene.start(SCENE.race, { choice: this.choice, race: dealt! } satisfies RaceStart); }] };
    this.buttons.forEach(b => b.setDisabled(true));
    this.loading = new Loading(this, [...this.roadSteps(), deal, start], reducedMotion(), error => this.loadFailed(error));
  }

  /** The road painted, once per game and track, under the Race scene's key; nothing without WebGL. */
  private roadSteps(): LoadStep[] {
    if (!hasWebGL(this)) return [];
    const track = bridgeOf(this).data.track;
    const { passes, release } = trackTexturePasses(this, `track-${track ?? 'lap'}`, buildTrack(track === 'test' ? TEST_TRACK : LAP));
    return passes.length ? [{ line: 'Painting the track…', slices: passes, cancel: release }] : [];
  }

  /** Back and Scope live, over the loading panel, or dead under it. Either one leaving stops the load, which cancels the deal. */
  private setLeave(live: boolean): void {
    this.buttons.slice(0, 2).forEach(b => b.setDisabled(!live).setDepth(live ? 2 : 0));
  }

  /**
   * A step failed: the panel goes, a line beside START says so (a deal's own text for people,
   * otherwise a fixed line) and the buttons come back, so START tries again from that step.
   */
  private loadFailed(error: unknown): void {
    this.loading?.destroy();
    this.loading = null;
    this.buttons.forEach(b => b.setDisabled(false).setDepth(0));
    this.showNote(typeof error === 'string' && error.trim() ? error : LOAD_FAILED);
    this.starting = false;
  }

  private showNote(text: string): void {
    this.note = fit(wrapText(this, UI.pad, UI.stage.h - UI.pad - UI.button.h / 2, text, NOTE_W, { color: UI.colors.danger, originX: 0 }), UI.ready.note.sizes, UI.ready.note.lines);
  }

  private render(data: GameData): void {
    this.table.forEach(o => o.destroy());
    this.table = leaderboard(this, data, UI.pad, BOARD_TOP + BOARD_PAD + UI.leaderboard.rowH / 2, BOARD_W);
  }
}
