// Formulário de simulação: validação (Zod) com as MESMAS regras e mensagens do backend, e o ÚNICO ponto de
// conversão entre o formulário (camelCase, tudo em texto) e a API (snake_case, números).
import { z } from 'zod'
import { casasDecimais, dinheiroParaCampo, lerNumero, numeroParaCampo } from '../utils/formatar.js'

export const OBRIGATORIO = 'Campo obrigatório.'

// Mensagens reais do backend (conferidas em 2026-09-26).
export const MSG_NOME = 'O nome deve ter entre 1 e 120 caracteres.'
const MSG_VEICULO = 'O valor do veículo deve estar entre 0,01 e 9.999.999,00.'
const MSG_ENTRADA = 'O valor da entrada deve estar entre 0,00 e 9.999.999,00.'
const MSG_IPCA = 'A taxa de IPCA projetada deve estar entre -20 e 100.'
const MSG_FUNDO = 'A taxa de rendimento do fundo deve estar entre 0 e 100.'
const MSG_PRAZO = 'O prazo do fundo (em meses) deve estar entre 1 e 60.'
export const MSG_INTEIRO = 'Número inteiro inválido.'
const MSG_ENTRADA_MAIOR = 'A entrada não pode ser maior que o valor do veículo.'

// Nome dos campos do formulário -> chave da API (e o inverso, para os erros do servidor).
export const CAMPOS_DA_API = {
  nome: 'nome',
  valor_veiculo: 'valorVeiculo',
  valor_entrada: 'valorEntrada',
  taxa_ipca_projetada: 'taxaIpcaProjetada',
  taxa_fundo_rendimento: 'taxaFundoRendimento',
  prazo_meses_fundo: 'prazoMesesFundo',
}

// Campo numérico em texto (também usado pelo formulário das opções de financiamento). Ordem, igual à do backend: leitura -> inteiro -> faixa -> casas.
// vazioVale: valor usado quando o campo está vazio (entrada = 0); sem ele, vazio é "Campo obrigatório.".
export function campoNumerico({ min, max, mensagemFaixa, casas, inteiro = false, vazioVale }) {
  return z.string({ error: OBRIGATORIO }).superRefine((texto, ctx) => {
    const erro = (message) => ctx.addIssue({ code: 'custom', message })
    if (texto.trim() === '') {
      if (vazioVale === undefined) erro(OBRIGATORIO)
      return
    }
    const lido = lerNumero(texto)
    if (lido.erro) return erro(lido.erro)
    if (inteiro && !Number.isInteger(lido.valor)) return erro(MSG_INTEIRO)
    if (lido.valor < min || lido.valor > max) return erro(mensagemFaixa)
    if (casas !== undefined && casasDecimais(lido.valor) > casas) {
      erro(`Use no máximo ${casas} casas decimais.`)
    }
  })
}

export const esquemaSimulacao = z
  .object({
    nome: z
      .string({ error: OBRIGATORIO })
      .trim()
      .min(1, OBRIGATORIO)
      .max(120, MSG_NOME),
    valorVeiculo: campoNumerico({ min: 0.01, max: 9999999, mensagemFaixa: MSG_VEICULO, casas: 2 }),
    // Opcional: vazio vale 0 (o backend recusa null, então a SPA sempre envia um número).
    valorEntrada: campoNumerico({ min: 0, max: 9999999, mensagemFaixa: MSG_ENTRADA, casas: 2, vazioVale: 0 }),
    taxaIpcaProjetada: campoNumerico({ min: -20, max: 100, mensagemFaixa: MSG_IPCA, casas: 6 }),
    taxaFundoRendimento: campoNumerico({ min: 0, max: 100, mensagemFaixa: MSG_FUNDO, casas: 6 }),
    prazoMesesFundo: campoNumerico({ min: 1, max: 60, mensagemFaixa: MSG_PRAZO, inteiro: true }),
  })
  .superRefine((valores, ctx) => {
    // Entrada <= veículo (igual vale). Só compara quando os dois são números válidos; o erro vai para a entrada.
    const veiculo = lerNumero(valores.valorVeiculo)
    const entrada = valores.valorEntrada.trim() === '' ? { valor: 0 } : lerNumero(valores.valorEntrada)
    if (veiculo.valor !== null && !veiculo.erro && entrada.valor !== null && !entrada.erro && entrada.valor > veiculo.valor) {
      ctx.addIssue({ code: 'custom', path: ['valorEntrada'], message: MSG_ENTRADA_MAIOR })
    }
  })

// Valores de uma simulação nova: a entrada já vem "0,00"; os demais campos, vazios.
export function valoresIniciais() {
  return {
    nome: '',
    valorVeiculo: '',
    valorEntrada: dinheiroParaCampo(0),
    taxaIpcaProjetada: '',
    taxaFundoRendimento: '',
    prazoMesesFundo: '',
  }
}

// Formulário (texto) -> corpo da API. Dinheiro e taxas como NÚMERO; o prazo como número INTEIRO (o backend recusa
// texto no prazo); nome aparado; entrada vazia vale 0 (o backend recusa null). Nunca id, usuario_id nem criado_em.
// Espera valores JÁ validados pelo esquema: se algo obrigatório não for número, é erro de programação.
export function paraCorpoDaApi(valores) {
  const numero = (texto, rotulo) => {
    const { valor, erro } = lerNumero(texto)
    if (erro || valor === null) throw new Error(`Valor inválido em ${rotulo}: paraCorpoDaApi exige valores já validados.`)
    return valor
  }
  const entrada = valores.valorEntrada.trim() === '' ? 0 : numero(valores.valorEntrada, 'valorEntrada')
  return {
    nome: valores.nome.trim(),
    valor_veiculo: numero(valores.valorVeiculo, 'valorVeiculo'),
    valor_entrada: entrada,
    taxa_ipca_projetada: numero(valores.taxaIpcaProjetada, 'taxaIpcaProjetada'),
    taxa_fundo_rendimento: numero(valores.taxaFundoRendimento, 'taxaFundoRendimento'),
    prazo_meses_fundo: numero(valores.prazoMesesFundo, 'prazoMesesFundo'),
  }
}

// Simulação da API -> valores do formulário (texto no formato de campo: dinheiro com 2 casas e milhar; taxas
// sem zeros inúteis; prazo inteiro).
export function deSimulacaoParaForm(simulacao) {
  return {
    nome: simulacao.nome,
    valorVeiculo: dinheiroParaCampo(simulacao.valor_veiculo),
    valorEntrada: dinheiroParaCampo(simulacao.valor_entrada),
    taxaIpcaProjetada: numeroParaCampo(simulacao.taxa_ipca_projetada),
    taxaFundoRendimento: numeroParaCampo(simulacao.taxa_fundo_rendimento),
    prazoMesesFundo: numeroParaCampo(simulacao.prazo_meses_fundo),
  }
}
