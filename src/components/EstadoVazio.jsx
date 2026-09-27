import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'

// Quando não há nada para mostrar ainda. acao: { rotulo, para } (link do roteador) ou { rotulo, aoClicar } (botão).
export default function EstadoVazio({ titulo, descricao, acao }) {
  const propsDoBotao = acao?.para ? { component: RouterLink, to: acao.para } : { onClick: acao?.aoClicar }

  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {titulo}
      </Typography>
      {descricao && (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {descricao}
        </Typography>
      )}
      {acao && (
        <Button variant="contained" {...propsDoBotao}>
          {acao.rotulo}
        </Button>
      )}
    </Box>
  )
}
