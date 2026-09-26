import { describe, expect, it, vi } from 'vitest'
import { ErroApi, ErroRede } from './api/erros.js'
import { criarQueryClient, deveRepetir, queryClient } from './queryClient.js'

const erroApi = (status) => new ErroApi({ status, erro: 'x' })

describe('deveRepetir', () => {
  it.each([400, 401, 403, 404, 409, 415, 422])('nunca repete erro %i da API', (status) => {
    expect(deveRepetir(0, erroApi(status))).toBe(false)
  })

  it.each([500, 502, 503, 504])('repete erro %i da API uma vez (controle dos 4xx)', (status) => {
    expect(deveRepetir(0, erroApi(status))).toBe(true)
  })

  it('repete erro de rede e de timeout uma vez', () => {
    expect(deveRepetir(0, new ErroRede())).toBe(true)
    expect(deveRepetir(0, new ErroRede({ porTimeout: true }))).toBe(true)
  })

  it('não repete pela segunda vez, em nenhum caso', () => {
    expect(deveRepetir(1, erroApi(503))).toBe(false)
    expect(deveRepetir(1, new ErroRede())).toBe(false)
    expect(deveRepetir(2, new ErroRede())).toBe(false)
  })

  it('não repete erros desconhecidos, cancelamentos nem valores vazios', () => {
    const cancelamento = new DOMException('cancelado', 'AbortError')
    for (const erro of [new Error('bug'), new TypeError('x'), cancelamento, null, undefined]) {
      expect(deveRepetir(0, erro)).toBe(false)
    }
  })
})

describe('criarQueryClient', () => {
  it('usa staleTime de 30 s, sem recarga ao voltar o foco e sem repetir mutações', () => {
    const opcoes = queryClient.getDefaultOptions()
    expect(opcoes.queries.staleTime).toBe(30_000)
    expect(opcoes.queries.refetchOnWindowFocus).toBe(false)
    expect(opcoes.queries.retry).toBe(deveRepetir)
    expect(opcoes.mutations.retry).toBe(false)
  })

  it('aceita ajustes por consulta (usado nos testes)', () => {
    const cliente = criarQueryClient({ retry: false, staleTime: 0 })
    expect(cliente.getDefaultOptions().queries.retry).toBe(false)
    expect(cliente.getDefaultOptions().queries.staleTime).toBe(0)
  })

  it('na prática: um 404 é buscado uma vez; um 503 é buscado duas vezes e depois falha', async () => {
    const cliente = criarQueryClient({ retryDelay: 0 })

    const consulta404 = vi.fn().mockRejectedValue(erroApi(404))
    await expect(cliente.fetchQuery({ queryKey: ['a'], queryFn: consulta404 })).rejects.toThrow()
    expect(consulta404).toHaveBeenCalledTimes(1)

    const consulta503 = vi.fn().mockRejectedValue(erroApi(503))
    await expect(cliente.fetchQuery({ queryKey: ['b'], queryFn: consulta503 })).rejects.toThrow()
    expect(consulta503).toHaveBeenCalledTimes(2)
  })

  it('na prática: uma falha de rede seguida de sucesso devolve o dado', async () => {
    const cliente = criarQueryClient({ retryDelay: 0 })
    const consulta = vi.fn().mockRejectedValueOnce(new ErroRede()).mockResolvedValue({ ok: 1 })
    await expect(cliente.fetchQuery({ queryKey: ['c'], queryFn: consulta })).resolves.toEqual({ ok: 1 })
    expect(consulta).toHaveBeenCalledTimes(2)
  })
})
