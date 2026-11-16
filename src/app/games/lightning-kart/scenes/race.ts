import Phaser from 'phaser';
import { bridgeOf, RaceQuestion } from '../bridge';
import {
  createEngineSound, EngineSound, playCatch, playChime, playFanfare, playLapTone, playPop, playSquirt, playStreakLost, playToss, playWhoosh,
  setEngineSpeed, stopEngineSound,
} from '../engine/audio';
import { C, cssHex } from '../engine/constants';
import { applyBoost, applyTrap, BoostKind, boostKind, createRace, hudState, isDouble, LOCAL_RACER, Race, RaceEvent, step } from '../engine/race';
import { answerStreak, createStreak, nextTier, Streak, StreakChange, tierOf } from '../engine/streak';
import { Character, characterOf, Kart as KartLook, kartOf } from '../look/catalogue';
import { drawKartTop, drawRacer } from '../look/draw';
import { HEAD_SLIDE, racerTop } from '../look/head';
import { drawStun, racerHead } from '../look/splash';
import { hasWebGL, Mode7Camera, Mode7View, NO_WEBGL } from '../render/mode7';
import { Props } from '../render/props';
import { RoadOverlay } from '../render/road-overlay';
import { Skyline } from '../render/skyline';
import { createTrackTexture, TrackTexture } from '../render/track-texture';
import { wrapAngle } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { AnswerChecker, Verdict } from './answer-checker';
import { Badge } from './badge';
import { Crackle } from './crackle';
import { perfectRace, RaceOutcome, RaceStart, ScopeChoice } from './data';
import { DEPTH } from './depth';
import { RaceFx } from './fx';
import { Hud } from './hud';
import { SCENE } from './keys';
import { reducedMotion } from './motion';
import { QuestionPanel } from './question-panel';
import { RaceKeys, setupRaceInput } from './race-input';
import { Splash } from './splash';
import { Button, cornerButton, setupStage, wrapText } from './widgets';

const UI = C.ui;
const ROAD = UI.road;
const FX = UI.fx;
const STREAK = UI.streak;
const W = UI.stage.w;
const H = UI.stage.h;

/** The answer awaiting its verdict: for that showing of its question, first sent at race time `atMs`. */
interface Asked { question: RaceQuestion; choice: number | null; showing: object; atMs: number; resent: boolean }

/**
 * The race: the engine stepped every frame, the track seen through the mode 7 view from
 * behind the kart, boxes and the kart placed by projection, the countdown, the HUD
 * (`hud.ts`), the question overlay (`question-panel.ts`), Splash after every answer
 * (`splash.ts`), the streak's badge (`badge.ts`), flame, sounds and Lightning look, and every
 * row of the design file's Feedback table (`fx.ts`). The keys and the held halves of the
 * stage are wired in `race-input.ts`; Escape twice quits. The questions are the server's
 * deal, in its order, one per box row until they run out. An answer goes to the race's
 * `AnswerChecker` and its outcome waits for the verdict, asked again and then given up on race
 * time (`C.answer`). Without WebGL only one line of text shows.
 */
export class RaceScene extends Phaser.Scene {
  private choice!: ScopeChoice;
  private raceId = '';
  private race!: Race;
  private phase: 'countdown' | 'racing' | 'done' = 'countdown';
  private playable = false;
  private calm = false;

  private view: Mode7View | null = null;
  private skyline: Skyline | null = null;
  private props: Props | null = null;
  private roadOverlay: RoadOverlay | null = null;
  private texture!: TrackTexture;
  private cam!: Mode7Camera;
  private look!: { character: Character; kart: KartLook };
  private kartObj!: Phaser.GameObjects.Container;
  private kartG!: Phaser.GameObjects.Graphics;
  private stunBack!: Phaser.GameObjects.Graphics; // the far half of the stun's ring, under the racer
  private stunFront!: Phaser.GameObjects.Graphics; // its near half, over the racer
  private trapped = false; // whether the last racing frame had a trap, so its end is seen
  private stunEndMs: number | null = null; // race time the last trap ended, for the ring's fade
  private behind: { s: number; lean: number } | null = null; // the behind view's width in px and the driver's lean, while the kart is drawn from behind
  private boxes: Phaser.GameObjects.Rectangle[] = [];
  private badge!: Badge;
  private crackle!: Crackle;
  private hud!: Hud;
  private fx!: RaceFx;
  private panel!: QuestionPanel;
  private splash!: Splash;
  private soundButton!: Button;

  private keys!: RaceKeys;
  private pointerSteer = 0;
  private lastEscapeMs = -Infinity;

  private questions: RaceQuestion[] = [];
  private dealt = 0; // the next deck position to open
  private correctCount = 0;
  private wrongCount = 0;
  private missed: RaceQuestion[] = [];
  private streak: Streak = createStreak();
  private checker!: AnswerChecker;
  private asked: Asked | null = null;

  private hum: EngineSound | null = null;

  constructor() {
    super(SCENE.race);
  }

  init({ choice, race }: RaceStart): void {
    this.choice = choice;
    this.raceId = race.raceId;
    this.questions = race.questions;
    this.dealt = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.missed = [];
    this.streak = createStreak();
    this.checker = choice.checker;
    this.asked = null;
    this.phase = 'countdown';
    this.view = null;
    this.pointerSteer = 0;
    this.lastEscapeMs = -Infinity;
    this.trapped = false;
    this.stunEndMs = null;
  }

  create(): void {
    setupStage(this);
    const data = bridgeOf(this).data;
    const trackDef = data.track === 'test' ? TEST_TRACK : LAP;
    this.race = createRace({ track: trackDef, laps: C.laps, racers: [{ id: LOCAL_RACER, appearance: data.look }] });
    this.look = { character: characterOf(data.look.characterId), kart: kartOf(data.look.kartId) };
    this.playable = hasWebGL(this);
    this.calm = reducedMotion();
    this.panel = new QuestionPanel(this, (i) => this.answer(i));
    this.splash = new Splash(this, this.calm);

    cornerButton(this, 'Quit', () => this.quit()).setDepth(DEPTH.hud);
    if (!this.playable) {
      wrapText(this, W / 2, H / 2, NO_WEBGL, W - 4 * UI.pad, { color: UI.colors.danger });
      return;
    }

    this.texture = createTrackTexture(this, `track-${data.track ?? 'lap'}`, this.race.built);
    this.view = new Mode7View(this, this.texture);
    this.view.shader.setDepth(DEPTH.ground);
    const me = this.race.racers[0];
    this.cam = { x: me.x - C.camera.back, y: me.y, yaw: me.heading, height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg };
    this.skyline = new Skyline(this, DEPTH.ground + 1);
    this.skyline.setYaw(this.cam.yaw);
    this.props = new Props(this, this.race.built, DEPTH.world);
    this.roadOverlay = new RoadOverlay(this, this.race.built, DEPTH.ground + 0.5);
    this.boxes = this.race.boxes.map(() => this.add.rectangle(0, 0, 10, 10, ROAD.box).setStrokeStyle(2, ROAD.boxEdge).setOrigin(0.5, 1).setDepth(DEPTH.world).setVisible(false));
    this.kartG = this.add.graphics();
    this.stunBack = this.add.graphics();
    this.stunFront = this.add.graphics();
    this.kartObj = this.add.container(0, 0, [this.stunBack, this.kartG, this.stunFront]).setDepth(DEPTH.world + 1);
    this.badge = new Badge(this);
    this.crackle = new Crackle(this, this.calm);
    this.fx = new RaceFx(this, this.calm);
    // HUD in the corners; Sound top right beside Quit, the time and best under them.
    this.hud = new Hud(this, data.leaderboard?.mine?.finishMs);
    this.soundButton = cornerButton(this, 'Sound on', () => this.toggleSound(), 1).setDepth(DEPTH.hud);

    this.setupInput();
    this.fx.countdown(() => { this.phase = 'racing'; });
    this.placeWorld();
    this.hud.draw(hudState(this.race, LOCAL_RACER));
    // On shutdown the display list is already gone, so only the audio is stopped here, never a label.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopAudio());
  }

  override update(_time: number, delta: number): void {
    if (!this.playable || this.phase === 'done') return;
    const dt = Math.min(delta / 1000, C.maxStepS);
    let events: RaceEvent[] = [];
    if (this.phase === 'racing') {
      events = step(this.race, dt, { steer: this.pointerSteer || this.keys.steer() });
      this.tickFeedback();
    }
    this.followKart(dt);
    this.placeWorld();
    this.splash.tick(this.race.elapsedMs, this.kartPoint()); // after placeWorld: the bubble or the bottle flies to where the kart is drawn now
    this.drawStun(); // after the tick: a bubble bursting in this frame stuns in this frame
    const hud = hudState(this.race, LOCAL_RACER);
    this.hud.draw(hud);
    if (this.hum) {
      const tier = tierOf(this.streak.count);
      const semitones = tier ? STREAK.tiers[tier].hum : 0;
      setEngineSpeed(this.hum, (this.race.racers[0].speed / C.kart.topSpeed) * hud.speed * 2 ** (semitones / 12));
    }
    this.handleEvents(events);
    // After the events: a countdown that runs out in the finishing frame must not count as
    // wrong, since the finish closes an open question neither way.
    if (this.phase === 'racing') {
      this.chase();
      this.panel.tick(this.race.elapsedMs);
    }
  }

  /** Engine events of one frame. Public so the flow spec can force a finish. */
  handleEvents(events: RaceEvent[]): void {
    for (const event of events) {
      if (event.type === 'item' && event.kind === 'question') {
        // A deal shorter than the race runs out: the boxes left open nothing.
        const next = this.questions[this.dealt];
        if (next && !this.panel.question && this.phase === 'racing') {
          this.dealt++;
          this.openQuestion(next);
        }
      } else if (event.type === 'lap') {
        this.lapFlip(event.lap);
        if (this.hum) playLapTone(this.hum.ctx);
      } else if (event.type === 'finish') {
        this.panel.close(); // a question still open at the line, or still waiting for its verdict, counts neither way
        this.phase = 'done';
        // The best streak rides only in the scene data to Result: the server's result payload has
        // no field for it, so `finished` below leaves it out.
        const outcome: RaceOutcome = {
          choice: this.choice, raceId: this.raceId, finishMs: event.finishMs, correctCount: this.correctCount, wrongCount: this.wrongCount, missed: this.missed,
          bestStreak: this.streak.best,
        };
        if (this.hum) playFanfare(this.hum.ctx, perfectRace(outcome));
        // Once per finish; the host sends it once no answer call is out, then refreshes the board.
        bridgeOf(this).intent('finished', { scope: this.choice.scope, raceId: this.raceId, finishMs: outcome.finishMs });
        this.scene.start(SCENE.result, outcome);
        return;
      }
    }
  }

  quit(): void {
    this.scene.start(SCENE.ready, this.choice);
  }

  // ── Input ──

  private setupInput(): void {
    this.keys = setupRaceInput(this, {
      steer: (value) => { this.pointerSteer = value; },
      answer: (i) => {
        const question = this.panel.question;
        if (question && i < question.options.length) this.answer(i);
      },
      escape: () => {
        const now = this.race.elapsedMs;
        if (now - this.lastEscapeMs < UI.escapeTwiceMs) this.quit();
        this.lastEscapeMs = now;
      },
    });
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

  /** Stops the hum; safe after the scene's objects are gone. */
  private stopAudio(): void {
    if (!this.hum) return;
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
    this.skyline?.setYaw(c.yaw);
  }

  private placeWorld(): void {
    const view = this.view;
    if (!view) return;
    const now = this.race.elapsedMs;
    const tier = tierOf(this.streak.count);
    this.race.boxes.forEach((box, i) => {
      const p = view.project(box);
      const obj = this.boxes[i];
      if (!p) { obj.setVisible(false); return; }
      const dark = box.hitAtMs !== null && now - box.hitAtMs < C.world.boxCooldownS * 1000;
      const gold = tier === 'lightning' && !dark; // every box projected is ahead of the eye
      const s = 2.4 * p.scale * (gold ? STREAK.boxScale : 1);
      obj.setVisible(true).setPosition(p.x, p.y).setDisplaySize(s, s).setAlpha(dark ? 0.35 : 1).setDepth(DEPTH.world + p.y / H)
        .setFillStyle(gold ? STREAK.box : ROAD.box).setStrokeStyle(gold ? STREAK.boxRim : 2, gold ? STREAK.boxEdge : ROAD.boxEdge);
    });
    this.props?.update(view, this.cam);
    this.roadOverlay?.update(this.cam);

    // The kart, at its projected ground point plus the lurch. The camera follows
    // the heading with a lag, so `rel` is how far the kart turns ahead of it on screen.
    const me = this.race.racers[0];
    const p = view.project(me);
    const g = this.kartG.clear();
    this.kartObj.setVisible(!!p);
    if (!p || !tier) this.badge.hide();
    if (!p || tier !== 'lightning') this.crackle.hide();
    if (!p) return;
    const jolt = this.fx.jolt;
    this.kartObj.setPosition(p.x, p.y - jolt.lurch).setDepth(DEPTH.world + 1 + p.y / H);
    // The boost's flame while one runs; else, from Spark up, a small idle flame in the tier's colours.
    const boosted = me.effects.some((e) => e.type === 'boost');
    const idle = tier ? STREAK.tiers[tier] : null;
    const flame = boosted ? { lengths: isDouble(me) ? FX.doubleFlame : 1, colours: FX.flame, flicker: Math.random() }
      : idle ? { lengths: STREAK.idleFlame, colours: idle.flame, flicker: Math.random() } : null;
    const rel = wrapAngle(me.heading - this.cam.yaw);
    const topView = (UI.kart.topViewDeg * Math.PI) / 180;
    // The behind view's width at this depth; the badge takes it in both views, so it keeps its size when the view flips.
    const s = C.kart.width * p.scale * UI.kart.behindScale;
    let badgeAt: { x: number; y: number };
    if (Math.abs(rel) < topView) {
      // Behind view, drawn in stage pixels with its own shadow: the driver leans into the
      // bend and the whole kart tilts with it. A right turn raises the heading and the camera
      // lags, so `rel` is positive there and the kart turns clockwise, its top toward the inside.
      this.kartObj.setScale(1);
      this.kartG.setRotation(rel * UI.kart.leanTilt);
      this.behind = { s, lean: rel / topView };
      drawRacer(g, 0, 0, s, rel / topView, this.look.character, this.look.kart, flame);
      // Over the headgear's top, which slides with the head and swings with the tilt.
      const hx = HEAD_SLIDE * s * Math.max(-1, Math.min(1, rel / topView));
      const hy = -(racerTop(this.look.character) + STREAK.badgeGap) * s;
      const tilt = this.kartG.rotation;
      badgeAt = { x: this.kartObj.x + hx * Math.cos(tilt) - hy * Math.sin(tilt), y: this.kartObj.y + hx * Math.sin(tilt) + hy * Math.cos(tilt) };
    } else {
      this.behind = null;
      // Spun round: the top-down look, nose along +x turned to the heading, squashed by the
      // pitch so it lies on the ground, scaled by depth, the scene's shadow ellipse under it.
      const squash = Math.max(Math.sin(this.cam.pitch), UI.kart.minSquash);
      this.kartObj.setScale(p.scale, p.scale * squash);
      this.kartG.setRotation(rel - Math.PI / 2);
      const L = C.kart.length;
      g.fillStyle(0x000000, UI.kart.shadowAlpha).fillEllipse(0, 0, L * 1.1, L * 0.8);
      drawKartTop(g, L, this.look.character, this.look.kart, flame);
      // Over the kart lying on the ground: past half its length squashed, whichever way it points.
      badgeAt = { x: this.kartObj.x, y: this.kartObj.y - 0.5 * L * p.scale * squash - STREAK.badgeGap * s };
    }
    if (tier) this.badge.show(badgeAt.x, badgeAt.y, s, this.streak.count, tier, this.kartObj.depth + 0.001);
    if (tier === 'lightning') {
      // round the racer's middle, halfway between its headgear's top and its shadow's bottom, from behind; the kart's centre from above
      const lift = this.behind ? ((racerTop(this.look.character) - 0.08) / 2) * s : 0;
      this.crackle.show(this.kartObj.x + lift * Math.sin(this.kartG.rotation), this.kartObj.y - lift * Math.cos(this.kartG.rotation), s, now, this.kartObj.depth + 0.002);
    }
  }

  /**
   * The stunned racer's ring of stars and drops round its head for as long as the trap holds
   * the kart, read from the engine every frame, turning on race time (standing still under
   * reduced motion), then fading over `C.ui.splash.stun.fadeMs` from the frame the trap ended.
   * Its far half is drawn under the racer, its near half over it. From behind only: on rails
   * the heading never leads the camera far enough for the top view.
   */
  private drawStun(): void {
    const back = this.stunBack.clear().setRotation(this.kartG.rotation);
    const front = this.stunFront.clear().setRotation(this.kartG.rotation);
    if (!this.behind) return;
    const ST = UI.splash.stun;
    const now = this.race.elapsedMs;
    const trapped = this.race.racers[0].effects.some((e) => e.type === 'trap');
    const alpha = trapped ? 1 : this.stunEndMs === null ? 0 : 1 - (now - this.stunEndMs) / ST.fadeMs;
    if (alpha <= 0) return;
    const head = racerHead(0, 0, this.behind.s, this.behind.lean, 0, this.look.character);
    const phase = this.calm ? 0 : (now / 1000) * ST.turnHz * 2 * Math.PI;
    drawStun(back, head.x, head.y, this.behind.s, phase, alpha, 'back');
    drawStun(front, head.x, head.y, this.behind.s, phase, alpha, 'front');
  }

  /** Where Splash's bubble or bottle lands: the racer's head as drawn from behind (`racerHead`), the kart's centre from above. */
  private kartPoint(): { x: number; y: number } {
    if (!this.behind) return { x: this.kartObj.x, y: this.kartObj.y };
    return racerHead(this.kartObj.x, this.kartObj.y, this.behind.s, this.behind.lean, this.kartG.rotation, this.look.character);
  }

  // ── Feedback ──

  /** Per frame while racing: the trap's end (the stun's ring starts to fade), the boost's vignette and the Lightning tier's edge. */
  private tickFeedback(): void {
    const me = this.race.racers[0];
    const trapped = me.effects.some((e) => e.type === 'trap');
    if (this.trapped && !trapped) this.stunEndMs = this.race.elapsedMs;
    this.trapped = trapped;
    this.fx.setBoosting(me.effects.some((e) => e.type === 'boost'));
    this.fx.setLightning(tierOf(this.streak.count) === 'lightning', this.race.elapsedMs);
  }

  private lapFlip(lap: number): void {
    if (!this.playable) return;
    this.fx.shout(`LAP ${lap}`, UI.colors.text);
    this.hud.lapFlip(this.calm);
  }

  // ── Questions ──

  private openQuestion(question: RaceQuestion): void {
    this.panel.show(question, this.race.elapsedMs, nextTier(this.streak.count));
  }

  /**
   * A card, a number key, or the countdown run out (`null`): the panel locks, the countdown
   * stops and the checker is asked. Nothing else happens until its verdict, which `verdict`
   * takes only while that very showing of the question is still open and the scene is up:
   * closing the panel (the finish, a restart, or the void at the deadline) makes a late
   * verdict do nothing, so the first of two replies wins. A checker that throws or rejects
   * gives nothing; the deadline (`chase`) decides.
   */
  private answer(index: number | null): void {
    const question = this.panel.question;
    const showing = this.panel.showing;
    if (!question || !showing || this.panel.locked) return;
    this.panel.lock(index);
    if (this.playable) this.splash.start(this.race.elapsedMs); // she comes at the press and waits for the verdict
    this.asked = { question, choice: index, showing, atMs: this.race.elapsedMs, resent: false };
    this.ask(this.asked);
  }

  /** One attempt at the checker for `asked`. */
  private ask({ question, choice, showing }: Asked): void {
    const settle = (verdict: Verdict): void => {
      if (!this.sys.isActive() || this.panel.showing !== showing) return;
      this.verdict(question, verdict);
    };
    Promise.resolve().then(() => this.checker.check(this.raceId, question, choice)).then(settle, () => undefined);
  }

  /**
   * Each racing frame, on race time: no verdict by `C.answer.checkingMs` shows "Checking…" on
   * the board, none by `resendMs` asks once more, none by `voidMs` voids the question.
   */
  private chase(): void {
    const asked = this.asked;
    if (!asked || this.panel.showing !== asked.showing) return;
    const waited = this.race.elapsedMs - asked.atMs;
    if (waited >= C.answer.checkingMs) this.panel.checking(this.race.elapsedMs);
    if (waited >= C.answer.voidMs) this.verdict(asked.question, 'void');
    else if (!asked.resent && waited >= C.answer.resendMs) {
      asked.resent = true;
      this.ask(asked);
    }
  }

  /**
   * The checker's verdict closes the question. A void one does nothing else. Otherwise it
   * counts, and the streak counts now, not at the landing: its chime, shout and badge are the
   * player's feedback on the answer just judged. Then Splash, who came at the press, throws:
   * a right answer's boost starts when her bottle lands, a wrong one traps the kart when her
   * bubble bursts on the racer's head and stuns it, both on race time (`splash.ts`, `C.splash`); a void sends her
   * away. Whether a boost runs is read here, after the press landed any throw still in flight,
   * and decides a Double Boost. Without WebGL nothing is drawn and nothing more happens.
   */
  private verdict(question: RaceQuestion, verdict: Verdict): void {
    this.panel.close();
    this.asked = null;
    if (verdict === 'void') {
      if (this.playable) this.splash.leave(this.race.elapsedMs);
      return;
    }
    const right = verdict === 'right';
    if (right) this.correctCount++;
    else {
      this.wrongCount++;
      this.missed.push(question);
    }
    const change = answerStreak(this.streak, right);
    if (!this.playable) return;
    if (right) this.fx.flashScreen(FX.flashGood);
    this.streakChanged(change);
    const kind = boostKind(this.race, LOCAL_RACER);
    this.splash.decide(this.race.elapsedMs, right ? 'bottle' : 'bubble', {
      fire: () => { if (this.hum) (right ? playToss : playSquirt)(this.hum.ctx); },
      hit: () => this.landed(right, kind),
    });
  }

  /**
   * Reacts to one answer's change to the streak, which `engine/streak.ts` decides. Up: the chime
   * one note higher per answer in the run; a new tier shouts its name if its look says so. A
   * break resets the chime; from `C.streak.loudBreakAt` on it stings, shouts STREAK LOST (sound
   * is off by default, so the word carries it) and the badge shatters, below that the badge and
   * the idle flame just go. The badge, the idle flame, the hum, the gold boxes and the blue edge
   * follow the tier every frame.
   */
  private streakChanged(change: StreakChange): void {
    if (change.type === 'up') {
      if (this.hum) playChime(this.hum.ctx, change.count - 1);
      if (!change.tierUp) return;
      const look = STREAK.tiers[change.tierUp];
      if (look.shout) this.fx.shout(change.tierUp.toUpperCase(), cssHex(look.colour));
      return;
    }
    if (!change.loud) return;
    if (this.hum) playStreakLost(this.hum.ctx);
    this.fx.shout('STREAK LOST', UI.colors.danger);
    this.badge.shatter();
  }

  /**
   * Splash's throw landed on the kart. The bottle starts the boost of `kind`, decided at the
   * verdict; the bubble bursts on the racer's head, which traps the kart and stuns the racer. Once the racer has finished the
   * race is over and nothing happens.
   */
  private landed(right: boolean, kind: BoostKind): void {
    if (this.race.racers[0].finishMs !== null) return;
    if (right) {
      const double = applyBoost(this.race, LOCAL_RACER, kind) === 'double';
      if (this.hum) {
        playCatch(this.hum.ctx);
        playWhoosh(this.hum.ctx, double);
      }
      this.fx.burstSpeedLines(double ? 2 : 1);
      this.fx.shout(double ? 'DOUBLE BOOST' : 'BOOST', UI.colors.good);
      this.fx.lurch();
    } else {
      // The bubble bursts on the head (Splash draws the burst) and the racer is stunned (drawStun).
      applyTrap(this.race, LOCAL_RACER);
      if (this.hum) playPop(this.hum.ctx);
    }
  }
}
