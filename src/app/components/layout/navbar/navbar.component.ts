import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, MeService } from '../../../services';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly meService = inject(MeService);
  private readonly router = inject(Router);

  readonly userInitial = this.authService.userInitial;
  readonly userName = this.authService.userName;
  readonly avatarMenuOpen = signal(false);

  ngOnInit(): void {
    // Refresh the stored user once per app load: picks up role grants and fills in
    // sessions stored before the full user was kept in localStorage.
    if (this.authService.isAuthenticated()) {
      this.meService.getMe().subscribe({
        next: user => this.authService.setCurrentUser(user),
        error: () => {},
      });
    }
  }

  toggleAvatarMenu(event: Event): void {
    event.stopPropagation();
    this.avatarMenuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.avatarMenuOpen.set(false);
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
