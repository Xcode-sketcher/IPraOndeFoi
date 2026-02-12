import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { finalize, catchError, of, timeout } from 'rxjs';
import { utils, writeFile } from 'xlsx';

@Component({
    selector: 'app-exportacao',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './exportacao.component.html',
    styleUrls: ['./exportacao.component.css']
})
export class ExportacaoComponent {
    private api = inject(ApiService);
    private auth = inject(AuthService);

    isExporting = signal(false);
    exportMessage = signal<string | null>(null);
    exportError = signal<string | null>(null);

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

        // Fetch transactions data
        this.api.getTransacoes({ contaId, limit: 1000 })
            .pipe(
                timeout(15000),
                catchError(() => {
                    return of({ items: [] });
                }),
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
                            this.exportToPdf();
                        }
                    } catch (err) {
                        this.exportError.set('Erro ao gerar arquivo de exportação.');
                    }
                },
                error: (err) => {
                    this.exportError.set('Erro ao buscar dados para exportação.');
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

    private exportToPdf() {
        const contaId = this.auth.currentUser()?.contaId;
        if (!contaId) return;

        this.api.exportar(contaId, 'pdf')
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
        return tipo === 1 || v === '1' || v === 'entrada' || v === 'receita';
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
