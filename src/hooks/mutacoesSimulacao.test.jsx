import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { criarSimulacao, criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarHookComAuth } from '../testUtils.jsx'
import { chavesSimulacoes } from './chavesSimulacoes.js'
import { useAtualizarSimulacao } from './useAtualizarSimulacao.js'
import { useCriarSimulacao } from './useCriarSimulacao.js'
import { useExcluirSimulacao } from './useExcluirSimulacao.js'
import { useSimulacoes } from './useSimulacoes.js'

const BASE = 'http://localhost:5000/api'
const CORPO = {
  nome: 'Onix',
  valor_veiculo: 95000,
  valor_entrada: 20000,
  taxa_ipca_projetada: 4.5,
  taxa_fundo_rendimento: 12,
  prazo_meses_fundo: 36,
}

let ana
let token
let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
  token = tokenDe(ana)
  pedidos = []
  servidor.events.on('request:start', ({ request }) => pedidos.push(`${request.method} ${new URL(request.url).pathname.replace('/api', '')}`))
})

afterEach(() => servidor.events.removeAllListeners())

const chamadas = (rotulo) => pedidos.filter((p) => p === rotulo).length

describe('useCriarSimulacao', () => {
  it('cria (201), guarda o detalhe no cache e a lista, buscada de novo, traz a simulação', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => ({ criar: useCriarSimulacao(), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    expect(result.current.lista.data.total).toBe(0)

    let nova
    await act(async () => {
      nova = await result.current.criar.mutateAsync(CORPO)
    })
    expect(nova).toMatchObject({ nome: 'Onix', valor_veiculo: 95000 })
    // O detalhe já está em cache (a edição, para onde a tela navega, não precisa buscar).
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(nova.id))).toEqual(nova)
    await waitFor(() => expect(result.current.lista.data.total).toBe(1))
    expect(result.current.lista.data.itens[0].id).toBe(nova.id)
  })

  it('invalida SÓ a lista: o detalhe recém-guardado NÃO é buscado de novo (exact)', async () => {
    const { result } = renderizarHookComAuth(() => ({ criar: useCriarSimulacao(), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    await act(async () => {
      await result.current.criar.mutateAsync(CORPO)
    })
    await waitFor(() => expect(result.current.lista.data.total).toBe(1))
    expect(chamadas('GET /simulacoes')).toBe(2)
    expect(pedidos.filter((p) => /^GET \/simulacoes\/\d+$/.test(p))).toEqual([])
  })

  it('422 sobe o erro e NÃO mexe no cache (controle do sucesso)', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => ({ criar: useCriarSimulacao(), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    let erro
    await act(async () => {
      try {
        await result.current.criar.mutateAsync({ ...CORPO, prazo_meses_fundo: 61 })
      } catch (e) {
        erro = e
      }
    })
    expect(erro.status).toBe(422)
    expect(queryClient.getQueryCache().findAll({ queryKey: ['simulacoes'] })).toHaveLength(1)
    expect(chamadas('GET /simulacoes')).toBe(1)
  })
})

describe('useAtualizarSimulacao', () => {
  it('o detalhe em cache passa a ser o que o servidor devolveu e a lista é buscada de novo', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Antiga' })
    const { result, queryClient } = renderizarHookComAuth(() => ({ atualizar: useAtualizarSimulacao(s.id), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))

    await act(async () => {
      await result.current.atualizar.mutateAsync({ ...CORPO, nome: 'Nova' })
    })
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(s.id))).toMatchObject({ id: s.id, nome: 'Nova' })
    await waitFor(() => expect(result.current.lista.data.itens[0].nome).toBe('Nova'))
    expect(chamadas('GET /simulacoes')).toBe(2)
  })

  it('o id da rota (texto) e o da resposta (número) usam a MESMA chave de cache', async () => {
    const s = criarSimulacao(ana.id)
    const { result, queryClient } = renderizarHookComAuth(() => useAtualizarSimulacao(String(s.id)), { token })
    await act(async () => {
      await result.current.mutateAsync(CORPO)
    })
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(s.id))).toBeDefined()
  })

  it('404 (simulação de outra pessoa) sobe o erro e não grava nada no cache', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => useAtualizarSimulacao(999), { token })
    let erro
    await act(async () => {
      try {
        await result.current.mutateAsync(CORPO)
      } catch (e) {
        erro = e
      }
    })
    expect(erro.status).toBe(404)
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(999))).toBeUndefined()
  })
})

describe('useExcluirSimulacao', () => {
  it('exclui (204): remove o detalhe do cache e a lista é buscada de novo sem ela', async () => {
    const s = criarSimulacao(ana.id, { nome: 'Vai sumir' })
    criarSimulacao(ana.id, { nome: 'Fica' })
    const { result, queryClient } = renderizarHookComAuth(() => ({ excluir: useExcluirSimulacao(), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    queryClient.setQueryData(chavesSimulacoes.detalhe(s.id), { id: s.id })

    let resultado
    await act(async () => {
      resultado = await result.current.excluir.mutateAsync(s.id)
    })
    expect(resultado).toEqual({ id: s.id, jaExcluida: false })
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(s.id))).toBeUndefined()
    await waitFor(() => expect(result.current.lista.data.itens.map((i) => i.nome)).toEqual(['Fica']))
  })

  it('404 no DELETE conta como sucesso ({ jaExcluida: true }) e também limpa o cache', async () => {
    const { result, queryClient } = renderizarHookComAuth(() => ({ excluir: useExcluirSimulacao(), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    queryClient.setQueryData(chavesSimulacoes.detalhe(999), { id: 999 })

    let resultado
    await act(async () => {
      resultado = await result.current.excluir.mutateAsync(999)
    })
    expect(resultado).toEqual({ id: 999, jaExcluida: true })
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(999))).toBeUndefined()
    await waitFor(() => expect(chamadas('GET /simulacoes')).toBe(2))
  })

  it('rede fora do ar: o erro sobe e o cache NÃO é mexido (controle do 404)', async () => {
    const s = criarSimulacao(ana.id)
    servidor.use(http.delete(`${BASE}/simulacoes/${s.id}`, () => HttpResponse.error()))
    const { result, queryClient } = renderizarHookComAuth(() => ({ excluir: useExcluirSimulacao(), lista: useSimulacoes() }), { token })
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    queryClient.setQueryData(chavesSimulacoes.detalhe(s.id), { id: s.id })

    let erro
    await act(async () => {
      try {
        await result.current.excluir.mutateAsync(s.id)
      } catch (e) {
        erro = e
      }
    })
    expect(erro.name).toBe('ErroRede')
    expect(queryClient.getQueryData(chavesSimulacoes.detalhe(s.id))).toBeDefined()
    expect(chamadas('GET /simulacoes')).toBe(1)
  })

  it('erro 500 também sobe e não conta como excluída', async () => {
    const s = criarSimulacao(ana.id)
    servidor.use(http.delete(`${BASE}/simulacoes/${s.id}`, () => respostaErro(500, 'Erro interno do servidor')))
    const { result } = renderizarHookComAuth(() => useExcluirSimulacao(), { token })
    let erro
    await act(async () => {
      try {
        await result.current.mutateAsync(s.id)
      } catch (e) {
        erro = e
      }
    })
    expect(erro.status).toBe(500)
  })
})
