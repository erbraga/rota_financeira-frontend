import Add from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { ehErroApi } from '../api/erros.js'
import { useAviso } from '../avisos/useAviso.js'
import { useAtualizarFinanciamento } from '../hooks/useAtualizarFinanciamento.js'
import { useCriarFinanciamento } from '../hooks/useCriarFinanciamento.js'
import { useExcluirFinanciamento } from '../hooks/useExcluirFinanciamento.js'
import { useFinanciamentos } from '../hooks/useFinanciamentos.js'
import { mensagemDeErro } from '../utils/mensagemDeErro.js'
import CartaoFinanciamento from './CartaoFinanciamento.jsx'
import ConfirmarExclusao from './ConfirmarExclusao.jsx'
import EsqueletoLista from './EsqueletoLista.jsx'
import EstadoErro from './EstadoErro.jsx'
import FormularioFinanciamento from './FormularioFinanciamento.jsx'

const MAXIMO_DE_OPCOES = 3
const MINIMO_RECOMENDADO = 2

// A seção "Opções de financiamento" da tela de edição da simulação: lista, adicionar, editar e excluir (até 3 opções).
// Cada opção é salva na hora (não depende do "Salvar alterações" da simulação) e a lista é independente do formulário
// da simulação: se uma falhar, a outra continua funcionando.
//  - simulacaoId: a simulação dona das opções;
//  - valorVeiculo: o valor do veículo SALVO (número), para a regra "entrada < veículo" do formulário.
// Só mostra o que a API devolve: parcela, valor financiado e totais vêm do /resultado (Etapa 6), o frontend não calcula.
export default function SecaoFinanciamentos({ simulacaoId, valorVeiculo }) {
  const consulta = useFinanciamentos(simulacaoId)
  const criar = useCriarFinanciamento(simulacaoId)
  const atualizar = useAtualizarFinanciamento(simulacaoId)
  const excluir = useExcluirFinanciamento(simulacaoId)
  const { mostrarAviso } = useAviso()

  // Diálogo de cadastro/edição: `financiamento` é a opção em edição (null = adicionar). Fica guardado ao fechar, para o
  // título e os campos não esvaziarem durante a animação de saída.
  const [formulario, setFormulario] = useState({ aberto: false, financiamento: null })
  // "alvo" é a opção da confirmação de exclusão (também guardada ao fechar, pelo mesmo motivo).
  const [alvo, setAlvo] = useState(null)
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false)
  const [erroDaExclusao, setErroDaExclusao] = useState(null)

  const abrirFormulario = (financiamento = null) => setFormulario({ aberto: true, financiamento })
  const fecharFormulario = () => setFormulario((atual) => ({ ...atual, aberto: false }))

  async function enviar(corpo) {
    const editando = formulario.financiamento
    try {
      if (editando) {
        await atualizar.mutateAsync({ id: editando.id, corpo })
        mostrarAviso('Opção salva.')
      } else {
        await criar.mutateAsync(corpo)
        mostrarAviso('Opção adicionada.')
      }
      fecharFormulario()
    } catch (erro) {
      if (ehErroApi(erro) && erro.status === 409) {
        // O limite de 3 foi atingido em outro lugar: a lista da tela está velha. O formulário explica e a lista se atualiza.
        consulta.refetch()
      } else if (editando && ehErroApi(erro) && erro.status === 404) {
        // A opção foi excluída em outra aba: sai do formulário e mostra a lista de verdade.
        fecharFormulario()
        consulta.refetch()
        mostrarAviso('Esta opção não existe mais.', { severidade: 'warning' })
        return
      }
      throw erro
    }
  }

  function pedirExclusao(financiamento) {
    setAlvo(financiamento)
    setErroDaExclusao(null)
    setConfirmacaoAberta(true)
  }

  function cancelarExclusao() {
    setConfirmacaoAberta(false)
    setErroDaExclusao(null)
  }

  async function confirmarExclusao() {
    setErroDaExclusao(null)
    try {
      const { jaExcluida } = await excluir.mutateAsync(alvo.id)
      setConfirmacaoAberta(false)
      mostrarAviso(jaExcluida ? 'Essa opção já tinha sido excluída.' : 'Opção excluída.')
    } catch (erro) {
      // Rede ou 5xx: a confirmação continua aberta, com o erro, para tentar de novo.
      setErroDaExclusao(mensagemDeErro(erro))
    }
  }

  const itens = consulta.data?.itens ?? []
  const noLimite = itens.length >= MAXIMO_DE_OPCOES

  let conteudo
  if (consulta.isPending) {
    conteudo = <EsqueletoLista quantidade={2} />
  } else if (consulta.isError) {
    conteudo = (
      <EstadoErro
        titulo="Não foi possível carregar as opções de financiamento"
        mensagem={mensagemDeErro(consulta.error)}
        aoTentarNovamente={() => consulta.refetch()}
      />
    )
  } else {
    conteudo = (
      <>
        {itens.length < MINIMO_RECOMENDADO && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {itens.length === 0
              ? 'Nenhuma opção ainda. Adicione ao menos 2 opções para comparar financiamentos.'
              : 'Adicione ao menos 2 opções para comparar financiamentos.'}
          </Alert>
        )}
        <Grid container spacing={2}>
          {itens.map((financiamento) => (
            <Grid key={financiamento.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CartaoFinanciamento financiamento={financiamento} aoEditar={abrirFormulario} aoExcluir={pedirExclusao} />
            </Grid>
          ))}
        </Grid>
      </>
    )
  }

  return (
    <Box component="section" aria-labelledby="titulo-financiamentos" sx={{ mt: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h5" component="h2" id="titulo-financiamentos">
          Opções de financiamento
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => abrirFormulario()}
          disabled={consulta.isPending || consulta.isError || noLimite}
          aria-describedby={noLimite ? 'aviso-limite-financiamentos' : undefined}
        >
          Adicionar opção
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: noLimite ? 1 : 2 }}>
        Compare a compra à vista, o financiamento e o fundo. Cada opção é salva na hora, sem precisar de “Salvar alterações”.
      </Typography>
      {noLimite && (
        <Typography id="aviso-limite-financiamentos" variant="body2" sx={{ mb: 2 }}>
          Limite de {MAXIMO_DE_OPCOES} opções: exclua uma para adicionar outra.
        </Typography>
      )}

      {conteudo}

      <FormularioFinanciamento
        aberto={formulario.aberto}
        financiamento={formulario.financiamento}
        valorVeiculo={valorVeiculo}
        aoEnviar={enviar}
        aoCancelar={fecharFormulario}
      />
      <ConfirmarExclusao
        aberto={confirmacaoAberta}
        titulo={`Excluir a opção "${alvo?.nome ?? ''}"?`}
        carregando={excluir.isPending}
        erro={erroDaExclusao}
        aoCancelar={cancelarExclusao}
        aoConfirmar={confirmarExclusao}
      />
    </Box>
  )
}
