import Phaser from 'phaser';
import { RaceQuestionResponse } from '../../../shared/models';
import { bridgeOf } from '../bridge';
import { Character, characterOf, Kart as KartLook, kartOf } from '../catalogue';
import { drawKartTop } from '../draw-racer';
import {
  createEngineSound, EngineSound, playBuzzer, playChime, playFanfare, playLapTone, playRumble, playThud, playWhoosh,
  Screech, setEngineSpeed, startScreech, stopEngineSound, stopScreech,
} from '../engine/audio';
import { C } from '../engine/constants';
import { addCharge, applySlow, createRace, fireNitro, hudState, LOCAL_RACER, Race, RaceEvent, step } from '../engine/race';
import { mulberry32, shuffle } from '../engine/seed';
import { hasWebGL, Mode7Camera, Mode7View } from '../render/mode7';
import { createTrackTexture, TrackTexture } from '../render/track-texture';
import { wrapAngle } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { RaceOutcome, ScopeChoice } from './data';
import { SCENE } from './keys';
import { reducedMotion } from './motion';
import { button, Button, cornerButton, formatTime, label, setupStage, wrapText } from './widgets';

const UI = C.ui;
const ROAD = UI.road;
const FX = UI.fx;
const W = UI.stage.w;
const H = UI.stage.h;
const DEPTH = { ground: 0, world: 10, lines: 90, hud: 100, flash: 150, overlay: 200, shout: 300 };
const KEY_NUMBERS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

interface OpenQuestion {
  question: RaceQuestionResponse;
  openedMs: number;
  container: Phaser.GameObjects.Container;
  countdown: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  barX: number;
  barY: number;
  barW: number;
}

/**
 * The race: the engine stepped every frame, the track seen through the mode 7 view from
 * behind the kart, boxes and the kart placed by projection, the countdown, the HUD, the
 * question overlay, and every row of the design file's Feedback table. Left/Right or A/D
 * steer, Down or S drifts, Up, W or Space fires a charge, 1 to 6 answer, Escape twice
 * quits. Touch: hold a half of the stage to steer, Drift and Nitro buttons in the bottom
 * corners. Without WebGL only one line of text shows.
 */
export class RaceScene extends Phaser.Scene {
  private choice!: ScopeChoice;
  private race!: Race;
  private seed = 0;
  private phase: 'countdown' | 'racing' | 'done' = 'countdown';
  private playable = false;
  private calm = false;

  private view: Mode7View | null = null;
  private texture!: TrackTexture;
  private cam!: Mode7Camera;
  private look!: { character: Character; kart: KartLook };
  private kartObj!: Phaser.GameObjects.Container;
  private kartG!: Phaser.GameObjects.Graphics;
  private boxes: Phaser.GameObjects.Rectangle[] = [];
  private hud!: { lap: Phaser.GameObjects.Text; time: Phaser.GameObjects.Text; best: Phaser.GameObjects.Text; effect: Phaser.GameObjects.Text; slot: Phaser.GameObjects.Graphics };
  private soundButton!: Button;
  private countdownText!: Phaser.GameObjects.Text;

  // feedback state
  private flash!: Phaser.GameObjects.Rectangle;
  private speedLines!: Phaser.GameObjects.Graphics;
  private jolt = { lurch: 0, wobble: 0 }; // tweened screen offsets of the kart
  private doubleBoost = false;
  private dustAtMs = 0;
  private dustTicks = 0;
  private skid: { lx: number; ly: number; rx: number; ry: number } | null = null;
  private skidShownMs = 0;

  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'down' | 's', Phaser.Input.Keyboard.Key> | null;
  private pointerSteer = 0;
  private steerPointer = -1;
  private touchDrift = false;
  private lastEscapeMs = -Infinity;

  private deck: RaceQuestionResponse[] = [];
  private dealt = 0;
  private open: OpenQuestion | null = null;
  private correctCount = 0;
  private wrongCount = 0;
  private missed: RaceQuestionResponse[] = [];

  private hum: EngineSound | null = null;
  private screech: Screech | null = null;

  constructor() {
    super(SCENE.race);
  }

  init(choice: ScopeChoice): void {
    this.choice = choice;
    this.seed = Math.floor(Math.random() * 0x100000000);
    this.deck = shuffle(choice.questions, mulberry32(this.seed));
    this.dealt = 0;
    this.open = null;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.missed = [];
    this.phase = 'countdown';
    this.view = null;
    this.pointerSteer = 0;
    this.steerPointer = -1;
    this.touchDrift = false;
    this.lastEscapeMs = -Infinity;
    this.jolt = { lurch: 0, wobble: 0 };
    this.doubleBoost = false;
    this.dustAtMs = 0;
    this.dustTicks = 0;
    this.skid = null;
    this.skidShownMs = 0;
    this.screech = null;
  }

  create(): void {
    setupStage(this);
    const data = bridgeOf(this).data;
    const trackDef = data.track === 'test' ? TEST_TRACK : LAP;
    this.race = createRace({ seed: this.seed, track: trackDef, laps: C.laps, racers: [{ id: LOCAL_RACER, appearance: data.look }] });
    this.look = { character: characterOf(data.look.characterId), kart: kartOf(data.look.kartId) };
    this.playable = hasWebGL(this);
    this.calm = reducedMotion();

    cornerButton(this, 'Quit', () => this.quit()).setDepth(DEPTH.hud);
    if (!this.playable) {
      wrapText(this, W / 2, H / 2, 'Lightning Kart needs WebGL in this browser', W - 4 * UI.pad, { color: UI.colors.danger });
      return;
    }

    this.texture = createTrackTexture(this, `track-${data.track ?? 'lap'}`, this.race.built);
    this.view = new Mode7View(this, this.texture);
    this.view.shader.setDepth(DEPTH.ground);
    const me = this.race.racers[0];
    this.cam = { x: me.x - C.camera.back, y: me.y, yaw: me.heading, height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg };
    this.boxes = this.race.boxes.map(() => this.add.rectangle(0, 0, 10, 10, ROAD.box).setStrokeStyle(2, ROAD.boxEdge).setOrigin(0.5, 1).setDepth(DEPTH.world).setVisible(false));
    this.kartG = this.add.graphics();
    this.kartObj = this.add.container(0, 0, [this.kartG]).setDepth(DEPTH.world + 1);
    this.speedLines = this.add.graphics().setDepth(DEPTH.lines).setAlpha(0);
    this.flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setDepth(DEPTH.flash).setAlpha(0);

    // HUD: lap, time, best, effect, the held-item slot; Sound top right beside Quit.
    const best = data.leaderboard?.mine?.finishMs;
    const hudLabel = (x: number, text: string): Phaser.GameObjects.Text =>
      label(this, x, UI.pad + 18, text, { size: UI.font.hud, bold: true, originX: 0 }).setDepth(DEPTH.hud);
    this.hud = {
      lap: hudLabel(UI.pad, ''),
      time: hudLabel(UI.pad + 120, ''),
      best: hudLabel(UI.pad + 240, `Best ${best === undefined ? '–' : formatTime(best)}`),
      effect: hudLabel(UI.pad + 400, ''),
      slot: this.add.graphics().setDepth(DEPTH.hud),
    };
    this.soundButton = cornerButton(this, 'Sound on', () => this.toggleSound(), 1).setDepth(DEPTH.hud);
    this.countdownText = label(this, W / 2, H * 0.4, '3', { size: FX.shoutSize * 2, bold: true }).setDepth(DEPTH.shout);

    this.setupInput();
    this.startCountdown();
    this.placeWorld();
    this.drawHud();
    // On shutdown the display list is already gone, so only the audio is stopped here, never a label.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopAudio());
  }

  override update(_time: number, delta: number): void {
    if (!this.playable || this.phase === 'done') return;
    const dt = Math.min(delta / 1000, C.maxStepS);
    let events: RaceEvent[] = [];
    if (this.phase === 'racing') {
      events = step(this.race, dt, { steer: this.pointerSteer || this.keySteer(), drift: this.touchDrift || this.keyDrift() });
      this.tickQuestion();
      this.tickFeedback();
    }
    this.followKart(dt);
    this.placeWorld();
    this.drawHud();
    if (this.hum) setEngineSpeed(this.hum, (this.race.racers[0].speed / C.kart.topSpeed) * hudState(this.race, LOCAL_RACER).speed);
    this.handleEvents(events);
  }

  /** Engine events of one frame. Public so the flow spec can force a finish. */
  handleEvents(events: RaceEvent[]): void {
    for (const event of events) {
      if (event.type === 'item' && event.kind === 'question') {
        if (!this.open && this.phase === 'racing') this.openQuestion(this.nextQuestion());
      } else if (event.type === 'bump') {
        this.shake(event.steep ? FX.shakeBump : FX.shakeOffroad);
        if (this.hum) playThud(this.hum.ctx);
      } else if (event.type === 'lap') {
        this.lapFlip(event.lap);
        if (this.hum) playLapTone(this.hum.ctx);
      } else if (event.type === 'finish') {
        this.closeQuestion(); // a question still open at the line counts neither way
        this.phase = 'done';
        if (this.hum) playFanfare(this.hum.ctx);
        const outcome: RaceOutcome = {
          choice: this.choice,
          seed: this.seed,
          finishMs: event.finishMs,
          correctCount: this.correctCount,
          wrongCount: this.wrongCount,
          missed: this.missed,
        };
        // Once per finish; the host posts it and refreshes the board.
        bridgeOf(this).intent('finished', {
          scope: this.choice.scope, finishMs: outcome.finishMs, correctCount: outcome.correctCount, wrongCount: outcome.wrongCount, seed: this.seed,
        });
        this.scene.start(SCENE.result, outcome);
        return;
      }
    }
  }

  quit(): void {
    this.scene.start(SCENE.ready, this.choice);
  }

  // ── Countdown ──

  private startCountdown(): void {
    const steps = ['3', '2', '1', 'GO'];
    let i = 0;
    this.countdownText.setText(steps[0]).setVisible(true);
    this.time.addEvent({
      delay: 1000,
      repeat: steps.length - 1,
      callback: () => {
        i++;
        if (i < steps.length) {
          this.countdownText.setText(steps[i]);
          if (steps[i] === 'GO') {
            this.phase = 'racing';
            this.tweens.add({ targets: this.countdownText, alpha: 0, duration: 500, delay: 300, onComplete: () => this.countdownText.setVisible(false) });
          }
        }
      },
    });
  }

  // ── Input ──

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    this.keys = keyboard ? (keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D', down: 'DOWN', s: 'S' }) as RaceScene['keys']) : null;
    keyboard?.on('keydown-ESC', () => {
      const now = this.race.elapsedMs;
      if (now - this.lastEscapeMs < UI.escapeTwiceMs) this.quit();
      this.lastEscapeMs = now;
    });
    for (const code of ['UP', 'W', 'SPACE']) keyboard?.on(`keydown-${code}`, () => this.fire());
    KEY_NUMBERS.forEach((code, i) => keyboard?.on(`keydown-${code}`, () => {
      if (this.open && i < this.open.question.options.length) this.answer(i);
    }));

    this.input.addPointer(2);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length) return;
      this.steerPointer = pointer.id;
      this.pointerSteer = pointer.x < this.scale.gameSize.width / 2 ? -1 : 1;
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.steerPointer) {
        this.pointerSteer = 0;
        this.steerPointer = -1;
      }
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    if (this.sys.game.device.input.touch) {
      this.holdButton(UI.pad + 50, H - UI.pad - 50, 'Drift', (down) => { this.touchDrift = down; });
      this.holdButton(W - UI.pad - 50, H - UI.pad - 50, 'Nitro', (down) => { if (down) this.fire(); });
    }
  }

  /** A round button that reports press and release, for touch. */
  private holdButton(x: number, y: number, text: string, onChange: (down: boolean) => void): void {
    const g = this.add.graphics().setDepth(DEPTH.hud);
    const paint = (down: boolean): void => {
      g.clear().fillStyle(down ? UI.colors.buttonHover : UI.colors.button, 0.8).fillCircle(x, y, 44).lineStyle(2, FX.line, 0.6).strokeCircle(x, y, 44);
    };
    paint(false);
    label(this, x, y, text, { size: UI.font.small, bold: true }).setDepth(DEPTH.hud);
    const zone = this.add.zone(x, y, 96, 96).setInteractive().setDepth(DEPTH.hud);
    zone.on('pointerdown', () => { paint(true); onChange(true); });
    const up = (): void => { paint(false); onChange(false); };
    zone.on('pointerup', up);
    zone.on('pointerout', up);
  }

  private keySteer(): number {
    const k = this.keys;
    if (!k) return 0;
    return ((k.right.isDown || k.d.isDown) ? 1 : 0) - ((k.left.isDown || k.a.isDown) ? 1 : 0);
  }

  private keyDrift(): boolean {
    const k = this.keys;
    return !!k && (k.down.isDown || k.s.isDown);
  }

  /** Up, W, Space or the Nitro button: a boost, the chain, or nothing. */
  private fire(): void {
    if (this.phase !== 'racing') return;
    const result = fireNitro(this.race, LOCAL_RACER);
    if (result === 'none') return;
    const chained = result === 'chained';
    if (chained) this.doubleBoost = true;
    if (this.hum) playWhoosh(this.hum.ctx, chained);
    this.burstSpeedLines(chained ? 2 : 1);
    this.shout(chained ? 'DOUBLE BOOST' : 'NITRO', UI.colors.good);
    if (!this.calm) {
      this.jolt.lurch = FX.boostLurchPx;
      this.tweens.add({ targets: this.jolt, lurch: 0, duration: FX.boostMs, ease: 'Cubic.easeOut' });
    }
  }

  // ── Sound ──

  private toggleSound(): void {
    this.setSound(!this.hum);
  }

  /** Call from a pointer handler: audio starts only on a user gesture. Reuses Phaser's context when it has one. */
  private setSound(on: boolean): void {
    if (on && !this.hum) {
      const context = (this.sound as unknown as { context?: AudioContext }).context;
      this.hum = createEngineSound(context);
    } else if (!on) {
      this.stopAudio();
    }
    this.soundButton?.setLabel(this.hum ? 'Sound off' : 'Sound on');
  }

  /** Stops the hum and the screech; safe after the scene's objects are gone. */
  private stopAudio(): void {
    if (!this.hum) return;
    if (this.screech) stopScreech(this.hum.ctx, this.screech);
    this.screech = null;
    stopEngineSound(this.hum);
    this.hum = null;
  }

  // ── View ──

  /** The eye sits behind and above the kart and swings after its heading with a short lag. */
  private followKart(dt: number): void {
    const me = this.race.racers[0];
    const c = this.cam;
    c.yaw += wrapAngle(me.heading - c.yaw) * (1 - Math.exp(-dt / C.camera.headingTau));
    c.x = me.x - Math.cos(c.yaw) * C.camera.back;
    c.y = me.y - Math.sin(c.yaw) * C.camera.back;
    this.view?.setCamera(c);
  }

  private placeWorld(): void {
    const view = this.view;
    if (!view) return;
    const now = this.race.elapsedMs;
    this.race.boxes.forEach((box, i) => {
      const p = view.project(box);
      const obj = this.boxes[i];
      if (!p) { obj.setVisible(false); return; }
      const s = 2.4 * p.scale;
      const dark = box.hitAtMs !== null && now - box.hitAtMs < C.world.boxCooldownS * 1000;
      obj.setVisible(true).setPosition(p.x, p.y).setDisplaySize(s, s).setAlpha(dark ? 0.35 : 1).setDepth(DEPTH.world + p.y / H);
    });

    // The kart: the top-down look, turned by its heading relative to the eye, squashed by the
    // pitch so it lies on the ground, scaled by depth; the nitro flame trails it.
    const me = this.race.racers[0];
    const p = view.project(me);
    const g = this.kartG.clear();
    this.kartObj.setVisible(!!p);
    if (!p) return;
    const squash = Math.max(Math.sin(this.cam.pitch), UI.kart.minSquash);
    this.kartObj.setPosition(p.x + this.jolt.wobble, p.y - this.jolt.lurch).setScale(p.scale, p.scale * squash).setDepth(DEPTH.world + 1 + p.y / H);
    // `drawKartTop` points the nose along +x; a heading equal to the camera's points up the screen.
    this.kartG.setRotation(me.heading - this.cam.yaw - Math.PI / 2);
    const L = C.kart.length;
    g.fillStyle(0x000000, UI.kart.shadowAlpha).fillEllipse(0, 0, L * 1.1, L * 0.8);
    const boosted = me.effects.some((e) => e.type === 'boost');
    const flame = boosted ? { lengths: this.doubleBoost ? FX.doubleFlame : 1, colours: FX.flame, flicker: Math.random() } : null;
    drawKartTop(g, L, this.look.character, this.look.kart, flame);
  }

  private drawHud(): void {
    const hud = hudState(this.race, LOCAL_RACER);
    this.hud.lap.setText(`Lap ${hud.lap} / ${hud.laps}`);
    this.hud.time.setText(formatTime(Math.floor(hud.elapsedMs / 100) * 100));
    if (hud.effect) {
      const boost = hud.effect.type === 'boost';
      this.hud.effect.setText(`${boost ? 'Nitro' : 'Slow'} ${Math.ceil(hud.effect.left)}s`).setColor(boost ? UI.colors.good : UI.colors.danger);
    } else {
      this.hud.effect.setText(hud.drifting ? 'Drift' : '');
      this.hud.effect.setColor(UI.colors.muted);
    }
    // The slot: two circles, lit per charge; it pulses green while a fired charge would chain.
    const slot = UI.itemSlot;
    const x = UI.pad + 560;
    const y = UI.pad + 1;
    const pulse = hud.chainWindow ? 0.5 + 0.5 * Math.sin((hud.elapsedMs / 1000) * FX.chainPulseHz * 2 * Math.PI) : 0;
    const g = this.hud.slot.clear();
    const good = Phaser.Display.Color.HexStringToColor(UI.colors.good).color;
    g.lineStyle(2 + 2 * pulse, hud.chainWindow ? good : FX.line, hud.chainWindow ? 0.5 + 0.5 * pulse : 0.5).strokeRoundedRect(x, y, slot * 2, slot, 6);
    for (let i = 0; i < C.boost.maxCharges; i++) {
      const cx = x + slot / 2 + i * slot;
      const r = slot * (0.3 + 0.05 * pulse);
      if (i < hud.charges) g.fillStyle(ROAD.box, 1).fillCircle(cx, y + slot / 2, r);
      else g.lineStyle(1, FX.line, 0.35).strokeCircle(cx, y + slot / 2, r);
    }
  }

  // ── Feedback ──

  /** Per frame while racing: the drift's screech and skid marks, the grass's dust and rumble, the boost's end. */
  private tickFeedback(): void {
    const me = this.race.racers[0];
    const now = this.race.elapsedMs;

    if (me.drifting) {
      if (this.hum && !this.screech) this.screech = startScreech(this.hum.ctx);
      this.markSkid(me, now);
    } else {
      if (this.screech && this.hum) stopScreech(this.hum.ctx, this.screech);
      this.screech = null;
      if (this.skid) {
        this.skid = null;
        this.texture.canvas.refresh();
      }
    }

    if (me.onGrass && now - this.dustAtMs >= FX.dustEveryMs) {
      this.dustAtMs = now;
      this.dustTicks++;
      this.puffDust();
      this.shake(FX.shakeOffroad);
      if (this.hum && this.dustTicks % 2 === 0) playRumble(this.hum.ctx);
    }

    if (this.doubleBoost && !me.effects.some((e) => e.type === 'boost')) this.doubleBoost = false;
  }

  /** Draws the rear wheels' path onto the track texture; the marks reach the screen every `skidRefreshMs`. */
  private markSkid(me: { x: number; y: number; heading: number }, now: number): void {
    const L = C.kart.length;
    const w = 0.68 * L;
    const cos = Math.cos(me.heading);
    const sin = Math.sin(me.heading);
    const wheel = (side: number): { x: number; y: number } => ({
      x: me.x + -0.32 * L * cos - side * 0.5 * w * sin,
      y: me.y + -0.32 * L * sin + side * 0.5 * w * cos,
    });
    const l = wheel(-1);
    const r = wheel(1);
    if (this.skid) {
      const ctx = this.texture.canvas.context;
      ctx.strokeStyle = FX.skid;
      ctx.lineWidth = FX.skidWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.skid.lx, this.skid.ly);
      ctx.lineTo(l.x, l.y);
      ctx.moveTo(this.skid.rx, this.skid.ry);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      if (now - this.skidShownMs >= FX.skidRefreshMs) {
        this.skidShownMs = now;
        this.texture.canvas.refresh();
      }
    }
    this.skid = { lx: l.x, ly: l.y, rx: r.x, ry: r.y };
  }

  /** A puff behind the kart on the grass. */
  private puffDust(): void {
    const k = this.kartObj;
    const s = Math.max(2, k.scaleX * 0.8);
    const puff = this.add.circle(k.x + (Math.random() - 0.5) * s * 3, k.y + s * 0.5, s, FX.dust, 0.7).setDepth(DEPTH.world + 0.5);
    this.tweens.add({ targets: puff, alpha: 0, scale: 2.2, y: puff.y + s, duration: FX.dustMs, onComplete: () => puff.destroy() });
  }

  /** Lines rushing in from the edges, `strength` 1 for a boost and 2 for the chain. */
  private burstSpeedLines(strength: number): void {
    const g = this.speedLines.clear().setAlpha(1);
    g.lineStyle(2, FX.line, 0.8);
    for (let i = 0; i < FX.speedLines * strength; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = Math.min(W, H) * (0.35 + Math.random() * 0.2);
      const r1 = r0 + 60 + Math.random() * 80 * strength;
      g.lineBetween(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0, W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1);
    }
    this.tweens.killTweensOf(this.speedLines);
    this.tweens.add({ targets: this.speedLines, alpha: 0, duration: FX.speedLineMs });
  }

  private flashScreen(rgb: [number, number, number]): void {
    this.flash.setFillStyle(Phaser.Display.Color.GetColor(rgb[0], rgb[1], rgb[2])).setAlpha(0.4);
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: FX.flashMs });
  }

  private shake(spec: { ms: number; power: number }): void {
    if (this.calm || !this.playable) return;
    this.cameras.main.shake(spec.ms, spec.power);
  }

  /** A word over the road that grows and fades; it just sits for a moment under reduced motion. */
  private shout(text: string, color: string): void {
    if (!this.playable) return;
    const t = label(this, W / 2, H * 0.3, text, { size: FX.shoutSize, bold: true, color }).setDepth(DEPTH.shout);
    if (this.calm) {
      this.time.delayedCall(FX.shoutMs, () => t.destroy());
      return;
    }
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1.15, alpha: 0, duration: FX.shoutMs, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private lapFlip(lap: number): void {
    if (!this.playable) return;
    this.shout(`LAP ${lap}`, UI.colors.text);
    if (this.calm) return;
    this.hud.lap.setScale(1.4);
    this.tweens.add({ targets: this.hud.lap, scale: 1, duration: FX.lapPopMs, ease: 'Back.easeOut' });
  }

  private wobble(): void {
    if (this.calm) return;
    this.jolt.wobble = FX.wobblePx;
    this.tweens.add({ targets: this.jolt, wobble: -FX.wobblePx, duration: FX.wobbleMs, yoyo: true, repeat: FX.wobbleRepeats, onComplete: () => { this.jolt.wobble = 0; } });
  }

  // ── Questions ──

  /** Deals the next card; reshuffles when the deck is exhausted, never the same card twice in a row. */
  private nextQuestion(): RaceQuestionResponse {
    if (this.dealt >= this.deck.length) {
      const last = this.deck[this.deck.length - 1];
      this.deck = shuffle(this.deck, Math.random);
      if (this.deck.length > 1 && this.deck[0] === last) this.deck.push(this.deck.shift()!);
      this.dealt = 0;
    }
    return this.deck[this.dealt++];
  }

  private openQuestion(question: RaceQuestionResponse): void {
    const { panelW, optionH, optionGap } = UI.question;
    const cx = W / 2;
    const left = cx - panelW / 2;
    // Measure the wrapped question first; the options start under it.
    const text = wrapText(this, left + 20, 0, question.content, panelW - 110, { originX: 0, originY: 0, size: UI.font.body });
    const textH = text.height;
    const optionsTop = 22 + textH + 16;
    const panelH = optionsTop + question.options.length * (optionH + optionGap);
    const top = Math.max(UI.pad + 50, H - panelH - UI.pad);
    text.setY(top + 22);
    const panel = this.add.graphics()
      .fillStyle(UI.colors.panel, 0.96).fillRoundedRect(left, top, panelW, panelH, UI.button.radius);
    const bar = this.add.graphics();
    const countdown = label(this, left + panelW - 24, top + 36, String(C.questionCountdownS), { size: UI.font.title * 0.6, bold: true, originX: 1 });
    const options = question.options.map((option, i) =>
      button(this, cx, top + optionsTop + i * (optionH + optionGap) + optionH / 2, option, () => this.answer(i), {
        w: panelW - 40, h: optionH, size: UI.font.small, badge: String(i + 1), alignLeft: true,
      })
    );
    const container = this.add.container(0, 0, [panel, bar, text, countdown, ...options]).setDepth(DEPTH.overlay);
    this.open = { question, openedMs: this.race.elapsedMs, container, countdown, bar, barX: left + 12, barY: top + 6, barW: panelW - 24 };
    this.tickQuestion();
  }

  /** The countdown runs on race time. The bar drains from good to danger. */
  private tickQuestion(): void {
    const open = this.open;
    if (!open) return;
    const total = C.questionCountdownS * 1000;
    const left = total - (this.race.elapsedMs - open.openedMs);
    if (left <= 0) {
      this.answer(null);
      return;
    }
    open.countdown.setText(String(Math.ceil(left / 1000)));
    const t = left / total;
    const colour = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(UI.colors.danger), Phaser.Display.Color.ValueToColor(UI.colors.good), 100, Math.round(t * 100));
    open.bar.clear().fillStyle(Phaser.Display.Color.GetColor(colour.r, colour.g, colour.b), 1)
      .fillRoundedRect(open.barX, open.barY, open.barW * t, FX.timerBarH, FX.timerBarH / 2);
  }

  /** `null` is a timeout. A right answer stores a charge; a wrong one slows the kart. */
  private answer(index: number | null): void {
    const open = this.open;
    if (!open) return;
    this.closeQuestion();
    const correct = index === open.question.correctIndex;
    if (correct) {
      this.correctCount++;
      addCharge(this.race, LOCAL_RACER);
      this.flashScreen(FX.flashGood);
      if (this.hum) playChime(this.hum.ctx);
    } else {
      this.wrongCount++;
      this.missed.push(open.question);
      applySlow(this.race, LOCAL_RACER);
      this.flashScreen(FX.flashBad);
      this.wobble();
      if (this.hum) playBuzzer(this.hum.ctx);
    }
  }

  private closeQuestion(): void {
    this.open?.container.destroy();
    this.open = null;
  }
}
