import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NOME_DO_APP, useTituloDaPagina } from './useTituloDaPagina.js'

function Pagina({ titulo }) {
  useTituloDaPagina(titulo)
  return null
}

describe('useTituloDaPagina', () => {
  it('define o título no formato "tela · Rota Financeira" ao montar', () => {
    render(<Pagina titulo="Entrar" />)
    expect(document.title).toBe('Entrar · Rota Financeira')
  })

  it('atualiza o título quando o texto muda', () => {
    const { rerender } = render(<Pagina titulo="Carregando…" />)
    expect(document.title).toBe('Carregando… · Rota Financeira')
    rerender(<Pagina titulo="Resultado: Carro de exemplo" />)
    expect(document.title).toBe('Resultado: Carro de exemplo · Rota Financeira')
  })

  it('nome de 120 caracteres não quebra', () => {
    const nome = 'x'.repeat(120)
    render(<Pagina titulo={nome} />)
    expect(document.title).toBe(`${nome} · ${NOME_DO_APP}`)
  })

  it.each([undefined, null, ''])('sem texto (%j) o título volta a "Rota Financeira", sem separador (controle)', (titulo) => {
    render(<Pagina titulo={titulo} />)
    expect(document.title).toBe('Rota Financeira')
    expect(document.title).not.toContain('·')
  })

  it('trocar de tela (desmontar uma, montar outra) muda o título', () => {
    const { unmount } = render(<Pagina titulo="Minhas simulações" />)
    expect(document.title).toBe('Minhas simulações · Rota Financeira')
    unmount()
    render(<Pagina titulo="Nova simulação" />)
    expect(document.title).toBe('Nova simulação · Rota Financeira')
  })

  it('ao desmontar sem uma tela nova, restaura o título de antes (nunca deixa um título obsoleto)', () => {
    document.title = 'Rota Financeira'
    const { unmount } = render(<Pagina titulo="Entrar" />)
    expect(document.title).toBe('Entrar · Rota Financeira')
    unmount()
    expect(document.title).toBe('Rota Financeira')
  })
})
