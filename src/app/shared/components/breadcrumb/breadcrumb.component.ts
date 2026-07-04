import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  routerLink?: string | any[];
  queryParams?: Record<string, any>;
}

@Component({
  selector: 'lib-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol class="breadcrumb__list">
        @for (item of items(); track $index; let last = $last) {
          <li class="breadcrumb__item">
            @if (!last && item.routerLink) {
              <a
                class="breadcrumb__link text-body-medium"
                [routerLink]="item.routerLink"
                [queryParams]="item.queryParams"
              >{{ item.label }}</a>
            } @else {
              <span
                class="breadcrumb__current text-body-medium"
                [attr.aria-current]="last ? 'page' : null"
              >{{ item.label }}</span>
            }
            @if (!last) {
              <span class="material-icons breadcrumb__separator" aria-hidden="true">chevron_right</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  items = input.required<BreadcrumbItem[]>();
}
