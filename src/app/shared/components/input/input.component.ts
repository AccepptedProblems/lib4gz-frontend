import {
  Component, input, computed, signal, forwardRef
} from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR
} from '@angular/forms';

export type InputSize = 'normal' | 'small';
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

@Component({
  selector: 'lib-input',
  standalone: true,
  imports: [],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  private static nextId = 0;
  protected readonly inputId = `lib-input-${InputComponent.nextId++}`;

  label = input.required<string>();
  size = input<InputSize>('normal');
  type = input<InputType>('text');
  error = input<string | null>(null);
  disabled = input<boolean>(false);
  required = input<boolean>(false);

  value = signal<string>('');
  focused = signal<boolean>(false);
  private internalDisabled = signal<boolean>(false);

  isFloating = computed(() => this.focused() || this.value().length > 0);
  isDisabled = computed(() => this.disabled() || this.internalDisabled());

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value ?? '');
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

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value.set(target.value);
    this.onChange(target.value);
  }

  onFocus(): void {
    this.focused.set(true);
  }

  onBlur(): void {
    this.focused.set(false);
    this.onTouched();
  }
}
