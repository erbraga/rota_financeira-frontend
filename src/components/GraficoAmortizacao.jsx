import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useId, useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SO_PARA_LEITOR_DE_TELA } from '../estilos.js'
import { formatarMoeda, formatarMoedaCompacta } from '../utils/formatar.js'
import {
  CHAVE_AMORTIZACAO,
  CHAVE_JUROS,
  montarBarras,
  NOME_DA_AMORTIZACAO,
  NOME_DOS_JUROS,
  resumoDaAmortizacao,
} from '../utils/serieDaAmortizacao.js'

// A amostra de uma fatia na legenda (mesma cor/padrão das barras): cheia para a amortização, listrada para os juros.
function Amostra({ cor, idDoPadrao }) {
  return (
    <svg width="16" height="16" aria-hidden="true" focusable="false">
      <rect width="16" height="16" fill={idDoPadrao ? `url(#${idDoPadrao})` : cor} stroke={cor} strokeWidth="1.5" />
    </svg>
  )
}

// O gráfico da amortização: uma barra por mês dividida em duas fatias, a AMORTIZAÇÃO e os JUROS daquela parcela, lidos das
// colunas da API (nada é calculado). Na Price a fatia dos juros encolhe; na SAC a da amortização é constante. As fatias se
// distinguem por cor E por padrão (os juros são listrados). Legenda com as duas, tooltip em reais e resumo em texto para
// leitor de tela.
//  - parcelas: `parcelas` do /parcelas.
export default function GraficoAmortizacao({ parcelas }) {
  const tema = useTheme()
  const idDoTitulo = useId()
  const idDoResumo = useId()
  // O id de um <pattern> vai dentro de url(#...): sem os dois-pontos que o useId gera.
  const idDoPadrao = `padrao-juros-${useId().replaceAll(':', '')}`

  const dados = useMemo(() => montarBarras(parcelas), [parcelas])
  const resumo = useMemo(() => resumoDaAmortizacao(parcelas), [parcelas])
  const corDaAmortizacao = tema.palette.primary.main
  const corDosJuros = tema.palette.warning.dark

  return (
    <Box component="section" aria-labelledby={idDoTitulo}>
      <Typography variant="h5" component="h2" id={idDoTitulo} gutterBottom>
        Juros e amortização de cada parcela
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Amostra cor={corDaAmortizacao} />
          <Typography variant="body2">{NOME_DA_AMORTIZACAO}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Amostra cor={corDosJuros} idDoPadrao={idDoPadrao} />
          <Typography variant="body2">{NOME_DOS_JUROS}</Typography>
        </Box>
      </Box>

      <Box component="figure" aria-labelledby={idDoTitulo} aria-describedby={idDoResumo} sx={{ m: 0, position: 'relative' }}>
        <Typography id={idDoResumo} component="p" sx={SO_PARA_LEITOR_DE_TELA}>
          {`Gráfico de barras empilhadas, do mês ${dados[0]?.mes} ao mês ${dados.at(-1)?.mes}, em reais: cada barra é uma parcela, dividida em amortização e juros. ${resumo}`}
        </Typography>
        {/* O padrão listrado dos juros, também usado na legenda (definido uma vez, fora do gráfico). */}
        <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
          <defs>
            <pattern id={idDoPadrao} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={corDosJuros} fillOpacity="0.25" />
              <rect width="3" height="6" fill={corDosJuros} />
            </pattern>
          </defs>
        </svg>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dados} margin={{ top: 8, right: 16, bottom: 16, left: 8 }} barCategoryGap="10%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" interval="preserveStartEnd" minTickGap={16} label={{ value: 'Meses', position: 'insideBottom', offset: -8 }} />
            <YAxis tickFormatter={formatarMoedaCompacta} width={76} />
            <Tooltip formatter={(valor, nome) => [formatarMoeda(valor), nome]} labelFormatter={(mes) => `Mês ${mes}`} />
            <Bar dataKey={CHAVE_AMORTIZACAO} name={NOME_DA_AMORTIZACAO} stackId="parcela" fill={corDaAmortizacao} isAnimationActive={false} />
            <Bar
              dataKey={CHAVE_JUROS}
              name={NOME_DOS_JUROS}
              stackId="parcela"
              fill={`url(#${idDoPadrao})`}
              stroke={corDosJuros}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}
