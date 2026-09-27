import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'

// Os ícones são importados por caminho (@mui/icons-material/Visibility), nunca pelo pacote raiz: o pacote
// tem milhares de ícones e importá-lo inteiro deixaria o build grande e o servidor de desenvolvimento lento.

// Campo de senha com botão de olho. O estado "mostrar" é controlado por quem usa (no cadastro, os dois campos
// compartilham o mesmo estado e alternam juntos). Serve ao React Hook Form: {...register('senha')} funciona,
// porque a ref vai para o <input> (inputRef) e o restante das props segue para o TextField.
// descricao: o que o botão mostra/oculta, para o nome acessível ("Mostrar senha", "Mostrar confirmação da senha").
export default function CampoSenha({ mostrar, aoAlternar, descricao = 'senha', ref, ...resto }) {
  return (
    <TextField
      {...resto}
      inputRef={ref}
      type={mostrar ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={`${mostrar ? 'Ocultar' : 'Mostrar'} ${descricao}`}
                aria-pressed={mostrar}
                onClick={aoAlternar}
                // Não tira o foco do campo ao clicar no botão.
                onMouseDown={(evento) => evento.preventDefault()}
              >
                {mostrar ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
