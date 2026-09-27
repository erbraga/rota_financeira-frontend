import { describe, expect, it } from 'vitest'
import { MENSAGEM_NUMERO_INVALIDO } from '../utils/formatar.js'
import {
  CAMPOS_DA_API,
  criarEsquemaFinanciamento,
  deFinanciamentoParaForm,
  ORDEM_DOS_CAMPOS,
  paraCorpoDaApi,
  valoresIniciaisFinanciamento,
} from './financiamento.js'

// Literais copiados do backend REAL (2026-09-26): a referência não é o esquema testado.
const OBRIGATORIO = 'Campo obrigatório.'
const MSG_NOME = 'O nome deve ter entre 1 e 120 caracteres.'
const MSG_TAXA = 'A taxa de juros mensal deve estar entre 0 e 20.'
const MSG_PRAZO = 'O prazo (em meses) deve estar entre 1 e 72.'
const MSG_ENTRADA = 'O valor da entrada deve estar entre 0,00 e 9.999.999,00.'
const MSG_ENTRADA_MAIOR =
  'A entrada deve ser menor que o valor do veículo (R$ 95.000,00); com a entrada igual ao valor não há o que financiar.'

const VALIDO = { nome: 'Banco A', taxaJurosMensal: '1,5', prazoMeses: '48', sistemaAmortizacao: 'PRICE', valorEntrada: '10.000,00' }
const esquema = criarEsquemaFinanciamento(95000)
const validar = (alteracao, e = esquema) => e.safeParse({ ...VALIDO, ...alteracao })

// Primeira mensagem de cada campo (como o React Hook Form as mostra).
function mensagens(resultado) {
  expect(resultado.success).toBe(false)
  const porCampo = {}
  for (const problema of resultado.error.issues) porCampo[problema.path[0]] ??= problema.message
  return porCampo
}

describe('esquema da opção: caso feliz', () => {
  it('aceita os valores válidos', () => {
    expect(validar({}).success).toBe(true)
  })

  it('a taxa aceita 0 e 20 (limites) e a entrada aceita 0 e vazio (vale 0)', () => {
    for (const alteracao of [{ taxaJurosMensal: '0' }, { taxaJurosMensal: '20' }, { valorEntrada: '0' }, { valorEntrada: '' }, { valorEntrada: '   ' }]) {
      expect(validar(alteracao).success, JSON.stringify(alteracao)).toBe(true)
    }
  })

  it('o prazo aceita 1 e 72 (limites) e os dois sistemas', () => {
    for (const alteracao of [{ prazoMeses: '1' }, { prazoMeses: '72' }, { sistemaAmortizacao: 'SAC' }, { sistemaAmortizacao: 'PRICE' }]) {
      expect(validar(alteracao).success, JSON.stringify(alteracao)).toBe(true)
    }
  })

  it('o nome aceita 1 e 120 caracteres', () => {
    expect(validar({ nome: 'x' }).success).toBe(true)
    expect(validar({ nome: 'x'.repeat(120) }).success).toBe(true)
  })
})

describe('esquema da opção: campos obrigatórios', () => {
  it('o formulário todo vazio: nome, taxa, prazo e sistema pedem "Campo obrigatório."; a entrada não (vale 0)', () => {
    const r = esquema.safeParse(valoresIniciaisFinanciamento())
    expect(mensagens(r)).toEqual({
      nome: OBRIGATORIO,
      taxaJurosMensal: OBRIGATORIO,
      prazoMeses: OBRIGATORIO,
      sistemaAmortizacao: OBRIGATORIO,
    })
  })

  it('nome só com espaços é obrigatório; passa de 120 caracteres dá a mensagem do backend', () => {
    expect(mensagens(validar({ nome: '   ' })).nome).toBe(OBRIGATORIO)
    expect(mensagens(validar({ nome: 'x'.repeat(121) })).nome).toBe(MSG_NOME)
  })

  it('sistema não marcado = "Campo obrigatório." (controle: PRICE e SAC passam); um valor de fora, a mensagem do backend', () => {
    expect(mensagens(validar({ sistemaAmortizacao: '' })).sistemaAmortizacao).toBe(OBRIGATORIO)
    expect(validar({ sistemaAmortizacao: 'PRICE' }).success).toBe(true)
    expect(mensagens(validar({ sistemaAmortizacao: 'PRAZO' })).sistemaAmortizacao).toBe('Sistema de amortização inválido. Use PRICE ou SAC.')
  })
})

describe('esquema da opção: taxa mensal (0 a 20, 6 casas)', () => {
  it.each(['-0,01', '20,01', '21', '-1'])('%s -> faixa', (taxa) => {
    expect(mensagens(validar({ taxaJurosMensal: taxa })).taxaJurosMensal).toBe(MSG_TAXA)
  })

  it('7 casas -> "Use no máximo 6 casas decimais."; 6 casas passam (controle)', () => {
    expect(mensagens(validar({ taxaJurosMensal: '1,1234567' })).taxaJurosMensal).toBe('Use no máximo 6 casas decimais.')
    expect(validar({ taxaJurosMensal: '1,123456' }).success).toBe(true)
  })

  it('a faixa vem ANTES das casas (20,0000001 é fora da faixa)', () => {
    expect(mensagens(validar({ taxaJurosMensal: '20,0000001' })).taxaJurosMensal).toBe(MSG_TAXA)
  })

  it.each(['1.5', 'abc', '1e3', '5.'])('"%s" -> vírgula estrita (o ponto só vale como milhar)', (taxa) => {
    expect(mensagens(validar({ taxaJurosMensal: taxa })).taxaJurosMensal).toBe(MENSAGEM_NUMERO_INVALIDO)
  })
})

describe('esquema da opção: prazo (inteiro de 1 a 72)', () => {
  it.each(['0', '73', '100'])('%s -> faixa', (prazo) => {
    expect(mensagens(validar({ prazoMeses: prazo })).prazoMeses).toBe(MSG_PRAZO)
  })

  it('12,5 -> "Número inteiro inválido."; a leitura vem antes da faixa', () => {
    expect(mensagens(validar({ prazoMeses: '12,5' })).prazoMeses).toBe('Número inteiro inválido.')
    expect(mensagens(validar({ prazoMeses: '100,5' })).prazoMeses).toBe('Número inteiro inválido.')
  })
})

describe('esquema da opção: entrada (0 a 9.999.999, 2 casas, menor que o veículo)', () => {
  it.each(['-1', '10.000.000', '10000000'])('%s -> faixa', (entrada) => {
    expect(mensagens(validar({ valorEntrada: entrada })).valorEntrada).toBe(MSG_ENTRADA)
  })

  it('3 casas -> "Use no máximo 2 casas decimais."', () => {
    expect(mensagens(validar({ valorEntrada: '100,123' })).valorEntrada).toBe('Use no máximo 2 casas decimais.')
  })

  it('IGUAL ao veículo é recusada, com a mensagem real e o valor formatado', () => {
    expect(mensagens(validar({ valorEntrada: '95.000,00' })).valorEntrada).toBe(MSG_ENTRADA_MAIOR)
  })

  it('maior que o veículo também; um centavo a menos passa (controle do limite)', () => {
    expect(mensagens(validar({ valorEntrada: '95.000,01' })).valorEntrada).toBe(MSG_ENTRADA_MAIOR)
    expect(validar({ valorEntrada: '94.999,99' }).success).toBe(true)
  })

  it('a FAIXA vem antes da regra da entrada (10.000.000 > veículo dá a mensagem da faixa)', () => {
    expect(mensagens(validar({ valorEntrada: '10.000.000,00' })).valorEntrada).toBe(MSG_ENTRADA)
  })

  it('a mensagem usa o valor do veículo recebido (não um valor fixo)', () => {
    const r = validar({ valorEntrada: '1.234,57' }, criarEsquemaFinanciamento(1234.56))
    expect(mensagens(r).valorEntrada).toBe(
      'A entrada deve ser menor que o valor do veículo (R$ 1.234,56); com a entrada igual ao valor não há o que financiar.',
    )
  })

  it('sem o valor do veículo (null) a regra fica a cargo do servidor (controle: com ele, recusa)', () => {
    expect(validar({ valorEntrada: '95.000,00' }, criarEsquemaFinanciamento(null)).success).toBe(true)
    expect(validar({ valorEntrada: '95.000,00' }, criarEsquemaFinanciamento(95000)).success).toBe(false)
    expect(validar({ valorEntrada: '95.000,00' }, criarEsquemaFinanciamento()).success).toBe(true)
  })

  it('entrada vazia nunca é recusada por essa regra (vale 0)', () => {
    expect(validar({ valorEntrada: '' }).success).toBe(true)
  })
})

describe('paraCorpoDaApi', () => {
  it('números, prazo inteiro, sistema em maiúsculas, nome aparado', () => {
    const corpo = paraCorpoDaApi({ ...VALIDO, nome: '  Banco A  ', sistemaAmortizacao: 'sac' })
    expect(corpo).toEqual({ nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'SAC', valor_entrada: 10000 })
    expect(typeof corpo.taxa_juros_mensal).toBe('number')
    expect(Number.isInteger(corpo.prazo_meses)).toBe(true)
  })

  it('entrada vazia vale 0 (nunca null) e 0 fica 0', () => {
    expect(paraCorpoDaApi({ ...VALIDO, valorEntrada: '' }).valor_entrada).toBe(0)
    expect(paraCorpoDaApi({ ...VALIDO, valorEntrada: '0,00' }).valor_entrada).toBe(0)
  })

  it('nunca leva id, simulacao_id nem usuario_id, e só as 5 chaves da API', () => {
    const corpo = paraCorpoDaApi({ ...VALIDO, id: 3, simulacao_id: 9, usuario_id: 1 })
    expect(Object.keys(corpo).sort()).toEqual(['nome', 'prazo_meses', 'sistema_amortizacao', 'taxa_juros_mensal', 'valor_entrada'])
  })

  it('valores inválidos são erro de programação (o esquema vem antes)', () => {
    expect(() => paraCorpoDaApi({ ...VALIDO, taxaJurosMensal: '' })).toThrow(/já validados/)
    expect(() => paraCorpoDaApi({ ...VALIDO, sistemaAmortizacao: '' })).toThrow(/já validados/)
  })
})

describe('deFinanciamentoParaForm', () => {
  it('escreve no formato dos campos (1,5, 48, 10.000,00) e o sistema em maiúsculas', () => {
    expect(deFinanciamentoParaForm({ id: 7, nome: 'Banco A', taxa_juros_mensal: 1.5, prazo_meses: 48, sistema_amortizacao: 'PRICE', valor_entrada: 10000 })).toEqual(VALIDO)
    expect(deFinanciamentoParaForm({ id: 7, nome: 'X', taxa_juros_mensal: 0, prazo_meses: 1, sistema_amortizacao: 'sac', valor_entrada: 0 })).toEqual({
      nome: 'X',
      taxaJurosMensal: '0',
      prazoMeses: '1',
      sistemaAmortizacao: 'SAC',
      valorEntrada: '0,00',
    })
  })

  it('ida e volta: o que sai do servidor volta ao mesmo corpo', () => {
    const opcao = { id: 7, nome: 'Banco A', taxa_juros_mensal: 1.234567, prazo_meses: 72, sistema_amortizacao: 'SAC', valor_entrada: 12345.67 }
    const { id: _id, ...esperado } = opcao
    expect(paraCorpoDaApi(deFinanciamentoParaForm(opcao))).toEqual(esperado)
  })
})

describe('valores iniciais e mapa de campos', () => {
  it('a entrada vem "0,00", o sistema sem marca e o resto vazio', () => {
    expect(valoresIniciaisFinanciamento()).toEqual({ nome: '', taxaJurosMensal: '', prazoMeses: '', sistemaAmortizacao: '', valorEntrada: '0,00' })
  })

  it('o mapa da API cobre os 5 campos e a ordem visual tem os mesmos campos do formulário', () => {
    expect(Object.keys(CAMPOS_DA_API).sort()).toEqual(['nome', 'prazo_meses', 'sistema_amortizacao', 'taxa_juros_mensal', 'valor_entrada'])
    expect([...ORDEM_DOS_CAMPOS].sort()).toEqual(Object.values(CAMPOS_DA_API).sort())
    expect(Object.keys(valoresIniciaisFinanciamento()).sort()).toEqual([...ORDEM_DOS_CAMPOS].sort())
  })
})
