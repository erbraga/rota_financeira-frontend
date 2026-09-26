import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TelaConfiguracao from './TelaConfiguracao.jsx'

describe('TelaConfiguracao', () => {
  it('mostra o motivo do erro e como corrigir (não fica em branco)', () => {
    render(<TelaConfiguracao erro="A variável VITE_API_URL não está definida." />)
    expect(screen.getByRole('heading', { level: 1, name: 'Configuração ausente' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('A variável VITE_API_URL não está definida.')
    expect(screen.getByText(/cp \.env\.example \.env/)).toBeInTheDocument()
    expect(screen.getByText(/build-arg VITE_API_URL/)).toBeInTheDocument()
  })
})
