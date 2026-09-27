import { waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ehErroApi } from '../api/erros.js'
import { criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { FIXTURES_DE_PARCELAS } from '../mocks/handlers/parcelas.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { chavesSimulacoes } from './chavesSimulacoes.js'
import { useParcelas } from './useParcelas.js'

const BASE = 'http://localhost:5000/api'

let ana
let token
let cenario
let consultas

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  token = tokenDe(ana)
  cenario = semearCenarioPadrao(ana.id)
  consultas = []
  servidor.events.on('request:start', ({ request }) => consultas.push(new URL(request.url)))
})

afterEach(() => servidor.events.removeAllListeners())

const producao = () => criarQueryClient({ retryDelay: 0 }) // a política de repetição de PRODUÇÃO (só o atraso é zerado)
const chamadasAsParcelas = () => consultas.filter((u) => u.pathname.endsWith('/parcelas'))
const sim = () => cenario.simulacao.id

describe('useParcelas', () => {
  it('carrega a tabela da opção na chave normalizada (ids como texto ou número)', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => useParcelas(String(sim()), String(cenario.financiamentos[0].id)), { token })
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(FIXTURES_DE_PARCELAS.price)
    expect(queryClient.getQueryData(chavesSimulacoes.parcelas(sim(), cenario.financiamentos[0].id))).toEqual(result.current.data)
  })

  it('opções diferentes têm caches SEPARADOS (Price e SAC)', async () => {
    const queryClient = producao()
    const a = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[0].id), { token, queryClient })
    const b = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[1].id), { token, queryClient })
    await waitFor(() => expect(a.result.current.isSuccess && b.result.current.isSuccess).toBe(true))
    expect(a.result.current.data).toEqual(FIXTURES_DE_PARCELAS.price)
    expect(b.result.current.data).toEqual(FIXTURES_DE_PARCELAS.sac)
    expect(chamadasAsParcelas()).toHaveLength(2)
  })

  it('a segunda montagem usa o cache (30 s): NÃO refaz a chamada (controle: sem cache faz)', async () => {
    const queryClient = producao()
    const a = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[0].id), { token, queryClient })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    a.unmount()
    const b = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[0].id), { token, queryClient })
    expect(b.result.current.isSuccess).toBe(true)
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(chamadasAsParcelas()).toHaveLength(1)

    b.unmount()
    queryClient.removeQueries({ queryKey: chavesSimulacoes.parcelas(sim(), cenario.financiamentos[0].id) })
    const c = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[0].id), { token, queryClient })
    await waitFor(() => expect(c.result.current.isSuccess).toBe(true))
    expect(chamadasAsParcelas()).toHaveLength(2)
  })

  it('o 404 NÃO é repetido (uma só chamada) e é o mesmo para a opção de outra simulação', async () => {
    const outra = criarSimulacao(ana.id)
    const { result } = renderizarHookComAuth(() => useParcelas(outra.id, cenario.financiamentos[0].id), { token, queryClient: producao() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(ehErroApi(result.current.error)).toBe(true)
    expect(result.current.error.status).toBe(404)
    expect(result.current.error.erro).toBe('Opção de financiamento não encontrada')
    expect(chamadasAsParcelas()).toHaveLength(1)
  })

  it('a política de produção repete UMA vez o 503', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/:id/financiamentos/:fid/parcelas`, () => respostaErro(503, 'Serviço indisponível')))
    const { result } = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[0].id), { token, queryClient: producao() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(chamadasAsParcelas()).toHaveLength(2)
  })

  it.each([
    [undefined, 1],
    [1, undefined],
    [null, 1],
    [1, null],
    ['', 1],
    [1, ''],
  ])('sem um dos ids (%j, %j) não busca nada', async (simulacaoId, fid) => {
    const { result } = renderizarHookComAuth(() => useParcelas(simulacaoId, fid), { token })
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(chamadasAsParcelas()).toHaveLength(0)
  })

  it('cancela a requisição ao desmontar (o signal chega ao fetch)', async () => {
    let abortada = null
    servidor.use(
      http.get(`${BASE}/simulacoes/:id/financiamentos/:fid/parcelas`, async ({ request }) => {
        await delay(150)
        abortada = request.signal.aborted
        return HttpResponse.json(FIXTURES_DE_PARCELAS.price)
      }),
    )
    const { unmount } = renderizarHookComAuth(() => useParcelas(sim(), cenario.financiamentos[0].id), { token })
    await new Promise((resolver) => setTimeout(resolver, 30))
    unmount()
    await new Promise((resolver) => setTimeout(resolver, 250))
    expect(abortada).toBe(true)
  })
})
