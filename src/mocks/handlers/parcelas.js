// /parcelas NÃO calcula: devolve as fixtures capturadas do backend real (a da Price ou a da SAC, conforme o sistema da opção).
// As regras de acesso seguem o backend; parâmetros de consulta são IGNORADOS (o backend real responde 200 a `?foo=1`).
import { http, HttpResponse } from 'msw'
import { lerConfig } from '../../config.js'
import { banco } from '../banco.js'
import { financiamentoAusente, respostaErro, simulacaoAusente } from '../erros.js'
import parcelasCentavosJson from '../fixtures/parcelas-centavos.json'
import parcelasPrice from '../fixtures/parcelas-price.json'
import parcelasQuitacaoAntecipadaJson from '../fixtures/parcelas-quitacao-antecipada.json'
import parcelasSac from '../fixtures/parcelas-sac.json'
import parcelasSemJurosJson from '../fixtures/parcelas-sem-juros.json'
import parcelasUmMesJson from '../fixtures/parcelas-um-mes.json'
import { autenticar } from '../sessao.js'
import { lerId } from '../validacao.js'
import { obterSimulacao } from './simulacoes.js'

const { urlApi } = lerConfig()
const CAMINHO = `${urlApi}/simulacoes/:id/financiamentos/:fid/parcelas`

// O handler das parcelas. `escolher(financiamento)` diz qual fixture devolver (por padrão, a do sistema da opção).
// Ordem, como no backend: token (401) -> dono da simulação (404) -> opção da simulação (404).
function handlerDasParcelas(escolher) {
  return http.get(CAMINHO, ({ request, params }) => {
    const { usuario, resposta } = autenticar(request)
    if (resposta) return resposta
    const simulacao = obterSimulacao(usuario, params.id)
    if (!simulacao) return simulacaoAusente(params.id)

    const fid = lerId(params.fid)
    const financiamento = banco.financiamentos.find((f) => f.id === fid && f.simulacao_id === simulacao.id)
    if (!financiamento) return financiamentoAusente(params.fid)

    return HttpResponse.json(escolher(financiamento))
  })
}

export const handlersParcelas = [
  handlerDasParcelas((financiamento) => (financiamento.sistema_amortizacao === 'SAC' ? parcelasSac : parcelasPrice)),
]

// Atalhos de teste: cada um devolve um handler que sobrescreve as parcelas (servidor.use(...)) com a fixture pedida, mantendo
// as MESMAS regras de acesso do handler padrão (só muda o que é devolvido para uma opção que existe e é da pessoa).
export const parcelasSemJuros = () => handlerDasParcelas(() => parcelasSemJurosJson)
export const parcelasDeUmMes = () => handlerDasParcelas(() => parcelasUmMesJson)
export const parcelasDeCentavos = () => handlerDasParcelas(() => parcelasCentavosJson)
export const parcelasQuitacaoAntecipada = () => handlerDasParcelas(() => parcelasQuitacaoAntecipadaJson)

// O backend com defeito (5xx): a tabela não carrega e a tela mostra o erro com "Tentar de novo".
export const parcelasIndisponivel = () => http.get(CAMINHO, () => respostaErro(503, 'Serviço indisponível'))

// As fixtures também ficam à mão dos testes (para conferir o que aparece na tela contra o que a API traz).
export const FIXTURES_DE_PARCELAS = {
  price: parcelasPrice,
  sac: parcelasSac,
  semJuros: parcelasSemJurosJson,
  umMes: parcelasUmMesJson,
  centavos: parcelasCentavosJson,
  quitacaoAntecipada: parcelasQuitacaoAntecipadaJson,
}
