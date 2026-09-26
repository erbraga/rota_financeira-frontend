// @vitest-environment node
// O client roda em ambiente "node": o AbortController/AbortSignal do jsdom pode ser recusado pelo fetch nativo.
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao, get, post, put, remover, TIMEOUT_PADRAO_MS } from './api.js'
import { ehErroApi, ehErroRede } from './erros.js'

const BASE = 'http://localhost:5000/api'

// O servidor MSW (listen/resetHandlers/close) é gerido pelo setupTests.js.
afterEach(() => {
  configurarSessao({})
  vi.unstubAllEnvs()
})

// Registra um handler que devolve os cabeçalhos e o corpo recebidos, para os testes conferirem.
function espelhar(metodo, caminho, status = 200) {
  const visto = {}
  servidor.use(
    http[metodo](`${BASE}${caminho}`, async ({ request }) => {
      visto.cabecalhos = Object.fromEntries(request.headers)
      visto.corpo = await request.text()
      return HttpResponse.json({ ok: true }, { status })
    }),
  )
  return visto
}

describe('client HTTP: URL, cabeçalhos e sucesso', () => {
  it('GET junta a URL base ao caminho, pede JSON e devolve o objeto', async () => {
    servidor.use(http.get(`${BASE}/simulacoes`, () => HttpResponse.json({ itens: [], total: 0 })))
    expect(await get('/simulacoes')).toEqual({ itens: [], total: 0 })
  })

  it('sem corpo, não envia Content-Type; pede Accept application/json', async () => {
    const visto = espelhar('get', '/simulacoes')
    await get('/simulacoes')
    expect(visto.cabecalhos.accept).toBe('application/json')
    expect(visto.cabecalhos['content-type']).toBeUndefined()
  })

  it('com corpo, envia Content-Type JSON e o corpo serializado (POST e PUT)', async () => {
    const vistoPost = espelhar('post', '/simulacoes', 201)
    const vistoPut = espelhar('put', '/simulacoes/1')
    await post('/simulacoes', { nome: 'Onix' })
    await put('/simulacoes/1', { nome: 'Onix 2' })
    expect(vistoPost.cabecalhos['content-type']).toContain('application/json')
    expect(JSON.parse(vistoPost.corpo)).toEqual({ nome: 'Onix' })
    expect(JSON.parse(vistoPut.corpo)).toEqual({ nome: 'Onix 2' })
  })

  it('DELETE com 204 devolve null, sem tentar ler JSON, e não envia Content-Type', async () => {
    let cabecalhos
    servidor.use(
      http.delete(`${BASE}/simulacoes/1`, ({ request }) => {
        cabecalhos = Object.fromEntries(request.headers)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    expect(await remover('/simulacoes/1')).toBeNull()
    expect(cabecalhos['content-type']).toBeUndefined()
  })

  it('normaliza a barra final da URL base', async () => {
    vi.stubEnv('VITE_API_URL', `${BASE}/`)
    servidor.use(http.get(`${BASE}/simulacoes`, () => HttpResponse.json({ ok: 1 })))
    expect(await get('/simulacoes')).toEqual({ ok: 1 })
  })

  it('falha com uma mensagem clara se a VITE_API_URL for inválida', async () => {
    vi.stubEnv('VITE_API_URL', '')
    await expect(get('/simulacoes')).rejects.toThrow('VITE_API_URL')
  })
})

describe('client HTTP: token', () => {
  it('envia Authorization Bearer quando há token', async () => {
    const visto = espelhar('get', '/simulacoes')
    configurarSessao({ obterToken: () => 'abc.def.ghi' })
    await get('/simulacoes')
    expect(visto.cabecalhos.authorization).toBe('Bearer abc.def.ghi')
  })

  it('não envia Authorization em chamadas semAutenticacao, mesmo com token (controle)', async () => {
    const visto = espelhar('post', '/auth/login')
    configurarSessao({ obterToken: () => 'abc.def.ghi' })
    await post('/auth/login', { email: 'a@b.c' }, { semAutenticacao: true })
    expect(visto.cabecalhos.authorization).toBeUndefined()
  })

  it('não envia Authorization se a sessão não foi configurada ou não há token', async () => {
    const visto = espelhar('get', '/simulacoes')
    await get('/simulacoes')
    expect(visto.cabecalhos.authorization).toBeUndefined()

    configurarSessao({ obterToken: () => null })
    await get('/simulacoes')
    expect(visto.cabecalhos.authorization).toBeUndefined()
  })
})

// Chama e devolve o erro lançado (falha o teste se não lançar).
async function capturar(promessa) {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error('Era esperado um erro, mas a chamada teve sucesso.')
}

describe('client HTTP: erros da API', () => {
  it('422 vira ErroApi com a mensagem e os detalhes por campo do backend', async () => {
    servidor.use(
      http.post(`${BASE}/auth/registrar`, () =>
        HttpResponse.json(
          { erro: 'Dados inválidos', detalhes: { email: ['Campo obrigatório.'] } },
          { status: 422 },
        ),
      ),
    )
    const erro = await capturar(post('/auth/registrar', {}, { semAutenticacao: true }))
    expect(ehErroApi(erro)).toBe(true)
    expect(erro.status).toBe(422)
    expect(erro.erro).toBe('Dados inválidos')
    expect(erro.detalhes).toEqual({ email: ['Campo obrigatório.'] })
  })

  it.each([
    [404, 'Simulação não encontrada'],
    [409, 'Limite de 3 opções de financiamento atingido'],
    [500, 'Erro interno do servidor'],
    [503, 'Dados do Banco Central indisponíveis no momento'],
  ])('%i preserva a mensagem do backend', async (status, mensagem) => {
    servidor.use(http.get(`${BASE}/x`, () => HttpResponse.json({ erro: mensagem }, { status })))
    const erro = await capturar(get('/x'))
    expect(erro.status).toBe(status)
    expect(erro.erro).toBe(mensagem)
    expect(erro.detalhes).toBeUndefined()
  })

  it('erro sem JSON (502 em HTML) vira ErroApi genérico, sem repassar o HTML', async () => {
    servidor.use(
      http.get(
        `${BASE}/x`,
        () =>
          new HttpResponse('<html><body>Bad Gateway nginx/1.2</body></html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    )
    const erro = await capturar(get('/x'))
    expect(ehErroApi(erro)).toBe(true)
    expect(erro.status).toBe(502)
    expect(erro.erro).toBe('Servidor indisponível no momento.')
    expect(erro.message).not.toContain('nginx')
    expect(erro.detalhes).toBeUndefined()
  })

  it('erro em JSON sem o campo "erro" usa a mensagem genérica do status', async () => {
    servidor.use(http.get(`${BASE}/x`, () => HttpResponse.json({ msg: 'outro formato' }, { status: 404 })))
    const erro = await capturar(get('/x'))
    expect(erro.erro).toBe('Recurso não encontrado.')
  })

  it('ignora "detalhes" que não seja um objeto por campo', async () => {
    servidor.use(
      http.get(`${BASE}/x`, () => HttpResponse.json({ erro: 'ruim', detalhes: ['a', 'b'] }, { status: 422 })),
    )
    expect((await capturar(get('/x'))).detalhes).toBeUndefined()
  })

  it('2xx com corpo que não é JSON vira ErroApi genérico', async () => {
    servidor.use(http.get(`${BASE}/x`, () => new HttpResponse('isto não é json', { status: 200 })))
    const erro = await capturar(get('/x'))
    expect(ehErroApi(erro)).toBe(true)
    expect(erro.status).toBe(200)
    expect(erro.erro).toBe('Resposta inválida do servidor.')
  })
})

describe('client HTTP: 401 e sessão expirada', () => {
  const naoAutorizado = () =>
    HttpResponse.json({ erro: 'Token expirado' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })

  it('401 chama aoExpirar exatamente uma vez e lança ErroApi(401) com a mensagem do backend', async () => {
    const aoExpirar = vi.fn()
    configurarSessao({ obterToken: () => 'velho', aoExpirar })
    servidor.use(http.get(`${BASE}/simulacoes`, naoAutorizado))

    const erro = await capturar(get('/simulacoes'))
    expect(aoExpirar).toHaveBeenCalledTimes(1)
    expect(erro.status).toBe(401)
    expect(erro.erro).toBe('Token expirado')
  })

  it('o MESMO 401 em chamada semAutenticacao (login) NÃO chama aoExpirar (controle)', async () => {
    const aoExpirar = vi.fn()
    configurarSessao({ obterToken: () => 'velho', aoExpirar })
    servidor.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json({ erro: 'Credenciais inválidas' }, { status: 401 })),
    )

    const erro = await capturar(post('/auth/login', { email: 'a@b.c', senha: 'x' }, { semAutenticacao: true }))
    expect(aoExpirar).not.toHaveBeenCalled()
    expect(erro.status).toBe(401)
    expect(erro.erro).toBe('Credenciais inválidas')
  })

  it('outros erros (404, 422) não chamam aoExpirar; o sucesso também não', async () => {
    const aoExpirar = vi.fn()
    configurarSessao({ obterToken: () => 't', aoExpirar })
    servidor.use(
      http.get(`${BASE}/ok`, () => HttpResponse.json({ ok: 1 })),
      http.get(`${BASE}/nao`, () => HttpResponse.json({ erro: 'x' }, { status: 404 })),
    )
    await get('/ok')
    await capturar(get('/nao'))
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('sem configurarSessao, o 401 só lança o erro (não quebra)', async () => {
    servidor.use(http.get(`${BASE}/simulacoes`, naoAutorizado))
    expect((await capturar(get('/simulacoes'))).status).toBe(401)
  })
})

describe('client HTTP: rede, timeout e cancelamento', () => {
  it('servidor fora do ar (falha do fetch) vira ErroRede, sem status e sem porTimeout', async () => {
    servidor.use(http.get(`${BASE}/x`, () => HttpResponse.error()))
    const erro = await capturar(get('/x'))
    expect(ehErroRede(erro)).toBe(true)
    expect(ehErroApi(erro)).toBe(false)
    expect(erro.porTimeout).toBe(false)
    expect(erro.status).toBeUndefined()
    expect(erro.causa).toBeDefined()
  })

  it('conexão interrompida no meio do corpo também vira ErroRede', async () => {
    servidor.use(
      http.get(`${BASE}/x`, () => {
        const corpo = new ReadableStream({
          start(controle) {
            controle.error(new Error('conexão caiu'))
          },
        })
        return new HttpResponse(corpo, { status: 200 })
      }),
    )
    const erro = await capturar(get('/x'))
    expect(ehErroRede(erro)).toBe(true)
  })

  it('estourar o timeout vira ErroRede com porTimeout', async () => {
    servidor.use(
      http.get(`${BASE}/lento`, async () => {
        await delay(500)
        return HttpResponse.json({ ok: 1 })
      }),
    )
    const erro = await capturar(get('/lento', { timeoutMs: 50 }))
    expect(ehErroRede(erro)).toBe(true)
    expect(erro.porTimeout).toBe(true)
  })

  it('a mesma chamada lenta, com timeout folgado, tem sucesso (controle do timeout)', async () => {
    servidor.use(
      http.get(`${BASE}/lento`, async () => {
        await delay(100)
        return HttpResponse.json({ ok: 1 })
      }),
    )
    expect(await get('/lento', { timeoutMs: 5000 })).toEqual({ ok: 1 })
  })

  it('o timeout padrão é de 15 s', () => {
    expect(TIMEOUT_PADRAO_MS).toBe(15_000)
  })

  it('cancelamento pelo chamador mantém o AbortError (não vira ErroRede)', async () => {
    servidor.use(
      http.get(`${BASE}/lento`, async () => {
        await delay(500)
        return HttpResponse.json({ ok: 1 })
      }),
    )
    const controle = new AbortController()
    const promessa = capturar(get('/lento', { signal: controle.signal }))
    controle.abort()
    const erro = await promessa
    expect(erro.name).toBe('AbortError')
    expect(ehErroRede(erro)).toBe(false)
  })

  it('a mesma chamada, sem abortar o sinal, tem sucesso (controle do cancelamento)', async () => {
    servidor.use(http.get(`${BASE}/x`, () => HttpResponse.json({ ok: 1 })))
    const controle = new AbortController()
    expect(await get('/x', { signal: controle.signal })).toEqual({ ok: 1 })
  })

  it('sinal já abortado antes da chamada também mantém o AbortError', async () => {
    servidor.use(http.get(`${BASE}/x`, () => HttpResponse.json({ ok: 1 })))
    const controle = new AbortController()
    controle.abort()
    const erro = await capturar(get('/x', { signal: controle.signal }))
    expect(erro.name).toBe('AbortError')
  })

  it('timeout com um sinal do chamador não abortado continua sendo ErroRede porTimeout', async () => {
    servidor.use(
      http.get(`${BASE}/lento`, async () => {
        await delay(500)
        return HttpResponse.json({ ok: 1 })
      }),
    )
    const controle = new AbortController()
    const erro = await capturar(get('/lento', { signal: controle.signal, timeoutMs: 50 }))
    expect(ehErroRede(erro)).toBe(true)
    expect(erro.porTimeout).toBe(true)
  })
})
