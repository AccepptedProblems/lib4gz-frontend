import { Component, input, computed } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'lib-avatar',
  standalone: true,
  template: `
    @if (src()) {
      <img
        class="avatar"
        [class]="size()"
        [src]="src()"
        [alt]="name() || 'Avatar'"
      />
    } @else {
      <span class="avatar fallback" [class]="size()">
        {{ initials() }}
      </span>
    }
  `,
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  src = input<string | null>(null);
  name = input<string>('');
  size = input<AvatarSize>('md');

  initials = computed(() => {
    const n = this.name();
    if (!n) return '?';
    return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  });
}
