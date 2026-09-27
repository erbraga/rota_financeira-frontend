// Índices (CDI e IPCA): devolve as fixtures reais do backend, sem consultar nada. O "periodo" é validado
// (e qualquer outro parâmetro é recusado, como no backend real), mas não filtra os pontos da fixture.
import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import { dadosInvalidos, respostaErro } from '../erros.js'
import indiceCdi from '../fixtures/indice-cdi.json'
import indiceIpca from '../fixtures/indice-ipca.json'
import { autenticar } from '../sessao.js'

const { urlApi } = lerConfig()

export const INDICES = { cdi: indiceCdi, ipca: indiceIpca }
const PERIODOS = ['1m', '3m', '6m', '12m', '24m', '60m']
const CAMINHO = `${urlApi}/indices/:indice`

export const handlersIndices = [
  // Ordem: token (401) -> índice (404) -> periodo (422). Só minúsculas; "selic" e qualquer outro dão 404.
  http.get(CAMINHO, ({ request, params }) => {
    const { resposta } = autenticar(request)
    if (resposta) return resposta

    const indice = INDICES[params.indice]
    if (!indice) return respostaErro(404, 'Índice não encontrado')

    // Como no backend real: um erro por parâmetro (chave = o nome do parâmetro), todos de uma vez.
    const consulta = new URL(request.url).searchParams
    const detalhes = {}
    for (const nome of new Set(consulta.keys())) {
      const valores = consulta.getAll(nome)
      if (nome !== 'periodo') detalhes[nome] = ['Campo desconhecido.']
      else if (valores.length > 1) detalhes[nome] = ['Informe o parâmetro uma única vez.']
      else if (!PERIODOS.includes(valores[0])) {
        detalhes[nome] = [`O período deve ser um destes: ${PERIODOS.join(', ')}.`]
      }
    }
    if (Object.keys(detalhes).length > 0) return dadosInvalidos(detalhes)
    return HttpResponse.json(indice)
  }),
]

// Atalhos de teste: cada um devolve um handler que sobrescreve os índices (servidor.use(...)).
// BACEN fora do ar e sem cache: 503.
export const indiceIndisponivel = () =>
  http.get(CAMINHO, () => respostaErro(503, 'Dados do Banco Central indisponíveis no momento'))

// Dados vindos do cache vencido: 200 com desatualizado: true.
export const indiceDesatualizado = () =>
  http.get(CAMINHO, ({ params }) => HttpResponse.json({ ...INDICES[params.indice], desatualizado: true }))

// Sem valor sugerido (sugestao anulável no contrato): o formulário precisa funcionar sem ele.
export const indiceSemSugestao = () =>
  http.get(CAMINHO, ({ params }) => HttpResponse.json({ ...INDICES[params.indice], sugestao: null }))
