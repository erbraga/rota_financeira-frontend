// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { FIXTURES_DE_PARCELAS, parcelasIndisponivel } from '../mocks/handlers/parcelas.js'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao } from './api.js'
import { ehErroApi, ehErroRede } from './erros.js'
import { obterParcelas } from './parcelas.js'

const BASE = 'http://localhost:5000/api'

async function capturar(promessa) {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error('Era esperado um erro.')
}

let ana
let bia
let cenario
let consultas
const aoExpirar = vi.fn()

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  cenario = semearCenarioPadrao(ana.id)
  aoExpirar.mockReset()
  configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
  consultas = []
  servidor.events.on('request:start', ({ request }) => consultas.push(new URL(request.url)))
})

afterEach(() => {
  servidor.events.removeAllListeners()
  configurarSessao({})
})

const sim = () => cenario.simulacao.id

describe('obterParcelas', () => {
  it('devolve { financiamento, parcelas, totais } exatamente como o backend (Price e SAC), sem recalcular', async () => {
    expect(await obterParcelas(sim(), cenario.financiamentos[0].id)).toEqual(FIXTURES_DE_PARCELAS.price)
    expect(await obterParcelas(sim(), cenario.financiamentos[1].id)).toEqual(FIXTURES_DE_PARCELAS.sac)
  })

  it('chama o caminho da opção, sem parâmetro de consulta', async () => {
    await obterParcelas(sim(), cenario.financiamentos[0].id)
    expect(consultas[0].pathname).toBe(`/api/simulacoes/${sim()}/financiamentos/${cenario.financiamentos[0].id}/parcelas`)
    expect(consultas[0].search).toBe('')
  })

  it('os ids da rota (texto) e os da resposta (número) funcionam do mesmo jeito', async () => {
    const texto = await obterParcelas(String(sim()), String(cenario.financiamentos[0].id))
    expect(texto).toEqual(FIXTURES_DE_PARCELAS.price)
  })

  it('o 401 avisa a sessão (uma vez); os dois 404 não avisam (controle)', async () => {
    configurarSessao({ obterToken: () => 'token-invalido', aoExpirar })
    expect((await capturar(obterParcelas(sim(), cenario.financiamentos[0].id))).status).toBe(401)
    expect(aoExpirar).toHaveBeenCalledTimes(1)

    aoExpirar.mockReset()
    configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
    await capturar(obterParcelas(999999, 1))
    await capturar(obterParcelas(sim(), 999999))
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('simulação inexistente e de OUTRA pessoa dão o MESMO 404', async () => {
    const dela = criarSimulacao(bia.id)
    const alheia = await capturar(obterParcelas(dela.id, cenario.financiamentos[0].id))
    const inexistente = await capturar(obterParcelas(999999, cenario.financiamentos[0].id))
    expect(ehErroApi(alheia)).toBe(true)
    expect(alheia.status).toBe(404)
    expect(alheia.erro).toBe('Simulação não encontrada')
    expect(inexistente.erro).toBe(alheia.erro)
  })

  it('opção inexistente e opção de OUTRA simulação dão o MESMO 404, com a mensagem real da opção', async () => {
    const outra = criarSimulacao(ana.id)
    const inexistente = await capturar(obterParcelas(sim(), 999999))
    const deOutra = await capturar(obterParcelas(outra.id, cenario.financiamentos[0].id))
    expect(inexistente.status).toBe(404)
    expect(inexistente.erro).toBe('Opção de financiamento não encontrada')
    expect(deOutra.status).toBe(404)
    expect(deOutra.erro).toBe(inexistente.erro)
  })

  it('id não numérico: "Recurso não encontrado"', async () => {
    expect((await capturar(obterParcelas('abc', 1))).erro).toBe('Recurso não encontrado')
    expect((await capturar(obterParcelas(sim(), 'abc'))).erro).toBe('Recurso não encontrado')
  })

  it('503 e falha de rede sobem como ErroApi e ErroRede', async () => {
    servidor.use(parcelasIndisponivel())
    expect((await capturar(obterParcelas(sim(), cenario.financiamentos[0].id))).status).toBe(503)
    servidor.use(http.get(`${BASE}/simulacoes/${sim()}/financiamentos/${cenario.financiamentos[0].id}/parcelas`, () => HttpResponse.error()))
    expect(ehErroRede(await capturar(obterParcelas(sim(), cenario.financiamentos[0].id)))).toBe(true)
  })

  it('o signal cancela a chamada sem virar erro de API', async () => {
    const controle = new AbortController()
    controle.abort()
    const erro = await capturar(obterParcelas(sim(), cenario.financiamentos[0].id, { signal: controle.signal }))
    expect(ehErroApi(erro)).toBe(false)
    expect(erro.name).toBe('AbortError')
  })
})
