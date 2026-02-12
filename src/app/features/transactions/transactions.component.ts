import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, Categoria, Tag, TransacaoQuery } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize, debounceTime, distinctUntilChanged, forkJoin, of, switchMap } from 'rxjs';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';
import { toObservable } from '@angular/core/rxjs-interop';
import { CategoryIconComponent } from '../../shared/components/category-icon/category-icon.component';

@Component({
    selector: 'app-transactions',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, CategoryIconComponent],
    templateUrl: './transactions.component.html',
    styleUrls: ['./transactions.component.css'],
    animations: [
        trigger('staggerList', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateY(10px)' }),
                    stagger(30, [
                        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
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
export class TransactionsComponent implements OnInit {
    private fb = inject(FormBuilder);
    public api = inject(ApiService);
    private auth = inject(AuthService);

    // Filters
    filterForm = this.fb.group({
        search: [''],
        tipo: [''],
        categoriaId: [null],
        dataInicio: [''],
        dataFim: ['']
    });

    // State
    transacoes = signal<any[]>([]);
    categorias = signal<Categoria[]>([]);
    availableTags = signal<Tag[]>([]);
    isLoading = signal(false);

    // Pagination
    currentPage = signal(1);
    pageSize = signal(10);
    totalItems = signal(0);
    totalPages = signal(0);

    // Modal State
    isModalOpen = signal(false);
    editingId = signal<number | null>(null);
    isSubmitting = signal(false);

    // Delete Modal
    isDeleteModalOpen = signal(false);
    deletingTransaction = signal<any>(null);
    isDeleting = signal(false);

    // CRUD Form
    form = this.fb.group({
        descricao: ['', [Validators.required, Validators.minLength(3)]],
        valor: [0, [Validators.required, Validators.min(0.01)]],
        tipo: [2, [Validators.required]],
        categoriaId: [null as number | null, [Validators.required]],
        dataTransacao: [new Date().toISOString().split('T')[0], [Validators.required]]
    });

    // Selected Tags for current form
    selectedTagIds = signal<number[]>([]);

    constructor() {
        toObservable(this.currentPage).subscribe(() => this.loadData());

        this.filterForm.valueChanges.pipe(
            debounceTime(500),
            distinctUntilChanged()
        ).subscribe(() => {
            this.currentPage.set(1);
            this.loadData();
        });
    }

    ngOnInit() {
        this.api.getCategorias().subscribe(cats => this.categorias.set(cats || []));

        const u = this.auth.currentUser();
        if (u?.contaId) {
            this.api.getTags(u.contaId).subscribe(tags => this.availableTags.set(tags || []));
        }

        this.loadData();
    }

    loadData() {
        this.isLoading.set(true);
        const contaId = this.auth.currentUser()?.contaId || 1;
        const filters = this.filterForm.value;

        const query: TransacaoQuery = {
            contaId,
            page: this.currentPage(),
            pageSize: this.pageSize(),
            tipo: filters.tipo ? Number(filters.tipo) : undefined,
            categoriaId: filters.categoriaId ? Number(filters.categoriaId) : undefined,
            inicio: filters.dataInicio || undefined,
            fim: filters.dataFim || undefined,
            descricao: filters.search || undefined // Search by name
        };

        this.api.getTransacoes(query)
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (response: any) => {
                    const list = this.extractTransacoes(response);
                    const meta = response?.pagination ?? response?.Pagination ?? {};

                    this.transacoes.set(list.map((t: any) => this.normalize(t)));

                    const totalItems = meta.totalItems ?? meta.TotalItems;
                    const totalPages = meta.totalPages ?? meta.TotalPages;

                    if (typeof totalItems === 'number') this.totalItems.set(totalItems);
                    if (typeof totalPages === 'number') this.totalPages.set(totalPages);
                },
                error: () => { }
            });
    }

    private extractTransacoes(response: any): any[] {
        if (Array.isArray(response)) return response;
        const data = response?.data ?? response?.Data ?? response?.items ?? response?.Items;
        return Array.isArray(data) ? data : [];
    }

    normalize(t: any) {
        const tipoRaw = String(t.tipo ?? t.Tipo ?? '').toLowerCase();
        const isEntrada = tipoRaw === '1' || tipoRaw === 'entrada' || tipoRaw === 'receita';

        const tagsRaw = t.tags ?? t.Tags ?? [];
        const tags = Array.isArray(tagsRaw)
            ? tagsRaw.map((tag: any) => ({ nome: tag?.nome ?? tag?.Nome ?? String(tag) }))
            : [];

        return {
            id: t.id ?? t.Id ?? t.transacaoId,
            descricao: t.descricao ?? t.Descricao ?? t.description ?? t.Description,
            valor: Number(t.valor ?? t.Valor ?? t.value ?? 0),
            tipo: isEntrada ? 'entrada' : 'saida',
            data: t.dataTransacao ?? t.DataTransacao ?? t.data ?? t.Data,
            categoriaNome: t.categoriaNome ?? t.CategoriaNome ?? t.categoria?.nome ?? t.Categoria?.Nome ?? 'Outros',
            tags
        };
    }

    toggleTagSelection(tagId: number) {
        this.selectedTagIds.update(ids => {
            if (ids.includes(tagId)) return ids.filter(id => id !== tagId);
            return [...ids, tagId];
        });
    }

    // --- CRUD ---

    openCreate() {
        this.editingId.set(null);
        this.selectedTagIds.set([]);
        this.form.reset({
            descricao: '',
            valor: 0,
            tipo: 2,
            categoriaId: null,
            dataTransacao: new Date().toISOString().split('T')[0]
        });
        this.refreshTags();
        this.isModalOpen.set(true);
    }

    refreshTags() {
        const u = this.auth.currentUser();
        if (u?.contaId) {
            this.api.getTags(u.contaId).subscribe(tags => this.availableTags.set(tags || []));
        }
    }

    openEdit(t: any) {
        this.editingId.set(t.id);
        this.selectedTagIds.set([]);
        if (t.tags && Array.isArray(t.tags)) {
            const ids = t.tags.map((tag: any) => tag.id).filter((id: any) => !!id);
            this.selectedTagIds.set(ids);
        }

        this.form.patchValue({
            descricao: t.descricao,
            valor: t.valor,
            tipo: t.tipo === 'entrada' ? 1 : 2,
            categoriaId: this.findCatId(t.categoriaNome),
            dataTransacao: t.data.split('T')[0]
        });
        this.refreshTags();
        this.isModalOpen.set(true);
    }

    findCatId(name: string) {
        const cat = this.categorias().find(c => c.nome === name);
        return cat ? cat.id : null;
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
        const val = this.form.value;
        const id = this.editingId();

        const payload = {
            contaId,
            descricao: val.descricao!,
            valor: Number(val.valor),
            tipo: Number(val.tipo),
            categoriaId: Number(val.categoriaId),
            dataTransacao: new Date(val.dataTransacao!).toISOString(),
            moeda: 'BRL'
        };

        this.isSubmitting.set(true);

        const save$ = id
            ? this.api.atualizarTransacao(id, payload)
            : this.api.criarTransacao(payload);

        save$.pipe(
            switchMap((res: any) => {
                const transacaoId = id ? id : (res?.id ?? res?.transacaoId);

                if (!transacaoId) return of(res);

                const tagIds = this.selectedTagIds();
                if (tagIds.length === 0) return of(res);

                const bindings = tagIds.map(tagId =>
                    this.api.vincularTag({ transacaoId, tagId })
                );
                return forkJoin(bindings);
            }),
            finalize(() => this.isSubmitting.set(false))
        ).subscribe({
            next: (bindResult) => {
                this.loadData();
                this.closeModal();
            },
            error: (err) => {
                this.loadData();
                this.closeModal();
            }
        });
    }

    // --- Delete with Modal ---
    openDeleteModal(t: any) {
        this.deletingTransaction.set(t);
        this.isDeleteModalOpen.set(true);
    }

    closeDeleteModal() {
        this.isDeleteModalOpen.set(false);
        this.deletingTransaction.set(null);
    }

    confirmDelete() {
        const t = this.deletingTransaction();
        if (!t) return;

        this.isDeleting.set(true);
        this.api.deletarTransacao(t.id)
            .pipe(finalize(() => this.isDeleting.set(false)))
            .subscribe({
                next: () => {
                    this.loadData();
                    this.closeDeleteModal();
                },
                error: () => {
                    this.closeDeleteModal();
                }
            });
    }

    // --- Pagination ---
    nextPage() {
        if (this.currentPage() < this.totalPages()) {
            this.currentPage.update(p => p + 1);
        }
    }

    prevPage() {
        if (this.currentPage() > 1) {
            this.currentPage.update(p => p - 1);
        }
    }

    // --- Helpers ---
    formatMoeda(val: number) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }
}
