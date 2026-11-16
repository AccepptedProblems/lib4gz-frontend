import Phaser from 'phaser';
import { C, cssHex } from '../engine/constants';
import { Tier } from '../engine/streak';
import { boltPoints } from '../look/bolt';
import { INK } from '../look/head';
import { label } from './widgets';

const STREAK = C.ui.streak;

/**
 * A racer's streak badge: a bolt on an ink disc, both in the tier's colour, with the count
 * beside it. It is drawn from the count, the tier and the kart's on-screen width alone, so
 * phase 3 can hang one over any racer. It is its own Graphics and Text over the kart, outside
 * `drawRacer`'s and `drawKartTop`'s call budgets: three fill and stroke calls, redrawn only
 * when the count, the tier or its whole-px radius changes.
 */
export class Badge {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly count: Phaser.GameObjects.Text;
  private drawn = '';
  private r = 0;
  private colour = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setVisible(false);
    this.count = label(scene, 0, 0, '', { bold: true, originX: 0 }).setVisible(false);
  }

  get shown(): boolean {
    return this.g.visible;
  }

  /** The disc and the count, for a caller that moves the badge in a container. */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.g, this.count];
  }

  /** The disc and the count side by side, in stage px, as last shown. */
  get width(): number {
    return 2.2 * this.r + this.count.width;
  }

  /** The disc's height in stage px, as last shown. */
  get height(): number {
    return 2 * this.r;
  }

  /**
   * Shows `count` at `tier` for a kart `s` stage px wide (the behind view's width at its
   * depth), the disc and the count centred over `x` with their bottom `y`, at `depth`.
   */
  show(x: number, y: number, s: number, count: number, tier: Tier, depth: number): void {
    const look = STREAK.tiers[tier];
    const r = Math.max(1, Math.round(STREAK.badgeR * look.badge * s));
    const key = `${count} ${tier} ${r}`;
    if (key !== this.drawn) {
      this.drawn = key;
      const bolt = boltPoints(0, 0, 0.72 * r); // its tips well inside the ring
      this.g.clear().fillStyle(INK, 1).fillCircle(0, 0, r)
        .lineStyle(0.16 * r, look.colour, 1).strokeCircle(0, 0, r)
        .fillStyle(look.colour, 1).fillPoints(bolt, true);
      this.count.setText(`×${count}`).setFontSize(Math.round(1.3 * r)).setColor(cssHex(look.colour)).setStroke(cssHex(INK), Math.max(2, Math.round(0.3 * r)));
    }
    this.r = r;
    this.colour = look.colour;
    const gap = 0.2 * r;
    const cx = x - (2 * r + gap + this.count.width) / 2 + r;
    const cy = y - r;
    this.g.setPosition(cx, cy).setDepth(depth).setVisible(true);
    this.count.setPosition(cx + r + gap, cy).setDepth(depth).setVisible(true);
  }

  hide(): void {
    this.g.setVisible(false);
    this.count.setVisible(false);
  }

  /** The streak broke from three or more: the badge breaks into shards, ink and the tier's colour, that fall and fade where it was. */
  shatter(): void {
    if (this.shown) {
      const { x, y, depth } = this.g;
      const r = this.r;
      for (let i = 0; i < STREAK.shards; i++) {
        const a = ((i + Math.random() * 0.5) / STREAK.shards) * 2 * Math.PI;
        const sx = x + 0.5 * r * Math.cos(a);
        const sy = y + 0.5 * r * Math.sin(a);
        const k = STREAK.shard * r;
        const shard = this.scene.add.triangle(sx, sy, 0, 0, 0.9 * k, 0.25 * k, 0.3 * k, 0.85 * k, i % 2 ? INK : this.colour)
          .setStrokeStyle(Math.max(1, 0.08 * r), i % 2 ? this.colour : INK).setRotation(a).setDepth(depth);
        this.scene.tweens.add({
          targets: shard, duration: STREAK.shardMs,
          x: sx + (0.6 + 0.6 * Math.random()) * r * Math.cos(a),
          y: { value: sy + STREAK.fall * r, ease: 'Quad.easeIn' },
          rotation: a + (Math.random() - 0.5) * 4,
          alpha: { value: 0, ease: 'Cubic.easeIn' },
          onComplete: () => shard.destroy(),
        });
      }
    }
    this.hide();
  }
}
