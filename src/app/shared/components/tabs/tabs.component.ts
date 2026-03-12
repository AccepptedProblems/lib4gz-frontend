import { Component, input, output, computed } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'lib-tabs',
  standalone: true,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.id) {
        <button
          class="tab"
          [class.tab--active]="activeTab() === tab.id"
          role="tab"
          [attr.aria-selected]="activeTab() === tab.id"
          [attr.aria-controls]="'tabpanel-' + tab.id"
          [id]="'tab-' + tab.id"
          (click)="tabChange.emit(tab.id)"
        >
          @if (tab.icon) {
            <span class="material-icons tab__icon">{{ tab.icon }}</span>
          }
          <span class="tab__label">{{ tab.label }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './tabs.component.scss',
})
export class TabsComponent {
  tabs = input.required<TabItem[]>();
  activeTab = input.required<string>();
  ariaLabel = input<string>('Tab navigation');

  tabChange = output<string>();
}
