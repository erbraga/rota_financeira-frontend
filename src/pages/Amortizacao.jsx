import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { ehErroApi } from '../api/erros.js'
import EsqueletoLista from '../components/EsqueletoLista.jsx'
import EstadoErro from '../components/EstadoErro.jsx'
import GraficoAmortizacao from '../components/GraficoAmortizacao.jsx'
import ResumoFinanciamento from '../components/ResumoFinanciamento.jsx'
import SimulacaoNaoEncontrada from '../components/SimulacaoNaoEncontrada.jsx'
import TabelaAmortizacao from '../components/TabelaAmortizacao.jsx'
import { useParcelas } from '../hooks/useParcelas.js'
import { mensagemDeErro } from '../utils/mensagemDeErro.js'

function EsqueletoAmortizacao() {
  return (
    <Box>
      <Skeleton variant="text" width={360} height={44} />
      <Box sx={{ mt: 2 }}>
        <EsqueletoLista quantidade={3} />
      </Box>
      <Skeleton variant="rounded" height={260} sx={{ mt: 4 }} />
      <Skeleton variant="rounded" height={320} sx={{ mt: 4 }} />
    </Box>
  )
}

// /simulacoes/:id/financiamentos/:fid: a tabela de amortização de UMA opção (Price ou SAC). O frontend NÃO calcula nada:
// busca o /parcelas e exibe o resumo com os totais, o gráfico de cada parcela (juros e amortização) e a tabela mês a mês. O
// título e os dados vêm do próprio `financiamento` da resposta.
export default function Amortizacao() {
  const { id, fid } = useParams()
  const consulta = useParcelas(id, fid)

  if (consulta.isPending) return <EsqueletoAmortizacao />
  // Simulação inexistente ou alheia E opção inexistente ou de outra simulação: o mesmo estado (não vaza existência de nada).
  if (consulta.isError && ehErroApi(consulta.error) && consulta.error.status === 404) return <SimulacaoNaoEncontrada />
  if (consulta.isError) {
    return (
      <EstadoErro
        titulo="Não foi possível carregar a tabela de amortização"
        mensagem={mensagemDeErro(consulta.error)}
        aoTentarNovamente={() => consulta.refetch()}
      />
    )
  }

  const { financiamento, parcelas, totais } = consulta.data

  return (
    <Box component="section">
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          Amortização: {financiamento.nome}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button component={RouterLink} to={`/simulacoes/${id}/resultado`} variant="outlined">
            Voltar ao resultado
          </Button>
          <Button component={RouterLink} to={`/simulacoes/${id}/editar`}>
            Editar simulação
          </Button>
        </Box>
      </Box>

      <ResumoFinanciamento financiamento={financiamento} totais={totais} />

      <Box sx={{ mt: 5 }}>
        <GraficoAmortizacao parcelas={parcelas} />
      </Box>

      <Box sx={{ mt: 5 }}>
        <TabelaAmortizacao parcelas={parcelas} />
      </Box>
    </Box>
  )
}
