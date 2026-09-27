// Funções de API das simulações, finas, sobre o client HTTP. O corpo (criar e atualizar) é o do backend, em
// snake_case; a conversão do formulário fica só em schemas/simulacao.js.
import { get, post, put, remover } from './api.js'

// { itens, total }, do mais recente ao mais antigo (sem paginação, ordenação nem filtros).
export const listar = ({ signal } = {}) => get('/simulacoes', { signal })

// Não traz as opções de financiamento (vêm de /financiamentos).
export const obter = (id, { signal } = {}) => get(`/simulacoes/${id}`, { signal })

// 201 com a simulação criada. 422 com detalhes por campo.
export const criar = (corpo) => post('/simulacoes', corpo)

// Substitui TUDO (mesmo corpo do POST; sem PATCH).
export const atualizar = (id, corpo) => put(`/simulacoes/${id}`, corpo)

// 204 sem corpo (devolve null); apaga as opções de financiamento junto.
export const excluir = (id) => remover(`/simulacoes/${id}`)
