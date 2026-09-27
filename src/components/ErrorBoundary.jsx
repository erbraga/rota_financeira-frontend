import { Component } from 'react'
import ErroInesperado from './ErroInesperado.jsx'

// Um erro de carregamento de rota sob demanda (React.lazy) não se recupera sozinho: a promessa rejeitada fica
// guardada no módulo, então reiniciar a fronteira relançaria o mesmo erro. Só um recarregamento de página resolve.
function ehErroDeCarregamentoDePacote(erro) {
  return /dynamically imported module|error loading dynamically imported module|failed to fetch/i.test(erro?.message ?? '')
}

// Fronteira de erro (React só permite fronteira de erro como classe: única exceção à regra "sem classes" do
// projeto). Duas variantes, controladas pela prop `variante` ("tela" ou "global", ver ErroInesperado):
//  - "tela": usada dentro do Layout, em volta do <Outlet />, com a prop `chave` = o caminho da rota. Ao trocar
//    de tela a fronteira se reinicia sozinha (uma tela quebrada não contamina a seguinte).
//  - "global": em volta de todo o app (Raiz), para o que quebrar fora do layout (providers, layout público).
// Registra só o texto do erro no console (diagnóstico, sem stack nem dado da pessoa na TELA) e nunca deixa a
// tela em branco.
export default class ErrorBoundary extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro) {
    // Único console.error permitido no código de produção: registro de diagnóstico, sem stack nem dado da pessoa.
    console.error('Erro de renderização capturado pela fronteira:', erro?.message ?? String(erro))
  }

  componentDidUpdate(propsAnteriores) {
    if (this.state.erro && propsAnteriores.chave !== this.props.chave) {
      this.setState({ erro: null })
    }
  }

  tentarDeNovo = () => {
    if (this.props.variante === 'global' || ehErroDeCarregamentoDePacote(this.state.erro)) {
      window.location.reload()
      return
    }
    this.setState({ erro: null })
  }

  render() {
    if (this.state.erro) {
      return <ErroInesperado variante={this.props.variante} aoTentarNovo={this.tentarDeNovo} />
    }
    return this.props.children
  }
}
