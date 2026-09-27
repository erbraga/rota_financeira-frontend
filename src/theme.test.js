import { createTheme, getContrastRatio } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { FONTE_SISTEMA, theme } from './theme.js'

const BRANCO = '#ffffff'
// Mínimos do WCAG 2 AA: 4,5:1 para texto normal, 3:1 para elementos gráficos (linhas, barras) e texto grande.
const MINIMO_TEXTO = 4.5
const MINIMO_GRAFICO = 3

// Cada par de cor realmente usado no app (grep em src/components e src/pages), com o mínimo exigido:
//  - texto: a cor aparece como texto sobre o fundo (Typography color=, sx={{ color: ... }}, ou texto sobre um
//    fundo colorido, como o botão "Excluir" e o Chip "Menor custo", ambos brancos sobre a cor principal);
//  - grafico: a cor só aparece como linha/barra do Recharts (nunca como texto).
const PARES_DE_COR = [
  ['primary.main', theme.palette.primary.main, BRANCO, MINIMO_TEXTO], // título do LayoutPublico
  [BRANCO, BRANCO, theme.palette.primary.main, MINIMO_TEXTO], // AppBar e Chip "Menor custo" (texto branco)
  [BRANCO, BRANCO, theme.palette.error.main, MINIMO_TEXTO], // botão "Excluir" (contained, color="error")
  ['warning.dark', theme.palette.warning.dark, BRANCO, MINIMO_TEXTO], // aviso "Dados do cache..." (SugestaoDeTaxa)
  ['secondary.main', theme.palette.secondary.main, BRANCO, MINIMO_GRAFICO], // linha do gráfico comparativo
  ['success.dark', theme.palette.success.dark, BRANCO, MINIMO_GRAFICO], // linha do fundo no gráfico comparativo
  ['text.primary', theme.palette.text.primary, BRANCO, MINIMO_TEXTO],
  ['text.secondary', theme.palette.text.secondary, BRANCO, MINIMO_TEXTO],
]

describe('theme', () => {
  it('usa a pilha de fontes do sistema, sem depender exclusivamente da Roboto', () => {
    expect(theme.typography.fontFamily).toBe(FONTE_SISTEMA)
    expect(FONTE_SISTEMA.startsWith('system-ui')).toBe(true)
    expect(FONTE_SISTEMA).toContain('sans-serif')
  })

  it('botões sem caixa alta (controle: o tema padrão do MUI usa uppercase)', () => {
    expect(createTheme().typography.button.textTransform).toBe('uppercase')
    expect(theme.typography.button.textTransform).toBe('none')
  })

  it('textos dos componentes do MUI em português (locale ptBR)', () => {
    expect(createTheme().components?.MuiTablePagination?.defaultProps?.labelRowsPerPage).toBeUndefined()
    expect(theme.components.MuiTablePagination.defaultProps.labelRowsPerPage).toBe('Linhas por página:')
  })

  it('só modo claro, com raio de borda maior que o padrão', () => {
    expect(theme.palette.mode).toBe('light')
    expect(theme.shape.borderRadius).toBeGreaterThan(createTheme().shape.borderRadius)
  })
})

describe('theme: contraste de cor (WCAG 2 AA)', () => {
  it.each(PARES_DE_COR)('%s sobre %s: contraste >= %s', (_rotulo, cor, fundo, minimo) => {
    expect(getContrastRatio(cor, fundo)).toBeGreaterThanOrEqual(minimo)
  })

  it('controle: o warning.dark PADRÃO do MUI (#e65100) seria recusado por este teste (3,79 < 4,5)', () => {
    expect(getContrastRatio(createTheme().palette.warning.dark, BRANCO)).toBeLessThan(MINIMO_TEXTO)
  })

  it('o novo warning.dark é o mesmo tom, só mais escuro (continua "laranja de aviso", não vira outra cor)', () => {
    // Mesma matiz aproximada de um laranja escuro: vermelho > verde > azul, sem virar marrom nem vermelho puro.
    const [r, g, b] = theme.palette.warning.dark.match(/\w\w/g).slice(0, 3).map((h) => parseInt(h, 16))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    expect(r).toBeGreaterThan(150)
  })
})

describe('theme: foco programático do título (MudancaDeRota, Etapa 8)', () => {
  it('remove o contorno só de "h1:focus" (não de todo foco, que continua visível em campos, botões e links)', () => {
    const estilos = theme.components.MuiCssBaseline.styleOverrides
    expect(estilos['h1:focus']).toEqual({ outline: 'none' })
    // controle: a regra não existe para outras marcas de heading nem para foco em geral
    expect(estilos['h2:focus']).toBeUndefined()
    expect(estilos[':focus']).toBeUndefined()
  })
})
