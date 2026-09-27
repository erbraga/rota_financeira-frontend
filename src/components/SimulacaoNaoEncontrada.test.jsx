import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderizar } from '../testUtils.jsx'
import SimulacaoNaoEncontrada from './SimulacaoNaoEncontrada.jsx'

describe('SimulacaoNaoEncontrada', () => {
  it('mostra o título, a explicação e o link ao histórico', () => {
    renderizar(<SimulacaoNaoEncontrada />)
    expect(screen.getByRole('heading', { level: 1, name: 'Simulação não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Ela pode ter sido excluída ou não existe.')).toBeInTheDocument()
    expect(screen.getByText('Volte ao histórico para ver as suas simulações.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
  })

  it('não revela nada da simulação (sem nome, valores nem id): serve à alheia e à inexistente do mesmo jeito', () => {
    const { container } = renderizar(<SimulacaoNaoEncontrada />)
    expect(container.textContent).not.toMatch(/R\$|#\d|id /i)
  })
})
