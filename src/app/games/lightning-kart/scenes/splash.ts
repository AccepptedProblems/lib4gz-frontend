import Phaser from 'phaser';
import { C, cssHex } from '../engine/constants';
import {
  BOTTLE_TIP, drawBottle, drawBubble, drawBurst, drawPop, drawSplash, GUN_DOWN, splashAim, splashBottleH, splashRelease,
} from '../look/splash';
import { DEPTH } from './depth';
import { label } from './widgets';

type Pt = { x: number; y: number };

const T = C.splash;
const LOOK = C.ui.splash;
const SAY = LOOK.say;
const COLORS = C.ui.colors;
const W = C.ui.stage.w;
// Her feet on the stage: the right edge at mid height, clear of the time and best (they end
// about y 122). The ponytail ends about 0.6 h right of X.
const X = 836;
const Y = 345;
const OFF = W + LOOK.h; // her feet once she is past the right edge: she reaches 0.7 h left of them
/** What she says as she throws the bottle; the game has no voice files. */
const LINE = 'Nhớ uống nước nha';

/** What she throws: the bubble on a wrong answer or a timeout, the bottle on a right one. */
export type Throw = 'bubble' | 'bottle';

/** Race ms from the moment she throws, after the verdict, to the throw leaving her and to its landing. */
const AT: Record<Throw, { fire: number; hit: number }> = {
  bubble: { fire: T.aimMs, hit: T.aimMs + T.flightMs },
  bottle: { fire: T.windUpMs, hit: T.windUpMs + T.throwMs },
};

/** What a throw calls back, once each, on race time. */
export interface SplashHooks {
  /** She throws: the bubble leaves the gun, or the bottle her hand. */
  fire(): void;
  /** It lands on the kart. */
  hit(): void;
}

interface Run {
  startMs: number;
  /** Set by the verdict: what she throws, from when, and what it calls. Null while the verdict is out. */
  throw: { kind: Throw; atMs: number; on: SplashHooks } | null;
  /** Set by a void verdict: she leaves from here with nothing thrown. */
  leaveMs: number | null;
  her: Phaser.GameObjects.Graphics;
  shot: Phaser.GameObjects.Graphics;
  /** Her speech bubble and its line, on a bottle throw. */
  say: { g: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text } | null;
  /** Where the throw left her; null before. */
  from: Pt | null;
  hit: boolean;
}

/**
 * Splash's run, placed from race time every frame so it is the same on every machine. She
 * starts at the press: she slides in from the right edge and waits for the verdict. A right
 * one: she says her line and throws the bottle; a wrong one or a timeout: she aims her gun and
 * fires the bubble; either flies to the point the scene gives (the racer's head) and lands
 * there, the bubble bursting in water, the bottle splashing; and she slides out. A void one: she slides out with nothing thrown. Her objects are destroyed when the run
 * ends. One run at a time. Nothing is tweened or timed, so a scene that shuts down mid-run
 * leaves nothing running. `calm` (reduced motion) shows her in place for the slides' time;
 * the throw still flies.
 */
export class Splash {
  private run: Run | null = null;
  /** The last throw's landing, the bubble's burst or the bottle's splash, playing out over `popMs` at the point the scene gives, whatever run comes next. */
  private landing: { g: Phaser.GameObjects.Graphics; gun: boolean; atMs: number } | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly calm: boolean) {}

  /** True while a run waits for its verdict: she has come, nothing is decided. */
  private get waiting(): boolean {
    return !!this.run && !this.run.throw && this.run.leaveMs === null;
  }

  /** Starts a run at race time `nowMs`, at the press. A run whose throw is short of its landing lands it at once, so every throw lands exactly once, its landing playing out in full. */
  start(nowMs: number): void {
    if (this.run?.throw && !this.run.hit) this.land(this.run, nowMs);
    this.end();
    this.run = {
      startMs: nowMs, throw: null, leaveMs: null, from: null, hit: false, say: null,
      her: this.scene.add.graphics().setDepth(DEPTH.splash),
      shot: this.scene.add.graphics().setDepth(DEPTH.splash).setVisible(false),
    };
  }

  /** The verdict at `nowMs` for the run `start` began at the press: she throws `kind` as soon as she has arrived. */
  decide(nowMs: number, kind: Throw, on: SplashHooks): void {
    const run = this.run;
    if (!run || !this.waiting) return;
    run.throw = { kind, atMs: Math.max(nowMs, run.startMs + T.slideInMs), on };
    if (kind === 'bottle') {
      run.say = { g: this.scene.add.graphics().setDepth(DEPTH.splash), text: label(this.scene, 0, 0, LINE, { size: SAY.size, bold: true, color: cssHex(SAY.ink) }).setDepth(DEPTH.splash) };
    }
  }

  /** A void verdict at `nowMs`: a waiting run slides out with nothing thrown. */
  leave(nowMs: number): void {
    if (this.waiting) this.run!.leaveMs = nowMs;
  }

  /** Per frame, at race time `nowMs` with the kart's screen point at `kart`: places her and the throw, fires the hooks when their time has come, and plays out the last landing there. */
  tick(nowMs: number, kart: Pt): void {
    this.tickRun(nowMs, kart);
    const landing = this.landing;
    if (!landing) return;
    const t = (nowMs - landing.atMs) / LOOK.popMs;
    if (t >= 1) {
      landing.g.destroy();
      this.landing = null;
      return;
    }
    const g = landing.g.clear().setPosition(kart.x, kart.y);
    if (landing.gun) drawBurst(g, 0, 0, LOOK.burst.r, t);
    else drawPop(g, 0, 0, LOOK.bubbleR, t, COLORS.yellow);
  }

  /** The throw of `run` lands at `nowMs`: its hook fires and its landing starts, in a Graphics of its own that outlives the run. */
  private land(run: Run, nowMs: number): void {
    run.hit = true;
    this.landing?.g.destroy();
    this.landing = { g: this.scene.add.graphics().setDepth(DEPTH.splash), gun: run.throw!.kind === 'bubble', atMs: nowMs };
    run.throw!.on.hit();
  }

  private tickRun(nowMs: number, kart: Pt): void {
    const run = this.run;
    if (!run) return;
    const t = nowMs - run.startMs;
    const arriving = this.calm ? X : t < T.slideInMs ? OFF + (X - OFF) * Phaser.Math.Easing.Cubic.Out(t / T.slideInMs) : X;

    // A void: out from wherever she stood when it came, then gone.
    if (run.leaveMs !== null) {
      const out = nowMs - run.leaveMs;
      if (out >= T.slideOutMs) { this.end(); return; }
      const from = this.calm ? X : run.leaveMs - run.startMs < T.slideInMs ? OFF + (X - OFF) * Phaser.Math.Easing.Cubic.Out((run.leaveMs - run.startMs) / T.slideInMs) : X;
      drawSplash(run.her.clear(), this.calm ? X : from + (OFF - from) * ((out / T.slideOutMs) ** 3), Y, LOOK.h, 0, 'none');
      return;
    }
    // Waiting for the verdict: in, empty-handed.
    if (!run.throw) {
      drawSplash(run.her.clear(), arriving, Y, LOOK.h, 0, 'none');
      return;
    }

    const { kind, atMs, on } = run.throw;
    const at = AT[kind];
    const fireMs = atMs + at.fire;
    const hitMs = atMs + at.hit;
    const gun = kind === 'bubble';
    const ready = Phaser.Math.Easing.Cubic.Out(Math.min(1, Math.max(0, (nowMs - atMs) / at.fire)));
    const aim = gun ? GUN_DOWN + (splashAim(X, Y, LOOK.h, kart) - GUN_DOWN) * ready : BOTTLE_TIP * ready;
    if (!run.from && nowMs >= fireMs) {
      run.from = splashRelease(X, Y, LOOK.h, aim, gun ? 'gun' : 'bottle');
      if (gun) drawBubble(run.shot, 0, 0, LOOK.bubbleR);
      else drawBottle(run.shot, 0, 0, splashBottleH(LOOK.h));
      on.fire();
    }
    if (!run.hit && nowMs >= hitMs) this.land(run, nowMs);
    if (nowMs >= hitMs + T.slideOutMs) {
      this.end();
      return;
    }

    const x = this.calm ? X : nowMs > hitMs ? X + (OFF - X) * (((nowMs - hitMs) / T.slideOutMs) ** 3) : arriving;
    run.her.clear().setVisible(nowMs < hitMs + T.slideOutMs);
    drawSplash(run.her, x, Y, LOOK.h, aim, gun ? 'gun' : run.from ? 'none' : 'bottle');
    if (run.say) this.say(run.say, x, nowMs < hitMs + T.slideOutMs);

    // The bubble swells out of the muzzle, the bottle tumbles in a higher lob; either arcs to
    // wherever the kart is now and lands there.
    const shot = run.shot;
    if (run.from && !run.hit) {
      const f = (nowMs - fireMs) / (hitMs - fireMs);
      shot.setVisible(true).setScale(gun ? 0.5 + 0.5 * Math.min(1, 3 * f) : 1).setRotation(gun ? 0 : -2 * Math.PI * f)
        .setPosition(run.from.x + (kart.x - run.from.x) * f, run.from.y + (kart.y - run.from.y) * f - (gun ? LOOK.arc : LOOK.lob) * Math.sin(Math.PI * f));
    } else {
      shot.setVisible(false);
    }
  }

  /** Her speech bubble beside her head for her feet at `x`: a rounded plate with a tail down to her, the line in it. */
  private say(say: { g: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text }, x: number, shown: boolean): void {
    say.g.setVisible(shown);
    say.text.setVisible(shown);
    if (!shown) return;
    const tip = { x: x + SAY.tipX * LOOK.h, y: Y + SAY.tipY * LOOK.h };
    const w = say.text.width + 2 * SAY.padX;
    const h = say.text.height + 2 * SAY.padY;
    const right = tip.x + SAY.tail; // the tail leans down and right to her
    const left = right - w;
    const top = tip.y - SAY.tail - h;
    say.text.setPosition(left + w / 2, top + h / 2);
    say.g.clear()
      .fillStyle(SAY.fill, 1).fillRoundedRect(left, top, w, h, SAY.r)
      .fillTriangle(right - 2 * SAY.tail, top + h - 1, right - SAY.tail / 2, top + h - 1, tip.x, tip.y)
      .lineStyle(SAY.outline, SAY.ink, 1).strokeRoundedRect(left, top, w, h, SAY.r)
      .lineBetween(right - 2 * SAY.tail, top + h, tip.x, tip.y).lineBetween(right - SAY.tail / 2, top + h, tip.x, tip.y);
  }

  private end(): void {
    this.run?.her.destroy();
    this.run?.shot.destroy();
    this.run?.say?.g.destroy();
    this.run?.say?.text.destroy();
    this.run = null;
  }
}
