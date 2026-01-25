import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-importacao',
    templateUrl: './importacao.component.html',
    styleUrl: './importacao.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportacaoComponent {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);

    protected readonly arquivo = signal<File | null>(null);
    protected readonly isUploading = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly successMessage = signal<string | null>(null);

    onFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files && input.files.length ? input.files[0] : null;
        this.arquivo.set(file);
    }

    enviar() {
        const file = this.arquivo();
        if (!file) {
            this.errorMessage.set('Selecione um arquivo CSV para importar.');
            return;
        }

        const contaId = this.getContaId();
        this.isUploading.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        this.api
            .importar(contaId, file)
            .pipe(finalize(() => this.isUploading.set(false)))
            .subscribe({
                next: () => {
                    this.successMessage.set('Importação concluída com sucesso!');
                    this.arquivo.set(null);
                },
                error: () => {
                    this.errorMessage.set('Não foi possível importar o arquivo.');
                }
            });
    }

    private getContaId() {
        const user = this.auth.currentUser();
        return user?.contaId || 1;
    }
}
