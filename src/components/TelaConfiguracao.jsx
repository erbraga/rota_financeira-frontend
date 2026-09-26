import Alert from '@mui/material/Alert'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

// Mostrada no lugar do app quando a VITE_API_URL falta ou é inválida (em vez de uma tela em branco).
export default function TelaConfiguracao({ erro }) {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Configuração ausente
      </Typography>
      <Alert severity="error" sx={{ mb: 3 }}>
        {erro}
      </Alert>
      <Typography sx={{ mb: 2 }}>
        Crie o arquivo <code>.env</code> a partir do modelo (<code>cp .env.example .env</code>), defina{' '}
        <code>VITE_API_URL</code> com a URL da API (por exemplo <code>http://localhost:5000/api</code>) e reinicie o
        servidor (<code>npm run dev</code>).
      </Typography>
      <Typography color="text.secondary">
        A URL é lida na hora do build: em produção, informe-a ao gerar a versão final (por exemplo, com{' '}
        <code>--build-arg VITE_API_URL=...</code> no Docker).
      </Typography>
    </Container>
  )
}
