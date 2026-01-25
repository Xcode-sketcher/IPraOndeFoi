import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
    selector: 'app-register',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './register.component.html',
    styleUrl: './register.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
    private readonly api = inject(ApiService);
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

        this.api.register(this.form.getRawValue()).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.successMessage.set('Conta criada com sucesso. Você já pode entrar.');
                this.router.navigate(['/login']);
            },
            error: () => {
                this.isSubmitting.set(false);
                this.errorMessage.set('Não foi possível criar a conta.');
            }
        });
    }
}
