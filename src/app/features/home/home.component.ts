import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate, query, stagger } from '@angular/animations';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { timeout, catchError, of } from 'rxjs';
import { CategoryIconComponent } from '../../shared/components/category-icon/category-icon.component';

type ResumoMensal = {
    contaId?: number;
    mes?: number;
    ano?: number;
    saldoInicial?: number;
    saldoAtual?: number;
    saldoFinal?: number;
    saldoMes?: number;
    totalEntradas?: number;
    totalSaidas?: number;
    entradas?: number;
    saidas?: number;
    totalReceitas?: number;
    totalDespesas?: number;
    totalRecorrenteEntrada?: number;
    totalRecorrenteSaida?: number;
    totalAssinaturasSaida?: number;
    moeda?: string;
    categorias?: Array<{
        categoriaId?: number;
        nome?: string;
        total?: number;
        valor?: number;
    }>;
    despesasPorCategoria?: Array<{
        categoriaId?: number;
        nome?: string;
        total?: number;
        valor?: number;
    }>;
};

type ResumoCard = {
    label: string;
    value: number;
    tone: 'positive' | 'negative' | 'neutral';
};

type Transacao = {
    id: number;
    valor: number;
    descricao: string;
    tipo: 'entrada' | 'saida';
    categoria?: {
        id: number;
        nome: string;
    };
    tags?: string[];
    data: string;
    createdAt: string;
};

@Component({
    selector: 'app-home',
    imports: [RouterLink, FormsModule, CommonModule, CategoryIconComponent],
    templateUrl: './home.component.html',
    styleUrl: './home.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
        trigger('staggerCards', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateY(20px)' }),
                    stagger(100, [
                        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
                    ])
                ], { optional: true })
            ])
        ]),
        trigger('staggerTransactions', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'translateX(-20px)' }),
                    stagger(50, [
                        animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
                    ])
                ], { optional: true })
            ])
        ])
    ]
})
export class HomeComponent implements OnInit {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private readonly now = new Date();
    private lastSearchFilters: { tipo?: number; categoriaId?: number; inicio?: string; fim?: string } = {};

    protected readonly loading = signal(false);
    protected readonly errorMessage = signal<string | null>(null);
    protected readonly resumoMensal = signal<ResumoMensal | null>(null);
    protected readonly transacoes = signal<Transacao[]>([]);
    protected readonly orcamentoStatus = signal<any | null>(null);
    protected readonly mes = signal(this.now.getMonth() + 1);
    protected readonly ano = signal(this.now.getFullYear());

    protected readonly isSearching = signal(false);
    protected readonly searchError = signal<string | null>(null);
    protected readonly searchResults = signal<Transacao[]>([]);
    protected readonly searchLimit = signal(10);
    protected readonly searchOffset = signal(0);
    protected readonly searchHasNext = signal(false);
    protected readonly aiInsights = signal<string[]>([]);
    protected readonly aiLoading = signal(false);
    protected readonly aiError = signal<string | null>(null);
    protected readonly saldoAtual = signal<number>(0);

    protected readonly resumoDisponivel = computed(() => this.resumoMensal() !== null);
    protected readonly cards = computed(() => this.buildCards(this.resumoMensal()));
    protected readonly transacoesRecentes = computed(() =>
        this.transacoes()
            .sort(
                (a, b) =>
                    this.getTransacaoDate(b).getTime() - this.getTransacaoDate(a).getTime()
            )
            .slice(0, 10)
    );
    protected readonly moeda = computed(() => this.resumoMensal()?.moeda ?? 'BRL');

    ngOnInit() {
        this.buscarResumo();
    }

    buscarResumo() {
        const user = this.auth.currentUser();

        const contaId = user?.contaId || 1;

        const payload = {
            contaId: contaId,
            mes: this.mes(),
            ano: this.ano()
        };

        this.loading.set(true);
        this.errorMessage.set(null);

        // Buscar resumo mensal
        this.api.getResumoMensal(payload).pipe(
            timeout(5000),
            catchError(() => of(null))
        ).subscribe({
            next: (resposta) => {
                this.resumoMensal.set(this.normalizeResumo(resposta));
                this.loading.set(false);
            },
            error: () => {
                this.errorMessage.set('Não foi possível carregar o resumo mensal.');
                this.loading.set(false);
            }
        });

        // Calcular Inicio e Fim do mês selecionado
        const dtInicio = new Date(this.ano(), this.mes() - 1, 1);
        const dtFim = new Date(this.ano(), this.mes(), 0, 23, 59, 59);
        const inicio = dtInicio.toISOString();
        const fim = dtFim.toISOString();

        // Buscar transações recentes do MÊS
        this.api.getTransacoes({ contaId, limit: 10, inicio, fim }).pipe(
            timeout(5000),
            catchError(() => of({ items: [] }))
        ).subscribe({
            next: (resposta) => {
                const parsed = this.parseTransacoesResponse(resposta);
                this.transacoes.set(parsed.items);
            },
            error: () => {
                this.transacoes.set([]);
            }
        });

        // Buscar status do orçamento
        this.api.getOrcamentosStatus(payload).pipe(
            timeout(5000),
            catchError(() => of(null))
        ).subscribe({
            next: (status) => this.orcamentoStatus.set(status),
            error: () => this.orcamentoStatus.set(null)
        });

        // Buscar insights com IA
        this.aiLoading.set(true);
        this.aiError.set(null);
        this.api.getInsights(contaId, 12).pipe(
            timeout(8000), // 8 second timeout
            catchError(() => of([])) // Return empty array on timeout
        ).subscribe({
            next: (insights) => {
                this.aiInsights.set(this.parseInsights(insights));
                this.aiLoading.set(false);
            },
            error: () => {
                this.aiInsights.set([]);
                this.aiError.set('Não foi possível carregar os insights com IA.');
                this.aiLoading.set(false);
            }
        });

        // Buscar saldo atual em tempo real
        this.api.getSaldoAtual(contaId).pipe(
            timeout(5000),
            catchError(() => of({ saldo: 0 }))
        ).subscribe({
            next: (res: any) => {
                // Handle various response shapes
                const saldo = res?.saldo ?? res?.saldoAtual ?? res?.valor ?? 0;
                this.saldoAtual.set(Number(saldo));
            }
        });
    }

    protected formatCurrency(value: number) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: this.moeda()
        }).format(value);
    }

    protected formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }

    protected getTransactionIcon(tipo: string) {
        return tipo === 'entrada' ? '↑' : '↓';
    }

    protected getTransactionColor(tipo: string) {
        return tipo === 'entrada' ? 'text-green-600' : 'text-red-600';
    }

    protected atualizarPeriodo(mes: number, ano: number) {
        this.mes.set(Number(mes));
        this.ano.set(Number(ano));
        this.buscarResumo();
    }

    protected getCurrentSearchFilters() {
        return this.lastSearchFilters;
    }

    protected buscarTransacoes(
        filtros: { tipo?: number; categoriaId?: number; inicio?: string; fim?: string },
        offset = 0
    ) {
        const contaId = this.auth.currentUser()?.contaId || 1;
        this.isSearching.set(true);
        this.searchError.set(null);
        this.lastSearchFilters = filtros;
        const limit = this.searchLimit();
        const normalizedOffset = Math.max(0, offset);
        this.searchOffset.set(normalizedOffset);

        this.api
            .getTransacoes({ contaId, limit, offset: normalizedOffset, ...filtros })
            .subscribe({
                next: (resposta) => {
                    const parsed = this.parseTransacoesResponse(resposta);
                    this.searchResults.set(parsed.items);
                    const hasNext =
                        typeof parsed.total === 'number'
                            ? normalizedOffset + limit < parsed.total
                            : parsed.items.length >= limit;
                    this.searchHasNext.set(hasNext);
                    this.isSearching.set(false);
                },
                error: () => {
                    this.searchResults.set([]);
                    this.searchHasNext.set(false);
                    this.searchError.set('Não foi possível filtrar as transações.');
                    this.isSearching.set(false);
                }
            });
    }

    protected paginaAnteriorBusca() {
        if (this.searchOffset() === 0) {
            return;
        }
        this.buscarTransacoes(this.getCurrentSearchFilters(), this.searchOffset() - this.searchLimit());
    }

    protected proximaPaginaBusca() {
        if (!this.searchHasNext()) {
            return;
        }
        this.buscarTransacoes(this.getCurrentSearchFilters(), this.searchOffset() + this.searchLimit());
    }

    protected alterarLimiteBusca(limit: number) {
        this.searchLimit.set(Number(limit));
        this.buscarTransacoes(this.getCurrentSearchFilters(), 0);
    }

    protected getPaginaAtualBusca() {
        return Math.floor(this.searchOffset() / this.searchLimit()) + 1;
    }

    protected getOrcamentoPercent() {
        const status = this.orcamentoStatus();
        const value =
            status?.percentualUtilizado ?? status?.percentual ?? status?.percentualUso ?? null;
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.min(100, Math.max(0, Math.round(value)));
        }
        return 0;
    }

    protected getOrcamentoLabel() {
        const status = this.orcamentoStatus();
        if (!status) {
            return 'Nenhum orçamento encontrado';
        }
        const limite = status?.limiteTotal ?? status?.limite ?? null;
        const gasto = status?.gastoTotal ?? status?.gasto ?? null;
        if (typeof limite === 'number' && typeof gasto === 'number') {
            return `${this.formatCurrency(gasto)} de ${this.formatCurrency(limite)}`;
        }
        return 'Sem detalhes de orçamento';
    }

    private buildCards(resumo: ResumoMensal | null): ResumoCard[] {
        if (!resumo) {
            return [];
        }

        const entradas = this.pickNumber(resumo, ['totalEntradas', 'entradas', 'totalReceitas']);
        const saidas = this.pickNumber(resumo, ['totalSaidas', 'saidas', 'totalDespesas']);
        const saldoInicial = this.pickNumber(resumo, ['saldoInicial']);
        const saldoFinal = this.pickNumber(resumo, ['saldoAtual', 'saldoFinal', 'saldo']);

        const cards: ResumoCard[] = [];

        if (saldoFinal !== null) {
            cards.push({ label: 'Saldo atual', value: saldoFinal, tone: 'neutral' });
        }
        if (entradas !== null) {
            cards.push({ label: 'Entradas', value: entradas, tone: 'positive' });
        }
        if (saidas !== null) {
            cards.push({ label: 'Saídas', value: saidas, tone: 'negative' });
        }
        if (saldoInicial !== null) {
            cards.push({ label: 'Saldo inicial', value: saldoInicial, tone: 'neutral' });
        }

        return cards;
    }

    private pickNumber(resumo: ResumoMensal, keys: string[]) {
        for (const key of keys) {
            const value = resumo[key as keyof ResumoMensal];
            if (typeof value === 'number') {
                return value;
            }
        }
        return null;
    }

    private normalizeResumo(r: any): ResumoMensal | null {
        if (!r) return null;
        return {
            contaId: r.contaId ?? r.ContaId,
            mes: r.mes ?? r.Mes,
            ano: r.ano ?? r.Ano,
            totalEntradas: Number(r.totalEntradas ?? r.TotalEntradas ?? 0),
            totalSaidas: Number(r.totalSaidas ?? r.TotalSaidas ?? 0),
            saldoMes: Number(r.saldoMes ?? r.SaldoMes ?? 0),
            totalRecorrenteEntrada: Number(r.totalRecorrenteEntrada ?? r.TotalRecorrenteEntrada ?? 0),
            totalRecorrenteSaida: Number(r.totalRecorrenteSaida ?? r.TotalRecorrenteSaida ?? 0),
            totalAssinaturasSaida: Number(r.totalAssinaturasSaida ?? r.TotalAssinaturasSaida ?? 0),
            moeda: r.moeda ?? r.Moeda ?? 'BRL'
        };
    }

    private parseTransacoesResponse(response: any): { items: Transacao[]; total: number | null } {
        const data = response?.data ?? response?.Data ?? response?.items ?? response?.Items ?? (Array.isArray(response) ? response : []);
        const total = response?.meta?.totalItems ?? response?.pagination?.totalItems ?? response?.Pagination?.TotalItems ?? null;
        return {
            items: Array.isArray(data) ? data.map(t => this.normalizeTransacao(t)) : [],
            total
        };
    }

    private normalizeTransacao(raw: unknown): Transacao {
        const item = (raw ?? {}) as Record<string, any>;
        const tipoValue = item['tipo'] ?? item['Tipo'] ?? item['type'];
        const tipo = this.parseTipo(tipoValue);
        const date =
            item['createdAt'] ||
            item['dataTransacao'] ||
            item['DataTransacao'] ||
            item['data'] ||
            item['Data'] ||
            item['created_at'] ||
            item['date'];

        const tagsRaw = item['tags'] ?? item['Tags'] ?? item['tagNomes'];

        return {
            id: Number(item['id'] ?? item['Id'] ?? item['transacaoId'] ?? item['transacao_id'] ?? 0),
            valor: Number(item['valor'] ?? item['Valor'] ?? item['value'] ?? 0),
            descricao: item['descricao'] ?? item['Descricao'] ?? item['description'] ?? '',
            tipo,
            categoria:
                item['categoria'] ||
                item['Categoria'] ||
                (item['categoriaId'] || item['CategoriaId']
                    ? {
                        id: Number(item['categoriaId'] ?? item['CategoriaId']),
                        nome: item['categoriaNome'] ?? item['CategoriaNome'] ?? 'Categoria'
                    }
                    : undefined),
            tags: this.normalizeTags(Array.isArray(tagsRaw) ? tagsRaw : []),
            data: item['data'] ?? item['Data'] ?? item['dataTransacao'] ?? item['DataTransacao'] ?? date ?? '',
            createdAt: item['createdAt'] ?? item['dataTransacao'] ?? item['DataTransacao'] ?? item['data'] ?? item['Data'] ?? date ?? ''
        };
    }

    private parseTipo(value: any): 'entrada' | 'saida' {
        // API returns: 1 = entrada, 2 = saida
        // Also handle string variants
        const v = String(value).toLowerCase().trim();
        if (value === 1 || v === '1' || v === 'entrada' || v === 'receita' || v === 'income') {
            return 'entrada';
        }
        // Default to saida for 2, 'saida', 'despesa', 'expense', or unknown
        return 'saida';
    }

    protected getBalanco(): number {
        const entradas = this.resumoMensal()?.totalEntradas ?? this.resumoMensal()?.entradas ?? 0;
        const saidas = this.resumoMensal()?.totalSaidas ?? this.resumoMensal()?.saidas ?? 0;
        return entradas - saidas;
    }

    private getTransacaoDate(transacao: Transacao) {
        const dateString = transacao.createdAt || transacao.data;
        const date = new Date(dateString);
        return Number.isNaN(date.getTime()) ? new Date() : date;
    }

    protected getCardIconClass(tone: string): string {
        switch (tone) {
            case 'positive':
                return 'text-green-500';
            case 'negative':
                return 'text-red-500';
            default:
                return 'text-blue-500';
        }
    }

    protected getCardIconPath(label: string): string {
        switch (label.toLowerCase()) {
            case 'saldo atual':
                return 'M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z';
            case 'entradas':
                return 'M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v3.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.409l-7-14z';
            case 'saídas':
                return 'M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v3.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.409l-7-14z';
            default:
                return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
        }
    }

    private normalizeTags(tags: unknown[]): string[] {
        return tags
            .map((tag) => {
                if (typeof tag === 'string') {
                    return tag;
                }
                if (tag && typeof tag === 'object') {
                    const data = tag as Record<string, unknown>;
                    return (data['nome'] as string) || (data['name'] as string) || '';
                }
                return '';
            })
            .filter((tag) => tag.length > 0);
    }

    private parseInsights(response: unknown): string[] {
        if (Array.isArray(response)) {
            return response.map((item) => String(item)).filter(Boolean);
        }
        if (!response || typeof response !== 'object') {
            return [];
        }
        const data = response as Record<string, any>;
        const list =
            data['insights'] ||
            data['mensagens'] ||
            data['mensagem'] ||
            data['message'] ||
            data['texto'] ||
            [];
        if (Array.isArray(list)) {
            return list.map((item) => String(item)).filter(Boolean);
        }
        if (typeof list === 'string') {
            return [list];
        }
        return [];
    }
}
