import { Component, computed, inject } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavbarComponent } from './components/layout/navbar/navbar.component';
import { ToastComponent } from './shared/components';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent, ToastComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'lib4gz-fe';

  private readonly router = inject(Router);
  private readonly hiddenRoutes = ['/login', '/register'];
  private readonly hiddenRoutePatterns = [
    /^\/course\/[^/]+\/manage\/exercise\//,
    /^\/course\/[^/]+\/lesson\/[^/]+\/attempt/,
  ];

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  showNavbar = computed(() => {
    const url = this.currentUrl();
    if (this.hiddenRoutes.some(route => url === route || url.startsWith(route + '?'))) {
      return false;
    }
    if (this.hiddenRoutePatterns.some(pattern => pattern.test(url))) {
      return false;
    }
    return true;
  });
}
