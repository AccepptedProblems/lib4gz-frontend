import Phaser from 'phaser';
import { bridgeOf } from '../bridge';
import { C } from '../engine/constants';
import { createRace, LOCAL_RACER, Race, step } from '../engine/race';
import { hasWebGL, Mode7Camera, Mode7View } from '../render/mode7';
import { createTrackTexture, TrackTexture } from '../render/track-texture';
import { pointAt, worldAt } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { SCENE } from './keys';
import { cornerButton, label, setupStage } from './widgets';

const UI = C.ui;
const W = UI.stage.w;
const H = UI.stage.h;

export interface DebugStart {
  mode: 'top' | 'mode7';
  track: 'lap' | 'test';
}

/**
 * Behind `?debug=top|mode7` on the race page. `top` shows the track texture with the kart
 * driven by the engine as a dot; `mode7` flies a free camera over it with a marker on the
 * start line and one on the first checkpoint. Arrows steer or fly, Down drifts, Q/E change
 * the camera height, A/Z its pitch.
 */
export class DebugScene extends Phaser.Scene {
  private start!: DebugStart;
  private race!: Race;
  private texture!: TrackTexture;
  private keys!: Record<'left' | 'right' | 'up' | 'down' | 'q' | 'e' | 'a' | 'z', Phaser.Input.Keyboard.Key> | null;
  private readout!: Phaser.GameObjects.Text;
  // top
  private dot!: Phaser.GameObjects.Arc;
  private trail!: Phaser.GameObjects.Graphics;
  private fit = { s: 1, ox: 0, oy: 0 };
  // mode7
  private view: Mode7View | null = null;
  private cam!: Mode7Camera;
  private markers: { p: { x: number; y: number }; obj: Phaser.GameObjects.Arc }[] = [];

  constructor() {
    super(SCENE.debug);
  }

  init(start: DebugStart): void {
    this.start = start;
  }

  create(): void {
    setupStage(this);
    const def = this.start.track === 'lap' ? LAP : TEST_TRACK;
    this.race = createRace({ seed: 1, track: def });
    this.texture = createTrackTexture(this, `track-${this.start.track}`, this.race.built);
    const keyboard = this.input.keyboard;
    this.keys = keyboard ? (keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN', q: 'Q', e: 'E', a: 'A', z: 'Z' }) as DebugScene['keys']) : null;
    cornerButton(this, 'Home', () => this.scene.start(SCENE.home)).setDepth(100);
    this.readout = label(this, UI.pad, H - UI.pad, '', { size: UI.font.small, originX: 0, color: UI.colors.text }).setDepth(100);

    if (this.start.mode === 'top') {
      const s = Math.min((W - 2 * UI.pad) / this.texture.width, (H - 2 * UI.pad) / this.texture.height);
      this.fit = { s, ox: W / 2 - (this.texture.width * s) / 2, oy: H / 2 - (this.texture.height * s) / 2 };
      this.add.image(W / 2, H / 2, this.texture.key).setDisplaySize(this.texture.width * s, this.texture.height * s);
      this.trail = this.add.graphics();
      this.dot = this.add.circle(0, 0, 4, 0xff3b3b);
      for (const box of this.race.boxes) {
        const p = this.toStage(box);
        this.add.rectangle(p.x, p.y, 6, 6, UI.road.box);
      }
      return;
    }
    if (!hasWebGL(this)) {
      label(this, W / 2, H / 2, 'Lightning Kart needs WebGL in this browser', { color: UI.colors.danger });
      return;
    }
    this.view = new Mode7View(this, this.texture);
    this.cam = { x: -30, y: 0, yaw: 0, height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg };
    const track = this.race.built.track;
    const at = (p: { x: number; y: number }, colour: number): void => {
      this.markers.push({ p, obj: this.add.circle(0, 0, 6, colour).setDepth(10) });
    };
    at(pointAt(track, 0), 0xff3b3b); // the start line's centre
    at(pointAt(track, this.race.built.checkpoints[0]), UI.road.checkpoint);
    at(worldAt(track, 0, C.world.roadWidth / 2), 0xffffff); // the start line's right end
    this.race.boxes.forEach((b) => at(b, UI.road.box));
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, C.maxStepS);
    const k = this.keys;
    const steer = k ? (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0) : 0;
    if (this.start.mode === 'top') {
      step(this.race, dt, { steer, drift: !!k?.down.isDown });
      const me = this.race.racers[0];
      const p = this.toStage(me);
      this.trail.fillStyle(me.onGrass ? 0xffffff : 0xff3b3b, 0.5).fillCircle(p.x, p.y, 1.5);
      this.dot.setPosition(p.x, p.y);
      this.readout.setText(`speed ${me.speed.toFixed(1)}  d ${me.d.toFixed(0)}  offset ${me.offset.toFixed(1)}  lap ${me.lap}  cp ${me.nextCheckpoint}  ${me.drifting ? 'DRIFT' : ''}${me.onGrass ? ' GRASS' : ''}${me.onWall ? ' WALL' : ''}`);
      return;
    }
    if (!this.view || !k) return;
    const c = this.cam;
    c.yaw += steer * 1.2 * dt;
    const move = (k.up.isDown ? 1 : 0) - (k.down.isDown ? 1 : 0);
    c.x += Math.cos(c.yaw) * move * 40 * dt;
    c.y += Math.sin(c.yaw) * move * 40 * dt;
    c.height = Math.max(1, c.height + ((k.e.isDown ? 1 : 0) - (k.q.isDown ? 1 : 0)) * 6 * dt);
    c.pitch = Math.max(0.05, Math.min(1.4, c.pitch + ((k.a.isDown ? 1 : 0) - (k.z.isDown ? 1 : 0)) * 0.5 * dt));
    this.view.setCamera(c);
    for (const m of this.markers) {
      const s = this.view.project(m.p);
      if (!s) { m.obj.setVisible(false); continue; }
      m.obj.setVisible(true).setPosition(s.x, s.y).setScale(Math.max(0.3, s.scale / 4));
    }
    this.readout.setText(`cam ${c.x.toFixed(0)}, ${c.y.toFixed(0)}  yaw ${c.yaw.toFixed(2)}  height ${c.height.toFixed(1)}  pitch ${((c.pitch * 180) / Math.PI).toFixed(0)}  fps ${this.game.loop.actualFps.toFixed(0)}`);
  }

  private toStage(p: { x: number; y: number }): { x: number; y: number } {
    const { s, ox, oy } = this.fit;
    return { x: ox + (p.x - this.texture.originX) * this.texture.scale * s, y: oy + (p.y - this.texture.originY) * this.texture.scale * s };
  }
}
