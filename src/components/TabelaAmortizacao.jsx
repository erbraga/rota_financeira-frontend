import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useId } from 'react'
import { formatarMoeda } from '../utils/formatar.js'

// Números alinhados à direita e com a mesma largura de dígito, para as colunas se lerem em linha reta.
const NUMERO = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

export const NOTA_DO_SALDO =
  'O saldo devedor é o saldo depois do pagamento da parcela do mês; o saldo inicial é o valor financiado.'
export const NOTA_DAS_PARCELAS_ZERADAS =
  'Parcelas de R$ 0,00 aparecem quando os centavos do saldo já foram quitados.'

// A tabela de amortização: UMA linha por mês, exatamente como o /parcelas devolve (nenhuma linha é somada, agrupada ou
// recalculada). Fica num quadro de altura limitada (~60 % da tela) com o cabeçalho das colunas FIXO e rolagem também na
// horizontal (celular); o quadro recebe foco por teclado para rolar com as setas.
//  - parcelas: `parcelas` do /parcelas ({ numero, valor_parcela, juros, amortizacao, saldo_devedor }).
// A nota das parcelas de R$ 0,00 só aparece quando alguma linha vem zerada (uma comparação, não um cálculo).
export default function TabelaAmortizacao({ parcelas }) {
  const idDoTitulo = useId()
  const temParcelaZerada = parcelas.some((linha) => linha.valor_parcela === 0)

  return (
    <Box component="section" aria-labelledby={idDoTitulo}>
      <Typography variant="h5" component="h2" id={idDoTitulo} gutterBottom>
        Parcelas mês a mês
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: temParcelaZerada ? 0.5 : 1.5 }}>
        {NOTA_DO_SALDO}
      </Typography>
      {temParcelaZerada && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {NOTA_DAS_PARCELAS_ZERADAS}
        </Typography>
      )}

      <TableContainer
        role="region"
        aria-label="Tabela de amortização, com rolagem"
        tabIndex={0}
        sx={{ maxHeight: '60vh', overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <Table stickyHeader size="small" aria-labelledby={idDoTitulo}>
          <TableHead>
            <TableRow>
              <TableCell scope="col" sx={NUMERO}>
                Mês
              </TableCell>
              <TableCell scope="col" sx={NUMERO}>
                Parcela
              </TableCell>
              <TableCell scope="col" sx={NUMERO}>
                Juros
              </TableCell>
              <TableCell scope="col" sx={NUMERO}>
                Amortização
              </TableCell>
              <TableCell scope="col" sx={NUMERO}>
                Saldo devedor
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parcelas.map((linha) => (
              <TableRow key={linha.numero} hover>
                <TableCell component="th" scope="row" sx={NUMERO}>
                  {linha.numero}
                </TableCell>
                <TableCell sx={NUMERO}>{formatarMoeda(linha.valor_parcela)}</TableCell>
                <TableCell sx={NUMERO}>{formatarMoeda(linha.juros)}</TableCell>
                <TableCell sx={NUMERO}>{formatarMoeda(linha.amortizacao)}</TableCell>
                <TableCell sx={NUMERO}>{formatarMoeda(linha.saldo_devedor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
