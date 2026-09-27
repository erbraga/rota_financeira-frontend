// Funções de API das opções de financiamento de uma simulação, finas, sobre o client HTTP. O corpo (criar e
// atualizar) é o do backend, em snake_case; a conversão do formulário fica só em schemas/financiamento.js.
// Não existe GET de uma opção só (o backend responde 405): só a lista.
import { get, post, put, remover } from './api.js'

const base = (simulacaoId) => `/simulacoes/${simulacaoId}/financiamentos`

// { itens, total }, em ordem de criação. 404 se a simulação não existe ou é de outra pessoa.
export const listarFinanciamentos = (simulacaoId, { signal } = {}) => get(base(simulacaoId), { signal })

// 201 com a opção criada. 422 com detalhes por campo; 409 (sem detalhes) se a simulação já tem 3 opções.
export const criarFinanciamento = (simulacaoId, corpo) => post(base(simulacaoId), corpo)

// Substitui TUDO (mesmo corpo do POST; sem PATCH; valor_entrada omitido voltaria a 0). 404 se a opção não existe.
export const atualizarFinanciamento = (simulacaoId, id, corpo) => put(`${base(simulacaoId)}/${id}`, corpo)

// 204 sem corpo (devolve null).
export const excluirFinanciamento = (simulacaoId, id) => remover(`${base(simulacaoId)}/${id}`)
