import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CAMPOS_DA_API, deSimulacaoParaForm, esquemaSimulacao, paraCorpoDaApi } from '../schemas/simulacao.js'
import { aplicarErrosDoServidor } from '../utils/errosDeFormulario.js'
import { numeroParaCampo } from '../utils/formatar.js'
import CampoNumerico from './CampoNumerico.jsx'
import SugestaoDeTaxa from './SugestaoDeTaxa.jsx'

// Ordem visual dos campos: o foco vai para o primeiro campo com erro vindo do servidor.
const ORDEM_DOS_CAMPOS = ['nome', 'valorVeiculo', 'valorEntrada', 'taxaFundoRendimento', 'prazoMesesFundo', 'taxaIpcaProjetada']

// Cada campo de taxa e o índice do Banco Central que o sugere.
const INDICE_DO_CAMPO = { taxaFundoRendimento: 'cdi', taxaIpcaProjetada: 'ipca' }

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
//  - rotuloEnviar: texto do botão; acoes: botões extras ao lado do de enviar;
//  - sugestoes: { taxaFundoRendimento, taxaIpcaProjetada }, cada uma o resultado do useIndice (CDI e IPCA). Sem isso o
//    formulário funciona igual, sem linha de sugestão;
//  - preencherSugestoes: só na simulação NOVA. A sugestão chega e preenche o campo UMA vez, e só se ele ainda estiver
//    intocado (sem edição nem saída do campo): o que a pessoa digitou nunca é sobrescrito. Na edição os valores gravados
//    nunca mudam sozinhos; só o botão "Usar" altera o campo.
export default function FormularioSimulacao({
  valoresIniciais,
  aoEnviar,
  rotuloEnviar = 'Salvar',
  acoes,
  sugestoes,
  preencherSugestoes = false,
}) {
  const [erroGeral, setErroGeral] = useState(null)

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    reset,
    formState: { errors, isSubmitting, dirtyFields, touchedFields },
  } = useForm({
    resolver: zodResolver(esquemaSimulacao),
    defaultValues: valoresIniciais,
    // O erro de um campo aparece ao sair dele ou ao enviar (e depois de enviar, revalida a cada mudança).
    mode: 'onBlur',
  })

  // Campos cuja sugestão já foi decidida (preenchida ou deixada de lado): a decisão vale uma vez só.
  const decididos = useRef(new Set())
  useEffect(() => {
    if (!preencherSugestoes || !sugestoes) return
    for (const nome of Object.keys(INDICE_DO_CAMPO)) {
      const sugestao = sugestoes[nome]?.data?.sugestao
      if (!sugestao || decididos.current.has(nome)) continue
      decididos.current.add(nome)
      // Sem shouldDirty: o valor sugerido não conta como digitado (a pessoa ainda pode substituí-lo).
      if (!dirtyFields[nome] && !touchedFields[nome]) setValue(nome, numeroParaCampo(sugestao.valor))
    }
  }, [preencherSugestoes, sugestoes, dirtyFields, touchedFields, setValue])

  // "Usar": escreve a sugestão (também sobre o que foi digitado, é o "restaurar"), valida e devolve o foco ao campo.
  function usarSugestao(nome, texto) {
    setValue(nome, texto, { shouldDirty: true, shouldValidate: true })
    setFocus(nome)
  }

  // Linha de apoio sob o campo de taxa (só quando o formulário recebeu as consultas).
  function apoio(nome) {
    const consulta = sugestoes?.[nome]
    if (!consulta) return {}
    const id = `sugestao-${nome}`
    return {
      descritoPor: id,
      sugestao: (
        <SugestaoDeTaxa
          id={id}
          indice={INDICE_DO_CAMPO[nome]}
          consulta={consulta}
          aoUsar={(texto) => usarSugestao(nome, texto)}
          aoTentarNovamente={() => consulta.refetch()}
        />
      ),
    }
  }
  const rendimento = apoio('taxaFundoRendimento')
  const ipca = apoio('taxaIpcaProjetada')

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
          descritoPor={rendimento.descritoPor}
        />
        {rendimento.sugestao}
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
          descritoPor={ipca.descritoPor}
        />
        {ipca.sugestao}
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
