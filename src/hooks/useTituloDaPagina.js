import { useEffect } from 'react'

// O nome do app, usado no título de toda tela.
export const NOME_DO_APP = 'Rota Financeira'

// Define o `document.title` da aba enquanto o componente que chama este hook está montado ("Resultado: Carro de
// exemplo · Rota Financeira"). Ao trocar de tela, o React desmonta a tela anterior e monta a nova: a limpeza
// deste hook restaura o título de antes (evita que uma tela "vaze" o título para outra que não o define).
// `titulo` vazio, `null` ou `undefined` deixa só o nome do app, sem o separador.
export function useTituloDaPagina(titulo) {
  useEffect(() => {
    const anterior = document.title
    document.title = titulo ? `${titulo} · ${NOME_DO_APP}` : NOME_DO_APP
    return () => {
      document.title = anterior
    }
  }, [titulo])
}
