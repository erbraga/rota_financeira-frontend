import { describe, expect, it } from 'vitest'
import { FIXTURES_DE_RESULTADO } from '../mocks/handlers/resultado.js'
import { chaveDoFinanciamento, montarDados, montarLinhas, resumoDoGrafico } from './serieDoGrafico.js'

const { tresOpcoes, semOpcoes } = FIXTURES_DE_RESULTADO
const norm = (texto) => texto.replaceAll(' ', ' ')

describe('montarLinhas', () => {
  it('um saldo devedor por financiamento (ordem de criação), depois o fundo e o preço corrigido', () => {
    const linhas = montarLinhas(tresOpcoes.cenarios.financiamentos)
    expect(linhas.map((l) => l.nome)).toEqual([
      'Banco Exemplo Price 48x',
      'Banco Exemplo SAC 36x',
      'Banco Exemplo Sem Juros 72x',
      'Saldo do fundo',
      'Preço do carro corrigido (IPCA)',
    ])
    expect(linhas.map((l) => l.chave)).toEqual(['fin_1', 'fin_2', 'fin_3', 'fundo', 'preco'])
    expect(linhas.map((l) => l.tipo)).toEqual(['financiamento', 'financiamento', 'financiamento', 'fundo', 'preco'])
  })

  it('sem opções só há o fundo e o preço corrigido', () => {
    expect(montarLinhas([]).map((l) => l.chave)).toEqual(['fundo', 'preco'])
  })

  it('a chave do financiamento usa o id como texto ou número', () => {
    expect(chaveDoFinanciamento(7)).toBe('fin_7')
    expect(chaveDoFinanciamento('7')).toBe('fin_7')
  })
})

describe('montarDados', () => {
  it('um ponto por mês, do 0 ao maior prazo, com os valores EXATOS da API', () => {
    const dados = montarDados(tresOpcoes.series)
    expect(dados).toHaveLength(73)
    expect(dados[0]).toEqual({ mes: 0, preco: 95000, fundo: 20000, fin_1: 75000, fin_2: 70000, fin_3: 95000 })
    expect(dados[36]).toEqual({ mes: 36, preco: 108410.78, fundo: 108410.82, fin_1: 24030.83, fin_2: 0, fin_3: 47500.16 })
  })

  it('o null da API continua null (a série terminou): o fundo depois do mês 36 e a SAC depois do último mês', () => {
    const dados = montarDados(tresOpcoes.series)
    expect(dados[37].fundo).toBeNull()
    expect(dados[37].fin_2).toBeNull()
    expect(dados[49].fin_1).toBeNull()
    expect(dados[72]).toEqual({ mes: 72, preco: 123714.71, fundo: null, fin_1: null, fin_2: null, fin_3: 0 })
  })

  it('controle: NENHUM null vira 0 nem some (a contagem de null é a da API)', () => {
    const contar = (pontos, chave) => pontos.filter((p) => p[chave] === null).length
    const dados = montarDados(tresOpcoes.series)
    const original = tresOpcoes.series
    expect(contar(dados, 'fundo')).toBe(original.filter((p) => p.saldo_fundo === null).length)
    expect(contar(dados, 'fin_2')).toBe(original.filter((p) => p.saldo_devedor['2'] === null).length)
    expect(contar(dados, 'fundo')).toBeGreaterThan(0)
    expect(dados.filter((p) => p.fundo === 0)).toHaveLength(0)
  })

  it('sem opções o saldo_devedor vazio não gera chaves de financiamento', () => {
    const dados = montarDados(semOpcoes.series)
    expect(Object.keys(dados[0]).sort()).toEqual(['fundo', 'mes', 'preco'])
    expect(dados).toHaveLength(37)
  })

  it('não altera a resposta original', () => {
    const antes = JSON.stringify(tresOpcoes.series)
    montarDados(tresOpcoes.series)
    expect(JSON.stringify(tresOpcoes.series)).toBe(antes)
  })
})

describe('resumoDoGrafico', () => {
  const resumo = () => resumoDoGrafico(montarDados(tresOpcoes.series), montarLinhas(tresOpcoes.cenarios.financiamentos)).map(norm)

  it('uma frase por linha, com o primeiro valor e o último mês em que a série existe (literais da API)', () => {
    expect(resumo()).toEqual([
      'Banco Exemplo Price 48x: R$ 75.000,00 no mês 0 e R$ 0,00 no mês 48.',
      'Banco Exemplo SAC 36x: R$ 70.000,00 no mês 0 e R$ 0,00 no mês 36.',
      'Banco Exemplo Sem Juros 72x: R$ 95.000,00 no mês 0 e R$ 0,00 no mês 72.',
      'Saldo do fundo: R$ 20.000,00 no mês 0 e R$ 108.410,82 no mês 36.',
      'Preço do carro corrigido (IPCA): R$ 95.000,00 no mês 0 e R$ 123.714,71 no mês 72.',
    ])
  })

  it('sem opções só descreve o fundo e o preço', () => {
    const frases = resumoDoGrafico(montarDados(semOpcoes.series), montarLinhas([]))
    expect(frases.map(norm)).toEqual([
      'Saldo do fundo: R$ 20.000,00 no mês 0 e R$ 108.410,82 no mês 36.',
      'Preço do carro corrigido (IPCA): R$ 95.000,00 no mês 0 e R$ 108.410,78 no mês 36.',
    ])
  })

  it('uma linha sem nenhum valor não gera frase, e uma com um só ponto gera a frase curta', () => {
    const dados = [
      { mes: 0, preco: 10, fundo: null, fin_1: null },
      { mes: 1, preco: 20, fundo: null, fin_1: 5 },
    ]
    const linhas = [
      { chave: 'fin_1', nome: 'A' },
      { chave: 'fundo', nome: 'F' },
    ]
    expect(resumoDoGrafico(dados, linhas).map(norm)).toEqual(['A: R$ 5,00 no mês 1.'])
  })
})
