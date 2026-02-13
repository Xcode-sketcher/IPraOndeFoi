import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, Categoria } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

// Interfaces
interface CriarRecorrenciaPayload {
    contaId: number;
    tipo: number;
    valor: number;
    moeda: string;
    categoriaId: number | null;
    descricao: string;
    frequencia: string;
    intervaloQuantidade: number;
    intervaloUnidade: number;
    dataInicio: string;
    diaDoMes: number | null;
    proximaExecucao: string | null;
    ativa: boolean;
}

interface CriarAssinaturaPayload {
    contaId: number;
    nome: string;
    valor: number;
    moeda: string;
    categoriaId: number | null;
    frequencia: string;
    intervaloQuantidade: number;
    intervaloUnidade: number;
    dataInicio: string;
    proximaCobranca: string | null;
    ativa: boolean;
}

interface Recorrencia {
    id: number;
    tipo: number;
    valor: number;
    descricao: string;
    frequencia: string;
    dataInicio: string;
    proximaExecucao: string | null;
}

interface Assinatura {
    id: number;
    nome: string;
    valor: number;
    frequencia: string;
    dataInicio: string;
    proximaCobranca: string | null;
}

@Component({
    selector: 'app-recorrencias',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './recorrencias.component.html',
    styleUrls: ['./recorrencias.component.css'],
    animations: [
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(10px)' }),
                animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
            ])
        ])
    ]
})
export class RecorrenciasComponent implements OnInit {
    private fb = inject(FormBuilder);
    private api = inject(ApiService);
    private auth = inject(AuthService);

    // State
    activeTab = signal<'recorrencia' | 'assinatura'>('recorrencia');
    categorias = signal<Categoria[]>([]);
    isSubmitting = signal(false);
    successMessage = signal<string | null>(null);
    errorMessage = signal<string | null>(null);

    // Lists
    recorrencias = signal<Recorrencia[]>([]);
    assinaturas = signal<Assinatura[]>([]);
    isLoadingRecorrencias = signal(false);
    isLoadingAssinaturas = signal(false);
    isDeletingRecorrencia = signal(false);
    isDeletingAssinatura = signal(false);

    // Form visibility
    showRecorrenciaForm = signal(false);
    showAssinaturaForm = signal(false);

    // Calendar State
    calendarMonth = signal(new Date().getMonth());
    calendarYear = signal(new Date().getFullYear());

    calendarDays = computed(() => {
        const year = this.calendarYear();
        const month = this.calendarMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        const emptySlots = Array(firstDayOfWeek).fill(null);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        return { emptySlots, days, daysInMonth, firstDayOfWeek };
    });

    calendarMonthName = computed(() => {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return months[this.calendarMonth()];
    });

    today = new Date();
    isToday(day: number): boolean {
        return day === this.today.getDate() &&
            this.calendarMonth() === this.today.getMonth() &&
            this.calendarYear() === this.today.getFullYear();
    }

    prevMonth() {
        if (this.calendarMonth() === 0) {
            this.calendarMonth.set(11);
            this.calendarYear.update(y => y - 1);
        } else {
            this.calendarMonth.update(m => m - 1);
        }
    }

    nextMonth() {
        if (this.calendarMonth() === 11) {
            this.calendarMonth.set(0);
            this.calendarYear.update(y => y + 1);
        } else {
            this.calendarMonth.update(m => m + 1);
        }
    }

    // Forms
    recorrenciaForm = this.fb.group({
        tipo: ['saida', [Validators.required]],
        valor: [0, [Validators.required, Validators.min(0.01)]],
        categoriaId: [null as number | null],
        descricao: ['', [Validators.required, Validators.minLength(3)]],
        frequencia: ['Mensal', [Validators.required]],
        dataInicio: [new Date().toISOString().split('T')[0], [Validators.required]]
    });

    assinaturaForm = this.fb.group({
        nome: ['', [Validators.required, Validators.minLength(2)]],
        valor: [0, [Validators.required, Validators.min(0.01)]],
        categoriaId: [null as number | null],
        frequencia: ['Mensal', [Validators.required]],
        dataInicio: [new Date().toISOString().split('T')[0], [Validators.required]]
    });

    ngOnInit() {
        this.api.getCategorias().subscribe(cats => this.categorias.set(cats || []));
        this.carregarRecorrencias();
        this.carregarAssinaturas();
    }

    setTab(tab: 'recorrencia' | 'assinatura') {
        this.activeTab.set(tab);
        this.successMessage.set(null);
        this.errorMessage.set(null);
    }

    carregarRecorrencias() {
        const contaId = this.auth.currentUser()?.contaId;
        if (!contaId) return;

        this.isLoadingRecorrencias.set(true);
        this.api.listarRecorrencias(contaId)
            .pipe(finalize(() => this.isLoadingRecorrencias.set(false)))
            .subscribe({
                next: (res: any) => this.recorrencias.set(res || []),
                error: () => this.recorrencias.set([])
            });
    }

    carregarAssinaturas() {
        const contaId = this.auth.currentUser()?.contaId;
        if (!contaId) return;

        this.isLoadingAssinaturas.set(true);
        this.api.listarAssinaturas(contaId)
            .pipe(finalize(() => this.isLoadingAssinaturas.set(false)))
            .subscribe({
                next: (res: any) => this.assinaturas.set(res || []),
                error: () => this.assinaturas.set([])
            });
    }

    deletarRecorrencia(id: number) {
        if (!confirm('Tem certeza que deseja excluir esta recorrência?')) return;

        this.isDeletingRecorrencia.set(true);
        this.api.deletarRecorrencia(id)
            .pipe(finalize(() => this.isDeletingRecorrencia.set(false)))
            .subscribe({
                next: () => {
                    this.successMessage.set('Recorrência excluída com sucesso!');
                    this.carregarRecorrencias();
                },
                error: () => this.errorMessage.set('Erro ao excluir recorrência.')
            });
    }

    deletarAssinatura(id: number) {
        if (!confirm('Tem certeza que deseja excluir esta assinatura?')) return;

        this.isDeletingAssinatura.set(true);
        this.api.deletarAssinatura(id)
            .pipe(finalize(() => this.isDeletingAssinatura.set(false)))
            .subscribe({
                next: () => {
                    this.successMessage.set('Assinatura excluída com sucesso!');
                    this.carregarAssinaturas();
                },
                error: () => this.errorMessage.set('Erro ao excluir assinatura.')
            });
    }

    formatMoeda(valor: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    }

    formatDate(dateStr: string | null): string {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return '-';
        }
    }

    submitRecorrencia() {
        if (this.recorrenciaForm.invalid) {
            this.recorrenciaForm.markAllAsTouched();
            return;
        }

        const contaId = this.auth.currentUser()?.contaId || 1;
        const val = this.recorrenciaForm.value;

        const payload: CriarRecorrenciaPayload = {
            contaId,
            tipo: val.tipo === 'entrada' ? 1 : 2,
            valor: Number(val.valor),
            moeda: 'BRL',
            categoriaId: val.categoriaId ? Number(val.categoriaId) : null,
            descricao: val.descricao!,
            frequencia: val.frequencia!,
            intervaloQuantidade: 1,
            intervaloUnidade: 1,
            dataInicio: `${val.dataInicio}T00:00:00Z`,
            diaDoMes: null,
            proximaExecucao: null,
            ativa: true
        };

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        this.api.criarRecorrencia(payload)
            .pipe(finalize(() => this.isSubmitting.set(false)))
            .subscribe({
                next: () => {
                    this.successMessage.set('Recorrência agendada com sucesso!');
                    this.showRecorrenciaForm.set(false);
                    this.recorrenciaForm.reset({
                        tipo: 'saida', valor: 0, categoriaId: null, descricao: '',
                        frequencia: 'Mensal', dataInicio: new Date().toISOString().split('T')[0]
                    });
                    this.carregarRecorrencias();
                },
                error: () => this.errorMessage.set('Erro ao criar recorrência.')
            });
    }

    submitAssinatura() {
        if (this.assinaturaForm.invalid) {
            this.assinaturaForm.markAllAsTouched();
            return;
        }

        const contaId = this.auth.currentUser()?.contaId || 1;
        const val = this.assinaturaForm.value;

        const payload: CriarAssinaturaPayload = {
            contaId,
            nome: val.nome!,
            valor: Number(val.valor),
            moeda: 'BRL',
            categoriaId: val.categoriaId ? Number(val.categoriaId) : null,
            frequencia: val.frequencia!,
            intervaloQuantidade: 1,
            intervaloUnidade: 2,
            dataInicio: `${val.dataInicio}T00:00:00Z`,
            proximaCobranca: null,
            ativa: true
        };

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        this.api.criarAssinatura(payload)
            .pipe(finalize(() => this.isSubmitting.set(false)))
            .subscribe({
                next: () => {
                    this.successMessage.set('Assinatura adicionada com sucesso!');
                    this.showAssinaturaForm.set(false);
                    this.assinaturaForm.reset({
                        nome: '', valor: 0, categoriaId: null,
                        frequencia: 'Mensal', dataInicio: new Date().toISOString().split('T')[0]
                    });
                    this.carregarAssinaturas();
                },
                error: () => this.errorMessage.set('Erro ao criar assinatura.')
            });
    }
}
