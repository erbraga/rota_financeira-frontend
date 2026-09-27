import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import CartaoCenario from './CartaoCenario.jsx'

// O que "custo total" quer dizer: contraintuitivo (no fundo não é o dinheiro que sai do bolso), então a frase fica sempre à vista.
export const TEXTO_DO_CUSTO_TOTAL =
  'O custo total é o que se paga pelo carro, em valores nominais (sem valor presente): à vista, o preço; no financiamento, a entrada mais as parcelas; no fundo, o preço do carro corrigido pelo IPCA quando você compra, e não o dinheiro que sai do bolso.'

// A linha de cartões do resultado: à vista, cada financiamento (ordem de criação) e o fundo. O cartão de menor custo é o que
// o BACKEND indicou em `menor_custo` (`cenario` e, para financiamento, o `id`): nada é comparado nem calculado aqui.
//  - resultado: o corpo do /resultado; simulacaoId: dono dos financiamentos (link "Ver parcelas" e "Adicionar opções");
//  - controleAporte: o campo do "e se eu guardar X por mês?", que fica dentro do cartão do fundo.
export default function CartoesResumo({ resultado, simulacaoId, controleAporte }) {
  const { cenarios, menor_custo: menorCusto } = resultado
  const semOpcoes = cenarios.financiamentos.length === 0

  return (
    <Box component="section" aria-labelledby="titulo-cenarios">
      <Typography variant="h5" component="h2" id="titulo-cenarios" gutterBottom>
        Custo de cada cenário
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {TEXTO_DO_CUSTO_TOTAL}
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <CartaoCenario tipo="a_vista" cenario={cenarios.a_vista} destacado={menorCusto.cenario === 'a_vista'} />
        </Grid>
        {cenarios.financiamentos.map((financiamento) => (
          <Grid key={financiamento.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <CartaoCenario
              tipo="financiamento"
              cenario={financiamento}
              simulacaoId={simulacaoId}
              destacado={menorCusto.cenario === 'financiamento' && menorCusto.id === financiamento.id}
            />
          </Grid>
        ))}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <CartaoCenario tipo="fundo" cenario={cenarios.fundo} destacado={menorCusto.cenario === 'fundo'}>
            {controleAporte}
          </CartaoCenario>
        </Grid>
      </Grid>

      {semOpcoes && (
        <Alert
          severity="info"
          sx={{ mt: 2 }}
          action={
            <Button component={RouterLink} to={`/simulacoes/${simulacaoId}/editar`} color="inherit" size="small">
              Adicionar opções
            </Button>
          }
        >
          <AlertTitle>Nenhum financiamento para comparar</AlertTitle>
          Adicione opções de financiamento para compará-las com a compra à vista e com o fundo.
        </Alert>
      )}
    </Box>
  )
}
