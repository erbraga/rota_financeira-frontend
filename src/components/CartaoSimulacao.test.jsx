import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CartaoSimulacao from './CartaoSimulacao.jsx'

// O Intl separa "R$" do número com um espaço sem quebra; nos testes comparamos com espaço comum.
const semNbsp = (texto) => texto.replaceAll(' ', ' ')

const SIMULACAO = {
  id: 7,
  nome: 'Onix 2026',
  valor_veiculo: 95000,
  valor_entrada: 20000,
  taxa_ipca_projetada: 4.5,
  taxa_fundo_rendimento: 12,
  prazo_meses_fundo: 36,
  criado_em: '2026-01-15T10:00:00-03:00',
}

function renderizar(props = {}) {
  const aoExcluir = vi.fn()
  render(
    <MemoryRouter>
      <CartaoSimulacao simulacao={SIMULACAO} aoExcluir={aoExcluir} {...props} />
    </MemoryRouter>,
  )
  return { aoExcluir }
}

describe('CartaoSimulacao', () => {
  it('mostra o nome (título de nível 2), o valor do veículo, a entrada e a data', () => {
    renderizar()
    expect(screen.getByRole('heading', { level: 2, name: 'Onix 2026' })).toBeInTheDocument()
    expect(semNbsp(screen.getByText('Valor do veículo').nextSibling.textContent)).toBe('R$ 95.000,00')
    expect(semNbsp(screen.getByText('Entrada').nextSibling.textContent)).toBe('R$ 20.000,00')
    expect(screen.getByText('Criada em').nextSibling).toHaveTextContent('15/01/2026')
  })

  it('a entrada zero aparece como R$ 0,00 (não some)', () => {
    renderizar({ simulacao: { ...SIMULACAO, valor_entrada: 0 } })
    expect(semNbsp(screen.getByText('Entrada').nextSibling.textContent)).toBe('R$ 0,00')
  })

  it('Ver resultado e Editar são links para as rotas certas', () => {
    renderizar()
    expect(screen.getByRole('link', { name: 'Ver resultado' })).toHaveAttribute('href', '/simulacoes/7/resultado')
    expect(screen.getByRole('link', { name: 'Editar simulação Onix 2026' })).toHaveAttribute('href', '/simulacoes/7/editar')
  })

  it('as ações têm nome acessível com o nome da simulação (dá para distinguir entre vários cartões)', () => {
    renderizar()
    expect(screen.getByRole('button', { name: 'Excluir simulação Onix 2026' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar simulação Onix 2026' })).toBeInTheDocument()
  })

  it('Excluir chama aoExcluir com a simulação (a confirmação é da tela)', async () => {
    const { aoExcluir } = renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir simulação Onix 2026' }))
    expect(aoExcluir).toHaveBeenCalledTimes(1)
    expect(aoExcluir).toHaveBeenCalledWith(SIMULACAO)
  })

  it('Ver resultado e Editar NÃO chamam aoExcluir (controle)', async () => {
    const { aoExcluir } = renderizar()
    await userEvent.click(screen.getByRole('link', { name: 'Editar simulação Onix 2026' }))
    expect(aoExcluir).not.toHaveBeenCalled()
  })

  it('um nome muito longo continua no cartão (quebra de linha, sem estourar)', () => {
    const nome = 'x'.repeat(120)
    renderizar({ simulacao: { ...SIMULACAO, nome } })
    expect(screen.getByRole('heading', { level: 2, name: nome })).toBeInTheDocument()
  })
})
