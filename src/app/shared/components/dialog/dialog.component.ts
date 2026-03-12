import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'lib-dialog',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (open()) {
      <div class="dialog-backdrop" (click)="cancel.emit()" aria-hidden="true"></div>
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        [style.width]="width() ? 'min(90vw, ' + width() + ')' : null"
      >
        <div class="dialog__header">
          @if (icon()) {
            <span class="material-icons dialog__icon" [class]="iconClass()">{{ icon() }}</span>
          }
          <h3 class="text-title-medium dialog__title">{{ title() }}</h3>
        </div>

        <div class="dialog__body text-body-medium">
          <ng-content />
        </div>

        <div class="dialog__actions">
          <lib-button variant="secondary" size="md" (buttonClick)="cancel.emit()">
            {{ cancelLabel() }}
          </lib-button>
          <lib-button
            [variant]="confirmVariant()"
            size="md"
            [isLoading]="loading()"
            (buttonClick)="confirm.emit()"
          >
            {{ confirmLabel() }}
          </lib-button>
        </div>
      </div>
    }
  `,
  styleUrl: './dialog.component.scss',
})
export class DialogComponent {
  open = input<boolean>(false);
  title = input<string>('');
  icon = input<string>('');
  iconClass = input<string>('');
  width = input<string>('');
  confirmLabel = input<string>('Confirm');
  cancelLabel = input<string>('Cancel');
  confirmVariant = input<'primary' | 'destructive'>('primary');
  loading = input<boolean>(false);

  confirm = output<void>();
  cancel = output<void>();
}
