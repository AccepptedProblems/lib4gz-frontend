import Phaser from 'phaser';
import { RaceQuestionResponse } from '../../../shared/models';
import { Bridge, BRIDGE_KEY } from '../bridge';
import { C } from '../engine/constants';
import { SCENE } from './keys';
import { RaceScene } from './race';
import { ReadyScene } from './ready';
import { ResultScene } from './result';
import { ScopeScene } from './scope';
import { SCENES } from './index';

function question(id: number, moduleId: string): RaceQuestionResponse {
  return { id: `rqn_${id}`, courseId: 'crs_1', moduleId, content: `Q${id}?`, options: ['a', 'b'], correctIndex: 0, orderIndex: id, createdAt: 0, updatedAt: 0 };
}

function until(check: () => boolean, what: string, timeoutMs = 4000): Promise<void> {
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

/** Walks the scenes through a fake bridge in a headless game. Scene activity only, no pixels. */
describe('lightning kart flow', () => {
  let game: Phaser.Game;
  let bridge: Bridge;

  beforeAll(() => {
    const big = Array.from({ length: C.minQuestions }, (_, i) => question(i, 'mod_big'));
    const small = Array.from({ length: C.minQuestions - 1 }, (_, i) => question(100 + i, 'mod_small'));
    bridge = new Bridge({
      loading: false,
      error: null,
      questions: [...big, ...small],
      modules: [{ id: 'mod_big', title: 'Big' }, { id: 'mod_small', title: 'Small' }],
      user: { id: 'usr_me', name: 'Me' },
      look: { characterId: 'chr_bolt', kartId: 'krt_classic' },
      lookError: null,
      leaderboard: { rows: [], mine: null },
      leaderboardError: null,
      saveError: null,
      fontFamily: 'sans-serif',
      debug: null,
      track: null,
    });
    game = new Phaser.Game({
      type: Phaser.HEADLESS,
      width: C.ui.stage.w,
      height: C.ui.stage.h,
      audio: { noAudio: true },
      banner: false,
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, bridge) },
      scene: SCENES,
    });
  });

  afterAll(() => {
    game.destroy(true);
  });

  it('boots to Home, refuses a small scope, races a big one, finishes, and returns Home', async () => {
    await until(() => game.scene.isActive(SCENE.home), 'Home');

    const scopes: string[] = [];
    bridge.onIntent('scopeChosen', scope => scopes.push(scope));
    const finishes: { scope: string; finishMs: number }[] = [];
    bridge.onIntent('finished', race => finishes.push({ scope: race.scope, finishMs: race.finishMs }));

    game.scene.start(SCENE.scope);
    await until(() => game.scene.isActive(SCENE.scope), 'Scope');
    const scope = game.scene.getScene(SCENE.scope) as ScopeScene;
    scope.pick('mod_small');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(game.scene.isActive(SCENE.scope)).toBeTrue();
    expect(game.scene.isActive(SCENE.ready)).toBeFalse();
    expect(scopes).toEqual([]);

    scope.pick('mod_big');
    await until(() => game.scene.isActive(SCENE.ready), 'Ready');
    expect(scopes).toEqual(['mod_big']);

    (game.scene.getScene(SCENE.ready) as ReadyScene).startRace();
    await until(() => game.scene.isActive(SCENE.race), 'Race');
    const race = game.scene.getScene(SCENE.race) as RaceScene;
    await new Promise(resolve => setTimeout(resolve, 100)); // a few engine frames
    race.handleEvents([{ type: 'finish', racerId: 'local', finishMs: 123456 }]);
    await until(() => game.scene.isActive(SCENE.result), 'Result');
    expect(finishes).toEqual([{ scope: 'mod_big', finishMs: 123456 }]);

    (game.scene.getScene(SCENE.result) as ResultScene).goHome();
    await until(() => game.scene.isActive(SCENE.home), 'Home again');
  });
});
