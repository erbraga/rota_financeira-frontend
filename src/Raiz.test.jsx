import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('Raiz: fronteira de erro GLOBAL (Etapa 8)', () => {
  // Um erro FORA do Layout (aqui, num provider que fica acima do roteador) não tem a fronteira por tela
  // (Layout.jsx) para capturá-lo: só a global (em volta de tudo, em Raiz) o pega, com a tela cheia. Mocka um
  // módulo real (não um componente de teste) e reimporta Raiz a fresco (vi.resetModules), pois a árvore já
  // tinha sido montada com a versão real no import estático do topo do arquivo, usado pelos outros testes.
  afterEach(() => {
    vi.doUnmock('./avisos/AvisosProvider.jsx')
    vi.resetModules()
  })

  it('mostra a tela cheia "Algo deu errado" com Recarregar a página, sem tela em branco', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    vi.doMock('./avisos/AvisosProvider.jsx', () => ({
      default: () => {
        throw new Error('Falha forçada fora do Layout')
      },
    }))
    const { default: RaizComErroForcado } = await import('./Raiz.jsx')

    window.history.pushState({}, '', '/login')
    render(<RaizComErroForcado />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Algo deu errado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recarregar a página' })).toBeInTheDocument()
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument()
  })
})
