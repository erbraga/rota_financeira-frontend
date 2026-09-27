import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SO_PARA_LEITOR_DE_TELA } from './estilos.js'

describe('SO_PARA_LEITOR_DE_TELA', () => {
  it('tem largura e altura em pixels LITERAIS (não a proporção 0-1 que o sx do MUI lê como porcentagem)', () => {
    expect(SO_PARA_LEITOR_DE_TELA.width).toBe('1px')
    expect(SO_PARA_LEITOR_DE_TELA.height).toBe('1px')
  })

  it('controle: os valores antigos (número 1, sem unidade) seriam recusados por este teste', () => {
    expect(SO_PARA_LEITOR_DE_TELA.width).not.toBe(1)
    expect(SO_PARA_LEITOR_DE_TELA.height).not.toBe(1)
  })

  it('a margem é em pixel literal, não a unidade de espaçamento do tema (m: -1 valeria -8px)', () => {
    expect(SO_PARA_LEITOR_DE_TELA.margin).toBe('-1px')
  })

  it('renderizado, o elemento mede de fato 1px de largura e de altura', () => {
    const { container } = render(<p style={SO_PARA_LEITOR_DE_TELA}>texto de teste</p>)
    const el = container.querySelector('p')
    const estilo = getComputedStyle(el)
    expect(estilo.width).toBe('1px')
    expect(estilo.height).toBe('1px')
    expect(estilo.position).toBe('absolute')
    expect(estilo.overflow).toBe('hidden')
  })

  it('some visualmente (clip/overflow) sem sair do fluxo de leitura (não tem display: none nem aria-hidden)', () => {
    expect(SO_PARA_LEITOR_DE_TELA.clip).toBe('rect(0 0 0 0)')
    expect(SO_PARA_LEITOR_DE_TELA.display).toBeUndefined()
  })
})
