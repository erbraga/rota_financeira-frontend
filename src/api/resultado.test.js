// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarFinanciamento, criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { FIXTURES_DE_RESULTADO, resultadoIndisponivel } from '../mocks/handlers/resultado.js'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao } from './api.js'
import { ehErroApi, ehErroRede } from './erros.js'
import { obterResultado } from './resultado.js'

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
let sim
let consultas
const aoExpirar = vi.fn()

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  sim = semearCenarioPadrao(ana.id).simulacao
  aoExpirar.mockReset()
  configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
  consultas = []
  servidor.events.on('request:start', ({ request }) => consultas.push(new URL(request.url)))
})

afterEach(() => {
  servidor.events.removeAllListeners()
  configurarSessao({})
})

describe('obterResultado', () => {
  it('devolve o resultado completo, exatamente como o backend (nada é recalculado)', async () => {
    expect(await obterResultado(sim.id)).toEqual(FIXTURES_DE_RESULTADO.padrao)
  })

  it('sem aporte a consulta não tem parâmetro', async () => {
    await obterResultado(sim.id)
    expect(consultas[0].pathname).toBe(`/api/simulacoes/${sim.id}/resultado`)
    expect(consultas[0].search).toBe('')
  })

  it.each([
    [1500, '1500'],
    [1500.5, '1500.5'],
    [0.01, '0.01'],
    [9999999, '9999999'],
  ])('o aporte %s vai como número com PONTO decimal (aporte_mensal=%s), nunca com vírgula', async (aporte, esperado) => {
    await obterResultado(sim.id, { aporteMensal: aporte })
    expect(consultas[0].searchParams.getAll('aporte_mensal')).toEqual([esperado])
    expect(consultas[0].search).not.toContain(',')
  })

  it('o aporte 0 vai (0 é um aporte válido, não "sem aporte"); controle: null e undefined não vão', async () => {
    await obterResultado(sim.id, { aporteMensal: 0 })
    await obterResultado(sim.id, { aporteMensal: null })
    await obterResultado(sim.id, { aporteMensal: undefined })
    expect(consultas.map((u) => u.search)).toEqual(['?aporte_mensal=0', '', ''])
  })

  it('com aporte que alcança a meta e com um que não alcança devolve os resultados do modo aporte', async () => {
    const alcanca = await obterResultado(sim.id, { aporteMensal: 1500 })
    expect(alcanca.cenarios.fundo).toMatchObject({ alcanca_a_meta: true, mes_da_meta: 44, aporte_mensal: 1500 })
    const nao = await obterResultado(sim.id, { aporteMensal: 100 })
    expect(nao.cenarios.fundo).toMatchObject({ alcanca_a_meta: false, mes_da_meta: null, custo_total: null, preco_na_compra: null })
  })

  it('o 401 avisa a sessão (uma vez); 404 e 422 não avisam (controle)', async () => {
    configurarSessao({ obterToken: () => 'token-invalido', aoExpirar })
    expect((await capturar(obterResultado(sim.id))).status).toBe(401)
    expect(aoExpirar).toHaveBeenCalledTimes(1)

    aoExpirar.mockReset()
    configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
    await capturar(obterResultado(999999))
    await capturar(obterResultado(sim.id, { aporteMensal: -1 }))
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('a simulação de outra pessoa e a inexistente dão o MESMO 404 (não vaza existência)', async () => {
    const dela = criarSimulacao(bia.id)
    criarFinanciamento(dela.id)
    const alheia = await capturar(obterResultado(dela.id))
    const inexistente = await capturar(obterResultado(999999))
    expect(ehErroApi(alheia)).toBe(true)
    expect(alheia.status).toBe(404)
    expect(alheia.erro).toBe('Simulação não encontrada')
    expect(inexistente.erro).toBe(alheia.erro)
  })

  it('422 traz a chave aporte_mensal com a mensagem real', async () => {
    const erro = await capturar(obterResultado(sim.id, { aporteMensal: 10000000 }))
    expect(erro.status).toBe(422)
    expect(erro.detalhes).toEqual({ aporte_mensal: ['O aporte mensal deve estar entre 0,00 e 9.999.999,00.'] })
    const casas = await capturar(obterResultado(sim.id, { aporteMensal: 1500.505 }))
    expect(casas.detalhes).toEqual({ aporte_mensal: ['Use no máximo 2 casas decimais.'] })
  })

  it('503 e falha de rede sobem como ErroApi e ErroRede', async () => {
    servidor.use(resultadoIndisponivel())
    const erro = await capturar(obterResultado(sim.id))
    expect(erro.status).toBe(503)
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/resultado`, () => HttpResponse.error()))
    expect(ehErroRede(await capturar(obterResultado(sim.id)))).toBe(true)
  })

  it('o signal cancela a chamada sem virar erro de API', async () => {
    const controle = new AbortController()
    controle.abort()
    const erro = await capturar(obterResultado(sim.id, { signal: controle.signal }))
    expect(ehErroApi(erro)).toBe(false)
    expect(erro.name).toBe('AbortError')
  })
})
