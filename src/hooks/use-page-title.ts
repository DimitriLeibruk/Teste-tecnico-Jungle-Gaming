import { useEffect } from 'react'

/** Atualiza o título do documento (anunciado por leitores de tela na navegação). */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} | Kurio`
  }, [title])
}
