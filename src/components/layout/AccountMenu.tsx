import { useNavigate } from '@tanstack/react-router'
import { Heart, History, LogOut, User, Wallet } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { logout } from '@/features/session/session-actions'
import { useSession } from '@/features/session/session-store'
import { Avatar } from './Avatar'

/** Menu da conta (carregado sob demanda: só existe com sessão ativa). */
export default function AccountMenu() {
  const { user } = useSession()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary" aria-label={`Menu da conta de ${user.displayName}`}>
        <Avatar user={user} size={32} />
        <span className="hidden max-w-32 truncate text-sm lg:inline">{user.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void navigate({ to: '/conta/perfil' })}>
          <User aria-hidden /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: '/conta/carteiras' })}>
          <Wallet aria-hidden /> Carteiras
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: '/conta/favoritos' })}>
          <Heart aria-hidden /> Lista de interesse
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate({ to: '/conta/atividade' })}>
          <History aria-hidden /> Atividade
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout()
            void navigate({ to: '/' })
          }}
        >
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
