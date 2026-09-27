import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FIXTURES_DE_RESULTADO } from '../mocks/handlers/resultado.js'
import GraficoComparativo from './GraficoComparativo.jsx'

// O jsdom não mede o layout: o ResponsiveContainer recebe um tamanho fixo (só o layout é trocado, o gráfico é o de verdade).
vi.mock('recharts', async (importarOriginal) => {
  const real = await importarOriginal()
  const { cloneElement } = await import('react')
  return {
    ...real,
    ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 320 }),
  }
})

const { tresOpcoes, semOpcoes, padrao } = FIXTURES_DE_RESULTADO
const norm = (texto) => texto.replaceAll(' ', ' ')

function mostrar(resultado) {
  return render(<GraficoComparativo series={resultado.series} financiamentos={resultado.cenarios.financiamentos} />)
}

const legenda = () => screen.getAllByRole('button')
const curvas = () => Array.from(document.querySelectorAll('path.recharts-line-curve'))

describe('GraficoComparativo: linhas', () => {
  it('3 opções: 5 linhas desenhadas (3 dívidas, fundo e preço) e 5 entradas na legenda com os nomes', () => {
    mostrar(tresOpcoes)
    expect(curvas()).toHaveLength(5)
    expect(legenda().map((b) => b.textContent)).toEqual([
      'Banco Exemplo Price 48x',
      'Banco Exemplo SAC 36x',
      'Banco Exemplo Sem Juros 72x',
      'Saldo do fundo',
      'Preço do carro corrigido (IPCA)',
    ])
  })

  it('sem opções só há o fundo e o preço corrigido', () => {
    mostrar(semOpcoes)
    expect(curvas()).toHaveLength(2)
    expect(legenda().map((b) => b.textContent)).toEqual(['Saldo do fundo', 'Preço do carro corrigido (IPCA)'])
  })

  it('duas opções (resultado padrão): 4 linhas', () => {
    mostrar(padrao)
    expect(curvas()).toHaveLength(4)
  })

  it('cada linha se distingue por cor E por traço (não só cor)', () => {
    mostrar(tresOpcoes)
    const estilos = curvas().map((c) => `${c.getAttribute('stroke')}|${c.getAttribute('stroke-dasharray') ?? 'contínuo'}`)
    expect(new Set(estilos).size).toBe(5)
    expect(new Set(curvas().map((c) => c.getAttribute('stroke-dasharray') ?? 'contínuo')).size).toBeGreaterThanOrEqual(3)
  })

  it('o título da seção está presente', () => {
    mostrar(tresOpcoes)
    expect(screen.getByRole('heading', { level: 2, name: 'Evolução mês a mês' })).toBeInTheDocument()
  })
})

describe('GraficoComparativo: legenda que oculta e mostra', () => {
  it('começa com todas visíveis (aria-pressed true)', () => {
    mostrar(tresOpcoes)
    for (const botao of legenda()) expect(botao).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicar oculta a linha (some do gráfico e o estado é anunciado); clicar de novo a mostra', async () => {
    mostrar(tresOpcoes)
    const price = screen.getByRole('button', { name: 'Banco Exemplo Price 48x' })
    await userEvent.click(price)
    expect(price).toHaveAttribute('aria-pressed', 'false')
    expect(curvas()).toHaveLength(4)
    // as outras continuam visíveis (controle: só a clicada some)
    expect(screen.getByRole('button', { name: 'Saldo do fundo' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(price)
    expect(price).toHaveAttribute('aria-pressed', 'true')
    expect(curvas()).toHaveLength(5)
  })

  it('a entrada oculta continua na legenda (para poder mostrar de novo)', async () => {
    mostrar(tresOpcoes)
    await userEvent.click(screen.getByRole('button', { name: 'Saldo do fundo' }))
    expect(screen.getByRole('button', { name: 'Saldo do fundo' })).toBeInTheDocument()
    expect(legenda()).toHaveLength(5)
  })

  it('funciona pelo teclado (Enter e espaço)', async () => {
    mostrar(tresOpcoes)
    const preco = screen.getByRole('button', { name: 'Preço do carro corrigido (IPCA)' })
    preco.focus()
    await userEvent.keyboard('{Enter}')
    expect(preco).toHaveAttribute('aria-pressed', 'false')
    await userEvent.keyboard(' ')
    expect(preco).toHaveAttribute('aria-pressed', 'true')
  })

  it('ocultar todas deixa o gráfico sem linhas, mas a legenda inteira', async () => {
    mostrar(semOpcoes)
    for (const botao of legenda()) await userEvent.click(botao)
    expect(curvas()).toHaveLength(0)
    expect(legenda()).toHaveLength(2)
  })
})

describe('GraficoComparativo: null não liga lacunas e não vira zero', () => {
  // Uma série com um buraco NO MEIO (saldo_fundo null no mês 2): a linha tem de ter uma quebra.
  const comBuraco = {
    cenarios: { financiamentos: [] },
    series: [
      { mes: 0, preco_corrigido: 100, saldo_fundo: 10, saldo_devedor: {} },
      { mes: 1, preco_corrigido: 110, saldo_fundo: 20, saldo_devedor: {} },
      { mes: 2, preco_corrigido: 120, saldo_fundo: null, saldo_devedor: {} },
      { mes: 3, preco_corrigido: 130, saldo_fundo: 40, saldo_devedor: {} },
      { mes: 4, preco_corrigido: 140, saldo_fundo: 50, saldo_devedor: {} },
    ],
  }

  it('o buraco do meio quebra a linha em dois trechos (dois "M" no desenho), sem ligá-los', () => {
    mostrar(comBuraco)
    const fundo = curvas().find((c) => c.getAttribute('stroke-dasharray') === null)
    expect((fundo.getAttribute('d').match(/M/g) ?? []).length).toBe(2)
  })

  it('controle: o preço corrigido (sem buraco) é UM trecho só', () => {
    mostrar(comBuraco)
    const preco = curvas().find((c) => c.getAttribute('stroke-dasharray') === '8 4')
    expect((preco.getAttribute('d').match(/M/g) ?? []).length).toBe(1)
  })

  it('a linha termina onde a série termina (a SAC de 36 meses não vai até o mês 72)', () => {
    mostrar(tresOpcoes)
    const [price, sac, semJuros] = curvas()
    const xFinal = (curva) => Number(curva.getAttribute('d').split(/[ML]/).filter(Boolean).at(-1).split(',')[0])
    expect(xFinal(sac)).toBeLessThan(xFinal(price)) // 36 < 48
    expect(xFinal(price)).toBeLessThan(xFinal(semJuros)) // 48 < 72
  })
})

describe('GraficoComparativo: alternativa em texto e acessibilidade', () => {
  it('a figura tem nome (o título) e a descrição com os pontos-chave lidos da série', () => {
    mostrar(tresOpcoes)
    const figura = screen.getByRole('figure', { name: 'Evolução mês a mês' })
    const descricao = norm(figura.getAttribute('aria-describedby') ? document.getElementById(figura.getAttribute('aria-describedby')).textContent : '')
    expect(descricao).toContain('Gráfico de linhas, do mês 0 ao mês 72, em reais.')
    expect(descricao).toContain('Saldo do fundo: R$ 20.000,00 no mês 0 e R$ 108.410,82 no mês 36.')
    expect(descricao).toContain('Preço do carro corrigido (IPCA): R$ 95.000,00 no mês 0 e R$ 123.714,71 no mês 72.')
    expect(descricao).toContain('Banco Exemplo SAC 36x: R$ 70.000,00 no mês 0 e R$ 0,00 no mês 36.')
  })

  it('sem opções o resumo só fala do fundo e do preço', () => {
    mostrar(semOpcoes)
    const descricao = norm(screen.getByRole('figure').getAttribute('aria-describedby') && document.getElementById(screen.getByRole('figure').getAttribute('aria-describedby')).textContent)
    expect(descricao).toContain('do mês 0 ao mês 36')
    expect(descricao).not.toContain('Banco Exemplo')
  })

  it('nome de opção de 120 caracteres quebra a linha na legenda (não estoura)', () => {
    const financiamentos = [{ ...tresOpcoes.cenarios.financiamentos[0], nome: 'x'.repeat(120) }]
    const series = tresOpcoes.series.map((p) => ({ ...p, saldo_devedor: { 1: p.saldo_devedor['1'] } }))
    render(<GraficoComparativo series={series} financiamentos={financiamentos} />)
    expect(screen.getByRole('button', { name: 'x'.repeat(120) })).toHaveStyle({ overflowWrap: 'anywhere' })
  })

  it('a legenda não usa ícones do @mui/icons-material (só uma amostra em SVG)', () => {
    mostrar(tresOpcoes)
    for (const botao of legenda()) expect(botao.querySelectorAll('svg')).toHaveLength(1)
  })
})
