import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ROTULO_DO_SISTEMA } from '../schemas/financiamento.js'
import { formatarMes, formatarMoeda, formatarPrazo } from '../utils/formatar.js'

// Uma linha rótulo/valor dos detalhes (lista de definição: leitor de tela lê o rótulo com o valor).
function Detalhe({ rotulo, valor }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, textAlign: 'right' }}>
        {valor}
      </Typography>
    </Box>
  )
}

// As parcelas de um financiamento. Só se EXIBE o que a API devolve; a comparação primeira x última serve para escolher o
// texto: numa Price a última parcela pode diferir da primeira por centavos (absorve o arredondamento), e a SAC é decrescente.
function DetalhesDasParcelas({ sistema, primeira, ultima }) {
  if (primeira === ultima) return <Detalhe rotulo="Parcela" valor={formatarMoeda(primeira)} />
  return (
    <>
      <Detalhe rotulo="Primeira parcela" valor={formatarMoeda(primeira)} />
      <Detalhe rotulo="Última parcela" valor={formatarMoeda(ultima)} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
        {sistema === 'SAC'
          ? 'As parcelas da SAC são decrescentes.'
          : 'A última parcela absorve o arredondamento de centavos das parcelas anteriores.'}
      </Typography>
    </>
  )
}

// Os detalhes do fundo. `alcanca_a_meta` e os `null` vêm da API: sem meta alcançada (aporte informado pequeno demais) o mês
// da meta, o preço na compra e o custo total vêm null e aparecem como "—", com a frase que explica o porquê.
function DetalhesDoFundo({ fundo }) {
  const alcanca = fundo.alcanca_a_meta
  return (
    <>
      <Typography variant="body2" component="p" sx={{ m: 0, mb: 1, fontWeight: 500 }}>
        {alcanca ? `Alcança a meta no ${formatarMes(fundo.mes_da_meta)}.` : `Não alcança a meta em ${formatarPrazo(fundo.prazo_meses)}.`}
      </Typography>
      <Detalhe rotulo="Capital inicial" valor={formatarMoeda(fundo.capital_inicial)} />
      <Detalhe rotulo="Aporte mensal" valor={formatarMoeda(fundo.aporte_mensal)} />
      <Detalhe rotulo="Prazo" valor={formatarPrazo(fundo.prazo_meses)} />
      <Detalhe rotulo="Mês da meta" valor={formatarMes(fundo.mes_da_meta)} />
      <Detalhe rotulo="Preço na compra" valor={formatarMoeda(fundo.preco_na_compra)} />
      <Detalhe rotulo="Total aportado" valor={formatarMoeda(fundo.total_aportado)} />
      <Detalhe rotulo="Rendimento" valor={formatarMoeda(fundo.rendimento)} />
      <Detalhe rotulo="Saldo final" valor={formatarMoeda(fundo.saldo_final)} />
      {!alcanca && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          {`Sem custo total: o fundo não alcança o preço em ${formatarPrazo(fundo.prazo_meses)}.`}
        </Typography>
      )}
    </>
  )
}

// Cartão de um cenário do resultado, com o custo total em destaque e os detalhes SEMPRE visíveis:
//  - tipo: 'a_vista' | 'financiamento' | 'fundo';
//  - cenario: o bloco do /resultado (`a_vista`, um item de `financiamentos` ou o `fundo`);
//  - destacado: o backend o indicou em `menor_custo` -> etiqueta escrita "Menor custo" e borda mais forte (não só cor);
//  - simulacaoId: dono do financiamento, para o link "Ver parcelas";
//  - children: conteúdo extra no fim do cartão (o campo do "e se eu guardar X por mês?", no do fundo).
// Nada é calculado aqui: só formatação dos números que a API traz.
export default function CartaoCenario({ tipo, cenario, destacado = false, simulacaoId, children }) {
  const idDoTitulo = useId()

  let titulo
  let detalhes
  let acao = null
  if (tipo === 'a_vista') {
    titulo = 'Compra à vista'
    detalhes = <Typography variant="body2" color="text.secondary">Você paga o valor do veículo de uma vez.</Typography>
  } else if (tipo === 'financiamento') {
    titulo = cenario.nome
    detalhes = (
      <>
        <Detalhe rotulo="Sistema" valor={ROTULO_DO_SISTEMA[cenario.sistema_amortizacao] ?? cenario.sistema_amortizacao} />
        <Detalhe rotulo="Prazo" valor={formatarPrazo(cenario.prazo_meses)} />
        <Detalhe rotulo="Valor financiado" valor={formatarMoeda(cenario.valor_financiado)} />
        <Detalhe rotulo="Entrada" valor={formatarMoeda(cenario.valor_entrada)} />
        <DetalhesDasParcelas
          sistema={cenario.sistema_amortizacao}
          primeira={cenario.primeira_parcela}
          ultima={cenario.ultima_parcela}
        />
        <Detalhe rotulo="Total pago" valor={formatarMoeda(cenario.total_pago)} />
        <Detalhe rotulo="Total de juros" valor={formatarMoeda(cenario.total_juros)} />
      </>
    )
    acao = (
      <Button
        component={RouterLink}
        to={`/simulacoes/${simulacaoId}/financiamentos/${cenario.id}`}
        size="small"
        aria-label={`Ver parcelas de ${cenario.nome}`}
      >
        Ver parcelas
      </Button>
    )
  } else if (tipo === 'fundo') {
    titulo = 'Fundo de investimento'
    detalhes = <DetalhesDoFundo fundo={cenario} />
  } else {
    throw new Error(`Tipo de cenário desconhecido: ${tipo}`)
  }

  return (
    <Card
      component="article"
      aria-labelledby={idDoTitulo}
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderWidth: destacado ? 2 : 1,
        borderColor: destacado ? 'primary.main' : undefined,
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {destacado && <Chip label="Menor custo" color="primary" size="small" sx={{ mb: 1 }} />}
        <Typography variant="h6" component="h3" id={idDoTitulo} gutterBottom sx={{ overflowWrap: 'anywhere' }}>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          Custo total
        </Typography>
        <Typography variant="h5" component="p" sx={{ mb: 2, fontWeight: 600 }}>
          {formatarMoeda(cenario.custo_total)}
        </Typography>
        <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {detalhes}
        </Box>
        {children}
      </CardContent>
      {acao && <CardActions sx={{ px: 2, pb: 2 }}>{acao}</CardActions>}
    </Card>
  )
}
