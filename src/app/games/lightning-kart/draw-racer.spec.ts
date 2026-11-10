import Phaser from 'phaser';
import { CHARACTERS, KARTS } from './catalogue';
import { drawKartTop, drawPortrait, drawRacer } from './draw-racer';

/** Every character and kart pair draws from behind, from above and as a portrait on a Graphics object in a headless scene without throwing. */
describe('draw-racer', () => {
  let game: Phaser.Game;
  const errors: unknown[] = [];
  let drawn = 0;

  class DrawScene extends Phaser.Scene {
    create(): void {
      const g = this.add.graphics();
      for (const character of CHARACTERS) {
        for (const kart of KARTS) {
          try {
            drawRacer(g, 480, 400, 120, -0.5, character, kart);
            drawRacer(g, 480, 400, 120, 1, character, kart);
            drawPortrait(g, 24, character, kart);
            drawKartTop(g, 60, character, kart);
            drawKartTop(g, 60, character, kart, { lengths: 1.2, colours: [0xff8c1a, 0xffe066], flicker: 0.5 });
            drawn++;
          } catch (e) {
            errors.push(e);
          }
        }
      }
    }
  }

  beforeAll(() => {
    game = new Phaser.Game({ type: Phaser.HEADLESS, width: 960, height: 540, audio: { noAudio: true }, banner: false, scene: [DrawScene] });
  });

  afterAll(() => {
    game.destroy(true);
  });

  it('draws every pair', async () => {
    const started = Date.now();
    while (drawn + errors.length < CHARACTERS.length * KARTS.length && Date.now() - started < 4000) {
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    expect(errors).toEqual([]);
    expect(drawn).toBe(CHARACTERS.length * KARTS.length);
  });
});
