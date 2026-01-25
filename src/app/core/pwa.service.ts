import { Injectable, signal } from '@angular/core';

/**
 * PWA Service - Handles the "Add to Home Screen" install prompt
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
    // Stores the deferred prompt event
    private deferredPrompt: any = null;

    // Signals for UI
    canInstall = signal(false);
    isInstalled = signal(false);

    constructor() {
        this.initializePromptListener();
        this.checkIfInstalled();
    }

    private initializePromptListener() {
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Store the event for later use
            this.deferredPrompt = e;
            // Update signal - install is now possible
            this.canInstall.set(true);
        });

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            this.canInstall.set(false);
            this.isInstalled.set(true);
            this.deferredPrompt = null;
        });
    }

    private checkIfInstalled() {
        // Check if running as standalone PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled.set(true);
            this.canInstall.set(false);
        }

        // iOS Safari standalone check
        if ((window.navigator as any).standalone === true) {
            this.isInstalled.set(true);
            this.canInstall.set(false);
        }
    }

    /**
     * Trigger the install prompt
     * Returns a promise that resolves with the user's choice
     */
    async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
        if (!this.deferredPrompt) {
            return 'unavailable';
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;

        // Clear the deferred prompt
        this.deferredPrompt = null;
        this.canInstall.set(false);

        return outcome;
    }

    /**
     * Get instructions for manual installation (for browsers that don't support beforeinstallprompt)
     */
    getManualInstallInstructions(): string {
        const userAgent = navigator.userAgent.toLowerCase();

        if (/iphone|ipad|ipod/.test(userAgent)) {
            return 'Toque em "Compartilhar" e depois "Adicionar à Tela de Início"';
        } else if (/android/.test(userAgent)) {
            return 'Toque no menu (⋮) e depois "Adicionar à tela inicial"';
        } else if (/chrome/.test(userAgent)) {
            return 'Clique no ícone de instalação na barra de endereços ou menu (⋮) > "Instalar"';
        } else if (/firefox/.test(userAgent)) {
            return 'Firefox: Menu > Instalar site como app';
        } else if (/edge/.test(userAgent)) {
            return 'Edge: Menu (…) > Apps > Instalar este site como app';
        }

        return 'Use o menu do navegador para instalar este app';
    }
}
