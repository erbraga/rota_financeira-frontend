import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useMemo, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { ehErroApi } from '../api/erros.js'
import {
  CAMPOS_DA_API,
  criarEsquemaFinanciamento,
  deFinanciamentoParaForm,
  ORDEM_DOS_CAMPOS,
  paraCorpoDaApi,
  ROTULO_DO_SISTEMA,
  SISTEMAS,
  valoresIniciaisFinanciamento,
} from '../schemas/financiamento.js'
import { aplicarErrosDoServidor } from '../utils/errosDeFormulario.js'
import { dinheiroParaCampo } from '../utils/formatar.js'
import CampoNumerico from './CampoNumerico.jsx'

// Grupo de botões de escolha do sistema (Price ou SAC), sem nada marcado até a pessoa escolher. O `ref` do React Hook Form
// vai para o primeiro botão, para o foco (validação e erro do servidor) ter onde pousar.
function CampoSistema({ control }) {
  const { field, fieldState } = useController({ control, name: 'sistemaAmortizacao' })
  return (
    <FormControl component="fieldset" error={Boolean(fieldState.error)}>
      <FormLabel component="legend" id="rotulo-sistema">
        Sistema de amortização
      </FormLabel>
      <RadioGroup row name={field.name} value={field.value} onChange={field.onChange} aria-labelledby="rotulo-sistema">
        {SISTEMAS.map((sistema, indice) => (
          <FormControlLabel
            key={sistema}
            value={sistema}
            label={ROTULO_DO_SISTEMA[sistema]}
            control={<Radio slotProps={{ input: { ref: indice === 0 ? field.ref : undefined } }} />}
          />
        ))}
      </RadioGroup>
      {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
    </FormControl>
  )
}

// O diálogo em si. Quem chama remonta este componente a cada abertura (chave em FormularioFinanciamento), então os
// valores iniciais só são lidos aqui, na montagem.
function DialogoFinanciamento({ aberto, financiamento, valorVeiculo, aoEnviar, aoCancelar }) {
  const [erroGeral, setErroGeral] = useState(null)
  const telaCheia = useMediaQuery(useTheme().breakpoints.down('sm'))
  const esquema = useMemo(() => criarEsquemaFinanciamento(valorVeiculo), [valorVeiculo])

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: financiamento ? deFinanciamentoParaForm(financiamento) : valoresIniciaisFinanciamento(),
    // O erro de um campo aparece ao sair dele ou ao enviar (e depois de enviar, revalida a cada mudança).
    mode: 'onBlur',
  })

  async function aoSubmeter(valores) {
    setErroGeral(null)
    try {
      await aoEnviar(paraCorpoDaApi(valores))
    } catch (erro) {
      // 409 = a simulação já tem 3 opções (não é erro de campo): explica o que fazer.
      if (ehErroApi(erro) && erro.status === 409) {
        setErroGeral(`${erro.erro.replace(/\.$/, '')}. Exclua uma opção antes de adicionar outra.`)
        return
      }
      setErroGeral(aplicarErrosDoServidor(erro, setError, CAMPOS_DA_API))
      const camposComErro = new Set(
        Object.keys(erro?.detalhes ?? {})
          .filter((chave) => Object.hasOwn(CAMPOS_DA_API, chave))
          .map((chave) => CAMPOS_DA_API[chave]),
      )
      const primeiro = ORDEM_DOS_CAMPOS.find((campo) => camposComErro.has(campo))
      if (primeiro) setFocus(primeiro)
    }
  }

  // Durante a requisição não fecha (não dá para cancelar o que já foi).
  function aoFechar() {
    if (!isSubmitting) aoCancelar()
  }

  const titulo = financiamento ? 'Editar opção de financiamento' : 'Adicionar opção de financiamento'
  const ajudaDaEntrada =
    valorVeiculo === null
      ? 'De 0,00 a 9.999.999,00. Vazio vale 0'
      : `Menor que o valor do veículo (R$ ${dinheiroParaCampo(valorVeiculo)}). Vazio vale 0`

  return (
    <Dialog open={aberto} onClose={aoFechar} fullScreen={telaCheia} fullWidth maxWidth="sm" aria-labelledby="titulo-financiamento">
      <Box component="form" noValidate onSubmit={handleSubmit(aoSubmeter)} sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        <DialogTitle id="titulo-financiamento">{titulo}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {erroGeral && <Alert severity="error">{erroGeral}</Alert>}
            <TextField
              label="Nome da opção"
              autoComplete="off"
              autoFocus
              error={Boolean(errors.nome)}
              helperText={errors.nome?.message ?? 'Um nome para você reconhecê-la, ex.: Banco X, 48 meses'}
              {...register('nome')}
            />
            <CampoNumerico
              control={control}
              name="taxaJurosMensal"
              formato="taxa"
              label="Taxa de juros (% a.m.)"
              helperText="De 0 a 20, ao mês"
            />
            <CampoNumerico
              control={control}
              name="prazoMeses"
              formato="inteiro"
              label="Prazo (meses)"
              helperText="Número inteiro, de 1 a 72"
            />
            <CampoSistema control={control} />
            <CampoNumerico
              control={control}
              name="valorEntrada"
              formato="dinheiro"
              label="Valor da entrada (R$)"
              helperText={ajudaDaEntrada}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={aoCancelar} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

// Adicionar ou editar uma opção de financiamento, em diálogo. Não conhece a API nem o roteador:
//  - aberto: se o diálogo está visível; financiamento: a opção a editar (a da API) ou null/undefined para adicionar;
//  - valorVeiculo: o valor do veículo SALVO da simulação (número), para a regra "entrada < veículo"; null deixa a regra
//    a cargo do servidor;
//  - aoEnviar(corpo): envia (corpo já em snake_case, com números) e, se der certo, quem chama fecha o diálogo; lança o
//    ErroApi/ErroRede, que o formulário mostra (422 nos campos, 409 e rede como aviso), mantendo o que foi digitado;
//  - aoCancelar: Cancelar, Esc e clique fora (não fecham durante o envio).
export default function FormularioFinanciamento({ aberto, financiamento, ...resto }) {
  // Cada abertura remonta o diálogo (chave nova), para não trazer valores da abertura anterior.
  const [anterior, setAnterior] = useState(aberto)
  const [abertura, setAbertura] = useState(0)
  if (aberto !== anterior) {
    setAnterior(aberto)
    if (aberto) setAbertura((n) => n + 1)
  }
  return (
    <DialogoFinanciamento
      key={`${abertura}-${financiamento?.id ?? 'nova'}`}
      aberto={aberto}
      financiamento={financiamento}
      {...resto}
    />
  )
}
