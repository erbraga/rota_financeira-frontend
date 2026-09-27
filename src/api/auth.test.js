// @vitest-environment node
import { http, HttpResponse, delay } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { configurarSessao } from './api.js'
import { login, obterPerfil, registrar } from './auth.js'
import { ehErroApi } from './erros.js'

const BASE = 'http://localhost:5000/api'

async function capturar(promessa) {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error('Era esperado um erro.')
}

let ana

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ email: 'ana@example.com', senha: 'senha da ana' })
})

afterEach(() => configurarSessao({}))

// Registra um handler espião que guarda os cabeçalhos recebidos.
function espiar(metodo, caminho, corpoDeResposta) {
  const visto = {}
  servidor.use(
    http[metodo](`${BASE}${caminho}`, ({ request }) => {
      visto.autorizacao = request.headers.get('Authorization')
      return HttpResponse.json(corpoDeResposta)
    }),
  )
  return visto
}

describe('registrar', () => {
  it('devolve o usuário criado (201, sem token)', async () => {
    const usuario = await registrar({ nome: 'Caio Souza', email: 'caio@example.com', senha: 'uma senha longa' })
    expect(usuario).toMatchObject({ nome: 'Caio Souza', email: 'caio@example.com' })
    expect(usuario.access_token).toBeUndefined()
  })

  it('409 (e-mail já cadastrado) e 422 (dados inválidos) viram ErroApi', async () => {
    const conflito = await capturar(registrar({ nome: 'Outra', email: 'ana@example.com', senha: 'uma senha longa' }))
    expect(ehErroApi(conflito)).toBe(true)
    expect(conflito.status).toBe(409)
    expect(conflito.erro).toBe('E-mail já cadastrado')

    const invalido = await capturar(registrar({ nome: 'A', email: 'x', senha: 'curta' }))
    expect(invalido.status).toBe(422)
    expect(Object.keys(invalido.detalhes).sort()).toEqual(['email', 'nome', 'senha'])
  })

  it('não envia Authorization, mesmo com token configurado', async () => {
    const visto = espiar('post', '/auth/registrar', { ok: true })
    configurarSessao({ obterToken: () => 'token-de-alguem' })
    await registrar({ nome: 'Caio', email: 'c@example.com', senha: 'uma senha longa' })
    expect(visto.autorizacao).toBeNull()
  })
})

describe('login', () => {
  it('devolve o token e o usuário', async () => {
    const r = await login({ email: 'ana@example.com', senha: 'senha da ana' })
    expect(r.access_token).toBe(tokenDe(ana))
    expect(r.token_type).toBe('Bearer')
    expect(r.expires_in).toBe(3600)
    expect(r.usuario).toEqual({ id: ana.id, nome: ana.nome, email: 'ana@example.com' })
  })

  it('401 vira ErroApi e NÃO chama aoExpirar (credencial errada não é sessão expirada)', async () => {
    const aoExpirar = vi.fn()
    configurarSessao({ obterToken: () => 'velho', aoExpirar })
    const erro = await capturar(login({ email: 'ana@example.com', senha: 'errada' }))
    expect(erro.status).toBe(401)
    expect(erro.erro).toBe('Credenciais inválidas')
    expect(aoExpirar).not.toHaveBeenCalled()
  })

  it('422 traz os detalhes por campo', async () => {
    const erro = await capturar(login({ email: 'nao-e-email', senha: 'x' }))
    expect(erro.status).toBe(422)
    expect(erro.detalhes).toEqual({ email: ['E-mail inválido.'] })
  })

  it('não envia Authorization, mesmo com token configurado', async () => {
    const visto = espiar('post', '/auth/login', { ok: true })
    configurarSessao({ obterToken: () => 'token-de-alguem' })
    await login({ email: 'ana@example.com', senha: 'senha da ana' })
    expect(visto.autorizacao).toBeNull()
  })
})

describe('obterPerfil', () => {
  it('envia o token da sessão e devolve o usuário (controle do "não envia" do login)', async () => {
    configurarSessao({ obterToken: () => tokenDe(ana) })
    const perfil = await obterPerfil()
    expect(perfil).toMatchObject({ id: ana.id, email: 'ana@example.com' })

    const visto = espiar('get', '/auth/perfil', { ok: true })
    await obterPerfil()
    expect(visto.autorizacao).toBe(`Bearer ${tokenDe(ana)}`)
  })

  it('401 chama aoExpirar exatamente uma vez (aqui SIM é sessão expirada)', async () => {
    const aoExpirar = vi.fn()
    configurarSessao({ obterToken: () => 'token-invalido', aoExpirar })
    const erro = await capturar(obterPerfil())
    expect(erro.status).toBe(401)
    expect(aoExpirar).toHaveBeenCalledTimes(1)
  })

  it('repassa o signal: cancelar mantém o AbortError', async () => {
    servidor.use(
      http.get(`${BASE}/auth/perfil`, async () => {
        await delay(500)
        return HttpResponse.json({ ok: 1 })
      }),
    )
    configurarSessao({ obterToken: () => tokenDe(ana) })
    const controle = new AbortController()
    const promessa = capturar(obterPerfil({ signal: controle.signal }))
    controle.abort()
    expect((await promessa).name).toBe('AbortError')
  })
})
