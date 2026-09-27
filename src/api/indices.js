// Índices do Banco Central (CDI e IPCA), pela API do backend: a SPA nunca fala com o BACEN.
import { get } from './api.js'

// indice: 'cdi' | 'ipca' (o caminho é minúsculo; "selic" e qualquer outro dão 404 "Índice não encontrado").
// periodo (opcional): '1m' | '3m' | '6m' | '12m' | '24m' | '60m' (padrão do backend: 12m). Só a `sugestao` do resultado
// importa para o formulário e ela não depende do período, então quem só quer a sugestão pede '1m' (resposta ~10x menor).
// Devolve { indice, descricao, unidade, serie_sgs, sugestao, periodo, pontos, atualizado_em, desatualizado }:
// `sugestao` ({ valor, data_referencia }, valor em % a.a.) e `atualizado_em` podem ser null.
// 503: BACEN fora do ar e sem cache no backend.
export function obterIndice(indice, { periodo, signal } = {}) {
  const consulta = periodo === undefined ? '' : `?periodo=${encodeURIComponent(periodo)}`
  return get(`/indices/${encodeURIComponent(String(indice).toLowerCase())}${consulta}`, { signal })
}
