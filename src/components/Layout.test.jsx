import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { lerToken } from '../auth/tokenStorage.js'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Layout from './Layout.jsx'

function Rotas() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/teste" element={<p>Conteúdo da rota</p>} />
      </Route>
    </Routes>
  )
}

let ana

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' })
})

describe('Layout (telas privadas)', () => {
  it('mostra a barra com o nome do app, o nome do usuário, o Sair e a rota filha', async () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Conteúdo da rota')
  })

  it('o nome do app é um link para /simulacoes', () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(screen.getByRole('link', { name: 'Rota Financeira' })).toHaveAttribute('href', '/simulacoes')
  })

  it('Sair encerra a sessão: apaga o token e avisa que saiu', async () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    await screen.findByText('Ana Souza')

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(lerToken()).toBeNull())
    expect(sessionStorage.getItem('rota-financeira.token')).toBeNull()
  })

  it('enquanto o usuário não chegou do perfil, não mostra nome (e não quebra)', () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('não existe mais o indicador temporário "API conectada"', async () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    await screen.findByText('Ana Souza')
    expect(screen.queryByText(/API conectada/)).not.toBeInTheDocument()
  })
})
