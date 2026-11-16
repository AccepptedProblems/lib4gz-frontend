import Phaser from 'phaser';
import { C, cssHex } from '../engine/constants';
import { DEPTH } from './depth';
import { label } from './widgets';

const UI = C.ui;
const FX = UI.fx;
const STREAK = UI.streak;
const W = UI.stage.w;
const H = UI.stage.h;
/** The shout's scale at the end of its tween. */
export const SHOUT_GROWN = 1.15;

/**
 * The race's feedback: the countdown, speed lines and the edge vignette of a boost, the
 * blue edge pulse of the streak's Lightning tier, the screen flash, the shout, and the kart's
 * lurch on a boost. Built only when the view draws. `calm` drops the lurch and the shout's
 * tween; everything else stays.
 */
export class RaceFx {
  /** Tweened screen offsets the scene adds to the kart's place. */
  readonly jolt = { lurch: 0 };
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly vignette: Phaser.GameObjects.Image;
  private readonly lightning: Phaser.GameObjects.Image;
  private readonly speedLines: Phaser.GameObjects.Graphics;
  private readonly countdownText: Phaser.GameObjects.Text;
  private readonly countdownShadow: Phaser.GameObjects.Text;
  private boosting = false;

  constructor(private readonly scene: Phaser.Scene, private readonly calm: boolean) {
    // The vignettes first, so they sit under the speed lines at the same depth.
    this.vignette = scene.add.image(W / 2, H / 2, vignetteTexture(scene, 'fx-vignette', FX.vignette)).setDisplaySize(W, H).setDepth(DEPTH.lines).setAlpha(0);
    this.lightning = scene.add.image(W / 2, H / 2, vignetteTexture(scene, 'fx-vignette-lightning', STREAK.vignette)).setDisplaySize(W, H).setDepth(DEPTH.lines).setAlpha(0);
    this.speedLines = scene.add.graphics().setDepth(DEPTH.lines).setAlpha(0);
    this.flash = scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setDepth(DEPTH.flash).setAlpha(0);
    // The countdown: yellow over a short dark drop shadow, so it reads over the sky.
    this.countdownShadow = label(scene, W / 2 + 3, H * 0.4 + 3, '3', { size: FX.shoutSize * 2, bold: true, color: cssHex(UI.colors.bg) }).setDepth(DEPTH.shout);
    this.countdownText = label(scene, W / 2, H * 0.4, '3', { size: FX.shoutSize * 2, bold: true, color: cssHex(UI.colors.yellow) }).setDepth(DEPTH.shout);
  }

  /** 3, 2, 1, GO, a second each; `onGo` runs as GO shows, and the word then fades out. */
  countdown(onGo: () => void): void {
    const steps = ['3', '2', '1', 'GO'];
    let i = 0;
    const both = [this.countdownText, this.countdownShadow];
    const show = (text: string): void => both.forEach((t) => t.setText(text).setVisible(true));
    show(steps[0]);
    this.scene.time.addEvent({
      delay: 1000,
      repeat: steps.length - 1,
      callback: () => {
        i++;
        if (i < steps.length) {
          show(steps[i]);
          if (steps[i] === 'GO') {
            onGo();
            this.scene.tweens.add({ targets: both, alpha: 0, duration: 500, delay: 300, onComplete: () => both.forEach((t) => t.setVisible(false)) });
          }
        }
      },
    });
  }

  /**
   * Streaks rushing in from the stage edges, `strength` 1 for a boost and 2 for a Double Boost:
   * each a bright head toward the centre and a tail fading out toward the edge, denser near
   * the corners, never inside the centre third of the stage, so the kart and the panel stay
   * clean.
   */
  burstSpeedLines(strength: number): void {
    const g = this.speedLines.clear().setAlpha(1);
    const cx = W / 2;
    const cy = H / 2;
    for (let i = 0; i < FX.speedLines * strength; i++) {
      // Two in three streaks sit near a diagonal, the rest anywhere round.
      const diagonal = Math.atan2(H, W);
      const a = Math.random() < 0.67
        ? [diagonal, Math.PI - diagonal, Math.PI + diagonal, -diagonal][Math.floor(Math.random() * 4)] + (Math.random() - 0.5) * 0.5
        : Math.random() * Math.PI * 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      // Where the ray leaves the centre third's box and where it meets the stage edge.
      const rBox = Math.min(Math.abs(W / 6 / ux), Math.abs(H / 6 / uy));
      const rEdge = Math.min(Math.abs(cx / ux), Math.abs(cy / uy));
      const head = rBox + (rEdge - rBox) * (0.1 + Math.random() * 0.35);
      const tail = Math.min(rEdge, head + 80 + Math.random() * 120 * strength);
      const colour = FX.speedLine[i % 2];
      // Three segments from the head out, each dimmer than the last.
      const alphas = [1, 0.55, 0.22];
      for (let k = 0; k < 3; k++) {
        const r0 = head + ((tail - head) * k) / 3;
        const r1 = head + ((tail - head) * (k + 1)) / 3;
        g.lineStyle(FX.speedLineW, colour, FX.speedLineAlpha * alphas[k]);
        g.lineBetween(cx + ux * r0, cy + uy * r0, cx + ux * r1, cy + uy * r1);
      }
    }
    this.scene.tweens.killTweensOf(this.speedLines);
    this.scene.tweens.add({ targets: this.speedLines, alpha: 0, duration: FX.speedLineMs });
  }

  /** The edge vignette fades in while a boost runs and out when it ends; a call that changes nothing is ignored. */
  setBoosting(on: boolean): void {
    if (on === this.boosting) return;
    this.boosting = on;
    this.scene.tweens.killTweensOf(this.vignette);
    this.scene.tweens.add({ targets: this.vignette, alpha: on ? FX.vignetteAlpha : 0, duration: FX.speedLineMs });
  }

  /** Called every racing frame: while the streak is at Lightning the stage edge pulses blue on race time `nowMs`, else it is clear. */
  setLightning(on: boolean, nowMs: number): void {
    const [lo, hi] = STREAK.vignetteAlpha;
    const pulse = 0.5 + 0.5 * Math.sin((nowMs / 1000) * STREAK.pulseHz * 2 * Math.PI);
    this.lightning.setAlpha(on ? lo + (hi - lo) * pulse : 0);
  }

  flashScreen(rgb: [number, number, number]): void {
    this.flash.setFillStyle(Phaser.Display.Color.GetColor(rgb[0], rgb[1], rgb[2])).setAlpha(0.4);
    this.scene.tweens.killTweensOf(this.flash);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: FX.flashMs });
  }

  /**
   * A word over the road, outlined in the dusk colour so it reads on the orange horizon band,
   * that grows and fades; it just sits for a moment under reduced motion. The fade eases in,
   * so the word stays above half alpha for about four fifths of `fx.shoutMs`: with sound off
   * it is the only sign of a tier or a lost streak, and Splash slides in a fifth of a second
   * after the answer. It stays clear above the tallest question block (`race-webgl.spec.ts`).
   */
  shout(text: string, color: string): void {
    const t = label(this.scene, W / 2, H * 0.3, text, { size: FX.shoutSize, bold: true, color })
      .setStroke(cssHex(UI.colors.bg), FX.shoutStroke).setDepth(DEPTH.shout);
    if (this.calm) {
      this.scene.time.delayedCall(FX.shoutMs, () => t.destroy());
      return;
    }
    t.setScale(0.6);
    this.scene.tweens.add({ targets: t, scale: SHOUT_GROWN, alpha: { value: 0, ease: 'Cubic.easeIn' }, duration: FX.shoutMs, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /** The kart jumps forward on a boost. */
  lurch(): void {
    if (this.calm) return;
    this.jolt.lurch = FX.boostLurchPx;
    this.scene.tweens.add({ targets: this.jolt, lurch: 0, duration: FX.boostMs, ease: 'Cubic.easeOut' });
  }
}

/**
 * A vignette's texture `key`, drawn once per game: clear at the centre, `colour` at the
 * edges and full at the corners, 512 by 256 (a power of two) stretched over the stage.
 */
function vignetteTexture(scene: Phaser.Scene, key: string, colour: number): string {
  if (scene.textures.exists(key)) return key;
  const w = 512;
  const h = 256;
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) return key;
  const ctx = canvas.context;
  const { r, g, b } = Phaser.Display.Color.IntegerToRGB(colour);
  const rgba = (a: number): string => `rgba(${r}, ${g}, ${b}, ${a})`;
  // Drawn squashed to half height, so the circular gradient covers the canvas as an ellipse
  // whose radius 1 reaches the corners and about 0.7 the middle of each edge.
  ctx.save();
  ctx.scale(1, 0.5);
  const grad = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, Math.hypot(w / 2, h));
  grad.addColorStop(0, rgba(0));
  grad.addColorStop(0.45, rgba(0));
  grad.addColorStop(0.72, rgba(0.45));
  grad.addColorStop(1, rgba(1));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 2);
  ctx.restore();
  canvas.refresh();
  return key;
}
