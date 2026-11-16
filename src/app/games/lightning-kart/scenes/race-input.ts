import Phaser from 'phaser';
import { C } from '../engine/constants';

const CARD_COUNT = C.ui.cards.fill.length; // one card, and one number key, per colour
const POINTERS = 3; // pointers the game tracks: two thumbs on the stage and one more

export interface RaceInputHandlers {
  /** -1 or 1 while a half of the stage is held, 0 on release. */
  steer(value: number): void;
  /** A number key, 0-based; the scene checks a question is open. */
  answer(index: number): void;
  escape(): void;
}

/** What the held keys say, read each frame. */
export interface RaceKeys {
  steer(): number;
}

/**
 * The Race scene's input: Left/Right or A/D steer, 1 to 4 answer, Escape is reported for the
 * scene to count; a repeated keydown of the answer and Escape keys does nothing. Holding the
 * left or right half of the stage steers too, except over a button or a card; with two
 * thumbs down, the later one steers until it lifts.
 */
export function setupRaceInput(scene: Phaser.Scene, on: RaceInputHandlers): RaceKeys {
  const keyboard = scene.input.keyboard;
  const keys = keyboard
    ? (keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D' }) as Record<'left' | 'right' | 'a' | 'd', Phaser.Input.Keyboard.Key>)
    : null;
  // These keys are not registered with Phaser, so the OS's auto-repeat reaches them: a held
  // key would answer every question and quit the instant each can.
  const fresh = (act: (event: KeyboardEvent) => void) => (event: KeyboardEvent): void => { if (!event.repeat) act(event); };
  keyboard?.on('keydown-ESC', fresh(() => on.escape()));
  keyboard?.on('keydown', fresh((event) => {
    const i = event.keyCode - Phaser.Input.Keyboard.KeyCodes.ONE; // the number row, as Phaser's keydown-ONE reads it
    if (i >= 0 && i < CARD_COUNT) on.answer(i);
  }));

  // Every pointer holding a half of the stage, oldest first; the latest one still down steers.
  // A pointer that comes down again lost its up (a context menu, a blur): its old hold goes.
  const held: { id: number; side: number }[] = [];
  const missing = POINTERS - scene.input.manager.pointersTotal; // Phaser keeps pointers game-wide
  if (missing > 0) scene.input.addPointer(missing);
  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: unknown[]) => {
    if (over.length) return;
    const old = held.findIndex((h) => h.id === pointer.id);
    if (old >= 0) held.splice(old, 1);
    held.push({ id: pointer.id, side: pointer.x < scene.scale.gameSize.width / 2 ? -1 : 1 });
    on.steer(held[held.length - 1].side);
  });
  const release = (pointer: Phaser.Input.Pointer): void => {
    const i = held.findIndex((h) => h.id === pointer.id);
    if (i < 0) return;
    held.splice(i, 1);
    on.steer(held.length ? held[held.length - 1].side : 0);
  };
  scene.input.on('pointerup', release);
  scene.input.on('pointerupoutside', release);

  return {
    steer: () => (keys ? ((keys.right.isDown || keys.d.isDown) ? 1 : 0) - ((keys.left.isDown || keys.a.isDown) ? 1 : 0) : 0),
  };
}
