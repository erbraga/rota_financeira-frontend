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
      // O `warning.dark` padrão do MUI (#e65100) dá só 3,79:1 de contraste sobre branco (usado como TEXTO no
      // aviso "Dados do cache, podem estar defasados." e como cor de linha/barra nos gráficos); o mínimo AA para
      // texto é 4,5:1. Este valor (mesmo tom, mais escuro) dá 5,5:1; ver theme.test.js. `main` precisa vir junto
      // (o MUI exige a chave `main` para completar o objeto de cor; só `warning.dark` importa aqui).
      warning: { main: '#ed6c02', dark: '#b84100' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: FONTE_SISTEMA,
      button: { textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // O foco PROGRAMÁTICO do título ao trocar de tela (MudancaDeRota, Etapa 8) não mostra contorno: um <h1>
          // nunca é parada de tabulação (não tem `tabindex="0"`), então esta regra só afeta esse foco, nunca um
          // elemento de verdade navegável por teclado.
          'h1:focus': { outline: 'none' },
        },
      },
    },
  },
  ptBR,
)
