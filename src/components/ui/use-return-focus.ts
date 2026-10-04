import { useRef } from 'react'

type AutoFocusHandler = (event: Event) => void

/**
 * Devolve o foco ao elemento que estava focado quando o diálogo abriu.
 * O Radix só faz isso automaticamente quando há um <Trigger>; aqui vários
 * diálogos são abertos por estado (ex.: modal de login), então registramos o
 * elemento de origem no `onOpenAutoFocus` e o restauramos no `onCloseAutoFocus`.
 */
export function useReturnFocus(onOpenAutoFocus?: AutoFocusHandler, onCloseAutoFocus?: AutoFocusHandler) {
  const origin = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement
      origin.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const target = origin.current
      if (target && target.isConnected) {
        event.preventDefault()
        target.focus({ preventScroll: true })
      }
    },
  }
}
