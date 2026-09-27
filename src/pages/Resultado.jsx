import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { useMemo } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ehErroApi } from '../api/erros.js'
import CartoesResumo from '../components/CartoesResumo.jsx'
import ControleAporte from '../components/ControleAporte.jsx'
import EsqueletoLista from '../components/EsqueletoLista.jsx'
import EstadoErro from '../components/EstadoErro.jsx'
import GraficoComparativo from '../components/GraficoComparativo.jsx'
import SimulacaoNaoEncontrada from '../components/SimulacaoNaoEncontrada.jsx'
import { useResultado } from '../hooks/useResultado.js'
import { aporteParaUrl, lerAporteDaUrl, PARAMETRO_DO_APORTE } from '../utils/aporteNaUrl.js'
import { formatarMoeda, formatarPercentual, formatarPrazo } from '../utils/formatar.js'
import { mensagemDeErro } from '../utils/mensagemDeErro.js'

// Um dado da simulação no cabeçalho (lista de definição).
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

function EsqueletoResultado() {
  return (
    <Box>
      <Skeleton variant="text" width={320} height={44} />
      <Skeleton variant="text" width="60%" />
      <Box sx={{ mt: 2 }}>
        <EsqueletoLista quantidade={3} />
      </Box>
      <Skeleton variant="rounded" height={320} sx={{ mt: 4 }} />
    </Box>
  )
}

// A mensagem de um 422 do parâmetro aporte_mensal (o cliente valida antes, então só acontece se as regras do backend mudarem).
function mensagemDoAporteRecusado(erro) {
  if (!ehErroApi(erro) || erro.status !== 422) return null
  return erro.detalhes?.[PARAMETRO_DO_APORTE]?.[0] ?? null
}

// /simulacoes/:id/resultado[?aporte_mensal=1500,5]: a comparação dos três cenários. O frontend NÃO calcula nada: busca o
// /resultado e exibe (cartões, menor custo indicado pelo backend e gráfico). O nome e os dados do cabeçalho vêm do eco
// `simulacao` do próprio resultado. O "e se eu guardar X por mês?" mora no ENDEREÇO (recarregar, o Voltar do navegador e o
// link mantêm o cenário); um aporte inválido no endereço vira aviso no campo e o resultado padrão, e NUNCA vai ao servidor.
export default function Resultado() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [parametros] = useSearchParams()
  const lido = useMemo(() => lerAporteDaUrl(parametros), [parametros])
  const aporte = lido.valor // undefined sem aporte ou com um aporte inválido (aí o resultado é o padrão)

  const principal = useResultado(id, { aporteMensal: aporte })
  // Se o servidor recusar o aporte (422), o resultado padrão serve de reserva e a mensagem aparece no campo.
  const recusa = mensagemDoAporteRecusado(principal.error)
  const reserva = useResultado(id, { enabled: recusa !== null })
  const consulta = recusa !== null ? reserva : principal

  // O aporte vai para o endereço como novo item do histórico (o Voltar do navegador o desfaz); a vírgula fica legível.
  function irParaOAporte(valor) {
    const outros = new URLSearchParams(parametros)
    outros.delete(PARAMETRO_DO_APORTE)
    const resto = outros.toString()
    const novo = valor === undefined ? [] : [`${PARAMETRO_DO_APORTE}=${aporteParaUrl(valor)}`]
    const consultaNova = [resto, ...novo].filter(Boolean).join('&')
    navigate({ search: consultaNova ? `?${consultaNova}` : '' })
  }

  const controleAporte = (
    <ControleAporte
      valorAtual={aporte}
      textoInvalido={lido.erro ? lido.texto : undefined}
      erroDoEndereco={lido.erro}
      erroDoServidor={recusa ?? undefined}
      ocupado={principal.isPlaceholderData}
      aoSimular={irParaOAporte}
      aoVoltar={() => irParaOAporte(undefined)}
    />
  )

  if (consulta.isPending) return <EsqueletoResultado />
  // Inexistente, de outra pessoa ou excluída: o mesmo 404, o mesmo estado (não vaza existência).
  if (consulta.isError && ehErroApi(consulta.error) && consulta.error.status === 404) return <SimulacaoNaoEncontrada />
  if (consulta.isError) {
    return (
      <EstadoErro
        titulo="Não foi possível carregar o resultado"
        mensagem={mensagemDeErro(consulta.error)}
        aoTentarNovamente={() => consulta.refetch()}
      />
    )
  }

  const resultado = consulta.data
  const { simulacao } = resultado

  return (
    <Box component="section">
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          Resultado: {simulacao.nome}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button component={RouterLink} to={`/simulacoes/${id}/editar`} variant="outlined">
            Editar simulação
          </Button>
          <Button component={RouterLink} to="/simulacoes">
            Voltar ao histórico
          </Button>
        </Box>
      </Box>

      <Box
        component="dl"
        aria-label="Dados da simulação"
        sx={{ m: 0, mb: 4, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2 }}
      >
        <Dado rotulo="Valor do veículo" valor={formatarMoeda(simulacao.valor_veiculo)} />
        <Dado rotulo="Entrada" valor={formatarMoeda(simulacao.valor_entrada)} />
        <Dado rotulo="Rendimento do fundo" valor={`${formatarPercentual(simulacao.taxa_fundo_rendimento)} a.a.`} />
        <Dado rotulo="IPCA projetado" valor={`${formatarPercentual(simulacao.taxa_ipca_projetada)} a.a.`} />
        <Dado rotulo="Prazo do fundo" valor={formatarPrazo(simulacao.prazo_meses_fundo)} />
      </Box>

      <CartoesResumo resultado={resultado} simulacaoId={id} controleAporte={controleAporte} />

      <Box sx={{ mt: 6 }}>
        <GraficoComparativo series={resultado.series} financiamentos={resultado.cenarios.financiamentos} />
      </Box>
    </Box>
  )
}
