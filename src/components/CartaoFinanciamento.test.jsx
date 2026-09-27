import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CartaoFinanciamento from './CartaoFinanciamento.jsx'

const OPCAO = { id: 7, nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'PRICE', valor_entrada: 10000 }

function mostrar(alteracao = {}) {
  const aoEditar = vi.fn()
  const aoExcluir = vi.fn()
  const financiamento = { ...OPCAO, ...alteracao }
  const resultado = render(<CartaoFinanciamento financiamento={financiamento} aoEditar={aoEditar} aoExcluir={aoExcluir} />)
  return { aoEditar, aoExcluir, financiamento, ...resultado }
}

const norm = (texto) => texto.replaceAll('\u00a0', ' ') // o Intl separa "R$" do número com um espaço sem quebra

describe('CartaoFinanciamento: dados', () => {
  it('mostra nome, sistema, taxa "% a.m.", prazo e entrada, formatados', () => {
    mostrar()
    expect(screen.getByRole('heading', { level: 3, name: 'Banco A' })).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('1,50% a.m.')).toBeInTheDocument()
    expect(screen.getByText('48 meses')).toBeInTheDocument()
    expect(norm(screen.getByText(/R\$/).textContent)).toBe('R$ 10.000,00')
  })

  it('SAC, prazo 1 ("1 mês"), taxa 0 ("0,00% a.m.") e entrada 0 ("R$ 0,00")', () => {
    mostrar({ sistema_amortizacao: 'SAC', prazo_meses: 1, taxa_juros_mensal: 0, valor_entrada: 0 })
    expect(screen.getByText('SAC')).toBeInTheDocument()
    expect(screen.queryByText('Price')).not.toBeInTheDocument()
    expect(screen.getByText('1 mês')).toBeInTheDocument()
    expect(screen.getByText('0,00% a.m.')).toBeInTheDocument()
    expect(norm(screen.getByText(/R\$/).textContent)).toBe('R$ 0,00')
  })

  it('a taxa com casas mostra até 6 casas, sem arredondar', () => {
    mostrar({ taxa_juros_mensal: 1.234567 })
    expect(screen.getByText('1,234567% a.m.')).toBeInTheDocument()
  })

  it('nome de 120 caracteres quebra a linha (overflowWrap) em vez de estourar o cartão', () => {
    mostrar({ nome: 'x'.repeat(120) })
    expect(screen.getByRole('heading', { level: 3 })).toHaveStyle({ overflowWrap: 'anywhere' })
  })

  it('NÃO mostra valor financiado, parcela nem total (o frontend não calcula; só o /resultado os entrega)', () => {
    const { container } = mostrar()
    expect(container.textContent).not.toMatch(/financiado|parcela|total|custo/i)
  })
})

describe('CartaoFinanciamento: ações', () => {
  it('Editar e Excluir têm o nome da opção e chamam a ação com ela', async () => {
    const { aoEditar, aoExcluir, financiamento } = mostrar()
    await userEvent.click(screen.getByRole('button', { name: 'Editar opção Banco A' }))
    expect(aoEditar).toHaveBeenCalledExactlyOnceWith(financiamento)
    expect(aoExcluir).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Excluir opção Banco A' }))
    expect(aoExcluir).toHaveBeenCalledExactlyOnceWith(financiamento)
    expect(aoEditar).toHaveBeenCalledTimes(1)
  })

  it('só há as duas ações (sem link para resultado nem amortização, que ainda não existem)', () => {
    const { container } = mostrar()
    expect(within(container).getAllByRole('button')).toHaveLength(2)
    expect(within(container).queryByRole('link')).not.toBeInTheDocument()
  })
})
