import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// Tempo total de espera pelo <h1> da tela nova (ela pode ainda estar carregando os dados, como o Resultado e a
// Amortização) e o passo de cada tentativa. Configuráveis por prop só para os testes irem mais rápido.
const ESPERA_MAXIMA_MS = 2000
const PASSO_DA_ESPERA_MS = 50

// Sem interface própria (`return null`): a cada troca de CAMINHO (não de busca — o `?aporte_mensal=` do resultado
// não conta) rola a página ao topo, sem animação, e move o foco para o título principal (`h1`) da tela nova. É o
// padrão recomendado pelo WAI-ARIA para SPAs: sem isso, o leitor de tela não percebe que a tela mudou (o foco fica
// no que foi clicado, que pode nem existir mais) e quem usa só o teclado continua tabulando do fim da tela anterior.
//  - nunca na primeira carga da página (só em trocas de rota depois dela);
//  - nunca se algo já tem foco DENTRO DA TELA NOVA (um campo com `autoFocus`) ou dentro de um diálogo aberto: eles
//    têm prioridade. Um simples "algo já tem foco" não bastaria: clicar num link de navegação deixa o PRÓPRIO link
//    focado (comportamento nativo do navegador), e esse foco velho, de fora da tela nova, não deve ser respeitado
//    (senão o foco nunca se moveria ao trocar de rota por um clique). Por isso a tela nova precisa de um `<main>`
//    (como em `Layout.jsx` e `LayoutPublico.jsx`) que a diferencie da barra e da navegação ao redor dela;
//  - o `h1` pode aparecer só depois do carregamento dos dados: espera por ele um tempo curto e desiste sem erro.
export default function MudancaDeRota({ esperaMaximaMs = ESPERA_MAXIMA_MS, passoDaEsperaMs = PASSO_DA_ESPERA_MS } = {}) {
  const { pathname } = useLocation()
  const primeiraCargaRef = useRef(true)

  useEffect(() => {
    if (primeiraCargaRef.current) {
      primeiraCargaRef.current = false
      return undefined
    }

    // jsdom não implementa scrollTo de verdade (os testes o substituem); o navegador real rola.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

    let cancelado = false
    let decorridoMs = 0
    function tentarFocar() {
      if (cancelado) return
      const titulo = document.querySelector('h1')
      if (titulo) {
        const emFoco = document.activeElement
        const dentroDeUmDialogo = emFoco?.closest?.('[role="dialog"], [role="alertdialog"]')
        const dentroDaTelaNova = titulo.closest('main')?.contains(emFoco) ?? false
        // Um campo com autoFocus na tela nova, ou um diálogo aberto (mesmo de fora do <main>, por ex. um portal do
        // MUI): já decidiram o foco, e não disputamos. Um link de navegação clicado (fora do <main>) não conta.
        if (emFoco && emFoco !== document.body && (dentroDeUmDialogo || dentroDaTelaNova)) return
        if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1')
        titulo.focus()
        return
      }
      decorridoMs += passoDaEsperaMs
      if (decorridoMs < esperaMaximaMs) setTimeout(tentarFocar, passoDaEsperaMs)
    }
    tentarFocar()

    return () => {
      cancelado = true
    }
  }, [pathname, esperaMaximaMs, passoDaEsperaMs])

  return null
}
