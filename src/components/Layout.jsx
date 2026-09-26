import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Outlet } from 'react-router-dom'
import EstadoApi from './EstadoApi.jsx'

// Estrutura comum das telas: barra superior e área de conteúdo (a rota filha entra no <Outlet />).
export default function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Rota Financeira
          </Typography>
          <EstadoApi />
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  )
}
