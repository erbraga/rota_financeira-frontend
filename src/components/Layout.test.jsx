import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { servidor } from '../mocks/servidor.js'
import { renderizar } from '../testUtils.jsx'
import Layout from './Layout.jsx'

describe('Layout', () => {
  it('mostra a barra com o nome do app, o estado da API e a rota filha na área principal', async () => {
    servidor.use(
      http.get('http://localhost:5000/api/saude', () => HttpResponse.json({ banco: 'ok', status: 'ok' })),
    )
    renderizar(
      <Routes>
        <Route element={<Layout />}>
          <Route path="/teste" element={<p>Conteúdo da rota</p>} />
        </Route>
      </Routes>,
      { rota: '/teste' },
    )

    expect(screen.getByText('Rota Financeira')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('Conteúdo da rota')
    expect(await screen.findByText('API conectada')).toBeInTheDocument()
  })
})
