import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize, timeout, lastValueFrom } from 'rxjs';
import { utils, writeFile } from 'xlsx';

@Component({
    selector: 'app-exportacao',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './exportacao.component.html',
    styleUrls: ['./exportacao.component.css']
})
export class ExportacaoComponent {
    private api = inject(ApiService);
    private auth = inject(AuthService);
    private fb = inject(FormBuilder);

    isExporting = signal(false);
    exportMessage = signal<string | null>(null);
    exportError = signal<string | null>(null);

    filterForm = this.fb.group({
        tipoFiltro: ['todos'],
        dataInicio: [''],
        dataFim: [''],
        mes: [''],
        ano: ['']
    });

    constructor() {
        const hoje = new Date().toISOString().split('T')[0];
        this.filterForm.patchValue({ dataFim: hoje });

        const now = new Date();
        this.filterForm.patchValue({
            mes: String(now.getMonth() + 1).padStart(2, '0'),
            ano: String(now.getFullYear())
        });
    }

    get periodoDescricao(): string {
        const filters = this.filterForm.value;

        if (filters.tipoFiltro === 'todos') {
            return 'Todas as transações';
        } else if (filters.tipoFiltro === 'periodo') {
            const inicio = filters.dataInicio ? this.formatarData(filters.dataInicio) : 'início';
            const fim = filters.dataFim ? this.formatarData(filters.dataFim) : 'hoje';
            return `Período: ${inicio} até ${fim}`;
        } else if (filters.tipoFiltro === 'mes' && filters.mes && filters.ano) {
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const mesIdx = parseInt(filters.mes) - 1;
            return `${meses[mesIdx]} de ${filters.ano}`;
        }

        return 'Período não definido';
    }

    private formatarData(dataIso: string): string {
        const date = new Date(dataIso + 'T00:00:00');
        return date.toLocaleDateString('pt-BR');
    }

    exportar(formato: string) {
        if (this.isExporting()) return;

        const contaId = this.auth.currentUser()?.contaId;
        if (!contaId) {
            this.exportError.set('Usuário não autenticado.');
            return;
        }

        this.isExporting.set(true);
        this.exportMessage.set(null);
        this.exportError.set(null);

        const filters = this.filterForm.value;

        // Para PDF, chamar método específico
        if (formato === 'pdf') {
            this.exportPdfWithFilters(contaId, filters);
            return;
        }

        // Para Excel e CSV, buscar todas as transações com paginação
        this.buscarTodasTransacoes(contaId, filters)
            .then(transacoes => {
                if (transacoes.length === 0) {
                    this.exportError.set('Nenhuma transação encontrada para exportar.');
                    this.isExporting.set(false);
                    return;
                }

                try {
                    if (formato === 'excel') {
                        this.exportToExcel(transacoes);
                    } else if (formato === 'csv') {
                        this.exportToCsv(transacoes);
                    }
                } catch (err) {
                    console.error('Erro ao gerar arquivo:', err);
                    this.exportError.set('Erro ao gerar arquivo de exportação.');
                }
                this.isExporting.set(false);
            })
            .catch(err => {
                console.error('Erro ao buscar transações:', err);
                this.exportError.set(`Erro ao buscar dados: ${err?.error?.error || err?.message || 'Erro desconhecido'}`);
                this.isExporting.set(false);
            });
    }

    private async buscarTodasTransacoes(contaId: number, filters: any): Promise<any[]> {
        const todasTransacoes: any[] = [];
        const pageSize = 2000; // Máximo permitido pelo backend
        let page = 1;
        let hasMore = true;

        // Construir query base
        const getQuery = (pageNum: number) => {
            const query: any = {
                contaId,
                page: pageNum,
                pageSize
            };

            // Adicionar filtros de data se necessário
            if (filters.tipoFiltro === 'periodo') {
                if (filters.dataInicio) query.inicio = filters.dataInicio;
                if (filters.dataFim) query.fim = filters.dataFim;
            } else if (filters.tipoFiltro === 'mes' && filters.mes && filters.ano) {
                const mes = parseInt(filters.mes);
                const ano = parseInt(filters.ano);
                const dtInicio = new Date(ano, mes - 1, 1);
                const dtFim = new Date(ano, mes, 0);
                query.inicio = dtInicio.toISOString().split('T')[0];
                query.fim = dtFim.toISOString().split('T')[0];
            }

            return query;
        };

        // Buscar todas as páginas
        while (hasMore) {
            try {
                const response: any = await lastValueFrom(
                    this.api.getTransacoes(getQuery(page))
                        .pipe(timeout(15000))
                );

                const transacoes = this.extractTransacoes(response);
                todasTransacoes.push(...transacoes);

                // Verificar se há mais páginas
                const pagination = response?.pagination ?? response?.Pagination;
                hasMore = pagination?.hasNext ?? pagination?.HasNext ?? false;
                page++;

            } catch (err) {
                throw err;
            }
        }

        return todasTransacoes;
    }

    private exportPdfWithFilters(contaId: number, filters: any) {
        let inicio: string | undefined;
        let fim: string | undefined;

        if (filters.tipoFiltro === 'periodo') {
            inicio = filters.dataInicio || undefined;
            fim = filters.dataFim || undefined;
        } else if (filters.tipoFiltro === 'mes' && filters.mes && filters.ano) {
            const mes = parseInt(filters.mes);
            const ano = parseInt(filters.ano);
            const dtInicio = new Date(ano, mes - 1, 1);
            const dtFim = new Date(ano, mes, 0);
            inicio = dtInicio.toISOString().split('T')[0];
            fim = dtFim.toISOString().split('T')[0];
        }

        this.api.exportar(contaId, 'pdf', inicio, fim)
            .pipe(
                timeout(30000),
                finalize(() => this.isExporting.set(false))
            )
            .subscribe({
                next: (blob: any) => {
                    if (blob && blob.size > 0) {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `praondefoi_relatorio_${this.getDateString()}.pdf`;
                        link.click();
                        this.exportMessage.set('Relatório PDF exportado com sucesso!');
                    } else {
                        this.exportError.set('Exportação PDF não disponível no momento.');
                    }
                },
                error: (err) => {
                    console.error('Erro ao gerar PDF:', err);
                    this.exportError.set('Erro ao gerar PDF. O backend pode não ter este recurso implementado.');
                }
            });
    }

    private extractTransacoes(response: any): any[] {
        if (Array.isArray(response)) return response;
        const data = response?.data ?? response?.Data ?? response?.items ?? response?.Items;
        return Array.isArray(data) ? data : [];
    }

    private exportToExcel(data: any[]) {
        // Transform data to spreadsheet format
        const rows = data.map((t: any) => ({
            'ID': t.id || t.transacaoId || '',
            'Data': this.formatDate(t.dataTransacao || t.data || ''),
            'Descrição': t.descricao || '',
            'Tipo': this.getTipoLabel(t.tipo),
            'Valor': Number(t.valor) || 0,
            'Categoria': t.categoriaNome || t.categoria?.nome || 'Outros',
            'Moeda': t.moeda || 'BRL'
        }));

        // Ciar workbook com estilos
        const ws = utils.json_to_sheet(rows);

        // Definir largura das colunas
        ws['!cols'] = [
            { wch: 8 },   // ID
            { wch: 12 },  // Data
            { wch: 30 },  // Descrição
            { wch: 10 },  // Tipo
            { wch: 12 },  // Valor
            { wch: 20 },  // Categoria
            { wch: 8 }    // Moeda
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Transações');

        // Add summary sheet
        const totalEntradas = data.filter(t => this.isEntrada(t.tipo))
            .reduce((sum, t) => sum + Number(t.valor || 0), 0);
        const totalSaidas = data.filter(t => !this.isEntrada(t.tipo))
            .reduce((sum, t) => sum + Number(t.valor || 0), 0);

        const summaryData = [
            { 'Resumo': 'Total Transações', 'Valor': data.length },
            { 'Resumo': 'Total Entradas', 'Valor': this.formatMoeda(totalEntradas) },
            { 'Resumo': 'Total Saídas', 'Valor': this.formatMoeda(totalSaidas) },
            { 'Resumo': 'Balanço', 'Valor': this.formatMoeda(totalEntradas - totalSaidas) }
        ];
        const summaryWs = utils.json_to_sheet(summaryData);
        summaryWs['!cols'] = [{ wch: 20 }, { wch: 15 }];
        utils.book_append_sheet(wb, summaryWs, 'Resumo');

        // Download
        const filename = `praondefoi_transacoes_${this.getDateString()}.xlsx`;
        writeFile(wb, filename);

        this.exportMessage.set(`Arquivo ${filename} exportado com sucesso!`);
    }

    private exportToCsv(data: any[]) {
        const rows = data.map((t: any) => ({
            'ID': t.id || t.transacaoId || '',
            'Data': this.formatDate(t.dataTransacao || t.data || ''),
            'Descrição': t.descricao || '',
            'Tipo': this.getTipoLabel(t.tipo),
            'Valor': Number(t.valor) || 0,
            'Categoria': t.categoriaNome || t.categoria?.nome || 'Outros'
        }));

        const ws = utils.json_to_sheet(rows);
        const csv = utils.sheet_to_csv(ws);

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `praondefoi_transacoes_${this.getDateString()}.csv`;
        link.click();

        this.exportMessage.set('Arquivo CSV exportado com sucesso!');
    }


    private isEntrada(tipo: any): boolean {
        const v = String(tipo).toLowerCase().trim();
        return tipo === 1 ||
               v === '1' ||
               v === 'entrada' ||
               v === 'receita' ||
               v === 'income';
    }

    private getTipoLabel(tipo: any): string {
        return this.isEntrada(tipo) ? 'Entrada' : 'Saída';
    }

    private formatDate(dateString: string): string {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateString;
        }
    }

    private formatMoeda(val: number): string {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }

    private getDateString(): string {
        return new Date().toISOString().split('T')[0];
    }
}
