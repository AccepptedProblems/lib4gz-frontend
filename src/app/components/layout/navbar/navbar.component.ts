import { Component, inject, signal, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly userInitial = this.authService.getUserName().charAt(0).toUpperCase() || 'U';
  readonly userName = this.authService.getUserName();
  readonly avatarMenuOpen = signal(false);

  toggleAvatarMenu(event: Event): void {
    event.stopPropagation();
    this.avatarMenuOpen.update(open => !open);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click')
  closeAvatarMenu(): void {
    if (this.avatarMenuOpen()) {
      this.avatarMenuOpen.set(false);
    }
  }
}
