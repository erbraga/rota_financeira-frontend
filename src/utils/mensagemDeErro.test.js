import { describe, expect, it } from 'vitest'
import { ErroApi, ErroRede } from '../api/erros.js'
import { MENSAGEM_ERRO_INESPERADO } from './errosDeFormulario.js'
import { mensagemDeErro } from './mensagemDeErro.js'

describe('mensagemDeErro', () => {
  it('rede e timeout: a mensagem própria, distinta da de um erro da API', () => {
    expect(mensagemDeErro(new ErroRede())).toBe('Não foi possível falar com o servidor.')
    expect(mensagemDeErro(new ErroRede({ porTimeout: true }))).toBe('O servidor demorou demais para responder.')
  })

  it('erro da API: o "erro" do backend', () => {
    expect(mensagemDeErro(new ErroApi({ status: 503, erro: 'Serviço indisponível' }))).toBe('Serviço indisponível')
    expect(mensagemDeErro(new ErroApi({ status: 404, erro: 'Simulação não encontrada' }))).toBe('Simulação não encontrada')
  })

  it.each([new Error('stack secreto'), new TypeError('x'), null, undefined, 'texto'])(
    'qualquer outro (%s): mensagem genérica, sem detalhes técnicos',
    (erro) => {
      expect(mensagemDeErro(erro)).toBe(MENSAGEM_ERRO_INESPERADO)
    },
  )
})
