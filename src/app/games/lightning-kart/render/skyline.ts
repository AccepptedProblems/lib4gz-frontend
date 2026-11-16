import Phaser from 'phaser';
import { C, cssHex } from '../engine/constants';
import { mulberry32 } from '../engine/seed';

const UI = C.ui;
const SW = UI.stage.w;
const SH = UI.stage.h;
const SK = UI.road.skyline;
const KEY = 'skyline';

/** The camera's focal length in stage px: how far a point at the screen centre moves per radian of yaw. */
function focal(): number {
  return SH / 2 / Math.tan((C.camera.fovDeg * Math.PI) / 360);
}

/** The horizon row on the stage at the camera's pitch, the formula the mode 7 spec checks. */
export function horizonRow(): number {
  const pitch = (C.camera.pitchDeg * Math.PI) / 180;
  return SH / 2 - Math.tan(pitch) * focal();
}

/**
 * The coastal city on the horizon: one strip `2 * PI * focal` px wide, so it slides at the
 * same rate as the sun at the screen centre, drawn once by code into a canvas texture and
 * shown as two images end to end with their bottom edge on the horizon row (a tile sprite
 * would resample the strip into a power-of-two canvas and soften the 1 px cables). `setYaw`
 * slides them with the camera. The strip is a flat silhouette, so the shader's sky and sun
 * show through the gaps.
 */
export class Skyline {
  private readonly images: Phaser.GameObjects.Image[];
  private readonly stripW: number;

  constructor(scene: Phaser.Scene, depth: number) {
    this.stripW = Math.round(2 * Math.PI * focal());
    if (!scene.textures.exists(KEY)) drawSkyline(scene, KEY, this.stripW, SK.h);
    const image = (): Phaser.GameObjects.Image => scene.add.image(0, horizonRow(), KEY).setOrigin(0, 1).setDepth(depth);
    this.images = [image(), image()];
    this.setYaw(0);
  }

  /** A turn to the right (yaw up) slides the city to the left, the way the ground goes; whole px, so the strip stays crisp. */
  setYaw(yaw: number): void {
    const px = Math.round(yaw * focal());
    const offset = ((px % this.stripW) + this.stripW) % this.stripW;
    this.images[0].x = -offset;
    this.images[1].x = this.stripW - offset;
  }

  destroy(): void {
    for (const image of this.images) image.destroy();
  }
}

/** Towers, low blocks, palms, a lighthouse or two and a bridge or two, left to right from the seed. */
function drawSkyline(scene: Phaser.Scene, key: string, width: number, height: number): void {
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) throw new Error('could not create the skyline texture');
  const ctx = canvas.context;
  const rng = mulberry32(SK.seed);
  const between = (lo: number, hi: number): number => lo + rng() * (hi - lo);
  const fill = cssHex(SK.fill);
  const base = cssHex(SK.base);
  const H = height;
  ctx.fillStyle = fill;

  const tower = (x: number): number => {
    const w = between(12, 36);
    const h = between(24, H - 12);
    ctx.fillRect(x, H - h, w, h);
    if (rng() < 0.5) ctx.fillRect(x + w * 0.3, H - h - between(4, 9), w * 0.4, 10); // a plant room on the roof
    if (rng() < 0.4) ctx.fillRect(x + w / 2 - 0.75, H - h - between(8, 16), 1.5, 16); // an antenna
    if (rng() < 0.6) {
      // a few lit windows
      ctx.fillStyle = base;
      for (let wy = H - h + 6; wy < H - 10; wy += 6) {
        for (let wx = x + 3; wx < x + w - 3; wx += 5) if (rng() < 0.35) ctx.fillRect(wx, wy, 2, 2);
      }
      ctx.fillStyle = fill;
    }
    return w;
  };
  const lowBlock = (x: number): number => {
    const w = between(28, 60);
    const h = between(8, 18);
    ctx.fillRect(x, H - h, w, h);
    return w;
  };
  const palm = (x: number): number => {
    const lean = between(-8, 8);
    const h = between(26, 40);
    const top = { x: x + 6 + lean, y: H - h };
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + 6, H);
    ctx.quadraticCurveTo(x + 6, H - h / 2, top.x, top.y);
    ctx.stroke();
    ctx.lineWidth = 2;
    const fronds = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < fronds; i++) {
      const ang = Math.PI + (Math.PI * (i + 0.5)) / fronds; // fanning over the top half
      const len = between(12, 18);
      const ex = top.x + Math.cos(ang) * len;
      const ey = top.y + Math.sin(ang) * len * 0.6 + 6;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.quadraticCurveTo(top.x + Math.cos(ang) * len * 0.6, top.y - 6, ex, ey);
      ctx.stroke();
    }
    return 20;
  };
  const lighthouse = (x: number): number => {
    const h = between(42, 56);
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 12, H);
    ctx.lineTo(x + 9, H - h);
    ctx.lineTo(x + 3, H - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + 1, H - h - 6, 10, 6); // the gallery
    ctx.fillRect(x + 4, H - h - 11, 4, 5); // the lantern's roof
    ctx.fillStyle = cssHex(UI.colors.yellow);
    ctx.fillRect(x + 4, H - h - 6, 4, 3); // the lamp
    ctx.fillStyle = fill;
    return 14;
  };
  const bridge = (x: number): number => {
    const span = between(130, 190);
    const pylonH = between(50, H - 14);
    const deckY = H - 16;
    const a = x + 30;
    const b = x + 30 + span;
    ctx.fillRect(a - 3, H - pylonH, 6, pylonH);
    ctx.fillRect(b - 3, H - pylonH, 6, pylonH);
    ctx.fillRect(x, deckY, span + 60, 3);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, deckY);
    ctx.quadraticCurveTo(a - 18, H - pylonH, a, H - pylonH);
    ctx.quadraticCurveTo((a + b) / 2, deckY + 10, b, H - pylonH);
    ctx.quadraticCurveTo(b + 18, H - pylonH, x + span + 60, deckY);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let hx = a + 10; hx < b; hx += 10) {
      const t = (hx - a) / span;
      const cableY = (1 - t) * (1 - t) * (H - pylonH) + 2 * (1 - t) * t * (deckY + 10) + t * t * (H - pylonH);
      ctx.beginPath();
      ctx.moveTo(hx, cableY);
      ctx.lineTo(hx, deckY);
      ctx.stroke();
    }
    return span + 60;
  };

  let x = between(4, 20);
  let lighthouses = 0;
  let bridges = 0;
  // The last 260 px stay empty shore so no element is cut at the seam: once per revolution
  // the city opens into a bay about a quarter of the stage wide. Intended.
  while (x < width - 260) {
    const pick = rng();
    let w: number;
    if (pick < 0.03 && lighthouses < 2) { w = lighthouse(x); lighthouses++; }
    else if (pick < 0.07 && bridges < 2) { w = bridge(x); bridges++; }
    else if (pick < 0.3) w = palm(x);
    else if (pick < 0.55) w = lowBlock(x);
    else w = tower(x);
    x += w + between(2, 16);
  }
  // the shore: a lighter band at the base, and a haze over the feet of the city
  ctx.fillStyle = base;
  ctx.fillRect(0, H - 5, width, 5);
  const haze = ctx.createLinearGradient(0, H - 5, 0, H - 28);
  haze.addColorStop(0, `rgba(${(SK.base >> 16) & 255}, ${(SK.base >> 8) & 255}, ${SK.base & 255}, 0.55)`);
  haze.addColorStop(1, `rgba(${(SK.base >> 16) & 255}, ${(SK.base >> 8) & 255}, ${SK.base & 255}, 0)`);
  ctx.fillStyle = haze;
  ctx.fillRect(0, H - 28, width, 23);
  canvas.refresh();
}
