// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { indiceDesatualizado, indiceIndisponivel, INDICES, indiceSemSugestao } from '../mocks/handlers/indices.js'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao } from './api.js'
import { ehErroApi } from './erros.js'
import { obterIndice } from './indices.js'

async function capturar(promessa) {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error('Era esperado um erro.')
}

const aoExpirar = vi.fn()
let consultas

beforeEach(() => {
  servidor.use(...handlers)
  const ana = criarUsuario({ email: 'ana@example.com' })
  aoExpirar.mockReset()
  configurarSessao({ obterToken: () => tokenDe(ana), aoExpirar })
  consultas = []
  servidor.events.on('request:start', ({ request }) => consultas.push(new URL(request.url)))
})

afterEach(() => {
  servidor.events.removeAllListeners()
  configurarSessao({})
})

describe('obterIndice', () => {
  it.each(['cdi', 'ipca'])('devolve o objeto completo de %s, com a sugestão', async (nome) => {
    const r = await obterIndice(nome)
    expect(r).toEqual(INDICES[nome])
    expect(r.indice).toBe(nome.toUpperCase())
    expect(r.sugestao).toEqual({ data_referencia: expect.any(String), valor: expect.any(Number) })
  })

  it('pede o período na consulta e só quando informado', async () => {
    await obterIndice('cdi', { periodo: '1m' })
    await obterIndice('ipca')
    expect(consultas[0].pathname).toBe('/api/indices/cdi')
    expect(consultas[0].searchParams.getAll('periodo')).toEqual(['1m'])
    expect(consultas[1].pathname).toBe('/api/indices/ipca')
    expect(consultas[1].search).toBe('')
  })

  it('o caminho é sempre minúsculo (o backend dá 404 para "CDI")', async () => {
    await obterIndice('CDI')
    expect(consultas[0].pathname).toBe('/api/indices/cdi')
  })

  it('leva o token da sessão', async () => {
    let cabecalho
    servidor.use(
      http.get('http://localhost:5000/api/indices/:indice', ({ request }) => {
        cabecalho = request.headers.get('Authorization')
        return HttpResponse.json(INDICES.cdi)
      }),
    )
    await obterIndice('cdi')
    expect(cabecalho).toMatch(/^Bearer .+/)
  })

  it('o 401 avisa a sessão (sem token válido)', async () => {
    configurarSessao({ obterToken: () => 'token-invalido', aoExpirar })
    const erro = await capturar(obterIndice('cdi'))
    expect(ehErroApi(erro)).toBe(true)
    expect(erro.status).toBe(401)
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('o 404 do índice e o 422 do período não avisam a sessão (controle do 401)', async () => {
    const naoEncontrado = await capturar(obterIndice('selic'))
    expect(naoEncontrado.status).toBe(404)
    expect(naoEncontrado.erro).toBe('Índice não encontrado')

    const invalido = await capturar(obterIndice('cdi', { periodo: '2m' }))
    expect(invalido.status).toBe(422)
    expect(invalido.detalhes).toEqual({ periodo: ['O período deve ser um destes: 1m, 3m, 6m, 12m, 24m, 60m.'] })
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('503 (BACEN fora do ar e sem cache) chega com a mensagem do backend', async () => {
    servidor.use(indiceIndisponivel())
    const erro = await capturar(obterIndice('cdi'))
    expect(erro.status).toBe(503)
    expect(erro.erro).toBe('Dados do Banco Central indisponíveis no momento')
  })

  it('desatualizado: true e sugestao: null chegam intactos', async () => {
    servidor.use(indiceDesatualizado())
    expect((await obterIndice('cdi')).desatualizado).toBe(true)
    servidor.use(indiceSemSugestao())
    expect((await obterIndice('cdi')).sugestao).toBeNull()
  })

  it('o signal cancela a chamada sem virar erro de API', async () => {
    const controle = new AbortController()
    controle.abort()
    const erro = await capturar(obterIndice('cdi', { signal: controle.signal }))
    expect(ehErroApi(erro)).toBe(false)
    expect(erro.name).toBe('AbortError')
  })
})
