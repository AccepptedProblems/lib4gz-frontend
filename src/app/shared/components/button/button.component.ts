import { Component, input, output, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SpinnerComponent } from '../spinner/spinner.component';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'lib-button',
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  // Inputs (Angular 18 signal-based)
  isLoading = input<boolean>(false);
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input<boolean>(false);
  type = input<ButtonType>('button');
  routerLink = input<string | any[] | null>(null);
  routerState = input<Record<string, any> | null>(null);
  ariaLabel = input<string | null>(null);

  // Output
  buttonClick = output<MouseEvent>();

  // Computed
  isDisabled = computed(() => this.disabled() || this.isLoading());

  spinnerDiameter = computed(() => {
    const sizeMap: Record<ButtonSize, number> = { sm: 16, md: 20, lg: 24 };
    return sizeMap[this.size()];
  });

  private router = inject(Router);

  handleClick(event: MouseEvent): void {
    if (this.isDisabled()) return;

    const link = this.routerLink();
    if (link) {
      const path = Array.isArray(link) ? link : [link];
      this.router.navigate(path, { state: this.routerState() ?? undefined });
    }

    this.buttonClick.emit(event);
  }
}
