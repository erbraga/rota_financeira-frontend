import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { banco, criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { criarQueryClient } from '../queryClient.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { chavesSimulacoes } from './chavesSimulacoes.js'
import { useAtualizarFinanciamento } from './useAtualizarFinanciamento.js'
import { useCriarFinanciamento } from './useCriarFinanciamento.js'
import { useExcluirFinanciamento } from './useExcluirFinanciamento.js'
import { useExcluirSimulacao } from './useExcluirSimulacao.js'
import { useFinanciamentos } from './useFinanciamentos.js'

const BASE = 'http://localhost:5000/api'
const CORPO = { nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'PRICE', valor_entrada: 10000 }

let ana
let token
let sim
let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  token = tokenDe(ana)
  sim = criarSimulacao(ana.id, { valor_veiculo: 95000 })
  pedidos = []
  servidor.events.on('request:start', ({ request }) => pedidos.push(`${request.method} ${new URL(request.url).pathname.replace('/api', '')}`))
})

afterEach(() => servidor.events.removeAllListeners())

const chamadas = (rotulo) => pedidos.filter((p) => p === rotulo).length
const LISTA = () => `GET /simulacoes/${sim.id}/financiamentos`
// Cache de PRODUÇÃO (staleTime de 30 s): o cliente de teste refaria a busca e esconderia a falta do setQueryData.
const producao = () => criarQueryClient({ retry: false, gcTime: Infinity })

function montar() {
  return renderizarHookComAuth(
    () => ({
      lista: useFinanciamentos(sim.id),
      criar: useCriarFinanciamento(sim.id),
      atualizar: useAtualizarFinanciamento(sim.id),
      excluir: useExcluirFinanciamento(sim.id),
    }),
    { token, queryClient: producao() },
  )
}

async function comListaCarregada() {
  const montado = montar()
  await waitFor(() => expect(montado.result.current.lista.isSuccess).toBe(true))
  return montado
}

// O React Query agenda a notificação ao componente: quem lê `result.current` depois de uma mutação usa waitFor.
const executar = (fn) => act(async () => fn())

describe('useCriarFinanciamento', () => {
  it('acrescenta a opção devolvida ao FIM da lista em cache, sem novo GET (controle: o servidor a tem)', async () => {
    criarFinanciamento(sim.id, { nome: 'Existente' })
    const { result } = await comListaCarregada()
    let nova
    await executar(async () => {
      nova = await result.current.criar.mutateAsync(CORPO)
    })
    expect(nova).toMatchObject({ nome: 'Banco A', sistema_amortizacao: 'PRICE' })
    await waitFor(() => expect(result.current.lista.data.itens.map((f) => f.nome)).toEqual(['Existente', 'Banco A']))
    expect(result.current.lista.data.total).toBe(2)
    expect(chamadas(LISTA())).toBe(1) // só a busca inicial
    expect(banco.financiamentos.filter((f) => f.simulacao_id === sim.id)).toHaveLength(2)
  })

  it('invalida o resultado da simulação (a chave passa a "invalidada"), e só ele', async () => {
    const { result, queryClient } = await comListaCarregada()
    queryClient.setQueryData(chavesSimulacoes.resultado(sim.id), { simulacao: 'x' })
    queryClient.setQueryData(chavesSimulacoes.detalhe(sim.id), { id: sim.id })
    await executar(() => result.current.criar.mutateAsync(CORPO))
    expect(queryClient.getQueryState(chavesSimulacoes.resultado(sim.id)).isInvalidated).toBe(true)
    expect(queryClient.getQueryState(chavesSimulacoes.detalhe(sim.id)).isInvalidated).toBe(false)
    expect(queryClient.getQueryState(chavesSimulacoes.financiamentos(sim.id)).isInvalidated).toBe(false)
  })

  it.each([
    ['409 (limite de 3)', () => respostaErro(409, 'Uma simulação aceita no máximo 3 opções de financiamento'), 409],
    ['422', () => HttpResponse.json({ erro: 'Dados inválidos', detalhes: { prazo_meses: ['x'] } }, { status: 422 }), 422],
    ['503', () => respostaErro(503, 'Serviço indisponível'), 503],
    ['rede', () => HttpResponse.error(), undefined],
  ])('%s: o erro sobe, NÃO mexe no cache e NÃO repete (uma só chamada)', async (_rotulo, resposta, status) => {
    criarFinanciamento(sim.id)
    const { result, queryClient } = await comListaCarregada()
    const antes = queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))
    let tentativas = 0
    servidor.use(
      http.post(`${BASE}/simulacoes/${sim.id}/financiamentos`, () => {
        tentativas += 1
        return resposta()
      }),
    )
    let erro
    await executar(async () => {
      erro = await result.current.criar.mutateAsync(CORPO).catch((e) => e)
    })
    expect(erro).toBeInstanceOf(Error)
    if (status) expect(erro.status).toBe(status)
    expect(tentativas).toBe(1)
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))).toBe(antes)
  })
})

describe('useAtualizarFinanciamento', () => {
  it('troca a opção pelo MESMO id, na mesma posição, sem novo GET', async () => {
    const a = criarFinanciamento(sim.id, { nome: 'A' })
    const b = criarFinanciamento(sim.id, { nome: 'B' })
    const c = criarFinanciamento(sim.id, { nome: 'C' })
    const { result } = await comListaCarregada()
    await executar(() => result.current.atualizar.mutateAsync({ id: b.id, corpo: { ...CORPO, nome: 'B editada' } }))
    await waitFor(() => expect(result.current.lista.data.itens.map((f) => f.nome)).toEqual(['A', 'B editada', 'C']))
    expect(result.current.lista.data.itens.map((f) => f.id)).toEqual([a.id, b.id, c.id])
    expect(result.current.lista.data.total).toBe(3)
    expect(chamadas(LISTA())).toBe(1)
  })

  it('envia o corpo completo e invalida o resultado', async () => {
    const f = criarFinanciamento(sim.id)
    const { result, queryClient } = await comListaCarregada()
    queryClient.setQueryData(chavesSimulacoes.resultado(sim.id), { simulacao: 'x' })
    await executar(() => result.current.atualizar.mutateAsync({ id: f.id, corpo: CORPO }))
    expect(banco.financiamentos.find((x) => x.id === f.id)).toMatchObject(CORPO)
    expect(queryClient.getQueryState(chavesSimulacoes.resultado(sim.id)).isInvalidated).toBe(true)
  })

  it('404 (excluída em outra aba) sobe como erro e NÃO mexe no cache; 422 idem', async () => {
    const f = criarFinanciamento(sim.id, { nome: 'A' })
    const { result, queryClient } = await comListaCarregada()
    const antes = queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))
    banco.financiamentos = []
    let erro
    await executar(async () => {
      erro = await result.current.atualizar.mutateAsync({ id: f.id, corpo: CORPO }).catch((e) => e)
    })
    expect(erro.status).toBe(404)
    expect(erro.erro).toBe('Opção de financiamento não encontrada')
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))).toBe(antes)
  })
})

describe('useExcluirFinanciamento', () => {
  it('204: tira a opção da lista em cache, atualiza o total, sem novo GET', async () => {
    const a = criarFinanciamento(sim.id, { nome: 'A' })
    criarFinanciamento(sim.id, { nome: 'B' })
    const { result } = await comListaCarregada()
    let retorno
    await executar(async () => {
      retorno = await result.current.excluir.mutateAsync(a.id)
    })
    expect(retorno).toEqual({ id: a.id, jaExcluida: false })
    await waitFor(() => expect(result.current.lista.data.itens.map((f) => f.nome)).toEqual(['B']))
    expect(result.current.lista.data.total).toBe(1)
    expect(chamadas(LISTA())).toBe(1)
  })

  it('404 do DELETE conta como sucesso ({ jaExcluida: true }) e mexe no cache do mesmo jeito', async () => {
    const a = criarFinanciamento(sim.id, { nome: 'A' })
    const { result, queryClient } = await comListaCarregada()
    banco.financiamentos = []
    queryClient.setQueryData(chavesSimulacoes.resultado(sim.id), { simulacao: 'x' })
    let retorno
    await executar(async () => {
      retorno = await result.current.excluir.mutateAsync(a.id)
    })
    expect(retorno).toEqual({ id: a.id, jaExcluida: true })
    await waitFor(() => expect(result.current.lista.data.itens).toEqual([]))
    expect(queryClient.getQueryState(chavesSimulacoes.resultado(sim.id)).isInvalidated).toBe(true)
  })

  it.each([
    ['503', () => respostaErro(503, 'Serviço indisponível')],
    ['rede', () => HttpResponse.error()],
  ])('%s: sobe o erro, NÃO mexe no cache e NÃO repete', async (_rotulo, resposta) => {
    const a = criarFinanciamento(sim.id)
    const { result, queryClient } = await comListaCarregada()
    const antes = queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))
    let tentativas = 0
    servidor.use(
      http.delete(`${BASE}/simulacoes/${sim.id}/financiamentos/${a.id}`, () => {
        tentativas += 1
        return resposta()
      }),
    )
    let erro
    await executar(async () => {
      erro = await result.current.excluir.mutateAsync(a.id).catch((e) => e)
    })
    expect(erro).toBeInstanceOf(Error)
    expect(tentativas).toBe(1)
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))).toBe(antes)
  })
})

describe('excluir a SIMULAÇÃO leva junto o cache das opções (mesmo prefixo)', () => {
  it('a lista e o resultado saem do cache; o de outra simulação fica (controle)', async () => {
    const outra = criarSimulacao(ana.id)
    const { result, queryClient } = renderizarHookComAuth(
      () => ({ lista: useFinanciamentos(sim.id), excluir: useExcluirSimulacao() }),
      { token, queryClient: producao() },
    )
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    queryClient.setQueryData(chavesSimulacoes.resultado(sim.id), { simulacao: 'x' })
    queryClient.setQueryData(chavesSimulacoes.financiamentos(outra.id), { itens: [], total: 0 })

    await executar(() => result.current.excluir.mutateAsync(sim.id))
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(sim.id))).toBeUndefined()
    expect(queryClient.getQueryData(chavesSimulacoes.resultado(sim.id))).toBeUndefined()
    expect(queryClient.getQueryData(chavesSimulacoes.financiamentos(outra.id))).toEqual({ itens: [], total: 0 })
  })
})
