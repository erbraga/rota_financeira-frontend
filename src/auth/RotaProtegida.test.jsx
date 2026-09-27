import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { get } from '../api/api.js'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import RotaProtegida from './RotaProtegida.jsx'
import { lerToken } from './tokenStorage.js'
import { useAuth } from './useAuth.js'

// Tela de login de mentira: mostra o que a RotaProtegida entregou (state.de) e o aviso da sessão.
function LoginFalso() {
  const { aviso } = useAuth()
  const { state } = useLocation()
  return (
    <div>
      <p>tela de login</p>
      <p data-testid="de">{state?.de ?? 'sem-de'}</p>
      <p data-testid="aviso">{aviso ?? 'sem-aviso'}</p>
    </div>
  )
}

function Rotas() {
  return (
    <Routes>
      <Route path="/login" element={<LoginFalso />} />
      <Route element={<RotaProtegida />}>
        <Route path="/simulacoes/:id" element={<p>conteúdo privado</p>} />
      </Route>
    </Routes>
  )
}

let ana

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
})

describe('RotaProtegida', () => {
  it('sem sessão: vai a /login lembrando a rota pedida (com busca e âncora)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5?aba=2#topo' })
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(screen.getByTestId('de')).toHaveTextContent('/simulacoes/5?aba=2#topo')
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
  })

  it('com sessão válida: mostra o conteúdo (controle do redirecionamento)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5', token: tokenDe(ana) })
    expect(await screen.findByText('conteúdo privado')).toBeInTheDocument()
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument()
  })

  it('enquanto valida o token: mostra o carregamento, sem piscar o login nem o conteúdo', async () => {
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5', token: tokenDe(ana) })
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText('Verificando sua sessão…')).toBeInTheDocument()
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
    await screen.findByText('conteúdo privado')
  })

  it('token vencido (perfil 401): vai ao login com o aviso de sessão expirada, lembrando a rota', async () => {
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5', token: 'lixo' })
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(screen.getByTestId('aviso')).toHaveTextContent('sessao-expirada')
    expect(screen.getByTestId('de')).toHaveTextContent('/simulacoes/5')
    expect(lerToken()).toBeNull()
  })

  it('backend com erro ao validar: tela de erro com Tentar de novo e Sair, e o token é mantido', async () => {
    servidor.use(http.get('http://localhost:5000/api/auth/perfil', () => respostaErro(503, 'Serviço indisponível')))
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5', token: tokenDe(ana) })
    expect(await screen.findByText('Não foi possível verificar sua sessão')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(lerToken()).toBe(tokenDe(ana))
  })

  it('Tentar de novo: com o backend de volta, entra e mostra o conteúdo', async () => {
    servidor.use(http.get('http://localhost:5000/api/auth/perfil', () => respostaErro(503, 'Serviço indisponível')))
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5', token: tokenDe(ana) })
    await screen.findByText('Não foi possível verificar sua sessão')

    servidor.resetHandlers(...handlers)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('conteúdo privado')).toBeInTheDocument()
  })

  it('Sair na tela de erro: vai ao login SEM lembrar a rota, com o aviso de saída e o token apagado', async () => {
    servidor.use(http.get('http://localhost:5000/api/auth/perfil', () => respostaErro(503, 'Serviço indisponível')))
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/5', token: tokenDe(ana) })
    await screen.findByText('Não foi possível verificar sua sessão')

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(screen.getByTestId('aviso')).toHaveTextContent('saiu')
    expect(screen.getByTestId('de')).toHaveTextContent('sem-de')
    expect(lerToken()).toBeNull()
  })

  it('perder a sessão dentro da rota (401 numa chamada) leva ao login uma vez, lembrando a rota', async () => {
    renderizarComAuth(<Rotas />, { rota: '/simulacoes/9', token: tokenDe(ana) })
    await screen.findByText('conteúdo privado')

    servidor.use(http.get('http://localhost:5000/api/simulacoes', () => respostaErro(401, 'Token expirado')))
    await act(async () => {
      await get('/simulacoes').catch(() => {})
    })

    await waitFor(() => expect(screen.getByText('tela de login')).toBeInTheDocument())
    expect(screen.getByTestId('aviso')).toHaveTextContent('sessao-expirada')
    expect(screen.getByTestId('de')).toHaveTextContent('/simulacoes/9')
  })
})
