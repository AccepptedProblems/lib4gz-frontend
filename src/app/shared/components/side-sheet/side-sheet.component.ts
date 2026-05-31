import { Component, HostListener, computed, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

export type SideSheetSize = 'sm' | 'md' | 'lg';
export type SideSheetPosition = 'start' | 'end';

@Component({
  selector: 'lib-side-sheet',
  standalone: true,
  imports: [A11yModule],
  template: `
    @if (open()) {
      <div
        class="side-sheet-backdrop"
        (click)="onBackdropClick()"
        aria-hidden="true"
      ></div>
      <aside
        class="side-sheet"
        [class]="panelClasses()"
        [style.--side-sheet-width]="widthVar()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title() || null"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
      >
        <header class="side-sheet__header">
          @if (title()) {
            <h2 class="side-sheet__title text-title-medium">{{ title() }}</h2>
          }
          <button
            type="button"
            class="side-sheet__close"
            (click)="close.emit()"
            aria-label="Close panel"
          >
            <span class="material-icons">close</span>
          </button>
        </header>

        <div class="side-sheet__body">
          <ng-content />
        </div>

        <footer class="side-sheet__footer">
          <ng-content select="[sideSheetFooter]" />
        </footer>
      </aside>
    }
  `,
  styleUrl: './side-sheet.component.scss',
})
export class SideSheetComponent {
  open = input<boolean>(false);
  title = input<string>('');
  size = input<SideSheetSize>('md');
  position = input<SideSheetPosition>('end');
  closeOnBackdrop = input<boolean>(true);

  close = output<void>();

  panelClasses = computed(
    () =>
      `side-sheet--${this.position()} side-sheet--${this.size()}`,
  );

  widthVar = computed(() => {
    switch (this.size()) {
      case 'sm': return 'var(--side-sheet-sm)';
      case 'lg': return 'var(--side-sheet-lg)';
      default: return 'var(--side-sheet-md)';
    }
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close.emit();
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop()) this.close.emit();
  }
}
