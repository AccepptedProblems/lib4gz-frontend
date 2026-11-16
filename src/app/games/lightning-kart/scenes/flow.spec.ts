import Phaser from 'phaser';
import { RaceQuestionResponse } from '../../../shared/models';
import { Bridge, BRIDGE_KEY, DATA_CHANGED, FinishedRace, GameData, RaceSave } from '../bridge';
import { C } from '../engine/constants';
import { CHARACTERS, characterOf, KARTS, kartOf } from '../look/catalogue';
import { drawRacer, Facing } from '../look/draw';
import { RaceOutcome, ScopeChoice } from './data';
import { GarageScene } from './garage';
import { SCENE } from './keys';
import { RaceScene } from './race';
import { ReadyScene } from './ready';
import { FIREWORK, ResultScene } from './result';
import { ScopeScene } from './scope';
import { SCENES } from './index';
import { SpecClock } from '../testing/spec-clock';
import { card, dealtRace, fakeCalls, keyChecker, RIGHT } from '../testing/fake-calls';

/** A bank question as a student gets it: no options, no key. */
function question(id: number, moduleId: string): RaceQuestionResponse {
  return { id: `rqn_${id}`, courseId: 'crs_1', moduleId, content: `Q${id}?`, options: [], correctIndex: null, orderIndex: id, createdAt: 0, updatedAt: 0 };
}

/** Result's line when the server counted one more wrong answer than the game listed. */
const UNSEEN_ONE = 'One answer reached the server after your screen moved on. The server\'s count is the one that is saved.';

/** The race's question count the Ready scene asks the server for. */
const RACE_QUESTIONS = C.world.rowsPerLap * C.laps;

/** Every object `scene` shows, containers opened. */
function shown(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const walk = (list: Phaser.GameObjects.GameObject[]): void => list.forEach(o => {
    out.push(o);
    if (o instanceof Phaser.GameObjects.Container) walk(o.list);
  });
  walk(scene.children.list);
  return out;
}

function texts(scene: Phaser.Scene): string[] {
  return shown(scene).filter((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text).map(t => t.text);
}

function fireworks(scene: Phaser.Scene): number {
  return shown(scene).filter(o => o.name === FIREWORK).length;
}

/** Game time from a perfect Result's start to its first burst: the sheet's slide-in, then half the banner's pop. */
const FIRST_BURST_MS = C.ui.fx.resultSlideMs + C.ui.result.perfect.popMs / 2;

/** A headless game with every scene behind a fake bridge whose calls the spec settles: a big scope that can race, a small one that cannot. */
function headlessGame(type: number = Phaser.HEADLESS): { game: Phaser.Game; bridge: Bridge; calls: ReturnType<typeof fakeCalls> } {
  const big = Array.from({ length: C.minQuestions }, (_, i) => question(i, 'mod_big'));
  const small = Array.from({ length: C.minQuestions - 1 }, (_, i) => question(100 + i, 'mod_small'));
  const calls = fakeCalls();
  const bridge = new Bridge({
    loading: false,
    error: null,
    questions: [...big, ...small],
    modules: [{ id: 'mod_big', title: 'Big' }, { id: 'mod_small', title: 'Small' }],
    user: { id: 'usr_me', name: 'Me' },
    look: { characterId: 'chr_bolt', kartId: 'krt_classic' },
    lookError: null,
    leaderboard: { rows: [], mine: null },
    leaderboardError: null,
    save: null,
    debug: null,
    track: null,
  }, calls);
  const game = new Phaser.Game({
    type,
    width: C.ui.stage.w,
    height: C.ui.stage.h,
    audio: { noAudio: true },
    banner: false,
    callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, bridge) },
    scene: SCENES,
  });
  return { game, bridge, calls };
}

/** The Race scene's dealt race and deck position, as the spec reads them. */
function raceOf(race: RaceScene): { raceId: string; questions: unknown[] } {
  return race as unknown as { raceId: string; questions: unknown[] };
}

/** Walks the scenes through a fake bridge in a headless game. Scene activity only, no pixels. */
describe('lightning kart flow', () => {
  let game: Phaser.Game;
  let bridge: Bridge;
  let calls: ReturnType<typeof fakeCalls>;
  const clock = new SpecClock();
  const { until, play } = clock;

  beforeAll(async () => {
    ({ game, bridge, calls } = headlessGame());
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  it('boots to Home, refuses a small scope, deals and races a big one, finishes, and returns Home', async () => {
    await until(() => game.scene.isActive(SCENE.home), 'Home');

    const scopes: string[] = [];
    bridge.onIntent('scopeChosen', scope => scopes.push(scope));
    const finishes: FinishedRace[] = [];
    bridge.onIntent('finished', race => finishes.push(race));

    game.scene.start(SCENE.scope);
    await until(() => game.scene.isActive(SCENE.scope), 'Scope');
    const scope = game.scene.getScene(SCENE.scope) as ScopeScene;
    scope.pick('mod_small');
    await play(100);
    expect(game.scene.isActive(SCENE.scope)).toBeTrue();
    expect(game.scene.isActive(SCENE.ready)).toBeFalse();
    expect(scopes).toEqual([]);

    scope.pick('mod_big');
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    expect(scopes).toEqual(['mod_big']);

    // START deals the race for that scope, as many questions as the race has box rows, and
    // races only once the deal is in: its id and its questions in the server's order.
    const deals = calls.deals.length;
    (game.scene.getScene(SCENE.ready) as ReadyScene).startRace();
    await play(300);
    expect(calls.deals.length).toBe(deals + 1);
    const deal = calls.deals[deals];
    expect([deal.scope, deal.questionCount]).toEqual(['mod_big', RACE_QUESTIONS]);
    expect(game.scene.isActive(SCENE.race)).toBeFalse();
    const dealt = dealtRace('rce_walk', 3); // fewer than asked: the race takes what came
    deal.resolve(dealt);
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const race = game.scene.getScene(SCENE.race) as RaceScene;
    expect(raceOf(race).raceId).toBe('rce_walk');
    expect(raceOf(race).questions).toBe(dealt.questions);

    // An answer through Scope's own checker reaches the host's answer call as the race id, the
    // question's deck position and the choice; a timeout as a null choice.
    const answering = race as unknown as { openQuestion(q: unknown): void; answer(i: number | null): void };
    answering.openQuestion(dealt.questions[1]);
    answering.answer(2);
    await play(100);
    expect(calls.answers.map(a => [a.raceId, a.seq, a.choice])).toEqual([['rce_walk', 1, 2]]);
    calls.answers[0].reply('wrong');
    await play(100);
    answering.openQuestion(dealt.questions[2]);
    answering.answer(null);
    await play(100);
    expect(calls.answers.map(a => [a.raceId, a.seq, a.choice])).toEqual([['rce_walk', 1, 2], ['rce_walk', 2, null]]);
    await play(100); // an engine frame
    race.handleEvents([{ type: 'finish', racerId: 'local', finishMs: 123456 }]);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    expect(finishes).toEqual([{ scope: 'mod_big', raceId: 'rce_walk', finishMs: 123456 }]);
    const result = game.scene.getScene(SCENE.result) as ResultScene;
    expect((result as unknown as { outcome: RaceOutcome }).outcome.bestStreak).toBe(0);
    expect(texts(result)).not.toContain('Best streak');

    result.goHome();
    await until(() => game.scene.isActive(SCENE.home), 'Home again');
  });
});

/** START's deal through the fake bridge, in a game of its own so the walk above still boots to Home whatever the order. */
describe('lightning kart deal', () => {
  let game: Phaser.Game;
  let calls: ReturnType<typeof fakeCalls>;
  const clock = new SpecClock();
  const { until, play } = clock;

  beforeAll(async () => {
    ({ game, calls } = headlessGame());
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  /** Ready alone for the big scope, as Scope starts it. */
  async function ready(): Promise<ReadyScene> {
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    const scope = game.scene.getScene(SCENE.scope) as ScopeScene;
    game.scene.start(SCENE.ready, scope.choices().find(c => c.scope === 'mod_big'));
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    return game.scene.getScene(SCENE.ready) as ReadyScene;
  }

  it('shows the server\'s text when the deal fails, a fixed line for anything else, and START deals again', async () => {
    const scene = await ready();
    const inside = scene as unknown as { note: Phaser.GameObjects.Text | null; buttons: { input: { enabled: boolean } | null }[] };
    const deals = calls.deals.length;
    scene.startRace();
    await play(200);
    calls.deals[deals].reject('You need an active enrollment in this course to race');
    await until(() => inside.note !== null, 'the note');
    expect(inside.note!.text.replace(/\n/g, ' ')).toBe('You need an active enrollment in this course to race');
    expect(inside.buttons.every(b => b.input?.enabled)).toBeTrue();
    expect(game.scene.isActive(SCENE.ready)).toBeTrue();

    scene.startRace();
    await play(200);
    expect(calls.deals.length).toBe(deals + 2);
    calls.deals[deals + 1].reject(new Error('a stack trace nobody should read'));
    await until(() => inside.note !== null, 'the second note');
    expect(inside.note!.text.replace(/\n/g, ' ')).toBe('Something went wrong. Press START to try again.');

    // A long text fits beside START, under the button row's top.
    scene.startRace();
    await play(200);
    calls.deals[deals + 2].reject('A very long reason from the server that goes on and on. '.repeat(4));
    await until(() => inside.note !== null, 'the long note');
    const box = inside.note!.getBounds();
    expect(box.right).toBeLessThanOrEqual(C.ui.stage.w / 2 - C.ui.button.w / 2);
    expect(box.top).toBeGreaterThanOrEqual(C.ui.stage.h - C.ui.pad - C.ui.button.h - 30);
    expect(box.bottom).toBeLessThanOrEqual(C.ui.stage.h);

    scene.startRace();
    await play(200);
    calls.deals[deals + 3].resolve(dealtRace('rce_retry', 3));
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(raceOf(game.scene.getScene(SCENE.race) as RaceScene).raceId).toBe('rce_retry');
  });

  it('says the server is waking when the deal is slow, and still races when it comes', async () => {
    const scene = await ready();
    const line = (): string => (scene as unknown as { loading: { line: Phaser.GameObjects.Text } }).loading.line.text;
    const deals = calls.deals.length;
    scene.startRace();
    await play(C.net.wakeMs - 300);
    expect(line()).toBe('Dealing your questions…');
    await play(500);
    expect(line()).toBe('Waking the server up…');
    calls.deals[deals].resolve(dealtRace('rce_woken', 3));
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(raceOf(game.scene.getScene(SCENE.race) as RaceScene).raceId).toBe('rce_woken');
  });

  it('takes Back during the deal: it cancels the call, and a late reply starts nothing, not even in the next load', async () => {
    let scene = await ready();
    const deals = calls.deals.length;
    scene.startRace();
    await play(200);
    const first = calls.deals[deals];
    expect(first.signal.aborted).toBeFalse();
    tap(buttonOf(scene, 'BACK'));
    await until(() => game.scene.isActive(SCENE.home), 'Home');
    expect(first.signal.aborted).toBeTrue();
    first.resolve(dealtRace('rce_late', 3));
    await play(300);
    expect(game.scene.isActive(SCENE.race)).toBeFalse();
    expect(game.scene.isActive(SCENE.home)).toBeTrue();

    // Scope too; then a new load whose deal is still out when an old one answers.
    scene = await ready();
    scene.startRace();
    await play(200);
    tap(buttonOf(scene, 'SCOPE'));
    await until(() => game.scene.isActive(SCENE.scope), 'Scope');
    const second = calls.deals[deals + 1];
    expect(second.signal.aborted).toBeTrue();
    scene = await ready();
    scene.startRace();
    await play(200);
    second.resolve(dealtRace('rce_old', 3));
    await play(300);
    expect(game.scene.isActive(SCENE.race)).toBeFalse();
    const back = buttonOf(scene, 'BACK') as unknown as { input: { enabled: boolean } | null };
    expect(back.input?.enabled).withContext('the old reply left this deal\'s Back alone').toBeTrue();
    calls.deals[deals + 2].resolve(dealtRace('rce_new', 3));
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(raceOf(game.scene.getScene(SCENE.race) as RaceScene).raceId).toBe('rce_new');
  });

  it('deals a new race for Race again, through the loading, and stays on Ready with the note when that deal fails', async () => {
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    const choice = (game.scene.getScene(SCENE.scope) as ScopeScene).choices().find(c => c.scope === 'mod_big')!;
    const outcome: RaceOutcome = { choice, raceId: 'rce_done', finishMs: 60000, correctCount: 1, wrongCount: 0, missed: [], bestStreak: 1 };
    game.scene.start(SCENE.result, outcome);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    const deals = calls.deals.length;
    (game.scene.getScene(SCENE.result) as ResultScene).raceAgain();
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    await play(200);
    expect(calls.deals.length).toBe(deals + 1);
    const inside = game.scene.getScene(SCENE.ready) as unknown as { loading: unknown; note: Phaser.GameObjects.Text | null };
    expect(inside.loading).not.toBeNull();
    calls.deals[deals].reject('There are no race questions here yet.');
    await until(() => inside.note !== null, 'the note');
    expect(game.scene.isActive(SCENE.ready)).toBeTrue();
    expect(inside.loading).toBeNull();

    (game.scene.getScene(SCENE.ready) as ReadyScene).startRace();
    await play(200);
    calls.deals[deals + 1].resolve(dealtRace('rce_again', 3));
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    expect(raceOf(game.scene.getScene(SCENE.race) as RaceScene).raceId).toBe('rce_again');
  });
});

/** A game on Phaser's canvas renderer, as a browser without WebGL gets: START deals nothing. */
describe('lightning kart without WebGL', () => {
  let game: Phaser.Game;
  let calls: ReturnType<typeof fakeCalls>;
  const clock = new SpecClock();
  const { until, play } = clock;

  beforeAll(async () => {
    ({ game, calls } = headlessGame(Phaser.CANVAS));
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  it('says so beside START and deals no race', async () => {
    await until(() => game.scene.isActive(SCENE.home), 'Home');
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start(SCENE.ready, (game.scene.getScene(SCENE.scope) as ScopeScene).choices()[0]);
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    const scene = game.scene.getScene(SCENE.ready) as ReadyScene;
    scene.startRace();
    await play(300);
    expect(calls.deals).toEqual([]);
    expect(game.scene.isActive(SCENE.ready)).toBeTrue();
    expect(texts(scene)).toContain('Lightning Kart needs WebGL in this browser');
  });
});

/** The Result scene alone, in a game of its own so the walk above still boots to Home whatever the order. */
describe('lightning kart result', () => {
  let game: Phaser.Game;
  let bridge: Bridge;
  const clock = new SpecClock();
  const { until, play } = clock;
  const CHOICE: ScopeChoice = { scope: 'mod_big', name: 'Big', count: C.minQuestions, checker: keyChecker() };

  beforeAll(async () => {
    ({ game, bridge } = headlessGame());
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  /** Result alone, as the Race scene starts it, every other scene stopped. */
  async function showResult(o: Partial<RaceOutcome>, save: GameData['save'] = null): Promise<ResultScene> {
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    bridge.set({ save });
    const outcome: RaceOutcome = {
      choice: CHOICE, raceId: 'rce_r', finishMs: 60000, correctCount: 0, wrongCount: 0, missed: [], bestStreak: 0, ...o,
    };
    game.scene.start(SCENE.result, outcome);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    return game.scene.getScene(SCENE.result) as ResultScene;
  }

  it('shows the best streak with its badge from two in a row, and nothing below', async () => {
    let result = await showResult({ correctCount: 3, wrongCount: 1, missed: [card(1)], bestStreak: 3 });
    expect(texts(result)).toContain('Best streak');
    expect(texts(result)).toContain('×3');

    result = await showResult({ correctCount: 1, wrongCount: 1, missed: [card(1)], bestStreak: 1 });
    expect(texts(result)).not.toContain('Best streak');
    expect(texts(result).some(t => t.startsWith('×'))).toBeFalse();
  });

  it('shows PERFECT with fireworks that end only when every question asked was right', async () => {
    let result = await showResult({ correctCount: 4, wrongCount: 0, bestStreak: 4 });
    expect(texts(result)).toContain('PERFECT');
    expect(texts(result)).not.toContain('Nothing missed. Clean run.'); // PERFECT says it
    expect(fireworks(result)).toBeGreaterThan(0);
    await until(() => fireworks(result) === 0, 'the fireworks to end');
    expect(texts(result)).toContain('PERFECT');

    result = await showResult({ correctCount: 4, wrongCount: 1, missed: [card(1)], bestStreak: 4 });
    expect(texts(result)).not.toContain('PERFECT');
    expect(fireworks(result)).toBe(0);

    // No question answered is no perfect race.
    result = await showResult({});
    expect(texts(result)).not.toContain('PERFECT');
  });

  /** The saved result the finish replies with, the server's counts and key (null except at the first wrong numbers). */
  const saved = (o: { correctCount: number; wrongCount: number; answerKey: (number | null)[] }, raceId = 'rce_r'): RaceSave => ({
    raceId, state: 'saved',
    result: { id: 'rrs_1', userId: 'usr_me', courseId: 'crs_1', moduleId: 'mod_big', finishMs: 60000, seed: 7, createdAt: 0, ...o },
  });

  it('shows the time at once, saving until the reply, then the server\'s counts and the missed list with the key\'s right options', async () => {
    // Missed: question 2 and question 5 (a timeout); its key puts the right option at 2 and 0.
    const missed = [card(2), card(5)];
    const result = await showResult({ correctCount: 3, wrongCount: 2, missed }, { raceId: 'rce_r', state: 'saving' });
    expect(texts(result)).toContain('FINISHED  1:00.0');
    expect(texts(result)).toContain('Saving your time…');
    expect(texts(result)).toContain('Q2?');
    expect(texts(result).some(t => t.startsWith('→'))).toBeFalse(); // no key yet

    // The server counted one more wrong (a voided answer it did get, question 4), and its key names the right options.
    bridge.set({ save: saved({ correctCount: 3, wrongCount: 3, answerKey: [null, null, 2, null, 1, 0] }) });
    expect(texts(result)).toContain('3 right, 3 wrong');
    expect(texts(result)).not.toContain('Saving your time…');
    expect(texts(result)).toEqual(jasmine.arrayContaining(['Q2?', '→ c', 'Q5?', '→ a']));
    expect(texts(result).filter(t => t.startsWith('→')).length).toBe(2);

    // Three wrong on the server, two listed: one line says why.
    expect(texts(result)).toContain(UNSEEN_ONE);

    // A save for another race changes nothing on screen.
    const shownNow = texts(result);
    bridge.set({ save: saved({ correctCount: 9, wrongCount: 0, answerKey: Array<null>(9).fill(null) }, 'rce_other') });
    expect(texts(result)).toEqual(shownNow);
  });

  it('shows a missed question\'s right option only where the key has an entry for it', async () => {
    // Question 3's entry is null: the server did not record it wrong (a race running while it went live).
    const result = await showResult({ correctCount: 2, wrongCount: 2, missed: [card(1), card(3)] }, { raceId: 'rce_r', state: 'saving' });
    bridge.set({ save: saved({ correctCount: 2, wrongCount: 2, answerKey: [null, RIGHT, null, null] }) });

    expect(texts(result)).toEqual(jasmine.arrayContaining(['Q1?', '→ b', 'Q3?']));
    expect(texts(result).filter(t => t.startsWith('→'))).toEqual(['→ b']);
  });

  it('drops PERFECT and its fireworks when the server counted a wrong answer the game never showed, and says why', async () => {
    const result = await showResult({ correctCount: 4, wrongCount: 0, bestStreak: 4 }, { raceId: 'rce_r', state: 'saving' });
    expect(texts(result)).toContain('PERFECT');
    await play(FIRST_BURST_MS + 2 * clock.stepMs); // the fireworks going off
    expect(fireworks(result)).toBeGreaterThan(0);
    expect(texts(result)).not.toContain(UNSEEN_ONE);

    bridge.set({ save: saved({ correctCount: 4, wrongCount: 1, answerKey: [null, null, null, null, 1] }) });
    expect(texts(result)).not.toContain('PERFECT');
    expect(fireworks(result)).toBe(0);
    expect(texts(result)).toContain('4 right, 1 wrong');
    expect(texts(result)).toContain(UNSEEN_ONE);
    expect(texts(result)).not.toContain('Nothing missed. Clean run.');
    await play(C.ui.result.perfect.sparkMs + C.ui.result.perfect.bursts * C.ui.result.perfect.burstGapMs); // nothing left to redraw a destroyed burst
    expect(result.tweens.getTweens().length).toBe(0);

    // A server that agrees keeps PERFECT.
    const kept = await showResult({ correctCount: 4, wrongCount: 0, bestStreak: 4 }, { raceId: 'rce_r', state: 'saving' });
    bridge.set({ save: saved({ correctCount: 4, wrongCount: 0, answerKey: [null, null, null, null] }) });
    expect(texts(kept)).toContain('PERFECT');
  });

  it('shows a failed save with the game\'s own counts and Retry, which sends the finish again; a retry found saved says so', async () => {
    const finishes: FinishedRace[] = [];
    const off = bridge.onIntent('finished', race => finishes.push(race));
    const result = await showResult({ finishMs: 123456, correctCount: 2, wrongCount: 1, missed: [card(0)] },
      { raceId: 'rce_r', state: 'failed', error: 'Could not save your time.', retry: true });
    expect(texts(result)).toContain('2 right, 1 wrong');
    expect(texts(result)).toContain('Could not save your time.');
    tap(buttonOf(result, 'RETRY'));
    expect(finishes).toEqual([{ scope: 'mod_big', raceId: 'rce_r', finishMs: 123456 }]);

    bridge.set({ save: { raceId: 'rce_r', state: 'saving' } });
    expect(texts(result)).toContain('Saving your time…');
    expect(texts(result)).not.toContain('RETRY');
    bridge.set({ save: { raceId: 'rce_r', state: 'saved', result: null } }); // the retry's 409: saved before, no reply to show
    expect(texts(result)).toContain('2 right, 1 wrong · saved');
    expect(texts(result)).toContain('Q0?');
    expect(texts(result)).not.toContain('RETRY');
    off();
  });

  it('offers no Retry for a finish the server refused, and fits a long refusal on its board above where Retry would stand', async () => {
    let result = await showResult({ correctCount: 2, wrongCount: 1, missed: [card(0)] },
      { raceId: 'rce_r', state: 'failed', error: 'That finish time is faster than your right answers allow.', retry: false });
    expect(texts(result)).toContain('That finish time is faster than your right answers allow.');
    expect(texts(result)).not.toContain('RETRY');

    const long = 'A very long reason from the server that goes on and on about the race. '.repeat(6);
    result = await showResult({ correctCount: 2, wrongCount: 1, missed: [card(0)] }, { raceId: 'rce_r', state: 'failed', error: long, retry: true });
    await play(C.ui.fx.resultSlideMs + 100); // the sheet in place
    const note = shown(result).find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.text.startsWith('A very long'))!;
    const box = note.getBounds();
    expect(note.text.endsWith('…')).toBeTrue();
    expect(box.right).toBeLessThanOrEqual(500 + 420 + 1); // the right board's content
    expect(box.bottom).toBeLessThan(buttonArea(buttonOf(result, 'RETRY')).top);
  });

  it('leaves no tween behind when Home is chosen mid-fireworks, and sets them off again next time', async () => {
    let result = await showResult({ correctCount: 4, wrongCount: 0, bestStreak: 4 });
    await play(FIRST_BURST_MS + 2 * clock.stepMs); // the first burst going off, none ended yet
    expect(fireworks(result)).toBe(C.ui.result.perfect.bursts);
    result.goHome();
    await until(() => game.scene.isActive(SCENE.home), 'Home');
    expect(result.tweens.getTweens().length).toBe(0);

    // The restarted scene makes its bursts afresh, nothing left from the first run, and every
    // one goes off: a burst is destroyed only when its tween completes.
    result = await showResult({ correctCount: 4, wrongCount: 0, bestStreak: 4 });
    expect(fireworks(result)).toBe(C.ui.result.perfect.bursts);
    await until(() => fireworks(result) === 0, 'the fireworks to end');
  });

  it('keeps PERFECT still and sets off no fireworks under reduced motion', async () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    const result = await showResult({ correctCount: 4, wrongCount: 0, bestStreak: 4 });
    const word = shown(result).find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.text === 'PERFECT');
    expect(word).toBeDefined();
    const banner = word!.parentContainer;
    expect([banner.scale, banner.alpha]).toEqual([1, 1]);
    await play(FIRST_BURST_MS + 2 * clock.stepMs); // past where the first burst would go off
    expect(fireworks(result)).toBe(0);
    expect([banner.scale, banner.alpha]).toEqual([1, 1]);
  });
});

/** Presses and releases `target` as a pointer would. */
function tap(target: Phaser.GameObjects.GameObject): void {
  target.emit('pointerdown');
  target.emit('pointerup');
}

/** The kit's button in `scene` whose caption is `caption`. */
function buttonOf(scene: Phaser.Scene, caption: string): Phaser.GameObjects.Container {
  const found = shown(scene).find((o): o is Phaser.GameObjects.Container =>
    o instanceof Phaser.GameObjects.Container && o.list.some(c => c instanceof Phaser.GameObjects.Text && c.text === caption));
  expect(found).withContext(caption).toBeDefined();
  return found!;
}

/** The area a kit button takes on the stage: its container's size about its position. */
function buttonArea(button: Phaser.GameObjects.Container): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height);
}

/** The Text in `scene` that reads `text`, if any. */
function textOf(scene: Phaser.Scene, text: string): Phaser.GameObjects.Text | undefined {
  return shown(scene).find((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.text === text);
}

/** How many dataChanged listeners the fake bridge holds. */
function listeners(bridge: Bridge): number {
  return (bridge as unknown as { emitter: Phaser.Events.EventEmitter }).emitter.listenerCount(DATA_CHANGED);
}

/** Keys, combos and key events `scene` holds on its keyboard plugin; all zero for a pointer-only menu. */
function keyboardUse(scene: Phaser.Scene): number[] {
  const keyboard = scene.input.keyboard!;
  return [keyboard.keys.filter(Boolean).length, keyboard.combos.length, keyboard.eventNames().filter(n => String(n).startsWith('key')).length];
}

/** Home, How to Play and the way into the Garage, in a game of their own. */
describe('lightning kart menus', () => {
  let game: Phaser.Game;
  let bridge: Bridge;
  const clock = new SpecClock();
  const { until } = clock;

  beforeAll(async () => {
    ({ game, bridge } = headlessGame());
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  /** `key` alone, whatever order the cases run in. */
  async function show(key: string): Promise<Phaser.Scene> {
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start(key);
    await until(() => game.scene.isActive(key), key);
    return game.scene.getScene(key);
  }

  /** Taps `target` in the running scene and waits for `key` to run instead. */
  async function goTo(target: Phaser.GameObjects.GameObject, key: string): Promise<Phaser.Scene> {
    tap(target);
    await until(() => game.scene.isActive(key), key);
    expect(game.scene.getScenes(true).map(s => s.scene.key)).toEqual([key]);
    return game.scene.getScene(key);
  }

  /** Home's tap zone to the Garage. */
  const zoneOf = (home: Phaser.Scene): Phaser.GameObjects.Zone =>
    shown(home).find((o): o is Phaser.GameObjects.Zone => o instanceof Phaser.GameObjects.Zone)!;

  /** The Graphics in `scene` whose draw commands are exactly `drawRacer` of `look` at Home's size facing `facing`, if any. */
  function racerOf(scene: Phaser.Scene, look: { characterId: string; kartId: string }, facing: Facing): Phaser.GameObjects.Graphics | undefined {
    const scratch = new Phaser.GameObjects.Graphics(scene).clear(); // as Home clears before it draws
    drawRacer(scratch, 0, 0, C.ui.home.kartW, 0, characterOf(look.characterId), kartOf(look.kartId), null, facing);
    const want = JSON.stringify(scratch.commandBuffer);
    scratch.destroy();
    return shown(scene).find((o): o is Phaser.GameObjects.Graphics => o instanceof Phaser.GameObjects.Graphics && JSON.stringify(o.commandBuffer) === want);
  }

  it('walks Home to How to Play and back, six numbered steps on the stage, none cut and none over another', async () => {
    const home = await show(SCENE.home);
    expect(texts(home)).toContain('START');
    expect(texts(home)).toContain('HOW TO PLAY');
    expect(texts(home)).not.toContain('GARAGE');

    const rules = await goTo(buttonOf(home, 'HOW TO PLAY'), SCENE.howToPlay);
    const numbers = ['1', '2', '3', '4', '5', '6'];
    numbers.forEach(n => expect(texts(rules)).withContext(n).toContain(n));
    const steps = texts(rules).filter(t => !['HOW TO PLAY', 'BACK', ...numbers].includes(t));
    expect(steps.length).toBe(6);
    steps.forEach(step => expect(step.endsWith('…')).withContext(step).toBeFalse());
    const boxes = shown(rules)
      .filter((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text)
      .map(t => ({ text: t.text, box: t.getBounds() }));
    const stage = new Phaser.Geom.Rectangle(0, 0, C.ui.stage.w, C.ui.stage.h);
    boxes.forEach(({ text, box }) => expect(Phaser.Geom.Rectangle.ContainsRect(stage, box)).withContext(text).toBeTrue());
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b =>
      expect(Phaser.Geom.Intersects.RectangleToRectangle(a.box, b.box)).withContext(`${a.text} | ${b.text}`).toBeFalse()));

    await goTo(buttonOf(rules, 'BACK'), SCENE.home);
  });

  it('draws the racer facing front in a tap zone that holds it and the hint and no button, redraws it on a look change, and opens the Garage from it', async () => {
    const bolt = { characterId: 'chr_bolt', kartId: 'krt_classic' };
    const pip = { characterId: 'chr_pip', kartId: 'krt_tank' };
    bridge.set({ look: bolt });
    const home = await show(SCENE.home);
    const racer = racerOf(home, bolt, 'front');
    expect(racer).withContext('the racer facing front').toBeDefined();
    expect(racerOf(home, bolt, 'back')).withContext('the racer facing back').toBeUndefined();

    const zone = zoneOf(home).getBounds();
    const hint = textOf(home, 'tap to change');
    expect(hint).toBeDefined();
    expect(Phaser.Geom.Rectangle.ContainsRect(zone, hint!.getBounds())).withContext('the hint').toBeTrue();
    expect(zone.contains(racer!.x, racer!.y)).withContext('where the racer stands').toBeTrue();
    for (const caption of ['START', 'HOW TO PLAY']) {
      expect(Phaser.Geom.Intersects.RectangleToRectangle(zone, buttonArea(buttonOf(home, caption)))).withContext(caption).toBeFalse();
    }

    bridge.set({ look: pip });
    expect(racerOf(home, pip, 'front')).withContext('the new look').toBe(racer);
    expect(racerOf(home, bolt, 'front')).withContext('the old look').toBeUndefined();
    bridge.set({ look: bolt });

    await goTo(zoneOf(home), SCENE.garage);
  });

  it('leaves no bridge listener and no object behind over round trips, the Garage\'s Back included', async () => {
    let home = await show(SCENE.home);
    const trips: number[][] = [];
    for (let trip = 0; trip < 4; trip++) {
      const seen = [listeners(bridge), home.children.list.length];
      const rules = await goTo(buttonOf(home, 'HOW TO PLAY'), SCENE.howToPlay);
      seen.push(listeners(bridge), rules.children.list.length);
      home = await goTo(buttonOf(rules, 'BACK'), SCENE.home);
      seen.push(listeners(bridge), home.children.list.length);
      const garage = await goTo(zoneOf(home), SCENE.garage);
      seen.push(listeners(bridge), garage.children.list.length);
      home = await goTo(buttonOf(garage, 'BACK'), SCENE.home);
      trips.push(seen);
    }
    trips.forEach((seen, i) => expect(seen).withContext(`trip ${i + 1}`).toEqual(trips[0]));
  });

  it('holds no keyboard key or listener on Home, How to Play or the Garage', async () => {
    for (const key of [SCENE.home, SCENE.howToPlay, SCENE.garage]) {
      expect(keyboardUse(await show(key))).withContext(key).toEqual([0, 0, 0]);
    }
  });
});

/** The Garage alone, in a game of its own: the chosen look stands large and follows every pick. */
describe('lightning kart garage', () => {
  let game: Phaser.Game;
  let bridge: Bridge;
  const clock = new SpecClock();
  const { until } = clock;

  beforeAll(async () => {
    ({ game, bridge } = headlessGame());
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  async function showGarage(): Promise<GarageScene> {
    for (const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
    game.scene.start(SCENE.garage);
    await until(() => game.scene.isActive(SCENE.garage), 'Garage');
    return game.scene.getScene(SCENE.garage) as GarageScene;
  }

  const names = (garage: GarageScene): string[] => {
    const { preview } = garage as unknown as { preview: { character: Phaser.GameObjects.Text; kart: Phaser.GameObjects.Text } };
    return [preview.character.text, preview.kart.text];
  };

  const LOOK_NAMES = new Set<string>([...CHARACTERS.map(c => c.name), ...KARTS.map(k => k.name)]);
  const captionOf = (card: Phaser.GameObjects.Container): string =>
    (card.list.find(o => o instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text).text;

  /** Every card on the Garage's display list, left to right: a button captioned with a character's or a kart's name. */
  const cards = (garage: GarageScene): Phaser.GameObjects.Container[] =>
    garage.children.list
      .filter((o): o is Phaser.GameObjects.Container => o instanceof Phaser.GameObjects.Container && LOOK_NAMES.has(captionOf(o)))
      .sort((a, b) => a.x - b.x);

  const captions = (garage: GarageScene): string[] => cards(garage).map(captionOf);
  const characterCards = CHARACTERS.map(c => c.name);
  const kartCards = KARTS.map(k => k.name);

  /**
   * From Bolt in the Rocket, picks through the tabs and the cards as a person would and checks
   * the preview follows each pick: the Character pick keeps the Rocket, the Kart pick keeps Rex.
   */
  function pickThrough(garage: GarageScene): void {
    // a tap fires lookChosen; the host saves it and hands the look back
    const chosen: { characterId: string; kartId: string }[] = [];
    const off = bridge.onIntent('lookChosen', look => {
      chosen.push(look);
      bridge.set({ look });
    });
    expect(captions(garage)).toEqual(characterCards); // Character opens first
    tap(cards(garage)[3]); // Rex
    expect(names(garage)).toEqual(['REX', 'ROCKET']);
    expect(captions(garage)).toEqual(characterCards); // the saved look keeps the tab

    tap(buttonOf(garage, 'KART'));
    expect(captions(garage)).toEqual(kartCards);
    tap(cards(garage)[2]); // the Tank
    expect(names(garage)).toEqual(['REX', 'TANK']);
    expect(captions(garage)).toEqual(kartCards);

    tap(buttonOf(garage, 'CHARACTER'));
    expect(captions(garage)).toEqual(characterCards);
    off();
    expect(chosen).toEqual([{ characterId: 'chr_rex', kartId: 'krt_rocket' }, { characterId: 'chr_rex', kartId: 'krt_tank' }]);
  }

  it('shows the chosen driver in the chosen kart, switches tabs, follows a tapped pick, falls back on an unknown look, opens on Character, bobs, and stops bobbing when left', async () => {
    bridge.set({ look: { characterId: 'chr_bolt', kartId: 'krt_rocket' } });
    let garage = await showGarage();
    expect(names(garage)).toEqual(['BOLT', 'ROCKET']);
    expect(garage.tweens.getTweens().length).toBe(1);
    pickThrough(garage);
    // a look the catalogue does not know draws the first of each
    bridge.set({ look: { characterId: 'chr_gone', kartId: 'krt_gone' } });
    expect(names(garage)).toEqual(['BOLT', 'CLASSIC']);

    // left on Kart, the Garage still opens on Character
    tap(buttonOf(garage, 'KART'));
    expect(captions(garage)).toEqual(kartCards);
    garage = await showGarage();
    expect(captions(garage)).toEqual(characterCards);
    expect(garage.tweens.getTweens().length).toBe(1);

    game.scene.stop(SCENE.garage);
    game.scene.start(SCENE.home);
    await until(() => game.scene.isActive(SCENE.home), 'Home');
    expect(garage.tweens.getTweens().length).toBe(0);
  });

  it('keeps the preview still under reduced motion while tabs switch and picks land', async () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    bridge.set({ look: { characterId: 'chr_bolt', kartId: 'krt_rocket' } });
    const garage = await showGarage();
    expect(names(garage)).toEqual(['BOLT', 'ROCKET']);
    pickThrough(garage);
    expect(garage.tweens.getTweens().length).toBe(0);
  });

  it('shows a failed save in the note\'s place on the Kart tab, keeps the karts, and brings the note back when it clears', async () => {
    const error = 'Could not save your look. Please try again.';
    const note = 'A tap saves at once.';
    bridge.set({ look: { characterId: 'chr_bolt', kartId: 'krt_rocket' }, lookError: null });
    const garage = await showGarage();
    tap(buttonOf(garage, 'KART'));
    expect(textOf(garage, note)!.visible).toBeTrue();

    bridge.set({ lookError: error });
    expect(textOf(garage, error)?.visible).withContext('the error').toBeTrue();
    expect(textOf(garage, note)!.visible).withContext('the note').toBeFalse();
    expect(captions(garage)).toEqual(kartCards);

    bridge.set({ lookError: null });
    expect(textOf(garage, error)).withContext('the error').toBeUndefined();
    expect(textOf(garage, note)!.visible).withContext('the note').toBeTrue();
    expect(captions(garage)).toEqual(kartCards);
  });
});
