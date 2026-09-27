// Aplica um erro vindo do servidor a um formulário do React Hook Form.
import { ehErroApi, ehErroRede } from '../api/erros.js'

export const MENSAGEM_ERRO_INESPERADO = 'Ocorreu um erro inesperado. Tente novamente.'

// campos: a lista de campos do formulário que têm o MESMO nome na API (['email', 'senha']) ou um MAPA
// { campo_da_api: campoDoFormulario } quando os nomes diferem ({ valor_veiculo: 'valorVeiculo' }).
// Cada chave de "detalhes" que é campo do formulário vira setError(campo, ...) com a 1ª mensagem.
// Devolve a MENSAGEM GERAL a mostrar acima do formulário, ou null se tudo foi para os campos:
//  - erro da API sem detalhes (ex.: 409, 401): o "erro" do backend;
//  - detalhes com chave que não é campo: o "erro" do backend (os campos conhecidos continuam marcados);
//  - falha de rede/timeout: a mensagem própria do ErroRede;
//  - qualquer outro erro: mensagem genérica (nunca detalhes técnicos).
export function aplicarErrosDoServidor(erro, setError, campos) {
  if (ehErroRede(erro)) return erro.message
  if (!ehErroApi(erro)) return MENSAGEM_ERRO_INESPERADO

  const detalhes = erro.detalhes
  if (!detalhes || Object.keys(detalhes).length === 0) return erro.erro

  const mapa = Array.isArray(campos) ? Object.fromEntries(campos.map((campo) => [campo, campo])) : campos

  let sobrou = false
  for (const [campoDaApi, mensagens] of Object.entries(detalhes)) {
    const mensagem = Array.isArray(mensagens) ? mensagens[0] : mensagens
    if (Object.hasOwn(mapa, campoDaApi) && typeof mensagem === 'string') {
      setError(mapa[campoDaApi], { type: 'servidor', message: mensagem })
    } else {
      sobrou = true
    }
  }
  return sobrou ? erro.erro : null
}
