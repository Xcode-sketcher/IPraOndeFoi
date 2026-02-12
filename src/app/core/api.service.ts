import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

export type AuthPayload = {
    email: string;
    password: string;
};

export type ResumoMensalQuery = {
    contaId: number;
    mes: number;
    ano: number;
};

export type TransacaoQuery = {
    contaId: number;
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;
    tipo?: number;
    categoriaId?: number;
    inicio?: string;
    fim?: string;
    descricao?: string; // Search by name
};

export type CriarTransacaoPayload = {
    contaId: number;
    valor: number;
    descricao: string;
    tipo: number;
    moeda: string;
    dataTransacao: string;
    categoriaId?: number | null;
};

export type AtualizarTransacaoPayload = CriarTransacaoPayload;

export type CriarRecorrenciaPayload = {
    contaId: number;
    tipo: number;
    valor: number;
    moeda: string;
    categoriaId?: number | null;
    descricao: string;
    frequencia: string;
    intervaloQuantidade: number;
    intervaloUnidade: number;
    dataInicio: string;
    diaDoMes?: number | null;
    proximaExecucao?: string | null;
    ativa: boolean;
};

export type CriarAssinaturaPayload = {
    contaId: number;
    nome: string;
    valor: number;
    moeda: string;
    categoriaId?: number | null;
    frequencia: string;
    intervaloQuantidade: number;
    intervaloUnidade: number;
    dataInicio: string;
    proximaCobranca?: string | null;
    ativa: boolean;
};

export type CriarOrcamentoPayload = {
    contaId: number;
    mes: number;
    ano: number;
    categoriaId: number;
    limite: number;
};

export type AtualizarOrcamentoPayload = CriarOrcamentoPayload;

export type CriarMetaPayload = {
    contaId: number;
    nome: string;
    valorAlvo: number;
    valorAtual: number;
    dataInicio: string;
    dataFim: string;
    categoriaId?: number | null;
};

export type AtualizarMetaPayload = CriarMetaPayload;

export type OrcamentoStatusQuery = {
    contaId: number;
    mes: number;
    ano: number;
};

export type Categoria = {
    id: number;
    nome: string;
};

export type Tag = {
    id: number;
    nome: string;
};

export type CriarTagPayload = {
    contaId: number;
    nome: string;
};

export type VincularTagPayload = {
    transacaoId: number;
    tagId: number;
};

export type ContribuirMetaPayload = {
    valor: number;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);

    register(payload: AuthPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/auth/cadastrar`, payload);
    }

    login(payload: AuthPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/auth/entrar`, payload, {
            observe: 'response'
        });
    }

    logout() {
        return this.http.post<void>(`${API_BASE_URL}/api/auth/sair`, {});
    }

    getProfile() {
        return this.http.get<unknown>(`${API_BASE_URL}/api/auth/perfil`);
    }

    criarConta(payload: any) {
        return this.http.post<any>(`${API_BASE_URL}/api/contas`, payload);
    }

    getResumoMensal(query: ResumoMensalQuery) {
        const params = new HttpParams()
            .set('contaId', query.contaId.toString())
            .set('mes', query.mes.toString())
            .set('ano', query.ano.toString());

        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/resumo-mensal`, { params });
    }

    getTransacoes(query: TransacaoQuery) {
        let params = new HttpParams().set('contaId', query.contaId.toString());

        // Always include limit and offset when provided (allow 0)
        // Support page/pageSize first (API expects those)
        if (query.pageSize !== undefined && query.pageSize !== null) {
            params = params.set('pageSize', query.pageSize.toString());
        }
        if (query.page !== undefined && query.page !== null) {
            params = params.set('page', query.page.toString());
            // also compute offset for client-side use
            if (query.pageSize) {
                const computedOffset = (Number(query.page) - 1) * Number(query.pageSize);
                params = params.set('offset', String(computedOffset));
            }
        }

        // Backwards-compat: still accept limit/offset
        if (query.limit !== undefined && query.limit !== null) {
            params = params.set('limit', query.limit.toString());
            if (!query.pageSize) {
                params = params.set('pageSize', query.limit.toString());
            }
        }
        if (query.offset !== undefined && query.offset !== null) {
            params = params.set('offset', query.offset.toString());
            if (!query.page && query.limit) {
                const page = Math.floor(query.offset / query.limit) + 1;
                params = params.set('page', page.toString());
            }
        }
        if (query.tipo) {
            params = params.set('tipo', query.tipo.toString());
        }
        if (query.categoriaId) {
            params = params.set('categoriaId', query.categoriaId.toString());
        }
        if (query.inicio) {
            params = params.set('inicio', query.inicio);
        }
        if (query.fim) {
            params = params.set('fim', query.fim);
        }
        if (query.descricao) {
            params = params.set('descricao', query.descricao);
        }

        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/transacoes`, { params });
    }

    criarTransacao(payload: CriarTransacaoPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/transacoes`, payload);
    }

    atualizarTransacao(transacaoId: number, payload: AtualizarTransacaoPayload) {
        return this.http.put<unknown>(
            `${API_BASE_URL}/api/financas/transacoes/${transacaoId}`,
            payload
        );
    }

    deletarTransacao(transacaoId: number) {
        return this.http.delete<unknown>(`${API_BASE_URL}/api/financas/transacoes/${transacaoId}`);
    }

    getCategorias() {
        return this.http.get<Categoria[]>(`${API_BASE_URL}/api/financas/categorias`);
    }

    getTags(contaId: number) {
        const params = new HttpParams().set('contaId', contaId.toString());
        return this.http.get<Tag[]>(`${API_BASE_URL}/api/financas/tags`, { params });
    }

    criarTag(payload: CriarTagPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/tags`, payload);
    }

    vincularTag(payload: VincularTagPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/transacoes/tags`, payload);
    }

    atualizarTag(tagId: number, nome: string) {
        return this.http.put<unknown>(`${API_BASE_URL}/api/financas/tags/${tagId}`, { nome });
    }

    deletarTag(tagId: number) {
        return this.http.delete<unknown>(`${API_BASE_URL}/api/financas/tags/${tagId}`);
    }

    criarRecorrencia(payload: CriarRecorrenciaPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/recorrencias`, payload);
    }

    listarRecorrencias(contaId: number) {
        const params = new HttpParams().set('contaId', contaId.toString());
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/recorrencias`, { params });
    }

    criarAssinatura(payload: CriarAssinaturaPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/assinaturas`, payload);
    }

    listarAssinaturas(contaId: number) {
        const params = new HttpParams().set('contaId', contaId.toString());
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/assinaturas`, { params });
    }

    criarOrcamento(payload: CriarOrcamentoPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/orcamentos`, payload);
    }

    atualizarOrcamento(orcamentoId: number, payload: AtualizarOrcamentoPayload) {
        return this.http.put<unknown>(
            `${API_BASE_URL}/api/financas/orcamentos/${orcamentoId}`,
            payload
        );
    }

    deletarOrcamento(orcamentoId: number) {
        return this.http.delete<unknown>(`${API_BASE_URL}/api/financas/orcamentos/${orcamentoId}`);
    }

    listarOrcamentos(contaId: number, mes?: number, ano?: number, offset?: number, limit?: number) {
        let params = new HttpParams().set('contaId', contaId.toString());
        if (mes) {
            params = params.set('mes', mes.toString());
        }
        if (ano) {
            params = params.set('ano', ano.toString());
        }
        if (offset !== undefined) {
            params = params.set('offset', offset.toString());
        }
        if (limit !== undefined) {
            params = params.set('limit', limit.toString());
        }
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/orcamentos`, { params });
    }

    // Some servers expose a list endpoint without query params — try that as a fallback
    listarOrcamentosAll() {
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/orcamentos`);
    }

    getOrcamentosStatus(query: OrcamentoStatusQuery) {
        const params = new HttpParams()
            .set('contaId', query.contaId.toString())
            .set('mes', query.mes.toString())
            .set('ano', query.ano.toString());

        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/orcamentos/status`, { params });
    }

    getOrcamentosAnalises(query: { contaId: number; mes: number; ano: number; meses?: number }) {
        let params = new HttpParams()
            .set('contaId', query.contaId.toString())
            .set('mes', query.mes.toString())
            .set('ano', query.ano.toString());

        if (query.meses) {
            params = params.set('meses', query.meses.toString());
        }

        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/orcamentos/analises`, { params });
    }

    criarMeta(payload: CriarMetaPayload) {
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/metas`, payload);
    }

    atualizarMeta(metaId: number, payload: AtualizarMetaPayload) {
        return this.http.put<unknown>(`${API_BASE_URL}/api/financas/metas/${metaId}`, payload);
    }

    deletarMeta(metaId: number) {
        return this.http.delete<unknown>(`${API_BASE_URL}/api/financas/metas/${metaId}`);
    }

    contribuirMeta(metaId: number, payload: ContribuirMetaPayload) {
        return this.http.post<unknown>(
            `${API_BASE_URL}/api/financas/metas/${metaId}/contribuir`,
            payload
        );
    }

    listarMetas(contaId: number) {
        const params = new HttpParams().set('contaId', contaId.toString());
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/metas`, { params });
    }

    getSaldoAtual(contaId: number) {
        const params = new HttpParams().set('contaId', contaId.toString());
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/saldo-atual`, { params });
    }

    getInsights(contaId: number, mesesHistorico = 12) {
        const params = new HttpParams()
            .set('contaId', contaId.toString())
            .set('mesesHistorico', mesesHistorico.toString());
        return this.http.get<unknown>(`${API_BASE_URL}/api/financas/insights`, { params });
    }

    exportar(contaId: number, formato: 'csv' | 'pdf', inicio?: string, fim?: string) {
        let params = new HttpParams()
            .set('contaId', contaId.toString())
            .set('formato', formato);

        if (inicio) {
            params = params.set('inicio', inicio);
        }
        if (fim) {
            params = params.set('fim', fim);
        }

        return this.http.get(`${API_BASE_URL}/api/financas/exportar`, {
            params,
            responseType: 'blob'
        });
    }

    importar(contaId: number, arquivo: File) {
        const params = new HttpParams().set('contaId', contaId.toString());
        const formData = new FormData();
        formData.append('Arquivo', arquivo);
        return this.http.post<unknown>(`${API_BASE_URL}/api/financas/importar`, formData, { params });
    }
}
