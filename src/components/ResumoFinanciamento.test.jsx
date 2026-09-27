import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FIXTURES_DE_PARCELAS } from '../mocks/handlers/parcelas.js'
import CartoesResumo, { TEXTO_DO_CUSTO_TOTAL } from './CartoesResumo.jsx'
import ResumoFinanciamento from './ResumoFinanciamento.jsx'
import { FIXTURES_DE_RESULTADO } from '../mocks/handlers/resultado.js'
import { MemoryRouter } from 'react-router-dom'

const norm = (texto) => texto.replaceAll(' ', ' ') // o Intl separa "R$" do número com um espaço sem quebra

function mostrar(fixture) {
  return render(<ResumoFinanciamento financiamento={fixture.financiamento} totais={fixture.totais} />)
}

// O texto do valor de uma linha "rótulo/valor" (lista de definição).
const valorDe = (rotulo) => norm(screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling.textContent)

describe('ResumoFinanciamento: Price 48x', () => {
  it('mostra os dados da opção formatados, exatamente os números da API', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(screen.getByRole('heading', { level: 2, name: 'Resumo do financiamento' })).toBeInTheDocument()
    expect(valorDe('Sistema')).toBe('Price')
    expect(valorDe('Taxa de juros')).toBe('1,50% a.m.')
    expect(valorDe('Prazo')).toBe('48 meses')
    expect(valorDe('Valor financiado')).toBe('R$ 75.000,00')
    expect(valorDe('Entrada')).toBe('R$ 20.000,00')
  })

  it('mostra os três totais como a API os devolve (nenhuma soma no cliente)', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(valorDe('Total pago')).toBe('R$ 105.750,09')
    expect(valorDe('Total de juros')).toBe('R$ 30.750,09')
    expect(valorDe('Custo total')).toBe('R$ 125.750,09')
  })

  it('a frase do custo total é a MESMA do resultado (texto compartilhado)', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(screen.getByText(TEXTO_DO_CUSTO_TOTAL)).toBeInTheDocument()
    render(
      <MemoryRouter>
        <CartoesResumo resultado={FIXTURES_DE_RESULTADO.padrao} simulacaoId={1} />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(TEXTO_DO_CUSTO_TOTAL)).toHaveLength(2)
    expect(TEXTO_DO_CUSTO_TOTAL).toContain('nominais')
    expect(TEXTO_DO_CUSTO_TOTAL).toContain('corrigido pelo IPCA')
  })
})

describe('ResumoFinanciamento: outras opções', () => {
  it('SAC 36x: "SAC", 1,30% a.m., 36 meses e os totais da SAC', () => {
    mostrar(FIXTURES_DE_PARCELAS.sac)
    expect(valorDe('Sistema')).toBe('SAC')
    expect(valorDe('Taxa de juros')).toBe('1,30% a.m.')
    expect(valorDe('Prazo')).toBe('36 meses')
    expect(valorDe('Valor financiado')).toBe('R$ 70.000,00')
    expect(valorDe('Entrada')).toBe('R$ 25.000,00')
    expect(valorDe('Total pago')).toBe('R$ 86.835,04')
    expect(valorDe('Total de juros')).toBe('R$ 16.835,04')
    expect(valorDe('Custo total')).toBe('R$ 111.835,04')
  })

  it('sem juros: taxa "0,00% a.m." e juros "R$ 0,00"', () => {
    mostrar(FIXTURES_DE_PARCELAS.semJuros)
    expect(valorDe('Taxa de juros')).toBe('0,00% a.m.')
    expect(valorDe('Total de juros')).toBe('R$ 0,00')
    expect(valorDe('Entrada')).toBe('R$ 0,00')
  })

  it('prazo de 1 mês fala "1 mês"', () => {
    mostrar(FIXTURES_DE_PARCELAS.umMes)
    expect(valorDe('Prazo')).toBe('1 mês')
  })

  it('financiado de centavos: valor "R$ 0,01" e total pago "R$ 0,01", como a API traz', () => {
    mostrar(FIXTURES_DE_PARCELAS.centavos)
    expect(valorDe('Valor financiado')).toBe('R$ 0,01')
    expect(valorDe('Total pago')).toBe('R$ 0,01')
    expect(valorDe('Custo total')).toBe('R$ 95.000,00')
  })

  it('valores grandes (milhões) cabem no texto formatado', () => {
    const fixture = { ...FIXTURES_DE_PARCELAS.price, totais: { total_pago: 1362095, total_juros: 1267095, custo_total: 11411660.11 } }
    mostrar(fixture)
    expect(valorDe('Total pago')).toBe('R$ 1.362.095,00')
    expect(valorDe('Custo total')).toBe('R$ 11.411.660,11')
  })

  it('não mostra nenhum texto de cálculo (nada de "restante", "economia" ou "média")', () => {
    const { container } = mostrar(FIXTURES_DE_PARCELAS.price)
    expect(container.textContent).not.toMatch(/restante|economia|média|por ano|já pago/i)
  })
})
