import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { CategoryIconComponent } from '../../shared/components/category-icon/category-icon.component';

// --- Interfaces ---

interface ResumoMensalResponse {
    contaId: number;
    mes: number;
    ano: number;
    totalEntradas: number;
    totalSaidas: number;
    saldoMes: number;
}

interface OrcamentoItemResponse {
    orcamentoId: number;
    categoriaId: number;
    categoriaNome: string;
    limite: number;
    gasto: number;
    percentualUso: number;
}

interface DistribuicaoPizzaItem {
    categoriaId: number;
    categoriaNome: string;
    total: number;
    percentual: number;
}

interface OrcamentoAnaliseResponse {
    media: {
        mediaLimite: number;
        mediaGasto: number;
        mediaUsoPercentual: number;
    };
    orcamentosUsoPercentual: OrcamentoItemResponse[];
    distribuicaoPizza: {
        totalGastos: number;
        itens: DistribuicaoPizzaItem[];
    };
}

interface Transacao {
    id: number;
    descricao: string;
    valor: number;
    tipo: 'entrada' | 'saida';
    data: string;
    tags?: string[];
    categoriaNome: string; // Required for icon display
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, CategoryIconComponent],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    animations: [
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(10px)' }),
                animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
            ])
        ]),
        trigger('staggerList', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateX(-10px)' }),
                    stagger(50, [
                        animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
                    ])
                ], { optional: true })
            ])
        ])
    ]
})
export class DashboardComponent implements OnInit {
    private api = inject(ApiService);
    private auth = inject(AuthService);
    private router = inject(Router);

    // --- State Signals ---
    mes = signal(new Date().getMonth() + 1);
    ano = signal(new Date().getFullYear());
    isLoading = signal(true);
    errorMessage = signal<string | null>(null);

    // Raw Data Signals
    resumoData = signal<ResumoMensalResponse | null>(null);
    analiseData = signal<OrcamentoAnaliseResponse | null>(null);
    saldoAtualData = signal<number>(0);
    transacoes = signal<Transacao[]>([]);

    // --- Computed Mappings ---

    saldoAtual = computed(() => this.saldoAtualData());
    totalEntradas = computed(() => this.resumoData()?.totalEntradas ?? 0);
    totalSaidas = computed(() => this.resumoData()?.totalSaidas ?? 0);

    // Budget Overview
    orcamentoGlobal = computed(() => {
        const data = this.analiseData();
        if (!data?.orcamentosUsoPercentual?.length) {
            return { percentual: 0, label: 'Sem orçamento', gasto: 0, limite: 0, colorClass: 'bg-gray-200' };
        }

        // Calculate totals from list
        const totalLimite = data.orcamentosUsoPercentual.reduce((acc, item) => acc + item.limite, 0);
        const totalGasto = data.orcamentosUsoPercentual.reduce((acc, item) => acc + item.gasto, 0);

        // Percent
        const percent = totalLimite > 0 ? Math.round((totalGasto / totalLimite) * 100) : 0;

        let colorClass = 'bg-emerald-500';
        if (percent > 80) colorClass = 'bg-amber-500';
        if (percent >= 100) colorClass = 'bg-red-500';

        return {
            percentual: Math.min(100, Math.max(0, percent)),
            label: `${this.formatMoeda(totalGasto)} de ${this.formatMoeda(totalLimite)}`,
            gasto: totalGasto,
            limite: totalLimite,
            colorClass
        };
    });

    // Category Breakdown
    categoriasOrcamento = computed(() => {
        const list = this.analiseData()?.orcamentosUsoPercentual;
        if (!list) return [];

        return list.map(item => ({
            label: item.categoriaNome,
            gasto: item.gasto,
            limite: item.limite,
            percent: Math.round((item.percentualUso ?? 0) * 100)
        })).sort((a, b) => b.percent - a.percent);
    });

    // Pie Chart Data (Actual Expenses)
    pieData = computed(() => {
        const pizza = this.analiseData()?.distribuicaoPizza;
        if (!pizza?.itens?.length) return [];

        const total = pizza.totalGastos;
        if (!total) return [];

        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

        let currentAngle = 0;
        return pizza.itens.map((item, i) => {
            const percent = Math.round((item.percentual ?? 0));
            const color = colors[i % colors.length];
            const slice = {
                label: item.categoriaNome,
                value: item.total,
                percent,
                color,
                start: currentAngle,
                end: currentAngle + percent
            };
            currentAngle += percent;
            return slice;
        });
    });

    pieGradient = computed(() => {
        const data = this.pieData();
        if (!data.length) return 'var(--surface-muted)';
        return `conic-gradient(${data.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`;
    });

    constructor() { }

    ngOnInit() {
        this.refresh();
    }

    refresh() {
        const user = this.auth.currentUser();
        const contaId = user?.contaId || 1;
        const mes = this.mes();
        const ano = this.ano();

        this.isLoading.set(true);
        this.errorMessage.set(null);

        forkJoin({
            resumo: this.api.getResumoMensal({ contaId, mes, ano }).pipe(catchError(() => of(null))),
            analise: this.api.getOrcamentosAnalises({ contaId, mes, ano, meses: 1 }).pipe(catchError(() => of(null))),
            transacoes: this.api.getTransacoes({ contaId, limit: 10, offset: 0 }).pipe(catchError(() => of([]))),
            saldo: this.api.getSaldoAtual(contaId).pipe(catchError(() => of({ saldo: 0 })))
        })
            .pipe(finalize(() => this.isLoading.set(false)))
            .subscribe({
                next: (result) => {
                    this.resumoData.set(this.normalizeResumo(result.resumo));
                    this.analiseData.set(this.normalizeAnalise(result.analise));

                    // Parse saldo
                    const rawSaldo = result.saldo as any;
                    let valSaldo = 0;

                    if (typeof rawSaldo === 'number') {
                        valSaldo = rawSaldo;
                    } else if (rawSaldo) {
                        valSaldo = rawSaldo.saldo ?? rawSaldo.saldoAtual ?? rawSaldo.valor ?? rawSaldo.balance ?? rawSaldo.Saldo ?? 0;
                    }

                    if (valSaldo === 0 && this.resumoData()) {
                        const resumo = this.resumoData()!;
                        valSaldo = (resumo.totalEntradas ?? 0) - (resumo.totalSaidas ?? 0);
                    }

                    this.saldoAtualData.set(Number(valSaldo));

                    const rawTransacoes = result.transacoes as any;
                    const list = Array.isArray(rawTransacoes)
                        ? rawTransacoes
                        : (rawTransacoes?.data || rawTransacoes?.Data || rawTransacoes?.items || rawTransacoes?.Items || []);

                    this.transacoes.set(list.map((t: any) => this.normalizeTransacao(t)));
                },
                error: (err) => {
                    this.errorMessage.set('Erro ao carregar dados do servidor.');
                }
            });
    }

    onChangePeriodo(mes: string, ano: string) {
        this.mes.set(Number(mes));
        this.ano.set(Number(ano));
        this.refresh();
    }

    private normalizeResumo(r: any): ResumoMensalResponse | null {
        if (!r) return null;
        return {
            contaId: r.contaId ?? r.ContaId,
            mes: r.mes ?? r.Mes,
            ano: r.ano ?? r.Ano,
            totalEntradas: Number(r.totalEntradas ?? r.TotalEntradas ?? 0),
            totalSaidas: Number(r.totalSaidas ?? r.TotalSaidas ?? 0),
            saldoMes: Number(r.saldoMes ?? r.SaldoMes ?? 0)
        };
    }

    private normalizeAnalise(a: any): OrcamentoAnaliseResponse | null {
        if (!a) return null;

        const media = a.media ?? a.Media ?? {};
        const orcamentosUsoPercentual = (a.orcamentosUsoPercentual ?? a.OrcamentosUsoPercentual ?? []).map((o: any) => ({
            orcamentoId: o.orcamentoId ?? o.OrcamentoId,
            categoriaId: o.categoriaId ?? o.CategoriaId,
            categoriaNome: o.categoriaNome ?? o.CategoriaNome,
            limite: Number(o.limite ?? o.Limite ?? 0),
            gasto: Number(o.gasto ?? o.Gasto ?? 0),
            percentualUso: Number(o.percentualUso ?? o.PercentualUso ?? 0)
        }));

        const pizza = a.distribuicaoPizza ?? a.DistribuicaoPizza ?? {};
        const pizzaItens = (pizza.itens ?? pizza.Itens ?? []).map((i: any) => ({
            categoriaId: i.categoriaId ?? i.CategoriaId,
            categoriaNome: i.categoriaNome ?? i.CategoriaNome,
            total: Number(i.total ?? i.Total ?? 0),
            percentual: Number(i.percentual ?? i.Percentual ?? 0)
        }));

        return {
            media: {
                mediaLimite: Number(media.mediaLimite ?? media.MediaLimite ?? 0),
                mediaGasto: Number(media.mediaGasto ?? media.MediaGasto ?? 0),
                mediaUsoPercentual: Number(media.mediaUsoPercentual ?? media.MediaUsoPercentual ?? 0)
            },
            orcamentosUsoPercentual,
            distribuicaoPizza: {
                totalGastos: Number(pizza.totalGastos ?? pizza.TotalGastos ?? 0),
                itens: pizzaItens
            }
        };
    }

    private normalizeTransacao(t: any): Transacao {
        const tipoRaw = String(t.tipo ?? t.Tipo ?? '').toLowerCase();
        const isEntrada = tipoRaw === '1' || tipoRaw === 'entrada' || tipoRaw === 'receita';

        return {
            id: t.id ?? t.Id ?? t.transacaoId,
            descricao: t.descricao ?? t.Descricao ?? t.description ?? 'Sem descrição',
            valor: Number(t.valor ?? t.Valor ?? t.value ?? 0),
            tipo: isEntrada ? 'entrada' : 'saida',
            data: t.data ?? t.Data ?? t.dataTransacao ?? t.DataTransacao ?? new Date().toISOString(),
            categoriaNome: t.categoriaNome ?? t.CategoriaNome ?? t.categoria?.nome ?? t.Categoria?.Nome ?? 'Outros',
            tags: Array.isArray(t.tags ?? t.Tags) ? (t.tags ?? t.Tags).map((tag: any) => tag.nome ?? tag.Nome ?? tag) : []
        };
    }

    formatMoeda(val: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }
}
