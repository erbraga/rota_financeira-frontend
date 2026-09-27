import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
import { formatarData, formatarMoeda } from '../utils/formatar.js'

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

// Cartão do histórico: os dados da simulação e as ações. Ver resultado e Editar são links; Excluir só avisa quem
// usa (aoExcluir): a confirmação e a chamada à API são da tela.
export default function CartaoSimulacao({ simulacao, aoExcluir }) {
  const { id, nome, valor_veiculo: valorVeiculo, valor_entrada: valorEntrada, criado_em: criadoEm } = simulacao

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="h2" gutterBottom sx={{ overflowWrap: 'anywhere' }}>
          {nome}
        </Typography>
        <Linha rotulo="Valor do veículo" valor={formatarMoeda(valorVeiculo)} />
        <Linha rotulo="Entrada" valor={formatarMoeda(valorEntrada)} />
        <Linha rotulo="Criada em" valor={formatarData(criadoEm)} />
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Button component={RouterLink} to={`/simulacoes/${id}/resultado`} variant="contained" size="small">
          Ver resultado
        </Button>
        <Box>
          <Tooltip title="Editar">
            <IconButton
              component={RouterLink}
              to={`/simulacoes/${id}/editar`}
              aria-label={`Editar simulação ${nome}`}
            >
              <EditOutlined />
            </IconButton>
          </Tooltip>
          <Tooltip title="Excluir">
            <IconButton aria-label={`Excluir simulação ${nome}`} onClick={() => aoExcluir(simulacao)}>
              <DeleteOutlined />
            </IconButton>
          </Tooltip>
        </Box>
      </CardActions>
    </Card>
  )
}
