import {
  Component, input, output, signal, computed, forwardRef, effect,
  viewChild, ElementRef, afterNextRender, Injector, inject,
} from '@angular/core';
import {
  ControlValueAccessor, NG_VALUE_ACCESSOR,
} from '@angular/forms';

export type TextareaSize = 'normal' | 'small';

@Component({
  selector: 'lib-textarea',
  standalone: true,
  templateUrl: './textarea.component.html',
  styleUrl: './textarea.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
})
export class TextareaComponent implements ControlValueAccessor {
  private static nextId = 0;
  protected readonly textareaId = `lib-textarea-${TextareaComponent.nextId++}`;
  private readonly injector = inject(Injector);

  // Config inputs
  label = input<string>('');
  placeholder = input<string>('');
  size = input<TextareaSize>('normal');
  error = input<string | null>(null);
  disabled = input<boolean>(false);
  required = input<boolean>(false);
  minRows = input<number>(3);
  maxRows = input<number>(15);
  ariaLabel = input<string>('');

  // Value input for direct binding (non-CVA)
  value = input<string>('');
  valueChange = output<string>();

  // Internal state
  protected internalValue = signal<string>('');
  focused = signal<boolean>(false);
  private internalDisabled = signal<boolean>(false);
  private cvaActive = false;

  isFloating = computed(() => this.focused() || this.internalValue().length > 0);
  isDisabled = computed(() => this.disabled() || this.internalDisabled());

  protected textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Sync external value input → internal value (when not using CVA)
    effect(() => {
      const v = this.value();
      if (!this.cvaActive) {
        this.internalValue.set(v);
        this.scheduleResize();
      }
    });
  }

  // ── ControlValueAccessor ──────────────────────────────────────

  writeValue(val: string): void {
    this.cvaActive = true;
    this.internalValue.set(val ?? '');
    this.scheduleResize();
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

  // ── Event handlers ────────────────────────────────────────────

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.internalValue.set(target.value);
    this.onChange(target.value);
    this.valueChange.emit(target.value);
    this.autoResize();
  }

  onFocus(): void {
    this.focused.set(true);
  }

  onBlur(): void {
    this.focused.set(false);
    this.onTouched();
  }

  // ── Auto-resize ───────────────────────────────────────────────

  autoResize(): void {
    const ta = this.textareaRef()?.nativeElement;
    if (!ta || !ta.offsetParent) return;
    ta.style.height = 'auto';
    const style = getComputedStyle(ta);
    const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.5);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const maxHeight = lineHeight * this.maxRows() + padding + border;
    const clampedHeight = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = clampedHeight + 'px';
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  private scheduleResize(): void {
    afterNextRender(() => this.autoResize(), { injector: this.injector });
  }
}
