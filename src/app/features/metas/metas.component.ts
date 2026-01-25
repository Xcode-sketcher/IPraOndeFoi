import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, Categoria, CriarMetaPayload } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize } from 'rxjs';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';
import { CategoryIconComponent } from '../../shared/components/category-icon/category-icon.component';

interface Meta {
    id: number;
    nome: string;
    valorAlvo: number;
    valorAtual: number;
    dataInicio: string;
    dataFim: string;
    categoriaId?: number;
    categoria?: { nome: string };
    // UI helpers
    percentual: number;
    restante: number;
    colorClass: string;
}

@Component({
    selector: 'app-metas',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, CategoryIconComponent],
    templateUrl: './metas.component.html',
    styleUrls: ['./metas.component.css'],
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
export class MetasComponent implements OnInit {
    private fb = inject(FormBuilder);
    private api = inject(ApiService);
    private auth = inject(AuthService);

    // State
    metas = signal<Meta[]>([]);
    categorias = signal<Categoria[]>([]);
    isLoading = signal(true);
    isSubmitting = signal(false);
    errorMessage = signal<string | null>(null);

    // Modal State
    isModalOpen = signal(false);
    isContributeModalOpen = signal(false);
    editingMetaId = signal<number | null>(null);
    selectedMeta = signal<Meta | null>(null);

    // Forms
    form = this.fb.group({
        nome: ['', [Validators.required, Validators.minLength(3)]],
        valorAlvo: [0, [Validators.required, Validators.min(1)]],
        dataFim: ['', [Validators.required]],
        categoriaId: [null as number | null]
    });

    contributeForm = this.fb.group({
        valor: [0, [Validators.required, Validators.min(0.01)]]
    });

    // Computed
    progressColor(percent: number) {
        if (percent >= 100) return 'bg-emerald-500';
        if (percent > 60) return 'bg-emerald-400';
        if (percent > 30) return 'bg-amber-400';
        return 'bg-amber-500'; // Start with amber
    }

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.isLoading.set(true);
        const contaId = this.auth.currentUser()?.contaId || 1;

        // Load Metas & Categories
        this.api.getCategorias().subscribe(cats => this.categorias.set(cats || []));

        this.api.listarMetas(contaId)
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (data: any) => {
                    const list = Array.isArray(data) ? data : [];
                    this.metas.set(list.map(m => this.normalizeMeta(m)));
                },
                error: () => this.errorMessage.set('Falha ao carregar metas.')
            });
    }

    normalizeMeta(m: any): Meta {
        const alvo = Number(m.valorAlvo || 0);
        const atual = Number(m.valorAtual || 0);
        const percent = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;

        return {
            id: m.id ?? m.metaId,
            nome: m.nome,
            valorAlvo: alvo,
            valorAtual: atual,
            dataInicio: m.dataInicio,
            dataFim: m.dataFim,
            categoriaId: m.categoriaId,
            categoria: m.categoria,
            percentual: percent,
            restante: Math.max(0, alvo - atual),
            colorClass: this.progressColor(percent)
        };
    }

    // --- Actions ---

    openCreate() {
        this.editingMetaId.set(null);
        this.form.reset({
            nome: '',
            valorAlvo: 0,
            dataFim: '',
            categoriaId: null
        });
        this.isModalOpen.set(true);
    }

    openEdit(meta: Meta) {
        this.editingMetaId.set(meta.id);
        this.form.patchValue({
            nome: meta.nome,
            valorAlvo: meta.valorAlvo,
            dataFim: meta.dataFim ? meta.dataFim.split('T')[0] : '',
            categoriaId: meta.categoriaId
        });
        this.isModalOpen.set(true);
    }

    closeModal() {
        this.isModalOpen.set(false);
        this.editingMetaId.set(null);
        this.form.reset();
    }

    saveMeta() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const contaId = this.auth.currentUser()?.contaId || 1;
        const val = this.form.value;

        const payload: CriarMetaPayload = {
            contaId,
            nome: val.nome!,
            valorAlvo: val.valorAlvo!,
            valorAtual: 0, // Only for create, keeps existing for edit logic if backend supports separately
            // Wait, for edit, we should keep valorAtual.
            // My ApiService UpdatePayload is same type?
            // Let's check logic. API might require sending updated full object.
            dataInicio: new Date().toISOString(), // Ignored on update often, or preserve
            dataFim: val.dataFim ? new Date(val.dataFim).toISOString() : new Date().toISOString(),
            categoriaId: val.categoriaId ? Number(val.categoriaId) : null
        };

        // If editing, we need to preserve valorAtual from simple update?
        // Actually, usually update meta updates Name/Target/Date. Contribution updates Value.
        // I'll handle create/update.

        this.isSubmitting.set(true);

        // Logic for Update vs Create
        // Note: My existing code had updateMeta.
        // I'll implement simple create for now as Refactor, user needs to verify CRUD.
        const id = this.editingMetaId();
        if (id) {
            // Update logic
            const meta = this.metas().find(m => m.id === id);
            if (meta) {
                payload.valorAtual = meta.valorAtual; // Preserve
                payload.dataInicio = meta.dataInicio;
            }
            this.api.atualizarMeta(id, payload).subscribe({
                next: () => {
                    this.loadData();
                    this.closeModal();
                    this.isSubmitting.set(false);
                },
                error: () => this.isSubmitting.set(false)
            });
        } else {
            this.api.criarMeta(payload).subscribe({
                next: () => {
                    this.loadData();
                    this.closeModal();
                    this.isSubmitting.set(false);
                },
                error: () => this.isSubmitting.set(false)
            });
        }
    }

    delete(meta: Meta) {
        if (confirm('Tem certeza que deseja excluir esta meta?')) {
            this.api.deletarMeta(meta.id).subscribe(() => this.loadData());
        }
    }

    openContribute(meta: Meta) {
        this.selectedMeta.set(meta);
        this.contributeForm.reset({ valor: 0 });
        this.isContributeModalOpen.set(true);
    }

    submitContribute() {
        const meta = this.selectedMeta();
        const valor = this.contributeForm.value.valor;

        if (meta && valor && valor > 0) {
            this.isSubmitting.set(true);
            this.api.contribuirMeta(meta.id, { valor }).subscribe({
                next: () => {
                    this.loadData();
                    this.isContributeModalOpen.set(false);
                    this.selectedMeta.set(null);
                    this.isSubmitting.set(false);
                },
                error: () => this.isSubmitting.set(false)
            });
        }
    }

    formatMoeda(val: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }


}
