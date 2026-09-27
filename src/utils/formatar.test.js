import { describe, expect, it } from 'vitest'
import {
  formatarData,
  formatarMes,
  formatarMesAno,
  formatarMoedaCompacta,
  formatarPrazo,
  formatarMoeda,
  casasDecimais,
  dinheiroParaCampo,
  formatarPercentual,
  lerNumero,
  MENSAGEM_NUMERO_INVALIDO,
  numeroParaCampo,
  SEM_VALOR,
} from './formatar.js'

// O Intl separa "R$" do número com um espaço sem quebra (U+00A0); nos testes comparamos com espaço comum.
const semNbsp = (texto) => texto.replaceAll(' ', ' ')

describe('formatarMoeda', () => {
  it.each([
    [1234.56, 'R$ 1.234,56'],
    [0, 'R$ 0,00'],
    [95000, 'R$ 95.000,00'],
    [9999999, 'R$ 9.999.999,00'],
    [0.1, 'R$ 0,10'],
    [-50.5, '-R$ 50,50'],
  ])('%s -> %s', (valor, esperado) => {
    expect(semNbsp(formatarMoeda(valor))).toBe(esperado)
  })

  it('aceita texto numérico', () => {
    expect(semNbsp(formatarMoeda('1234.5'))).toBe('R$ 1.234,50')
  })

  it.each([null, undefined, '', NaN, Infinity, 'abc'])('%s -> traço (sem valor)', (valor) => {
    expect(formatarMoeda(valor)).toBe(SEM_VALOR)
  })

  it('zero NÃO é "sem valor" (controle dos casos vazios)', () => {
    expect(formatarMoeda(0)).not.toBe(SEM_VALOR)
  })
})

describe('formatarPercentual', () => {
  it.each([
    [12.5, '12,50%'],
    [0.85, '0,85%'],
    [1.2345, '1,2345%'],
    [0.123456, '0,123456%'],
    [100, '100,00%'],
    [0, '0,00%'],
    [-1.5, '-1,50%'],
    [-20, '-20,00%'],
  ])('%s -> %s', (valor, esperado) => {
    expect(formatarPercentual(valor)).toBe(esperado)
  })

  it('mostra no mínimo 2 casas e no máximo 6 (o limite da API), sem zeros inúteis no meio', () => {
    expect(formatarPercentual(0.85)).toBe('0,85%')
    expect(formatarPercentual(0.850001)).toBe('0,850001%')
    // Além da 6ª casa arredonda (a API nunca devolve isso).
    expect(formatarPercentual(0.1234567)).toBe('0,123457%')
    expect(formatarPercentual(0.8500001)).toBe('0,85%')
  })

  it.each([null, undefined, '', NaN])('%s -> traço (sem valor)', (valor) => {
    expect(formatarPercentual(valor)).toBe(SEM_VALOR)
  })
})

describe('formatarData', () => {
  it('o ambiente de teste roda no fuso do Brasil (vite.config.js)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Sao_Paulo')
  })

  it('controle: new Date("2026-09-01") ingênuo mostraria o dia ANTERIOR neste fuso', () => {
    expect(new Date('2026-09-01').getDate()).toBe(31)
  })

  it('data só com dia é lida como data local (sem voltar um dia)', () => {
    expect(formatarData('2026-09-01')).toBe('01/09/2026')
    expect(formatarData('2026-01-01')).toBe('01/01/2026')
    expect(formatarData('2028-02-29')).toBe('29/02/2028')
  })

  it.each(['UTC', 'America/Sao_Paulo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Tokyo'])(
    'a data só com dia não depende do fuso da máquina (%s)',
    (fuso) => {
      const original = process.env.TZ
      process.env.TZ = fuso
      try {
        expect(formatarData('2026-09-01')).toBe('01/09/2026')
      } finally {
        process.env.TZ = original
      }
    },
  )

  it('data com hora e fuso é exibida no fuso do navegador', () => {
    // 22:38 UTC do dia 26 são 19:38 em São Paulo: continua dia 26.
    expect(formatarData('2026-09-26T22:38:51+00:00')).toBe('26/09/2026')
    // 01:00 UTC do dia 27 ainda são 22:00 do dia 26 em São Paulo.
    expect(formatarData('2026-09-27T01:00:00+00:00')).toBe('26/09/2026')
    // Microssegundos, como o PostgreSQL devolve.
    expect(formatarData('2026-09-26T19:38:14.123456-03:00')).toBe('26/09/2026')
  })

  it.each([null, undefined, '', 'abc', '2026-13-45', '2026-02-30', 20260901])(
    '%s -> traço (data inválida ou ausente)',
    (valor) => {
      expect(formatarData(valor)).toBe(SEM_VALOR)
    },
  )
})

describe('formatarMesAno', () => {
  it.each([
    ['2026-01-01', 'jan/2026'],
    ['2026-02-01', 'fev/2026'],
    ['2026-03-01', 'mar/2026'],
    ['2026-04-01', 'abr/2026'],
    ['2026-05-01', 'mai/2026'],
    ['2026-06-01', 'jun/2026'],
    ['2026-07-01', 'jul/2026'],
    ['2026-08-01', 'ago/2026'],
    ['2026-09-01', 'set/2026'],
    ['2026-10-01', 'out/2026'],
    ['2026-11-01', 'nov/2026'],
    ['2026-12-01', 'dez/2026'],
  ])('%s -> %s', (data, esperado) => {
    expect(formatarMesAno(data)).toBe(esperado)
  })

  it('controle: um new Date("2026-08-01") ingênuo mostraria julho neste fuso', () => {
    expect(new Date('2026-08-01').getMonth()).toBe(6)
  })

  it.each(['UTC', 'America/Sao_Paulo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Tokyo'])(
    'não volta um mês em nenhum fuso (%s)',
    (fuso) => {
      const original = process.env.TZ
      process.env.TZ = fuso
      try {
        expect(formatarMesAno('2026-08-01')).toBe('ago/2026')
        expect(formatarMesAno('2026-01-01')).toBe('jan/2026')
      } finally {
        process.env.TZ = original
      }
    },
  )

  it('data com hora e fuso usa o fuso do navegador', () => {
    // 01:00 UTC de 1º de setembro ainda são 22:00 de 31 de agosto em São Paulo.
    expect(formatarMesAno('2026-09-01T01:00:00+00:00')).toBe('ago/2026')
  })

  it.each([null, undefined, '', 'abc', '2026-13-01', '2026-02-30', 20260801])('%s -> traço', (valor) => {
    expect(formatarMesAno(valor)).toBe(SEM_VALOR)
  })
})

describe('lerNumero (pontuação pt-BR estrita)', () => {
  it.each([
    ['95000', 95000],
    ['95.000', 95000],
    ['95.000,50', 95000.5],
    ['1.234.567,89', 1234567.89],
    ['1234,56', 1234.56],
    ['0,85', 0.85],
    ['0', 0],
    ['-1,5', -1.5],
    ['-20', -20],
    ['  12  ', 12],
    ['12,50', 12.5],
    ['0,123456', 0.123456],
    // Casos-limite da decisão: o ponto seguido de exatamente 3 dígitos é sempre milhar.
    ['1.234', 1234],
    ['12.500', 12500],
    ['0.500', 500],
  ])('%j -> %s', (texto, esperado) => {
    expect(lerNumero(texto)).toEqual({ valor: esperado })
  })

  it.each(['', '   ', null, undefined])('campo vazio (%j) -> valor null, sem erro', (texto) => {
    expect(lerNumero(texto)).toEqual({ valor: null })
  })

  it.each([
    '12.5',
    '0.85',
    '1.23.456',
    '1000.000',
    '.5',
    '5.',
    '12,',
    ',5',
    '1e3',
    'abc',
    '12abc',
    '1,2,3',
    '--1',
    '-',
    '+5',
    '1 234',
    '1.234,5,6',
    '1,234.56',
    'R$ 10',
    '12%',
  ])('%j é inválido, com a mensagem de pontuação', (texto) => {
    expect(lerNumero(texto)).toEqual({ valor: null, erro: MENSAGEM_NUMERO_INVALIDO })
  })

  it('a mensagem de erro orienta o usuário sobre a vírgula', () => {
    expect(MENSAGEM_NUMERO_INVALIDO).toContain('Use vírgula para decimais (ex.: 12,5)')
  })

  it('"-0" vira 0 (sem zero negativo)', () => {
    expect(Object.is(lerNumero('-0').valor, 0)).toBe(true)
  })

  it('texto absurdamente longo que estoura o limite do número é inválido', () => {
    expect(lerNumero('9'.repeat(400)).erro).toBeTruthy()
  })

  it('aceita número já pronto (valores iniciais do formulário) e recusa NaN/Infinity', () => {
    expect(lerNumero(12.5)).toEqual({ valor: 12.5 })
    expect(lerNumero(NaN).erro).toBeTruthy()
    expect(lerNumero(Infinity).erro).toBeTruthy()
  })

  it('nunca arredonda: as casas digitadas são preservadas', () => {
    expect(lerNumero('0,1234567').valor).toBe(0.1234567)
  })
})

describe('numeroParaCampo', () => {
  it.each([
    [12.5, '12,5'],
    [95000, '95000'],
    [1234.56, '1234,56'],
    [0.85, '0,85'],
    [0, '0'],
    [-1.5, '-1,5'],
    [0.000001, '0,000001'],
    [0.0000001, '0,0000001'],
  ])('%s -> %j', (valor, esperado) => {
    expect(numeroParaCampo(valor)).toBe(esperado)
  })

  it.each([null, undefined, '', NaN])('%s -> campo vazio', (valor) => {
    expect(numeroParaCampo(valor)).toBe('')
  })

  it.each([12.5, 0.85, 95000, 1234.56, -1.5, 0, 9999999.99, 0.000001, 20, 0.123456, -20, 100])(
    'ida e volta: lerNumero(numeroParaCampo(%s)) devolve o mesmo número',
    (valor) => {
      expect(lerNumero(numeroParaCampo(valor))).toEqual({ valor })
    },
  )
})

describe('dinheiroParaCampo', () => {
  it.each([
    [95000.5, '95.000,50'],
    [0, '0,00'],
    [20000, '20.000,00'],
    [0.01, '0,01'],
    [9999999, '9.999.999,00'],
    [1234567.89, '1.234.567,89'],
    [12, '12,00'],
  ])('%s -> %s', (valor, esperado) => {
    expect(dinheiroParaCampo(valor)).toBe(esperado)
  })

  it.each([null, undefined, '', NaN])('%s -> campo vazio', (valor) => {
    expect(dinheiroParaCampo(valor)).toBe('')
  })

  it('não usa o espaço sem quebra do Intl de moeda (é só o número)', () => {
    expect(dinheiroParaCampo(1234.5)).not.toMatch(/[\u00a0R$]/)
  })

  it.each([95000.5, 0, 0.01, 9999999, 1234567.89, 20000, 12.34])('ida e volta: lerNumero(dinheiroParaCampo(%s)) devolve o mesmo número', (valor) => {
    expect(lerNumero(dinheiroParaCampo(valor))).toEqual({ valor })
  })
})

describe('casasDecimais', () => {
  it.each([
    [12, 0],
    [12.5, 1],
    [95000.55, 2],
    [0.123456, 6],
    [0.0000001, 7],
    [-1.5, 1],
    [0, 0],
  ])('%s tem %i casa(s)', (valor, esperado) => {
    expect(casasDecimais(valor)).toBe(esperado)
  })

  it('conta pelo valor, não pelo texto digitado: 12,5000000 lido vale 12.5 e tem 1 casa', () => {
    expect(casasDecimais(lerNumero('12,5000000').valor)).toBe(1)
  })
})


describe('formatarMoedaCompacta (eixos do gráfico)', () => {
  it.each([
    [0, 'R$ 0'],
    [950, 'R$ 950'],
    [1000, 'R$ 1 mil'],
    [12500, 'R$ 12,5 mil'],
    [95000, 'R$ 95 mil'],
    [108410.78, 'R$ 108,4 mil'],
    [1234567, 'R$ 1,2 mi'],
    [3040000, 'R$ 3 mi'],
    [11411660.11, 'R$ 11,4 mi'],
  ])('%s -> %s', (valor, esperado) => {
    expect(semNbsp(formatarMoedaCompacta(valor))).toBe(esperado)
  })

  it.each([null, undefined, '', NaN])('%s -> traço', (valor) => {
    expect(formatarMoedaCompacta(valor)).toBe(SEM_VALOR)
  })
})

describe('formatarPrazo e formatarMes', () => {
  it('prazo: 1 mês e N meses', () => {
    expect(formatarPrazo(1)).toBe('1 mês')
    expect(formatarPrazo(48)).toBe('48 meses')
    expect(formatarPrazo(72)).toBe('72 meses')
  })

  it('mês: "mês 44", inclusive o mês 0', () => {
    expect(formatarMes(44)).toBe('mês 44')
    expect(formatarMes(0)).toBe('mês 0')
  })

  it.each([null, undefined, '', NaN])('%s -> traço (sem prazo nem mês, como a meta que não é alcançada)', (valor) => {
    expect(formatarPrazo(valor)).toBe(SEM_VALOR)
    expect(formatarMes(valor)).toBe(SEM_VALOR)
  })
})
