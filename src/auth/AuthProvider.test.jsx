import { act, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from '../api/api.js'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import { CHAVE_TOKEN, lerToken } from './tokenStorage.js'
import { useAuth } from './useAuth.js'

const BASE = 'http://localhost:5000/api'
const PERFIL = `${BASE}/auth/perfil`

// Componente de prova: mostra o status e guarda o valor de useAuth para os testes chamarem entrar/sair.
const captura = { auth: null }
function Sonda() {
  const valor = useAuth()
  useEffect(() => {
    captura.auth = valor
  })
  return <p data-testid="status">{valor.status}</p>
}

const status = () => screen.getByTestId('status')
const aguardarStatus = (esperado) => waitFor(() => expect(status()).toHaveTextContent(esperado))

let ana
let pedidos

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com', senha: 'senha da ana' })
  pedidos = []
  servidor.events.on('request:start', ({ request }) => {
    pedidos.push(`${request.method} ${new URL(request.url).pathname.replace('/api', '')}`)
  })
})

afterEach(() => {
  servidor.events.removeAllListeners()
})

const pedidosDePerfil = () => pedidos.filter((p) => p === 'GET /auth/perfil').length

describe('AuthProvider: início da sessão', () => {
  it('sem token: sem-sessao e nenhuma chamada ao backend', async () => {
    renderizarComAuth(<Sonda />)
    expect(status()).toHaveTextContent('sem-sessao')
    expect(captura.auth.usuario).toBeNull()
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(pedidos).toEqual([])
  })

  it('com token válido: validando e depois autenticado, com o usuário do perfil', async () => {
    renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    expect(status()).toHaveTextContent('validando')
    await aguardarStatus('autenticado')
    expect(captura.auth.usuario).toMatchObject({ id: ana.id, nome: 'Ana', email: 'ana@example.com' })
    expect(captura.auth.aviso).toBeNull()
    expect(pedidosDePerfil()).toBe(1)
  })

  it('com token inválido (401): sem-sessao, aviso de sessão expirada e token apagado', async () => {
    renderizarComAuth(<Sonda />, { token: 'lixo' })
    await aguardarStatus('sem-sessao')
    expect(captura.auth.aviso).toBe('sessao-expirada')
    expect(lerToken()).toBeNull()
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull()
    expect(pedidosDePerfil()).toBe(1)
  })

  it('token de uma conta que não existe mais (401) também encerra a sessão', async () => {
    renderizarComAuth(<Sonda />, { token: 'mock.9999' })
    await aguardarStatus('sem-sessao')
    expect(captura.auth.aviso).toBe('sessao-expirada')
  })

  it('backend com erro 500: status erro e o token é MANTIDO', async () => {
    servidor.use(http.get(PERFIL, () => respostaErro(500, 'Erro interno do servidor')))
    renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('erro')
    expect(lerToken()).toBe(tokenDe(ana))
    expect(captura.auth.aviso).toBeNull()
  })

  it('backend fora do ar (rede): status erro e o token é mantido; tentarNovamente entra quando volta', async () => {
    servidor.use(http.get(PERFIL, () => HttpResponse.error()))
    renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('erro')
    expect(lerToken()).toBe(tokenDe(ana))

    servidor.resetHandlers(...handlers)
    await act(async () => {
      await captura.auth.tentarNovamente()
    })
    await aguardarStatus('autenticado')
    expect(captura.auth.usuario.nome).toBe('Ana')
  })

  it('montagem dupla do StrictMode: uma só chamada ao perfil', async () => {
    renderizarComAuth(
      <StrictMode>
        <Sonda />
      </StrictMode>,
      { token: tokenDe(ana) },
    )
    await aguardarStatus('autenticado')
    expect(pedidosDePerfil()).toBe(1)
  })
})

describe('AuthProvider: entrar e sair', () => {
  it('entrar: grava o token, autentica, semeia o perfil (sem chamada extra) e o client passa a enviar o token', async () => {
    renderizarComAuth(<Sonda />)
    await act(async () => {
      await captura.auth.entrar('ana@example.com', 'senha da ana')
    })
    await aguardarStatus('autenticado')
    expect(captura.auth.usuario).toMatchObject({ id: ana.id, nome: 'Ana' })
    expect(lerToken()).toBe(tokenDe(ana))
    expect(pedidosDePerfil()).toBe(0)

    let autorizacao
    servidor.use(
      http.get(`${BASE}/simulacoes`, ({ request }) => {
        autorizacao = request.headers.get('Authorization')
        return HttpResponse.json({ itens: [], total: 0 })
      }),
    )
    await get('/simulacoes')
    expect(autorizacao).toBe(`Bearer ${tokenDe(ana)}`)
  })

  it('entrar com senha errada: o erro sobe (401), sem token, sem aviso e sem tratar como sessão expirada', async () => {
    renderizarComAuth(<Sonda />)
    let erro
    await act(async () => {
      try {
        await captura.auth.entrar('ana@example.com', 'errada')
      } catch (e) {
        erro = e
      }
    })
    expect(erro.status).toBe(401)
    expect(erro.erro).toBe('Credenciais inválidas')
    expect(status()).toHaveTextContent('sem-sessao')
    expect(captura.auth.aviso).toBeNull()
    expect(lerToken()).toBeNull()
  })

  it('entrar limpa um aviso anterior', async () => {
    renderizarComAuth(<Sonda />, { token: 'lixo' })
    await aguardarStatus('sem-sessao')
    expect(captura.auth.aviso).toBe('sessao-expirada')
    await act(async () => {
      await captura.auth.entrar('ana@example.com', 'senha da ana')
    })
    expect(captura.auth.aviso).toBeNull()
  })

  it('sair: apaga o token, limpa o cache, avisa "saiu" e não chama o backend', async () => {
    const { queryClient } = renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('autenticado')
    queryClient.setQueryData(['qualquer'], 'dado da sessão anterior')
    const antes = pedidos.length

    act(() => captura.auth.sair())
    expect(status()).toHaveTextContent('sem-sessao')
    expect(captura.auth.aviso).toBe('saiu')
    expect(captura.auth.usuario).toBeNull()
    expect(lerToken()).toBeNull()
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull()
    expect(queryClient.getQueryData(['qualquer'])).toBeUndefined()
    expect(pedidos.length).toBe(antes)
  })

  it('sair cancela consultas em andamento: nada volta a preencher o cache depois', async () => {
    const { queryClient } = renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('autenticado')
    const lenta = queryClient
      .fetchQuery({
        queryKey: ['lenta'],
        queryFn: () => new Promise((resolver) => setTimeout(() => resolver('tarde demais'), 80)),
      })
      .catch(() => {})

    act(() => captura.auth.sair())
    await lenta
    await new Promise((resolver) => setTimeout(resolver, 150))
    expect(queryClient.getQueryData(['lenta'])).toBeUndefined()
  })

  it('limparAviso remove o aviso', async () => {
    renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('autenticado')
    act(() => captura.auth.sair())
    expect(captura.auth.aviso).toBe('saiu')
    act(() => captura.auth.limparAviso())
    expect(captura.auth.aviso).toBeNull()
  })
})

describe('AuthProvider: 401 durante o uso', () => {
  const naoAutorizado = () => respostaErro(401, 'Token expirado')

  it('várias respostas 401 em paralelo geram UMA só saída', async () => {
    const { queryClient } = renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('autenticado')
    servidor.use(http.get(`${BASE}/simulacoes`, naoAutorizado))
    const limpar = vi.spyOn(queryClient, 'clear')

    await act(async () => {
      await Promise.allSettled([get('/simulacoes'), get('/simulacoes'), get('/simulacoes')])
    })
    expect(status()).toHaveTextContent('sem-sessao')
    expect(captura.auth.aviso).toBe('sessao-expirada')
    expect(lerToken()).toBeNull()
    expect(limpar).toHaveBeenCalledTimes(1)
  })

  it('outros erros (404) NÃO encerram a sessão (controle do 401)', async () => {
    renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('autenticado')
    servidor.use(http.get(`${BASE}/simulacoes`, () => respostaErro(404, 'Simulação não encontrada')))
    await act(async () => {
      await Promise.allSettled([get('/simulacoes')])
    })
    expect(status()).toHaveTextContent('autenticado')
    expect(captura.auth.aviso).toBeNull()
    expect(lerToken()).toBe(tokenDe(ana))
  })
})

describe('AuthProvider: ambiente', () => {
  it('storage indisponível: o login funciona só em memória, sem quebrar', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    renderizarComAuth(<Sonda />)
    await act(async () => {
      await captura.auth.entrar('ana@example.com', 'senha da ana')
    })
    await aguardarStatus('autenticado')
    expect(lerToken()).toBe(tokenDe(ana))
  })

  it('ao desmontar, o client deixa de enviar o token', async () => {
    const { unmount } = renderizarComAuth(<Sonda />, { token: tokenDe(ana) })
    await aguardarStatus('autenticado')
    unmount()

    let autorizacao = 'não chamado'
    servidor.use(
      http.get(`${BASE}/auth/perfil`, ({ request }) => {
        autorizacao = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await get('/auth/perfil')
    expect(autorizacao).toBeNull()
  })

  it('useAuth fora do AuthProvider lança um erro claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Sonda />)).toThrow('useAuth deve ser usado dentro do AuthProvider')
  })
})
