import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FIXTURES_DE_PARCELAS } from '../mocks/handlers/parcelas.js'
import TabelaAmortizacao, { NOTA_DAS_PARCELAS_ZERADAS, NOTA_DO_SALDO } from './TabelaAmortizacao.jsx'

const norm = (texto) => texto.replaceAll(' ', ' ') // o Intl separa "R$" do número com um espaço sem quebra

function mostrar(fixture) {
  return render(<TabelaAmortizacao parcelas={fixture.parcelas} />)
}

// As linhas do corpo (sem o cabeçalho), cada uma como a lista dos textos das suas células.
const linhas = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((linha) => Array.from(linha.querySelectorAll('th, td')).map((c) => norm(c.textContent)))

describe('TabelaAmortizacao: estrutura', () => {
  it('tem o título, as cinco colunas e uma linha por mês (Price 48x tem 48; SAC 36x, 36)', () => {
    const { unmount } = mostrar(FIXTURES_DE_PARCELAS.price)
    expect(screen.getByRole('heading', { level: 2, name: 'Parcelas mês a mês' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Mês', 'Parcela', 'Juros', 'Amortização', 'Saldo devedor'])
    expect(linhas()).toHaveLength(48)
    unmount()
    mostrar(FIXTURES_DE_PARCELAS.sac)
    expect(linhas()).toHaveLength(36)
  })

  it('a tabela é acessível: região com nome, tabela nomeada e cabeçalhos de coluna com scope', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(screen.getByRole('region', { name: 'Parcelas mês a mês' })).toBeInTheDocument() // a seção
    expect(screen.getByRole('region', { name: 'Tabela de amortização, com rolagem' })).toBeInTheDocument() // o quadro rolável
    expect(screen.getByRole('table', { name: 'Parcelas mês a mês' })).toBeInTheDocument()
    for (const cabecalho of screen.getAllByRole('columnheader')) expect(cabecalho).toHaveAttribute('scope', 'col')
    expect(screen.getAllByRole('rowheader')).toHaveLength(48) // o número do mês identifica a linha
  })

  it('o quadro tem altura limitada, rola e recebe foco por teclado', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    const quadro = screen.getByRole('region', { name: 'Tabela de amortização, com rolagem' })
    expect(quadro).toHaveAttribute('tabindex', '0')
    expect(quadro).toHaveStyle({ overflow: 'auto' })
    // O jsdom não calcula `vh`: a altura máxima é conferida no CSS que o MUI gerou para o quadro.
    const css = Array.from(document.querySelectorAll('style')).map((estilo) => estilo.textContent).join('')
    expect(css).toMatch(new RegExp(`\\.${quadro.className.split(' ').find((c) => c.startsWith('css-'))}[^{]*\\{[^}]*max-height:\\s*60vh`))
    quadro.focus()
    expect(quadro).toHaveFocus()
  })

  it('o cabeçalho das colunas é fixo (sticky) enquanto se rola as linhas', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    for (const cabecalho of screen.getAllByRole('columnheader')) expect(cabecalho).toHaveStyle({ position: 'sticky' })
    // controle: as células do corpo NÃO são fixas
    expect(screen.getAllByRole('cell')[0]).not.toHaveStyle({ position: 'sticky' })
  })

  it('a nota do saldo (depois do pagamento) está sempre visível', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(screen.getByText(NOTA_DO_SALDO)).toBeInTheDocument()
  })
})

describe('TabelaAmortizacao: valores como a API traz (Price 48x)', () => {
  it('primeira linha: mês 1, parcela, juros, amortização e saldo depois do pagamento', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(linhas()[0]).toEqual(['1', 'R$ 2.203,12', 'R$ 1.125,00', 'R$ 1.078,12', 'R$ 73.921,88'])
    expect(linhas()[1]).toEqual(['2', 'R$ 2.203,12', 'R$ 1.108,83', 'R$ 1.094,29', 'R$ 72.827,59'])
  })

  it('última linha: a parcela absorve o resíduo (2.203,45) e o saldo fecha em R$ 0,00', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(linhas().at(-1)).toEqual(['48', 'R$ 2.203,45', 'R$ 32,56', 'R$ 2.170,89', 'R$ 0,00'])
  })

  it('os números dos meses vão de 1 ao prazo, na ordem', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(linhas().map((l) => l[0])).toEqual(Array.from({ length: 48 }, (_, i) => String(i + 1)))
  })
})

describe('TabelaAmortizacao: SAC 36x', () => {
  it('amortização constante e parcelas decrescentes, exatamente como vêm', () => {
    mostrar(FIXTURES_DE_PARCELAS.sac)
    expect(linhas()[0]).toEqual(['1', 'R$ 2.854,44', 'R$ 910,00', 'R$ 1.944,44', 'R$ 68.055,56'])
    expect(linhas()[1]).toEqual(['2', 'R$ 2.829,16', 'R$ 884,72', 'R$ 1.944,44', 'R$ 66.111,12'])
    expect(linhas().at(-1)).toEqual(['36', 'R$ 1.969,88', 'R$ 25,28', 'R$ 1.944,60', 'R$ 0,00'])
  })
})

describe('TabelaAmortizacao: casos extremos', () => {
  it('sem juros: R$ 0,00 de juros em todas as linhas e 72 linhas', () => {
    mostrar(FIXTURES_DE_PARCELAS.semJuros)
    expect(linhas()).toHaveLength(72)
    expect(linhas().every((l) => l[2] === 'R$ 0,00')).toBe(true)
    expect(linhas()[0]).toEqual(['1', 'R$ 1.319,44', 'R$ 0,00', 'R$ 1.319,44', 'R$ 93.680,56'])
    expect(linhas().at(-1)).toEqual(['72', 'R$ 1.319,76', 'R$ 0,00', 'R$ 1.319,76', 'R$ 0,00'])
  })

  it('prazo de 1 mês: uma linha só', () => {
    mostrar(FIXTURES_DE_PARCELAS.umMes)
    expect(linhas()).toEqual([['1', 'R$ 76.125,00', 'R$ 1.125,00', 'R$ 75.000,00', 'R$ 0,00']])
  })

  it('centavos: 71 linhas de R$ 0,00 e a última de R$ 0,01, COM a nota das parcelas zeradas', () => {
    mostrar(FIXTURES_DE_PARCELAS.centavos)
    expect(linhas()).toHaveLength(72)
    expect(linhas().filter((l) => l[1] === 'R$ 0,00')).toHaveLength(71)
    expect(linhas().at(-1)).toEqual(['72', 'R$ 0,01', 'R$ 0,00', 'R$ 0,01', 'R$ 0,00'])
    expect(screen.getByText(NOTA_DAS_PARCELAS_ZERADAS)).toBeInTheDocument()
  })

  it('quitação antecipada: o saldo já é R$ 0,00 na linha 2 e a linha 3 sai zerada, COM a nota', () => {
    mostrar(FIXTURES_DE_PARCELAS.quitacaoAntecipada)
    expect(linhas()).toEqual([
      ['1', 'R$ 0,01', 'R$ 0,00', 'R$ 0,01', 'R$ 0,01'],
      ['2', 'R$ 0,01', 'R$ 0,00', 'R$ 0,01', 'R$ 0,00'],
      ['3', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00'],
    ])
    expect(screen.getByText(NOTA_DAS_PARCELAS_ZERADAS)).toBeInTheDocument()
  })

  it.each(['price', 'sac', 'semJuros', 'umMes'])('controle: %s (sem linha zerada) NÃO mostra a nota das parcelas zeradas', (nome) => {
    mostrar(FIXTURES_DE_PARCELAS[nome])
    expect(screen.queryByText(NOTA_DAS_PARCELAS_ZERADAS)).not.toBeInTheDocument()
  })

  it('valores grandes (milhões) mantêm o texto formatado e o alinhamento à direita', () => {
    render(
      <TabelaAmortizacao
        parcelas={[{ numero: 1, valor_parcela: 1362095, juros: 1267095, amortizacao: 95000, saldo_devedor: 11411660.11 }]}
      />,
    )
    expect(linhas()[0]).toEqual(['1', 'R$ 1.362.095,00', 'R$ 1.267.095,00', 'R$ 95.000,00', 'R$ 11.411.660,11'])
    for (const celula of screen.getAllByRole('cell')) expect(celula).toHaveStyle({ textAlign: 'right' })
  })

  it('nenhuma linha é somada, agrupada ou acrescentada (só as linhas da API, sem linha de totais)', () => {
    mostrar(FIXTURES_DE_PARCELAS.price)
    expect(screen.getAllByRole('row')).toHaveLength(49) // cabeçalho + 48
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument()
  })
})
