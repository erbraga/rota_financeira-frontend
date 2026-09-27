import { describe, expect, it } from 'vitest'
import { FIXTURES_DE_PARCELAS } from '../mocks/handlers/parcelas.js'
import { montarBarras, resumoDaAmortizacao } from './serieDaAmortizacao.js'

const { price, sac, semJuros, umMes, centavos } = FIXTURES_DE_PARCELAS
const norm = (texto) => texto.replaceAll(' ', ' ')

describe('montarBarras', () => {
  it('uma barra por linha da API, com os valores EXATOS de juros e amortização (Price 48x)', () => {
    const barras = montarBarras(price.parcelas)
    expect(barras).toHaveLength(48)
    expect(barras[0]).toEqual({ mes: 1, amortizacao: 1078.12, juros: 1125 })
    expect(barras[1]).toEqual({ mes: 2, amortizacao: 1094.29, juros: 1108.83 })
    expect(barras.at(-1)).toEqual({ mes: 48, amortizacao: 2170.89, juros: 32.56 })
  })

  it('SAC 36x: a amortização é a da API (constante) e os juros decrescem', () => {
    const barras = montarBarras(sac.parcelas)
    expect(barras).toHaveLength(36)
    expect(barras[0]).toEqual({ mes: 1, amortizacao: 1944.44, juros: 910 })
    expect(barras[1]).toEqual({ mes: 2, amortizacao: 1944.44, juros: 884.72 })
    expect(barras.at(-1)).toEqual({ mes: 36, amortizacao: 1944.6, juros: 25.28 })
  })

  it('sem juros: a fatia de juros é 0 em todas as barras, como vem', () => {
    const barras = montarBarras(semJuros.parcelas)
    expect(barras).toHaveLength(72)
    expect(barras.every((b) => b.juros === 0)).toBe(true)
    expect(barras[0].amortizacao).toBe(1319.44)
  })

  it('centavos: as 71 barras zeradas continuam zeradas (nada é preenchido nem escondido)', () => {
    const barras = montarBarras(centavos.parcelas)
    expect(barras).toHaveLength(72)
    expect(barras.filter((b) => b.amortizacao === 0 && b.juros === 0)).toHaveLength(71)
    expect(barras.at(-1)).toEqual({ mes: 72, amortizacao: 0.01, juros: 0 })
  })

  it('só as chaves mes, amortizacao e juros (nenhum total nem valor derivado)', () => {
    for (const barra of montarBarras(price.parcelas)) expect(Object.keys(barra).sort()).toEqual(['amortizacao', 'juros', 'mes'])
  })

  it('não altera a resposta original', () => {
    const antes = JSON.stringify(price.parcelas)
    montarBarras(price.parcelas)
    expect(JSON.stringify(price.parcelas)).toBe(antes)
  })

  it('lista vazia gera nenhuma barra', () => {
    expect(montarBarras([])).toEqual([])
  })
})

describe('resumoDaAmortizacao', () => {
  it('Price 48x: a primeira e a última parcela, lidas da tabela (literais da API)', () => {
    expect(norm(resumoDaAmortizacao(price.parcelas))).toBe(
      'Mês 1: parcela de R$ 2.203,12, com R$ 1.125,00 de juros e R$ 1.078,12 de amortização. ' +
        'Mês 48: parcela de R$ 2.203,45, com R$ 32,56 de juros e R$ 2.170,89 de amortização.',
    )
  })

  it('SAC 36x', () => {
    expect(norm(resumoDaAmortizacao(sac.parcelas))).toBe(
      'Mês 1: parcela de R$ 2.854,44, com R$ 910,00 de juros e R$ 1.944,44 de amortização. ' +
        'Mês 36: parcela de R$ 1.969,88, com R$ 25,28 de juros e R$ 1.944,60 de amortização.',
    )
  })

  it('prazo de 1 mês: uma frase só', () => {
    expect(norm(resumoDaAmortizacao(umMes.parcelas))).toBe('Mês 1: parcela de R$ 76.125,00, com R$ 1.125,00 de juros e R$ 75.000,00 de amortização.')
  })

  it('sem linhas: texto vazio', () => {
    expect(resumoDaAmortizacao([])).toBe('')
  })
})
