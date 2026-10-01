// Minimal typings for the Google Identity Services script loaded in index.html.
// Only the calls the app makes; see https://developers.google.com/identity/gsi/web/reference/js-reference
declare namespace google.accounts.id {
  interface CredentialResponse {
    /** The Google ID token (a JWT) to send to the backend. */
    credential: string;
    select_by?: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
  }

  interface GsiButtonConfiguration {
    type: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number;
    // `locale` exists in Google's reference but is ignored in practice; set the language with
    // `?hl=` on the script tag instead (see index.html).
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
  function disableAutoSelect(): void;
}
