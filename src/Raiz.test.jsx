import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gravarToken } from './auth/tokenStorage.js'
import { criarUsuario, tokenDe } from './mocks/banco.js'
import { handlers } from './mocks/handlers/index.js'
import { servidor } from './mocks/servidor.js'
import { queryClient } from './queryClient.js'
import Raiz from './Raiz.jsx'

beforeEach(() => {
  servidor.use(...handlers)
})

afterEach(() => {
  queryClient.clear()
  window.history.pushState({}, '', '/')
})

describe('Raiz', () => {
  it('com a configuração válida e sem sessão, mostra o app na rota atual (controle da tela de configuração)', async () => {
    window.history.pushState({}, '', '/login')
    render(<Raiz />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('Configuração ausente')).not.toBeInTheDocument()
  })

  it('com sessão guardada, valida o token e mostra a área privada (AuthProvider dentro do roteador)', async () => {
    const usuario = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' })
    gravarToken(tokenDe(usuario))
    window.history.pushState({}, '', '/simulacoes')
    render(<Raiz />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Minhas simulações' })).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    await screen.findByText('Nenhuma simulação ainda')
  })

  it('com a configuração inválida, mostra a tela de configuração e NÃO chama a API', async () => {
    // Sem token nem chamada esperada: se o app tentasse chamar a API sem handler, o MSW (onUnhandledRequest: "error") falharia o teste.
    servidor.resetHandlers()
    render(<Raiz erroConfig="A variável VITE_API_URL não está definida." />)
    expect(screen.getByRole('heading', { level: 1, name: 'Configuração ausente' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_API_URL')
    expect(screen.queryByText('Rota Financeira')).not.toBeInTheDocument()
  })
})
