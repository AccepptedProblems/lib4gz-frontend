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

/**
 * Correct: a short rising chime, `step` notes up `C.ui.streak.chime` for the answers before it
 * in the streak (0 for the first), held at the last note past the end.
 */
export function playChime(ctx: AudioContext, step = 0): void {
  const steps = C.ui.streak.chime;
  const up = 2 ** (steps[Math.max(0, Math.min(step, steps.length - 1))] / 12);
  tone(ctx, 'sine', 660 * up, 0.1);
  tone(ctx, 'sine', 990 * up, 0.16, 0.08);
}

/** A streak of three or more broke: STREAK LOST, two falling notes and a sagging buzz. */
export function playStreakLost(ctx: AudioContext): void {
  tone(ctx, 'square', 523, 0.11);
  tone(ctx, 'square', 392, 0.11, 0.12);
  tone(ctx, 'sawtooth', 311, 0.42, 0.24, 156);
}

/** Splash fires on a wrong answer or a timeout: a hiss of water, white noise through a band-pass sweeping down, over the pump's thwip. */
export function playSquirt(ctx: AudioContext): void {
  const seconds = 0.22;
  const t0 = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(3200, t0);
  band.frequency.exponentialRampToValueAtTime(900, t0 + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(C.audio.fxGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  noise.connect(band).connect(gain).connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + seconds);
  tone(ctx, 'sine', 600, 0.08, 0, 250);
}

/** Splash's bubble pops on the kart. */
export function playPop(ctx: AudioContext): void {
  tone(ctx, 'sine', 380, 0.06, 0, 1400);
}

/** Splash throws the bottle on a right answer: a soft rising swish. */
export function playToss(ctx: AudioContext): void {
  tone(ctx, 'triangle', 260, 0.14, 0, 620);
}

/** The kart catches the bottle: a glassy clink. */
export function playCatch(ctx: AudioContext): void {
  tone(ctx, 'sine', 1320, 0.07);
  tone(ctx, 'sine', 1760, 0.1, 0.05);
}

/** A boost starts; `high` is a Double Boost. */
export function playWhoosh(ctx: AudioContext, high: boolean): void {
  tone(ctx, 'sawtooth', high ? 320 : 200, 0.35, 0, high ? 1600 : 900);
}

/** Lap completed. */
export function playLapTone(ctx: AudioContext): void {
  tone(ctx, 'triangle', 880, 0.18);
}

/** Finish; a perfect race climbs on past the top note, under the banner's fireworks. */
export function playFanfare(ctx: AudioContext, perfect = false): void {
  [523, 659, 784].forEach((hz, i) => tone(ctx, 'triangle', hz, 0.16, i * 0.14));
  tone(ctx, 'triangle', 1047, perfect ? 0.24 : 0.5, 0.42);
  if (!perfect) return;
  [1319, 1568].forEach((hz, i) => tone(ctx, 'triangle', hz, 0.12, 0.62 + i * 0.1));
  tone(ctx, 'triangle', 2093, 0.6, 0.82);
}
