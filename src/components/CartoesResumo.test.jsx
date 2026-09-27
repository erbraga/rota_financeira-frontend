import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FIXTURES_DE_RESULTADO } from '../mocks/handlers/resultado.js'
import CartoesResumo from './CartoesResumo.jsx'

const { padrao, tresOpcoes, semOpcoes, fundoVence, aporteInsuficiente } = FIXTURES_DE_RESULTADO

function mostrar(resultado, props = {}) {
  return render(
    <MemoryRouter>
      <CartoesResumo resultado={resultado} simulacaoId={1} {...props} />
    </MemoryRouter>,
  )
}

const cartoes = () => screen.getAllByRole('article')
const nomes = () => cartoes().map((c) => within(c).getByRole('heading', { level: 3 }).textContent)
// Nomes dos cartões que têm a etiqueta "Menor custo".
const destacados = () =>
  cartoes()
    .filter((c) => within(c).queryByText('Menor custo'))
    .map((c) => within(c).getByRole('heading', { level: 3 }).textContent)

describe('CartoesResumo: ordem e conteúdo', () => {
  it('à vista, financiamentos em ordem de criação e fundo', () => {
    mostrar(tresOpcoes)
    expect(nomes()).toEqual([
      'Compra à vista',
      'Banco Exemplo Price 48x',
      'Banco Exemplo SAC 36x',
      'Banco Exemplo Sem Juros 72x',
      'Fundo de investimento',
    ])
  })

  it('o resultado padrão (2 opções) tem 4 cartões', () => {
    mostrar(padrao)
    expect(cartoes()).toHaveLength(4)
  })

  it('título da seção e a frase do custo total, sempre visível', () => {
    mostrar(padrao)
    expect(screen.getByRole('heading', { level: 2, name: 'Custo de cada cenário' })).toBeInTheDocument()
    const frase = screen.getByText(/O custo total é o que se paga pelo carro/)
    expect(frase).toHaveTextContent('valores nominais')
    expect(frase).toHaveTextContent('sem valor presente')
    expect(frase).toHaveTextContent('corrigido pelo IPCA')
    expect(frase).toHaveTextContent('não o dinheiro que sai do bolso')
  })

  it('cada cartão de financiamento leva ao link "Ver parcelas" da SUA opção', () => {
    mostrar(tresOpcoes, { simulacaoId: 9 })
    const links = screen.getAllByRole('link').filter((l) => l.textContent === 'Ver parcelas')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/simulacoes/9/financiamentos/1',
      '/simulacoes/9/financiamentos/2',
      '/simulacoes/9/financiamentos/3',
    ])
  })
})

describe('CartoesResumo: destaque do menor custo (o que o backend indicou)', () => {
  it('à vista (padrão, e também o empate de um financiamento sem juros com o à vista)', () => {
    mostrar(tresOpcoes) // o financiamento sem juros custa 95.000, igual ao à vista: o backend indica o à vista
    expect(destacados()).toEqual(['Compra à vista'])
  })

  it('fundo (IPCA negativo)', () => {
    mostrar(fundoVence)
    expect(destacados()).toEqual(['Fundo de investimento'])
  })

  it('um FINANCIAMENTO: o id casa com a opção certa (a segunda), e só ela é destacada', () => {
    mostrar({ ...tresOpcoes, menor_custo: { cenario: 'financiamento', id: 2 } })
    expect(destacados()).toEqual(['Banco Exemplo SAC 36x'])
  })

  it('controle: um id que não existe não destaca NENHUM financiamento (nem o à vista nem o fundo)', () => {
    mostrar({ ...tresOpcoes, menor_custo: { cenario: 'financiamento', id: 99 } })
    expect(destacados()).toEqual([])
  })

  it('controle: nunca há mais de um cartão destacado', () => {
    for (const resultado of [padrao, tresOpcoes, semOpcoes, fundoVence, aporteInsuficiente]) {
      const { unmount } = mostrar(resultado)
      expect(destacados().length).toBeLessThanOrEqual(1)
      unmount()
    }
  })

  it('no modo aporte que não alcança, o fundo fica fora do destaque (o backend indica o à vista)', () => {
    mostrar(aporteInsuficiente)
    expect(destacados()).toEqual(['Compra à vista'])
    expect(destacados()).not.toContain('Fundo de investimento')
  })
})

describe('CartoesResumo: sem opções de financiamento', () => {
  it('só à vista e fundo, com o convite e o link para a edição', () => {
    mostrar(semOpcoes, { simulacaoId: 4 })
    expect(nomes()).toEqual(['Compra à vista', 'Fundo de investimento'])
    expect(screen.getByText('Nenhum financiamento para comparar')).toBeInTheDocument()
    expect(screen.getByText(/Adicione opções de financiamento para compará-las/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Adicionar opções' })).toHaveAttribute('href', '/simulacoes/4/editar')
  })

  it('controle: com 1 ou mais opções o convite não aparece', () => {
    mostrar(padrao)
    expect(screen.queryByText('Nenhum financiamento para comparar')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Adicionar opções' })).not.toBeInTheDocument()
  })
})

describe('CartoesResumo: controle do aporte', () => {
  it('o conteúdo recebido fica DENTRO do cartão do fundo, e só nele', () => {
    mostrar(padrao, { controleAporte: <button>simular aqui</button> })
    const fundo = cartoes().find((c) => within(c).queryByRole('heading', { name: 'Fundo de investimento' }))
    expect(within(fundo).getByRole('button', { name: 'simular aqui' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'simular aqui' })).toHaveLength(1)
  })
})

describe('CartoesResumo: nenhum cálculo', () => {
  it('não mostra comparações ("economia", "a mais") nem soma alguma', () => {
    const { container } = mostrar(tresOpcoes)
    expect(container.textContent).not.toMatch(/economia|a mais que|diferença de|soma/i)
  })
})
