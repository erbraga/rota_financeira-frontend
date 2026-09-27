import { waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { ehErroApi } from '../api/erros.js'
import { criarUsuario, criarSimulacao, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { chavesSimulacoes } from './chavesSimulacoes.js'
import { useSimulacao } from './useSimulacao.js'
import { useSimulacoes } from './useSimulacoes.js'

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

// Conta quantas vezes uma rota foi chamada (independente da resposta).
function contar(metodo, caminho, resposta) {
  const chamadas = { n: 0 }
  servidor.use(
    http[metodo](`${BASE}${caminho}`, () => {
      chamadas.n += 1
      return resposta()
    }),
  )
  return chamadas
}

describe('chavesSimulacoes', () => {
  it('a chave do detalhe normaliza o id (texto da rota e número da resposta dão a mesma chave)', () => {
    expect(chavesSimulacoes.detalhe(7)).toEqual(chavesSimulacoes.detalhe('7'))
    expect(chavesSimulacoes.detalhe(7)).not.toEqual(chavesSimulacoes.detalhe(8))
    expect(chavesSimulacoes.lista).toEqual(['simulacoes'])
  })

  it('opções e resultado começam pela chave do detalhe (excluir a simulação remove todas) e normalizam o id', () => {
    expect(chavesSimulacoes.financiamentos(7)).toEqual(['simulacoes', '7', 'financiamentos'])
    expect(chavesSimulacoes.financiamentos('7')).toEqual(chavesSimulacoes.financiamentos(7))
    expect(chavesSimulacoes.resultado(7)).toEqual(['simulacoes', '7', 'resultado'])
    expect(chavesSimulacoes.financiamentos(7)).not.toEqual(chavesSimulacoes.detalhe(7))
    expect(chavesSimulacoes.financiamentos(7).slice(0, 2)).toEqual(chavesSimulacoes.detalhe(7))
  })
})

describe('useSimulacoes', () => {
  it('carrega a lista da pessoa logada, do mais recente ao mais antigo', async () => {
    criarSimulacao(ana.id, { nome: 'A1' })
    criarSimulacao(bia.id, { nome: 'B1' })
    criarSimulacao(ana.id, { nome: 'A2' })
    const { result } = renderizarHookComAuth(() => useSimulacoes(), { token })
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data.itens.map((s) => s.nome)).toEqual(['A2', 'A1'])
    expect(result.current.data.total).toBe(2)
  })

  it('erro 503: fica em erro (isError) com o ErroApi', async () => {
    servidor.use(http.get(`${BASE}/simulacoes`, () => respostaErro(503, 'Serviço indisponível')))
    const { result } = renderizarHookComAuth(() => useSimulacoes(), { token })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(ehErroApi(result.current.error)).toBe(true)
    expect(result.current.error.status).toBe(503)
  })

  it('a política de produção repete UMA vez o 503 (o 404 não é repetido: ver o teste do useSimulacao)', async () => {
    const cliente = () => criarQueryClient({ retryDelay: 0 })

    const de503 = contar('get', '/simulacoes', () => respostaErro(503, 'Serviço indisponível'))
    const a = renderizarHookComAuth(() => useSimulacoes(), { token, queryClient: cliente() })
    await waitFor(() => expect(a.result.current.isError).toBe(true))
    expect(de503.n).toBe(2)
  })
})

describe('useSimulacao', () => {
  it('carrega o detalhe pelo id (texto ou número) na chave normalizada', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Onix' })
    const { result, queryClient } = renderizarHookComAuth(() => useSimulacao(String(s.id)), { token })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: s.id, nome: 'Onix' })
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(s.id))).toMatchObject({ nome: 'Onix' })
  })

  it('o 404 NÃO é repetido (uma só chamada), mesmo com a política de produção', async () => {
    const chamadas = contar('get', '/simulacoes/999', () => respostaErro(404, 'Simulação não encontrada'))
    const { result } = renderizarHookComAuth(() => useSimulacao('999'), {
      token,
      queryClient: criarQueryClient({ retryDelay: 0 }),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.status).toBe(404)
    expect(chamadas.n).toBe(1)
  })

  it('a simulação de outra pessoa dá o mesmo 404 da inexistente', async () => {
    const dela = criarSimulacao(bia.id)
    const { result } = renderizarHookComAuth(() => useSimulacao(dela.id), { token })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.erro).toBe('Simulação não encontrada')
  })

  it.each([undefined, null, ''])('sem id (%j) não busca nada', async (id) => {
    const chamadas = contar('get', '/simulacoes/:id', () => HttpResponse.json({}))
    const { result } = renderizarHookComAuth(() => useSimulacao(id), { token })
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(chamadas.n).toBe(0)
  })

  it('cancela a requisição ao desmontar (o signal chega ao fetch)', async () => {
    const s = criarSimulacao(ana.id)
    let abortada = null
    servidor.use(
      http.get(`${BASE}/simulacoes/${s.id}`, async ({ request }) => {
        await delay(150)
        abortada = request.signal.aborted
        return HttpResponse.json({ id: s.id })
      }),
    )
    const { unmount } = renderizarHookComAuth(() => useSimulacao(s.id), { token })
    await new Promise((resolver) => setTimeout(resolver, 30))
    unmount()
    await new Promise((resolver) => setTimeout(resolver, 250))
    expect(abortada).toBe(true)
  })
})
