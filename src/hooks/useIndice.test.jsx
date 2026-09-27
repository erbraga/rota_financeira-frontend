import { useQuery } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { obterIndice } from '../api/indices.js'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { INDICES } from '../mocks/handlers/indices.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { useIndice } from './useIndice.js'

const BASE = 'http://localhost:5000/api'

let token

beforeEach(() => {
  servidor.use(...handlers)
  token = tokenDe(criarUsuario({ email: 'ana@example.com' }))
})

// Conta as chamadas (e guarda o período pedido) de qualquer índice.
function contar(resposta = () => HttpResponse.json(INDICES.cdi)) {
  const chamadas = { n: 0, periodos: [] }
  servidor.use(
    http.get(`${BASE}/indices/:indice`, ({ request }) => {
      chamadas.n += 1
      chamadas.periodos.push(new URL(request.url).searchParams.get('periodo'))
      return resposta()
    }),
  )
  return chamadas
}

describe('useIndice', () => {
  it.each(['cdi', 'ipca'])('carrega %s com a sugestão', async (nome) => {
    const { result } = renderizarHookComAuth(() => useIndice(nome), { token })
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data.indice).toBe(nome.toUpperCase())
    expect(result.current.data.sugestao).toEqual(INDICES[nome].sugestao)
  })

  it('pede periodo=1m por padrão (só a sugestão interessa) e aceita outro período', async () => {
    const chamadas = contar()
    const a = renderizarHookComAuth(() => useIndice('cdi'), { token })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    const b = renderizarHookComAuth(() => useIndice('cdi', { periodo: '12m' }), { token })
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true))
    expect(chamadas.periodos).toEqual(['1m', '12m'])
  })

  it('guarda em ["indices", índice, período]: índices e períodos diferentes têm caches separados', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => useIndice('ipca'), { token })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(['indices', 'ipca', '1m'])).toMatchObject({ indice: 'IPCA' })
    expect(queryClient.getQueryData(['indices', 'cdi', '1m'])).toBeUndefined()
    expect(queryClient.getQueryData(['indices', 'ipca', '12m'])).toBeUndefined()
  })

  it('a segunda montagem usa o cache: NÃO refaz a chamada (staleTime de 30 min)', async () => {
    const chamadas = contar()
    const queryClient = criarQueryClient({ retryDelay: 0, staleTime: 0 }) // o cliente de teste tem staleTime 0: só o do hook segura o cache
    const a = renderizarHookComAuth(() => useIndice('cdi'), { token, queryClient })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    a.unmount()

    const b = renderizarHookComAuth(() => useIndice('cdi'), { token, queryClient })
    expect(b.result.current.isSuccess).toBe(true) // já com o dado, sem passar por "carregando"
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(chamadas.n).toBe(1)
  })

  it('controle: com staleTime 0 a segunda montagem refaz a chamada (o teste acima pode falhar)', async () => {
    const chamadas = contar()
    const queryClient = criarQueryClient({ retryDelay: 0 })
    const useSemCache = () =>
      useQuery({ queryKey: ['indices', 'cdi', '1m'], queryFn: () => obterIndice('cdi', { periodo: '1m' }), staleTime: 0 })
    const a = renderizarHookComAuth(useSemCache, { token, queryClient })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    a.unmount()
    const b = renderizarHookComAuth(useSemCache, { token, queryClient })
    await waitFor(() => expect(chamadas.n).toBe(2))
    await waitFor(() => expect(b.result.current.isFetching).toBe(false))
  })

  it('a política de produção repete UMA vez o 503', async () => {
    const chamadas = contar(() => respostaErro(503, 'Dados do Banco Central indisponíveis no momento'))
    const { result } = renderizarHookComAuth(() => useIndice('cdi'), {
      token,
      queryClient: criarQueryClient({ retryDelay: 0 }),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.status).toBe(503)
    expect(chamadas.n).toBe(2)
  })

  it('o 404 NUNCA é repetido, mesmo com a política de produção', async () => {
    const chamadas = contar(() => respostaErro(404, 'Índice não encontrado'))
    const { result } = renderizarHookComAuth(() => useIndice('selic'), {
      token,
      queryClient: criarQueryClient({ retryDelay: 0 }),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.status).toBe(404)
    expect(chamadas.n).toBe(1)
  })

  it('cancela a requisição ao desmontar (o signal chega ao fetch)', async () => {
    let abortada = null
    servidor.use(
      http.get(`${BASE}/indices/cdi`, async ({ request }) => {
        await delay(150)
        abortada = request.signal.aborted
        return HttpResponse.json(INDICES.cdi)
      }),
    )
    const { unmount } = renderizarHookComAuth(() => useIndice('cdi'), { token })
    await new Promise((resolver) => setTimeout(resolver, 30))
    unmount()
    await new Promise((resolver) => setTimeout(resolver, 250))
    expect(abortada).toBe(true)
  })
})
