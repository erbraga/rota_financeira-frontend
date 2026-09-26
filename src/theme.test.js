import { createTheme } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { FONTE_SISTEMA, theme } from './theme.js'

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
