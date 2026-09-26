import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

// Corpo das telas provisórias da Etapa 1. Cada tela é substituída pela real nas etapas seguintes.
export default function EmConstrucao({ titulo, detalhe }) {
  return (
    <Box component="section" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {titulo}
      </Typography>
      {detalhe && <Typography color="text.secondary">{detalhe}</Typography>}
      <Typography color="text.secondary">Tela em construção.</Typography>
    </Box>
  )
}
