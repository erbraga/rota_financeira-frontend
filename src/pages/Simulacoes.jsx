import Add from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAviso } from '../avisos/useAviso.js'
import CartaoSimulacao from '../components/CartaoSimulacao.jsx'
import ConfirmarExclusao from '../components/ConfirmarExclusao.jsx'
import EsqueletoLista from '../components/EsqueletoLista.jsx'
import EstadoErro from '../components/EstadoErro.jsx'
import EstadoVazio from '../components/EstadoVazio.jsx'
import { useExcluirSimulacao } from '../hooks/useExcluirSimulacao.js'
import { useSimulacoes } from '../hooks/useSimulacoes.js'
import { mensagemDeErro } from '../utils/mensagemDeErro.js'

// Histórico: as simulações da pessoa, da mais recente à mais antiga (a ordem vem do backend; sem paginação,
// ordenação nem filtros), com carregando, erro, vazio e a exclusão com confirmação.
export default function Simulacoes() {
  const consulta = useSimulacoes()
  const excluir = useExcluirSimulacao()
  const { mostrarAviso } = useAviso()

  // "alvo" é a simulação da confirmação; fica guardada ao fechar para o título não esvaziar durante a animação de saída.
  const [alvo, setAlvo] = useState(null)
  const [dialogoAberto, setDialogoAberto] = useState(false)
  const [erroDaExclusao, setErroDaExclusao] = useState(null)

  function pedirExclusao(simulacao) {
    setAlvo(simulacao)
    setErroDaExclusao(null)
    setDialogoAberto(true)
  }

  function cancelar() {
    setDialogoAberto(false)
    setErroDaExclusao(null)
  }

  async function confirmarExclusao() {
    setErroDaExclusao(null)
    try {
      const { jaExcluida } = await excluir.mutateAsync(alvo.id)
      setDialogoAberto(false)
      mostrarAviso(jaExcluida ? 'Essa simulação já tinha sido excluída.' : 'Simulação excluída.')
    } catch (erro) {
      // Rede ou 5xx: o diálogo continua aberto, com o erro, para tentar de novo.
      setErroDaExclusao(mensagemDeErro(erro))
    }
  }

  let conteudo
  if (consulta.isPending) {
    conteudo = <EsqueletoLista />
  } else if (consulta.isError) {
    conteudo = (
      <EstadoErro
        titulo="Não foi possível carregar suas simulações"
        mensagem={mensagemDeErro(consulta.error)}
        aoTentarNovamente={() => consulta.refetch()}
      />
    )
  } else if (consulta.data.itens.length === 0) {
    conteudo = (
      <EstadoVazio
        titulo="Nenhuma simulação ainda"
        descricao="Crie a primeira para comparar as formas de comprar o carro."
        acao={{ rotulo: 'Criar a primeira simulação', para: '/simulacoes/nova' }}
      />
    )
  } else {
    conteudo = (
      <Grid container spacing={2}>
        {consulta.data.itens.map((simulacao) => (
          <Grid key={simulacao.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <CartaoSimulacao simulacao={simulacao} aoExcluir={pedirExclusao} />
          </Grid>
        ))}
      </Grid>
    )
  }

  return (
    <Box component="section">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          Minhas simulações
        </Typography>
        <Button component={RouterLink} to="/simulacoes/nova" variant="contained" startIcon={<Add />}>
          Nova simulação
        </Button>
      </Box>

      {conteudo}

      <ConfirmarExclusao
        aberto={dialogoAberto}
        simulacao={alvo}
        carregando={excluir.isPending}
        erro={erroDaExclusao}
        aoCancelar={cancelar}
        aoConfirmar={confirmarExclusao}
      />
    </Box>
  )
}
