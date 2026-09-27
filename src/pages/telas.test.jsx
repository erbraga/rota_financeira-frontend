import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import NaoEncontrada from './NaoEncontrada.jsx'

// Renderiza a tela na rota indicada, como o roteador da aplicação faria.
function renderizar(caminhoRota, urlAtual, Tela) {
  return render(
    <MemoryRouter initialEntries={[urlAtual]}>
      <Routes>
        <Route path={caminhoRota} element={<Tela />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NaoEncontrada', () => {
  it('mostra a mensagem e um link para as simulações', () => {
    renderizar('*', '/qualquer-coisa', NaoEncontrada)
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para minhas simulações' })).toHaveAttribute('href', '/simulacoes')
    expect(document.title).toBe('Página não encontrada · Rota Financeira')
  })
})
