import { Component } from '@angular/core';

/** The decorative left panel shared by the sign-in and sign-up screens. */
@Component({
  selector: 'app-auth-brand',
  template: `
    <div class="brand-panel">
      <div class="brand-mark">
        <span class="material-icons">school</span>
        <span class="brand-name">Lib4GZ</span>
      </div>
      <div class="mock-card">
        <div class="mock-line mock-line--title"></div>
        <div class="mock-progress"><div class="mock-progress-fill"></div></div>
        <div class="mock-lesson">
          <span class="material-icons">check_circle</span>
          <div class="mock-line"></div>
        </div>
        <div class="mock-lesson">
          <span class="material-icons">check_circle</span>
          <div class="mock-line"></div>
        </div>
        <div class="mock-lesson mock-lesson--pending">
          <span class="material-icons">radio_button_unchecked</span>
          <div class="mock-line"></div>
        </div>
      </div>
      <p class="brand-tagline">Learn at your own pace.<br />Watch your progress add up.</p>
    </div>
  `,
  styleUrl: './auth-brand.component.scss',
})
export class AuthBrandComponent {}
