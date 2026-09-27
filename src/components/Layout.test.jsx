import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lerToken } from '../auth/tokenStorage.js'
import { criarUsuario, tokenDe } from '../mocks/banco.js'
import { handlers } from '../mocks/handlers/index.js'
import { servidor } from '../mocks/servidor.js'
import { renderizarComAuth } from '../testUtils.jsx'
import Layout from './Layout.jsx'

// Lança de propósito, para testar a fronteira de erro por tela (controlado por prop; sem "detonar" é uma tela normal).
function Bomba({ detonar = true }) {
  if (detonar) throw new Error('Estourou de propósito')
  return <p>Tudo bem</p>
}

function Rotas() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/teste" element={<p>Conteúdo da rota</p>} />
        <Route path="/quebra" element={<Bomba />} />
        <Route path="/ok" element={<p>Tudo bem</p>} />
      </Route>
    </Routes>
  )
}

// Um <Link> FORA das rotas (irmão de <Rotas />, dentro do mesmo roteador): continua montado mesmo quando a rota
// atual é a que lança, então dá para trocar de rota a partir da tela de erro (a barra do Layout não tem link
// para /quebra nem /ok).
function ComNavegacao() {
  return (
    <>
      <Link to="/ok">Ir para OK</Link>
      <Rotas />
    </>
  )
}

let ana

beforeEach(() => {
  servidor.use(...handlers)
  ana = criarUsuario({ nome: 'Ana Souza', email: 'ana@example.com' })
})

describe('Layout (telas privadas)', () => {
  it('mostra a barra com o nome do app, o nome do usuário, o Sair e a rota filha', async () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Conteúdo da rota')
  })

  it('o nome do app é um link para /simulacoes', () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(screen.getByRole('link', { name: 'Rota Financeira' })).toHaveAttribute('href', '/simulacoes')
  })

  it('Sair encerra a sessão: apaga o token e avisa que saiu', async () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    await screen.findByText('Ana Souza')

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(lerToken()).toBeNull())
    expect(sessionStorage.getItem('rota-financeira.token')).toBeNull()
  })

  it('enquanto o usuário não chegou do perfil, não mostra nome (e não quebra)', () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('não existe mais o indicador temporário "API conectada"', async () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    await screen.findByText('Ana Souza')
    expect(screen.queryByText(/API conectada/)).not.toBeInTheDocument()
  })
})

describe('Layout: fronteira de erro por tela (Etapa 8)', () => {
  it('uma tela que lança mostra "Algo deu errado nesta tela", mas a barra e o Sair continuam funcionando', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderizarComAuth(<Rotas />, { rota: '/quebra', token: tokenDe(ana) })

    expect(await screen.findByRole('heading', { level: 1, name: 'Algo deu errado nesta tela' })).toBeInTheDocument()
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(lerToken()).toBeNull())
  })

  it('controle: uma tela que NÃO lança não mostra nada da fronteira', () => {
    renderizarComAuth(<Rotas />, { rota: '/teste', token: tokenDe(ana) })
    expect(screen.queryByText('Algo deu errado nesta tela')).not.toBeInTheDocument()
    expect(screen.getByText('Conteúdo da rota')).toBeInTheDocument()
  })

  it('trocar de tela reinicia a fronteira sozinha: a tela seguinte abre normal (uma tela quebrada não contamina a outra)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderizarComAuth(<ComNavegacao />, { rota: '/quebra', token: tokenDe(ana) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Algo deu errado nesta tela' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Ir para OK' }))
    expect(await screen.findByText('Tudo bem')).toBeInTheDocument()
    expect(screen.queryByText('Algo deu errado nesta tela')).not.toBeInTheDocument()
  })
})
