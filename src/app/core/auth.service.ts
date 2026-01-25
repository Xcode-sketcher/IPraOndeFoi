import { computed, Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiService } from './api.service';
import { tap } from 'rxjs';

const TOKEN_KEY = 'praondefoi.token';
const SESSION_KEY = 'praondefoi.session';
const USER_KEY = 'praondefoi.user';

export type User = {
    id: string | number;
    email: string;
    contaId?: number;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly api = inject(ApiService);
    private readonly token = signal<string | null>(this.getStoredToken());
    private readonly session = signal<boolean>(this.getStoredSession());
    private readonly user = signal<User | null>(null);

    readonly isAuthenticated = computed(() => Boolean(this.token() || this.session()));
    readonly currentUser = computed(() => this.user());

    constructor() {
        const storedUser = this.getStoredUser();
        if (storedUser) {
            this.user.set(storedUser);
        }
    }

    setToken(token: string | null, userData?: any) {
        if (token) {
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(TOKEN_KEY, token);
            }
            this.token.set(token);
            this.setSession(true);

            if (userData) {
                this.setUserFromResponse(userData);
            } else {
                this.loadUserProfile();
            }
            return;
        }

        this.clearSession();
    }

    setSession(value: boolean) {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(SESSION_KEY, value ? '1' : '0');
        }
        this.session.set(value);
    }

    clearSession() {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.setItem(SESSION_KEY, '0');
        }
        this.token.set(null);
        this.user.set(null);
        this.session.set(false);
    }

    logout() {
        return this.api.logout().pipe(
            tap(() => this.clearSession())
        );
    }

    getToken() {
        return this.token();
    }

    setUserFromResponse(response: any) {
        const userData = response?.user || response;

        if (userData) {
            let email = userData.email;
            const token = userData.token || this.token();

            if (!email && token) {
                const decoded = this.decodeToken(token);
                email = decoded?.email;
            }

            const user: User = {
                id: userData.id || userData.user_id || userData.userId,
                email: email,
                contaId: userData.contaId || userData.conta_id || userData.user_metadata?.contaId || userData.app_metadata?.contaId
            };

            this.setUser(user);

            if (!user.contaId) {
                this.autoInitializeAccount(user);
            }
        }
    }

    private decodeToken(token: string): any {
        try {
            const payload = token.split('.')[1];
            if (!payload) return null;
            const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(decoded);
        } catch (e) {
            return null;
        }
    }

    private autoInitializeAccount(user: User) {
        if (!user.id || !user.email) {
            return;
        }

        const payload = {
            usuarioId: user.id,
            nome: 'Conta Principal',
            email: user.email,
            tipo: 'Corrente',
            moeda: 'BRL',
            saldoInicial: 0
        };

        this.api.criarConta(payload).subscribe({
            next: (res) => {
                setTimeout(() => this.loadUserProfile(), 1500);
            },
            error: (err) => { }
        });
    }

    loadUserProfile() {
        if (!this.isAuthenticated()) return;

        this.api.getProfile().subscribe({
            next: (profile) => this.setUserFromResponse(profile),
            error: () => this.clearSession()
        });
    }

    private setUser(user: User | null) {
        if (user) {
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(USER_KEY, JSON.stringify(user));
            }
            this.user.set(user);
            return;
        }

        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(USER_KEY);
        }
        this.user.set(null);
    }

    private getStoredToken() {
        if (isPlatformBrowser(this.platformId)) {
            return localStorage.getItem(TOKEN_KEY);
        }
        return null;
    }

    private getStoredSession() {
        if (isPlatformBrowser(this.platformId)) {
            return localStorage.getItem(SESSION_KEY) === '1';
        }
        return false;
    }

    private getStoredUser(): User | null {
        if (isPlatformBrowser(this.platformId)) {
            const stored = localStorage.getItem(USER_KEY);
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch {
                    return null;
                }
            }
        }
        return null;
    }

    extractToken(response: unknown): string | null {
        if (!response || typeof response !== 'object') {
            return null;
        }

        const candidate = response as Record<string, unknown>;
        const possibleKeys = ['token', 'accessToken', 'jwt', 'bearerToken'];

        for (const key of possibleKeys) {
            const value = candidate[key];
            if (typeof value === 'string' && value.length > 0) {
                return value;
            }
        }

        return null;
    }
}
