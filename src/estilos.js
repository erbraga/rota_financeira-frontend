// Estilos `sx` compartilhados entre componentes. Ficam aqui (e não em theme.js) por serem objetos de estilo
// prontos, não tokens do tema.

// O texto de resumo lido só por leitor de tela (ex.: a descrição em texto de um gráfico). Some visualmente sem
// sair do fluxo de leitura assistida.
// CUIDADO: no `sx` do MUI, `width`/`height` entre 0 e 1 viram PORCENTAGEM (não pixel: width: 1 = 100%), e `m`/`p`
// multiplicam a unidade de espaçamento do tema (m: -1 = -8px, não -1px). Por isso os valores aqui vão em pixels
// LITERAIS ('1px', '-1px'), senão o elemento estica a página e causa rolagem horizontal — foi exatamente esse bug
// (measido numa auditoria de larguras) que motivou extrair este objeto num só lugar.
export const SO_PARA_LEITOR_DE_TELA = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
