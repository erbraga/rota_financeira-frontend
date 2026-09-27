import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useId, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatarMoeda, formatarMoedaCompacta } from '../utils/formatar.js'
import { CHAVE_FUNDO, CHAVE_PRECO, montarDados, montarLinhas, resumoDoGrafico } from '../utils/serieDoGrafico.js'

// Só o leitor de tela lê: o resumo em texto do que o gráfico desenha.
const SO_PARA_LEITOR_DE_TELA = {
  position: 'absolute',
  width: 1,
  height: 1,
  m: -1,
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

// Cor E traço de cada linha: as cores sozinhas não bastam (daltonismo, impressão em preto e branco).
function estiloDaLinha(linha, indiceDoFinanciamento, paleta) {
  if (linha.chave === CHAVE_PRECO) return { cor: paleta.preco, traco: '8 4', largura: 3 }
  if (linha.chave === CHAVE_FUNDO) return { cor: paleta.fundo, traco: undefined, largura: 3 }
  const cores = paleta.financiamentos
  const tracos = [undefined, '6 3', '2 3']
  return { cor: cores[indiceDoFinanciamento % cores.length], traco: tracos[indiceDoFinanciamento % tracos.length], largura: 2 }
}

// A amostra da linha na legenda (o mesmo traço do gráfico).
function AmostraDaLinha({ cor, traco, largura }) {
  return (
    <svg width="28" height="10" aria-hidden="true" focusable="false">
      <line x1="1" y1="5" x2="27" y2="5" stroke={cor} strokeWidth={largura} strokeDasharray={traco} strokeLinecap="round" />
    </svg>
  )
}

// O gráfico de linhas do resultado: saldo devedor de cada financiamento, saldo do fundo e preço corrigido pelo IPCA, num eixo
// comum de meses. Só EXIBE as séries que a API devolve (nada é calculado nem preenchido): onde uma série terminou o valor é
// null e a linha termina ali (`connectNulls={false}`, sem cair a zero). A legenda é própria: cada entrada é um botão que oculta
// e mostra a linha (`aria-pressed`), funciona por teclado e continua utilizável no celular.
//  - series: `series` do /resultado; financiamentos: `cenarios.financiamentos` (o nome de cada linha de dívida).
export default function GraficoComparativo({ series, financiamentos }) {
  const tema = useTheme()
  const idDoTitulo = useId()
  const idDoResumo = useId()
  const [ocultas, setOcultas] = useState(() => new Set())

  const dados = useMemo(() => montarDados(series), [series])
  const linhas = useMemo(() => montarLinhas(financiamentos), [financiamentos])
  const resumo = useMemo(() => resumoDoGrafico(dados, linhas), [dados, linhas])

  const paleta = {
    financiamentos: [tema.palette.primary.main, tema.palette.secondary.main, tema.palette.warning.dark],
    fundo: tema.palette.success.dark,
    preco: tema.palette.text.primary,
  }
  let indiceDoFinanciamento = 0
  const estilos = linhas.map((linha) => estiloDaLinha(linha, linha.tipo === 'financiamento' ? indiceDoFinanciamento++ : 0, paleta))

  function alternar(chave) {
    setOcultas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(chave)) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }

  return (
    <Box component="section" aria-labelledby={idDoTitulo}>
      <Typography variant="h5" component="h2" id={idDoTitulo} gutterBottom>
        Evolução mês a mês
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        {linhas.map((linha, indice) => {
          const visivel = !ocultas.has(linha.chave)
          const { cor, traco, largura } = estilos[indice]
          return (
            <Button
              key={linha.chave}
              size="small"
              variant={visivel ? 'outlined' : 'text'}
              aria-pressed={visivel}
              onClick={() => alternar(linha.chave)}
              startIcon={<AmostraDaLinha cor={cor} traco={traco} largura={largura} />}
              sx={{ textTransform: 'none', textDecoration: visivel ? 'none' : 'line-through', overflowWrap: 'anywhere', textAlign: 'left' }}
            >
              {linha.nome}
            </Button>
          )
        })}
      </Box>

      <Box component="figure" aria-labelledby={idDoTitulo} aria-describedby={idDoResumo} sx={{ m: 0 }}>
        <Typography id={idDoResumo} component="p" sx={SO_PARA_LEITOR_DE_TELA}>
          {`Gráfico de linhas, do mês ${dados[0].mes} ao mês ${dados.at(-1).mes}, em reais. ${resumo.join(' ')}`}
        </Typography>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" type="number" domain={[0, 'dataMax']} tickCount={8} label={{ value: 'Meses', position: 'insideBottom', offset: -8 }} />
            <YAxis tickFormatter={formatarMoedaCompacta} width={76} />
            <Tooltip formatter={(valor, nome) => [formatarMoeda(valor), nome]} labelFormatter={(mes) => `Mês ${mes}`} />
            {linhas.map((linha, indice) => (
              <Line
                key={linha.chave}
                type="linear"
                dataKey={linha.chave}
                name={linha.nome}
                stroke={estilos[indice].cor}
                strokeWidth={estilos[indice].largura}
                strokeDasharray={estilos[indice].traco}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
                hide={ocultas.has(linha.chave)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}
