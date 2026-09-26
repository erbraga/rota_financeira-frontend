// Tema único do Material UI. Só modo claro; textos dos componentes em português (pt-BR).
import { ptBR } from '@mui/material/locale'
import { createTheme } from '@mui/material/styles'

// Fontes do sistema: sem dependência nem requisição externa (a SPA não chama serviços de terceiros).
export const FONTE_SISTEMA = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: '#1565c0' },
      secondary: { main: '#00796b' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: FONTE_SISTEMA,
      button: { textTransform: 'none' },
    },
  },
  ptBR,
)
