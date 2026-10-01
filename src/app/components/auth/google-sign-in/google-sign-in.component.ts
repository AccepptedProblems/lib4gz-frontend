import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, inject, input, output, signal, viewChild } from '@angular/core';
import { environment } from '../../../../environments/environment';

const POLL_INTERVAL_MS = 100;
const MAX_POLLS = 50;
/** Google's own height for size: 'large'. The face must match it exactly to stay aligned. */
const BUTTON_HEIGHT_PX = 40;

/**
 * Renders Google's own "Sign in with Google" button and emits the ID token it returns.
 * The script loads asynchronously from index.html, so this polls until it is ready.
 *
 * With [label], the button wears our own face: Google's button is stretched over it at zero opacity
 * and still takes every click, because its iframe is cross-origin and a click cannot be forwarded
 * into it. Consequences, all of them the price of the custom wording:
 * - The face is inert (`pointer-events: none`, `aria-hidden`); Google's hidden button is the real
 *   control, so a screen reader announces Google's wording, not [label].
 * - Sizes must agree. Both are pinned to [width] x 40px, Google's `size: 'large'` height.
 * - The face appears only once Google's button is really there, so a blocked script leaves nothing
 *   to press rather than a button that does nothing.
 */
@Component({
  selector: 'app-google-sign-in',
  template: `
    <div class="gsi" [class.gsi--faced]="label() && rendered()" [style.width.px]="width()">
      @if (label() && rendered()) {
        <span class="gsi__face" aria-hidden="true">
          <svg class="gsi__logo" viewBox="0 0 48 48" focusable="false">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span class="gsi__label">{{ label() }}</span>
        </span>
      }
      <div #host class="gsi__real"></div>
    </div>
  `,
  styles: `
    :host { display: flex; justify-content: center; min-height: 44px; }

    .gsi { position: relative; }

    /* Faced mode: the face is what people see, Google's button lies invisible on top of it. */
    .gsi--faced { height: ${BUTTON_HEIGHT_PX}px; }

    .gsi--faced .gsi__real {
      position: absolute;
      inset: 0;
      opacity: 0;
    }

    .gsi__face {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-sm);
      padding: 0 var(--spacing-md);
      border: 1px solid var(--neutral-color-4);
      border-radius: var(--radius-sm);
      background: var(--surface-color, #fff);
      color: var(--text-color);
      font-size: var(--body-medium-size);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      /* Every click must reach Google's button underneath the pointer, above in the stack. */
      pointer-events: none;
    }

    /* The real control owns focus and hover, so the face has to echo them. */
    .gsi--faced:hover .gsi__face { background: var(--neutral-color-1); }
    .gsi--faced:focus-within .gsi__face { outline: 2px solid var(--primary-color); outline-offset: 2px; }

    .gsi__logo { width: 18px; height: 18px; flex: 0 0 auto; }
    .gsi__label { overflow: hidden; text-overflow: ellipsis; }
  `,
})
export class GoogleSignInComponent implements AfterViewInit, OnDestroy {
  private readonly zone = inject(NgZone);

  // The only labels Google renders. [label] overrides what is shown; see the class comment.
  text = input<'signin_with' | 'signup_with' | 'continue_with'>('signin_with');
  width = input<number>(320);
  /** Our own wording, drawn over Google's button. Null keeps Google's plain button. */
  label = input<string | null>(null);
  credential = output<string>();

  /** True once Google's button exists, so the face is never shown without a working control. */
  readonly rendered = signal(false);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  ngAfterViewInit(): void {
    let polls = 0;
    this.pollTimer = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts?.id) {
        this.stopPolling();
        this.render();
      } else if (++polls >= MAX_POLLS) {
        this.stopPolling();
        console.warn('Google sign-in script did not load (blocked or offline); hiding the Google button.');
      }
    }, POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private render(): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      // GIS calls back outside Angular's zone.
      callback: response => this.zone.run(() => this.credential.emit(response.credential)),
    });
    google.accounts.id.renderButton(this.host().nativeElement, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: this.text(),
      shape: 'rectangular',
      width: this.width(),
      // No `locale` here: it is ignored. The button's language comes from `?hl=` on the script tag
      // in index.html.
    });
    // The iframe Google inserts carries its own width and height; stretch it over the face.
    const inner = this.host().nativeElement.querySelector<HTMLElement>('div, iframe');
    if (inner && this.label()) {
      inner.style.width = '100%';
      inner.style.height = '100%';
    }
    this.rendered.set(true);
  }

  private stopPolling(): void {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
}
