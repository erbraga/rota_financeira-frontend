import { waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { ehErroApi } from '../api/erros.js'
import { criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { chavesSimulacoes } from './chavesSimulacoes.js'
import { useFinanciamentos } from './useFinanciamentos.js'
import { useSimulacao } from './useSimulacao.js'

const BASE = 'http://localhost:5000/api'

let ana
let bia
let token

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  bia = criarUsuario({ nome: 'Bia', email: 'bia@example.com' })
  token = tokenDe(ana)
})

function contar(caminho, resposta) {
  const chamadas = { n: 0 }
  servidor.use(
    http.get(`${BASE}${caminho}`, () => {
      chamadas.n += 1
      return resposta()
    }),
  )
  return chamadas
}

describe('useFinanciamentos', () => {
  it('carrega a lista na chave normalizada (id como texto ou número), em ordem de criação', async () => {
    const s = criarSimulacao(ana.id)
    criarFinanciamento(s.id, { nome: 'Primeira' })
    criarFinanciamento(s.id, { nome: 'Segunda' })
    const { result, queryClient } = renderizarHookComAuth(() => useFinanciamentos(String(s.id)), { token })
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data.itens.map((f) => f.nome)).toEqual(['Primeira', 'Segunda'])
    expect(result.current.data.total).toBe(2)
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(s.id))).toEqual(result.current.data)
  })

  it('o 404 da simulação de outra pessoa é o mesmo da inexistente, e NÃO é repetido (cache de produção)', async () => {
    const dela = criarSimulacao(bia.id)
    const chamadas = contar(`/simulacoes/${dela.id}/financiamentos`, () => respostaErro(404, 'Simulação não encontrada'))
    const { result } = renderizarHookComAuth(() => useFinanciamentos(dela.id), {
      token,
      queryClient: criarQueryClient({ retryDelay: 0 }),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(ehErroApi(result.current.error)).toBe(true)
    expect(result.current.error.status).toBe(404)
    expect(chamadas.n).toBe(1)
  })

  it('a política de produção repete UMA vez o 503', async () => {
    const s = criarSimulacao(ana.id)
    const chamadas = contar(`/simulacoes/${s.id}/financiamentos`, () => respostaErro(503, 'Serviço indisponível'))
    const { result } = renderizarHookComAuth(() => useFinanciamentos(s.id), {
      token,
      queryClient: criarQueryClient({ retryDelay: 0 }),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(chamadas.n).toBe(2)
  })

  it.each([undefined, null, ''])('sem id (%j) não busca nada', async (id) => {
    const chamadas = contar('/simulacoes/:id/financiamentos', () => HttpResponse.json({ itens: [], total: 0 }))
    const { result } = renderizarHookComAuth(() => useFinanciamentos(id), { token })
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(chamadas.n).toBe(0)
  })

  it('cancela a requisição ao desmontar (o signal chega ao fetch)', async () => {
    const s = criarSimulacao(ana.id)
    let abortada = null
    servidor.use(
      http.get(`${BASE}/simulacoes/${s.id}/financiamentos`, async ({ request }) => {
        await delay(150)
        abortada = request.signal.aborted
        return HttpResponse.json({ itens: [], total: 0 })
      }),
    )
    const { unmount } = renderizarHookComAuth(() => useFinanciamentos(s.id), { token })
    await new Promise((resolver) => setTimeout(resolver, 30))
    unmount()
    await new Promise((resolver) => setTimeout(resolver, 250))
    expect(abortada).toBe(true)
  })

  it('a lista das opções e o detalhe da simulação são caches SEPARADOS (uma chamada cada, sem refazer a outra)', async () => {
    const s = criarSimulacao(ana.id)
    criarFinanciamento(s.id)
    const opcoes = contar(`/simulacoes/${s.id}/financiamentos`, () => HttpResponse.json({ itens: [], total: 0 }))
    const detalhe = contar(`/simulacoes/${s.id}`, () => HttpResponse.json({ id: s.id, nome: 'X' }))
    const queryClient = criarQueryClient({ retry: false })
    const a = renderizarHookComAuth(() => useFinanciamentos(s.id), { token, queryClient })
    const b = renderizarHookComAuth(() => useSimulacao(s.id), { token, queryClient })
    await waitFor(() => expect(a.result.current.isSuccess && b.result.current.isSuccess).toBe(true))
    expect(opcoes.n).toBe(1)
    expect(detalhe.n).toBe(1)
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(s.id))).toEqual({ itens: [], total: 0 })
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(s.id))).toEqual({ id: s.id, nome: 'X' })
  })
})
