import { Component, Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

/** Optional action rendered as a button inside the toast (e.g. "View result"). */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
  action?: ToastAction;
}

const TOAST_ICONS: Record<ToastVariant, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning_amber',
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly messages = signal<ToastMessage[]>([]);

  success(text: string, action?: ToastAction): void {
    this.show(text, 'success', action);
  }

  error(text: string, action?: ToastAction): void {
    this.show(text, 'error', action);
  }

  info(text: string, action?: ToastAction): void {
    this.show(text, 'info', action);
  }

  warning(text: string, action?: ToastAction): void {
    this.show(text, 'warning', action);
  }

  private show(text: string, variant: ToastVariant, action?: ToastAction): void {
    const id = this.nextId++;
    this.messages.update(msgs => [...msgs, { id, text, variant, action }]);
    // Actionable toasts stay a little longer so the button is actually reachable.
    setTimeout(() => this.dismiss(id), action ? 6000 : 4000);
  }

  dismiss(id: number): void {
    this.messages.update(msgs => msgs.filter(m => m.id !== id));
  }
}

@Component({
  selector: 'lib-toast',
  standalone: true,
  template: `
    <div class="toast-container">
      @for (msg of toastService.messages(); track msg.id) {
        <div class="toast" [class]="msg.variant" (click)="toastService.dismiss(msg.id)">
          <span class="material-icons toast__icon">{{ icon(msg.variant) }}</span>
          <span class="toast__text">{{ msg.text }}</span>
          @if (msg.action; as action) {
            <button
              class="toast__action"
              (click)="runAction(msg, $event)"
            >{{ action.label }}</button>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  icon(variant: ToastVariant): string {
    return TOAST_ICONS[variant];
  }

  runAction(msg: ToastMessage, event: Event): void {
    event.stopPropagation();
    msg.action?.run();
    this.toastService.dismiss(msg.id);
  }
}
