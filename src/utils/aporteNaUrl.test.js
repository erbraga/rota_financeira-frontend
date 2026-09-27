import { describe, expect, it } from 'vitest'
import { MENSAGEM_NUMERO_INVALIDO } from './formatar.js'
import {
  aporteParaUrl,
  lerAporteDaUrl,
  MENSAGEM_APORTE_CASAS,
  MENSAGEM_APORTE_FAIXA,
  MENSAGEM_APORTE_REPETIDO,
  MENSAGEM_APORTE_VAZIO,
  validarAporte,
} from './aporteNaUrl.js'

// Literais do backend REAL (2026-09-27).
const FAIXA = 'O aporte mensal deve estar entre 0,00 e 9.999.999,00.'
const CASAS = 'Use no máximo 2 casas decimais.'

const url = (consulta) => new URLSearchParams(consulta)

describe('validarAporte', () => {
  it.each([
    ['1500', 1500],
    ['1500,5', 1500.5],
    ['1.500,50', 1500.5], // o campo aceita milhar
    ['0', 0],
    ['0,01', 0.01],
    ['9999999', 9999999],
    ['9.999.999,00', 9999999],
    ['  1500  ', 1500],
  ])('%s -> %s', (texto, valor) => {
    expect(validarAporte(texto)).toEqual({ valor })
  })

  it.each([
    ['-1', FAIXA],
    ['9999999,01', FAIXA],
    ['10.000.000', FAIXA],
    ['1500,505', CASAS],
    ['0,001', CASAS],
  ])('%s -> "%s" (a mensagem real)', (texto, mensagem) => {
    expect(validarAporte(texto)).toEqual({ erro: mensagem })
  })

  it.each(['abc', '1500.5', '1e3', '5.', '1,2,3'])('%s -> formato inválido, com a mensagem de vírgula do projeto', (texto) => {
    expect(validarAporte(texto)).toEqual({ erro: MENSAGEM_NUMERO_INVALIDO })
  })

  it.each(['', '   ', null, undefined])('%j -> pede o valor', (texto) => {
    expect(validarAporte(texto)).toEqual({ erro: MENSAGEM_APORTE_VAZIO })
  })

  it('a faixa vem antes das casas (10.000.000,001 é fora da faixa)', () => {
    expect(validarAporte('10000000,001').erro).toBe(FAIXA)
  })

  it('exporta as mensagens reais', () => {
    expect(MENSAGEM_APORTE_FAIXA).toBe(FAIXA)
    expect(MENSAGEM_APORTE_CASAS).toBe(CASAS)
  })
})

describe('lerAporteDaUrl', () => {
  it('sem o parâmetro: nenhum aporte (o resultado padrão), sem erro', () => {
    expect(lerAporteDaUrl(url(''))).toEqual({ valor: undefined })
    expect(lerAporteDaUrl(url('outro=1'))).toEqual({ valor: undefined })
  })

  it.each([
    ['aporte_mensal=1500', 1500],
    ['aporte_mensal=1500,5', 1500.5],
    ['aporte_mensal=1500%2C5', 1500.5], // a vírgula codificada
    ['aporte_mensal=0', 0],
    ['aporte_mensal=9999999', 9999999],
    ['aporte_mensal=1500&outro=1', 1500],
  ])('%s -> %s', (consulta, valor) => {
    expect(lerAporteDaUrl(url(consulta))).toEqual({ valor })
  })

  it.each([
    ['aporte_mensal=1500.5', MENSAGEM_NUMERO_INVALIDO],
    ['aporte_mensal=1.500,50', MENSAGEM_NUMERO_INVALIDO], // milhar não é escrito no endereço
    ['aporte_mensal=abc', MENSAGEM_NUMERO_INVALIDO],
    ['aporte_mensal=-1', FAIXA],
    ['aporte_mensal=9999999,01', FAIXA],
    ['aporte_mensal=1500,505', CASAS],
    ['aporte_mensal=', MENSAGEM_APORTE_VAZIO],
    ['aporte_mensal=%20', MENSAGEM_APORTE_VAZIO],
  ])('%s -> aviso "%s" (nunca vai ao servidor) e devolve o texto para o campo', (consulta, erro) => {
    const lido = lerAporteDaUrl(url(consulta))
    expect(lido.erro).toBe(erro)
    expect(lido.valor).toBeUndefined()
    expect(lido.texto).toBe(new URLSearchParams(consulta).get('aporte_mensal'))
  })

  it('repetido: aviso, com o primeiro texto no campo', () => {
    expect(lerAporteDaUrl(url('aporte_mensal=1&aporte_mensal=2'))).toEqual({ erro: MENSAGEM_APORTE_REPETIDO, texto: '1' })
  })

  it('controle: a leitura nunca devolve NaN nem número junto de um erro', () => {
    for (const consulta of ['aporte_mensal=abc', 'aporte_mensal=1500', 'aporte_mensal=', 'aporte_mensal=1e3', 'aporte_mensal=Infinity']) {
      const lido = lerAporteDaUrl(url(consulta))
      expect(Number.isNaN(lido.valor)).toBe(false)
      expect(lido.erro !== undefined && lido.valor !== undefined).toBe(false)
    }
  })
})

describe('aporteParaUrl: ida e volta com o endereço', () => {
  it.each([1500, 1500.5, 0, 0.01, 9999999, 1234.56, 100])('%s -> texto -> o mesmo número', (valor) => {
    const texto = aporteParaUrl(valor)
    expect(texto).not.toContain('.') // formato de campo pt-BR, sem milhar
    expect(lerAporteDaUrl(new URLSearchParams({ aporte_mensal: texto }))).toEqual({ valor })
  })

  it('escreve com vírgula e sem milhar', () => {
    expect(aporteParaUrl(1500.5)).toBe('1500,5')
    expect(aporteParaUrl(1500)).toBe('1500')
  })
})
