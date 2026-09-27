import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import { banco, criarFinanciamento, financiamentoPublico } from '../banco.js'
import { dadosInvalidos, financiamentoAusente, respostaErro, simulacaoAusente } from '../erros.js'
import { autenticar } from '../sessao.js'
import { lerCorpo, lerId, regrasFinanciamento, validar } from '../validacao.js'
import { obterSimulacao } from './simulacoes.js'

const { urlApi } = lerConfig()
const MAXIMO_OPCOES = 3
const caminhoApi = new URL(urlApi).pathname

const opcoesDe = (simulacao) => banco.financiamentos.filter((f) => f.simulacao_id === simulacao.id)

// A entrada da OPÇÃO tem de ser estritamente menor que o valor do veículo (a da simulação aceita igual).
async function lerFinanciamento(request, simulacao) {
  const { corpo, resposta } = await lerCorpo(request)
  if (resposta) return { resposta }
  const { dados, detalhes } = validar(corpo, regrasFinanciamento)
  if (!detalhes.valor_entrada && dados.valor_entrada >= simulacao.valor_veiculo) {
    const valor = simulacao.valor_veiculo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    detalhes.valor_entrada = [
      `A entrada deve ser menor que o valor do veículo (R$ ${valor}); com a entrada igual ao valor não há o que financiar.`,
    ]
  }
  if (Object.keys(detalhes).length > 0) return { resposta: dadosInvalidos(detalhes) }
  return { dados }
}

export const handlersFinanciamentos = [
  http.get(`${urlApi}/simulacoes/:id/financiamentos`, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)
    const itens = opcoesDe(simulacao).map(financiamentoPublico)
    return HttpResponse.json({ itens, total: itens.length })
  }),

  // Ordem das verificações, como no backend: dono (404) -> corpo (400/415/422) -> estado (409).
  http.post(`${urlApi}/simulacoes/:id/financiamentos`, async ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)

    const lida = await lerFinanciamento(request, simulacao)
    if (lida.resposta) return lida.resposta
    if (opcoesDe(simulacao).length >= MAXIMO_OPCOES) {
      return respostaErro(409, 'Uma simulação aceita no máximo 3 opções de financiamento')
    }

    const financiamento = criarFinanciamento(simulacao.id, lida.dados)
    return HttpResponse.json(financiamentoPublico(financiamento), {
      status: 201,
      headers: { Location: `${caminhoApi}/simulacoes/${simulacao.id}/financiamentos/${financiamento.id}` },
    })
  }),

  http.put(`${urlApi}/simulacoes/:id/financiamentos/:fid`, async ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)
    const fid = lerId(params.fid)
    const financiamento = opcoesDe(simulacao).find((f) => f.id === fid)
    if (!financiamento) return financiamentoAusente(params.fid)

    const lida = await lerFinanciamento(request, simulacao)
    if (lida.resposta) return lida.resposta

    Object.assign(financiamento, lida.dados)
    return HttpResponse.json(financiamentoPublico(financiamento))
  }),

  http.delete(`${urlApi}/simulacoes/:id/financiamentos/:fid`, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)
    const fid = lerId(params.fid)
    const financiamento = opcoesDe(simulacao).find((f) => f.id === fid)
    if (!financiamento) return financiamentoAusente(params.fid)

    banco.financiamentos = banco.financiamentos.filter((f) => f.id !== financiamento.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
