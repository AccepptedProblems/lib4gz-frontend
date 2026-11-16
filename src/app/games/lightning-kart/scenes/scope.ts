import Phaser from 'phaser';
import { bridgeOf, RaceScope } from '../bridge';
import { C } from '../engine/constants';
import { serverChecker } from './answer-checker';
import { ScopeChoice } from './data';
import { SCENE } from './keys';
import { backdrop, button, cornerButton, panel, setupStage, title } from './widgets';

const UI = C.ui;
const FIRST_ROW_Y = 124;
const BOARD_PAD = 16;

/** "Whole course · N" then one row per module on a board. Under the minimum: greyed, "needs 6". */
export class ScopeScene extends Phaser.Scene {
  constructor() {
    super(SCENE.scope);
  }

  create(): void {
    setupStage(this);
    backdrop(this);
    title(this, UI.pad, UI.pad + 20, 'RACE ON', { originX: 0 });
    cornerButton(this, 'Back', () => this.scene.start(SCENE.home));

    const choices = this.choices();
    const { w, h, gap } = UI.row;
    panel(this, UI.pad - BOARD_PAD, FIRST_ROW_Y - h / 2 - BOARD_PAD, w + 2 * BOARD_PAD, choices.length * (h + gap) - gap + 2 * BOARD_PAD);
    const x = UI.pad + w / 2;
    choices.forEach((choice, i) => {
      const y = FIRST_ROW_Y + i * (h + gap);
      const count = choice.count;
      const ok = count >= C.minQuestions;
      const text = ok ? `${choice.name} · ${count}` : `${choice.name} · ${count}   needs ${C.minQuestions}`;
      button(this, x, y, text, () => this.pick(choice.scope), { w, h, size: UI.font.body, disabled: !ok });
    });
  }

  /** Every scope with its bank's count, the whole course first; the server decides every answer. */
  choices(): ScopeChoice[] {
    const bridge = bridgeOf(this);
    const { questions, modules } = bridge.data;
    const checker = serverChecker(bridge.calls);
    return [
      { scope: 'course', name: 'Whole course', count: questions.length, checker },
      ...modules.map(m => ({ scope: m.id, name: m.title, count: questions.filter(q => q.moduleId === m.id).length, checker })),
    ];
  }

  /** Starts Ready for a scope with enough questions; does nothing otherwise. */
  pick(scope: RaceScope): void {
    const choice = this.choices().find(c => c.scope === scope);
    if (!choice || choice.count < C.minQuestions) return;
    bridgeOf(this).intent('scopeChosen', scope);
    this.scene.start(SCENE.ready, choice);
  }
}
