import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { renderizarComAuth } from '../testUtils.jsx'
import LayoutPublico from './LayoutPublico.jsx'

function Rotas() {
  return (
    <Routes>
      <Route element={<LayoutPublico />}>
        <Route path="/login" element={<h1>Entrar</h1>} />
      </Route>
    </Routes>
  )
}

describe('LayoutPublico', () => {
  it('mostra o nome do app e a rota filha num cartão', () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    expect(screen.getByText('Rota Financeira')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Entrar' }))
  })

  it('NÃO mostra usuário nem Sair, mesmo se houver sessão (controle: o Layout privado mostra)', async () => {
    const usuario = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' })
    renderizarComAuth(<Rotas />, { rota: '/login', token: tokenDe(usuario) })
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it('o nome do app não é um título (cada tela tem o seu h1)', () => {
    renderizarComAuth(<Rotas />, { rota: '/login' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
