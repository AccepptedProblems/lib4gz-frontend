import Phaser from 'phaser';
import { Bridge, BRIDGE_KEY, DealtRace, FinishedRace, RaceQuestion } from '../bridge';
import { C } from '../engine/constants';
import { EngineSound, setEngineSpeed } from '../engine/audio';
import { placeKart } from '../engine/kart';
import { applyBoost, LOCAL_RACER } from '../engine/race';
import { hasWebGL } from '../render/mode7';
import { Character } from '../look/catalogue';
import { racerHead } from '../look/splash';
import { AnswerChecker } from './answer-checker';
import { Crackle } from './crackle';
import { SHOUT_GROWN } from './fx';
import { DEPTH } from './depth';
import { SCENE } from './keys';
import { RaceScene } from './race';
import { SCENES } from './index';
import { SpecClock } from '../testing/spec-clock';
import { card as question, dealtRace, fakeCalls, keyChecker, RIGHT } from '../testing/fake-calls';

const WRONG = 0;

/** Right at `RIGHT`, or at a question's own `right` where the spec gives one. */
const SPEC_CHECKER = keyChecker(q => (q as { right?: number }).right ?? RIGHT);

/** The game steps on game time; see `SpecClock`. */
const clock = new SpecClock();
const { step, until, play } = clock;

/** Lets the checker's promise settle without stepping the game, so a verdict lands on the race time of the answer. */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** Race time from a verdict to the landing of Splash's throw: the bubble's pop starts the trap, the bottle's catch the boost. */
const POP_MS = C.splash.slideInMs + C.splash.aimMs + C.splash.flightMs;
const CATCH_MS = C.splash.slideInMs + C.splash.windUpMs + C.splash.throwMs;

type Race = RaceScene['race'];
const has = (race: Race, type: string): boolean => race.racers[0].effects.some(e => e.type === type);
const boosted = (race: Race): string | null => {
  const boost = race.racers[0].effects.find(e => e.type === 'boost');
  return boost ? (boost.mul === C.boost.doubleMul ? 'double' : 'boost') : null;
};

interface Frame { ms: number; wrong: number; trapped: boolean; boost: string | null }

/** After every frame of the Race scene, its race time, its wrong answers, whether the kart is trapped and which boost runs; `stop` ends the sampling. */
function watchFrames(scene: RaceScene): { frames: Frame[]; stop(): void } {
  const frames: Frame[] = [];
  const { race } = scene as unknown as { race: Race };
  const sample = (): void => {
    const { wrongCount } = scene as unknown as { wrongCount: number };
    frames.push({ ms: race.elapsedMs, wrong: wrongCount, trapped: has(race, 'trap'), boost: boosted(race) });
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sample);
  return { frames, stop: () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sample) };
}

/** `landed` first holds on the first frame at or past race time `atMs`, after several frames where it did not. */
function expectLandingAt(frames: Frame[], landed: (f: Frame) => boolean, atMs: number): void {
  const first = frames.findIndex(landed);
  expect(first).toBeGreaterThan(2);
  expect(frames[first].ms).toBeGreaterThanOrEqual(atMs);
  expect(frames[first - 1].ms).toBeLessThan(atMs);
}

/** Splash's run while one is on: her graphics and the throw's, and whether it has landed. */
type SplashRun = {
  throw: { kind: 'bubble' | 'bottle' } | null; leaveMs: number | null; hit: boolean; from: { x: number; y: number } | null;
  her: Phaser.GameObjects.Graphics; shot: Phaser.GameObjects.Graphics; say: { text: Phaser.GameObjects.Text; g: Phaser.GameObjects.Graphics } | null;
} | null;

/** The scene's private state, reached by the spec the way a player's keys would. */
interface Inside {
  phase: 'countdown' | 'racing' | 'done';
  pointerSteer: number;
  correctCount: number;
  wrongCount: number;
  openQuestion(q: RaceQuestion): void;
  answer(i: number | null): void;
  landed(right: boolean, kind: string): void;
  splash: { run: SplashRun };
  setSound(on: boolean): void;
  hum: { ctx: AudioContext } | null;
  streak: { count: number; best: number };
  badge: { shown: boolean; shatter(): void };
  boxes: Phaser.GameObjects.Rectangle[];
  panel: {
    open: { ring: unknown; cards: Phaser.GameObjects.Container[]; countdown: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics } | null;
    locked: boolean; question: RaceQuestion | null; show(q: RaceQuestion, nowMs: number): void;
  };
  fx: { jolt: { lurch: number }; shout(text: string, colour: string): void };
}

/** The polylines a Graphics holds, read back from its command buffer (line styles, paths, moves and lines only). */
function polylines(g: Phaser.GameObjects.Graphics): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  const b = g.commandBuffer as number[];
  for (let i = 0; i < b.length;) {
    const code = b[i];
    if (code === 6) i += 4; // LINE_STYLE width colour alpha
    else if (code === 1) { out.push([]); i += 1; } // BEGIN_PATH
    else if (code === 4 || code === 5) { out[out.length - 1].push({ x: b[i + 1], y: b[i + 2] }); i += 3; } // LINE_TO, MOVE_TO
    else if (code === 9 || code === 2) i += 1; // STROKE_PATH, CLOSE_PATH
    else throw new Error(`command ${code} not expected in the crackle`);
  }
  return out;
}

/**
 * A Graphics' drawing with every point and arc centre taken relative to its first point, so a
 * drawing that only slid comes out the same: styles, moves, lines, arcs and the path commands.
 */
function shape(g: Phaser.GameObjects.Graphics): string {
  const b = g.commandBuffer as (number | boolean)[];
  const out: (number | boolean | string)[] = [];
  let origin: { x: number; y: number } | null = null;
  const at = (x: number, y: number): string => {
    origin ??= { x, y };
    return `${(x - origin.x).toFixed(3)},${(y - origin.y).toFixed(3)}`;
  };
  for (let i = 0; i < b.length;) {
    const code = b[i] as number;
    if (code === 7) { out.push(...b.slice(i, i + 3)); i += 3; } // FILL_STYLE colour alpha
    else if (code === 6) { out.push(...b.slice(i, i + 4)); i += 4; } // LINE_STYLE width colour alpha
    else if (code === 4 || code === 5) { out.push(code, at(b[i + 1] as number, b[i + 2] as number)); i += 3; } // LINE_TO, MOVE_TO
    else if (code === 0) { out.push(code, at(b[i + 1] as number, b[i + 2] as number), ...b.slice(i + 3, i + 8)); i += 8; } // ARC x y r start end anticlockwise overshoot
    else if (code === 1 || code === 2 || code === 8 || code === 9) { out.push(code); i += 1; } // BEGIN, CLOSE, FILL, STROKE
    else throw new Error(`command ${code} not expected`);
  }
  return JSON.stringify(out);
}

type Asked = { raceId: string; question: RaceQuestion; index: number | null; reply(v: 'right' | 'wrong'): void };

/** A checker whose verdicts the spec gives by hand, as a slow server would; every attempt, a resend included, is one `asked`. */
function lateChecker(): AnswerChecker & { asked: Asked[] } {
  const asked: Asked[] = [];
  return { asked, check: (raceId, question, index) => new Promise<'right' | 'wrong'>(reply => asked.push({ raceId, question, index, reply })) };
}

/**
 * The Race scene drawn for real in a WebGL game on the test track: the countdown reaches GO,
 * the kart drives and slides to the road edge, a right answer's boost and a wrong answer's
 * trap land with Splash's throw on race time after the checker's verdict, a right answer
 * caught during a boost is a Double Boost, lap feedback runs, and a finish reaches Result. No
 * pixel is asserted; the point is that every feedback path runs without throwing while the
 * view renders. Pending when the test browser has no WebGL.
 */
describe('race scene in WebGL', () => {
  let game: Phaser.Game;
  let errors: unknown[] = [];
  const onError = (e: ErrorEvent): void => { const stack = (e.error as Error | undefined)?.stack ?? e.message; errors.push(stack); console.error('STRAY', stack); };

  // A game per spec: a spec that Jasmine abandons on its timeout stops at its next wait once
  // its game is destroyed here (see SpecClock), and the next spec starts clean.
  beforeEach(() => {
    errors = [];
    window.addEventListener('error', onError);
    const bridge = new Bridge({
      loading: false, error: null,
      questions: [], // the bank feeds Scope only
      modules: [{ id: 'mod_1', title: 'One' }],
      user: { id: 'usr_me', name: 'Me' },
      look: { characterId: 'chr_rex', kartId: 'krt_rocket' },
      lookError: null, leaderboard: { rows: [], mine: null }, leaderboardError: null, save: null,
      debug: null, track: 'test',
    }, fakeCalls());
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: C.ui.stage.w, height: C.ui.stage.h,
      banner: false, // real audio: the finish is checked with the hum and fanfare running
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, bridge) },
      scene: SCENES,
    });
  });

  afterEach(async () => {
    window.removeEventListener('error', onError);
    await clock.destroy(game);
  });

  /** Waits for the game to boot and takes over its loop; false when the browser has no WebGL (the tests then go pending). */
  async function booted(): Promise<boolean> {
    await clock.take(game);
    await until(() => game.scene.getScenes(true).length > 0, 'a running scene');
    return hasWebGL(game.scene.getScene(SCENE.home));
  }

  /** Starts `key` with every other scene stopped, as the game's own `this.scene.start` does; `game.scene.start` alone leaves Home, Result or Garage drawing under it. */
  function show(key: string, data?: object): void {
    for (const s of game.scene.getScenes(true)) if (s.scene.key !== key) game.scene.stop(s.scene.key);
    game.scene.start(key, data);
  }

  /** Starts `dealt` as Ready does, with `checker` deciding its answers; `card` is its first question. */
  async function startRace(checker: AnswerChecker = SPEC_CHECKER, dealt: DealtRace = dealtRace('rce_spec', C.minQuestions)): Promise<{ scene: RaceScene; inside: Inside; race: Race; card: RaceQuestion }> {
    show(SCENE.race, { choice: { scope: 'course', name: 'Course', count: dealt.questions.length, checker }, race: dealt });
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const scene = game.scene.getScene(SCENE.race) as RaceScene;
    const race = (scene as unknown as { race: Race }).race;
    return { scene, inside: scene as unknown as Inside, race, card: dealt.questions[0] };
  }

  /** A mouse press or release at stage point `x`, `y`, then a frame. */
  async function mouse(type: 'mousedown' | 'mouseup', x: number, y: number): Promise<void> {
    const r = game.canvas.getBoundingClientRect();
    game.canvas.dispatchEvent(new MouseEvent(type, { clientX: r.left + (x * r.width) / C.ui.stage.w, clientY: r.top + (y * r.height) / C.ui.stage.h, button: 0, bubbles: true }));
    await step();
  }

  /** A fresh key press or release of `keyCode`, then a frame. */
  async function key(type: 'keydown' | 'keyup', keyCode: number): Promise<void> {
    const event = new KeyboardEvent(type, { bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
    window.dispatchEvent(event);
    await step();
  }

  it('counts down, drives, slides to the edge, boosts, doubles, traps and finishes', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside, race, card } = await startRace();
    const me = race.racers[0];

    // 3, 2, 1, GO: about four seconds, during which the kart stays put.
    expect(inside.phase).toBe('countdown');
    await play(500);
    expect(me.d).toBe(0);
    await until(() => inside.phase === 'racing', 'GO');

    // Drive, then hold the right half: the kart slides to the road edge and stays on it.
    await until(() => me.d > 5, 'the kart moving');
    // The sharp wall and stripe are drawn every racing frame, under the boxes, the props and the kart.
    {
      const overlay = (scene as unknown as { roadOverlay: { graphics: Phaser.GameObjects.Graphics } }).roadOverlay.graphics;
      const { kartObj } = scene as unknown as { kartObj: Phaser.GameObjects.Container };
      expect(overlay.commandBuffer.length).toBeGreaterThan(0);
      expect(overlay.depth).toBeLessThan(Math.min(DEPTH.world, kartObj.depth, ...inside.boxes.map(b => b.depth)));
      const drawnAt = JSON.stringify(overlay.commandBuffer);
      await play(300);
      expect(JSON.stringify(overlay.commandBuffer)).not.toBe(drawnAt); // redrawn as the camera moves on
    }
    inside.pointerSteer = 1;
    const edge = C.world.roadWidth / 2 - C.kart.width / 2;
    await until(() => me.offset === edge, 'the road edge');
    await play(300);
    expect(me.offset).toBe(edge);
    inside.pointerSteer = 0;

    // Two right answers back to back: the second's press lands the first bottle at once, a
    // boost, so its verdict comes while one runs and its own bottle gives a Double Boost.
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await settle();
    expect(boosted(race)).toBeNull();
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await settle();
    expect(boosted(race)).toBe('boost');
    await until(() => boosted(race) === 'double', 'the second bottle landing');

    // A wrong answer on a dealt card: it joins the missed list, and the kart
    // is trapped only when Splash's bubble pops, POP_MS of race time after the verdict. The trap
    // ends the boost and the kart stops dead. Then she is gone.
    const wrong = WRONG;
    inside.openQuestion(card);
    const watch = watchFrames(scene);
    const answeredMs = race.elapsedMs;
    inside.answer(wrong);
    await settle();
    expect((scene as unknown as { missed: RaceQuestion[] }).missed).toContain(card);
    expect(has(race, 'trap')).toBeFalse();
    const run = inside.splash.run!;
    expect(run).not.toBeNull();
    expect(run.say).toBeNull(); // she says her line only with the bottle
    await until(() => has(race, 'trap'), 'the pop');
    watch.stop();
    expectLandingAt(watch.frames, f => f.trapped, answeredMs + POP_MS);
    expect(watch.frames[watch.frames.length - 2].boost).toBe('double'); // the boost ran to the pop
    expect(boosted(race)).toBeNull();
    expect(me.speed).toBe(0);
    const stoppedAt = me.d;
    await play(300);
    expect(me.d).toBe(stoppedAt);
    await until(() => inside.splash.run === null, 'Splash leaving');
    expect(scene.children.exists(run.her)).toBeFalse();
    expect(scene.children.exists(run.shot)).toBeFalse();

    // Released, it starts again from zero: one step of acceleration in the frame the trap ends.
    await until(() => !has(race, 'trap'), 'the trap ending');
    expect(me.speed).toBeGreaterThan(0);
    expect(me.speed).toBeLessThanOrEqual((C.kart.accel * clock.stepMs) / 1000 + 1e-9);

    // Two wrong answers 100 ms of race time apart: the second lands the first pop at once,
    // trapping the kart there and then, and starts a new run whose own pop lands later.
    spyOn(inside, 'landed').and.callThrough();
    inside.openQuestion(card);
    inside.answer(wrong);
    await settle();
    const firstRun = inside.splash.run!;
    const firstMs = race.elapsedMs;
    await until(() => race.elapsedMs >= firstMs + 100, '100 ms of race time');
    expect(inside.landed).not.toHaveBeenCalled();
    inside.openQuestion(card);
    inside.answer(wrong);
    await settle();
    expect(inside.landed).toHaveBeenCalledOnceWith(false, 'boost');
    expect(me.effects.find(e => e.type === 'trap')?.left).toBe(C.trap.seconds);
    expect(inside.splash.run).not.toBe(firstRun);
    expect(scene.children.exists(firstRun.her)).toBeFalse();
    await until(() => (inside.landed as jasmine.Spy).calls.count() === 2, 'the second pop');

    // Lap feedback runs.
    scene.handleEvents([{ type: 'lap', racerId: LOCAL_RACER, lap: 2 }]);
    await play(300);

    scene.handleEvents([{ type: 'finish', racerId: LOCAL_RACER, finishMs: 180000 }]);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    expect(errors).toEqual([]);
  }, 25000);

  it('waits for the verdict: the press locks, the effect is judged after the verdict, a late one after the race or the scene does nothing', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    let checker = lateChecker();
    let { scene, inside, race, card } = await startRace(checker);
    await until(() => inside.phase === 'racing', 'GO');
    const wrong = WRONG;
    const last = (): Asked => checker.asked[checker.asked.length - 1];

    // The press locks the card and stops the countdown: nothing more happens while the verdict
    // is out, up to the resend; a second press and a box driven through change nothing.
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await settle();
    expect(checker.asked.map(a => [a.raceId, a.question.seq, a.index])).toEqual([['rce_spec', card.seq, RIGHT]]);
    expect(inside.panel.locked).toBeTrue();
    expect(inside.panel.open!.cards.map(c => c.alpha)).toEqual(card.options.map((_, i) => (i === RIGHT ? 1 : C.ui.cards.lockedAlpha)));
    const frozen = (): string[] => [inside.panel.open!.countdown.text, JSON.stringify(inside.panel.open!.bar.commandBuffer)];
    const atPress = frozen();
    await play(C.answer.resendMs - 300);
    expect(frozen()).toEqual(atPress); // the seconds and the bar stand still
    inside.answer(wrong);
    scene.handleEvents([{ type: 'item', kind: 'question', racerId: LOCAL_RACER }]);
    await settle();
    expect(checker.asked.length).toBe(1);
    expect(inside.panel.question).toBe(card);
    expect([inside.correctCount, inside.wrongCount, inside.streak.count]).toEqual([0, 0, 0]);
    // Splash came at the press and waits, empty-handed, for the verdict.
    expect(inside.splash.run).not.toBeNull();
    expect(inside.splash.run!.throw).toBeNull();
    expect(inside.splash.run!.her.visible).toBeTrue();

    // No boost ran at the press; one runs when the verdict comes: the bottle that follows the
    // verdict lands during it, so it is a Double Boost.
    expect(boosted(race)).toBeNull();
    applyBoost(race, LOCAL_RACER);
    last().reply('right');
    await settle();
    expect(inside.panel.question).toBeNull();
    expect([inside.correctCount, inside.streak.count]).toEqual([1, 1]);
    expect(inside.splash.run?.throw?.kind).toBe('bottle');
    expect(inside.splash.run?.say?.text.text).toBe('Nhớ uống nước nha'); // her line on a bottle throw
    const watch = watchFrames(scene);
    const verdictMs = race.elapsedMs;
    await until(() => inside.splash.run!.hit, 'the bottle landing');
    watch.stop();
    // her speech bubble is on screen with its line as the bottle lands
    expect([inside.splash.run!.say!.text.visible, inside.splash.run!.say!.g.visible]).toEqual([true, true]);
    expect(inside.splash.run!.say!.g.commandBuffer.length).toBeGreaterThan(0);
    // She came at the press and is long there: she throws at the verdict, so the bottle lands
    // a wind-up and a throw after it.
    expectLandingAt(watch.frames, f => f.boost === 'double', verdictMs + C.splash.windUpMs + C.splash.throwMs);

    // A boost with 0.3 s left at the verdict ends before the bottle lands, about two thirds of a
    // second later: what ran at the verdict decides, so the bottle still gives a Double Boost.
    await until(() => inside.splash.run === null, 'Splash leaving');
    applyBoost(race, LOCAL_RACER, 'boost');
    race.racers[0].effects.find(e => e.type === 'boost')!.left = 0.3;
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await settle();
    last().reply('right');
    await settle();
    await until(() => boosted(race) === null, 'the short boost ending');
    await until(() => inside.splash.run!.hit, 'the bottle landing');
    expect(boosted(race)).toBe('double');

    // A Double Boost ran at the press and has ended by the verdict, inside the resend: a plain boost.
    race.racers[0].effects.find(e => e.type === 'boost')!.left = 0.4;
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await until(() => boosted(race) === null, 'the Double Boost ending');
    last().reply('right');
    await settle();
    await until(() => inside.splash.run!.hit, 'the bottle landing');
    expect(boosted(race)).toBe('boost');
    await until(() => inside.splash.run === null, 'Splash leaving');

    // A timeout goes through the checker too, as `null`, and its wrong verdict traps the kart.
    const q = question(91);
    inside.panel.show(q, race.elapsedMs - C.questionCountdownS * 1000); // runs out on the next frame
    await step();
    await settle();
    expect(last().question).toBe(q);
    expect(last().index).toBeNull();
    expect(inside.panel.locked).toBeTrue();
    expect(inside.panel.open!.cards.every(c => c.alpha === C.ui.cards.lockedAlpha)).toBeTrue();
    last().reply('wrong');
    await settle();
    expect([inside.wrongCount, inside.streak.count]).toEqual([1, 0]);
    await until(() => has(race, 'trap'), 'the bubble after a timeout');

    // A verdict that comes after the finish does nothing, even one that lands before Result
    // takes over: the finish closed the question, so nothing joins the missed list Result shares.
    inside.openQuestion(card);
    inside.answer(WRONG);
    await settle();
    scene.handleEvents([{ type: 'finish', racerId: LOCAL_RACER, finishMs: 180000 }]);
    const runAtFinish = inside.splash.run;
    last().reply('wrong');
    await settle();
    expect([inside.correctCount, inside.wrongCount]).toEqual([3, 1]);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    const result = game.scene.getScene(SCENE.result) as unknown as { outcome: { correctCount: number; wrongCount: number; missed: RaceQuestion[] } };
    expect([result.outcome.correctCount, result.outcome.wrongCount]).toEqual([3, 1]);
    expect(result.outcome.missed).toEqual([q]); // the timeout alone
    await play(1000);
    expect(inside.wrongCount).toBe(1);
    expect(inside.splash.run).toBe(runAtFinish);

    // One that comes after the scene shut down mid-race does nothing either.
    checker = lateChecker();
    ({ scene, inside, race, card } = await startRace(checker));
    inside.openQuestion(card);
    inside.answer(wrong);
    await settle();
    scene.quit();
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    checker.asked[0].reply('wrong');
    await settle();
    await play(300);
    expect([inside.wrongCount, inside.streak.count]).toEqual([0, 0]);
    expect(inside.splash.run?.throw ?? null).toBeNull(); // nothing was thrown for it

    // Nor one for race A that comes while race B, started with the same checker, has a question
    // open: B's question stays open, unanswered and unlocked, and B's own verdict still counts.
    ({ scene, inside, race, card } = await startRace(checker));
    inside.openQuestion(card);
    inside.answer(wrong);
    await settle();
    const raceA = checker.asked[1];
    scene.quit();
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    ({ scene, inside, race, card } = await startRace(checker));
    inside.openQuestion(card);
    raceA.reply('wrong');
    await settle();
    await step();
    expect(inside.panel.question).toBe(card);
    expect(inside.panel.locked).toBeFalse();
    expect([inside.correctCount, inside.wrongCount, inside.streak.count]).toEqual([0, 0, 0]);
    inside.answer(RIGHT);
    await settle();
    checker.asked[2].reply('right');
    await settle();
    expect([inside.correctCount, inside.panel.question]).toEqual([1, null]);
    expect(errors).toEqual([]);
  }, 40000);

  it('asks again once at the resend and voids at the void time, both on race time; the first reply wins, a late one does nothing, the next box opens the next deck position', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const checker = lateChecker();
    const { scene, inside, race } = await startRace(checker);
    await until(() => inside.phase === 'racing', 'GO');
    const box = (): void => scene.handleEvents([{ type: 'item', kind: 'question', racerId: LOCAL_RACER }]);
    const deck = (scene as unknown as { questions: RaceQuestion[] }).questions;
    const checking = (): boolean => !!(inside.panel.open as unknown as { checking: unknown } | null)?.checking;

    // One right answer first, its reply quick: no sign of checking at all; its boost runs out:
    // the streak stands at one.
    box();
    expect(inside.panel.question).toBe(deck[0]);
    inside.answer(RIGHT);
    await settle();
    await play(C.answer.checkingMs - 2 * clock.stepMs);
    expect(checking()).toBeFalse();
    checker.asked[0].reply('right');
    await settle();
    await until(() => inside.splash.run === null && boosted(race) === null, 'the boost over', 8000);

    // No reply: the same answer goes again once, at the resend time of race time.
    box();
    expect(inside.panel.question).toBe(deck[1]);
    const pressedMs = race.elapsedMs;
    inside.answer(WRONG);
    await settle();
    expect(checker.asked.length).toBe(2);
    // No verdict yet: after the checking time, and not before, the board says it is checking.
    await until(() => race.elapsedMs - pressedMs >= C.answer.checkingMs - clock.stepMs, 'just before the checking time');
    expect(checking()).toBeFalse();
    await until(checking, 'the checking sign');
    expect(race.elapsedMs - pressedMs).toBeGreaterThanOrEqual(C.answer.checkingMs);
    const tag = (inside.panel.open as unknown as { checking: Phaser.GameObjects.Container }).checking;
    expect(tag.list.filter((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text).map(t => t.text)).toEqual(['Checking…']);
    await until(() => checker.asked.length === 3, 'the resend');
    expect(race.elapsedMs - pressedMs).toBeGreaterThanOrEqual(C.answer.resendMs);
    expect(race.elapsedMs - pressedMs).toBeLessThan(C.answer.resendMs + clock.stepMs);
    expect([checker.asked[2].question, checker.asked[2].index]).toEqual([deck[1], WRONG]);
    expect(inside.panel.locked).toBeTrue();

    // Still none: void at the void time. No buff, no debuff, the counts and the streak
    // untouched, Splash gone with nothing thrown; and no third attempt.
    const watch = watchFrames(scene);
    await until(() => inside.panel.question === null, 'the void');
    expect(race.elapsedMs - pressedMs).toBeGreaterThanOrEqual(C.answer.voidMs);
    expect(race.elapsedMs - pressedMs).toBeLessThan(C.answer.voidMs + clock.stepMs);
    expect(checker.asked.length).toBe(3);
    expect([inside.correctCount, inside.wrongCount, inside.streak.count]).toEqual([1, 0, 1]);
    expect(inside.splash.run?.throw ?? null).toBeNull();
    expect((scene as unknown as { missed: RaceQuestion[] }).missed).toEqual([]); // a void is not missed
    expect(checking()).toBeFalse(); // gone with the question
    // A reply after the void, to either attempt, does nothing.
    checker.asked[2].reply('wrong');
    checker.asked[1].reply('wrong');
    await settle();
    await play(POP_MS + 300);
    watch.stop();
    expect(watch.frames.some(f => f.trapped || f.boost !== null)).toBeFalse();
    expect([inside.correctCount, inside.wrongCount, inside.streak.count]).toEqual([1, 0, 1]);
    expect(inside.splash.run).toBeNull();

    // The next box opens the next deck position: the voided one is never asked again.
    box();
    expect(inside.panel.question).toBe(deck[2]);

    // Two replies, the resend's first: it wins, and the first attempt's later one does nothing.
    inside.answer(RIGHT);
    await settle();
    await until(() => checker.asked.length === 5, 'the resend');
    expect(checking()).toBeTrue();
    checker.asked[4].reply('right');
    await settle();
    expect(checking()).toBeFalse(); // gone at the verdict
    expect([inside.correctCount, inside.wrongCount, inside.streak.count]).toEqual([2, 0, 2]);
    expect(inside.panel.question).toBeNull();
    checker.asked[3].reply('wrong');
    await settle();
    await play(POP_MS + 300);
    expect([inside.correctCount, inside.wrongCount, inside.streak.count]).toEqual([2, 0, 2]);
    expect(has(race, 'trap')).toBeFalse();
    expect(errors).toEqual([]);
  }, 40000);

  it('asks the dealt questions in the server\'s order with their options as dealt, and none once they run out', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const checker = lateChecker();
    const dealt: DealtRace = { raceId: 'rce_short', questions: [
      { seq: 0, content: 'First?', options: ['d', 'c', 'b', 'a'] },
      { seq: 1, content: 'Second?', options: ['only'] },
    ] };
    const { scene, inside, race } = await startRace(checker, dealt);
    await until(() => inside.phase === 'racing', 'GO');
    const box = (): void => scene.handleEvents([{ type: 'item', kind: 'question', racerId: LOCAL_RACER }]);
    const captions = (): string[] => inside.panel.open!.cards.map(c => (c.list[1] as Phaser.GameObjects.Text).text);

    box();
    expect(inside.panel.question).toBe(dealt.questions[0]);
    expect(captions()).toEqual(['d', 'c', 'b', 'a']);
    inside.answer(2); // the third card as shown
    await settle();
    expect([checker.asked[0].raceId, checker.asked[0].question.seq, checker.asked[0].index]).toEqual(['rce_short', 0, 2]);
    checker.asked[0].reply('right');
    await settle();

    box();
    expect(inside.panel.question).toBe(dealt.questions[1]);
    expect(captions()).toEqual(['only']);
    inside.answer(0);
    await settle();
    checker.asked[1].reply('wrong');
    await settle();

    // The deal was shorter than the race: the boxes left open nothing, and the race goes on.
    box();
    expect(inside.panel.question).toBeNull();
    await play(300);
    box();
    expect(inside.panel.question).toBeNull();
    expect(checker.asked.length).toBe(2);
    expect((scene as unknown as { missed: RaceQuestion[] }).missed).toEqual([dealt.questions[1]]);

    // A second race in the same game, as Race again starts one: from deck position 0, nothing missed yet.
    const again = await startRace(checker, dealtRace('rce_again', 3));
    expect((again.scene as unknown as { missed: RaceQuestion[] }).missed).toEqual([]);
    await until(() => again.inside.phase === 'racing', 'GO again');
    again.scene.handleEvents([{ type: 'item', kind: 'question', racerId: LOCAL_RACER }]);
    expect(again.inside.panel.question?.seq).toBe(0);
    expect(errors).toEqual([]);
  }, 30000);

  it('draws the road once per game: a second race samples the same texture, through its mipmaps and anisotropic', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const gl = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    /** The track texture's GL object and its filters, as the GPU has them. */
    const sampled = (): { texture: WebGLTexture; min: number; aniso: number | null } => {
      const texture = game.textures.get('track-test').source[0].glTexture!.webGLTexture!;
      const bound = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const out = { texture, min: gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER) as number, aniso: ext ? (gl.getTexParameter(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT) as number) : null };
      gl.bindTexture(gl.TEXTURE_2D, bound);
      return out;
    };
    const create = spyOn(game.textures, 'addCanvas').and.callThrough();
    await startRace();
    await play(300);
    const first = sampled();
    expect(create.calls.allArgs().filter(a => a[0] === 'track-test').length).toBe(1);
    await startRace();
    await play(300);
    const second = sampled();
    expect(create.calls.allArgs().filter(a => a[0] === 'track-test').length).toBe(1); // not drawn again
    expect(second.texture).toBe(first.texture);
    expect(second.min).toBe(gl.LINEAR_MIPMAP_LINEAR);
    if (ext) expect(second.aniso).toBe(Math.min(C.ui.road.anisotropy, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
    expect(errors).toEqual([]);
  }, 25000);

  it('takes a checker that rejects or throws as no reply: asked again, then void, and races on', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    let fault: 'reject' | 'throw' = 'reject';
    let attempts = 0;
    const checker: AnswerChecker = {
      check: () => {
        attempts++;
        if (fault === 'throw') throw new Error('the checker broke');
        return Promise.reject(new Error('no reply'));
      },
    };
    const { inside, race, card } = await startRace(checker);
    await until(() => inside.phase === 'racing', 'GO');
    for (const f of ['reject', 'throw'] as const) {
      fault = f;
      attempts = 0;
      inside.openQuestion(card);
      inside.answer(RIGHT);
      await settle();
      expect(inside.panel.question).withContext(f).toBe(card); // no verdict from a failure
      await until(() => inside.panel.question === null, 'the void');
      expect(attempts).withContext(f).toBe(2);
      expect([inside.correctCount, inside.wrongCount, inside.streak.count]).withContext(f).toEqual([0, 0, 0]);
      expect(inside.splash.run?.throw ?? null).withContext(f).toBeNull(); // she came at the press and leaves with nothing
    }
    const d = race.racers[0].d;
    await play(300);
    expect(race.racers[0].d).toBeGreaterThan(d); // the game did not freeze
    expect(errors).toEqual([]);
  }, 25000);

  it('steers from the halves of the stage and the arrow, A and D keys only; a tap on a locked card neither answers nor steers', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const checker = lateChecker();
    const { scene, inside, race, card } = await startRace(checker);
    await until(() => inside.phase === 'racing', 'GO');
    const me = race.racers[0];
    const slide = async (press: () => Promise<void>, release: () => Promise<void>): Promise<number> => {
      const from = me.offset;
      await press();
      await play(300);
      await release();
      return me.offset - from;
    };
    expect(await slide(() => mouse('mousedown', 200, 300), () => mouse('mouseup', 200, 300))).toBeLessThan(0);
    expect(await slide(() => mouse('mousedown', 760, 300), () => mouse('mouseup', 760, 300))).toBeGreaterThan(0);
    for (const [code, sign] of [[37, -1], [39, 1], [65, -1], [68, 1]]) {
      expect(Math.sign(await slide(() => key('keydown', code), () => key('keyup', code)))).withContext(`key ${code}`).toBe(sign);
    }
    // Down, S, Up, W and Space: no slide, no boost, no answer.
    inside.openQuestion(card);
    for (const code of [40, 83, 38, 87, 32]) {
      expect(await slide(() => key('keydown', code), () => key('keyup', code))).withContext(`key ${code}`).toBe(0);
    }
    expect(boosted(race)).toBeNull();
    expect(inside.panel.locked).toBeFalse();

    // A card lifted under the pointer before the lock drops back to its place at the lock.
    const other = inside.panel.open!.cards[WRONG];
    other.emit('pointerover');
    expect(other.y).toBeLessThan(other.getData('restY') as number);
    // Locked: a tap on a card is over that card, so it is no hold of that half of the stage.
    inside.answer(RIGHT);
    await settle();
    expect(other.y).toBe(other.getData('restY') as number);
    const from = me.offset;
    await mouse('mousedown', other.x, other.y);
    expect(inside.pointerSteer).toBe(0);
    await play(300);
    await mouse('mouseup', other.x, other.y);
    expect(me.offset).toBe(from);
    expect(checker.asked.length).toBe(1);
    // and a locked card neither lifts under the pointer nor shows the hand
    other.emit('pointerover');
    expect(other.y).toBe(other.getData('restY') as number); // where the card stands, whatever the pointer did before
    expect(other.input!.cursor).toBeFalsy();

    // Two thumbs: left held, right tapped and lifted, the left one steers again.
    const thumb = (id: number, x: number): Phaser.Input.Pointer => ({ id, x, y: 300 }) as unknown as Phaser.Input.Pointer;
    scene.input.emit('pointerdown', thumb(7, 200), []);
    expect(inside.pointerSteer).toBe(-1);
    scene.input.emit('pointerdown', thumb(8, 760), []);
    expect(inside.pointerSteer).toBe(1);
    scene.input.emit('pointerup', thumb(8, 760));
    expect(inside.pointerSteer).toBe(-1);
    scene.input.emit('pointerup', thumb(7, 200));
    expect(inside.pointerSteer).toBe(0);
    // A lost up (a context menu ate it): the same pointer down again on the other side and up
    // there lets go; nothing stays pinned to the side it first held.
    scene.input.emit('pointerdown', thumb(0, 200), []);
    scene.input.emit('pointerdown', thumb(0, 760), []);
    scene.input.emit('pointerup', thumb(0, 760));
    expect(inside.pointerSteer).toBe(0);
    // and a second race adds no pointer: Phaser keeps them for the whole game
    const pointers = scene.input.manager.pointersTotal;
    await startRace();
    expect(scene.input.manager.pointersTotal).toBe(pointers);
    expect(errors).toEqual([]);
  }, 25000);

  it('gives no free Double Boost at three in a row: a third right answer with no boost running is a plain boost', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { inside, race, card } = await startRace();
    await until(() => inside.phase === 'racing', 'GO');
    for (let i = 0; i < 3; i++) {
      await until(() => boosted(race) === null, 'no boost running', 8000);
      inside.openQuestion(card);
      inside.answer(RIGHT);
      await settle();
      await until(() => inside.splash.run!.hit, 'the bottle landing');
      expect(boosted(race)).withContext(`answer ${i + 1}`).toBe('boost');
    }
    expect(inside.streak.count).toBe(3);
    expect(errors).toEqual([]);
  }, 40000);

  it('keeps the kart still under reduced motion: no lurch on a boost, the stun\'s ring drawn and standing still, the kart on its point', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    const { scene, inside, race, card } = await startRace();
    await until(() => inside.phase === 'racing', 'GO');
    const jolts: number[] = [];
    const sample = (): void => { jolts.push(inside.fx.jolt.lurch); };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sample);
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await settle();
    await until(() => boosted(race) !== null, 'the boost');
    inside.openQuestion(card);
    inside.answer(WRONG);
    await settle();
    await until(() => has(race, 'trap'), 'the trap');
    const { stunFront, kartObj } = scene as unknown as { stunFront: Phaser.GameObjects.Graphics; kartObj: Phaser.GameObjects.Container };
    const { stunBack } = scene as unknown as { stunBack: Phaser.GameObjects.Graphics };
    const me = race.racers[0];
    const point = { d: me.d, offset: me.offset };
    const rings = new Set<string>();
    while (has(race, 'trap')) {
      expect(stunFront.commandBuffer.length + stunBack.commandBuffer.length).toBeGreaterThan(0);
      rings.add(shape(stunFront) + shape(stunBack));
      expect({ d: me.d, offset: me.offset }).toEqual(point); // the kart on its point
      await step();
    }
    expect(rings.size).toBe(1); // drawn and not turning: at most it slides with the head as the camera settles
    expect(kartObj.visible).toBeTrue();
    await play(500);
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sample);
    expect(jolts.length).toBeGreaterThan(10);
    expect(jolts.every(j => j === 0)).toBeTrue();
    expect(errors).toEqual([]);
  }, 25000);

  it('draws the Lightning arcs from race time alone, at a bounded cost; under reduced motion always one, slot by slot', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene } = await startRace();
    const CR = C.ui.streak.crackle;
    const s = 85; // the behind view's width just ahead of the eye
    const drawn = (c: Crackle, t: number): string => {
      c.show(480, 300, s, t, 0);
      return JSON.stringify((c as unknown as { g: Phaser.GameObjects.Graphics }).g.commandBuffer);
    };
    const arcs = new Crackle(scene, false);
    const g = (arcs as unknown as { g: Phaser.GameObjects.Graphics }).g;
    // the same race time draws the same arcs, here and in another crackle; another time draws others
    expect(drawn(arcs, 1234)).toBe(drawn(new Crackle(scene, false), 1234));
    const states = new Set<string>();
    let lit = 0;
    let forks = 0;
    let kinked = 0;
    let widest = 0;
    for (let t = 0; t < 3000; t += 1000 / 60) {
      states.add(drawn(arcs, t));
      const lines = polylines(g);
      if (lines.length) lit++;
      // the drawing's cost: at most 110 line segments a frame, every stroke counted
      const segments = lines.reduce((n, line) => n + line.length - 1, 0);
      widest = Math.max(widest, segments);
      expect(segments).toBeLessThanOrEqual(110);
      // forks: a short polyline beside the arcs; kinks: an inner point well off its line's chord
      forks += lines.filter(line => line.length === CR.forkSegments + 1).length;
      kinked += lines.filter(line => line.slice(1, -1).some(p => {
        const [a, b] = [line[0], line[line.length - 1]];
        return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1) > 0.05 * s;
      })).length;
    }
    expect(states.size).toBeGreaterThan(40); // it crackles
    expect(lit).toBeGreaterThan(100); // and is mostly on
    expect(forks).toBeGreaterThan(0);
    expect(kinked).toBeGreaterThan(lit);
    // a white-hot core: the narrowest stroke is white, over wider blue ones
    const styles: [number, number][] = [];
    const b = g.commandBuffer as number[];
    for (let i = 0; i < b.length;) {
      if (b[i] === 6) { styles.push([b[i + 1], b[i + 2]]); i += 4; } // LINE_STYLE width colour alpha
      else if (b[i] === 4 || b[i] === 5) i += 3; // LINE_TO, MOVE_TO
      else i += 1; // BEGIN_PATH, STROKE_PATH
    }
    const narrowest = styles.reduce((m, st) => (st[0] < m[0] ? st : m), styles[0]);
    expect(narrowest[1]).toBe(0xffffff);
    expect(styles.some(st => st[0] > narrowest[0] && st[1] !== 0xffffff)).toBeTrue();
    // Under reduced motion, over four minutes at 1/60 s: never no arc, and never two slots
    // changing in the same frame (each holds its arc for a whole `calmMs`, offset from the others).
    const calm = new Crackle(scene, true) as unknown as { cycle(i: number, t: number): number | null };
    let before: (number | null)[] = [];
    let bare = 0;
    let crowded = 0;
    for (let t = 0; t < 4 * 60 * 1000; t += 1000 / 60) {
      const now = Array.from({ length: CR.arcs }, (_, i) => calm.cycle(i, t));
      if (now.every(c => c === null)) bare++;
      if (before.length && now.filter((c, i) => c !== before[i]).length > 1) crowded++;
      before = now;
    }
    expect([bare, crowded]).toEqual([0, 0]);
    expect(errors).toEqual([]);
  }, 25000);

  it('counts the streak at the verdict: the badge, gold boxes at Lightning, the breaks', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside, race, card } = await startRace();
    const answer = async (right: boolean): Promise<void> => {
      inside.openQuestion(card);
      inside.answer(right ? RIGHT : WRONG);
      await settle();
    };
    const frame = step;
    const landed = (): Promise<void> => until(() => inside.splash.run === null || inside.splash.run.hit, 'the throw landing');
    await until(() => inside.phase === 'racing', 'GO');

    // Three right answers, each bottle landing before the next: the badge from two. Nothing is
    // armed at three: the second and third bottles each land while a boost runs, so each is a
    // Double Boost, as it would be at any count.
    await answer(true);
    await landed();
    expect(inside.badge.shown).toBeFalse();
    expect(boosted(race)).toBe('boost');
    await answer(true);
    await frame();
    expect(inside.badge.shown).toBeTrue();
    await landed();
    await answer(true);
    expect(inside.streak.count).toBe(3);
    await landed();
    expect(boosted(race)).toBe('double');

    // A wrong answer at three: the sting at once (Splash's squirt comes later, on race time), the
    // badge shatters into shards, and the best is kept.
    inside.setSound(true);
    const oscillators = spyOn(inside.hum!.ctx, 'createOscillator').and.callThrough();
    spyOn(inside.badge, 'shatter').and.callThrough();
    // counted after the press, which swaps Splash's objects for a new run's
    inside.openQuestion(card);
    inside.answer(WRONG);
    const before = scene.children.length;
    await settle();
    expect(oscillators).toHaveBeenCalled();
    expect(inside.badge.shatter).toHaveBeenCalledTimes(1);
    expect(inside.badge.shown).toBeFalse();
    expect(scene.children.length).toBeGreaterThanOrEqual(before + C.ui.streak.shards);
    expect(inside.streak).toEqual({ count: 0, best: 3 });

    // At two it ends silently: no sting, no shatter, and the badge is gone.
    await answer(true);
    await answer(true);
    await landed();
    await frame();
    expect(inside.badge.shown).toBeTrue();
    oscillators.calls.reset();
    await answer(false);
    expect(oscillators).not.toHaveBeenCalled();
    expect(inside.badge.shatter).toHaveBeenCalledTimes(1);
    await frame();
    expect(inside.badge.shown).toBeFalse();

    // Five in a row: one short of Lightning the board's ring pulses; at five the lit boxes
    // ahead turn gold and arcs crackle over the kart, in their own Graphics, and a break ends
    // both.
    const crackle = (scene as unknown as { crackle: { shown: boolean; g: Phaser.GameObjects.Graphics } }).crackle;
    for (let i = 0; i < 4; i++) await answer(true);
    await frame();
    expect(crackle.shown).toBeFalse();
    inside.openQuestion(card);
    expect(inside.panel.open?.ring).toBeTruthy();
    inside.answer(RIGHT);
    await settle();
    expect(inside.streak).toEqual({ count: 5, best: 5 });
    await frame();
    const lit = (): Phaser.GameObjects.Rectangle[] => inside.boxes.filter(b => b.visible && b.alpha === 1);
    expect(lit().length).toBeGreaterThan(0);
    expect(lit().every(b => b.fillColor === C.ui.streak.box)).toBeTrue();
    expect(crackle.shown).toBeTrue();
    // The scene's arcs are the ones race time gives: a crackle of its own, shown at this race
    // time for the same kart width, draws the same shapes.
    {
      const s = (scene as unknown as { behind: { s: number } }).behind.s;
      const same = new Crackle(scene, false);
      same.show(0, 0, s, race.elapsedMs, 0);
      expect(shape(crackle.g)).toBe(shape((same as unknown as { g: Phaser.GameObjects.Graphics }).g));
    }
    // With the kart held still, the arcs still change over race time.
    race.racers[0].effects.push({ type: 'trap', mul: 0, left: 5 });
    await play(1000); // the camera settles behind the stopped kart
    const drawings = new Set<string>();
    for (let f = 0; f < 10; f++) {
      await frame();
      drawings.add(JSON.stringify(crackle.g.commandBuffer));
    }
    expect(drawings.size).toBeGreaterThan(3);
    race.racers[0].effects = [];
    await answer(false);
    await frame();
    expect(lit().every(b => b.fillColor === C.ui.road.box)).toBeTrue();
    expect(crackle.shown).toBeFalse();
    expect(inside.streak.best).toBe(5);
    inside.setSound(false);
    expect(errors).toEqual([]);
  }, 25000);

  /** The finish as it really happens: the engine crosses the line inside `update`, Result draws the board with a row, the Garage draws its portraits. */
  it('finishes from the engine, then draws the board with rows and the garage', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside, race } = await startRace();
    const bridge = game.registry.get(BRIDGE_KEY) as Bridge;
    const me = race.racers[0];

    const card = (scene as unknown as { questions: RaceQuestion[] }).questions[0];
    const finished: FinishedRace[] = [];
    bridge.onIntent('finished', r => finished.push(r));
    inside.openQuestion(card);
    inside.answer(RIGHT);
    await settle();
    expect(inside.correctCount).toBe(1);
    // The boost waits for Splash's bottle, on race time, which stands still in the countdown.
    expect(boosted(race)).toBeNull();

    // Three options: two cards in a row and the third centred under them; key 4 does nothing.
    type Open = { cards: Phaser.GameObjects.Container[]; boardTop: number; boardBottom: number; cardsTop: number; top: number };
    const panel = (scene as unknown as { panel: { open: Open | null; show(q: RaceQuestion, nowMs: number, next?: string): void; close(): unknown } }).panel;
    /** The block stands on the bottom pad: the board's shadow the kit's gap above the first card row, the rows in order with that gap, nothing over another, all under the HUD row. */
    const expectBlock = (open: Open): void => {
      expect(open.boardBottom + C.ui.cards.gap).toBeCloseTo(open.cardsTop, 6);
      const tops = [...new Set(open.cards.map(c => c.y - c.height / 2))].sort((a, b) => a - b);
      const bottoms = [...new Set(open.cards.map(c => c.y + c.height / 2))].sort((a, b) => a - b);
      expect(tops[0]).toBe(open.cardsTop);
      for (let r = 1; r < tops.length; r++) expect(tops[r]).toBe(bottoms[r - 1] + C.ui.cards.gap);
      expect(bottoms[bottoms.length - 1] + C.ui.cards.shadow).toBe(C.ui.stage.h - C.ui.pad);
      expect(open.top).toBeLessThanOrEqual(open.boardTop);
    };
    const counts = (): number[] => [inside.correctCount, inside.wrongCount];
    const four = scene.input.keyboard!.addKey('FOUR');
    // Phaser handles a key event as it is dispatched and empties its queue only at the end of a
    // frame, so two presses with no frame between replay the first: a frame follows each event.
    const press = async (type: 'keydown' | 'keyup'): Promise<void> => {
      const key = new KeyboardEvent(type, { key: '4', code: 'Digit4' });
      Object.defineProperty(key, 'keyCode', { get: () => 52 });
      window.dispatchEvent(key);
      await step();
      expect(four.isDown).toBe(type === 'keydown');
    };
    spyOn(inside, 'answer').and.callThrough();
    inside.openQuestion(question(97));
    const [c0, c1, c2] = panel.open!.cards;
    expect(panel.open!.cards.length).toBe(3);
    expect(c1.y).toBe(c0.y);
    expect(c0.x).toBeLessThan(C.ui.stage.w / 2);
    expect(c1.x).toBeGreaterThan(C.ui.stage.w / 2);
    expect(c2.x).toBe(C.ui.stage.w / 2);
    expect(c2.y).toBeGreaterThan(c0.y);
    expectBlock(panel.open!);
    const before = counts();
    await press('keydown');
    await press('keyup');
    expect(panel.open).not.toBeNull();
    expect(inside.answer).not.toHaveBeenCalled();
    expect(counts()).toEqual(before);
    panel.close();

    // The tallest block: three lines of question, two rows of two-line options and the next-tier
    // tag on the board, still whole on the stage and under the HUD row.
    const long = 'a very long phrase that keeps going '.repeat(12);
    panel.show({ ...question(96), content: long, options: [long, long, long, long] }, race.elapsedMs, 'lightning');
    expectBlock(panel.open!);
    // the tag stands on the board's top edge, not inside it over the question
    const tag = scene.children.list.flatMap(o => (o instanceof Phaser.GameObjects.Container ? o.list : [o]))
      .find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.text.startsWith('1 more:'))!;
    expect(tag.y + tag.height / 2).toBeLessThanOrEqual(panel.open!.boardTop + C.ui.cards.outline);
    // and the whole block stays under a shout's grown box, which keeps its place over the road
    inside.fx.shout('DOUBLE BOOST', C.ui.colors.good);
    const word = scene.children.list.find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.text === 'DOUBLE BOOST')!;
    expect(panel.open!.top).toBeGreaterThan(word.y + (word.height * SHOUT_GROWN) / 2);
    panel.close();

    // Four one-line options: key 4 picks the fourth card.
    const fourOptions = { ...question(98), options: ['a', 'b', 'c', 'd'], right: 3 };
    inside.openQuestion(fourOptions);
    expectBlock(panel.open!);

    await press('keydown');
    await press('keyup');
    expect(panel.open).toBeNull();
    expect(inside.answer).toHaveBeenCalledOnceWith(3);
    expect(inside.correctCount).toBe(2);
    scene.input.keyboard!.removeKey(four);

    // That press, at race time 0, landed the first bottle at once, a boost, and its verdict threw
    // its own: a Double Boost from the first frame at or past CATCH_MS of race time after GO.
    expect(boosted(race)).toBe('boost');
    const caught = watchFrames(scene);
    await until(() => inside.phase === 'racing', 'GO');
    await until(() => boosted(race) === 'double', 'the bottle landing');
    caught.stop();
    expectLandingAt(caught.frames, f => f.boost === 'double', CATCH_MS);

    // Sound on, as a player would have it, with a long race's worth of engine pitch updates behind it.
    // (The finish with sound on once relabelled the Sound button during shutdown and froze the game.)
    inside.setSound(true);
    expect(inside.hum).not.toBeNull();
    for (let i = 0; i < 12000; i++) setEngineSpeed(inside.hum as EngineSound, 0.5 + (i % 100) / 100);

    // A timeout counts as wrong and sends Splash too, squirt and pop sounding: the trap starts
    // POP_MS of race time after the verdict, which settles right after the frame the countdown ran out in.
    const trapped = (): boolean => has(race, 'trap');
    expect(trapped()).toBeFalse();
    const wrongBefore = inside.wrongCount;
    const watch = watchFrames(scene);
    panel.show(question(95), race.elapsedMs - C.questionCountdownS * 1000); // runs out on the next frame
    await until(trapped, 'the pop after a timeout');
    watch.stop();
    const counted = watch.frames.findIndex(f => f.wrong > wrongBefore);
    expect(counted).toBeGreaterThan(0);
    expectLandingAt(watch.frames, f => f.trapped, watch.frames[counted - 1].ms + POP_MS);

    // Last lap, every checkpoint passed, a few units before the line at top speed, boosted, with
    // no trap left; a wrong answer there: the finish comes before the pop, which never lands.
    await until(() => !trapped(), 'the trap ending', 6000);
    const track = race.built.track;
    placeKart(Object.assign(me, { d: track.length - 4, speed: C.kart.topSpeed, nextCheckpoint: race.built.checkpoints.length, lap: C.laps }), track);
    applyBoost(race, LOCAL_RACER); // cross the line boosted, flame and all
    spyOn(inside, 'landed').and.callThrough();
    inside.openQuestion(question(94));
    inside.answer(0);
    await settle();
    // And a countdown that runs out in the finishing frame (at top speed the line is one frame
    // away): the finish wins, so that question counts neither way.
    const wrongAtLine = inside.wrongCount;
    panel.show(question(93), race.elapsedMs - C.questionCountdownS * 1000);
    const finishFrameMs = race.elapsedMs + clock.stepMs;
    await until(() => game.scene.isActive(SCENE.result), 'Result after the line');
    // Two right in a row, then the timeout broke it: Result gets that best and shows it.
    expect(inside.streak.best).toBe(2);
    const result = game.scene.getScene(SCENE.result) as unknown as Phaser.Scene & { outcome: { bestStreak: number; wrongCount: number }; sheet: Phaser.GameObjects.Container };
    expect(result.outcome.bestStreak).toBe(2);
    expect(race.elapsedMs).toBeCloseTo(finishFrameMs, 3);
    expect(result.outcome.wrongCount).toBe(wrongAtLine);
    expect(result.sheet.list.some(o => o instanceof Phaser.GameObjects.Text && o.text === '×2')).toBeTrue();
    // The finish intent, once: the race's id and the engine's time, an integer.
    expect(finished.map(f => f.raceId)).toEqual(['rce_spec']);
    expect(Number.isInteger(finished[0].finishMs)).withContext(String(finished[0].finishMs)).toBeTrue();
    expect(finished[0].finishMs).toBeCloseTo(finishFrameMs, -2);

    const row = { userId: 'usr_me', username: 'me', name: 'Me', appearance: bridge.data.look, finishMs: 180000, correctCount: 3, wrongCount: 1, createdAt: 0 };
    bridge.set({ leaderboard: { rows: [row, { ...row, userId: 'usr_2', name: 'Other', appearance: null }], mine: row } });
    await play(500);

    show(SCENE.garage);
    await until(() => game.scene.isActive(SCENE.garage), 'Garage');
    await play(300);
    expect(inside.landed).not.toHaveBeenCalled(); // well past POP_MS: the race was over
    expect(trapped()).toBeFalse();
    expect(errors).toEqual([]);
  }, 25000);

  /** A held key's auto-repeat reaches the scene for the keys Phaser does not track; the answer and Escape keys ignore it. */
  it('acts on a fresh keydown of the answer and Escape keys, never on a repeated one', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await startRace();
    await until(() => inside.phase === 'racing', 'GO');
    const keydown = async (code: string, keyCode: number, repeat: boolean): Promise<void> => {
      const event = new KeyboardEvent('keydown', { key: code, code, repeat });
      Object.defineProperty(event, 'keyCode', { get: () => keyCode });
      window.dispatchEvent(event);
      await step(); // the keyboard plugin reads its queue in the frame
    };

    // An answer key: a repeated 1 leaves the question open, a fresh one answers it.
    inside.openQuestion(question(93));
    await keydown('Digit1', 49, true);
    expect(inside.panel.open).not.toBeNull();
    expect(inside.panel.locked).toBeFalse();
    await keydown('Digit1', 49, false);
    expect(inside.panel.open).toBeNull();

    // Escape: a fresh press, then a repeat, does not quit; a second fresh press does.
    spyOn(scene, 'quit').and.callThrough();
    await keydown('Escape', 27, false);
    await keydown('Escape', 27, true);
    expect(scene.quit).not.toHaveBeenCalled();
    await keydown('Escape', 27, false);
    expect(scene.quit).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([]);
  }, 25000);
});

/**
 * The debuff frame by frame at 1/60 s, in a game of its own on a clock of that step: the bubble
 * flies to the racer's head, bursts there in the landing frame, and the stun's ring of stars and
 * drops turns round the head on every frame of the trap, then fades. Pending without WebGL.
 */
describe('race scene in WebGL, the debuff at 60 frames a second', () => {
  const fine = new SpecClock(1000 / 60);
  let game: Phaser.Game;

  beforeEach(() => {
    const bridge = new Bridge({
      loading: false, error: null,
      questions: [], // the bank feeds Scope only
      modules: [{ id: 'mod_1', title: 'One' }],
      user: { id: 'usr_me', name: 'Me' },
      look: { characterId: 'chr_rex', kartId: 'krt_rocket' },
      lookError: null, leaderboard: { rows: [], mine: null }, leaderboardError: null, save: null,
      debug: null, track: 'test',
    }, fakeCalls());
    game = new Phaser.Game({ type: Phaser.AUTO, width: C.ui.stage.w, height: C.ui.stage.h, banner: false, callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, bridge) }, scene: SCENES });
  });

  afterEach(async () => {
    await fine.destroy(game);
  });

  type Landing = { g: Phaser.GameObjects.Graphics; gun: boolean; atMs: number } | null;
  type View = {
    phase: string; race: Race; questions: RaceQuestion[]; splash: { run: SplashRun; landing: Landing };
    stunBack: Phaser.GameObjects.Graphics; stunFront: Phaser.GameObjects.Graphics; kartObj: Phaser.GameObjects.Container; kartG: Phaser.GameObjects.Graphics;
    behind: { s: number; lean: number } | null; look: { character: Character };
    openQuestion(q: RaceQuestion): void; answer(i: number | null): void;
  };
  type Frame = { trapped: boolean; flying: boolean; burst: Landing; burstFirst: number | undefined; front: boolean; back: boolean; at: { x: number; y: number } | null; head: { x: number; y: number } | null };

  /** A race on the 1/60 s clock, racing, and a sampler of every frame's debuff: the flying shot, the landing (its object, first command and place), the stun's halves and the head point. */
  async function racing(): Promise<{ scene: RaceScene; v: View; frames: Frame[]; stop(): void } | null> {
    await fine.take(game);
    await fine.until(() => game.scene.getScenes(true).length > 0, 'a running scene');
    if (!hasWebGL(game.scene.getScene(SCENE.home))) return null;
    for (const sc of game.scene.getScenes(true)) game.scene.stop(sc.scene.key);
    game.scene.start(SCENE.race, { choice: { scope: 'course', name: 'Course', count: C.minQuestions, checker: SPEC_CHECKER }, race: dealtRace('rce_fine', C.minQuestions) });
    await fine.until(() => game.scene.isActive(SCENE.race), 'Race');
    const scene = game.scene.getScene(SCENE.race) as RaceScene;
    const v = scene as unknown as View;
    await fine.until(() => v.phase === 'racing', 'GO', 10000);
    await fine.play(500);
    const frames: Frame[] = [];
    const sample = (): void => {
      const run = v.splash.run;
      const landing = v.splash.landing && v.splash.landing.g.visible ? v.splash.landing : null;
      frames.push({
        trapped: has(v.race, 'trap'), flying: !!run && !run.hit && run.shot.visible, burst: landing, burstFirst: landing?.g.commandBuffer[0] as number | undefined,
        front: v.stunFront.commandBuffer.length > 0, back: v.stunBack.commandBuffer.length > 0,
        at: landing ? { x: landing.g.x, y: landing.g.y } : null,
        head: v.behind ? racerHead(v.kartObj.x, v.kartObj.y, v.behind.s, v.behind.lean, v.kartG.rotation, v.look.character) : null,
      });
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sample);
    return { scene, v, frames, stop: () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sample) };
  }

  /** How many frames one landing shows, from the frame it starts: every frame of `popMs`. */
  const BURST_FRAMES = Math.floor(C.ui.splash.popMs / fine.stepMs);

  it('hits the head, bursts in the landing frame, keeps the stars turning on every frame of the trap and fades them after', async () => {
    const r = await racing();
    if (!r) { pending('no WebGL in this browser'); return; }
    const { v, frames } = r;
    const race = v.race;
    const card = v.questions[0];
    v.openQuestion(card);
    v.answer(WRONG);
    await settle();
    await fine.until(() => has(race, 'trap'), 'the burst');
    await fine.until(() => !has(race, 'trap'), 'the trap ending');
    await fine.play(C.ui.splash.stun.fadeMs + 100);
    r.stop();

    const first = frames.findIndex(f => f.trapped);
    const last = frames.map(f => f.trapped).lastIndexOf(true);
    expect(first).toBeGreaterThan(0);
    // the bubble flies until the landing frame, bursts in it on the head as a ball of water (the
    // burst starts with its ball's fill, a plain pop with its rim's line), and the stars are there from it
    expect(frames[first - 1].flying).toBeTrue();
    expect(frames[first].burst).not.toBeNull();
    expect(frames[first].burstFirst).toBe(7);
    expect(frames[first].at!.x).toBeCloseTo(frames[first].head!.x, 6);
    expect(frames[first].at!.y).toBeCloseTo(frames[first].head!.y, 6);
    // both halves of the ring on every frame of the trap, still there through the fade, gone after it
    expect(frames.slice(first, last + 1).every(f => f.front && f.back)).toBeTrue();
    const fadeFrames = Math.floor(C.ui.splash.stun.fadeMs / fine.stepMs);
    expect(frames.slice(last + 1, last + fadeFrames).every(f => f.front || f.back)).toBeTrue();
    expect(frames[frames.length - 1].front || frames[frames.length - 1].back).toBeFalse();
    expect(frames.slice(last + 1).some(f => f.burst)).toBeFalse(); // no pop when the trap ends

    // The stars turn on race time with the kart held still.
    race.racers[0].effects.push({ type: 'trap', mul: 0, left: 5 });
    await fine.play(300);
    const turned = new Set<string>();
    for (let f = 0; f < 20; f++) {
      await fine.step();
      turned.add(shape(v.stunFront) + shape(v.stunBack)); // by shape: turning, not the slide of the settling camera
    }
    expect(turned.size).toBeGreaterThan(10);
  }, 40000);

  it('plays a landing out in full when the next press comes while it flies or bursts', async () => {
    const r = await racing();
    if (!r) { pending('no WebGL in this browser'); return; }
    const { v, frames } = r;
    const race = v.race;
    const card = v.questions[0];
    const wrong = WRONG;
    /** The frames one landing showed on, from its first. */
    const shown = (landing: Landing): number[] => frames.map((f, i) => (f.burst === landing && landing ? i : -1)).filter(i => i >= 0);

    // In flight: 80 ms after the bubble leaves the gun, the next answer lands it at once, and
    // its burst plays on every frame of its time at the head, the trap starting with it.
    v.openQuestion(card);
    v.answer(wrong);
    await settle();
    await fine.until(() => !!v.splash.run?.from && !v.splash.run.hit, 'the bubble in flight');
    await fine.play(80);
    expect(has(race, 'trap')).toBeFalse();
    frames.length = 0;
    v.openQuestion(card);
    v.answer(RIGHT);
    await settle();
    const forced = v.splash.landing;
    expect(forced?.gun).toBeTrue();
    expect(has(race, 'trap')).toBeTrue();
    await fine.play(C.ui.splash.popMs + 100);
    const inFlight = shown(forced);
    expect(inFlight.length).toBeGreaterThanOrEqual(BURST_FRAMES);
    expect(inFlight).toEqual(inFlight.map((_, k) => inFlight[0] + k)); // on every frame, none missed
    expect(frames[inFlight[0]].at!.x).toBeCloseTo(frames[inFlight[0]].head!.x, 6);
    await fine.until(() => v.splash.run === null && v.splash.landing === null && !has(race, 'trap'), 'all of it over', 8000);

    // Bursting: a press 50 ms into a burst leaves the burst to finish.
    v.openQuestion(card);
    v.answer(wrong);
    await settle();
    frames.length = 0;
    await fine.until(() => has(race, 'trap'), 'the burst');
    const burst = v.splash.landing;
    await fine.play(50);
    v.openQuestion(card);
    v.answer(wrong);
    await settle();
    await fine.play(C.ui.splash.popMs + 100);
    const cut = shown(burst);
    expect(cut.length).toBeGreaterThanOrEqual(BURST_FRAMES);
    expect(cut).toEqual(cut.map((_, k) => cut[0] + k));
    r.stop();
  }, 40000);
});
