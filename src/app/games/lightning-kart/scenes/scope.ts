import Phaser from 'phaser';
import { bridgeOf, RaceScope } from '../bridge';
import { C } from '../engine/constants';
import { ScopeChoice } from './data';
import { SCENE } from './keys';
import { button, cornerButton, label, setupStage } from './widgets';

const UI = C.ui;

/** "Whole course · N" then one row per module. Under the minimum: greyed, "needs 6". */
export class ScopeScene extends Phaser.Scene {
  constructor() {
    super(SCENE.scope);
  }

  create(): void {
    setupStage(this);
    label(this, UI.pad, UI.pad + 18, 'RACE ON', { size: UI.font.title * 0.7, bold: true, originX: 0 });
    cornerButton(this, 'Back', () => this.scene.start(SCENE.home));

    const x = UI.pad + UI.row.w / 2;
    this.choices().forEach((choice, i) => {
      const y = 110 + i * (UI.row.h + UI.row.gap);
      const count = choice.questions.length;
      const ok = count >= C.minQuestions;
      const text = ok ? `${choice.name} · ${count}` : `${choice.name} · ${count}   needs ${C.minQuestions}`;
      button(this, x, y, text, () => this.pick(choice.scope), { w: UI.row.w, h: UI.row.h, size: UI.font.body, disabled: !ok });
    });
  }

  /** Every scope with its deck, the whole course first. */
  choices(): ScopeChoice[] {
    const data = bridgeOf(this).data;
    return [
      { scope: 'course', name: 'Whole course', questions: data.questions },
      ...data.modules.map(m => ({ scope: m.id, name: m.title, questions: data.questions.filter(q => q.moduleId === m.id) })),
    ];
  }

  /** Starts Ready for a scope with enough questions; does nothing otherwise. */
  pick(scope: RaceScope): void {
    const choice = this.choices().find(c => c.scope === scope);
    if (!choice || choice.questions.length < C.minQuestions) return;
    bridgeOf(this).intent('scopeChosen', scope);
    this.scene.start(SCENE.ready, choice);
  }
}
