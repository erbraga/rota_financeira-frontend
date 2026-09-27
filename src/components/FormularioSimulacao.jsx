import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CAMPOS_DA_API, deSimulacaoParaForm, esquemaSimulacao, paraCorpoDaApi } from '../schemas/simulacao.js'
import { aplicarErrosDoServidor } from '../utils/errosDeFormulario.js'
import CampoNumerico from './CampoNumerico.jsx'

// Ordem visual dos campos: o foco vai para o primeiro campo com erro vindo do servidor.
const ORDEM_DOS_CAMPOS = ['nome', 'valorVeiculo', 'valorEntrada', 'taxaFundoRendimento', 'prazoMesesFundo', 'taxaIpcaProjetada']

function Secao({ titulo, children }) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography component="legend" variant="h6" sx={{ mb: 1 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

// Formulário de criar e de editar uma simulação (mesmos campos e regras). Não conhece a API nem o roteador:
//  - valoresIniciais: valores do formulário (texto), de valoresIniciais() ou deSimulacaoParaForm();
//  - aoEnviar(corpo): envia (corpo já em snake_case, com números) e pode devolver a simulação salva, cujos valores
//    passam a ser mostrados reformatados; lança o ErroApi/ErroRede para o formulário mostrar;
//  - rotuloEnviar: texto do botão; acoes: botões extras ao lado do de enviar.
export default function FormularioSimulacao({ valoresIniciais, aoEnviar, rotuloEnviar = 'Salvar', acoes }) {
  const [erroGeral, setErroGeral] = useState(null)

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(esquemaSimulacao),
    defaultValues: valoresIniciais,
    // O erro de um campo aparece ao sair dele ou ao enviar (e depois de enviar, revalida a cada mudança).
    mode: 'onBlur',
  })

  async function aoSubmeter(valores) {
    setErroGeral(null)
    try {
      const salva = await aoEnviar(paraCorpoDaApi(valores))
      // Mostra o que o servidor guardou, no formato dos campos (ex.: "95000,5" -> "95.000,50").
      if (salva) reset(deSimulacaoParaForm(salva))
    } catch (erro) {
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

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(aoSubmeter)} sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {erroGeral && <Alert severity="error">{erroGeral}</Alert>}

      <Secao titulo="Veículo">
        <TextField
          label="Nome da simulação"
          autoComplete="off"
          autoFocus
          error={Boolean(errors.nome)}
          helperText={errors.nome?.message ?? 'Um nome para você reconhecê-la, ex.: Onix 2026'}
          {...register('nome')}
        />
        <CampoNumerico
          control={control}
          name="valorVeiculo"
          formato="dinheiro"
          label="Valor do veículo (R$)"
          helperText="De 0,01 a 9.999.999,00"
          depende={['valorEntrada']}
        />
        <CampoNumerico
          control={control}
          name="valorEntrada"
          formato="dinheiro"
          label="Valor da entrada (R$)"
          helperText="O que você já tem e que rende no fundo. De 0,00 até o valor do veículo (igual vale)"
        />
      </Secao>

      <Secao titulo="Fundo de acumulação">
        <CampoNumerico
          control={control}
          name="taxaFundoRendimento"
          formato="taxa"
          label="Rendimento do fundo (% a.a.)"
          helperText="De 0 a 100. Por exemplo, o CDI"
        />
        <CampoNumerico
          control={control}
          name="prazoMesesFundo"
          formato="inteiro"
          label="Prazo para juntar o valor (meses)"
          helperText="Número inteiro, de 1 a 60"
        />
      </Secao>

      <Secao titulo="Correção do preço do carro">
        <CampoNumerico
          control={control}
          name="taxaIpcaProjetada"
          formato="taxa"
          label="IPCA projetado (% a.a.)"
          helperText="De -20 a 100. Quanto o preço do carro deve subir por ano"
        />
      </Secao>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Salvando…' : rotuloEnviar}
        </Button>
        {acoes}
      </Box>
    </Box>
  )
}
