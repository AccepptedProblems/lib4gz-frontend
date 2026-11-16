import Phaser from 'phaser';
import { C } from '../engine/constants';
import { CHARACTERS, KARTS } from './catalogue';
import { drawKartTop, drawPortrait, drawRacer, Facing } from './draw';
import { drawHead, drawHeadBack, HEAD_R, HEAD_SLIDE, HEAD_Y, INK, MOUTH, racerTop, shade, WHITE } from './head';
import { CHIP_PORTRAIT } from './picker';
import { SpecClock } from '../testing/spec-clock';
import { STEPS } from '../scenes/how-to-play';
import { BOTTLE_TIP, drawBottle, drawBubble, drawBurst, drawPop, drawSplash, drawStun, GUN_DOWN, racerHead, stunTop } from './splash';

type Box = { left: number; right: number; top: number; bottom: number };
type Pt = { x: number; y: number };

/**
 * A stand-in for Graphics that keeps the box each fill or stroke call covers, a stroke padded
 * by half its line width, so the union is never smaller than the drawing (a rounded corner
 * counts as square), the farthest each call reaches from the origin (a circle or a point list
 * exactly, a rectangle at its farthest corner), the name of each call and the colour it
 * draws in (a fill's, or a stroke's line). Its camera zoom is `zoom`. A draw call it lacks throws, so a new kind of call fails
 * here first.
 */
function recorder(zoom = 1): { g: Phaser.GameObjects.Graphics; boxes: Box[]; reach: number[]; calls: string[] } {
  const boxes: Box[] = [];
  const reach: number[] = [];
  const calls: string[] = [];
  let lw = 0;
  let colour = 0;
  let line = 0;
  const g: Record<string, unknown> = { scene: { cameras: { main: { zoom } } } };
  const add = (name: string, xs: number[], ys: number[], pad: number, far: number) => {
    calls.push(`${name} ${name.startsWith('fill') ? colour : line}`);
    boxes.push({ left: Math.min(...xs) - pad, right: Math.max(...xs) + pad, top: Math.min(...ys) - pad, bottom: Math.max(...ys) + pad });
    reach.push(far + pad);
    return g;
  };
  const fill = () => 0;
  const stroke = () => lw / 2;
  const rect = (name: string, pad: () => number) => (x: number, y: number, w: number, h: number) =>
    add(name, [x, x + w], [y, y + h], pad(), Math.hypot(Math.max(-x, x + w), Math.max(-y, y + h)));
  const circle = (name: string, pad: () => number) => (x: number, y: number, r: number) => add(name, [x - r, x + r], [y - r, y + r], pad(), Math.hypot(x, y) + r);
  const ellipse = (name: string, pad: () => number) => (x: number, y: number, w: number, h: number) =>
    add(name, [x - w / 2, x + w / 2], [y - h / 2, y + h / 2], pad(), Math.hypot(x, y) + Math.max(w, h) / 2);
  const points = (name: string, pad: () => number) => (pts: Pt[]) => add(name, pts.map(p => p.x), pts.map(p => p.y), pad(), Math.max(...pts.map(p => Math.hypot(p.x, p.y))));
  const triangle = (name: string, pad: () => number) => (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    add(name, [x1, x2, x3], [y1, y2, y3], pad(), Math.max(Math.hypot(x1, y1), Math.hypot(x2, y2), Math.hypot(x3, y3)));
  Object.assign(g, {
    fillStyle: (c: number) => { colour = c; return g; },
    lineStyle: (width: number, c: number) => { lw = width; line = c; return g; },
    fillRect: rect('fillRect', fill), strokeRect: rect('strokeRect', stroke), fillRoundedRect: rect('fillRoundedRect', fill), strokeRoundedRect: rect('strokeRoundedRect', stroke),
    fillCircle: circle('fillCircle', fill), strokeCircle: circle('strokeCircle', stroke),
    fillEllipse: ellipse('fillEllipse', fill), strokeEllipse: ellipse('strokeEllipse', stroke),
    fillPoints: points('fillPoints', fill), strokePoints: points('strokePoints', stroke),
    fillTriangle: triangle('fillTriangle', fill), strokeTriangle: triangle('strokeTriangle', stroke),
    lineBetween: (x1: number, y1: number, x2: number, y2: number) => add('lineBetween', [x1, x2], [y1, y2], lw / 2, Math.max(Math.hypot(x1, y1), Math.hypot(x2, y2))),
  });
  return { g: g as unknown as Phaser.GameObjects.Graphics, boxes, reach, calls };
}

function union(boxes: Box[]): Box {
  return {
    left: Math.min(...boxes.map(b => b.left)), right: Math.max(...boxes.map(b => b.right)),
    top: Math.min(...boxes.map(b => b.top)), bottom: Math.max(...boxes.map(b => b.bottom)),
  };
}

const FLAME = { lengths: 1, colours: [0xff8c1a, 0xffe066] as [number, number], flicker: 1 };
const FACINGS: Facing[] = ['back', 'front'];

/**
 * The calls of `drawRacer(g, 0, 0, s, lean, ...)` that draw a face: an ink, white or mouth fill
 * (an eye's white or lid, a pupil, the nose, a grin) lying wholly inside the face's middle,
 * between the ears and from the brows to the chin, or an ink line (a mouth) wholly inside
 * the band under the nose. Pip's cap bill, outlined in ink higher up, is not a mouth.
 */
function faceMarks(r: { calls: string[]; boxes: Box[] }, s: number, lean: number): string[] {
  const hx = HEAD_SLIDE * s * lean;
  const cy = -HEAD_Y * s;
  const hr = HEAD_R * s;
  const fills = [INK, WHITE, MOUTH].flatMap(c => [`fillPoints ${c}`, `fillEllipse ${c}`, `fillCircle ${c}`]);
  const lines = [`strokePoints ${INK}`, `strokeEllipse ${INK}`, `lineBetween ${INK}`];
  return r.calls.filter((c, i) => {
    const b = r.boxes[i];
    const top = fills.includes(c) ? -0.45 : lines.includes(c) ? 0.55 : Infinity;
    return b.left >= hx - 0.95 * hr && b.right <= hx + 0.95 * hr && b.top >= cy + top * hr && b.bottom <= cy + 1.0 * hr;
  });
}
const EPS = 1e-6;

/**
 * Every character and kart pair draws from behind at each lean and with the flame, from above
 * with and without the flame, and as a portrait at the leaderboard and chip sizes, and so do
 * Splash's parts (`splash.ts`), on a Graphics object in a headless scene without throwing. Headless Phaser renders nothing, so this guards the
 * geometry calls only (a bad radius or point list throws); a recording stand-in checks the
 * behind view's box, the portrait's ring, the call budgets and where the eyes are ringed. How a kart looks is checked by
 * playing.
 */
describe('look/draw', () => {
  let game: Phaser.Game;
  const errors: unknown[] = [];
  let drawn = 0;
  let splashDrawn = false;

  class DrawScene extends Phaser.Scene {
    create(): void {
      const g = this.add.graphics();
      for (const character of CHARACTERS) {
        for (const kart of KARTS) {
          try {
            for (const lean of [-1, 0, 1]) drawRacer(g, 480, 400, 34, lean, character, kart);
            drawRacer(g, 480, 400, 120, 0.5, character, kart);
            for (const lean of [-1, 0.7]) drawRacer(g, 480, 400, 120, lean, character, kart, null, 'front');
            drawRacer(g, 480, 400, 68, -0.3, character, kart, { lengths: 1.6, colours: [0xff8c1a, 0xffe066], flicker: 0.5 });
            drawRacer(g, 480, 400, 68, 0, character, kart, { lengths: 0, colours: [0xff8c1a, 0xffe066], flicker: 1 });
            drawPortrait(g, 24, character, kart);
            drawPortrait(g, 32, character, kart);
            drawKartTop(g, 60, character, kart);
            drawKartTop(g, 2.6, character, kart, null);
            drawKartTop(g, 60, character, kart, { lengths: 1.2, colours: [0xff8c1a, 0xffe066], flicker: 0.5 });
            drawKartTop(g, 60, character, kart, { lengths: 0, colours: [0xff8c1a, 0xffe066], flicker: 1 });
            drawn++;
          } catch (e) {
            errors.push(e);
          }
        }
      }
      try {
        for (const aim of [GUN_DOWN, 0, -0.3]) drawSplash(g, 840, 345, C.ui.splash.h, aim);
        for (const aim of [0, BOTTLE_TIP]) drawSplash(g, 840, 345, C.ui.splash.h, aim, 'bottle');
        drawSplash(g, 840, 345, C.ui.splash.h, BOTTLE_TIP, 'none');
        drawBubble(g, 600, 300, C.ui.splash.bubbleR);
        for (const t of [0, 0.5, 1]) drawPop(g, 480, 300, C.ui.splash.bubbleR, t);
        drawPop(g, 480, 300, C.ui.splash.bubbleR, 0.5, C.ui.colors.yellow);
        drawBottle(g, 900, 500, 40);
        for (const part of ['back', 'front'] as const) for (const phase of [0, 1, 2.5]) drawStun(g, 480, 300, 85, phase, 0.5, part, phase === 1 ? 1.8 : 1);
        for (const t of [0, 0.4, 1]) drawBurst(g, 480, 300, C.ui.splash.burst.r, t);
        splashDrawn = true;
      } catch (e) {
        errors.push(e);
      }
    }
  }

  const clock = new SpecClock();

  beforeAll(async () => {
    game = new Phaser.Game({ type: Phaser.HEADLESS, width: 960, height: 540, audio: { noAudio: true }, banner: false, scene: [DrawScene] });
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  it('draws every pair in every view, and Splash, her bubble and its pop, the bottle and the stun\'s ring', async () => {
    await clock.until(() => drawn + errors.length >= CHARACTERS.length * KARTS.length, 'every pair drawn', 4000).catch(() => undefined);
    expect(errors).toEqual([]);
    expect(drawn).toBe(CHARACTERS.length * KARTS.length);
    expect(splashDrawn).toBeTrue();
  });

  it('keeps the behind view in its documented box: 1.32 s wide, racerTop s above the bottom centre and 0.08 s below', () => {
    const s = 100;
    for (const character of CHARACTERS) {
      for (const kart of KARTS) {
        for (const [lean, facing] of FACINGS.flatMap(f => [-1, 0, 1].map(l => [l, f] as const))) {
          const { g, boxes } = recorder();
          drawRacer(g, 0, 0, s, lean, character, kart, null, facing);
          const box = union(boxes);
          const at = `${character.id} ${kart.id} ${facing} lean ${lean}`;
          expect(box.left).withContext(at).toBeGreaterThanOrEqual(-0.66 * s - EPS);
          expect(box.right).withContext(at).toBeLessThanOrEqual(0.66 * s + EPS);
          expect(box.top).withContext(at).toBeGreaterThanOrEqual(-racerTop(character) * s - EPS);
          expect(box.top).withContext(at).toBeLessThan(-(racerTop(character) - 0.02) * s); // and racerTop is not loose
          expect(box.bottom).withContext(at).toBeLessThanOrEqual(0.08 * s + EPS);
        }
      }
    }
  });

  it('keeps the portrait head inside the ring', () => {
    const size = 100;
    for (const character of CHARACTERS) {
      for (const kart of KARTS) {
        // the disc and the ring come first; every head part stays within the ring's middle
        const { g, reach } = recorder();
        drawPortrait(g, size, character, kart);
        expect(Math.max(...reach.slice(2))).withContext(character.id).toBeLessThanOrEqual(0.48 * size);
      }
    }
  });

  it('stays within the per-frame draw budgets, the flame included: 100 from behind, either facing, 56 from above (86 back, 92 front and 45 today)', () => {
    for (const character of CHARACTERS) {
      for (const kart of KARTS) {
        for (const facing of FACINGS) {
          const behind = recorder();
          drawRacer(behind.g, 0, 0, 100, 1, character, kart, FLAME, facing);
          expect(behind.boxes.length).withContext(`${character.id} ${kart.id} behind ${facing}`).toBeLessThanOrEqual(100);
        }
        const top = recorder();
        drawKartTop(top.g, 100, character, kart, FLAME);
        expect(top.boxes.length).withContext(`${character.id} ${kart.id} top`).toBeLessThanOrEqual(56);
      }
    }
  });

  it('shows the driver from behind on the road, with no eye, nose or mouth, and the face when facing front', () => {
    const s = 100;
    for (const character of CHARACTERS) {
      for (const kart of KARTS) {
        for (const lean of [-1, 0, 1]) {
          const back = recorder();
          drawRacer(back.g, 0, 0, s, lean, character, kart, FLAME);
          expect(faceMarks(back, s, lean)).withContext(`${character.id} ${kart.id} back lean ${lean}`).toEqual([]);
          const front = recorder();
          drawRacer(front.g, 0, 0, s, lean, character, kart, FLAME, 'front');
          // two lids and the nose at least
          expect(faceMarks(front, s, lean).length).withContext(`${character.id} ${kart.id} front lean ${lean}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('gives every character its own outline, from the front, from behind and from above', () => {
    const outline = (draw: (g: Phaser.GameObjects.Graphics) => void): string => {
      const { g, boxes } = recorder();
      draw(g);
      const box = union(boxes);
      return `${box.left.toFixed(1)} ${box.top.toFixed(1)} ${box.right.toFixed(1)} ${box.bottom.toFixed(1)}`;
    };
    const fronts = CHARACTERS.map(c => outline(g => drawHead(g, 0, 0, 100, c, 10)));
    expect(new Set(fronts).size).withContext(fronts.join(' | ')).toBe(CHARACTERS.length);
    const backs = CHARACTERS.map(c => outline(g => drawHeadBack(g, 0, 0, 100, c, 10)));
    expect(new Set(backs).size).withContext(backs.join(' | ')).toBe(CHARACTERS.length);
    // from above the outline is the kart's, so the headgear's own calls tell them apart
    const tops = CHARACTERS.map(c => {
      const { g, calls } = recorder();
      drawKartTop(g, 100, c, KARTS[0]);
      return calls.join();
    });
    expect(new Set(tops).size).toBe(CHARACTERS.length);
  });

  it('draws open eyes only in the large racer on Home and in the Garage, none on the road, and two separate ink eyes in every portrait and chip, at pixel ratio 1 and 2', () => {
    // an open eye is a white fill under its lid, as is a grin's band of teeth; a small eye is all ink, its shape and its lid
    const whites = (r: { calls: string[] }) => r.calls.filter(c => c === `fillPoints ${WHITE}` || c === `fillEllipse ${WHITE}`).length;
    // the two small eyes, each its ink shape and lid, centred either side of x = 0, at least one screen px apart
    const apart = (r: { calls: string[]; boxes: Box[] }, zoom: number, at: string): void => {
      const ink = r.boxes.filter((_, i) => r.calls[i] === `fillPoints ${INK}` || r.calls[i] === `fillEllipse ${INK}`);
      const left = ink.filter(b => b.left + b.right < 0);
      const right = ink.filter(b => b.left + b.right > 0);
      expect(left.length).withContext(at).toBe(2);
      expect(right.length).withContext(at).toBe(2);
      expect((union(right).left - union(left).right) * zoom).withContext(at).toBeGreaterThanOrEqual(1);
    };
    const kart = KARTS[0];
    for (const character of CHARACTERS) {
      const open = (r: { calls: string[] }) => whites(r) - (character.mouth === 'grin' ? 1 : 0);
      const chipS = (C.ui.chip.h - 4) / (racerTop(character) + 0.08);
      for (const zoom of [1, 2]) {
        for (const size of [20.8, 24, 32, CHIP_PORTRAIT]) {
          const portrait = recorder(zoom);
          drawPortrait(portrait.g, size, character, kart);
          const at = `${character.id} portrait ${size} at ${zoom}`;
          expect(open(portrait)).withContext(at).toBe(0);
          apart(portrait, zoom, at);
        }
        const chip = recorder(zoom);
        drawRacer(chip.g, 0, 0, chipS, 0, character, kart, null, 'front');
        expect(open(chip)).withContext(`${character.id} chip at ${zoom}`).toBe(0);
        apart(chip, zoom, `${character.id} chip at ${zoom}`);
        // just behind the camera on the road the behind view is about 85 stage units wide and shows no face
        const road = recorder(zoom);
        drawRacer(road.g, 0, 0, 85, 0, character, kart);
        expect(whites(road)).withContext(`${character.id} on the road at ${zoom}`).toBe(0);
        for (const [where, kartW] of [['the Garage', C.ui.garage.kartW], ['Home', C.ui.home.kartW]] as const) {
          const large = recorder(zoom);
          drawRacer(large.g, 0, 0, kartW, 0, character, kart, null, 'front');
          expect(open(large)).withContext(`${character.id} on ${where} at ${zoom}`).toBe(2);
        }
      }
    }
  });

  it('draws the Double Boost flame twice as large as the plain one, long and wide, in both kart views', () => {
    /** The outer tongues' total area: the flame's fill triangles in its outer colour. */
    const area = (draw: (g: Phaser.GameObjects.Graphics, lengths: number) => void, lengths: number): number => {
      const r = recorder();
      const tris: number[][] = [];
      const fillTriangle = (r.g as unknown as { fillTriangle: (...a: number[]) => unknown }).fillTriangle;
      (r.g as unknown as { fillTriangle: (...a: number[]) => unknown }).fillTriangle = (...a: number[]) => { tris.push(a); return fillTriangle(...a); };
      draw(r.g, lengths);
      const outer = r.calls.filter(c => c.startsWith('fillTriangle')).map(c => c === `fillTriangle ${FLAME.colours[0]}`);
      return tris.filter((_, i) => outer[i]).reduce((sum, [x1, y1, x2, y2, x3, y3]) => sum + Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2, 0);
    };
    const double = C.ui.fx.doubleFlame;
    const behind = (g: Phaser.GameObjects.Graphics, lengths: number): void => drawRacer(g, 0, 0, 100, 0, CHARACTERS[0], KARTS[0], { ...FLAME, lengths });
    const top = (g: Phaser.GameObjects.Graphics, lengths: number): void => drawKartTop(g, 100, CHARACTERS[0], KARTS[0], { ...FLAME, lengths });
    for (const draw of [behind, top]) {
      expect(area(draw, 1)).toBeGreaterThan(0);
      expect(area(draw, double) / area(draw, 1)).toBeCloseTo(double * double, 6);
    }
  });

  it('aims the shot at the head and rings the stun clear round the helmet, for every driver', () => {
    const s = 100;
    const ST = C.ui.splash.stun;
    for (const character of CHARACTERS) {
      // the head point: in the head's column, between its centre and the headgear's top, never as low as the kart
      const p = racerHead(0, 0, s, 0, 0, character);
      expect(Math.abs(p.x)).withContext(character.id).toBeLessThan(HEAD_R * s);
      expect(p.y).withContext(character.id).toBeLessThan(-HEAD_Y * s);
      expect(p.y).withContext(character.id).toBeGreaterThan(-racerTop(character) * s);
      // the ring's stars at its sides clear the head and headgear as drawn
      const head = recorder();
      drawHeadBack(head.g, 0, -HEAD_Y * s, HEAD_R * s, character, 0.03 * s);
      const width = union(head.boxes);
      expect((ST.ring[0] - ST.starR * (1 + ST.depth)) * s).withContext(character.id).toBeGreaterThan(Math.max(-width.left, width.right));
      // and its top stays near the headgear's, so it fits where the racer fits with a little room
      expect(stunTop(character) - racerTop(character)).withContext(character.id).toBeLessThan(0.3);
    }
    // in a bend the Graphics turns about the kart's bottom centre, and the head point turns with
    // it: the drawn head's centre turned by the tilt, and racerHead at no tilt turned the same way
    for (const character of CHARACTERS) {
      const [x0, y0, lean, tilt] = [300, 400, 0.6, 0.3];
      const turn = (p: { x: number; y: number }): { x: number; y: number } => ({
        x: x0 + (p.x - x0) * Math.cos(tilt) - (p.y - y0) * Math.sin(tilt), y: y0 + (p.x - x0) * Math.sin(tilt) + (p.y - y0) * Math.cos(tilt),
      });
      const bent = racerHead(x0, y0, s, lean, tilt, character);
      const straight = turn(racerHead(x0, y0, s, lean, 0, character));
      expect(bent.x).withContext(character.id).toBeCloseTo(straight.x, 6);
      expect(bent.y).withContext(character.id).toBeCloseTo(straight.y, 6);
      const drawnHead = turn({ x: x0 + HEAD_SLIDE * s * lean, y: y0 - HEAD_Y * s });
      expect(Math.hypot(bent.x - drawnHead.x, bent.y - drawnHead.y)).withContext(character.id).toBeLessThan((racerTop(character) - HEAD_Y) * s);
    }
    // turned by the phase, and the same phase draws the same ring
    const calls = (phase: number): string => {
      const r = recorder();
      drawStun(r.g, 0, -120, s, phase, 1, 'front');
      drawStun(r.g, 0, -120, s, phase, 1, 'back');
      return JSON.stringify(r.boxes);
    };
    expect(calls(0.7)).toBe(calls(0.7));
    expect(calls(0.7)).not.toBe(calls(1.4));
  });

  it('pictures the stun in How to Play: the race\'s stars and drops round the head, and the bubble bursting on it', () => {
    const r = recorder();
    STEPS.find(step => step.text.startsWith('Wrong or too slow'))!.picture(r.g, 200, 100, CHARACTERS[3], KARTS[0]);
    const ST = C.ui.splash.stun;
    expect(r.calls).toContain(`fillPoints ${ST.star}`); // a star
    expect(r.calls).toContain(`fillPoints ${ST.drop}`); // a drop
    expect(r.calls).toContain(`fillCircle ${C.ui.colors.cyan}`); // the burst's ball of water
    expect(r.calls.filter(c => c.startsWith('lineBetween')).length).toBeGreaterThanOrEqual(C.ui.splash.burst.lines); // its impact lines
  });

  it('shades a body colour per channel and clamps', () => {
    expect(shade(0xe0303a, 0.7)).toBe(0x9d2229);
    expect(shade(0x2f6fed, 1.3)).toBe(0x3d90ff);
    expect(shade(0xffffff, 1.3)).toBe(0xffffff);
    expect(shade(0x000000, 0.5)).toBe(0x000000);
  });
});
