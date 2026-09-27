// Texto de um erro para mostrar à pessoa (estados de erro, diálogos). Nunca detalhes técnicos:
//  - falha de rede/timeout: a mensagem própria do ErroRede;
//  - erro da API: o "erro" do backend (já em português);
//  - qualquer outro: mensagem genérica.
import { ehErroApi, ehErroRede } from '../api/erros.js'
import { MENSAGEM_ERRO_INESPERADO } from './errosDeFormulario.js'

export function mensagemDeErro(erro) {
  if (ehErroRede(erro)) return erro.message
  if (ehErroApi(erro)) return erro.erro
  return MENSAGEM_ERRO_INESPERADO
}
