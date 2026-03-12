import { Component, input, computed } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

export type SpinnerType = 'screen' | 'inline' | 'overlay';
export type SpinnerColor = 'primary' | 'accent' | 'inherit';

@Component({
  selector: 'lib-spinner',
  standalone: true,
  imports: [MatProgressSpinner],
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss',
})
export class SpinnerComponent {
  type = input<SpinnerType>('inline');
  diameter = input<number>(40);
  strokeWidth = input<number>(4);
  color = input<SpinnerColor>('primary');
  label = input<string>('Loading');

  matColor = computed(() => {
    const c = this.color();
    return c === 'inherit' ? undefined : c;
  });
}
