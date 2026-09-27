import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AvisosProvider from './AvisosProvider.jsx'
import { useAviso } from './useAviso.js'

// Captura o mostrarAviso do contexto (depois da renderização) para os testes o chamarem dentro de act.
const captura = { mostrarAviso: null }
function Sonda() {
  const { mostrarAviso } = useAviso()
  useEffect(() => {
    captura.mostrarAviso = mostrarAviso
  })
  return null
}

// Relógio REAL: as transições do MUI dependem de temporizadores; a duração curta (duracao) mantém o teste rápido.
function renderizarProvedor({ duracao = 5000, filhos = <Sonda /> } = {}) {
  return render(<AvisosProvider duracao={duracao}>{filhos}</AvisosProvider>)
}

const mostrar = (texto, opcoes) => act(() => captura.mostrarAviso(texto, opcoes))
// Espera com o relógio real DENTRO de act: as transições do MUI atualizam estado enquanto esperamos.
const esperar = (ms) => act(async () => new Promise((resolver) => setTimeout(resolver, ms)))

describe('AvisosProvider', () => {
  it('não mostra nada antes de haver um aviso; depois mostra o texto como status (informativo)', () => {
    renderizarProvedor()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    mostrar('Simulação criada.')
    expect(screen.getByRole('status')).toHaveTextContent('Simulação criada.')
  })

  it('some sozinho depois da duração (e está lá logo depois de mostrar: controle)', async () => {
    renderizarProvedor({ duracao: 150 })
    mostrar('Alterações salvas.')
    expect(screen.getByText('Alterações salvas.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Alterações salvas.')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('a duração padrão é de 5 s: passado 1 s o aviso continua na tela', async () => {
    renderizarProvedor()
    mostrar('Simulação criada.')
    await esperar(300)
    expect(screen.getByText('Simulação criada.')).toBeInTheDocument()
  })

  it('fecha pelo botão de fechar', async () => {
    renderizarProvedor()
    mostrar('Simulação excluída.')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByText('Simulação excluída.')).not.toBeInTheDocument(), { timeout: 2000 })
  })

  it('um clique fora NÃO fecha o aviso (a pessoa ainda pode não ter lido)', async () => {
    renderizarProvedor({
      filhos: (
        <>
          <Sonda />
          <button>outro lugar da página</button>
        </>
      ),
    })
    mostrar('Simulação criada.')
    await userEvent.click(screen.getByRole('button', { name: 'outro lugar da página' }))
    await esperar(400)
    expect(screen.getByText('Simulação criada.')).toBeInTheDocument()
  })

  it('dois avisos seguidos entram em fila: um por vez, na ordem', async () => {
    renderizarProvedor({ duracao: 150 })
    mostrar('Primeiro aviso.')
    mostrar('Segundo aviso.')
    expect(screen.getByText('Primeiro aviso.')).toBeInTheDocument()
    expect(screen.queryByText('Segundo aviso.')).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Segundo aviso.')).toBeInTheDocument(), { timeout: 2500 })
    expect(screen.queryByText('Primeiro aviso.')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 2500 })
  })

  it('sobrevive à troca de rota (fica acima do roteador)', async () => {
    render(
      <AvisosProvider>
        <MemoryRouter initialEntries={['/a']}>
          <Sonda />
          <Routes>
            <Route path="/a" element={<Link to="/b">ir para B</Link>} />
            <Route path="/b" element={<p>tela B</p>} />
          </Routes>
        </MemoryRouter>
      </AvisosProvider>,
    )
    mostrar('Simulação criada.')
    await userEvent.click(screen.getByRole('link', { name: 'ir para B' }))
    expect(screen.getByText('tela B')).toBeInTheDocument()
    expect(screen.getByText('Simulação criada.')).toBeInTheDocument()
  })

  it('aceita a severidade; o padrão é sucesso', async () => {
    renderizarProvedor({ duracao: 150 })
    mostrar('Deu certo.')
    expect(screen.getByRole('status').className).toMatch(/Success/)

    mostrar('Deu errado.', { severidade: 'error' })
    await waitFor(() => expect(screen.getByText('Deu errado.')).toBeInTheDocument(), { timeout: 2500 })
    expect(screen.getByRole('status').className).toMatch(/Error/)
  })

  it('o mostrarAviso é estável entre renderizações (não muda a cada aviso)', () => {
    renderizarProvedor()
    const primeiro = captura.mostrarAviso
    mostrar('Um.')
    expect(captura.mostrarAviso).toBe(primeiro)
  })

  it('useAviso fora do AvisosProvider lança um erro claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Sonda />)).toThrow('useAviso deve ser usado dentro do AvisosProvider')
  })
})
