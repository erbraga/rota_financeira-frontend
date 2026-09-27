import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import { ROTULO_DO_SISTEMA } from '../schemas/financiamento.js'
import { formatarMoeda, formatarPercentual, formatarPrazo } from '../utils/formatar.js'
import { TEXTO_DO_CUSTO_TOTAL } from './CartoesResumo.jsx'

// Um dado da opção (lista de definição: leitor de tela lê o rótulo com o valor).
function Dado({ rotulo, valor }) {
  return (
    <Box>
      <Typography component="dt" variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography component="dd" variant="body1" sx={{ m: 0 }}>
        {valor}
      </Typography>
    </Box>
  )
}

// Um total (grande): o valor exatamente como a API o devolve.
function Total({ rotulo, valor }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography component="dt" variant="caption" color="text.secondary">
          {rotulo}
        </Typography>
        <Typography component="dd" variant="h5" sx={{ m: 0, fontWeight: 600 }}>
          {valor}
        </Typography>
      </CardContent>
    </Card>
  )
}

// O resumo de uma opção acima da tabela de amortização: os dados da opção (`financiamento`) e os três totais (`totais`), todos
// LIDOS da resposta do /parcelas (nenhuma soma no cliente; são os mesmos totais do /resultado). A frase explica o custo total.
export default function ResumoFinanciamento({ financiamento, totais }) {
  const idDoTitulo = useId()
  return (
    <Box component="section" aria-labelledby={idDoTitulo}>
      <Typography variant="h5" component="h2" id={idDoTitulo} gutterBottom>
        Resumo do financiamento
      </Typography>

      <Box
        component="dl"
        aria-label="Dados da opção"
        sx={{ m: 0, mb: 3, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2 }}
      >
        <Dado rotulo="Sistema" valor={ROTULO_DO_SISTEMA[financiamento.sistema_amortizacao] ?? financiamento.sistema_amortizacao} />
        <Dado rotulo="Taxa de juros" valor={`${formatarPercentual(financiamento.taxa_juros_mensal)} a.m.`} />
        <Dado rotulo="Prazo" valor={formatarPrazo(financiamento.prazo_meses)} />
        <Dado rotulo="Valor financiado" valor={formatarMoeda(financiamento.valor_financiado)} />
        <Dado rotulo="Entrada" valor={formatarMoeda(financiamento.valor_entrada)} />
      </Box>

      <Box
        component="dl"
        aria-label="Totais"
        sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}
      >
        <Total rotulo="Total pago" valor={formatarMoeda(totais.total_pago)} />
        <Total rotulo="Total de juros" valor={formatarMoeda(totais.total_juros)} />
        <Total rotulo="Custo total" valor={formatarMoeda(totais.custo_total)} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {TEXTO_DO_CUSTO_TOTAL}
      </Typography>
    </Box>
  )
}
