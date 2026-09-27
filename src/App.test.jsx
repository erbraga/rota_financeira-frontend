import { screen } from '@testing-library/react'
import { lazy, Suspense, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import CarregandoTela from './components/CarregandoTela.jsx'
import Layout from './components/Layout.jsx'
import { criarFinanciamento, criarSimulacao, criarUsuario, tokenDe } from './mocks/banco.js'
import { handlers } from './mocks/handlers/index.js'
import { servidor } from './mocks/servidor.js'
import { renderizarComAuth } from './testUtils.jsx'

let token

beforeEach(() => {
  servidor.use(...handlers)
  const ana = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' })
  token = tokenDe(ana)
  // Simulação 1 da Ana, com a opção 1: as telas carregam por id (sem elas seriam "não encontrada").
  criarFinanciamento(criarSimulacao(ana.id, { nome: 'Onix' }).id)
})

const h1 = (nome) => screen.findByRole('heading', { level: 1, name: nome })

describe('rotas privadas (com sessão)', () => {
  it.each([
    ['/simulacoes', 'Minhas simulações'],
    ['/simulacoes/nova', 'Nova simulação'],
    ['/simulacoes/1/editar', 'Editar simulação'],
    ['/simulacoes/1/resultado', 'Resultado: Carro de exemplo'],
    ['/simulacoes/1/financiamentos/1', 'Amortização: Banco Exemplo Price 48x'],
  ])('%s mostra "%s", dentro do layout com o nome do usuário e o Sair', async (rota, titulo) => {
    renderizarComAuth(<App />, { rota, token })
    expect(await h1(titulo)).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    // A tela real do histórico busca a lista: espera terminar para nada resolver depois do teste.
    if (rota === '/simulacoes') await screen.findByRole('heading', { level: 2, name: 'Onix' })
    if (rota === '/simulacoes/1/editar') await screen.findByLabelText('Nome da simulação')
    if (rota === '/simulacoes/1/resultado') await screen.findByRole('heading', { level: 2, name: 'Evolução mês a mês' })
    if (rota === '/simulacoes/1/financiamentos/1') await screen.findByRole('heading', { level: 2, name: 'Parcelas mês a mês' })
  })

  it('/ redireciona para as simulações', async () => {
    renderizarComAuth(<App />, { rota: '/', token })
    expect(await h1('Minhas simulações')).toBeInTheDocument()
    await screen.findByRole('heading', { level: 2, name: 'Onix' })
  })

  it.each(['/login', '/registrar'])('%s redireciona quem já está logado para as simulações', async (rota) => {
    renderizarComAuth(<App />, { rota, token })
    expect(await h1('Minhas simulações')).toBeInTheDocument()
    await screen.findByRole('heading', { level: 2, name: 'Onix' })
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

// ---- O padrão das rotas sob demanda (React.lazy + Suspense, Etapa 8), usado por Resultado e Amortização --------
// Em vez de mockar o módulo real da página (o que exigiria vi.resetModules, e resetaria também o contexto do
// AuthProvider que o testUtils já tinha carregado, quebrando os outros testes do arquivo), usa um componente
// FALSO por trás de um React.lazy controlado por uma comporta: exercita o mesmo Layout > ErrorBoundary >
// Suspense > lazy que o App.jsx real usa nas duas rotas, com controle total sobre quando o "pacote" chega.
function RotaSobDemanda({ carregar }) {
  const [TelaFalsa] = useState(() => lazy(carregar))
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/teste-lazy"
          element={
            <Suspense fallback={<CarregandoTela />}>
              <TelaFalsa />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}

describe('App: o padrão das rotas sob demanda (React.lazy + Suspense), usado por Resultado e Amortização', () => {
  it('mostra o esqueleto (CarregandoTela) enquanto o pacote não chegou, e depois a tela (comporta)', async () => {
    let liberar
    const comporta = new Promise((resolver) => {
      liberar = resolver
    })
    const carregar = () => comporta.then(() => ({ default: () => <h1>Tela carregada</h1> }))
    renderizarComAuth(<RotaSobDemanda carregar={carregar} />, { rota: '/teste-lazy', token })
    expect(await screen.findByRole('status', { name: 'Carregando a tela' })).toBeInTheDocument()

    liberar()
    expect(await h1('Tela carregada')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Carregando a tela' })).not.toBeInTheDocument()
  })

  it('se o pacote falhar em carregar, a fronteira por tela do Layout mostra o erro com Tentar de novo (nunca tela em branco)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const carregar = () => Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/x.js'))
    renderizarComAuth(<RotaSobDemanda carregar={carregar} />, { rota: '/teste-lazy', token })

    expect(await h1('Algo deu errado nesta tela')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    // A barra do Layout (fora da fronteira por tela) continua funcionando.
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })
})
