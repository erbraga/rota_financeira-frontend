import { screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { servidor } from '../mocks/servidor.js'
import { renderizar } from '../testUtils.jsx'
import EstadoApi from './EstadoApi.jsx'

const SAUDE = 'http://localhost:5000/api/saude'

describe('EstadoApi', () => {
  it('mostra "API conectada" quando /saude responde 200 (controle dos casos de erro)', async () => {
    servidor.use(http.get(SAUDE, () => HttpResponse.json({ banco: 'ok', status: 'ok' })))
    renderizar(<EstadoApi />)
    expect(await screen.findByText('API conectada')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('API conectada')
  })

  it('mostra "Verificando a API…" enquanto espera a resposta e depois troca', async () => {
    servidor.use(
      http.get(SAUDE, async () => {
        await delay(100)
        return HttpResponse.json({ banco: 'ok', status: 'ok' })
      }),
    )
    renderizar(<EstadoApi />)
    expect(screen.getByText('Verificando a API…')).toBeInTheDocument()
    expect(await screen.findByText('API conectada')).toBeInTheDocument()
    expect(screen.queryByText('Verificando a API…')).not.toBeInTheDocument()
  })

  it('mostra o erro da API quando /saude responde 503', async () => {
    servidor.use(
      http.get(SAUDE, () => HttpResponse.json({ erro: 'Banco de dados indisponível' }, { status: 503 })),
    )
    renderizar(<EstadoApi />)
    expect(await screen.findByText('Erro da API: Banco de dados indisponível')).toBeInTheDocument()
    expect(screen.queryByText('API conectada')).not.toBeInTheDocument()
  })

  it('mostra "Sem conexão com o servidor" quando não há resposta (servidor fora do ar ou CORS)', async () => {
    servidor.use(http.get(SAUDE, () => HttpResponse.error()))
    renderizar(<EstadoApi />)
    expect(await screen.findByText('Sem conexão com o servidor')).toBeInTheDocument()
  })

  it('a falha de rede tem mensagem diferente do erro da API', async () => {
    servidor.use(http.get(SAUDE, () => HttpResponse.error()))
    renderizar(<EstadoApi />)
    await screen.findByText('Sem conexão com o servidor')
    expect(screen.queryByText(/Erro da API/)).not.toBeInTheDocument()
  })
})
