import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import { banco, criarSimulacao, simulacaoPublica } from '../banco.js'
import { dadosInvalidos, simulacaoAusente } from '../erros.js'
import { autenticar } from '../sessao.js'
import { lerCorpo, lerId, regrasSimulacao, validar } from '../validacao.js'

const { urlApi } = lerConfig()
// O Location do backend é relativo ao servidor ("/api/simulacoes/7"), não uma URL absoluta.
const caminhoApi = new URL(urlApi).pathname

// Uma única busca por id E dono: simulação alheia e inexistente dão o mesmo 404.
export function obterSimulacao(usuario, idTexto) {
  const id = lerId(idTexto)
  return id === null ? undefined : banco.simulacoes.find((s) => s.id === id && s.usuario_id === usuario.id)
}

// Validação do corpo da simulação (POST e PUT): campos + entrada de até o valor do veículo (igual é aceito).
async function lerSimulacao(request) {
  const { corpo, resposta } = await lerCorpo(request)
  if (resposta) return { resposta }
  const { dados, detalhes } = validar(corpo, regrasSimulacao)
  if (!detalhes.valor_entrada && !detalhes.valor_veiculo && dados.valor_entrada > dados.valor_veiculo) {
    detalhes.valor_entrada = ['A entrada não pode ser maior que o valor do veículo.']
  }
  if (Object.keys(detalhes).length > 0) return { resposta: dadosInvalidos(detalhes) }
  return { dados }
}

export const handlersSimulacoes = [
  http.get(`${urlApi}/simulacoes`, ({ request }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const itens = banco.simulacoes
      .filter((s) => s.usuario_id === usuario.id)
      .sort((a, b) => b.id - a.id)
      .map(simulacaoPublica)
    return HttpResponse.json({ itens, total: itens.length })
  }),

  http.post(`${urlApi}/simulacoes`, async ({ request }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const lida = await lerSimulacao(request)
    if (lida.resposta) return lida.resposta

    const simulacao = criarSimulacao(usuario.id, lida.dados)
    return HttpResponse.json(simulacaoPublica(simulacao), {
      status: 201,
      headers: { Location: `${caminhoApi}/simulacoes/${simulacao.id}` },
    })
  }),

  http.get(`${urlApi}/simulacoes/:id`, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    return simulacao ? HttpResponse.json(simulacaoPublica(simulacao)) : simulacaoAusente(params.id)
  }),

  http.put(`${urlApi}/simulacoes/:id`, async ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)

    const lida = await lerSimulacao(request)
    if (lida.resposta) return lida.resposta

    // Regra de estado: o veículo tem de ser maior que a entrada de cada opção já cadastrada. A mensagem real
    // cita a primeira opção em conflito, com o nome e o valor dela.
    const conflito = banco.financiamentos.find(
      (f) => f.simulacao_id === simulacao.id && f.valor_entrada >= lida.dados.valor_veiculo,
    )
    if (conflito) {
      const valor = conflito.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      return dadosInvalidos({
        valor_veiculo: [
          `O valor do veículo deve ser maior que a entrada da opção de financiamento "${conflito.nome}" (R$ ${valor}). Ajuste a opção antes.`,
        ],
      })
    }

    Object.assign(simulacao, lida.dados)
    return HttpResponse.json(simulacaoPublica(simulacao))
  }),

  http.delete(`${urlApi}/simulacoes/:id`, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)

    banco.financiamentos = banco.financiamentos.filter((f) => f.simulacao_id !== simulacao.id)
    banco.simulacoes = banco.simulacoes.filter((s) => s.id !== simulacao.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
