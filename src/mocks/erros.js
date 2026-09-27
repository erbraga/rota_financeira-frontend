// Respostas de erro no formato do backend: { erro, detalhes? }. O 401 traz WWW-Authenticate: Bearer.
import { HttpResponse } from 'msw'

// semDesafio: o 401 de "Credenciais inválidas" do login NÃO traz WWW-Authenticate no backend real.
export function respostaErro(status, erro, detalhes, { semDesafio = false } = {}) {
  const corpo = detalhes ? { erro, detalhes } : { erro }
  const headers = status === 401 && !semDesafio ? { 'WWW-Authenticate': 'Bearer' } : undefined
  return HttpResponse.json(corpo, { status, headers })
}

export const dadosInvalidos = (detalhes) => respostaErro(422, 'Dados inválidos', detalhes)
export const simulacaoNaoEncontrada = () => respostaErro(404, 'Simulação não encontrada')
export const financiamentoNaoEncontrado = () => respostaErro(404, 'Opção de financiamento não encontrada')
