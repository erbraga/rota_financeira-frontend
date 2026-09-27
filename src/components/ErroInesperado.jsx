import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTituloDaPagina } from '../hooks/useTituloDaPagina.js'

// As duas telas de "algo deu errado", mostradas pela ErrorBoundary (nunca chamadas diretamente):
//  - "tela": dentro do Layout privado (a barra e o Sair continuam por fora), sem <main> próprio (o Layout já
//    tem um em volta do <Outlet />); Tentar de novo e um link para o histórico.
//  - "global": tela cheia, para um erro fora do roteador (providers, layout público, login); só Recarregar a
//    página (sem Link do react-router: o BrowserRouter fica DENTRO da fronteira global, então some junto com o
//    resto da árvore quando o erro é capturado).
// O botão principal recebe o foco ao aparecer (a tela pode surgir a qualquer momento, não só numa troca de rota
// que o MudancaDeRota trataria) e o título vem do useTituloDaPagina, como as demais telas.
export default function ErroInesperado({ variante = 'tela', aoTentarNovo }) {
  const global = variante === 'global'
  const titulo = global ? 'Algo deu errado' : 'Algo deu errado nesta tela'
  useTituloDaPagina(titulo)

  const botaoRef = useRef(null)
  useEffect(() => {
    botaoRef.current?.focus()
  }, [])

  const conteudo = (
    <Stack spacing={2} sx={{ textAlign: 'center', alignItems: 'center' }}>
      <Typography component="h1" variant="h5">
        {titulo}
      </Typography>
      <Typography color="text.secondary">
        {global
          ? 'Um erro inesperado interrompeu o app. Recarregar a página costuma resolver.'
          : 'Um erro inesperado interrompeu esta tela. Você pode tentar de novo ou voltar às suas simulações.'}
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button ref={botaoRef} variant="contained" onClick={aoTentarNovo}>
          {global ? 'Recarregar a página' : 'Tentar de novo'}
        </Button>
        {!global && (
          <Button component={Link} to="/simulacoes" variant="outlined">
            Voltar ao histórico
          </Button>
        )}
      </Stack>
    </Stack>
  )

  if (!global) return conteudo

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
        px: 2,
      }}
    >
      <Container component="main" maxWidth="sm">
        {conteudo}
      </Container>
    </Box>
  )
}
