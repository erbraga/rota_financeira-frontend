import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderizar } from '../testUtils.jsx'
import ErroInesperado from './ErroInesperado.jsx'

describe('ErroInesperado: variante "tela" (dentro do Layout, em volta do <Outlet />)', () => {
  it('mostra o título, o texto e o botão Tentar de novo, que chama aoTentarNovo', async () => {
    const aoTentarNovo = vi.fn()
    renderizar(<ErroInesperado variante="tela" aoTentarNovo={aoTentarNovo} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Algo deu errado nesta tela' })).toBeInTheDocument()
    expect(document.title).toBe('Algo deu errado nesta tela · Rota Financeira')
    const botao = screen.getByRole('button', { name: 'Tentar de novo' })
    await waitFor(() => expect(botao).toHaveFocus())
    botao.click()
    expect(aoTentarNovo).toHaveBeenCalledTimes(1)
  })

  it('tem um link para as simulações (mesmo texto de SimulacaoNaoEncontrada e Resultado: "Voltar ao histórico")', () => {
    renderizar(<ErroInesperado variante="tela" aoTentarNovo={() => {}} />)
    expect(screen.getByRole('link', { name: 'Voltar ao histórico' })).toHaveAttribute('href', '/simulacoes')
  })

  it('não tem "Recarregar a página" (só a variante global tem)', () => {
    renderizar(<ErroInesperado variante="tela" aoTentarNovo={() => {}} />)
    expect(screen.queryByText('Recarregar a página')).not.toBeInTheDocument()
  })
})

describe('ErroInesperado: variante "global" (tela cheia, fora do roteador)', () => {
  it('mostra o título e o botão Recarregar a página, que chama aoTentarNovo', async () => {
    const aoTentarNovo = vi.fn()
    renderizar(<ErroInesperado variante="global" aoTentarNovo={aoTentarNovo} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Algo deu errado' })).toBeInTheDocument()
    expect(document.title).toBe('Algo deu errado · Rota Financeira')
    const botao = screen.getByRole('button', { name: 'Recarregar a página' })
    await waitFor(() => expect(botao).toHaveFocus())
    botao.click()
    expect(aoTentarNovo).toHaveBeenCalledTimes(1)
  })

  it('não tem link para as simulações (controle: o react-router pode nem estar disponível)', () => {
    renderizar(<ErroInesperado variante="global" aoTentarNovo={() => {}} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
