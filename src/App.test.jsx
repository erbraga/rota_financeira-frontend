import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.jsx'
import { servidor } from './mocks/servidor.js'
import { renderizar } from './testUtils.jsx'

const SAUDE = 'http://localhost:5000/api/saude'

beforeEach(() => {
  servidor.use(http.get(SAUDE, () => HttpResponse.json({ banco: 'ok', status: 'ok' })))
})

describe('rotas da SPA', () => {
  it.each([
    ['/login', 'Entrar'],
    ['/registrar', 'Criar conta'],
    ['/simulacoes', 'Minhas simulações'],
    ['/simulacoes/nova', 'Nova simulação'],
    ['/simulacoes/1/editar', 'Editar simulação #1'],
    ['/simulacoes/1/resultado', 'Resultado da simulação #1'],
    ['/simulacoes/1/financiamentos/2', 'Amortização da opção #2'],
  ])('%s mostra a tela provisória "%s"', async (rota, titulo) => {
    renderizar(<App />, { rota })
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument()
    await screen.findByText('API conectada')
  })

  it('/ redireciona para as simulações', async () => {
    renderizar(<App />, { rota: '/' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Minhas simulações' })).toBeInTheDocument()
    await screen.findByText('API conectada')
  })

  it.each(['/qualquer-coisa', '/simulacoes/1', '/simulacoes/1/financiamentos', '/login/extra'])(
    'rota desconhecida %s mostra a 404 da SPA',
    async (rota) => {
      renderizar(<App />, { rota })
      expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      await screen.findByText('API conectada')
    },
  )

  it('toda tela aparece dentro do layout, com o nome do app e o estado da API', async () => {
    renderizar(<App />, { rota: '/simulacoes' })
    expect(screen.getByText('Rota Financeira')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Minhas simulações')
    expect(await screen.findByText('API conectada')).toBeInTheDocument()
  })

  it('com a API fora do ar, mostra o aviso de rede e a SPA continua navegável', async () => {
    servidor.use(http.get(SAUDE, () => HttpResponse.error()))
    renderizar(<App />, { rota: '/simulacoes' })
    expect(await screen.findByText('Sem conexão com o servidor')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Minhas simulações' })).toBeInTheDocument()
  })

  it('com a API respondendo 503, mostra o erro da API e a SPA continua navegável', async () => {
    servidor.use(http.get(SAUDE, () => HttpResponse.json({ erro: 'Banco indisponível' }, { status: 503 })))
    renderizar(<App />, { rota: '/login' })
    expect(await screen.findByText('Erro da API: Banco indisponível')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  })
})
