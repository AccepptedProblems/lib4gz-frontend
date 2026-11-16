import Phaser from 'phaser';
import { RaceQuestionResponse } from '../../../shared/models';
import { Bridge, BRIDGE_KEY } from '../bridge';
import { C } from '../engine/constants';
import { hasWebGL } from '../render/mode7';
import { createTrackTexture, textureSize } from '../render/track-texture';
import { TEST_TRACK } from '../track/test-track';
import { buildTrack } from '../track/track-def';
import { SCENE } from './keys';
import { LoadStep } from './loading';
import { RaceScene } from './race';
import { ReadyScene } from './ready';
import { SCENES } from './index';
import { SpecClock } from '../testing/spec-clock';
import { fakeCalls, keyChecker } from '../testing/fake-calls';

function question(id: number): RaceQuestionResponse {
  return { id: `rqn_${id}`, courseId: 'crs_1', moduleId: 'mod_1', content: `Q${id}?`, options: [], correctIndex: null, orderIndex: id, createdAt: 0, updatedAt: 0 };
}

const clock = new SpecClock();
const { step, until, play } = clock;
const KEY = 'track-test';
const START = { x: C.ui.stage.w / 2, y: C.ui.stage.h - C.ui.pad - C.ui.button.h / 2 };
const BACK = { x: C.ui.stage.w - C.ui.pad - 48, y: C.ui.pad + 18 };
const DEALING = 'Dealing your questions…';

/** The Ready scene's private loading state, as the spec reads it. */
interface Inside {
  loading: { progress: number; line: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; box: Phaser.GameObjects.Container } | null;
  note: Phaser.GameObjects.Text | null;
  buttons: { input: { enabled: boolean } | null; depth: number }[];
  roadSteps(): LoadStep[];
  loadFailed(error: unknown): void;
}

/** Each frame the Ready scene drew while loading: the bar's fill, its yellow part's drawn width and the line under it. */
interface Drawn { progress: number; fill: number; line: string }

/** The width of what `bar` fills in yellow, read from its draw commands: the slanted fill spans its width plus the skew. */
function yellowWidth(bar: Phaser.GameObjects.Graphics): number {
  const cmd = { FILL_STYLE: 7, LINE_TO: 4, MOVE_TO: 5 }; // phaser/src/gameobjects/graphics/Commands.js, not in its types
  const buf = bar.commandBuffer as number[];
  const xs: number[] = [];
  let colour = -1;
  for (let i = 0; i < buf.length;) {
    const c = buf[i++];
    if (c === cmd.FILL_STYLE) { colour = buf[i]; i += 2; } else if (c === cmd.MOVE_TO || c === cmd.LINE_TO) { if (colour === C.ui.colors.yellow) xs.push(buf[i]); i += 2; }
  }
  return Math.max(...xs) - Math.min(...xs) - C.ui.button.skew;
}

/**
 * The Ready scene's loading after START in a WebGL game on the test track: the panel drawn
 * before any work, one slice per frame with the bar and the line following, no second start
 * and no way out through the buttons, the race and its countdown after it, no panel when the
 * road is already painted, the sliced road identical to the one-go one, nothing left under
 * the road's key and its canvas back in Phaser's pool after a load cut short or the game's
 * destroy, a step that waits on a promise, a failed step or a refused canvas giving START
 * back, a step settling after its scene or game went doing nothing, and reduced motion.
 * Pending when the test browser has no WebGL.
 */
describe('ready scene loading in WebGL', () => {
  let game: Phaser.Game;
  let calls: ReturnType<typeof fakeCalls>;
  let errors: unknown[] = [];
  const onError = (e: ErrorEvent): void => { errors.push((e.error as Error | undefined)?.stack ?? e.message); };
  const onRejection = (e: PromiseRejectionEvent): void => { errors.push(String((e.reason as Error | undefined)?.stack ?? e.reason)); };

  beforeEach(() => {
    errors = [];
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    calls = fakeCalls();
    calls.autoDeal = true;
    const bridge = new Bridge({
      loading: false, error: null,
      questions: Array.from({ length: C.minQuestions }, (_, i) => question(i)),
      modules: [{ id: 'mod_1', title: 'One' }],
      user: { id: 'usr_me', name: 'Me' },
      look: { characterId: 'chr_rex', kartId: 'krt_rocket' },
      lookError: null, leaderboard: { rows: [], mine: null }, leaderboardError: null, save: null,
      debug: null, track: 'test',
    }, calls);
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: C.ui.stage.w, height: C.ui.stage.h,
      banner: false, audio: { noAudio: true },
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, bridge) },
      scene: SCENES,
    });
  });

  afterEach(async () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    if (clock.taken) await clock.destroy(game);
  });

  async function booted(): Promise<boolean> {
    await clock.take(game);
    await until(() => game.scene.getScenes(true).length > 0, 'a running scene');
    return hasWebGL(game.scene.getScene(SCENE.home));
  }

  /** Ready on its own, as Scope starts it; returns the scene and its insides. */
  async function ready(): Promise<{ scene: ReadyScene; inside: Inside }> {
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start(SCENE.ready, { scope: 'course', name: 'Course', count: (game.registry.get(BRIDGE_KEY) as Bridge).data.questions.length, checker: keyChecker() });
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    await step();
    const scene = game.scene.getScene(SCENE.ready) as ReadyScene;
    return { scene, inside: scene as unknown as Inside };
  }

  /** A press and release at stage point `p`, a frame after each. */
  async function tap(p: { x: number; y: number }): Promise<void> {
    const r = game.canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup']) {
      game.canvas.dispatchEvent(new MouseEvent(type, { clientX: r.left + (p.x * r.width) / C.ui.stage.w, clientY: r.top + (p.y * r.height) / C.ui.stage.h, button: 0, bubbles: true }));
      await step();
    }
  }

  /** Records the loading's bar and line at every frame the scene draws, until it stops. */
  function watch(scene: ReadyScene): Drawn[] {
    const drawn: Drawn[] = [];
    const inside = scene as unknown as Inside;
    scene.events.on(Phaser.Scenes.Events.RENDER, () => {
      if (inside.loading) drawn.push({ progress: inside.loading.progress, fill: yellowWidth(inside.loading.bar), line: inside.loading.line.text });
    });
    return drawn;
  }

  /** The bar's fill drew from empty to full, never falling, a slice a frame: every rise the same size, more than a few of them. */
  function expectFilled(drawn: Drawn[]): void {
    const fills = drawn.map(d => d.progress);
    expect(fills[0]).toBe(0);
    expect(fills[fills.length - 1]).toBe(1);
    const rises = fills.slice(1).map((f, i) => f - fills[i]).filter(d => d !== 0);
    expect(rises.every(d => d > 0)).toBeTrue();
    expect(rises.length).toBeGreaterThan(4);
    expect(rises.every(d => Math.abs(d - rises[0]) < 1e-9)).toBeTrue();
    expect(drawn.every(d => Math.abs(d.fill - d.progress * C.ui.ready.loading.bar.w) < 1e-6)).toBeTrue(); // the bar as drawn, not only the number
  }

  /** The canvases of the road's size taken from Phaser's canvas pool from now on. */
  function roadCanvases(): () => HTMLCanvasElement[] {
    const { width, height } = textureSize(buildTrack(TEST_TRACK).track);
    const create = spyOn(Phaser.Display.Canvas.CanvasPool, 'create').and.callThrough();
    return () => create.calls.all().filter(c => c.args[1] === width && c.args[2] === height).map(c => c.returnValue as HTMLCanvasElement);
  }

  function texts(scene: Phaser.Scene): string[] {
    return scene.children.list.filter((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text).map(t => t.text);
  }

  it('draws the panel before any work, takes no second press, fills the bar a slice a frame and starts the race once', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    const drawn = watch(scene);
    const added = spyOn(game.textures, 'addCanvas').and.callThrough();
    const canvases = roadCanvases();
    const start = spyOn(scene.scene, 'start').and.callThrough();
    const tweens = scene.tweens.getTweens().length;

    await tap(START);
    expect(inside.loading).not.toBeNull();
    expect(inside.buttons.every(b => !b.input?.enabled)).toBeTrue(); // START, Back and Scope all off
    expect(game.canvas.style.cursor).not.toBe('pointer'); // no hand left over the dead START
    expect(drawn.length).toBeGreaterThan(0); // the panel was drawn ...
    expect(drawn.every(d => d.progress === 0)).toBeTrue(); // ... before any slice ran
    expect(game.textures.exists(KEY)).toBeFalse();
    expect(canvases()).toEqual([]); // not even the canvas yet
    expect(scene.tweens.getTweens().length).toBe(tweens + 1); // the bolt's pulse

    await tap(START); // a second press does nothing
    await tap(BACK); // nor does Back
    scene.startRace(); // nor a second call past the buttons
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(start.calls.allArgs()).toEqual([[SCENE.race, jasmine.anything()]]);
    expect(added.calls.allArgs().filter(a => a[0] === KEY).length).toBe(1);

    expectFilled(drawn);
    const lines = drawn.map(d => d.line).filter((l, i, all) => i === 0 || l !== all[i - 1]);
    expect(lines).toEqual(['Painting the track…', DEALING, 'Starting the engine…']);
    const engine = drawn.find(d => d.line === 'Starting the engine…')!.progress;
    expect(engine).toBeGreaterThan(0.5);
    expect(engine).toBeLessThan(1);
    const road = game.textures.get(KEY) as Phaser.Textures.CanvasTexture;
    expect(canvases()).toEqual([road.getSourceImage() as HTMLCanvasElement]);
    expect([road.imageData, road.data, road.pixels, road.buffer]).toEqual([null, null, null, null] as never); // the pixel copy dropped

    const race = game.scene.getScene(SCENE.race) as RaceScene;
    await step();
    expect((race as unknown as { phase: string }).phase).toBe('countdown');
    expect(texts(race)).toContain('3');
    expect(errors).toEqual([]);
  }, 30000);

  it('paints nothing for a second race in the same game: the panel shows the deal alone, on the same road', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    let { scene } = await ready();
    scene.startRace();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const road = game.textures.get(KEY);
    (game.scene.getScene(SCENE.race) as RaceScene).quit();
    await until(() => game.scene.isActive(SCENE.ready), 'Ready again');
    scene = game.scene.getScene(SCENE.ready) as ReadyScene;
    const drawn = watch(scene);
    const added = spyOn(game.textures, 'addCanvas').and.callThrough();
    scene.startRace();
    expect((scene as unknown as Inside).loading).not.toBeNull();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect([...new Set(drawn.map(d => d.line))]).toEqual([DEALING, 'Starting the engine…']);
    expect(calls.deals.length).toBe(2); // one per race
    expect(added.calls.allArgs().filter(a => a[0] === KEY)).toEqual([]);
    expect(game.textures.get(KEY)).toBe(road);
    expect(errors).toEqual([]);
  }, 30000);

  it('deals after the road, with Back and Scope live over the panel then only, and a failed road deals nothing', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    calls.autoDeal = false;
    let { scene, inside } = await ready();
    const add = game.textures.addCanvas.bind(game.textures);
    let fail = true;
    spyOn(game.textures, 'addCanvas').and.callFake((key: string, source: HTMLCanvasElement) => {
      if (fail && key === KEY) throw new Error('no room');
      return add(key, source);
    });
    scene.startRace();
    await until(() => inside.note !== null, 'the note');
    expect(calls.deals).toEqual([]); // a failed road spends no race
    fail = false;

    const live = (): boolean[] => inside.buttons.map(b => !!b.input?.enabled);
    scene.startRace();
    const painting: boolean[][] = [];
    while (!game.textures.exists(KEY)) {
      painting.push(live());
      await step();
    }
    expect(painting.length).toBeGreaterThan(4);
    expect(painting.every(p => p.every(on => !on))).withContext('Back, Scope and START dead while the road paints').toBeTrue();
    await until(() => calls.deals.length === 1, 'the deal');
    expect(inside.loading!.line.text).toBe(DEALING);
    expect(calls.deals[0].questionCount).toBe(C.world.rowsPerLap * C.laps);
    await play(300);
    expect(live()).toEqual([true, true, false]); // Back, Scope; START stays off
    expect(inside.buttons[0].depth).toBeGreaterThan(inside.loading!.box.depth); // over the veil
    calls.deals[0].resolve({ raceId: 'rce_1', questions: [] });
    await step();
    expect(live()).toEqual([false, false, false]);
    await until(() => game.scene.isActive(SCENE.race), 'Race');

    // Back during the deal: the load stops, the call is cancelled, Home opens, the road stays.
    (game.scene.getScene(SCENE.race) as RaceScene).quit();
    await until(() => game.scene.isActive(SCENE.ready), 'Ready again');
    ({ scene, inside } = { scene: game.scene.getScene(SCENE.ready) as ReadyScene, inside: game.scene.getScene(SCENE.ready) as unknown as Inside });
    scene.startRace();
    await until(() => calls.deals.length === 2, 'the second deal');
    await step();
    await tap(BACK);
    await until(() => game.scene.isActive(SCENE.home), 'Home');
    expect(calls.deals[1].signal.aborted).toBeTrue();
    expect(game.textures.exists(KEY)).toBeTrue();
    expect(errors).toEqual([]);
  }, 30000);

  it('paints the same road a slice a frame as in one go', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene } = await ready();
    scene.startRace();
    await until(() => game.textures.exists(KEY), 'the sliced road');
    createTrackTexture(scene, 'track-one-go', buildTrack(TEST_TRACK));
    const pixels = (key: string): Uint8ClampedArray => {
      const canvas = game.textures.get(key).getSourceImage() as HTMLCanvasElement;
      return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const sliced = pixels(KEY);
    const oneGo = pixels('track-one-go');
    expect(sliced.length).toBe(oneGo.length);
    let differ = 0;
    for (let i = 0; i < sliced.length; i++) if (sliced[i] !== oneGo[i]) differ++;
    expect(differ).toBe(0);
    let painted = 0;
    for (let i = 0; i < sliced.length; i += 4097) if (sliced[i] !== 0) painted++;
    expect(painted).toBeGreaterThan(0); // not two blank canvases
    expect(errors).toEqual([]);
  }, 30000);

  it('leaves nothing under the road key when Ready shuts down mid-load, and a later START paints it whole', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    let { scene, inside } = await ready();
    const canvases = roadCanvases();
    scene.startRace();
    await until(() => (inside.loading?.progress ?? 0) > 0.25, 'a few slices');
    game.scene.stop(SCENE.ready); // not through its buttons: the host or the game going
    expect(canvases().map(c => c.width)).toEqual([1]); // back in the pool at once
    game.scene.start(SCENE.home);
    await play(200);
    expect(game.textures.exists(KEY)).toBeFalse();

    ({ scene, inside } = await ready());
    const drawn = watch(scene);
    scene.startRace();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(drawn[0].progress).toBe(0); // from the first slice again
    const canvas = game.textures.get(KEY).getSourceImage() as HTMLCanvasElement;
    const corner = canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data;
    expect(corner[3]).toBe(255); // the ground pass ran on this canvas
    expect(errors).toEqual([]);
  }, 30000);

  it('ignores a step that fails after its Ready shut down, while a new load runs', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    let { scene, inside } = await ready();
    let fail!: (error: Error) => void;
    const steps = spyOn(inside, 'roadSteps').and.returnValue([{ line: 'Dealing the cards…', slices: [() => new Promise<void>((_, reject) => { fail = reject; })] }]);
    scene.startRace();
    await play(200);
    expect(inside.loading!.progress).toBe(0); // the bar waits on the promise
    expect(inside.loading!.line.text).toBe('Dealing the cards…');
    game.scene.stop(SCENE.ready);
    game.scene.start(SCENE.home);
    await play(100);

    steps.and.callThrough(); // the scene object is reused by the next start
    ({ scene, inside } = await ready());
    scene.startRace();
    await until(() => (inside.loading?.progress ?? 0) > 0, 'a slice');
    const loading = inside.loading;
    fail(new Error('too late'));
    await play(50);
    expect(inside.loading).toBe(loading); // the new load runs on
    expect(inside.note).toBeNull();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(errors).toEqual([]);
  }, 30000);

  it('gives the road canvas back to the pool on the game\'s destroy, mid-load and after the road is up', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    const canvases = roadCanvases();
    scene.startRace();
    await until(() => (inside.loading?.progress ?? 0) > 0, 'a slice');
    await clock.destroy(game); // steps once, so the destroy runs
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(canvases().map(c => [c.width, c.height])).toEqual([[1, 1]]);
    expect(errors).toEqual([]);
  }, 30000);

  it('shrinks the finished road\'s canvas when the game is destroyed', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene } = await ready();
    scene.startRace();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const canvas = game.textures.get(KEY).getSourceImage() as HTMLCanvasElement;
    expect(canvas.width).toBeGreaterThan(1);
    await clock.destroy(game);
    expect([canvas.width, canvas.height]).toEqual([1, 1]);
    expect(errors).toEqual([]);
  }, 30000);

  it('ignores a step that settles after the game was destroyed', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    let fail!: (error: Error) => void;
    spyOn(inside, 'roadSteps').and.returnValue([{ line: 'Dealing the cards…', slices: [() => new Promise<void>((_, reject) => { fail = reject; })] }]);
    const failed = spyOn(inside, 'loadFailed').and.callThrough();
    scene.startRace();
    await play(200);
    await clock.destroy(game);
    fail(new Error('too late'));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(failed).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  }, 30000);

  it('waits on a promise step in a live load: the bar holds, then moves on when it resolves', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    let done!: () => void;
    spyOn(inside, 'roadSteps').and.returnValue([{ line: 'Dealing the cards…', slices: [() => new Promise<void>(resolve => { done = resolve; })] }]);
    scene.startRace();
    await play(500);
    expect(inside.loading!.progress).toBe(0);
    expect(inside.loading!.line.text).toBe('Dealing the cards…');
    expect(game.scene.isActive(SCENE.ready)).toBeTrue();
    done();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(errors).toEqual([]);
  }, 30000);

  it('gives START back with a note when a promise step rejects in a live load', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    let fail!: (error: Error) => void;
    spyOn(inside, 'roadSteps').and.returnValue([{ line: 'Dealing the cards…', slices: [() => new Promise<void>((_, reject) => { fail = reject; })] }]);
    scene.startRace();
    await play(200);
    fail(new Error('the server is away'));
    await until(() => inside.note !== null, 'the note');
    expect(inside.loading).toBeNull();
    expect(inside.buttons.every(b => b.input?.enabled)).toBeTrue();
    expect(game.scene.isActive(SCENE.ready)).toBeTrue();
    expect(errors).toEqual([]);
  }, 30000);

  it('gives START back with a note when the browser refuses the road canvas, and START then paints it', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    const canvases = roadCanvases();
    const getContext = HTMLCanvasElement.prototype.getContext;
    const { width, height } = textureSize(buildTrack(TEST_TRACK).track);
    let refuse = true;
    spyOn(HTMLCanvasElement.prototype, 'getContext').and.callFake(function (this: HTMLCanvasElement, ...args: unknown[]) {
      return refuse && this.width === width && this.height === height ? null : (getContext as (...a: unknown[]) => unknown).apply(this, args);
    } as never);
    await tap(START);
    await until(() => inside.note !== null, 'the note');
    expect(inside.loading).toBeNull();
    expect(inside.buttons.every(b => b.input?.enabled)).toBeTrue();
    expect(canvases().map(c => c.width)).toEqual([1]); // the refused canvas went back
    expect(game.textures.exists(KEY)).toBeFalse();

    refuse = false;
    await tap(START);
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(game.textures.exists(KEY)).toBeTrue();
    expect(errors).toEqual([]);
  }, 30000);

  it('gives the buttons back with a note when a step fails, and START tries again', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    const { scene, inside } = await ready();
    const canvases = roadCanvases();
    const add = game.textures.addCanvas.bind(game.textures);
    let fail = true;
    spyOn(game.textures, 'addCanvas').and.callFake((key: string, source: HTMLCanvasElement) => {
      if (fail && key === KEY) throw new Error('no room');
      return add(key, source);
    });
    scene.startRace();
    await until(() => inside.note !== null, 'the note');
    expect(inside.loading).toBeNull();
    expect(inside.note!.text).toContain('try again');
    expect(inside.buttons.every(b => b.input?.enabled)).toBeTrue();
    expect(game.textures.exists(KEY)).toBeFalse();
    expect(canvases().map(c => c.width)).toEqual([1]); // its canvas back in the pool
    expect(game.scene.isActive(SCENE.ready)).toBeTrue();

    fail = false;
    await tap(START);
    expect(inside.note).toBeNull(); // the note goes with the new try
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(game.textures.exists(KEY)).toBeTrue();
    expect(errors).toEqual([]);
  }, 30000);

  it('fills the bar and changes the line under reduced motion, with no other motion', async () => {
    if (!(await booted())) { pending('no WebGL in this browser'); return; }
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    const { scene } = await ready();
    const drawn = watch(scene);
    const tweens = scene.tweens.getTweens().length;
    scene.startRace();
    await step();
    expect(scene.tweens.getTweens().length).toBe(tweens); // no pulse
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expectFilled(drawn);
    expect(new Set(drawn.map(d => d.line)).size).toBe(3);
    expect(errors).toEqual([]);
  }, 30000);
});
