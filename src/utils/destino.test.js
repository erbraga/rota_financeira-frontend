import { describe, expect, it } from 'vitest'
import { DESTINO_PADRAO, destinoAposLogin } from './destino.js'

describe('destinoAposLogin', () => {
  it.each([
    ['/simulacoes/7/resultado', '/simulacoes/7/resultado'],
    ['/simulacoes/nova', '/simulacoes/nova'],
    ['/simulacoes/5?aba=2#topo', '/simulacoes/5?aba=2#topo'],
    ['/', '/'],
  ])('aceita o caminho interno %s', (de, esperado) => {
    expect(destinoAposLogin(de)).toBe(esperado)
  })

  it.each([
    ['sem valor', undefined],
    ['nulo', null],
    ['número', 42],
    ['objeto', { pathname: '/x' }],
    ['vazio', ''],
    ['URL externa', 'https://evil.com/phishing'],
    ['URL sem protocolo', '//evil.com'],
    ['URL sem protocolo e barra invertida', '/\\evil.com'],
    ['esquema javascript', 'javascript:alert(1)'],
    ['caminho relativo', 'simulacoes'],
    ['a própria tela de login', '/login'],
    ['o login com busca', '/login?x=1'],
    ['o registro', '/registrar'],
    ['o registro com âncora', '/registrar#topo'],
  ])('recusa %s e usa o destino padrão', (_rotulo, de) => {
    expect(destinoAposLogin(de)).toBe(DESTINO_PADRAO)
  })

  it('um caminho parecido com /login mas diferente é aceito (controle da recusa)', () => {
    expect(destinoAposLogin('/login-antigo')).toBe('/login-antigo')
    expect(destinoAposLogin('/simulacoes/login')).toBe('/simulacoes/login')
  })
})
