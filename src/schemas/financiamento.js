// Formulário de uma opção de financiamento: validação (Zod) com as MESMAS regras e mensagens do backend (conferidas em
// 2026-09-26) e o ÚNICO ponto de conversão entre o formulário (camelCase, tudo em texto) e a API (snake_case, números).
import { z } from 'zod'
import { dinheiroParaCampo, lerNumero, numeroParaCampo, casasDecimais } from '../utils/formatar.js'
import { campoNumerico, MSG_NOME, OBRIGATORIO } from './simulacao.js'

const MSG_TAXA = 'A taxa de juros mensal deve estar entre 0 e 20.'
const MSG_PRAZO = 'O prazo (em meses) deve estar entre 1 e 72.'
const MSG_ENTRADA = 'O valor da entrada deve estar entre 0,00 e 9.999.999,00.'
const MSG_SISTEMA = 'Sistema de amortização inválido. Use PRICE ou SAC.'
const ENTRADA_MAXIMA = 9999999

export const SISTEMAS = ['PRICE', 'SAC']
// Rótulo de cada sistema na tela.
export const ROTULO_DO_SISTEMA = { PRICE: 'Price', SAC: 'SAC' }

// Nome dos campos da API -> campos do formulário (e o inverso, para os erros do servidor).
export const CAMPOS_DA_API = {
  nome: 'nome',
  taxa_juros_mensal: 'taxaJurosMensal',
  prazo_meses: 'prazoMeses',
  sistema_amortizacao: 'sistemaAmortizacao',
  valor_entrada: 'valorEntrada',
}

// Ordem visual dos campos: o foco vai para o primeiro com erro.
export const ORDEM_DOS_CAMPOS = ['nome', 'taxaJurosMensal', 'prazoMeses', 'sistemaAmortizacao', 'valorEntrada']

// A regra "entrada < veículo" depende do valor do veículo SALVO da simulação (não do que está digitado e ainda não
// salvo), por isso o esquema é uma fábrica. Sem o valor (null), a regra fica a cargo do servidor. A entrada da OPÇÃO
// tem de ser estritamente menor (a da simulação aceita igual): com a entrada igual não há o que financiar.
export function criarEsquemaFinanciamento(valorVeiculo = null) {
  return z
    .object({
      nome: z.string({ error: OBRIGATORIO }).trim().min(1, OBRIGATORIO).max(120, MSG_NOME),
      taxaJurosMensal: campoNumerico({ min: 0, max: 20, mensagemFaixa: MSG_TAXA, casas: 6 }),
      prazoMeses: campoNumerico({ min: 1, max: 72, mensagemFaixa: MSG_PRAZO, inteiro: true }),
      // Nada marcado até a pessoa escolher: vazio = "Campo obrigatório." (o backend dá a mesma quando o campo falta).
      sistemaAmortizacao: z.string({ error: OBRIGATORIO }).superRefine((texto, ctx) => {
        if (texto === '') ctx.addIssue({ code: 'custom', message: OBRIGATORIO })
        else if (!SISTEMAS.includes(texto)) ctx.addIssue({ code: 'custom', message: MSG_SISTEMA })
      }),
      // Opcional: vazio vale 0 (o backend recusa null, então a SPA sempre envia um número).
      valorEntrada: campoNumerico({ min: 0, max: ENTRADA_MAXIMA, mensagemFaixa: MSG_ENTRADA, casas: 2, vazioVale: 0 }),
    })
    .superRefine((valores, ctx) => {
      if (valorVeiculo === null) return
      const entrada = valores.valorEntrada.trim() === '' ? { valor: 0 } : lerNumero(valores.valorEntrada)
      // Só compara quando a entrada já passou nas regras do campo (a faixa e as casas vêm antes, como no backend).
      const valida =
        !entrada.erro &&
        entrada.valor !== null &&
        entrada.valor >= 0 &&
        entrada.valor <= ENTRADA_MAXIMA &&
        casasDecimais(entrada.valor) <= 2
      if (valida && entrada.valor >= valorVeiculo) {
        ctx.addIssue({
          code: 'custom',
          path: ['valorEntrada'],
          message: `A entrada deve ser menor que o valor do veículo (R$ ${dinheiroParaCampo(valorVeiculo)}); com a entrada igual ao valor não há o que financiar.`,
        })
      }
    })
}

// Valores de uma opção nova: a entrada já vem "0,00"; o sistema, sem marca; os demais campos, vazios.
export function valoresIniciaisFinanciamento() {
  return {
    nome: '',
    taxaJurosMensal: '',
    prazoMeses: '',
    sistemaAmortizacao: '',
    valorEntrada: dinheiroParaCampo(0),
  }
}

// Formulário (texto) -> corpo da API. Taxa e dinheiro como NÚMERO; o prazo como número INTEIRO (o backend recusa texto
// no prazo); sistema em maiúsculas; nome aparado; entrada vazia vale 0 (o backend recusa null). Nunca id nem
// simulacao_id. Espera valores JÁ validados pelo esquema: se algo obrigatório não for número, é erro de programação.
export function paraCorpoDaApi(valores) {
  const numero = (texto, rotulo) => {
    const { valor, erro } = lerNumero(texto)
    if (erro || valor === null) throw new Error(`Valor inválido em ${rotulo}: paraCorpoDaApi exige valores já validados.`)
    return valor
  }
  const sistema = String(valores.sistemaAmortizacao).toUpperCase()
  if (!SISTEMAS.includes(sistema)) throw new Error('Sistema inválido: paraCorpoDaApi exige valores já validados.')
  return {
    nome: valores.nome.trim(),
    taxa_juros_mensal: numero(valores.taxaJurosMensal, 'taxaJurosMensal'),
    prazo_meses: numero(valores.prazoMeses, 'prazoMeses'),
    sistema_amortizacao: sistema,
    valor_entrada: valores.valorEntrada.trim() === '' ? 0 : numero(valores.valorEntrada, 'valorEntrada'),
  }
}

// Opção da API -> valores do formulário (texto no formato de campo: taxa sem zeros inúteis, prazo inteiro, dinheiro
// com 2 casas e milhar).
export function deFinanciamentoParaForm(financiamento) {
  return {
    nome: financiamento.nome,
    taxaJurosMensal: numeroParaCampo(financiamento.taxa_juros_mensal),
    prazoMeses: numeroParaCampo(financiamento.prazo_meses),
    sistemaAmortizacao: String(financiamento.sistema_amortizacao).toUpperCase(),
    valorEntrada: dinheiroParaCampo(financiamento.valor_entrada),
  }
}
