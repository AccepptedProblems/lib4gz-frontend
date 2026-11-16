import Phaser from 'phaser';
import { bridgeOf } from '../bridge';
import { C, cssHex } from '../engine/constants';
import { Character, characterOf, Kart, kartOf } from '../look/catalogue';
import { drawRacer } from '../look/draw';
import { racerTop } from '../look/head';
import { drawBottle, drawBurst, drawStun, racerHead, stunTop } from '../look/splash';
import { SCENE } from './keys';
import { backdrop, cornerButton, fit, label, panel, setupStage, title, wrapText } from './widgets';

const UI = C.ui;
const H = UI.howToPlay;
const CARDS = UI.cards;
const FIRST_ROW_TOP = 92; // under the title's accent bar
const ROW_W = UI.stage.w - 2 * UI.pad;
const NUMBER_X = UI.pad + 28;
const PICTURE_X = UI.pad + 112;
const TEXT_X = UI.pad + 184;
const TEXT_W = UI.pad + ROW_W - 20 - TEXT_X;

type Graphics = Phaser.GameObjects.Graphics;
/** A step's picture centred on `x`, `y`, at most `REACH` above and below it, in the player's own look. */
type Picture = (g: Graphics, x: number, y: number, character: Character, kart: Kart) => void;

/** How far a picture reaches above and below its row's centre: the row's half height less the inset. */
const REACH = H.rowH / 2 - H.inset;

/** The racer's width that fills a picture's height, from the top of its headgear to `below` kart widths under its bottom centre. */
const fill = (character: Character, below: number): number => (2 * REACH) / (racerTop(character) + below);

/** The rules in the order a race meets them; `look/draw.spec.ts` draws their pictures. */
export const STEPS: { text: string; picture: Picture }[] = [
  {
    text: 'Hold left or right to slide across the road. The kart steers itself.',
    picture: (g, x, y, character, kart) => {
      const s = fill(character, 0.08); // down to the shadow blob
      const bottom = y + REACH - 0.08 * s;
      drawRacer(g, x, bottom, s, 0, character, kart);
      const reach = 0.66 * s + 6; // clear of the rear tyres
      const a = H.arrow;
      const ay = bottom - 0.4 * s;
      g.fillStyle(UI.colors.yellow, 1)
        .fillTriangle(x - reach - a, ay, x - reach, ay - a * 0.8, x - reach, ay + a * 0.8)
        .fillTriangle(x + reach + a, ay, x + reach, ay - a * 0.8, x + reach, ay + a * 0.8);
    },
  },
  {
    text: 'Drive through a box to get a question.',
    picture: (g, x, y) => {
      const b = H.box;
      g.fillStyle(UI.road.box, 1).lineStyle(H.line, UI.road.boxEdge, 1);
      for (const dx of [-1.4 * b, 0, 1.4 * b]) {
        g.fillRect(x + dx - b / 2, y - b / 2, b, b).strokeRect(x + dx - b / 2, y - b / 2, b, b);
      }
    },
  },
  {
    text: 'Tap the right answer before the bar runs out.',
    picture: (g, x, y) => {
      // the board with its bar half drained, and the four cards two by two under it, all centred on y
      const { w, h, board } = H.card;
      const gap = 2 * H.line;
      const top = y - (board + 2 * (gap + h)) / 2;
      const r = h / 4;
      const barH = 2 * H.line;
      const inset = (board - barH) / 2; // the bar sits as far from the board's sides as from its top
      const left = x - w - H.line;
      const across = w / 2 + H.line; // a card's centre from x
      g.fillStyle(CARDS.board, 1).fillRoundedRect(left, top, 2 * (w + H.line), board, r);
      g.fillStyle(CARDS.ink, 1).fillRoundedRect(left + inset, top + inset, 2 * (w + H.line - inset), barH, barH / 2);
      g.fillStyle(UI.colors.cyan, 1).fillRoundedRect(left + inset, top + inset, w + H.line - inset, barH, barH / 2);
      CARDS.fill.forEach((colour, i) => {
        const cx = x + (i % 2 === 0 ? -across : across);
        const cy = top + board + gap + h / 2 + (i < 2 ? 0 : h + gap);
        g.fillStyle(colour, 1).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        g.lineStyle(H.line, CARDS.ink, 1).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
      });
    },
  },
  {
    text: 'Right answer: Splash throws you water. BOOST! Right again while boosting: DOUBLE BOOST!',
    picture: (g, x, y, character, kart) => {
      drawBottle(g, x - 34, y, H.bottleH);
      const s = fill(character, 0.15); // down to the flame's tips
      drawRacer(g, x + 22, y + REACH - 0.15 * s, s, 0, character, kart, { lengths: 1, colours: UI.fx.flame, flicker: 0.5 });
    },
  },
  {
    text: 'Wrong or too slow: a bubble stuns you, stops your kart and ends your boost.',
    picture: (g, x, y, character, kart) => {
      // the race's stunned racer, its stars and drops larger than in the race so they read at
      // this size, the bubble bursting on its head; the whole from the ring's top to the shadow's
      // bottom filling the picture's height
      const top = Math.max(racerTop(character), stunTop(character, H.stunSize));
      const s = (2 * REACH) / (top + 0.08);
      const bottom = y + REACH - 0.08 * s;
      const head = racerHead(x, bottom, s, 0, 0, character);
      drawStun(g, head.x, head.y, s, H.stunPhase, 1, 'back', H.stunSize);
      drawRacer(g, x, bottom, s, 0, character, kart);
      drawStun(g, head.x, head.y, s, H.stunPhase, 1, 'front', H.stunSize);
      drawBurst(g, head.x, head.y, H.burst[0] * s, H.burst[1]);
    },
  },
  {
    text: 'Race three laps. Your best time goes on the board.',
    picture: (g, x, y) => {
      // a chequered flag at the top of its pole, in the start line's colours
      const c = H.check;
      const left = x - 2.5 * c;
      const top = y - REACH;
      g.fillStyle(UI.road.startLine[0], 1).fillRect(left - c / 2, top, c / 3, 2 * REACH);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
          g.fillStyle(UI.road.startLine[(row + col) % 2], 1).fillRect(left + col * c, top + row * c, c, c);
        }
      }
    },
  },
];

/** The rules, one board per step with a small picture, and Back to Home. Pointer only, no motion. */
export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super(SCENE.howToPlay);
  }

  create(): void {
    setupStage(this);
    backdrop(this);
    const look = bridgeOf(this).data.look;
    const character = characterOf(look.characterId);
    const kart = kartOf(look.kartId);
    title(this, UI.pad, UI.pad + 20, 'HOW TO PLAY', { originX: 0 });
    cornerButton(this, 'Back', () => this.scene.start(SCENE.home));

    const rowY = (i: number): number => FIRST_ROW_TOP + i * (H.rowH + H.gap) + H.rowH / 2;
    STEPS.forEach((step, i) => {
      panel(this, UI.pad, rowY(i) - H.rowH / 2, ROW_W, H.rowH);
      label(this, NUMBER_X, rowY(i), String(i + 1), { size: UI.font.hudBig, bold: true, color: cssHex(UI.colors.yellow) });
      fit(wrapText(this, TEXT_X, rowY(i), step.text, TEXT_W, { originX: 0 }), [UI.font.body, UI.font.small], 2);
    });
    // one Graphics for every picture, made after the boards so it draws over them
    const pictures = this.add.graphics();
    STEPS.forEach((step, i) => step.picture(pictures, PICTURE_X, rowY(i), character, kart));
  }
}
