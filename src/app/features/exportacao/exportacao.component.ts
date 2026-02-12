import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize, catchError, of, timeout } from 'rxjs';
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
        let inicio: string | undefined;
        let fim: string | undefined;

        if (filters.tipoFiltro === 'periodo') {
            // Enviar apenas YYYY-MM-DD, pois o backend pega apenas a parte da data
            inicio = filters.dataInicio || undefined;
            fim = filters.dataFim || undefined;
        } else if (filters.tipoFiltro === 'mes') {
            if (filters.mes && filters.ano) {
                const mes = parseInt(filters.mes);
                const ano = parseInt(filters.ano);
                // Primeiro e último dia do mês em formato YYYY-MM-DD
                const dtInicio = new Date(ano, mes - 1, 1);
                const dtFim = new Date(ano, mes, 0);
                inicio = dtInicio.toISOString().split('T')[0];
                fim = dtFim.toISOString().split('T')[0];
            }
        }

        const query: any = { contaId, limit: 10000 };
        if (inicio) query.inicio = inicio;
        if (fim) query.fim = fim;

        this.api.getTransacoes(query)
            .pipe(
                timeout(15000),
                finalize(() => this.isExporting.set(false))
            )
            .subscribe({
                next: (response: any) => {
                    const list = this.extractTransacoes(response);

                    if (list.length === 0) {
                        this.exportError.set('Nenhuma transação encontrada para exportar.');
                        return;
                    }

                    try {
                        if (formato === 'excel') {
                            this.exportToExcel(list);
                        } else if (formato === 'csv') {
                            this.exportToCsv(list);
                        } else if (formato === 'pdf') {
                            this.exportToPdf(inicio, fim);
                        }
                    } catch (err) {
                        console.error('Erro ao gerar arquivo:', err);
                        this.exportError.set('Erro ao gerar arquivo de exportação.');
                    }
                },
                error: (err) => {
                    console.error('Erro ao buscar transações:', err);
                    this.exportError.set(`Erro ao buscar dados: ${err?.error?.error || err?.message || 'Erro desconhecido'}`);
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

        // Create workbook with styling
        const ws = utils.json_to_sheet(rows);

        // Set column widths
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

    private exportToPdf(inicio?: string, fim?: string) {
        const contaId = this.auth.currentUser()?.contaId;
        if (!contaId) return;

        this.api.exportar(contaId, 'pdf', inicio, fim)
            .pipe(
                timeout(15000),
                catchError(() => of(null))
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
                error: () => {
                    this.exportError.set('Erro ao gerar PDF.');
                }
            });
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
