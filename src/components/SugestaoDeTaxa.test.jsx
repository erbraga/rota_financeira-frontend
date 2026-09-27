import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { INDICES } from '../mocks/handlers/indices.js'
import { renderizar } from '../testUtils.jsx'
import SugestaoDeTaxa from './SugestaoDeTaxa.jsx'

const TEXTO_IPCA = 'É o IPCA acumulado nos últimos 12 meses (já realizado), não uma projeção. Use como referência.'
const ERRO = 'Não foi possível obter a sugestão do Banco Central agora. Digite a taxa.'

const sucesso = (indice, extra = {}) => ({ isPending: false, isError: false, isFetching: false, data: { ...INDICES[indice], ...extra } })
const carregando = { isPending: true, isError: false, isFetching: true, data: undefined }
const comErro = { isPending: false, isError: true, isFetching: false, data: undefined }

function montar(indice, consulta, propriedades = {}) {
  const aoUsar = vi.fn()
  const aoTentarNovamente = vi.fn()
  renderizar(
    <SugestaoDeTaxa id="apoio" indice={indice} consulta={consulta} aoUsar={aoUsar} aoTentarNovamente={aoTentarNovamente} {...propriedades} />,
  )
  return { aoUsar, aoTentarNovamente, regiao: document.getElementById('apoio') }
}

describe('SugestaoDeTaxa: sugestão', () => {
  it('CDI: origem com o valor e a data do dia, botão Usar com nome acessível', () => {
    const { regiao } = montar('cdi', sucesso('cdi'))
    expect(regiao.textContent).toContain('Sugestão do Banco Central: 13,65% a.a. (CDI de 24/09/2026)')
    expect(screen.getByRole('button', { name: 'Usar a sugestão do CDI: 13,65%' })).toHaveTextContent('Usar 13,65%')
    expect(screen.queryByText(/Dados do cache/)).not.toBeInTheDocument()
  })

  it('IPCA: origem com o mês (ago/2026, não o dia) e nome acessível do IPCA', () => {
    const { regiao } = montar('ipca', sucesso('ipca'))
    expect(regiao.textContent).toContain('Sugestão do Banco Central: 4,22% a.a. (IPCA acumulado em 12 meses até ago/2026)')
    expect(regiao.textContent).not.toContain('01/08/2026')
    expect(screen.getByRole('button', { name: 'Usar a sugestão do IPCA: 4,22%' })).toBeInTheDocument()
  })

  it('o valor em destaque é texto (não só cor ou negrito): "13,65% a.a." aparece no texto', () => {
    montar('cdi', sucesso('cdi'))
    expect(screen.getByText('13,65% a.a.')).toBeInTheDocument()
  })

  it('Usar entrega a taxa no formato do campo (vírgula), sem mexer em nada mais', async () => {
    const { aoUsar, aoTentarNovamente } = montar('cdi', sucesso('cdi'))
    await userEvent.click(screen.getByRole('button', { name: /Usar a sugestão do CDI/ }))
    expect(aoUsar).toHaveBeenCalledExactlyOnceWith('13,65')
    expect(aoTentarNovamente).not.toHaveBeenCalled()
  })

  it('valor com mais casas sai como veio, sem arredondar', async () => {
    const dados = { sugestao: { valor: 4.123456, data_referencia: '2026-08-01' } }
    const { aoUsar } = montar('ipca', sucesso('ipca', dados))
    expect(screen.getByRole('button', { name: /Usar a sugestão do IPCA/ })).toHaveTextContent('Usar 4,123456%')
    await userEvent.click(screen.getByRole('button', { name: /Usar a sugestão do IPCA/ }))
    expect(aoUsar).toHaveBeenCalledWith('4,123456')
  })
})

describe('SugestaoDeTaxa: dados do cache (desatualizado)', () => {
  it('avisa em texto e mantém a sugestão e o botão', () => {
    const { regiao } = montar('cdi', sucesso('cdi', { desatualizado: true }))
    expect(screen.getByText('Dados do cache, podem estar defasados.')).toBeInTheDocument()
    expect(regiao.textContent).toContain('13,65% a.a.')
    expect(screen.getByRole('button', { name: /Usar a sugestão do CDI/ })).toBeEnabled()
  })

  it('controle: com desatualizado false não há aviso', () => {
    montar('cdi', sucesso('cdi', { desatualizado: false }))
    expect(screen.queryByText(/defasados/)).not.toBeInTheDocument()
  })
})

describe('SugestaoDeTaxa: sem sugestão', () => {
  it('mostra que não há sugestão, sem botão Usar', () => {
    montar('cdi', sucesso('cdi', { sugestao: null }))
    expect(screen.getByText('Sem sugestão do Banco Central disponível agora. Digite a taxa.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('SugestaoDeTaxa: carregando', () => {
  it('mostra o texto de busca dentro de uma região aria-live polite, sem botões', () => {
    const { regiao } = montar('cdi', carregando)
    const viva = regiao.querySelector('[aria-live="polite"]')
    expect(viva).toHaveTextContent('Buscando a sugestão do Banco Central…')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('a chegada da sugestão acontece na MESMA região viva (é ela que o leitor de tela anuncia)', async () => {
    function Chegada() {
      const [consulta, setConsulta] = useState(carregando)
      return (
        <>
          <button onClick={() => setConsulta(sucesso('cdi'))}>chegar</button>
          <SugestaoDeTaxa id="apoio" indice="cdi" consulta={consulta} aoUsar={() => {}} aoTentarNovamente={() => {}} />
        </>
      )
    }
    renderizar(<Chegada />)
    const viva = document.querySelector('[aria-live="polite"]')
    expect(viva).toHaveTextContent('Buscando')
    await userEvent.click(screen.getByRole('button', { name: 'chegar' }))
    expect(document.querySelector('[aria-live="polite"]')).toBe(viva)
    expect(viva).toHaveTextContent('Sugestão do Banco Central: 13,65% a.a.')
  })
})

describe('SugestaoDeTaxa: erro', () => {
  it('mostra o aviso com Tentar de novo, que refaz só esta consulta', async () => {
    const { aoTentarNovamente, aoUsar } = montar('cdi', comErro)
    expect(screen.getByText(ERRO)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentarNovamente).toHaveBeenCalledTimes(1)
    expect(aoUsar).not.toHaveBeenCalled()
  })

  it('enquanto tenta de novo mostra a busca, e não o erro nem o botão', () => {
    montar('cdi', { ...comErro, isFetching: true })
    expect(screen.getByText('Buscando a sugestão do Banco Central…')).toBeInTheDocument()
    expect(screen.queryByText(ERRO)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('SugestaoDeTaxa: texto do IPCA realizado', () => {
  const estados = {
    carregando,
    erro: comErro,
    'sem sugestão': sucesso('ipca', { sugestao: null }),
    sugestão: sucesso('ipca'),
    desatualizado: sucesso('ipca', { desatualizado: true }),
  }

  it.each(Object.keys(estados))('aparece no estado "%s"', (estado) => {
    montar('ipca', estados[estado])
    expect(screen.getByText(TEXTO_IPCA)).toBeInTheDocument()
  })

  it('controle: o CDI nunca mostra o texto do IPCA', () => {
    for (const consulta of [carregando, comErro, sucesso('cdi'), sucesso('cdi', { sugestao: null })]) {
      const { unmount } = renderizar(<SugestaoDeTaxa id="a" indice="cdi" consulta={consulta} aoUsar={() => {}} aoTentarNovamente={() => {}} />)
      expect(screen.queryByText(TEXTO_IPCA)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('está fora da região viva (não é anunciado de novo a cada mudança)', () => {
    montar('ipca', sucesso('ipca'))
    const viva = document.querySelector('[aria-live="polite"]')
    expect(within(viva).queryByText(TEXTO_IPCA)).not.toBeInTheDocument()
  })
})
