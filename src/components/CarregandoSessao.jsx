import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useTituloDaPagina } from '../hooks/useTituloDaPagina.js'

// Mostrada enquanto o token guardado é validado (GET /auth/perfil): evita piscar a tela de login.
export default function CarregandoSessao() {
  useTituloDaPagina('Verificando sessão')
  return (
    <Box sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress aria-label="Verificando sua sessão" />
      <Typography color="text.secondary">Verificando sua sessão…</Typography>
    </Box>
  )
}
