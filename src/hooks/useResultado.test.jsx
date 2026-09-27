import { act, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ehErroApi } from '../api/erros.js'
import { criarSimulacao, criarUsuario, semearCenarioPadrao, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { FIXTURES_DE_RESULTADO } from '../mocks/handlers/resultado.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { chavesSimulacoes } from './chavesSimulacoes.js'
import { useResultado } from './useResultado.js'

const BASE = 'http://localhost:5000/api'

let ana
let token
let sim
let consultas

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  token = tokenDe(ana)
  sim = semearCenarioPadrao(ana.id).simulacao
  consultas = []
  servidor.events.on('request:start', ({ request }) => consultas.push(new URL(request.url)))
})

const producao = () => criarQueryClient({ retryDelay: 0 }) // a política de repetição de PRODUÇÃO (só o atraso é zerado)
afterEach(() => servidor.events.removeAllListeners())

const chamadasAoResultado = () => consultas.filter((u) => u.pathname.endsWith('/resultado'))

describe('useResultado', () => {
  it('carrega o resultado padrão na chave normalizada (id como texto ou número)', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => useResultado(String(sim.id)), { token })
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.padrao)
    expect(queryClient.getQueryData(chavesSimulacoes.resultado(sim.id))).toEqual(result.current.data)
    expect(chamadasAoResultado()[0].search).toBe('')
  })

  it('com aporte: busca com o parâmetro e guarda em outra chave', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => useResultado(sim.id, { aporteMensal: 1500.5 }), { token })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(chamadasAoResultado()[0].searchParams.get('aporte_mensal')).toBe('1500.5')
    expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.aporteQueAlcanca)
    expect(queryClient.getQueryData(chavesSimulacoes.resultado(sim.id, 1500.5))).toBeDefined()
    expect(queryClient.getQueryData(chavesSimulacoes.resultado(sim.id))).toBeUndefined()
  })

  it('os caches do padrão e do com aporte são SEPARADOS: voltar ao padrão dentro de 30 s NÃO refaz a chamada', async () => {
    const queryClient = criarQueryClient({ retryDelay: 0 })
    let definir
    const { result } = renderizarHookComAuth(
      () => {
        const [aporte, setAporte] = useState(undefined)
        definir = setAporte
        return useResultado(sim.id, { aporteMensal: aporte })
      },
      { token, queryClient },
    )
    await waitFor(() => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true))
    expect(chamadasAoResultado()).toHaveLength(1)

    act(() => definir(1500))
    await waitFor(() => expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.aporteQueAlcanca))
    expect(chamadasAoResultado()).toHaveLength(2)

    act(() => definir(undefined))
    await waitFor(() => expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.padrao))
    expect(chamadasAoResultado()).toHaveLength(2) // veio do cache
  })

  it('controle: com o cache do padrão removido, voltar ao padrão refaz a chamada', async () => {
    const queryClient = criarQueryClient({ retryDelay: 0 })
    let definir
    const { result } = renderizarHookComAuth(
      () => {
        const [aporte, setAporte] = useState(undefined)
        definir = setAporte
        return useResultado(sim.id, { aporteMensal: aporte })
      },
      { token, queryClient },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => definir(1500))
    await waitFor(() => expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.aporteQueAlcanca))
    queryClient.removeQueries({ queryKey: chavesSimulacoes.resultado(sim.id, undefined), exact: true })
    act(() => definir(undefined))
    await waitFor(() => expect(chamadasAoResultado()).toHaveLength(3))
  })

  it('ao trocar o aporte da MESMA simulação o resultado anterior fica na tela enquanto o novo carrega (placeholder)', async () => {
    let liberar
    const comporta = new Promise((resolver) => { liberar = resolver })
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/resultado`, async ({ request }) => {
        if (new URL(request.url).searchParams.has('aporte_mensal')) await comporta
        return HttpResponse.json(new URL(request.url).searchParams.has('aporte_mensal') ? FIXTURES_DE_RESULTADO.aporteQueAlcanca : FIXTURES_DE_RESULTADO.padrao)
      }),
    )
    let definir
    const { result } = renderizarHookComAuth(
      () => {
        const [aporte, setAporte] = useState(undefined)
        definir = setAporte
        return useResultado(sim.id, { aporteMensal: aporte })
      },
      { token, queryClient: criarQueryClient({ retryDelay: 0 }) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => definir(1500))
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true))
    expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.padrao) // o anterior continua
    liberar()
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false))
    expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.aporteQueAlcanca)
  })

  it('de OUTRA simulação o resultado anterior NUNCA é reaproveitado (controle do placeholder)', async () => {
    const outra = criarSimulacao(ana.id, { nome: 'Outra' })
    let liberar
    const comporta = new Promise((resolver) => { liberar = resolver })
    servidor.use(
      http.get(`${BASE}/simulacoes/${outra.id}/resultado`, async () => {
        await comporta
        return HttpResponse.json(FIXTURES_DE_RESULTADO.semOpcoes)
      }),
    )
    let definir
    const { result } = renderizarHookComAuth(
      () => {
        const [id, setId] = useState(sim.id)
        definir = setId
        return useResultado(id)
      },
      { token, queryClient: criarQueryClient({ retryDelay: 0 }) },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => definir(outra.id))
    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(result.current.data).toBeUndefined()
    liberar()
    await waitFor(() => expect(result.current.data).toEqual(FIXTURES_DE_RESULTADO.semOpcoes))
  })

  it('o 404 NÃO é repetido (uma só chamada) e é o mesmo para a simulação de outra pessoa', async () => {
    const { result } = renderizarHookComAuth(() => useResultado(999999), { token, queryClient: producao() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(ehErroApi(result.current.error)).toBe(true)
    expect(result.current.error.status).toBe(404)
    expect(chamadasAoResultado()).toHaveLength(1)
  })

  it('a política de produção repete UMA vez o 503', async () => {
    servidor.use(http.get(`${BASE}/simulacoes/${sim.id}/resultado`, () => respostaErro(503, 'Serviço indisponível')))
    const { result } = renderizarHookComAuth(() => useResultado(sim.id), { token, queryClient: producao() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(chamadasAoResultado()).toHaveLength(2)
  })

  it.each([undefined, null, ''])('sem id (%j) não busca nada', async (id) => {
    const { result } = renderizarHookComAuth(() => useResultado(id), { token })
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(chamadasAoResultado()).toHaveLength(0)
  })

  it('cancela a requisição ao desmontar (o signal chega ao fetch)', async () => {
    let abortada = null
    servidor.use(
      http.get(`${BASE}/simulacoes/${sim.id}/resultado`, async ({ request }) => {
        await delay(150)
        abortada = request.signal.aborted
        return HttpResponse.json(FIXTURES_DE_RESULTADO.padrao)
      }),
    )
    const { unmount } = renderizarHookComAuth(() => useResultado(sim.id), { token })
    await new Promise((resolver) => setTimeout(resolver, 30))
    unmount()
    await new Promise((resolver) => setTimeout(resolver, 250))
    expect(abortada).toBe(true)
  })
})
