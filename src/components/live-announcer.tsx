import { useEffect, useState } from 'react'

/**
 * Regiões ARIA live globais para feedback de mutations e eventos em tempo real.
 * `announce()` pode ser chamado de qualquer lugar (inclusive fora do React).
 */
type Politeness = 'polite' | 'assertive'
type Listener = (message: string, politeness: Politeness) => void

const listeners = new Set<Listener>()

export function announce(message: string, politeness: Politeness = 'polite') {
  listeners.forEach((l) => l(message, politeness))
}

export function LiveAnnouncer() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const listener: Listener = (message, politeness) => {
      const setter = politeness === 'assertive' ? setAssertive : setPolite
      // Limpa e reescreve para que mensagens repetidas sejam anunciadas novamente.
      setter('')
      clearTimeout(timer)
      timer = setTimeout(() => setter(message), 50)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-polite">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}
