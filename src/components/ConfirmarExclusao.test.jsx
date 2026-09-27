import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmarExclusao from './ConfirmarExclusao.jsx'

const TITULO = 'Excluir a simulação "Onix 2026"?'
const DESCRICAO = 'As opções de financiamento dela também serão excluídas.'

function renderizar(props = {}) {
  const aoCancelar = vi.fn()
  const aoConfirmar = vi.fn()
  const resultado = render(
    <ConfirmarExclusao titulo={TITULO} descricao={DESCRICAO} aberto aoCancelar={aoCancelar} aoConfirmar={aoConfirmar} {...props} />,
  )
  return { aoCancelar, aoConfirmar, ...resultado }
}

describe('ConfirmarExclusao', () => {
  it('fechado não renderiza o diálogo (controle)', () => {
    renderizar({ aberto: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aberto mostra o título e o aviso de que as opções também serão apagadas e de que não há como desfazer', () => {
    renderizar()
    const dialogo = screen.getByRole('dialog', { name: 'Excluir a simulação "Onix 2026"?' })
    expect(dialogo).toHaveTextContent('As opções de financiamento dela também serão excluídas.')
    expect(dialogo).toHaveTextContent('Esta ação não pode ser desfeita.')
  })

  it('serve a outros recursos: título e texto de uma OPÇÃO de financiamento (nada da simulação aparece)', () => {
    renderizar({ titulo: 'Excluir a opção "Banco A"?', descricao: undefined })
    const dialogo = screen.getByRole('dialog', { name: 'Excluir a opção "Banco A"?' })
    expect(dialogo).toHaveTextContent('Esta ação não pode ser desfeita.')
    expect(dialogo).not.toHaveTextContent('As opções de financiamento dela')
    expect(dialogo).not.toHaveTextContent('simulação')
  })

  it('com a descrição, ela vem antes de "Esta ação não pode ser desfeita." (controle)', () => {
    renderizar({ titulo: 'Excluir a opção "Banco A"?', descricao: 'Ela deixa de entrar na comparação.' })
    expect(screen.getByRole('dialog')).toHaveTextContent('Ela deixa de entrar na comparação. Esta ação não pode ser desfeita.')
  })

  it('Cancelar chama aoCancelar e NÃO confirma', async () => {
    const { aoCancelar, aoConfirmar } = renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoCancelar).toHaveBeenCalledTimes(1)
    expect(aoConfirmar).not.toHaveBeenCalled()
  })

  it('Excluir chama aoConfirmar e NÃO cancela', async () => {
    const { aoCancelar, aoConfirmar } = renderizar()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(aoCancelar).not.toHaveBeenCalled()
  })

  it('Esc fecha (cancela) quando não há requisição em andamento', async () => {
    const { aoCancelar } = renderizar()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(aoCancelar).toHaveBeenCalledTimes(1))
  })

  it('durante a requisição: os dois botões ficam desabilitados, mostra "Excluindo…" e Esc NÃO fecha', async () => {
    const { aoCancelar } = renderizar({ carregando: true })
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(aoCancelar).not.toHaveBeenCalled()
  })

  it('mostra o erro no próprio diálogo, mantendo os botões para tentar de novo', () => {
    renderizar({ erro: 'Não foi possível falar com o servidor.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('sem erro não mostra alerta (controle)', () => {
    renderizar()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
