import Phaser from 'phaser';
import { C, cssHex } from '../engine/constants';
import { Vec } from '../track/geometry';
import { BuiltProp, BuiltTrack, PropKind } from '../track/track-def';
import { Mode7View } from './mode7';

const UI = C.ui;
const P = UI.road.props;
const SIZE = UI.props;
const SH = UI.stage.h;

const KEY: Record<PropKind, string> = { palm: 'prop-palm', billboard: 'prop-billboard', sign: 'prop-sign' };
/** Texture sizes in px, powers of two so Phaser generates mipmaps and a far prop minifies without speckle. */
const TEX: Record<PropKind, { w: number; h: number }> = { palm: { w: 128, h: 256 }, billboard: { w: 256, h: 128 }, sign: { w: 128, h: 256 } };

/** Draws each kind once into a canvas texture; a second call finds them and does nothing. */
export function ensurePropTextures(scene: Phaser.Scene): void {
  const draw: Record<PropKind, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = { palm: drawPalm, billboard: drawBillboard, sign: drawSign };
  for (const kind of Object.keys(KEY) as PropKind[]) {
    if (scene.textures.exists(KEY[kind])) continue;
    const { w, h } = TEX[kind];
    const canvas = scene.textures.createCanvas(KEY[kind], w, h);
    if (!canvas) throw new Error(`could not create the ${kind} texture`);
    draw[kind](canvas.context, w, h);
    canvas.refresh();
  }
}

/** A curved dark trunk with a lit edge, six fronds fanning over the crown (the right-hand ones lit), coconuts. */
function drawPalm(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const base = { x: w * 0.44, y: h - 4 };
  const crown = { x: w * 0.5, y: h * 0.3 };
  ctx.lineCap = 'round';
  ctx.strokeStyle = cssHex(P.trunk);
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.quadraticCurveTo(base.x - 8, h * 0.62, crown.x, crown.y);
  ctx.stroke();
  ctx.strokeStyle = cssHex(P.trunkLight);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(base.x + 5, base.y - 3);
  ctx.quadraticCurveTo(base.x - 3, h * 0.62, crown.x + 4, crown.y + 4);
  ctx.stroke();
  // fronds: a lens from the crown to the tip, arched up by one control and drooping at the end
  const fronds = 6;
  const len = 54;
  for (let i = 0; i < fronds; i++) {
    const a = Math.PI + (Math.PI * (i + 0.5)) / fronds; // left over the top to right
    const tip = { x: crown.x + Math.cos(a) * len, y: crown.y + Math.sin(a) * len * 0.5 + 34 };
    const c = { x: crown.x + Math.cos(a) * len * 0.55, y: crown.y + Math.sin(a) * len * 0.9 - 10 };
    const colour = cssHex(Math.cos(a) > 0.2 ? P.frondLight : P.frond);
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(crown.x, crown.y);
    ctx.quadraticCurveTo(c.x, c.y - 9, tip.x, tip.y);
    ctx.quadraticCurveTo(c.x, c.y + 9, crown.x, crown.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = cssHex(P.coconut);
  for (const [dx, dy] of [[-6, 7], [6, 9], [0, 14]]) {
    ctx.beginPath();
    ctx.arc(crown.x + dx, crown.y + dy, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

/** A dark framed board on two posts: four slanted stripes in the three accents and a yellow bolt. No words. */
function drawBillboard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const board = { x: 12, y: 6, w: w - 24, h: 74 };
  ctx.fillStyle = cssHex(P.post);
  ctx.fillRect(board.x + 28, board.y + board.h - 4, 12, h - board.y - board.h);
  ctx.fillRect(board.x + board.w - 40, board.y + board.h - 4, 12, h - board.y - board.h);
  ctx.fillStyle = cssHex(P.boardEdge);
  ctx.fillRect(board.x, board.y, board.w, board.h);
  const inner = { x: board.x + 4, y: board.y + 4, w: board.w - 8, h: board.h - 8 };
  ctx.fillStyle = cssHex(P.board);
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  const skew = 18;
  const sw = 26;
  let x0 = board.x + 14;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cssHex(P.stripes[i % P.stripes.length]);
    ctx.beginPath();
    ctx.moveTo(x0 + skew, board.y);
    ctx.lineTo(x0 + skew + sw, board.y);
    ctx.lineTo(x0 + sw, board.y + board.h);
    ctx.lineTo(x0, board.y + board.h);
    ctx.closePath();
    ctx.fill();
    x0 += sw + 8;
  }
  const bx = board.x + board.w - 62;
  const by = board.y + 9;
  ctx.fillStyle = cssHex(P.bolt);
  ctx.beginPath();
  ctx.moveTo(bx + 24, by);
  ctx.lineTo(bx + 2, by + 34);
  ctx.lineTo(bx + 18, by + 34);
  ctx.lineTo(bx + 8, by + 56);
  ctx.lineTo(bx + 42, by + 20);
  ctx.lineTo(bx + 26, by + 20);
  ctx.lineTo(bx + 38, by);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A post with a magenta diamond and a yellow chevron pointing right; a sign right of the road is flipped. */
function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = 74;
  const r = 56;
  ctx.fillStyle = cssHex(P.post);
  ctx.fillRect(cx - 5, cy, 10, h - 6 - cy);
  const diamond = (rr: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - rr);
    ctx.lineTo(cx + rr, cy);
    ctx.lineTo(cx, cy + rr);
    ctx.lineTo(cx - rr, cy);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = cssHex(P.diamondEdge);
  diamond(r);
  ctx.fillStyle = cssHex(P.diamond);
  diamond(r - 5);
  const t = 14; // the chevron's arm, measured across
  ctx.fillStyle = cssHex(P.chevron);
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy - 30);
  ctx.lineTo(cx - 26 + t, cy - 30);
  ctx.lineTo(cx + 12 + t, cy);
  ctx.lineTo(cx - 26 + t, cy + 30);
  ctx.lineTo(cx - 26, cy + 30);
  ctx.lineTo(cx + 12, cy);
  ctx.closePath();
  ctx.fill();
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface Placed {
  prop: BuiltProp;
  obj: Phaser.GameObjects.Image;
  /** Display scale per px of projected scale: the kind's height in world units over its texture height. */
  k: number;
}

/**
 * The roadside props of a built track as depth-scaled sprites, placed the way the Race scene
 * places its boxes: one image per prop with its foot at the projected ground point. `update`
 * projects only the props within `camera.fogFar + ui.props.reach` ahead of the eye along its
 * heading (the fog is measured along that axis too, so nothing still visible is ever cut),
 * fades them with the ground fog, and hides the rest. The engine knows nothing about them.
 */
export class Props {
  private readonly items: Placed[];
  private readonly reach: number;

  constructor(scene: Phaser.Scene, built: BuiltTrack, private readonly depthBase: number) {
    ensurePropTextures(scene);
    this.items = built.props.map((prop) => ({
      prop,
      obj: scene.add.image(0, 0, KEY[prop.kind]).setOrigin(0.5, 1).setDepth(depthBase).setVisible(false).setFlipX(prop.kind === 'sign' && prop.offset > 0),
      k: SIZE[prop.kind].h / TEX[prop.kind].h,
    }));
    this.reach = C.camera.fogFar + SIZE.reach;
  }

  /** Places the props within reach ahead of `eye` (the camera's ground point and heading) and hides the others. */
  update(view: Mode7View, eye: Vec & { yaw: number }): void {
    const cos = Math.cos(eye.yaw);
    const sin = Math.sin(eye.yaw);
    for (const { prop, obj, k } of this.items) {
      const along = (prop.x - eye.x) * cos + (prop.y - eye.y) * sin;
      const p = along >= -2 && along <= this.reach ? view.project(prop) : null;
      const alpha = p ? 1 - smoothstep(C.camera.fogNear, C.camera.fogFar, p.depth) : 0;
      if (!p || alpha <= 0.01) {
        obj.setVisible(false);
        continue;
      }
      obj.setVisible(true).setPosition(p.x, p.y).setScale(k * p.scale).setAlpha(alpha).setDepth(this.depthBase + p.y / SH);
    }
  }

  /** How many props are placed right now; the performance note in the plan counts these. */
  get shown(): number {
    return this.items.reduce((n, i) => n + (i.obj.visible ? 1 : 0), 0);
  }

  destroy(): void {
    for (const item of this.items) item.obj.destroy();
  }
}
