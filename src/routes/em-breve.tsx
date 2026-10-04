import { createFileRoute, Link } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

const SECTIONS: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  colecao: 'Minha coleção',
  estudio: 'Estúdio do criador',
  ajuda: 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  seguranca: 'Carteira e segurança',
  politica: 'Política do mercado',
  denuncia: 'Denunciar item',
  diario: 'Diário da Cunhagem',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
  suporte: 'Suporte',
}

/**
 * Seções editoriais/auxiliares fora do escopo da entrega.
 * Comunica isso com clareza em vez de simular sucesso.
 */
export const Route = createFileRoute('/em-breve')({
  validateSearch: z.object({ secao: z.string().optional().catch(undefined) }),
  component: ComingSoon,
})

function ComingSoon() {
  const { secao } = Route.useSearch()
  const name = (secao && SECTIONS[secao]) || 'Esta seção'
  usePageTitle(name)
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <Construction className="size-12 text-primary" aria-hidden />
      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="max-w-lg text-muted-foreground">
        Esta área não faz parte desta versão de demonstração do marketplace. Os fluxos disponíveis são descoberta, compra e conta do colecionador.
      </p>
      <Button asChild>
        <Link to="/mercado">Explorar o mercado</Link>
      </Button>
    </section>
  )
}
