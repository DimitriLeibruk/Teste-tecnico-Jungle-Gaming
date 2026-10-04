import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { CatalogSearch } from './search'
import type { UpdateSearch } from './Catalog'

/**
 * Atualiza o estado do catálogo NA URL (fonte única de verdade).
 * Cada mudança cria uma entrada no histórico (voltar/avançar restauram filtros).
 * Mudança de filtro/ordenação reinicia a paginação.
 */
export function useCatalogSearch(from: '/' | '/mercado') {
  const navigate = useNavigate({ from })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const onChange: UpdateSearch = useCallback(
    (patch, { resetPage = true } = {}) => {
      void navigate({
        search: (prev: CatalogSearch) => {
          const next: CatalogSearch = { ...prev, ...patch }
          if (resetPage && !('page' in patch)) next.page = undefined
          return next
        },
        resetScroll: false,
      })
    },
    [navigate],
  )

  return { onChange, mobileFiltersOpen, setMobileFiltersOpen }
}
