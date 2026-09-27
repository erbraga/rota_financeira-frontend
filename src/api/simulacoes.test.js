// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao } from './api.js'
import { ehErroApi } from './erros.js'
import { atualizar, criar, excluir, listar, obter } from './simulacoes.js'

const BASE = 'http://localhost:5000/api'
const CORPO = {
  nome: 'Onix 2026',
  valor_veiculo: 95000,
  valor_entrada: 20000,
  taxa_ipca_projetada: 4.5,
  taxa_fundo_rendimento: 12,
  prazo_meses_fundo: 36,
}

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
const aoExpirar = vi.fn()

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  aoExpirar.mockReset()
  configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
})

afterEach(() => configurarSessao({}))

describe('listar', () => {
  it('devolve { itens, total } do mais recente ao mais antigo, só as da pessoa logada', async () => {
    criarSimulacao(ana.id, { nome: 'A1' })
    criarSimulacao(bia.id, { nome: 'B1' })
    criarSimulacao(ana.id, { nome: 'A2' })
    const r = await listar()
    expect(r.total).toBe(2)
    expect(r.itens.map((s) => s.nome)).toEqual(['A2', 'A1'])
  })

  it('lista vazia no mesmo envelope', async () => {
    expect(await listar()).toEqual({ itens: [], total: 0 })
  })
})

describe('obter', () => {
  it('devolve a simulação (sem as opções de financiamento)', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Onix' })
    criarFinanciamento(s.id)
    const r = await obter(s.id)
    expect(r).toMatchObject({ id: s.id, nome: 'Onix' })
    expect(r.financiamentos).toBeUndefined()
    expect(r.usuario_id).toBeUndefined()
  })

  it('a de outra pessoa e a inexistente dão o MESMO 404 (não vaza existência)', async () => {
    const dela = criarSimulacao(bia.id)
    const alheia = await capturar(obter(dela.id))
    const inexistente = await capturar(obter(999))
    expect(ehErroApi(alheia)).toBe(true)
    expect(alheia.status).toBe(404)
    expect(alheia.erro).toBe('Simulação não encontrada')
    expect(inexistente.erro).toBe(alheia.erro)
    expect(aoExpirar).not.toHaveBeenCalled()
  })
})

describe('criar', () => {
  it('devolve a simulação criada (201) e envia o corpo EXATAMENTE como recebeu', async () => {
    let enviado
    servidor.use(
      http.post(`${BASE}/simulacoes`, async ({ request }) => {
        enviado = await request.json()
        return HttpResponse.json({ ...enviado, id: 1, criado_em: 'x' }, { status: 201 })
      }),
    )
    const nova = await criar(CORPO)
    expect(enviado).toEqual(CORPO)
    expect(nova.id).toBe(1)
  })

  it('422 traz os detalhes por campo, com a mensagem real', async () => {
    const erro = await capturar(criar({ ...CORPO, prazo_meses_fundo: 61 }))
    expect(erro.status).toBe(422)
    expect(erro.detalhes).toEqual({ prazo_meses_fundo: ['O prazo do fundo (em meses) deve estar entre 1 e 60.'] })
  })

  it('o prazo enviado como TEXTO é recusado pelo backend (por isso a SPA envia número)', async () => {
    const erro = await capturar(criar({ ...CORPO, prazo_meses_fundo: '36' }))
    expect(erro.detalhes.prazo_meses_fundo).toEqual(['Número inteiro inválido.'])
    // Controle: o mesmo valor como número passa.
    expect((await criar({ ...CORPO, prazo_meses_fundo: 36 })).prazo_meses_fundo).toBe(36)
  })
})

describe('atualizar', () => {
  it('substitui tudo: envia o corpo completo e devolve a simulação atualizada', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Antiga' })
    const r = await atualizar(s.id, { ...CORPO, nome: 'Nova' })
    expect(r).toMatchObject({ id: s.id, nome: 'Nova', valor_veiculo: 95000 })
  })

  it('o corpo parcial é recusado (422), pois o PUT substitui tudo', async () => {
    const s = criarSimulacao(ana.id)
    const erro = await capturar(atualizar(s.id, { nome: 'Só o nome' }))
    expect(erro.status).toBe(422)
    expect(Object.keys(erro.detalhes)).toContain('valor_veiculo')
  })

  it('404 para simulação de outra pessoa', async () => {
    const dela = criarSimulacao(bia.id)
    expect((await capturar(atualizar(dela.id, CORPO))).status).toBe(404)
  })
})

describe('excluir', () => {
  it('204 sem corpo: devolve null, sem tentar ler JSON', async () => {
    const s = criarSimulacao(ana.id)
    expect(await excluir(s.id)).toBeNull()
    expect((await capturar(obter(s.id))).status).toBe(404)
  })

  it('excluir de novo dá 404', async () => {
    const s = criarSimulacao(ana.id)
    await excluir(s.id)
    expect((await capturar(excluir(s.id))).status).toBe(404)
  })

  it('não apaga a simulação de outra pessoa (404) e ela continua existindo', async () => {
    const dela = criarSimulacao(bia.id)
    expect((await capturar(excluir(dela.id))).status).toBe(404)
    configurarSessao({ obterToken: () => tokenDe(bia), aoExpirar })
    expect((await obter(dela.id)).id).toBe(dela.id)
  })
})

describe('401', () => {
  it('sem sessão válida chama o aoExpirar uma vez (controle: o 404 não chama)', async () => {
    configurarSessao({ obterToken: () => 'lixo', aoExpirar })
    const erro = await capturar(listar())
    expect(erro.status).toBe(401)
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })
})
