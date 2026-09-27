import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import MudancaDeRota from './MudancaDeRota.jsx'

// O stub de window.scrollTo é global (setupTests.js: o jsdom não o implementa de verdade). As tarefas de tempo
// aqui são curtas (props do componente), para o teste não depender de segundos reais.

// Telas de teste: uma simples, uma com um campo autoFocus, uma cujo <h1> só aparece depois de uma "comporta"
// (a promessa que o próprio teste resolve, nunca um delay por tempo) e uma sem h1 nenhum.
function TelaSimples({ titulo }) {
  return <h1>{titulo}</h1>
}

function TelaComCampo() {
  return (
    <>
      <h1>Com campo</h1>
      <input autoFocus aria-label="campo" />
    </>
  )
}

function TelaAtrasada({ comporta }) {
  const [pronta, setPronta] = useState(false)
  comporta.then(() => setPronta(true))
  if (!pronta) return <p>Carregando…</p>
  return <h1>Tela atrasada</h1>
}

function TelaSemH1() {
  return <p>Sem título nenhum</p>
}

// Simula um diálogo do MUI (que usa um Portal: renderiza fora do <main>, direto no body). O próprio botão dispara a
// navegação (como um diálogo real, cujo foco preso mantém o clique dentro dele), para o foco continuar no diálogo
// tanto durante quanto depois do clique, sem precisar simular a armadilha de foco de verdade.
function DialogoFalso({ paraOnde }) {
  const navigate = useNavigate()
  return (
    <div role="dialog" aria-label="Diálogo de teste">
      <button onClick={() => navigate(paraOnde)}>Ir e manter o diálogo</button>
    </div>
  )
}

function criarComporta() {
  let liberar
  const promessa = new Promise((resolver) => {
    liberar = resolver
  })
  return { promessa, liberar }
}

// O conteúdo roteado fica dentro de um <main>, como em Layout.jsx e LayoutPublico.jsx: é essa marca que diferencia
// a TELA NOVA (onde um autoFocus decide o foco) da navegação ao redor dela (onde um link clicado não deve "vencer").
function Harness({ rotaInicial = '/a', mostrarDialogo = false, ...propsDoComponente }) {
  const comporta = Harness.comporta ?? criarComporta().promessa
  return (
    <MemoryRouter initialEntries={[rotaInicial]}>
      <MudancaDeRota {...propsDoComponente} />
      <nav>
        <Link to="/a">Ir para A</Link>
        <Link to="/b">Ir para B</Link>
        <Link to="/campo">Ir para o campo</Link>
        <Link to="/atrasada">Ir para a atrasada</Link>
        <Link to="/sem-h1">Ir para sem h1</Link>
        <Link to="/a?x=1">Só muda a busca</Link>
        <Voltar />
      </nav>
      {mostrarDialogo && <DialogoFalso paraOnde="/b" />}
      <main>
        <Routes>
          <Route path="/a" element={<TelaSimples titulo="Tela A" />} />
          <Route path="/b" element={<TelaSimples titulo="Tela B" />} />
          <Route path="/campo" element={<TelaComCampo />} />
          <Route path="/atrasada" element={<TelaAtrasada comporta={comporta} />} />
          <Route path="/sem-h1" element={<TelaSemH1 />} />
        </Routes>
      </main>
    </MemoryRouter>
  )
}

function Voltar() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Voltar</button>
}

const h1 = () => document.querySelector('h1')

describe('MudancaDeRota: primeira carga', () => {
  it('não rola nem mexe no foco na primeira carga (o componente só reage a TROCAS de rota)', async () => {
    render(<Harness rotaInicial="/a" />)
    await new Promise((resolver) => setTimeout(resolver, 20))
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(h1()).not.toHaveFocus()
  })
})

describe('MudancaDeRota: trocar de rota', () => {
  it('rola ao topo e foca o h1 da tela nova (controle: a tela anterior não tinha o foco)', async () => {
    render(<Harness rotaInicial="/a" esperaMaximaMs={500} passoDaEsperaMs={10} />)
    expect(h1()).toHaveTextContent('Tela A')
    await userEvent.click(screen.getByRole('link', { name: 'Ir para B' }))
    await waitFor(() => expect(h1()).toHaveFocus())
    expect(h1()).toHaveTextContent('Tela B')
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, left: 0 }))
  })

  it('espera o h1 que só aparece depois do carregamento (comporta), sem erro', async () => {
    const { promessa, liberar } = criarComporta()
    Harness.comporta = promessa
    render(<Harness rotaInicial="/a" esperaMaximaMs={2000} passoDaEsperaMs={10} />)
    await userEvent.click(screen.getByRole('link', { name: 'Ir para a atrasada' }))
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(document.querySelector('h1')).toBeNull()

    await act(async () => liberar())
    await waitFor(() => expect(h1()).toHaveTextContent('Tela atrasada'))
    await waitFor(() => expect(h1()).toHaveFocus())
    Harness.comporta = undefined
  })

  it('sem h1 na tela: desiste depois do tempo, sem erro e sem foco perdido (nada rouba o foco: fica no link clicado)', async () => {
    render(<Harness rotaInicial="/a" esperaMaximaMs={150} passoDaEsperaMs={10} />)
    const link = screen.getByRole('link', { name: 'Ir para sem h1' })
    await userEvent.click(link)
    await new Promise((resolver) => setTimeout(resolver, 250))
    expect(document.querySelector('h1')).toBeNull()
    expect(link).toHaveFocus()
  })

  it('o h1 focado NÃO é parada de tabulação: o próximo Tab sai dele, não fica preso (é o último item tabulável da árvore)', async () => {
    render(<Harness rotaInicial="/a" esperaMaximaMs={500} passoDaEsperaMs={10} />)
    await userEvent.click(screen.getByRole('link', { name: 'Ir para B' }))
    await waitFor(() => expect(h1()).toHaveFocus())
    await userEvent.tab()
    expect(h1()).not.toHaveFocus()
    expect(document.activeElement).toBe(document.body)
  })
})

describe('MudancaDeRota: não disputa o foco', () => {
  it('um campo com autoFocus mantém o foco (o h1 não o rouba)', async () => {
    render(<Harness rotaInicial="/a" esperaMaximaMs={500} passoDaEsperaMs={10} />)
    await userEvent.click(screen.getByRole('link', { name: 'Ir para o campo' }))
    await waitFor(() => expect(screen.getByLabelText('campo')).toHaveFocus())
    await new Promise((resolver) => setTimeout(resolver, 100))
    expect(screen.getByLabelText('campo')).toHaveFocus()
    expect(h1()).not.toHaveFocus()
  })

  it('um diálogo aberto (fora do <main>, como um Portal do MUI) mantém o foco: o h1 da tela de trás não o rouba', async () => {
    render(<Harness rotaInicial="/a" mostrarDialogo esperaMaximaMs={500} passoDaEsperaMs={10} />)
    const botaoDoDialogo = screen.getByRole('button', { name: 'Ir e manter o diálogo' })
    await userEvent.click(botaoDoDialogo)
    await waitFor(() => expect(h1()).toHaveTextContent('Tela B'))
    await new Promise((resolver) => setTimeout(resolver, 100))
    expect(botaoDoDialogo).toHaveFocus()
    expect(h1()).not.toHaveFocus()
  })
})

describe('MudancaDeRota: só a busca muda', () => {
  it('trocar só o ?x=1 (mesmo caminho) NÃO rola nem move o foco (controle: um caminho novo faz os dois)', async () => {
    render(<Harness rotaInicial="/a" esperaMaximaMs={500} passoDaEsperaMs={10} />)
    await userEvent.click(screen.getByRole('link', { name: 'Ir para B' }))
    await waitFor(() => expect(h1()).toHaveFocus())
    window.scrollTo.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' })) // A, focando o h1 de A
    await waitFor(() => expect(h1()).toHaveTextContent('Tela A'))
    await waitFor(() => expect(h1()).toHaveFocus())

    h1().blur()
    window.scrollTo.mockClear()
    await userEvent.click(screen.getByRole('link', { name: 'Só muda a busca' }))
    await new Promise((resolver) => setTimeout(resolver, 50))
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(h1()).not.toHaveFocus()
  })
})

describe('MudancaDeRota: Voltar e Avançar do navegador', () => {
  it('o Voltar do navegador (navigate(-1)) também rola ao topo e foca o h1 da tela para onde volta', async () => {
    render(<Harness rotaInicial="/a" esperaMaximaMs={500} passoDaEsperaMs={10} />)
    await userEvent.click(screen.getByRole('link', { name: 'Ir para B' }))
    await waitFor(() => expect(h1()).toHaveTextContent('Tela B'))
    window.scrollTo.mockClear()

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    await waitFor(() => expect(h1()).toHaveTextContent('Tela A'))
    await waitFor(() => expect(h1()).toHaveFocus())
    expect(window.scrollTo).toHaveBeenCalled()
  })
})
