import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    protected readonly isSubmitting = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly successMessage = signal<string | null>(null);

    readonly form = new FormGroup({
        email: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.email]
        }),
        password: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(6)]
        })
    });

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        this.api.login(this.form.getRawValue()).subscribe({
            next: (response) => {
                this.isSubmitting.set(false);
                const tokenFromBody = this.auth.extractToken(response.body);
                const tokenFromHeader = response.headers.get('Authorization');
                const token = tokenFromBody ?? tokenFromHeader?.replace('Bearer ', '') ?? null;

                if (token) {
                    // Passa os dados do usuário da resposta do login
                    this.auth.setToken(token, response.body);
                } else {
                    this.auth.setSession(true);
                }

                this.successMessage.set('Login realizado. Você já pode acessar o resumo.');
                this.router.navigate(['/']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.errorMessage.set('Não foi possível entrar. Verifique seus dados.');
            }
        });
    }
}
