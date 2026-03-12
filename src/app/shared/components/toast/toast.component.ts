import { Component, Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly messages = signal<ToastMessage[]>([]);

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  private show(text: string, variant: 'success' | 'error'): void {
    const id = this.nextId++;
    this.messages.update(msgs => [...msgs, { id, text, variant }]);
    setTimeout(() => this.dismiss(id), 4000);
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
          <span class="material-icons toast__icon">
            {{ msg.variant === 'success' ? 'check_circle' : 'error' }}
          </span>
          <span class="toast__text">{{ msg.text }}</span>
        </div>
      }
    </div>
  `,
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}
