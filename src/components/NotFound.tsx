import { Link } from '@tanstack/react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/use-page-title'

export function NotFound({ title = 'Página não encontrada', description }: { title?: string; description?: string }) {
  usePageTitle(title)
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <Compass className="size-12 text-primary" aria-hidden />
      <p className="text-sm text-primary">Erro 404</p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description ?? 'O endereço acessado não existe ou foi movido. Que tal explorar o mercado?'}</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/mercado">Explorar o mercado</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Ir para o início</Link>
        </Button>
      </div>
    </section>
  )
}
