import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { ROTULO_DO_SISTEMA } from '../schemas/financiamento.js'
import { formatarMoeda, formatarPercentual, formatarPrazo } from '../utils/formatar.js'

// Os ícones são importados por caminho (@mui/icons-material/EditOutlined), nunca pelo pacote raiz.

function Linha({ rotulo, valor }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography variant="body2">{valor}</Typography>
    </Box>
  )
}

// Cartão de uma opção de financiamento: só o que a API devolve (nome, sistema, taxa, prazo e entrada). Parcela, valor
// financiado e totais NÃO aparecem aqui: o frontend não calcula, e a API só os entrega no resultado (Etapa 6).
// Editar e Excluir só avisam quem usa (aoEditar, aoExcluir): o diálogo e a chamada à API são da seção.
export default function CartaoFinanciamento({ financiamento, aoEditar, aoExcluir }) {
  const {
    nome,
    sistema_amortizacao: sistema,
    taxa_juros_mensal: taxa,
    prazo_meses: prazo,
    valor_entrada: entrada,
  } = financiamento

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="h3" gutterBottom sx={{ overflowWrap: 'anywhere' }}>
          {nome}
        </Typography>
        <Chip label={ROTULO_DO_SISTEMA[sistema] ?? sistema} size="small" variant="outlined" sx={{ mb: 1.5 }} />
        <Linha rotulo="Taxa de juros" valor={`${formatarPercentual(taxa)} a.m.`} />
        <Linha rotulo="Prazo" valor={formatarPrazo(prazo)} />
        <Linha rotulo="Entrada" valor={formatarMoeda(entrada)} />
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        <Tooltip title="Editar">
          <IconButton aria-label={`Editar opção ${nome}`} onClick={() => aoEditar(financiamento)}>
            <EditOutlined />
          </IconButton>
        </Tooltip>
        <Tooltip title="Excluir">
          <IconButton aria-label={`Excluir opção ${nome}`} onClick={() => aoExcluir(financiamento)}>
            <DeleteOutlined />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  )
}
