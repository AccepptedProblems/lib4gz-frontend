import { Component, input } from '@angular/core';

export type EmptyStateTone = 'default' | 'error';

@Component({
  selector: 'lib-empty-state',
  standalone: true,
  template: `
    <div
      class="empty-state"
      [class.empty-state--error]="tone() === 'error'"
      [attr.role]="role()"
      [attr.aria-live]="ariaLive()"
    >
      <ng-content select="[emptyStateIcon]" />
      @if (icon()) {
        <span class="material-icons empty-state__icon">{{ icon() }}</span>
      }

      @if (title()) {
        <p class="empty-state__title text-title-large">{{ title() }}</p>
      }

      @if (message()) {
        <p class="empty-state__message text-body-medium">{{ message() }}</p>
      }

      <div class="empty-state__cta">
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  icon = input<string>('');
  title = input<string>('');
  message = input<string>('');
  tone = input<EmptyStateTone>('default');
  role = input<string | null>(null);
  ariaLive = input<'polite' | 'assertive' | null>(null);
}
