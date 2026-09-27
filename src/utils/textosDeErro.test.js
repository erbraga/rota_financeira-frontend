// Camada única dos textos de erro (Etapa 8): todo código que mostra um erro à pessoa passa por aqui.
// Este teste é a referência dos literais: os outros testes (ErroRede, api.js, mensagemDeErro) conferem contra ELE,
// nunca o contrário.
import { describe, expect, it } from 'vitest'
import {
  MENSAGEM_ERRO_INESPERADO,
  MENSAGEM_REDE,
  MENSAGEM_TIMEOUT,
  mensagemGenericaPorStatus,
} from './textosDeErro.js'

describe('textosDeErro: literais', () => {
  it('rede fora do ar, timeout e o inesperado', () => {
    expect(MENSAGEM_REDE).toBe('Não foi possível falar com o servidor.')
    expect(MENSAGEM_TIMEOUT).toBe('O servidor demorou demais para responder.')
    expect(MENSAGEM_ERRO_INESPERADO).toBe('Ocorreu um erro inesperado. Tente novamente.')
    // as três são diferentes entre si (ninguém confunde rede com timeout com "algo deu errado")
    expect(new Set([MENSAGEM_REDE, MENSAGEM_TIMEOUT, MENSAGEM_ERRO_INESPERADO]).size).toBe(3)
  })

  it.each([
    [400, 'Requisição inválida.'],
    [401, 'Sessão inválida ou expirada.'],
    [403, 'Acesso negado.'],
    [404, 'Recurso não encontrado.'],
    [409, 'A operação conflita com o estado atual.'],
    [415, 'Formato de requisição não aceito.'],
    [422, 'Dados inválidos.'],
    [500, 'Erro interno do servidor.'],
    [502, 'Servidor indisponível no momento.'],
    [503, 'Servidor indisponível no momento.'],
    [504, 'Servidor indisponível no momento.'],
  ])('mensagem genérica do status %i: "%s"', (status, mensagem) => {
    expect(mensagemGenericaPorStatus(status)).toBe(mensagem)
  })

  it('um 5xx desconhecido usa a mensagem genérica de servidor', () => {
    expect(mensagemGenericaPorStatus(599)).toBe('Erro no servidor. Tente novamente mais tarde.')
    expect(mensagemGenericaPorStatus(507)).toBe('Erro no servidor. Tente novamente mais tarde.')
  })

  it('um 4xx desconhecido usa a mensagem genérica de requisição (controle: nunca a de servidor)', () => {
    expect(mensagemGenericaPorStatus(418)).toBe('Não foi possível concluir a requisição.')
    expect(mensagemGenericaPorStatus(451)).toBe('Não foi possível concluir a requisição.')
    expect(mensagemGenericaPorStatus(418)).not.toBe(mensagemGenericaPorStatus(599))
  })

  it('nenhum texto tem corpo cru, URL, stack, nome de classe de erro nem "[object Object]"', () => {
    const proibidos = [
      /<html/i,
      /https?:\/\//,
      /\bat\s+\w+\s*\(/, // linha de stack trace tipo "at fn ("
      /Error:/,
      /\[object Object\]/,
      /TypeError|SyntaxError|ReferenceError/,
    ]
    const todos = [
      MENSAGEM_REDE,
      MENSAGEM_TIMEOUT,
      MENSAGEM_ERRO_INESPERADO,
      ...[400, 401, 403, 404, 409, 415, 422, 500, 502, 503, 504, 418, 599].map(mensagemGenericaPorStatus),
    ]
    for (const texto of todos) {
      for (const padrao of proibidos) expect(texto).not.toMatch(padrao)
    }
  })
})
