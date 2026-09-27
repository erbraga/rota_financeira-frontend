import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FIXTURES_DE_RESULTADO } from '../mocks/handlers/resultado.js'
import CartaoCenario from './CartaoCenario.jsx'

const TRES = FIXTURES_DE_RESULTADO.tresOpcoes
const [PRICE, SAC, SEM_JUROS] = TRES.cenarios.financiamentos

const norm = (texto) => texto.replaceAll(' ', ' ') // o Intl separa "R$" do número com um espaço sem quebra

function mostrar(props) {
  return render(
    <MemoryRouter>
      <CartaoCenario simulacaoId={1} {...props} />
    </MemoryRouter>,
  )
}

// O texto do valor de uma linha "rótulo/valor" (lista de definição).
const valorDe = (rotulo) => norm(screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling.textContent)
const custoTotal = () => norm(screen.getByText('Custo total').nextElementSibling.textContent)

describe('CartaoCenario: à vista', () => {
  it('mostra o título e o custo total (o valor do veículo, como a API traz)', () => {
    mostrar({ tipo: 'a_vista', cenario: TRES.cenarios.a_vista })
    expect(screen.getByRole('article', { name: 'Compra à vista' })).toBeInTheDocument()
    expect(custoTotal()).toBe('R$ 95.000,00')
    expect(screen.getByText('Você paga o valor do veículo de uma vez.')).toBeInTheDocument()
  })

  it('não tem link de parcelas nem linhas de financiamento', () => {
    mostrar({ tipo: 'a_vista', cenario: TRES.cenarios.a_vista })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Total pago')).not.toBeInTheDocument()
  })
})

describe('CartaoCenario: financiamento Price (48x, parcelas que diferem por centavos)', () => {
  it('mostra os detalhes formatados, exatamente os números da API', () => {
    mostrar({ tipo: 'financiamento', cenario: PRICE })
    expect(screen.getByRole('article', { name: 'Banco Exemplo Price 48x' })).toBeInTheDocument()
    expect(custoTotal()).toBe('R$ 125.750,09')
    expect(valorDe('Sistema')).toBe('Price')
    expect(valorDe('Prazo')).toBe('48 meses')
    expect(valorDe('Valor financiado')).toBe('R$ 75.000,00')
    expect(valorDe('Entrada')).toBe('R$ 20.000,00')
    expect(valorDe('Primeira parcela')).toBe('R$ 2.203,12')
    expect(valorDe('Última parcela')).toBe('R$ 2.203,45')
    expect(valorDe('Total pago')).toBe('R$ 105.750,09')
    expect(valorDe('Total de juros')).toBe('R$ 30.750,09')
  })

  it('a última parcela diferente da primeira traz a frase do arredondamento (e não a da SAC)', () => {
    mostrar({ tipo: 'financiamento', cenario: PRICE })
    expect(screen.getByText('A última parcela absorve o arredondamento de centavos das parcelas anteriores.')).toBeInTheDocument()
    expect(screen.queryByText(/decrescentes/)).not.toBeInTheDocument()
  })

  it('controle: com as duas parcelas IGUAIS mostra uma só linha "Parcela" e nenhuma frase', () => {
    mostrar({ tipo: 'financiamento', cenario: { ...PRICE, ultima_parcela: PRICE.primeira_parcela } })
    expect(valorDe('Parcela')).toBe('R$ 2.203,12')
    expect(screen.queryByText('Primeira parcela')).not.toBeInTheDocument()
    expect(screen.queryByText('Última parcela')).not.toBeInTheDocument()
    expect(screen.queryByText(/absorve o arredondamento/)).not.toBeInTheDocument()
  })

  it('o prazo de 1 mês fala "1 mês"', () => {
    mostrar({ tipo: 'financiamento', cenario: { ...PRICE, prazo_meses: 1 } })
    expect(valorDe('Prazo')).toBe('1 mês')
  })

  it('o link "Ver parcelas" aponta para a amortização da opção e tem o nome dela', () => {
    mostrar({ tipo: 'financiamento', cenario: PRICE, simulacaoId: 7 })
    expect(screen.getByRole('link', { name: 'Ver parcelas de Banco Exemplo Price 48x' })).toHaveAttribute(
      'href',
      `/simulacoes/7/financiamentos/${PRICE.id}`,
    )
  })
})

describe('CartaoCenario: financiamento SAC (parcelas decrescentes)', () => {
  it('mostra as parcelas e a frase da SAC, sem a do arredondamento', () => {
    mostrar({ tipo: 'financiamento', cenario: SAC })
    expect(valorDe('Sistema')).toBe('SAC')
    expect(valorDe('Prazo')).toBe('36 meses')
    expect(valorDe('Primeira parcela')).toBe('R$ 2.854,44')
    expect(valorDe('Última parcela')).toBe('R$ 1.969,88')
    expect(valorDe('Entrada')).toBe('R$ 25.000,00')
    expect(custoTotal()).toBe('R$ 111.835,04')
    expect(screen.getByText('As parcelas da SAC são decrescentes.')).toBeInTheDocument()
    expect(screen.queryByText(/absorve o arredondamento/)).not.toBeInTheDocument()
  })
})

describe('CartaoCenario: financiamento sem juros e sem entrada (72x)', () => {
  it('mostra o valor financiado inteiro, juros zerados e a entrada zerada', () => {
    mostrar({ tipo: 'financiamento', cenario: SEM_JUROS })
    expect(valorDe('Prazo')).toBe('72 meses')
    expect(valorDe('Valor financiado')).toBe('R$ 95.000,00')
    expect(valorDe('Entrada')).toBe('R$ 0,00')
    expect(valorDe('Total de juros')).toBe('R$ 0,00')
    expect(custoTotal()).toBe('R$ 95.000,00')
  })
})

describe('CartaoCenario: destaque do menor custo', () => {
  it('destacado: etiqueta ESCRITA "Menor custo" dentro do cartão (não depende só de cor)', () => {
    mostrar({ tipo: 'a_vista', cenario: TRES.cenarios.a_vista, destacado: true })
    const cartao = screen.getByRole('article', { name: 'Compra à vista' })
    expect(within(cartao).getByText('Menor custo')).toBeInTheDocument()
  })

  it('controle: sem `destacado` não há etiqueta', () => {
    mostrar({ tipo: 'a_vista', cenario: TRES.cenarios.a_vista })
    expect(screen.queryByText('Menor custo')).not.toBeInTheDocument()
  })

  it('a borda é mais forte só no cartão destacado', () => {
    const { rerender } = mostrar({ tipo: 'a_vista', cenario: TRES.cenarios.a_vista, destacado: true })
    const forte = getComputedStyle(screen.getByRole('article')).borderWidth
    rerender(
      <MemoryRouter>
        <CartaoCenario tipo="a_vista" cenario={TRES.cenarios.a_vista} />
      </MemoryRouter>,
    )
    const normal = getComputedStyle(screen.getByRole('article')).borderWidth
    expect(forte).toBe('2px')
    expect(normal).toBe('1px')
  })
})

describe('CartaoCenario: bordas', () => {
  it('nome de 120 caracteres quebra a linha em vez de estourar o cartão', () => {
    mostrar({ tipo: 'financiamento', cenario: { ...PRICE, nome: 'x'.repeat(120) } })
    expect(screen.getByRole('heading', { level: 3 })).toHaveStyle({ overflowWrap: 'anywhere' })
  })

  it('valores de milhões cabem no texto formatado', () => {
    mostrar({ tipo: 'financiamento', cenario: { ...PRICE, custo_total: 11411660.11, total_juros: 10000000.5 } })
    expect(custoTotal()).toBe('R$ 11.411.660,11')
    expect(valorDe('Total de juros')).toBe('R$ 10.000.000,50')
  })

  it('não mostra nenhum texto de cálculo nem ícone', () => {
    const { container } = mostrar({ tipo: 'financiamento', cenario: PRICE })
    expect(container.textContent).not.toMatch(/soma|diferença|economia|a mais/i)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('um tipo desconhecido é erro de programação', () => {
    expect(() => mostrar({ tipo: 'outro', cenario: {} })).toThrow(/desconhecido/)
  })
})

// ---- Fundo ------------------------------------------------------------------------------------------------------
const FUNDO = FIXTURES_DE_RESULTADO.padrao.cenarios.fundo
const FUNDO_COM_APORTE = FIXTURES_DE_RESULTADO.aporteQueAlcanca.cenarios.fundo
const FUNDO_SEM_META = FIXTURES_DE_RESULTADO.aporteInsuficiente.cenarios.fundo
const FUNDO_VENCE = FIXTURES_DE_RESULTADO.fundoVence

describe('CartaoCenario: fundo (padrão, a meta no prazo)', () => {
  it('mostra os detalhes formatados, exatamente os números da API', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO })
    expect(screen.getByRole('article', { name: 'Fundo de investimento' })).toBeInTheDocument()
    expect(custoTotal()).toBe('R$ 108.410,78')
    expect(screen.getByText('Alcança a meta no mês 36.')).toBeInTheDocument()
    expect(valorDe('Capital inicial')).toBe('R$ 20.000,00')
    expect(valorDe('Aporte mensal')).toBe('R$ 1.881,98')
    expect(valorDe('Prazo')).toBe('36 meses')
    expect(valorDe('Mês da meta')).toBe('mês 36')
    expect(valorDe('Preço na compra')).toBe('R$ 108.410,78')
    expect(valorDe('Total aportado')).toBe('R$ 67.751,28')
    expect(valorDe('Rendimento')).toBe('R$ 20.659,54')
    expect(valorDe('Saldo final')).toBe('R$ 108.410,82')
  })

  it('não mostra a frase de "sem custo total" (controle)', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO })
    expect(screen.queryByText(/Sem custo total/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Não alcança/)).not.toBeInTheDocument()
  })

  it('aporte calculado 0 (entrada igual ao veículo): "R$ 0,00" por mês', () => {
    mostrar({ tipo: 'fundo', cenario: { ...FUNDO, aporte_mensal: 0 } })
    expect(valorDe('Aporte mensal')).toBe('R$ 0,00')
  })

  it('o cartão do fundo destacado (fixture "o fundo vence") tem a etiqueta e o custo do backend', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO_VENCE.cenarios.fundo, destacado: FUNDO_VENCE.menor_custo.cenario === 'fundo' })
    expect(screen.getByText('Menor custo')).toBeInTheDocument()
    expect(custoTotal()).toBe('R$ 48.640,00')
  })
})

describe('CartaoCenario: fundo com aporte informado', () => {
  it('que alcança a meta: o mês da meta e o aporte usado (1.500) do backend', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO_COM_APORTE })
    expect(screen.getByText('Alcança a meta no mês 44.')).toBeInTheDocument()
    expect(valorDe('Aporte mensal')).toBe('R$ 1.500,00')
    expect(valorDe('Prazo')).toBe('44 meses')
    expect(valorDe('Mês da meta')).toBe('mês 44')
    expect(custoTotal()).toBe('R$ 111.639,19')
  })

  it('que NÃO alcança: "não alcança a meta em 60 meses", com o mês da meta, o preço e o custo total como "—"', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO_SEM_META })
    expect(screen.getByText('Não alcança a meta em 60 meses.')).toBeInTheDocument()
    expect(screen.getByText('Sem custo total: o fundo não alcança o preço em 60 meses.')).toBeInTheDocument()
    expect(custoTotal()).toBe('—')
    expect(valorDe('Mês da meta')).toBe('—')
    expect(valorDe('Preço na compra')).toBe('—')
    // os demais valores são os do mês 60, como a API os traz
    expect(valorDe('Aporte mensal')).toBe('R$ 100,00')
    expect(valorDe('Total aportado')).toBe('R$ 6.000,00')
    expect(valorDe('Rendimento')).toBe('R$ 17.280,96')
    expect(valorDe('Saldo final')).toBe('R$ 43.280,96')
    expect(screen.queryByText(/Alcança a meta/)).not.toBeInTheDocument()
  })

  it('controle: com o custo preenchido o "—" não aparece', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO_COM_APORTE })
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('sem meta alcançada o cartão nunca é destacado quando o backend não o indica (o menor_custo já vem sem ele)', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO_SEM_META, destacado: false })
    expect(screen.queryByText('Menor custo')).not.toBeInTheDocument()
  })
})

describe('CartaoCenario: conteúdo extra (o controle do aporte)', () => {
  it('mostra os filhos no fim do cartão, só no cartão que os recebe', () => {
    mostrar({ tipo: 'fundo', cenario: FUNDO, children: <button>simular aqui</button> })
    expect(within(screen.getByRole('article')).getByRole('button', { name: 'simular aqui' })).toBeInTheDocument()
  })

  it('controle: os outros cartões não têm o controle', () => {
    mostrar({ tipo: 'financiamento', cenario: PRICE })
    expect(screen.queryByRole('button', { name: 'simular aqui' })).not.toBeInTheDocument()
  })
})
