export type ItemKind = 'question';

export interface ItemEvent {
  type: 'item';
  kind: ItemKind;
  racerId: string;
}

export interface ItemDef {
  onHit(racerId: string): ItemEvent;
}

// What a box does when a racer drives through it. The shell handles the event.
export const ITEMS: Record<ItemKind, ItemDef> = {
  question: { onHit: (racerId) => ({ type: 'item', kind: 'question', racerId }) },
};
