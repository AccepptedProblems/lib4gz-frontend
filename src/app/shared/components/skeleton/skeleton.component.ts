import { Component, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

@Component({
  selector: 'lib-skeleton',
  standalone: true,
  template: `
    <div
      class="skeleton"
      [class]="variant()"
      [style.width]="width()"
      [style.height]="height()"
    ></div>
  `,
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent {
  variant = input<SkeletonVariant>('text');
  width = input<string>('100%');
  height = input<string>('16px');
}
