import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { formatarData, formatarMesAno, formatarPercentual, numeroParaCampo } from '../utils/formatar.js'

const INDICES = {
  cdi: {
    nome: 'CDI',
    origem: (dataReferencia) => `CDI de ${formatarData(dataReferencia)}`,
  },
  ipca: {
    nome: 'IPCA',
    origem: (dataReferencia) => `IPCA acumulado em 12 meses até ${formatarMesAno(dataReferencia)}`,
  },
}

export const TEXTO_IPCA_REALIZADO =
  'É o IPCA acumulado nos últimos 12 meses (já realizado), não uma projeção. Use como referência.'

// Linha de apoio sob um campo de taxa: de onde vem a sugestão do Banco Central e o botão para usá-la. Nenhum estado
// bloqueia o formulário (a criação da simulação não depende do BACEN).
//  - indice: 'cdi' | 'ipca'; consulta: o resultado do useIndice (isPending, isError, isFetching, data);
//  - aoUsar(texto): recebe a taxa no formato do campo ("13,65"); aoTentarNovamente: refaz só esta consulta;
//  - id: liga o texto ao campo (aria-describedby).
// A região com aria-live avisa a chegada da sugestão sem tirar o foco de quem está digitando.
export default function SugestaoDeTaxa({ id, indice, consulta, aoUsar, aoTentarNovamente }) {
  const { nome, origem } = INDICES[indice]
  const sugestao = consulta.data?.sugestao ?? null

  let conteudo
  if (consulta.isPending || (consulta.isError && consulta.isFetching)) {
    conteudo = <span>Buscando a sugestão do Banco Central…</span>
  } else if (consulta.isError) {
    conteudo = (
      <>
        <span>Não foi possível obter a sugestão do Banco Central agora. Digite a taxa.</span>
        <Button size="small" onClick={aoTentarNovamente}>
          Tentar de novo
        </Button>
      </>
    )
  } else if (sugestao === null) {
    conteudo = <span>Sem sugestão do Banco Central disponível agora. Digite a taxa.</span>
  } else {
    const taxa = formatarPercentual(sugestao.valor)
    conteudo = (
      <>
        <span>
          Sugestão do Banco Central: <strong>{taxa} a.a.</strong> ({origem(sugestao.data_referencia)})
        </span>
        <Button size="small" aria-label={`Usar a sugestão do ${nome}: ${taxa}`} onClick={() => aoUsar(numeroParaCampo(sugestao.valor))}>
          Usar {taxa}
        </Button>
        {consulta.data.desatualizado && (
          <Typography component="span" variant="body2" sx={{ color: 'warning.dark' }}>
            Dados do cache, podem estar defasados.
          </Typography>
        )}
      </>
    )
  }

  return (
    <Box id={id} sx={{ mt: -1 }}>
      <Typography
        component="div"
        variant="body2"
        color="text.secondary"
        aria-live="polite"
        sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}
      >
        {conteudo}
      </Typography>
      {indice === 'ipca' && (
        <Typography variant="body2" color="text.secondary">
          {TEXTO_IPCA_REALIZADO}
        </Typography>
      )}
    </Box>
  )
}
