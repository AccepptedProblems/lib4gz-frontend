import Phaser from 'phaser';
import { RaceQuestionResponse } from '../../../shared/models';
import { Bridge, BRIDGE_KEY } from '../bridge';
import { C } from '../engine/constants';
import { EngineSound, setEngineSpeed } from '../engine/audio';
import { addCharge, hudState, LOCAL_RACER } from '../engine/race';
import { hasWebGL } from '../render/mode7';
import { pointAt } from '../track/geometry';
import { SCENE } from './keys';
import { RaceScene } from './race';
import { SCENES } from './index';

function question(id: number): RaceQuestionResponse {
  return { id: `rqn_${id}`, courseId: 'crs_1', moduleId: 'mod_1', content: `Q${id}?`, options: ['a', 'b', 'c'], correctIndex: 1, orderIndex: id, createdAt: 0, updatedAt: 0 };
}

function until(check: () => boolean, what: string, timeoutMs = 8000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (check()) resolve();
      else if (Date.now() - started > timeoutMs) reject(new Error(`timed out waiting for ${what}`));
      else setTimeout(tick, 16);
    };
    tick();
  });
}

/** The scene's private state, reached by the spec the way a player's keys would. */
interface Inside {
  phase: 'countdown' | 'racing' | 'done';
  pointerSteer: number;
  touchDrift: boolean;
  doubleBoost: boolean;
  fire(): void;
  openQuestion(q: RaceQuestionResponse): void;
  answer(i: number | null): void;
  setSound(on: boolean): void;
  hum: { ctx: AudioContext } | null;
}

/**
 * The Race scene drawn for real in a WebGL game on the test track: the countdown reaches
 * GO, the kart drives and drifts (skid marks reach the texture), a fired charge boosts and a
 * second fired in the chain window chains, a fire with no charge changes nothing, a wrong
 * answer slows, bump and lap feedback run, and a finish reaches Result. No pixel is
 * asserted; the point is that every feedback path runs without throwing while the view
 * renders. Pending when the test browser has no WebGL.
 */
describe('race scene in WebGL', () => {
  let game: Phaser.Game;
  const errors: unknown[] = [];
  const onError = (e: ErrorEvent): void => { const stack = (e.error as Error | undefined)?.stack ?? e.message; errors.push(stack); console.error('STRAY', stack); };

  beforeAll(() => {
    window.addEventListener('error', onError);
    const bridge = new Bridge({
      loading: false, error: null,
      questions: Array.from({ length: C.minQuestions }, (_, i) => question(i)),
      modules: [{ id: 'mod_1', title: 'One' }],
      user: { id: 'usr_me', name: 'Me' },
      look: { characterId: 'chr_rex', kartId: 'krt_rocket' },
      lookError: null, leaderboard: { rows: [], mine: null }, leaderboardError: null, saveError: null,
      fontFamily: 'sans-serif', debug: null, track: 'test',
    });
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: C.ui.stage.w, height: C.ui.stage.h,
      banner: false, // real audio: the finish is checked with the hum, screech and fanfare running
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, bridge) },
      scene: SCENES,
    });
  });

  afterAll(() => {
    window.removeEventListener('error', onError);
    game.destroy(true);
  });

  /** Waits for the game to boot; false when the browser has no WebGL (the tests then go pending). */
  async function booted(): Promise<boolean> {
    await until(() => game.scene.getScenes(true).length > 0, 'a running scene');
    return hasWebGL(game.scene.getScene(SCENE.home));
  }

  it('counts down, drives, drifts, boosts, chains, slows and finishes', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }

    const bridge = game.registry.get(BRIDGE_KEY) as Bridge;
    game.scene.start(SCENE.race, { scope: 'course', name: 'Course', questions: bridge.data.questions });
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const scene = game.scene.getScene(SCENE.race) as RaceScene;
    const inside = scene as unknown as Inside;
    const race = (scene as unknown as { race: RaceScene['race'] }).race;
    const me = race.racers[0];

    // 3, 2, 1, GO: about four seconds, during which the kart stays put.
    expect(inside.phase).toBe('countdown');
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(me.d).toBe(0);
    await until(() => inside.phase === 'racing', 'GO');

    // Drive straight, then hold right with drift: the kart moves, drifts, and the marks are drawn.
    await until(() => me.d > 5, 'the kart moving');
    inside.pointerSteer = 1;
    inside.touchDrift = true;
    await until(() => me.drifting, 'a drift');
    await new Promise(resolve => setTimeout(resolve, 400));
    inside.pointerSteer = 0;
    inside.touchDrift = false;
    await until(() => !me.drifting, 'the drift ending');

    // A fire with no charge changes nothing.
    inside.fire();
    expect(hudState(race, LOCAL_RACER).effect).toBeNull();

    // Two charges: the first boosts, the second fired in the chain window chains them.
    addCharge(race, LOCAL_RACER);
    addCharge(race, LOCAL_RACER);
    inside.fire();
    expect(hudState(race, LOCAL_RACER).effect?.type).toBe('boost');
    expect(inside.doubleBoost).toBeFalse();
    inside.fire(); // mid-boost: nothing, the charge is kept
    expect(hudState(race, LOCAL_RACER).charges).toBe(1);
    await until(() => hudState(race, LOCAL_RACER).chainWindow, 'the chain window', 8000);
    inside.fire();
    expect(inside.doubleBoost).toBeTrue();
    expect(hudState(race, LOCAL_RACER).effect?.left ?? 0).toBeGreaterThan(C.boost.seconds);

    // A wrong answer slows; bump and lap feedback run.
    inside.openQuestion(question(99));
    inside.answer(0);
    expect(hudState(race, LOCAL_RACER).effect?.type).toBe('boost'); // the boost still shows first
    expect(me.effects.some(e => e.type === 'slow')).toBeTrue();
    scene.handleEvents([{ type: 'bump', racerId: LOCAL_RACER, steep: true }, { type: 'lap', racerId: LOCAL_RACER, lap: 2 }]);
    await new Promise(resolve => setTimeout(resolve, 300));

    scene.handleEvents([{ type: 'finish', racerId: LOCAL_RACER, finishMs: 180000 }]);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    expect(errors).toEqual([]);
  }, 25000);

  /** The finish as it really happens: the engine crosses the line inside `update`, Result draws the board with a row, the Garage draws its portraits. */
  it('finishes from the engine, then draws the board with rows and the garage', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const bridge = game.registry.get(BRIDGE_KEY) as Bridge;
    game.scene.start(SCENE.race, { scope: 'course', name: 'Course', questions: bridge.data.questions });
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const scene = game.scene.getScene(SCENE.race) as RaceScene;
    const inside = scene as unknown as Inside;
    const race = (scene as unknown as { race: RaceScene['race'] }).race;
    const me = race.racers[0];
    await until(() => inside.phase === 'racing', 'GO');

    // Sound on, as a player would have it, with a long race's worth of engine pitch updates behind it.
    // (The finish with sound on once relabelled the Sound button during shutdown and froze the game.)
    inside.setSound(true);
    expect(inside.hum).not.toBeNull();
    for (let i = 0; i < 12000; i++) setEngineSpeed(inside.hum as EngineSound, 0.5 + (i % 100) / 100);
    inside.pointerSteer = 1;
    inside.touchDrift = true;
    await until(() => me.drifting, 'a drift with the screech');
    inside.pointerSteer = 0;
    inside.touchDrift = false;
    await until(() => !me.drifting, 'the drift ending');

    // Last lap, every checkpoint passed, a few units before the line on the finish straight.
    const track = race.built.track;
    Object.assign(me, pointAt(track, track.length - 4), { d: track.length - 4, heading: 0, nextCheckpoint: race.built.checkpoints.length, lap: C.laps });
    addCharge(race, LOCAL_RACER);
    inside.fire(); // cross the line boosted, flame and all
    await until(() => game.scene.isActive(SCENE.result), 'Result after the line');

    const row = { userId: 'usr_me', username: 'me', name: 'Me', appearance: bridge.data.look, finishMs: 180000, correctCount: 3, wrongCount: 1, createdAt: 0 };
    bridge.set({ leaderboard: { rows: [row, { ...row, userId: 'usr_2', name: 'Other', appearance: null }], mine: row } });
    await new Promise(resolve => setTimeout(resolve, 500));

    game.scene.start(SCENE.garage);
    await until(() => game.scene.isActive(SCENE.garage), 'Garage');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(errors).toEqual([]);
  }, 25000);
});
