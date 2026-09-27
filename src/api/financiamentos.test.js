// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao } from './api.js'
import { ehErroApi, ehErroRede } from './erros.js'
import {
  atualizarFinanciamento,
  criarFinanciamento as criarOpcao,
  excluirFinanciamento,
  listarFinanciamentos,
} from './financiamentos.js'

const BASE = 'http://localhost:5000/api'
const CORPO = { nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'PRICE', valor_entrada: 10000 }

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
const aoExpirar = vi.fn()

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  sim = criarSimulacao(ana.id, { valor_veiculo: 95000 })
  aoExpirar.mockReset()
  configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
})

afterEach(() => configurarSessao({}))

describe('listarFinanciamentos', () => {
  it('devolve { itens, total } em ordem de criação, só as da simulação', async () => {
    criarFinanciamento(sim.id, { nome: 'Primeira' })
    criarFinanciamento(criarSimulacao(ana.id).id, { nome: 'De outra simulação' })
    criarFinanciamento(sim.id, { nome: 'Segunda' })
    const r = await listarFinanciamentos(sim.id)
    expect(r.total).toBe(2)
    expect(r.itens.map((f) => f.nome)).toEqual(['Primeira', 'Segunda'])
    expect(Object.keys(r.itens[0]).sort()).toEqual(['id', 'nome', 'prazo_meses', 'sistema_amortizacao', 'taxa_juros_mensal', 'valor_entrada'])
  })

  it('lista vazia no mesmo envelope', async () => {
    expect(await listarFinanciamentos(sim.id)).toEqual({ itens: [], total: 0 })
  })

  it('a simulação de outra pessoa e a inexistente dão o MESMO 404 (não vaza existência)', async () => {
    const dela = criarSimulacao(bia.id)
    const alheia = await capturar(listarFinanciamentos(dela.id))
    const inexistente = await capturar(listarFinanciamentos(999))
    expect(ehErroApi(alheia)).toBe(true)
    expect(alheia.status).toBe(404)
    expect(alheia.erro).toBe('Simulação não encontrada')
    expect(inexistente.erro).toBe(alheia.erro)
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('o signal cancela a chamada sem virar erro de API', async () => {
    const controle = new AbortController()
    controle.abort()
    const erro = await capturar(listarFinanciamentos(sim.id, { signal: controle.signal }))
    expect(ehErroApi(erro)).toBe(false)
    expect(erro.name).toBe('AbortError')
  })
})

describe('criarFinanciamento', () => {
  it('devolve a opção criada (201) e envia o corpo EXATAMENTE como recebeu', async () => {
    let enviado
    servidor.use(
      http.post(`${BASE}/simulacoes/${sim.id}/financiamentos`, async ({ request }) => {
        enviado = await request.json()
        return HttpResponse.json({ ...enviado, id: 7 }, { status: 201 })
      }),
    )
    const nova = await criarOpcao(sim.id, CORPO)
    expect(enviado).toEqual(CORPO)
    expect(nova.id).toBe(7)
  })

  it('com o backend simulado: 201, sistema em maiúsculas e a opção aparece na lista', async () => {
    const nova = await criarOpcao(sim.id, { ...CORPO, sistema_amortizacao: 'sac' })
    expect(nova).toMatchObject({ nome: 'Banco A', sistema_amortizacao: 'SAC', taxa_juros_mensal: 1.5, prazo_meses: 48, valor_entrada: 10000 })
    expect((await listarFinanciamentos(sim.id)).itens.map((f) => f.id)).toEqual([nova.id])
  })

  it('422 traz os detalhes por campo, com a mensagem real', async () => {
    const erro = await capturar(criarOpcao(sim.id, { ...CORPO, prazo_meses: 73 }))
    expect(erro.status).toBe(422)
    expect(erro.detalhes).toEqual({ prazo_meses: ['O prazo (em meses) deve estar entre 1 e 72.'] })
  })

  it('a entrada igual ao veículo é recusada com a mensagem real', async () => {
    const erro = await capturar(criarOpcao(sim.id, { ...CORPO, valor_entrada: 95000 }))
    expect(erro.status).toBe(422)
    expect(erro.detalhes.valor_entrada).toEqual([
      'A entrada deve ser menor que o valor do veículo (R$ 95.000,00); com a entrada igual ao valor não há o que financiar.',
    ])
  })

  it('a 4ª opção dá 409 sem detalhes (controle: a 3ª é aceita)', async () => {
    criarFinanciamento(sim.id)
    criarFinanciamento(sim.id)
    expect((await criarOpcao(sim.id, CORPO)).id).toBeDefined()
    const erro = await capturar(criarOpcao(sim.id, CORPO))
    expect(erro.status).toBe(409)
    expect(erro.erro).toBe('Uma simulação aceita no máximo 3 opções de financiamento')
    expect(erro.detalhes).toBeUndefined()
  })

  it('404 na simulação de outra pessoa', async () => {
    const dela = criarSimulacao(bia.id)
    expect((await capturar(criarOpcao(dela.id, CORPO))).status).toBe(404)
  })
})

describe('atualizarFinanciamento', () => {
  it('substitui tudo: envia o corpo completo e devolve a opção atualizada', async () => {
    const f = criarFinanciamento(sim.id, { nome: 'Antiga' })
    const r = await atualizarFinanciamento(sim.id, f.id, { ...CORPO, nome: 'Nova' })
    expect(r).toEqual({ id: f.id, ...CORPO, nome: 'Nova' })
  })

  it('o corpo parcial é recusado (422), pois o PUT substitui tudo', async () => {
    const f = criarFinanciamento(sim.id)
    const erro = await capturar(atualizarFinanciamento(sim.id, f.id, { nome: 'Só o nome' }))
    expect(erro.status).toBe(422)
    expect(Object.keys(erro.detalhes).sort()).toEqual(['prazo_meses', 'sistema_amortizacao', 'taxa_juros_mensal'])
  })

  it('404 da opção com a mensagem real; opção de outra simulação também dá 404', async () => {
    const outra = criarFinanciamento(criarSimulacao(ana.id).id)
    const inexistente = await capturar(atualizarFinanciamento(sim.id, 999, CORPO))
    const deOutra = await capturar(atualizarFinanciamento(sim.id, outra.id, CORPO))
    expect(inexistente.status).toBe(404)
    expect(inexistente.erro).toBe('Opção de financiamento não encontrada')
    expect(deOutra.erro).toBe(inexistente.erro)
  })
})

describe('excluirFinanciamento', () => {
  it('204 sem corpo: devolve null, sem tentar ler JSON, e a opção sai da lista', async () => {
    const f = criarFinanciamento(sim.id)
    expect(await excluirFinanciamento(sim.id, f.id)).toBeNull()
    expect((await listarFinanciamentos(sim.id)).total).toBe(0)
  })

  it('excluir de novo dá 404 "Opção de financiamento não encontrada"', async () => {
    const f = criarFinanciamento(sim.id)
    await excluirFinanciamento(sim.id, f.id)
    const erro = await capturar(excluirFinanciamento(sim.id, f.id))
    expect(erro.status).toBe(404)
    expect(erro.erro).toBe('Opção de financiamento não encontrada')
  })
})

describe('sessão e rede', () => {
  it('o 401 avisa a sessão (uma vez); 404, 409 e 422 não avisam (controle)', async () => {
    configurarSessao({ obterToken: () => 'token-invalido', aoExpirar })
    expect((await capturar(listarFinanciamentos(sim.id))).status).toBe(401)
    expect(aoExpirar).toHaveBeenCalledTimes(1)

    aoExpirar.mockReset()
    configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
    await capturar(listarFinanciamentos(999))
    await capturar(criarOpcao(sim.id, {}))
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('falha de rede vira ErroRede', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/financiamentos`, () => HttpResponse.error()))
    expect(ehErroRede(await capturar(listarFinanciamentos(sim.id)))).toBe(true)
  })
})
