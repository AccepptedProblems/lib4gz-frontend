import { C } from './constants';

export interface EngineSound {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
  /** True when this module made the context and must close it. */
  owned: boolean;
}

/**
 * The engine hum, pitched to speed. Call from a user gesture: browsers refuse to start audio
 * otherwise. Pass Phaser's audio context so its gesture unlock covers the hum; without one
 * a context is created and closed here.
 */
export function createEngineSound(ctx?: AudioContext): EngineSound {
  const owned = !ctx;
  const context = ctx ?? new AudioContext();
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'triangle';
  osc.frequency.value = C.audio.humHz;
  gain.gain.value = C.audio.gain;
  osc.connect(gain).connect(context.destination);
  osc.start();
  void context.resume();
  return { ctx: context, osc, gain, owned };
}

export function setEngineSpeed(s: EngineSound, speedMul: number): void {
  s.osc.frequency.setTargetAtTime(C.audio.humHz * speedMul, s.ctx.currentTime, C.audio.glideS);
}

export function stopEngineSound(s: EngineSound): void {
  s.osc.stop();
  s.osc.disconnect();
  s.gain.disconnect();
  if (s.owned) void s.ctx.close();
}

// ── One-shot sounds, synthesized; one per row of the design file's Feedback table. ──

function tone(ctx: AudioContext, type: OscillatorType, hz: number, seconds: number, delayS = 0, slideToHz?: number): void {
  const t0 = ctx.currentTime + delayS;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, t0);
  if (slideToHz !== undefined) osc.frequency.exponentialRampToValueAtTime(slideToHz, t0 + seconds);
  gain.gain.setValueAtTime(C.audio.fxGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

/** Correct: a short rising chime. */
export function playChime(ctx: AudioContext): void {
  tone(ctx, 'sine', 660, 0.1);
  tone(ctx, 'sine', 990, 0.16, 0.08);
}

/** Wrong or timed out. */
export function playBuzzer(ctx: AudioContext): void {
  tone(ctx, 'square', 150, 0.28);
}

/** Off-road. */
export function playRumble(ctx: AudioContext): void {
  tone(ctx, 'sawtooth', 50, 0.14);
}

/** Barrier hit. */
export function playThud(ctx: AudioContext): void {
  tone(ctx, 'sine', 120, 0.2, 0, 35);
}

/** A nitro charge fired; `high` is the Double Boost chain. */
export function playWhoosh(ctx: AudioContext, high: boolean): void {
  tone(ctx, 'sawtooth', high ? 320 : 200, 0.35, 0, high ? 1600 : 900);
}

export interface Screech {
  osc: OscillatorNode;
  lfo: OscillatorNode;
  gain: GainNode;
}

/** The tyre screech of a drift; runs until `stopScreech`. */
export function startScreech(ctx: AudioContext): Screech {
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = C.audio.screechHz;
  lfo.type = 'sine';
  lfo.frequency.value = 28;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(osc.frequency);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(C.audio.screechGain, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  lfo.start();
  return { osc, lfo, gain };
}

export function stopScreech(ctx: AudioContext, s: Screech): void {
  const t = ctx.currentTime;
  s.gain.gain.cancelScheduledValues(t);
  s.gain.gain.setValueAtTime(Math.max(s.gain.gain.value, 0.0001), t);
  s.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  s.osc.stop(t + 0.15);
  s.lfo.stop(t + 0.15);
}

/** Lap completed. */
export function playLapTone(ctx: AudioContext): void {
  tone(ctx, 'triangle', 880, 0.18);
}

/** Finish. */
export function playFanfare(ctx: AudioContext): void {
  [523, 659, 784].forEach((hz, i) => tone(ctx, 'triangle', hz, 0.16, i * 0.14));
  tone(ctx, 'triangle', 1047, 0.5, 0.42);
}
