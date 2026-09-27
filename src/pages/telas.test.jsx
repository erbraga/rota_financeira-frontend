import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Amortizacao from './Amortizacao.jsx'
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

describe('telas provisórias', () => {
  it.each([
    [
      '/simulacoes/:id/financiamentos/:fid',
      '/simulacoes/7/financiamentos/3',
      Amortizacao,
      'Amortização da opção #3',
    ],
  ])('%s mostra o título e "em construção"', (caminhoRota, urlAtual, Tela, titulo) => {
    renderizar(caminhoRota, urlAtual, Tela)
    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    expect(screen.getByText('Tela em construção.')).toBeInTheDocument()
  })

  it('a amortização mostra também a simulação de origem', () => {
    renderizar('/simulacoes/:id/financiamentos/:fid', '/simulacoes/7/financiamentos/3', Amortizacao)
    expect(screen.getByText('Simulação #7')).toBeInTheDocument()
  })
})

describe('NaoEncontrada', () => {
  it('mostra a mensagem e um link para as simulações', () => {
    renderizar('*', '/qualquer-coisa', NaoEncontrada)
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para minhas simulações' })).toHaveAttribute('href', '/simulacoes')
  })
})
