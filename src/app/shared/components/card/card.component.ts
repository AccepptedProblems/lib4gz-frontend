import { Component, input } from '@angular/core';

export type CardVariant = 'elevated' | 'outlined' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'lib-card',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './card.component.scss',
  host: {
    '[class.card--elevated]': "variant() === 'elevated'",
    '[class.card--outlined]': "variant() === 'outlined'",
    '[class.card--flat]': "variant() === 'flat'",
    '[class.card--hoverable]': 'hoverable()',
    '[class.card--pad-none]': "padding() === 'none'",
    '[class.card--pad-sm]': "padding() === 'sm'",
    '[class.card--pad-md]': "padding() === 'md'",
    '[class.card--pad-lg]': "padding() === 'lg'",
  },
})
export class CardComponent {
  variant = input<CardVariant>('elevated');
  hoverable = input<boolean>(false);
  padding = input<CardPadding>('md');
}
