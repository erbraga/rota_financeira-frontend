// /resultado NÃO calcula: devolve as fixtures capturadas do backend real (simulação de exemplo com as
// opções 1 = Price e 2 = SAC). As regras de acesso e de parâmetros seguem o backend.
import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import resultado from '../fixtures/resultado.json'
import resultadoAporte from '../fixtures/resultado-aporte.json'
import resultadoAporteInsuficiente from '../fixtures/resultado-aporte-insuficiente.json'
import { dadosInvalidos, simulacaoNaoEncontrada } from '../erros.js'
import { autenticar } from '../sessao.js'
import { validar } from '../validacao.js'
import { obterSimulacao } from './simulacoes.js'

const { urlApi } = lerConfig()

// Aporte a partir do qual o fundo alcança a meta nas fixtures (1.500 alcança no mês 44; 100 não alcança em 60 meses).
export const APORTE_QUE_ALCANCA = 1500

// Só existe o parâmetro aporte_mensal; vazio, repetido, desconhecido ou inválido -> 422.
function lerAporte(url) {
  const detalhes = {}
  for (const nome of new Set(url.searchParams.keys())) {
    if (nome !== 'aporte_mensal') detalhes[nome] = ['Parâmetro desconhecido.']
  }
  const valores = url.searchParams.getAll('aporte_mensal')
  if (valores.length > 1) detalhes.aporte_mensal = ['Informe o parâmetro uma única vez.']
  else if (valores.length === 1) {
    if (valores[0].trim() === '') detalhes.aporte_mensal = ['O parâmetro não pode ser vazio.']
    else {
      const lido = validar({ aporte_mensal: valores[0] }, [
        { campo: 'aporte_mensal', tipo: 'numero', obrigatorio: true, min: 0, max: 9999999, casas: 2 },
      ])
      if (lido.detalhes.aporte_mensal) detalhes.aporte_mensal = lido.detalhes.aporte_mensal
      else return { aporte: lido.dados.aporte_mensal }
    }
  }
  return Object.keys(detalhes).length > 0 ? { detalhes } : { aporte: undefined }
}

export const handlersResultado = [
  // Ordem, como no backend: token (401) -> dono da simulação (404) -> parâmetros (422).
  http.get(`${urlApi}/simulacoes/:id/resultado`, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    if (!obterSimulacao(usuario, params.id)) return simulacaoNaoEncontrada()

    const { aporte, detalhes } = lerAporte(new URL(request.url))
    if (detalhes) return dadosInvalidos(detalhes)

    if (aporte === undefined) return HttpResponse.json(resultado)
    return HttpResponse.json(aporte >= APORTE_QUE_ALCANCA ? resultadoAporte : resultadoAporteInsuficiente)
  }),
]
