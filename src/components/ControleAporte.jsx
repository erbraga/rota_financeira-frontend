import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { useState } from 'react'
import { aporteParaUrl, validarAporte } from '../utils/aporteNaUrl.js'

// O "e se eu guardar X por mês?" do cartão do fundo. Não conhece a API nem o endereço: recebe o estado e avisa o que a
// pessoa quer. Um valor inválido NUNCA chega a `aoSimular` (a validação é do cliente, com as mensagens do backend).
//  - valorAtual: o aporte em uso (número) ou undefined (o resultado padrão, com o aporte calculado pelo backend);
//  - textoInvalido / erroDoEndereco: o texto que veio do endereço e a mensagem, quando o endereço traz um aporte inválido;
//  - erroDoServidor: a mensagem de um 422 do parâmetro (não deveria ocorrer, pois o cliente valida antes);
//  - ocupado: a busca do novo resultado está em andamento;
//  - aoSimular(valor): valor já válido, como número; aoVoltar(): volta ao valor calculado (tira o aporte).
export default function ControleAporte({ valorAtual, textoInvalido, erroDoEndereco, erroDoServidor, ocupado = false, aoSimular, aoVoltar }) {
  const textoDeFora = textoInvalido ?? (valorAtual === undefined ? '' : aporteParaUrl(valorAtual))
  const [texto, setTexto] = useState(textoDeFora)
  const [erroLocal, setErroLocal] = useState(null)

  // Quando o estado de fora muda (Voltar do navegador, outro aporte no endereço) o campo acompanha.
  const [referencia, setReferencia] = useState(textoDeFora)
  if (referencia !== textoDeFora) {
    setReferencia(textoDeFora)
    setTexto(textoDeFora)
    setErroLocal(null)
  }

  function aoEnviar(evento) {
    evento.preventDefault()
    const lido = validarAporte(texto)
    if (lido.erro) {
      setErroLocal(lido.erro)
      return
    }
    setErroLocal(null)
    aoSimular(lido.valor)
  }

  const erro = erroLocal ?? erroDoEndereco ?? erroDoServidor ?? null
  const comAporte = valorAtual !== undefined || textoInvalido !== undefined

  return (
    <Box component="form" noValidate onSubmit={aoEnviar} sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        label="E se eu guardar (R$ por mês)?"
        size="small"
        autoComplete="off"
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value)
          setErroLocal(null)
        }}
        error={Boolean(erro)}
        helperText={erro ?? 'De 0,00 a 9.999.999,00; use vírgula nos centavos'}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button type="submit" variant="outlined" size="small" disabled={ocupado} aria-busy={ocupado}>
          {ocupado ? 'Simulando…' : 'Simular'}
        </Button>
        {comAporte && (
          <Button type="button" size="small" onClick={aoVoltar} disabled={ocupado}>
            Voltar ao valor calculado
          </Button>
        )}
      </Box>
    </Box>
  )
}
