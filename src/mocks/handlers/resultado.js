// /resultado NÃO calcula: devolve as fixtures capturadas do backend real (simulação de exemplo com as
// opções 1 = Price e 2 = SAC). As regras de acesso e de parâmetros seguem o backend.
import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import resultado from '../fixtures/resultado.json'
import resultadoAporte from '../fixtures/resultado-aporte.json'
import resultadoAporteInsuficiente from '../fixtures/resultado-aporte-insuficiente.json'
import resultadoFundoVenceJson from '../fixtures/resultado-fundo-vence.json'
import resultadoSemOpcoesJson from '../fixtures/resultado-sem-opcoes.json'
import resultadoTresOpcoesJson from '../fixtures/resultado-tres-opcoes.json'
import { dadosInvalidos, respostaErro, simulacaoAusente } from '../erros.js'
import { autenticar } from '../sessao.js'
import { validar } from '../validacao.js'
import { obterSimulacao } from './simulacoes.js'

const { urlApi } = lerConfig()
const CAMINHO = `${urlApi}/simulacoes/:id/resultado`

// Aporte a partir do qual o fundo alcança a meta nas fixtures (1.500 alcança no mês 44; 100 não alcança em 60 meses).
export const APORTE_QUE_ALCANCA = 1500

// Só existe o parâmetro aporte_mensal. Mensagens iguais às do backend real (conferidas em 2026-09-27): desconhecido ->
// "Campo desconhecido."; repetido -> "Informe o parâmetro uma única vez."; vazio, só espaços, vírgula e texto -> "Número
// inválido."; fora de 0 a 9.999.999,00 -> a mensagem da faixa; mais de 2 casas -> "Use no máximo 2 casas decimais.".
function lerAporte(url) {
  const detalhes = {}
  for (const nome of new Set(url.searchParams.keys())) {
    if (nome !== 'aporte_mensal') detalhes[nome] = ['Campo desconhecido.']
  }
  const valores = url.searchParams.getAll('aporte_mensal')
  if (valores.length > 1) detalhes.aporte_mensal = ['Informe o parâmetro uma única vez.']
  else if (valores.length === 1) {
    const lido = validar({ aporte_mensal: valores[0] }, [
      {
        campo: 'aporte_mensal',
        tipo: 'numero',
        obrigatorio: true,
        min: 0,
        max: 9999999,
        casas: 2,
        mensagem: 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.',
      },
    ])
    if (lido.detalhes.aporte_mensal) detalhes.aporte_mensal = lido.detalhes.aporte_mensal
    else if (Object.keys(detalhes).length === 0) return { aporte: lido.dados.aporte_mensal }
  }
  return Object.keys(detalhes).length > 0 ? { detalhes } : { aporte: undefined }
}

// O handler do /resultado com uma fixture base (sem aporte informado). Com aporte, devolve a fixture de aporte que
// alcança (>= 1.500) ou a que não alcança. Ordem, como no backend: token (401) -> dono da simulação (404) -> parâmetros (422).
function handlerDoResultado(base) {
  return http.get(CAMINHO, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    if (!obterSimulacao(usuario, params.id)) return simulacaoAusente(params.id)

    const { aporte, detalhes } = lerAporte(new URL(request.url))
    if (detalhes) return dadosInvalidos(detalhes)

    if (aporte === undefined) return HttpResponse.json(base)
    return HttpResponse.json(aporte >= APORTE_QUE_ALCANCA ? resultadoAporte : resultadoAporteInsuficiente)
  })
}

export const handlersResultado = [handlerDoResultado(resultado)]

// Atalhos de teste: cada um devolve um handler que sobrescreve o resultado (servidor.use(...)), com as MESMAS regras de
// acesso e de parâmetros do handler padrão (só muda a fixture devolvida sem aporte).
export const resultadoSemOpcoes = () => handlerDoResultado(resultadoSemOpcoesJson)
export const resultadoTresOpcoes = () => handlerDoResultado(resultadoTresOpcoesJson)
export const resultadoFundoVence = () => handlerDoResultado(resultadoFundoVenceJson)

// O backend com defeito (5xx): o resultado não carrega e a tela mostra o erro com "Tentar de novo".
export const resultadoIndisponivel = () => http.get(CAMINHO, () => respostaErro(503, 'Serviço indisponível'))

// As fixtures também ficam à mão dos testes (para conferir o que aparece na tela contra o que a API traz).
export const FIXTURES_DE_RESULTADO = {
  padrao: resultado,
  aporteQueAlcanca: resultadoAporte,
  aporteInsuficiente: resultadoAporteInsuficiente,
  semOpcoes: resultadoSemOpcoesJson,
  tresOpcoes: resultadoTresOpcoesJson,
  fundoVence: resultadoFundoVenceJson,
}
