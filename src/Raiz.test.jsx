import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import Raiz from './Raiz.jsx'
import { servidor } from './mocks/servidor.js'
import { queryClient } from './queryClient.js'

afterEach(() => {
  queryClient.clear()
  window.history.pushState({}, '', '/')
})

describe('Raiz', () => {
  it('com a configuração válida, mostra o app na rota atual (controle da tela de configuração)', async () => {
    servidor.use(
      http.get('http://localhost:5000/api/saude', () => HttpResponse.json({ banco: 'ok', status: 'ok' })),
    )
    window.history.pushState({}, '', '/login')
    render(<Raiz />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
    expect(await screen.findByText('API conectada')).toBeInTheDocument()
    expect(screen.queryByText('Configuração ausente')).not.toBeInTheDocument()
  })

  it('com a configuração inválida, mostra a tela de configuração e NÃO chama a API', async () => {
    // Sem handler para /saude: se o app tentasse chamar a API, o MSW (onUnhandledRequest: "error") falharia o teste.
    render(<Raiz erroConfig="A variável VITE_API_URL não está definida." />)
    expect(screen.getByRole('heading', { level: 1, name: 'Configuração ausente' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_API_URL')
    expect(screen.queryByText('Rota Financeira')).not.toBeInTheDocument()
  })
})
