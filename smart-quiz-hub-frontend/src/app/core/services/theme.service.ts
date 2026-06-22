import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'sqh-theme';

  isDark = signal(localStorage.getItem(this.KEY) === 'dark');

  constructor() {
    // Sync class + storage whenever signal changes.
    effect(() => {
      document.documentElement.classList.toggle('dark', this.isDark());
      localStorage.setItem(this.KEY, this.isDark() ? 'dark' : 'light');
    });
    // Apply immediately so there is no flash on load.
    document.documentElement.classList.toggle('dark', this.isDark());
  }

  toggle(): void { this.isDark.update(v => !v); }
}
