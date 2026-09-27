// O resultado comparativo de uma simulação (à vista, financiamentos e fundo), pela API do backend. A SPA NÃO recalcula
// nada: só exibe o que vem daqui.
import { get } from './api.js'

// aporteMensal (opcional): o "e se eu guardar X por mês?", como NÚMERO (0 a 9.999.999,00, 2 casas). Vai na consulta com
// ponto decimal e só quando informado; o backend recusa a vírgula. Sem ele, o backend calcula o aporte que atinge a meta
// no prazo do fundo.
// Devolve { simulacao, cenarios: { a_vista, financiamentos, fundo }, menor_custo, series }. Com aporte informado,
// `fundo.custo_total` e `fundo.preco_na_compra` vêm null se o aporte não alcança a meta em 60 meses.
// 404: a simulação não existe ou é de outra pessoa (mesma resposta); 422: aporte inválido (detalhes.aporte_mensal).
export function obterResultado(simulacaoId, { aporteMensal, signal } = {}) {
  const consulta =
    aporteMensal === undefined || aporteMensal === null ? '' : `?aporte_mensal=${encodeURIComponent(String(aporteMensal))}`
  return get(`/simulacoes/${simulacaoId}/resultado${consulta}`, { signal })
}
