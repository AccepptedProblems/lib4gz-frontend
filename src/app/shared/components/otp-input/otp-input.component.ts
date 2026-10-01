import { Component, ElementRef, computed, forwardRef, input, output, signal, viewChildren } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const LENGTH = 6;

/**
 * Six single-digit boxes for a one-time code. Typing advances, Backspace goes back,
 * and a pasted or autofilled code is spread across the boxes.
 */
@Component({
  selector: 'lib-otp-input',
  standalone: true,
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OtpInputComponent), multi: true },
  ],
})
export class OtpInputComponent implements ControlValueAccessor {
  disabled = input<boolean>(false);
  error = input<string | null>(null);
  /** Fires once every box holds a digit. */
  completed = output<string>();

  digits = signal<string[]>(Array(LENGTH).fill(''));
  private internalDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this.internalDisabled());

  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.setDigits(onlyDigits(value ?? '').split(''), false);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.internalDisabled.set(isDisabled);
  }

  onInput(index: number, event: Event): void {
    const typed = onlyDigits((event.target as HTMLInputElement).value);
    if (typed) {
      this.fill(index, typed);
    } else {
      this.setDigit(index, '');
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        if (this.digits()[index]) {
          this.setDigit(index, '');
        } else if (index > 0) {
          this.setDigit(index - 1, '');
          this.focusBox(index - 1);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.focusBox(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focusBox(index + 1);
        break;
    }
  }

  onPaste(index: number, event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = onlyDigits(event.clipboardData?.getData('text') ?? '');
    if (pasted) {
      // A whole code goes from the first box regardless of where it was pasted.
      this.fill(pasted.length >= LENGTH ? 0 : index, pasted);
    }
  }

  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  onBlur(): void {
    this.onTouched();
  }

  private fill(start: number, text: string): void {
    const next = [...this.digits()];
    let i = start;
    for (const ch of text) {
      if (i >= LENGTH) break;
      next[i++] = ch;
    }
    this.setDigits(next, true);
    this.focusBox(Math.min(i, LENGTH - 1));
  }

  private setDigit(index: number, value: string): void {
    const next = [...this.digits()];
    next[index] = value;
    this.setDigits(next, true);
  }

  private setDigits(next: string[], emit: boolean): void {
    while (next.length < LENGTH) next.push('');
    this.digits.set(next.slice(0, LENGTH));
    // Keep the DOM in step even when a box received more than one character.
    this.boxes().forEach((box, i) => (box.nativeElement.value = this.digits()[i]));
    if (emit) {
      const value = this.digits().join('');
      this.onChange(value);
      if (value.length === LENGTH) this.completed.emit(value);
    }
  }

  private focusBox(index: number): void {
    const box = this.boxes()[index]?.nativeElement;
    box?.focus();
    box?.select();
  }
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}
