import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.jsx'
import { criarUsuario, tokenDe } from './mocks/banco.js'
import { handlers } from './mocks/handlers/index.js'
import { servidor } from './mocks/servidor.js'
import { renderizarComAuth } from './testUtils.jsx'

let token

beforeEach(() => {
  servidor.use(...handlers)
  token = tokenDe(criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' }))
})

const h1 = (nome) => screen.findByRole('heading', { level: 1, name: nome })

describe('rotas privadas (com sessão)', () => {
  it.each([
    ['/simulacoes', 'Minhas simulações'],
    ['/simulacoes/nova', 'Nova simulação'],
    ['/simulacoes/1/editar', 'Editar simulação #1'],
    ['/simulacoes/1/resultado', 'Resultado da simulação #1'],
    ['/simulacoes/1/financiamentos/2', 'Amortização da opção #2'],
  ])('%s mostra "%s", dentro do layout com o nome do usuário e o Sair', async (rota, titulo) => {
    renderizarComAuth(<App />, { rota, token })
    expect(await h1(titulo)).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('/ redireciona para as simulações', async () => {
    renderizarComAuth(<App />, { rota: '/', token })
    expect(await h1('Minhas simulações')).toBeInTheDocument()
  })

  it.each(['/login', '/registrar'])('%s redireciona quem já está logado para as simulações', async (rota) => {
    renderizarComAuth(<App />, { rota, token })
    expect(await h1('Minhas simulações')).toBeInTheDocument()
  })
})

describe('rotas privadas (sem sessão)', () => {
  it.each(['/simulacoes', '/simulacoes/nova', '/simulacoes/1/editar', '/simulacoes/1/resultado', '/simulacoes/1/financiamentos/1', '/'])(
    '%s leva a /login, sem mostrar nada da área privada',
    async (rota) => {
      renderizarComAuth(<App />, { rota })
      expect(await h1('Entrar')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
      expect(screen.queryByText('Minhas simulações')).not.toBeInTheDocument()
    },
  )
})

describe('rotas públicas', () => {
  it.each([
    ['/login', 'Entrar'],
    ['/registrar', 'Criar conta'],
  ])('%s abre sem sessão, no layout público (sem nome de usuário nem Sair)', async (rota, titulo) => {
    renderizarComAuth(<App />, { rota })
    expect(await h1(titulo)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it.each(['/qualquer-coisa', '/simulacoes/1', '/simulacoes/1/financiamentos', '/login/extra'])(
    'rota desconhecida %s mostra a 404 da SPA',
    async (rota) => {
      renderizarComAuth(<App />, { rota })
      expect(await h1('Página não encontrada')).toBeInTheDocument()
    },
  )

  it('a 404 é igual com sessão (no layout público, sem a barra do usuário)', async () => {
    renderizarComAuth(<App />, { rota: '/qualquer-coisa', token })
    expect(await h1('Página não encontrada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })
})
