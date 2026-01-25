import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, Categoria } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize } from 'rxjs';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';
import { CategoryIconComponent } from '../../shared/components/category-icon/category-icon.component';

interface CriarOrcamentoPayload {
    contaId: number;
    mes: number;
    ano: number;
    categoriaId: number;
    limite: number;
}

interface AtualizarOrcamentoPayload {
    contaId: number;
    mes: number;
    ano: number;
    categoriaId: number;
    limite: number;
}

interface OrcamentoDisplay {
    id: number;
    categoriaId: number;
    categoriaNome: string;
    limite: number;
    gasto: number;
    percentual: number;
    restante: number;
    colorClass: string;
}

@Component({
    selector: 'app-orcamentos',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, CategoryIconComponent],
    templateUrl: './orcamentos.component.html',
    styleUrls: ['./orcamentos.component.css'],
    animations: [
        trigger('staggerList', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateY(10px)' }),
                    stagger(50, [
                        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
                    ])
                ], { optional: true })
            ])
        ]),
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('200ms ease-in', style({ opacity: 1 }))
            ])
        ])
    ]
})
export class OrcamentosComponent implements OnInit {
    private fb = inject(FormBuilder);
    private api = inject(ApiService);
    private auth = inject(AuthService);

    // Filters (Global)
    mes = signal(new Date().getMonth() + 1);
    ano = signal(new Date().getFullYear());

    // State
    orcamentos = signal<OrcamentoDisplay[]>([]);
    categorias = signal<Categoria[]>([]);
    isLoading = signal(true);
    isSubmitting = signal(false);
    errorMessage = signal<string | null>(null);

    // Modal State
    isModalOpen = signal(false);
    editingId = signal<number | null>(null);

    // Form
    form = this.fb.group({
        limite: [0, [Validators.required, Validators.min(1)]],
        categoriaId: [null as number | null, [Validators.required]]
    });

    // Helpers
    progressColor(percent: number) {
        if (percent > 100) return 'bg-red-500';
        if (percent > 80) return 'bg-amber-500';
        return 'bg-emerald-500';
    }



    ngOnInit() {
        this.api.getCategorias().subscribe(cats => this.categorias.set(cats || []));
        this.loadData();
    }

    // Accept any to handle number/string conversion from template
    onChangePeriodo(mes: any, ano: any) {
        this.mes.set(Number(mes));
        this.ano.set(Number(ano));
        this.loadData();
    }

    loadData() {
        this.isLoading.set(true);
        const contaId = this.auth.currentUser()?.contaId || 1;
        const mes = this.mes();
        const ano = this.ano();

        this.api.getOrcamentosAnalises({ contaId, mes, ano, meses: 1 })
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (response: any) => {
                    const list = response?.orcamentosUsoPercentual;
                    if (Array.isArray(list)) {
                        this.orcamentos.set(list.map((item: any) => this.normalize(item)));
                    } else {
                        this.orcamentos.set([]);
                    }
                },
                error: () => this.errorMessage.set('Falha ao carregar orçamentos.')
            });
    }

    normalize(item: any): OrcamentoDisplay {
        const p = Math.round((item.percentualUso ?? 0) * 100);
        const gasto = item.gasto ?? 0;
        const limite = item.limite ?? 0;

        return {
            id: item.orcamentoId,
            categoriaId: item.categoriaId,
            categoriaNome: item.categoriaNome ?? 'Categoria',
            limite,
            gasto,
            percentual: p,
            restante: Math.max(0, limite - gasto),
            colorClass: this.progressColor(p)
        };
    }

    // --- Actions ---

    openCreate() {
        this.editingId.set(null);
        this.form.reset({ limite: 0, categoriaId: null });
        this.isModalOpen.set(true);
    }

    openEdit(item: OrcamentoDisplay) {
        this.editingId.set(item.id);
        this.form.patchValue({
            limite: item.limite,
            categoriaId: item.categoriaId
        });
        this.isModalOpen.set(true);
    }

    closeModal() {
        this.isModalOpen.set(false);
        this.editingId.set(null);
    }

    save() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const contaId = this.auth.currentUser()?.contaId || 1;
        const val = this.form.getRawValue();
        const id = this.editingId();

        this.isSubmitting.set(true);

        if (id) {
            const payload: AtualizarOrcamentoPayload = {
                contaId,
                mes: this.mes(),
                ano: this.ano(),
                categoriaId: Number(val.categoriaId),
                limite: Number(val.limite)
            };
            this.api.atualizarOrcamento(id, payload).subscribe({
                next: () => {
                    this.loadData();
                    this.closeModal();
                    this.isSubmitting.set(false);
                },
                error: () => this.isSubmitting.set(false)
            });
        } else {
            const payload: CriarOrcamentoPayload = {
                contaId,
                mes: this.mes(),
                ano: this.ano(),
                categoriaId: Number(val.categoriaId),
                limite: Number(val.limite)
            };
            this.api.criarOrcamento(payload).subscribe({
                next: () => {
                    this.loadData();
                    this.closeModal();
                    this.isSubmitting.set(false);
                },
                error: () => this.isSubmitting.set(false)
            });
        }
    }

    delete(item: OrcamentoDisplay) {
        if (confirm(`Excluir orçamento de ${item.categoriaNome}?`)) {
            this.api.deletarOrcamento(item.id).subscribe(() => this.loadData());
        }
    }

    formatMoeda(val: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }
}
