import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { Outlet } from 'react-router-dom'

// Layout das telas sem sessão (login, registro e a 404): o nome do app e um cartão centralizado com a tela.
// Não mostra usuário nem Sair, que só fazem sentido para quem já entrou.
export default function LayoutPublico() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
        px: 2,
        py: 4,
      }}
    >
      <Typography variant="h4" component="p" color="primary" sx={{ mb: 3, fontWeight: 600 }}>
        Rota Financeira
      </Typography>
      <Paper component="main" elevation={2} sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 } }}>
        <Outlet />
      </Paper>
    </Box>
  )
}
