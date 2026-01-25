import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
    const auth = inject(AuthService);
    const token = auth.getToken();

    const isPublicAuth = request.url.includes('/api/auth/entrar') || request.url.includes('/api/auth/cadastrar');

    if (!token || isPublicAuth) {
        return next(request);
    }

    return next(
        request.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        })
    );
};
