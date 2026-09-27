import { describe, expect, it } from 'vitest'
import { MENSAGEM_NUMERO_INVALIDO } from '../utils/formatar.js'
import {
  CAMPOS_DA_API,
  deSimulacaoParaForm,
  esquemaSimulacao,
  paraCorpoDaApi,
  valoresIniciais,
} from './simulacao.js'

const OBRIGATORIO = 'Campo obrigatório.'
const MSG_NOME = 'O nome deve ter entre 1 e 120 caracteres.'
const MSG_VEICULO = 'O valor do veículo deve estar entre 0,01 e 9.999.999,00.'
const MSG_ENTRADA = 'O valor da entrada deve estar entre 0,00 e 9.999.999,00.'
const MSG_IPCA = 'A taxa de IPCA projetada deve estar entre -20 e 100.'
const MSG_FUNDO = 'A taxa de rendimento do fundo deve estar entre 0 e 100.'
const MSG_PRAZO = 'O prazo do fundo (em meses) deve estar entre 1 e 60.'

const VALIDO = {
  nome: 'Onix 2026',
  valorVeiculo: '95.000,00',
  valorEntrada: '20.000,00',
  taxaIpcaProjetada: '4,5',
  taxaFundoRendimento: '12',
  prazoMesesFundo: '36',
}

const validar = (alteracao) => esquemaSimulacao.safeParse({ ...VALIDO, ...alteracao })

// Primeira mensagem de cada campo (como o React Hook Form as mostra).
function mensagens(resultado) {
  const porCampo = {}
  for (const problema of resultado.error?.issues ?? []) porCampo[problema.path[0]] ??= problema.message
  return porCampo
}

describe('esquemaSimulacao: caso feliz', () => {
  it('aceita dados válidos e devolve os textos como estão (a conversão é do paraCorpoDaApi)', () => {
    const r = validar({})
    expect(r.success).toBe(true)
    expect(r.data).toEqual(VALIDO)
  })

  it('apara o nome', () => {
    expect(validar({ nome: '  Onix  ' }).data.nome).toBe('Onix')
  })
})

describe('esquemaSimulacao: nome', () => {
  it.each([
    [1, true],
    [120, true],
    [121, false],
  ])('nome com %i caractere(s) -> válido: %s', (tamanho, valido) => {
    const r = validar({ nome: 'n'.repeat(tamanho) })
    expect(r.success).toBe(valido)
    if (!valido) expect(mensagens(r).nome).toBe(MSG_NOME)
  })

  it.each(['', '   '])('vazio ou só com espaços (%j) -> "Campo obrigatório."', (nome) => {
    expect(mensagens(validar({ nome })).nome).toBe(OBRIGATORIO)
  })

  it('nome ausente (undefined) -> "Campo obrigatório."', () => {
    const { nome: _omitido, ...semNome } = VALIDO
    expect(mensagens(esquemaSimulacao.safeParse(semNome)).nome).toBe(OBRIGATORIO)
  })
})

describe('esquemaSimulacao: limites numéricos (mensagens reais do backend)', () => {
  it.each([
    ['veículo', 'valorVeiculo', MSG_VEICULO, [['0', false], ['0,01', true], ['9.999.999', true], ['9999999,00', true], ['10.000.000', false], ['-1', false]]],
    ['entrada', 'valorEntrada', MSG_ENTRADA, [['-1', false], ['0', true], ['0,00', true], ['20.000', true]]],
    ['IPCA', 'taxaIpcaProjetada', MSG_IPCA, [['-20,5', false], ['-20', true], ['0', true], ['100', true], ['100,1', false]]],
    ['rendimento do fundo', 'taxaFundoRendimento', MSG_FUNDO, [['-0,1', false], ['0', true], ['100', true], ['100,1', false]]],
    ['prazo', 'prazoMesesFundo', MSG_PRAZO, [['0', false], ['1', true], ['60', true], ['61', false]]],
  ])('%s', (_rotulo, campo, mensagem, casos) => {
    // Nos casos do veículo a entrada vai a 0, para o teste não cair na regra "entrada maior que o veículo".
    const base = campo === 'valorVeiculo' ? { valorEntrada: '0' } : {}
    for (const [texto, valido] of casos) {
      const r = validar({ ...base, [campo]: texto })
      expect(r.success, `${campo} = ${texto}`).toBe(valido)
      if (!valido) expect(mensagens(r)[campo], `${campo} = ${texto}`).toBe(mensagem)
    }
  })

  it('a faixa vem ANTES das casas (como no backend): 10.000.000,001 dá a mensagem de faixa', () => {
    expect(mensagens(validar({ valorVeiculo: '10.000.000,001' })).valorVeiculo).toBe(MSG_VEICULO)
  })

  it('notação científica digitada é recusada pela leitura (nunca chega a ser um número)', () => {
    expect(mensagens(validar({ valorVeiculo: '1e999999' })).valorVeiculo).toBe(MENSAGEM_NUMERO_INVALIDO)
  })
})

describe('esquemaSimulacao: casas decimais (rejeita, nunca arredonda)', () => {
  it.each([
    ['valorVeiculo', '95.000,123', 'Use no máximo 2 casas decimais.'],
    ['valorEntrada', '20.000,001', 'Use no máximo 2 casas decimais.'],
    ['taxaIpcaProjetada', '4,1234567', 'Use no máximo 6 casas decimais.'],
    ['taxaFundoRendimento', '12,1234567', 'Use no máximo 6 casas decimais.'],
  ])('%s = %s', (campo, texto, mensagem) => {
    expect(mensagens(validar({ [campo]: texto }))[campo]).toBe(mensagem)
  })

  it('o limite de casas é aceito: 2 no dinheiro e 6 nas taxas (controle)', () => {
    expect(validar({ valorVeiculo: '95.000,12', taxaIpcaProjetada: '4,123456', taxaFundoRendimento: '0,000001' }).success).toBe(true)
  })

  it('conta as casas pelo NÚMERO, como o backend: "12,5000000" tem 1 casa e é válido', () => {
    expect(validar({ taxaFundoRendimento: '12,5000000' }).success).toBe(true)
    expect(validar({ valorVeiculo: '95000,5000' }).success).toBe(true)
  })
})

describe('esquemaSimulacao: prazo inteiro', () => {
  it.each(['12,5', '36,0001', '0,5'])('%s -> "Número inteiro inválido." (ou faixa)', (texto) => {
    const m = mensagens(validar({ prazoMesesFundo: texto })).prazoMesesFundo
    expect(['Número inteiro inválido.', MSG_PRAZO]).toContain(m)
  })

  it('12,5 é "Número inteiro inválido." (mensagem real do backend)', () => {
    expect(mensagens(validar({ prazoMesesFundo: '12,5' })).prazoMesesFundo).toBe('Número inteiro inválido.')
  })

  it('"36,0" é inteiro: vale', () => {
    expect(validar({ prazoMesesFundo: '36,0' }).success).toBe(true)
  })
})

describe('esquemaSimulacao: leitura de números (pontuação pt-BR estrita)', () => {
  it.each(['95000', '95.000', '95.000,50', '95000,5'])('aceita o veículo %s', (texto) => {
    expect(validar({ valorVeiculo: texto }).success).toBe(true)
  })

  it.each(['12.5', '0.85', 'abc', '1e3', '1,2,3', '--1'])('recusa "%s" com a mensagem de pontuação', (texto) => {
    expect(mensagens(validar({ taxaFundoRendimento: texto })).taxaFundoRendimento).toBe(MENSAGEM_NUMERO_INVALIDO)
  })

  it('a mensagem de pontuação orienta a usar vírgula', () => {
    expect(MENSAGEM_NUMERO_INVALIDO).toContain('Use vírgula para decimais')
  })
})

describe('esquemaSimulacao: campos vazios', () => {
  it.each(['valorVeiculo', 'taxaIpcaProjetada', 'taxaFundoRendimento', 'prazoMesesFundo'])('%s vazio -> obrigatório', (campo) => {
    expect(mensagens(validar({ [campo]: '' }))[campo]).toBe(OBRIGATORIO)
    expect(mensagens(validar({ [campo]: '   ' }))[campo]).toBe(OBRIGATORIO)
  })

  it('a ENTRADA vazia (ou só espaços) é válida: vale 0', () => {
    expect(validar({ valorEntrada: '' }).success).toBe(true)
    expect(validar({ valorEntrada: '   ' }).success).toBe(true)
  })

  it('campos ausentes (undefined) dão "Campo obrigatório."', () => {
    const m = mensagens(esquemaSimulacao.safeParse({}))
    for (const campo of ['nome', 'valorVeiculo', 'valorEntrada', 'taxaIpcaProjetada', 'taxaFundoRendimento', 'prazoMesesFundo']) {
      expect(m[campo], campo).toBe(OBRIGATORIO)
    }
  })

  it('formulário todo vazio (valores iniciais): erros nos cinco obrigatórios, e a entrada NÃO reclama', () => {
    const m = mensagens(esquemaSimulacao.safeParse(valoresIniciais()))
    expect(Object.keys(m).sort()).toEqual(['nome', 'prazoMesesFundo', 'taxaFundoRendimento', 'taxaIpcaProjetada', 'valorVeiculo'])
  })
})

describe('esquemaSimulacao: entrada <= veículo', () => {
  it('entrada igual ao veículo é aceita (o backend aceita)', () => {
    expect(validar({ valorVeiculo: '50.000', valorEntrada: '50.000' }).success).toBe(true)
  })

  it('entrada maior que o veículo: erro NA ENTRADA, com a mensagem real', () => {
    const r = validar({ valorVeiculo: '50.000,00', valorEntrada: '50.000,01' })
    expect(r.success).toBe(false)
    expect(mensagens(r)).toEqual({ valorEntrada: 'A entrada não pode ser maior que o valor do veículo.' })
  })

  it('só compara quando os dois são válidos: veículo inválido não gera erro extra na entrada', () => {
    const m = mensagens(validar({ valorVeiculo: 'abc', valorEntrada: '30.000' }))
    expect(m.valorVeiculo).toBe(MENSAGEM_NUMERO_INVALIDO)
    expect(m.valorEntrada).toBeUndefined()
  })

  it('entrada vazia nunca é maior que o veículo', () => {
    expect(validar({ valorEntrada: '' }).success).toBe(true)
  })
})

describe('valoresIniciais', () => {
  it('a entrada começa em "0,00" e o resto vazio', () => {
    expect(valoresIniciais()).toEqual({
      nome: '',
      valorVeiculo: '',
      valorEntrada: '0,00',
      taxaIpcaProjetada: '',
      taxaFundoRendimento: '',
      prazoMesesFundo: '',
    })
  })

  it('devolve um objeto novo a cada chamada (não compartilha estado)', () => {
    expect(valoresIniciais()).not.toBe(valoresIniciais())
  })
})

describe('paraCorpoDaApi (formulário -> API)', () => {
  it('converte para snake_case com NÚMEROS, prazo inteiro e nome aparado', () => {
    const corpo = paraCorpoDaApi({ ...VALIDO, nome: '  Onix 2026  ' })
    expect(corpo).toEqual({
      nome: 'Onix 2026',
      valor_veiculo: 95000,
      valor_entrada: 20000,
      taxa_ipca_projetada: 4.5,
      taxa_fundo_rendimento: 12,
      prazo_meses_fundo: 36,
    })
    for (const chave of ['valor_veiculo', 'valor_entrada', 'taxa_ipca_projetada', 'taxa_fundo_rendimento', 'prazo_meses_fundo']) {
      expect(typeof corpo[chave], chave).toBe('number')
    }
    expect(Number.isInteger(corpo.prazo_meses_fundo)).toBe(true)
  })

  it('entrada vazia vale 0 (o backend recusa null)', () => {
    expect(paraCorpoDaApi({ ...VALIDO, valorEntrada: '' }).valor_entrada).toBe(0)
    expect(paraCorpoDaApi({ ...VALIDO, valorEntrada: '  ' }).valor_entrada).toBe(0)
  })

  it('o corpo tem exatamente os 6 campos: nunca id, usuario_id nem criado_em', () => {
    expect(Object.keys(paraCorpoDaApi(VALIDO)).sort()).toEqual([
      'nome',
      'prazo_meses_fundo',
      'taxa_fundo_rendimento',
      'taxa_ipca_projetada',
      'valor_entrada',
      'valor_veiculo',
    ])
  })

  it('"36,0" vira o inteiro 36', () => {
    expect(paraCorpoDaApi({ ...VALIDO, prazoMesesFundo: '36,0' }).prazo_meses_fundo).toBe(36)
  })

  it('taxa negativa e decimais longos', () => {
    const corpo = paraCorpoDaApi({ ...VALIDO, taxaIpcaProjetada: '-20', taxaFundoRendimento: '0,123456' })
    expect(corpo.taxa_ipca_projetada).toBe(-20)
    expect(corpo.taxa_fundo_rendimento).toBe(0.123456)
  })

  it('valor inválido é erro de programação (exige valores já validados)', () => {
    expect(() => paraCorpoDaApi({ ...VALIDO, valorVeiculo: 'abc' })).toThrow('paraCorpoDaApi exige valores já validados')
    expect(() => paraCorpoDaApi({ ...VALIDO, prazoMesesFundo: '' })).toThrow('valores já validados')
  })
})

describe('deSimulacaoParaForm (API -> formulário) e a ida e volta', () => {
  const SIMULACAO = {
    id: 7,
    nome: 'Onix 2026',
    valor_veiculo: 95000,
    valor_entrada: 20000,
    taxa_ipca_projetada: 4.5,
    taxa_fundo_rendimento: 12,
    prazo_meses_fundo: 36,
    criado_em: '2026-01-15T10:00:00-03:00',
  }

  it('escreve os campos no formato pt-BR: dinheiro com milhar e 2 casas, taxas sem zeros inúteis', () => {
    expect(deSimulacaoParaForm(SIMULACAO)).toEqual({
      nome: 'Onix 2026',
      valorVeiculo: '95.000,00',
      valorEntrada: '20.000,00',
      taxaIpcaProjetada: '4,5',
      taxaFundoRendimento: '12',
      prazoMesesFundo: '36',
    })
  })

  it('ignora id, criado_em e o que não é do formulário', () => {
    expect(Object.keys(deSimulacaoParaForm(SIMULACAO)).sort()).toEqual(Object.keys(VALIDO).sort())
  })

  it('entrada 0 aparece como "0,00"', () => {
    expect(deSimulacaoParaForm({ ...SIMULACAO, valor_entrada: 0 }).valorEntrada).toBe('0,00')
  })

  it.each([
    { valor_veiculo: 0.01, valor_entrada: 0, taxa_ipca_projetada: -20, taxa_fundo_rendimento: 0, prazo_meses_fundo: 1 },
    { valor_veiculo: 9999999, valor_entrada: 9999999, taxa_ipca_projetada: 100, taxa_fundo_rendimento: 100, prazo_meses_fundo: 60 },
    { valor_veiculo: 95000.5, valor_entrada: 1234.56, taxa_ipca_projetada: 4.123456, taxa_fundo_rendimento: 0.000001, prazo_meses_fundo: 36 },
  ])('ida e volta: API -> formulário -> valida -> corpo devolve os mesmos números (%j)', (numeros) => {
    const simulacao = { ...SIMULACAO, ...numeros }
    const form = deSimulacaoParaForm(simulacao)
    expect(esquemaSimulacao.safeParse(form).success).toBe(true)
    expect(paraCorpoDaApi(form)).toEqual({
      nome: simulacao.nome,
      valor_veiculo: simulacao.valor_veiculo,
      valor_entrada: simulacao.valor_entrada,
      taxa_ipca_projetada: simulacao.taxa_ipca_projetada,
      taxa_fundo_rendimento: simulacao.taxa_fundo_rendimento,
      prazo_meses_fundo: simulacao.prazo_meses_fundo,
    })
  })
})

describe('CAMPOS_DA_API', () => {
  it('mapeia cada chave do backend para o campo do formulário (e cobre todos os campos)', () => {
    expect(CAMPOS_DA_API).toEqual({
      nome: 'nome',
      valor_veiculo: 'valorVeiculo',
      valor_entrada: 'valorEntrada',
      taxa_ipca_projetada: 'taxaIpcaProjetada',
      taxa_fundo_rendimento: 'taxaFundoRendimento',
      prazo_meses_fundo: 'prazoMesesFundo',
    })
    expect(Object.values(CAMPOS_DA_API).sort()).toEqual(Object.keys(VALIDO).sort())
  })
})
