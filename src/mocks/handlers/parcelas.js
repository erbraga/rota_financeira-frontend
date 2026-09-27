// /parcelas NÃO calcula: devolve a fixture da opção conforme o sistema (Price ou SAC).
import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import { banco } from '../banco.js'
import { financiamentoAusente, simulacaoAusente } from '../erros.js'
import parcelasPrice from '../fixtures/parcelas-price.json'
import parcelasSac from '../fixtures/parcelas-sac.json'
import { autenticar } from '../sessao.js'
import { lerId } from '../validacao.js'
import { obterSimulacao } from './simulacoes.js'

const { urlApi } = lerConfig()

export const handlersParcelas = [
  // Ordem: token (401) -> dono da simulação (404) -> opção (404).
  http.get(`${urlApi}/simulacoes/:id/financiamentos/:fid/parcelas`, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)

    const fid = lerId(params.fid)
    const financiamento = banco.financiamentos.find((f) => f.id === fid && f.simulacao_id === simulacao.id)
    if (!financiamento) return financiamentoAusente(params.fid)

    return HttpResponse.json(financiamento.sistema_amortizacao === 'SAC' ? parcelasSac : parcelasPrice)
  }),
]
