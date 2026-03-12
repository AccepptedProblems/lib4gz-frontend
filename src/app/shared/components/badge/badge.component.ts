import { Component, input, computed } from '@angular/core';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

@Component({
  selector: 'lib-badge',
  standalone: true,
  template: `
    <span
      class="badge"
      [class]="variant()"
      [attr.aria-label]="ariaLabel()"
    >
      <ng-content />
    </span>
  `,
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  variant = input<BadgeVariant>('neutral');
  ariaLabel = input<string | null>(null);
}
