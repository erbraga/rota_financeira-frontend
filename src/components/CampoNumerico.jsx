import TextField from '@mui/material/TextField'
import { useId } from 'react'
import { useController } from 'react-hook-form'
import { casasDecimais, dinheiroParaCampo, lerNumero, numeroParaCampo } from '../utils/formatar.js'

// formato: como o valor é reescrito ao sair do campo e quantas casas cabem.
//  - dinheiro: 2 casas, com milhar (95.000,50); taxa: até 6 casas, sem zeros inúteis (0,85); inteiro: sem casas.
const FORMATOS = {
  dinheiro: { casas: 2, inputMode: 'decimal', escrever: dinheiroParaCampo },
  taxa: { casas: 6, inputMode: 'decimal', escrever: numeroParaCampo },
  inteiro: { casas: 0, inputMode: 'numeric', escrever: numeroParaCampo },
}

// Campo de valor, taxa ou inteiro para o React Hook Form (useController). O estado é o TEXTO digitado (nenhuma
// máscara enquanto digita); ao SAIR do campo, um valor válido é reescrito no formato pt-BR. Nunca arredonda: se o
// número tiver mais casas do que cabem, fica como digitado e o esquema mostra o erro. Inválido ou vazio também fica.
// depende: nomes de OUTROS campos que devem ser revalidados quando este muda (ex.: a entrada depende do veículo). Sem
// isso o React Hook Form só revalida o campo que perdeu o foco, e o erro cruzado só apareceria no envio.
// descritoPor: id de um texto de apoio que fica FORA do campo (ex.: a sugestão do Banco Central); é lido junto com a ajuda.
export default function CampoNumerico({ control, name, formato = 'dinheiro', depende, helperText, descritoPor, ...resto }) {
  const { field, fieldState } = useController({ control, name, rules: depende ? { deps: depende } : undefined })
  const id = useId()
  const { casas, inputMode, escrever } = FORMATOS[formato]

  // ORDEM IMPORTA: primeiro reescreve o valor (onChange), depois sai do campo (onBlur). O onBlur é quem dispara a
  // validação, e o React Hook Form DESCARTA o resultado de uma validação se o valor mudou enquanto ela rodava:
  // com onBlur antes do onChange, o erro de um valor válido no formato mas fora da faixa (ex.: "0" -> "0,00") nunca aparecia.
  function aoSair() {
    const texto = field.value ?? ''
    const { valor, erro } = lerNumero(texto)
    const cabe =
      !erro &&
      valor !== null &&
      casasDecimais(valor) <= casas &&
      (formato !== 'inteiro' || Number.isInteger(valor))
    if (cabe) {
      const escrito = escrever(valor)
      if (escrito !== texto) field.onChange(escrito)
    }
    field.onBlur()
  }

  return (
    <TextField
      {...resto}
      id={id}
      name={field.name}
      value={field.value ?? ''}
      onChange={field.onChange}
      onBlur={aoSair}
      inputRef={field.ref}
      autoComplete="off"
      error={Boolean(fieldState.error)}
      helperText={fieldState.error?.message ?? helperText}
      slotProps={{
        htmlInput: {
          inputMode,
          // O MUI liga o campo à ajuda (`${id}-helper-text`); como este atributo a substitui, ela é repetida aqui.
          ...(descritoPor && { 'aria-describedby': `${id}-helper-text ${descritoPor}` }),
        },
      }}
    />
  )
}
