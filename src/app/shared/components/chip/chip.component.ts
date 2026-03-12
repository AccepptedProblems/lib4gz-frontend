import { Component, input, output } from '@angular/core';

export type ChipVariant = 'default' | 'success' | 'warning' | 'error' | 'neutral';

@Component({
  selector: 'lib-chip',
  standalone: true,
  template: `
    <button
      class="chip"
      [class.selected]="selected()"
      [class]="'variant-' + variant()"
      [attr.aria-selected]="selected()"
      role="option"
      (click)="chipClick.emit(value())"
    >
      <span class="chip__label">{{ label() }}</span>
      @if (count() !== null && count()! > 0) {
        <span class="chip__count">{{ count() }}</span>
      }
    </button>
  `,
  styleUrl: './chip.component.scss',
})
export class ChipComponent {
  label = input.required<string>();
  value = input.required<string>();
  selected = input<boolean>(false);
  variant = input<ChipVariant>('default');
  count = input<number | null>(null);

  chipClick = output<string>();
}
