import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Mostrada pelo <Suspense> enquanto o PACOTE de uma rota sob demanda (React.lazy) ainda está chegando: é rápido
// (o navegador já tem o resto do app em cache) e a própria tela, uma vez carregada, mostra o seu esqueleto de
// dados de sempre — este é só o intervalo antes disso. Sem título próprio: o da tela anterior continua na aba
// até a rota nova assumir.
export default function CarregandoTela() {
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label="Carregando a tela"
      sx={{ py: 8, display: 'flex', justifyContent: 'center' }}
    >
      <CircularProgress />
    </Box>
  )
}
