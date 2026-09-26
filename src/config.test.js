import { describe, expect, it } from 'vitest'
import { lerConfig } from './config.js'

describe('lerConfig', () => {
  it('aceita uma URL http válida (caso feliz e controle dos casos inválidos)', () => {
    expect(lerConfig({ VITE_API_URL: 'http://localhost:5000/api' })).toEqual({
      urlApi: 'http://localhost:5000/api',
    })
  })

  it('aceita https', () => {
    expect(lerConfig({ VITE_API_URL: 'https://api.exemplo.com.br/api' })).toEqual({
      urlApi: 'https://api.exemplo.com.br/api',
    })
  })

  it.each(['http://localhost:5000/api/', 'http://localhost:5000/api///'])(
    'remove a barra final de %s',
    (valor) => {
      expect(lerConfig({ VITE_API_URL: valor })).toEqual({ urlApi: 'http://localhost:5000/api' })
    },
  )

  it.each([
    ['ausente', {}],
    ['indefinida', { VITE_API_URL: undefined }],
    ['vazia', { VITE_API_URL: '' }],
  ])('recusa a variável %s e cita o nome dela', (_rotulo, env) => {
    const resultado = lerConfig(env)
    expect(resultado.urlApi).toBeUndefined()
    expect(resultado.erro).toContain('VITE_API_URL')
  })

  it.each([
    ['sem protocolo', 'localhost:5000/api'],
    ['caminho relativo', '/api'],
    ['protocolo ftp', 'ftp://localhost/api'],
    ['texto qualquer', 'abc'],
  ])('recusa URL inválida (%s)', (_rotulo, valor) => {
    const resultado = lerConfig({ VITE_API_URL: valor })
    expect(resultado.urlApi).toBeUndefined()
    expect(resultado.erro).toBeTruthy()
  })

  it.each([
    ['espaço no começo', ' http://localhost:5000/api'],
    ['espaço no fim', 'http://localhost:5000/api '],
    ['espaço no meio', 'http://local host/api'],
  ])('recusa espaços (%s)', (_rotulo, valor) => {
    const resultado = lerConfig({ VITE_API_URL: valor })
    expect(resultado.urlApi).toBeUndefined()
    expect(resultado.erro).toContain('espaços')
  })

  it('lê o ambiente do Vite por padrão (valor de teste definido no vite.config.js)', () => {
    expect(lerConfig()).toEqual({ urlApi: 'http://localhost:5000/api' })
  })
})
