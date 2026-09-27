import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EsqueletoLista from './EsqueletoLista.jsx'
import EstadoErro from './EstadoErro.jsx'
import EstadoVazio from './EstadoVazio.jsx'

describe('EstadoVazio', () => {
  it('mostra o título, a descrição e o botão como LINK do roteador', async () => {
    render(
      <MemoryRouter initialEntries={['/simulacoes']}>
        <Routes>
          <Route
            path="/simulacoes"
            element={
              <EstadoVazio
                titulo="Nenhuma simulação ainda"
                descricao="Crie a primeira para comparar as formas de comprar o carro."
                acao={{ rotulo: 'Criar a primeira simulação', para: '/simulacoes/nova' }}
              />
            }
          />
          <Route path="/simulacoes/nova" element={<p>tela de nova simulação</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Nenhuma simulação ainda' })).toBeInTheDocument()
    expect(screen.getByText('Crie a primeira para comparar as formas de comprar o carro.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Criar a primeira simulação' })
    expect(link).toHaveAttribute('href', '/simulacoes/nova')
    await userEvent.click(link)
    expect(screen.getByText('tela de nova simulação')).toBeInTheDocument()
  })

  it('o botão também pode ser uma ação (aoClicar) em vez de link', async () => {
    const aoClicar = vi.fn()
    render(<EstadoVazio titulo="Vazio" acao={{ rotulo: 'Fazer algo', aoClicar }} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fazer algo' }))
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it('sem ação e sem descrição, mostra só o título (controle)', () => {
    render(<EstadoVazio titulo="Vazio" />)
    expect(screen.getByText('Vazio')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('EstadoErro', () => {
  it('mostra o título padrão, a mensagem e o Tentar de novo, que chama a ação', async () => {
    const aoTentarNovamente = vi.fn()
    render(<EstadoErro mensagem="Não foi possível falar com o servidor." aoTentarNovamente={aoTentarNovamente} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar')
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentarNovamente).toHaveBeenCalledTimes(1)
  })

  it('aceita um título próprio', () => {
    render(<EstadoErro titulo="Não foi possível carregar suas simulações" mensagem="Erro." />)
    expect(screen.getByText('Não foi possível carregar suas simulações')).toBeInTheDocument()
  })

  it('sem aoTentarNovamente não mostra o botão (controle)', () => {
    render(<EstadoErro mensagem="Erro." />)
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })
})

describe('EsqueletoLista', () => {
  it('indica que está carregando (aria-busy, papel de status) e não mostra conteúdo falso', () => {
    render(<EsqueletoLista />)
    const regiao = screen.getByRole('status', { name: 'Carregando' })
    expect(regiao).toHaveAttribute('aria-busy', 'true')
    expect(regiao).toHaveTextContent('')
  })

  it('mostra 3 cartões por padrão e aceita outra quantidade', () => {
    const { container, rerender } = render(<EsqueletoLista />)
    expect(container.querySelectorAll('.MuiCard-root')).toHaveLength(3)
    rerender(<EsqueletoLista quantidade={5} />)
    expect(container.querySelectorAll('.MuiCard-root')).toHaveLength(5)
  })
})
