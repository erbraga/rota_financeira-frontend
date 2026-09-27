import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary.jsx'

// Lança de propósito (controlado por prop) para provar que a fronteira captura; sem "detonar" é uma tela normal.
function Bomba({ detonar = true, mensagem = 'Estourou de propósito' }) {
  if (detonar) throw new Error(mensagem)
  return <p>Tudo bem</p>
}

function Envolver({ children, ...props }) {
  return (
    <MemoryRouter>
      <ErrorBoundary {...props}>{children}</ErrorBoundary>
    </MemoryRouter>
  )
}

// O jsdom não deixa redefinir window.location.reload (propriedade não configurável): substitui o objeto inteiro.
function simularReload() {
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  return reload
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const TITULO_TELA = 'Algo deu errado nesta tela'
const TITULO_GLOBAL = 'Algo deu errado'

describe('ErrorBoundary: captura o erro de renderização (nunca deixa a tela em branco)', () => {
  it('um filho que lança mostra a tela de erro, não uma tela em branco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Envolver variante="tela">
        <Bomba />
      </Envolver>,
    )
    expect(screen.getByRole('heading', { level: 1, name: TITULO_TELA })).toBeInTheDocument()
  })

  it('registra o TEXTO do erro no console (controle: o stack não aparece na TELA)', () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Envolver variante="tela">
        <Bomba mensagem="Falha bem específica" />
      </Envolver>,
    )
    const chamadaDaFronteira = consoleErro.mock.calls.find((args) =>
      typeof args[0] === 'string' && args[0].includes('Erro de renderização capturado'),
    )
    expect(chamadaDaFronteira).toBeDefined()
    expect(chamadaDaFronteira[1]).toBe('Falha bem específica')
    expect(document.body.textContent).not.toContain('at Bomba')
    expect(document.body.textContent).not.toContain('.jsx:')
  })

  it('um filho que NÃO lança não mostra nada da fronteira (controle)', () => {
    render(
      <Envolver variante="tela">
        <Bomba detonar={false} />
      </Envolver>,
    )
    expect(screen.getByText('Tudo bem')).toBeInTheDocument()
    expect(screen.queryByText(TITULO_TELA)).not.toBeInTheDocument()
  })
})

describe('ErrorBoundary: Tentar de novo (variante "tela")', () => {
  it('reinicia e mostra o filho de novo, se o erro já passou', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let detonar = true
    function FilhoControlavel() {
      return <Bomba detonar={detonar} />
    }
    render(
      <Envolver variante="tela">
        <FilhoControlavel />
      </Envolver>,
    )
    expect(screen.getByRole('heading', { name: TITULO_TELA })).toBeInTheDocument()

    detonar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Tudo bem')).toBeInTheDocument()
  })

  it('se o erro ainda acontece, Tentar de novo simplesmente mostra a mesma tela de erro de novo (controle)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Envolver variante="tela">
        <Bomba detonar />
      </Envolver>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(screen.getByRole('heading', { name: TITULO_TELA })).toBeInTheDocument()
  })

  it('mudar a `chave` reinicia sozinha (uma tela quebrada não contamina a seguinte)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Harness({ chave, detonar }) {
      return (
        <Envolver variante="tela" chave={chave}>
          <Bomba detonar={detonar} />
        </Envolver>
      )
    }
    const { rerender } = render(<Harness chave="/a" detonar />)
    expect(screen.getByRole('heading', { name: TITULO_TELA })).toBeInTheDocument()

    rerender(<Harness chave="/b" detonar={false} />)
    expect(screen.getByText('Tudo bem')).toBeInTheDocument()
    expect(screen.queryByText(TITULO_TELA)).not.toBeInTheDocument()
  })

  it('controle: sem mudar a `chave`, um novo render NÃO reinicia a fronteira sozinha', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Harness({ chave, detonar }) {
      return (
        <Envolver variante="tela" chave={chave}>
          <Bomba detonar={detonar} />
        </Envolver>
      )
    }
    const { rerender } = render(<Harness chave="/a" detonar />)
    expect(screen.getByRole('heading', { name: TITULO_TELA })).toBeInTheDocument()

    rerender(<Harness chave="/a" detonar={false} />)
    expect(screen.getByRole('heading', { name: TITULO_TELA })).toBeInTheDocument()
    expect(screen.queryByText('Tudo bem')).not.toBeInTheDocument()
  })
})

describe('ErrorBoundary: pacote que falha em carregar (React.lazy) não se recupera sozinho', () => {
  it('Tentar de novo RECARREGA a página quando o erro é de importação dinâmica, mesmo na variante "tela"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = simularReload()
    render(
      <Envolver variante="tela">
        <Bomba mensagem="Failed to fetch dynamically imported module: /assets/Resultado.js" />
      </Envolver>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('controle: um erro comum NÃO recarrega a página, só reinicia a fronteira', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = simularReload()
    render(
      <Envolver variante="tela">
        <Bomba mensagem="Erro qualquer, sem nada a ver com importação" />
      </Envolver>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('ErrorBoundary: variante "global" (tela cheia, para o que quebrar fora do layout)', () => {
  it('mostra a tela cheia com Recarregar a página para um erro fora do layout', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <Envolver variante="global">
        <Bomba />
      </Envolver>,
    )
    expect(screen.getByRole('heading', { level: 1, name: TITULO_GLOBAL })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recarregar a página' })).toBeInTheDocument()
  })

  it('Recarregar a página SEMPRE recarrega (mesmo sem ser erro de importação): não há troca de tela para reiniciar sozinha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = simularReload()
    render(
      <Envolver variante="global">
        <Bomba mensagem="Erro qualquer" />
      </Envolver>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar a página' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
