import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'
import Grid from '@mui/material/Grid'

// Cartões "fantasma" enquanto a lista carrega, no mesmo formato e na mesma grade dos cartões reais.
export default function EsqueletoLista({ quantidade = 3 }) {
  return (
    <Box aria-busy="true" role="status" aria-label="Carregando">
      <Grid container spacing={2}>
        {Array.from({ length: quantidade }, (_, indice) => (
          <Grid key={indice} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardContent>
                <Skeleton variant="text" width="70%" height={32} />
                <Skeleton variant="text" width="50%" />
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rounded" height={36} sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
