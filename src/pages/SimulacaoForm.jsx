import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { ehErroApi } from '../api/erros.js'
import { useAviso } from '../avisos/useAviso.js'
import EstadoErro from '../components/EstadoErro.jsx'
import FormularioSimulacao from '../components/FormularioSimulacao.jsx'
import SecaoFinanciamentos from '../components/SecaoFinanciamentos.jsx'
import SimulacaoNaoEncontrada, { TITULO_SIMULACAO_NAO_ENCONTRADA } from '../components/SimulacaoNaoEncontrada.jsx'
import { useAtualizarSimulacao } from '../hooks/useAtualizarSimulacao.js'
import { useCriarSimulacao } from '../hooks/useCriarSimulacao.js'
import { useIndice } from '../hooks/useIndice.js'
import { useSimulacao } from '../hooks/useSimulacao.js'
import { useTituloDaPagina } from '../hooks/useTituloDaPagina.js'
import { deSimulacaoParaForm, valoresIniciais } from '../schemas/simulacao.js'
import { mensagemDeErro } from '../utils/mensagemDeErro.js'

// CDI e IPCA em paralelo, sem bloquear a tela: o formulário abre e é digitável desde o primeiro instante, e a criação
// nunca depende do Banco Central. Devolve o formato que o FormularioSimulacao espera.
function useSugestoes() {
  const cdi = useIndice('cdi')
  const ipca = useIndice('ipca')
  return { taxaFundoRendimento: cdi, taxaIpcaProjetada: ipca }
}

function Cabecalho({ titulo }) {
  return (
    <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
      {titulo}
    </Typography>
  )
}

// /simulacoes/nova: cria (POST) e vai para a EDIÇÃO da nova simulação (é onde as opções de financiamento entram na
// Etapa 5). A navegação é "replace": o Voltar do navegador não volta ao formulário de criação (e não reenvia).
function NovaSimulacao() {
  useTituloDaPagina('Nova simulação')
  const criar = useCriarSimulacao()
  const navigate = useNavigate()
  const { mostrarAviso } = useAviso()
  // Valores iniciais fixos durante a vida da tela (o React Hook Form só os lê na montagem).
  const [iniciais] = useState(valoresIniciais)
  const sugestoes = useSugestoes()

  async function enviar(corpo) {
    const nova = await criar.mutateAsync(corpo)
    mostrarAviso('Simulação criada.')
    navigate(`/simulacoes/${nova.id}/editar`, { replace: true })
  }

  return (
    <Box component="section">
      <Cabecalho titulo="Nova simulação" />
      <FormularioSimulacao
        valoresIniciais={iniciais}
        aoEnviar={enviar}
        rotuloEnviar="Criar simulação"
        sugestoes={sugestoes}
        preencherSugestoes
        acoes={
          <Button component={RouterLink} to="/simulacoes" size="large">
            Cancelar
          </Button>
        }
      />
    </Box>
  )
}

function EsqueletoFormulario() {
  return (
    <Box aria-busy="true" role="status" aria-label="Carregando" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Skeleton variant="text" width={220} height={44} />
      {Array.from({ length: 6 }, (_, indice) => (
        <Skeleton key={indice} variant="rounded" height={56} />
      ))}
      <Skeleton variant="rounded" width={160} height={44} />
    </Box>
  )
}

// /simulacoes/:id/editar: carrega por GET (que NÃO traz as opções), mostra o formulário preenchido e salva com um
// PUT de corpo completo. Depois de salvar CONTINUA na tela (com o aviso), com Ver resultado e Voltar ao histórico
// sempre visíveis. Abaixo do formulário fica a seção das opções de financiamento (lista e formulário independentes).
function EditarSimulacao({ id }) {
  const consulta = useSimulacao(id)
  const atualizar = useAtualizarSimulacao(id)
  // Na edição a sugestão é só informação (e o botão "Usar"): os valores gravados nunca mudam sozinhos.
  const sugestoes = useSugestoes()
  const { mostrarAviso } = useAviso()
  // Um 404 no PUT (excluída em outro lugar) mostra o mesmo estado de "não encontrada".
  const [sumiu, setSumiu] = useState(false)
  const naoEncontrada = sumiu || (consulta.isError && ehErroApi(consulta.error) && consulta.error.status === 404)
  useTituloDaPagina(naoEncontrada ? TITULO_SIMULACAO_NAO_ENCONTRADA : 'Editar simulação')

  if (consulta.isPending) return <EsqueletoFormulario />
  if (naoEncontrada) return <SimulacaoNaoEncontrada />
  if (consulta.isError) {
    return (
      <EstadoErro
        titulo="Não foi possível carregar a simulação"
        mensagem={mensagemDeErro(consulta.error)}
        aoTentarNovamente={() => consulta.refetch()}
      />
    )
  }

  async function enviar(corpo) {
    try {
      const salva = await atualizar.mutateAsync(corpo)
      mostrarAviso('Alterações salvas.')
      return salva
    } catch (erro) {
      if (ehErroApi(erro) && erro.status === 404) {
        setSumiu(true)
        return undefined
      }
      throw erro
    }
  }

  return (
    <Box component="section">
      <Cabecalho titulo="Editar simulação" />
      <FormularioSimulacao
        key={id}
        valoresIniciais={deSimulacaoParaForm(consulta.data)}
        aoEnviar={enviar}
        rotuloEnviar="Salvar alterações"
        sugestoes={sugestoes}
        acoes={
          <>
            <Button component={RouterLink} to={`/simulacoes/${id}/resultado`} variant="outlined" size="large">
              Ver resultado
            </Button>
            <Button component={RouterLink} to="/simulacoes" size="large">
              Voltar ao histórico
            </Button>
          </>
        }
      />
      {/* As opções de financiamento só existem na edição (precisam do id) e são salvas na hora, à parte do formulário. */}
      <SecaoFinanciamentos key={`financiamentos-${id}`} simulacaoId={id} valorVeiculo={consulta.data.valor_veiculo} />
    </Box>
  )
}

// Serve às rotas /simulacoes/nova e /simulacoes/:id/editar.
export default function SimulacaoForm() {
  const { id } = useParams()
  return id ? <EditarSimulacao id={id} /> : <NovaSimulacao />
}
