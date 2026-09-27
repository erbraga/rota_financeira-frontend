import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FIXTURES_DE_PARCELAS } from '../mocks/handlers/parcelas.js'
import GraficoAmortizacao from './GraficoAmortizacao.jsx'

// O jsdom não mede o layout: o ResponsiveContainer recebe um tamanho fixo (só o layout é trocado, o gráfico é o de verdade).
vi.mock('recharts', async (importarOriginal) => {
  const real = await importarOriginal()
  const { cloneElement } = await import('react')
  return { ...real, ResponsiveContainer: ({ children }) => cloneElement(children, { width: 800, height: 260 }) }
})

const { price, sac, semJuros, umMes, centavos } = FIXTURES_DE_PARCELAS
const norm = (texto) => texto.replaceAll(' ', ' ')

const mostrar = (fixture) => render(<GraficoAmortizacao parcelas={fixture.parcelas} />)
const barras = () => document.querySelectorAll('.recharts-bar')
const retangulos = (indiceDaBarra) => barras()[indiceDaBarra].querySelectorAll('.recharts-bar-rectangle')
const descricao = () => {
  const figura = screen.getByRole('figure')
  return norm(document.getElementById(figura.getAttribute('aria-describedby')).textContent)
}

describe('GraficoAmortizacao: barras', () => {
  it('duas séries empilhadas (amortização e juros), uma barra por mês da API (Price 48x)', () => {
    mostrar(price)
    expect(barras()).toHaveLength(2)
    expect(retangulos(0)).toHaveLength(48)
    expect(retangulos(1)).toHaveLength(48)
  })

  // Uma fatia de R$ 0,00 não tem altura, então o Recharts não a desenha: a contagem é a dos valores NÃO zerados da API.
  it.each([
    ['SAC 36x', sac],
    ['sem juros 72x (a fatia de juros é sempre 0,00: nenhuma barra de juros)', semJuros],
    ['1 mês', umMes],
    ['centavos 72x (71 meses zerados: só a última barra aparece)', centavos],
  ])('%s: uma barra por valor não zerado', (_nome, fixture) => {
    mostrar(fixture)
    const naoZerados = (chave) => fixture.parcelas.filter((linha) => linha[chave] !== 0).length
    expect(retangulos(0)).toHaveLength(naoZerados('amortizacao'))
    expect(retangulos(1)).toHaveLength(naoZerados('juros'))
  })

  it('sem juros: nenhuma barra de juros e 72 de amortização', () => {
    mostrar(semJuros)
    expect(retangulos(1)).toHaveLength(0)
    expect(retangulos(0)).toHaveLength(72)
  })

  it('as fatias se empilham (mesmo stackId): as duas séries ocupam a MESMA coluna de cada mês', () => {
    mostrar(price)
    const xDe = (i) => Array.from(retangulos(i)).map((r) => r.querySelector('path').getAttribute('x'))
    expect(xDe(0)).toEqual(xDe(1))
  })

  it('a fatia dos juros usa o padrão listrado (cor E padrão) e a da amortização é cheia', () => {
    mostrar(price)
    const preenchimento = (i) => retangulos(i)[0].querySelector('path').getAttribute('fill')
    expect(preenchimento(1)).toMatch(/^url\(#padrao-juros-/)
    expect(preenchimento(0)).not.toMatch(/^url\(/)
    const idDoPadrao = preenchimento(1).slice(5, -1)
    expect(document.getElementById(idDoPadrao)).not.toBeNull() // o padrão existe no documento
  })
})

describe('GraficoAmortizacao: legenda e título', () => {
  it('título da seção e legenda com as duas fatias', () => {
    mostrar(price)
    expect(screen.getByRole('heading', { level: 2, name: 'Juros e amortização de cada parcela' })).toBeInTheDocument()
    expect(screen.getByText('Amortização')).toBeInTheDocument()
    expect(screen.getByText('Juros')).toBeInTheDocument()
  })

  it('a legenda tem amostras em SVG (nenhum ícone do @mui/icons-material)', () => {
    const { container } = mostrar(price)
    expect(container.querySelectorAll('[data-testid$="Icon"]')).toHaveLength(0)
  })
})

describe('GraficoAmortizacao: alternativa em texto', () => {
  it('a figura tem nome (o título) e a descrição com a primeira e a última parcela, lidas da tabela', () => {
    mostrar(price)
    expect(screen.getByRole('figure', { name: 'Juros e amortização de cada parcela' })).toBeInTheDocument()
    expect(descricao()).toContain('Gráfico de barras empilhadas, do mês 1 ao mês 48, em reais')
    expect(descricao()).toContain('Mês 1: parcela de R$ 2.203,12, com R$ 1.125,00 de juros e R$ 1.078,12 de amortização.')
    expect(descricao()).toContain('Mês 48: parcela de R$ 2.203,45, com R$ 32,56 de juros e R$ 2.170,89 de amortização.')
  })

  it('SAC: a descrição traz as parcelas da SAC', () => {
    mostrar(sac)
    expect(descricao()).toContain('do mês 1 ao mês 36')
    expect(descricao()).toContain('Mês 1: parcela de R$ 2.854,44')
    expect(descricao()).toContain('Mês 36: parcela de R$ 1.969,88')
  })

  it('prazo de 1 mês: a descrição tem uma frase só', () => {
    mostrar(umMes)
    expect(descricao()).toContain('do mês 1 ao mês 1')
    expect(descricao().match(/parcela de/g)).toHaveLength(1)
  })

  it('o parágrafo de resumo mede 1px (não estica a página): o sx do MUI lê width/height entre 0 e 1 como porcentagem', () => {
    mostrar(price)
    const figura = screen.getByRole('figure', { name: 'Juros e amortização de cada parcela' })
    const p = document.getElementById(figura.getAttribute('aria-describedby'))
    const estilo = getComputedStyle(p)
    expect(estilo.width).toBe('1px')
    expect(estilo.height).toBe('1px')
    expect(getComputedStyle(figura).position).toBe('relative') // contém o filho absoluto
  })
})
