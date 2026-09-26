import { describe, expect, it } from 'vitest'
import { ehErroApi, ehErroRede, ErroApi, ErroRede } from './erros.js'

describe('ErroApi', () => {
  it('guarda status, mensagem e detalhes por campo', () => {
    const erro = new ErroApi({
      status: 422,
      erro: 'Dados inválidos',
      detalhes: { email: ['Campo obrigatório.'] },
    })
    expect(erro).toBeInstanceOf(Error)
    expect(erro.name).toBe('ErroApi')
    expect(erro.status).toBe(422)
    expect(erro.erro).toBe('Dados inválidos')
    expect(erro.message).toBe('Dados inválidos')
    expect(erro.detalhes).toEqual({ email: ['Campo obrigatório.'] })
  })

  it('os detalhes são opcionais', () => {
    const erro = new ErroApi({ status: 404, erro: 'Simulação não encontrada' })
    expect(erro.detalhes).toBeUndefined()
  })
})

describe('ErroRede', () => {
  it('tem mensagem própria, distinta da de um erro da API', () => {
    const erro = new ErroRede()
    expect(erro).toBeInstanceOf(Error)
    expect(erro.name).toBe('ErroRede')
    expect(erro.porTimeout).toBe(false)
    expect(erro.message).toBe('Não foi possível falar com o servidor.')
  })

  it('marca o estouro de timeout com mensagem própria e guarda a causa', () => {
    const causa = new TypeError('Failed to fetch')
    const erro = new ErroRede({ porTimeout: true, causa })
    expect(erro.porTimeout).toBe(true)
    expect(erro.message).toBe('O servidor demorou demais para responder.')
    expect(erro.causa).toBe(causa)
  })
})

describe('ehErroApi / ehErroRede', () => {
  it('reconhecem cada tipo e não confundem um com o outro', () => {
    const api = new ErroApi({ status: 500, erro: 'x' })
    const rede = new ErroRede()
    expect(ehErroApi(api)).toBe(true)
    expect(ehErroRede(api)).toBe(false)
    expect(ehErroRede(rede)).toBe(true)
    expect(ehErroApi(rede)).toBe(false)
  })

  it('recusam erros comuns, valores vazios e objetos sem nome', () => {
    for (const valor of [new Error('x'), new TypeError('y'), null, undefined, {}, 'ErroApi']) {
      expect(ehErroApi(valor)).toBe(false)
      expect(ehErroRede(valor)).toBe(false)
    }
  })
})
