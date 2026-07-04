import { Component, computed, input } from '@angular/core';

export type ProgressBarVariant = 'primary' | 'success';

@Component({
  selector: 'lib-progress-bar',
  standalone: true,
  template: `
    <div class="progress" [class.progress--success]="variant() === 'success'">
      <div
        class="progress__track"
        role="progressbar"
        [attr.aria-valuenow]="clampedValue()"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="progress__fill" [style.width.%]="clampedValue()"></div>
      </div>
      @if (showLabel()) {
        <span class="progress__label text-label-medium">{{ clampedValue() }}%</span>
      }
    </div>
  `,
  styleUrl: './progress-bar.component.scss',
})
export class ProgressBarComponent {
  value = input<number>(0);
  showLabel = input<boolean>(false);
  variant = input<ProgressBarVariant>('primary');

  clampedValue = computed(() => Math.round(Math.max(0, Math.min(100, this.value()))));
}
