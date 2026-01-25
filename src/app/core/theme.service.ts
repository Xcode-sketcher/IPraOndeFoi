import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly platformId = inject(PLATFORM_ID);
    readonly isDark = signal(false);

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            const stored = localStorage.getItem('theme');
            if (stored) {
                this.isDark.set(stored === 'dark');
            } else {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.isDark.set(prefersDark);
            }

            // Apply initial theme
            this.applyTheme(this.isDark());

            effect(() => {
                this.applyTheme(this.isDark());
            });
        }
    }

    private applyTheme(dark: boolean) {
        if (isPlatformBrowser(this.platformId)) {
            if (dark) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        }
    }

    toggle() {
        this.isDark.update(d => !d);
    }
}

