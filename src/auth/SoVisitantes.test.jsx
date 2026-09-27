import { screen } from '@testing-library/react'
import { http } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { respostaErro } from '../mocks/erros.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import SoVisitantes from './SoVisitantes.jsx'
import { useAuth } from './useAuth.js'

function FormularioFalso() {
  const { aviso } = useAuth()
  return (
    <div>
      <p>formulário de login</p>
      <p data-testid="aviso">{aviso ?? 'sem-aviso'}</p>
    </div>
  )
}

function Rotas() {
  return (
    <Routes>
      <Route element={<SoVisitantes />}>
        <Route path="/login" element={<FormularioFalso />} />
        <Route path="/registrar" element={<p>formulário de registro</p>} />
      </Route>
      <Route path="/simulacoes" element={<p>área privada</p>} />
      <Route path="/simulacoes/:id/resultado" element={<p>resultado pedido</p>} />
    </Routes>
  )
}

let ana

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana', email: 'ana@example.com' })
})

describe('SoVisitantes', () => {
  it('sem sessão: /login e /registrar abrem normalmente (controle do redirecionamento)', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    expect(await screen.findByText('formulário de login')).toBeInTheDocument()
  })

  it('sem sessão: /registrar abre', async () => {
    renderizarComAuth(<Rotas />, { rota: '/registrar' })
    expect(await screen.findByText('formulário de registro')).toBeInTheDocument()
  })

  it.each(['/login', '/registrar'])('com sessão válida: %s redireciona para /simulacoes', async (rota) => {
    renderizarComAuth(<Rotas />, { rota, token: tokenDe(ana) })
    expect(await screen.findByText('área privada')).toBeInTheDocument()
    expect(screen.queryByText('formulário de login')).not.toBeInTheDocument()
    expect(screen.queryByText('formulário de registro')).not.toBeInTheDocument()
  })

  it('validando o token: mostra o carregamento, sem piscar o formulário', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login', token: tokenDe(ana) })
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByText('formulário de login')).not.toBeInTheDocument()
    await screen.findByText('área privada')
  })

  it('token vencido: a sessão é descartada e a pessoa CONTINUA em /login, com o aviso de sessão expirada', async () => {
    renderizarComAuth(<Rotas />, { rota: '/login', token: 'lixo' })
    expect(await screen.findByText('formulário de login')).toBeInTheDocument()
    expect(screen.getByTestId('aviso')).toHaveTextContent('sessao-expirada')
    expect(screen.queryByText('área privada')).not.toBeInTheDocument()
  })

  it('backend com erro ao validar: o formulário abre (não bloqueia quem quer entrar)', async () => {
    servidor.use(http.get('http://localhost:5000/api/auth/perfil', () => respostaErro(503, 'Serviço indisponível')))
    renderizarComAuth(<Rotas />, { rota: '/login', token: tokenDe(ana) })
    expect(await screen.findByText('formulário de login')).toBeInTheDocument()
  })

  it('com sessão válida e uma rota pedida (state.de), vai para ela em vez de /simulacoes', async () => {
    renderizarComAuth(<Rotas />, {
      rota: { pathname: '/login', state: { de: '/simulacoes/7/resultado' } },
      token: tokenDe(ana),
    })
    expect(await screen.findByText('resultado pedido')).toBeInTheDocument()
    expect(screen.queryByText('área privada')).not.toBeInTheDocument()
  })

  it.each(['https://evil.com', '//evil.com', '/login', 'javascript:alert(1)'])(
    'state.de inseguro (%s) é ignorado: vai para /simulacoes',
    async (de) => {
      renderizarComAuth(<Rotas />, { rota: { pathname: '/login', state: { de } }, token: tokenDe(ana) })
      expect(await screen.findByText('área privada')).toBeInTheDocument()
    },
  )
})
