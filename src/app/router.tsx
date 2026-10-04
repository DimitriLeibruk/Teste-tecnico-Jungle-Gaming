import { createRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { routeTree } from '@/routeTree.gen'
import { NotFound } from '@/components/NotFound'

const stringifySearch = stringifySearchWith(JSON.stringify)

export interface RouterContext {
  queryClient: QueryClient
  /** Resolve quando a sessão persistida foi validada com a API. */
  sessionReady: Promise<void>
}

export function createAppRouter(queryClient: QueryClient, sessionReady: Promise<void>) {
  return createRouter({
    routeTree,
    context: { queryClient, sessionReady },
    defaultPreload: 'intent',
    // O cache do TanStack Query controla a validade dos dados pré-carregados.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: () => <NotFound />,
    // Parâmetros de busca legíveis: valores sempre string na URL; tipos via Zod.
    parseSearch: parseSearchWith((value) => value),
    // Vírgulas são válidas na query string: mantém listas legíveis (?categories=musica,arte-3d).
    stringifySearch: (search) => stringifySearch(search).replace(/%2C/gi, ','),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
  interface StaticDataRouteOption {
    /** Exibe a barra de navegação inferior no mobile (padrão: true). */
    mobileNav?: boolean
    /** Exibe o rodapé (padrão: true). */
    footer?: boolean
  }
}
