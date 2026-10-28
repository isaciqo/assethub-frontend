import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Boxes, ClipboardCheck, CloudOff, LayoutDashboard, LogOut, Menu, Moon, QrCode, RefreshCw,
  ScanLine, Sun, TriangleAlert, Upload,
} from 'lucide-react';
import { Logo } from '@/components/brand/Brand';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import { useOnline, useSyncState } from '@/offline/hooks';
import { syncNow } from '@/offline/sync';

const NAV = [
  { to: '/painel', label: 'Painel', icon: LayoutDashboard },
  { to: '/inventarios', label: 'Inventários', icon: ClipboardCheck },
  { to: '/conferir', label: 'Conferir', icon: ScanLine },
  { to: '/pendencias', label: 'Pendências', icon: TriangleAlert },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/bens', label: 'Bens', icon: Boxes },
  { to: '/importar', label: 'Importar planilha', icon: Upload, roles: ['admin', 'gestor'] },
  { to: '/etiquetas', label: 'Etiquetas QR', icon: QrCode },
  { to: '/sincronizacao', label: 'Sincronização', icon: RefreshCw },
] as const;

const MOBILE = ['/painel', '/inventarios', '/conferir', '/pendencias'];

const SyncPill: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const online = useOnline();
  const sync = useSyncState();
  const pending = sync.counts.pending + sync.counts.failed;
  const navigate = useNavigate();
  return (
    <button
      onClick={() => (online ? syncNow() : navigate('/sincronizacao'))}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
        !online ? 'bg-warning/20 text-warning' : pending ? 'bg-info/15 text-info' : 'bg-success/15 text-success',
      )}
      title={online ? 'Sincronizar agora' : 'Sem conexão'}
    >
      {!online ? <CloudOff className="h-3.5 w-3.5" /> : <RefreshCw className={cn('h-3.5 w-3.5', sync.syncing && 'animate-spin')} />}
      {!compact && (!online ? 'Offline' : sync.syncing ? 'Sincronizando' : pending ? `${pending} a enviar` : 'Sincronizado')}
      {compact && pending > 0 && <span className="tabular">{pending}</span>}
    </button>
  );
};

export const AppLayout: React.FC = () => {
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const online = useOnline();
  const sync = useSyncState();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  const items = NAV.filter(i => !('roles' in i) || can(...(i.roles as unknown as ('admin' | 'gestor')[])));

  const Sidebar = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground motif-field" style={{ ['--motif' as string]: '36 30% 84%', ['--motif-opacity' as string]: 0.035 }}>
      <div className="motif-band opacity-90" />
      <div className="px-5 pt-5 pb-4"><Logo light /></div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Navegação principal">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
              isActive ? 'bg-sidebar-primary/15 text-white' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-sidebar-primary')} />
                {item.label}
                {item.to === '/sincronizacao' && sync.counts.pending + sync.counts.failed > 0 && (
                  <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 text-[10px] font-bold text-sidebar tabular">{sync.counts.pending + sync.counts.failed}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent">
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        </button>
        {user && (
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-2.5">
            <div className="h-9 w-9 shrink-0 rounded-full bg-sidebar-primary/25 text-sidebar-primary grid place-items-center text-xs font-bold">{initials(user.name)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/50">{ROLE_LABEL[user.role]}{user.unit ? ` · ${user.unit.code}` : ''}</p>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-sidebar-foreground/50 hover:text-white" title="Sair" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const pending = sync.counts.pending + sync.counts.failed;
  const isScanPage = location.pathname.startsWith('/conferir');

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen no-print"><Sidebar /></aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72 border-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        {!online && (
          <div className="bg-warning text-warning-foreground text-xs font-semibold px-4 py-2 flex items-center gap-2 no-print" role="status">
            <CloudOff className="h-4 w-4 shrink-0" />
            Você está offline. As conferências ficam salvas neste aparelho{pending ? ` (${pending} aguardando envio)` : ''} e serão enviadas quando a conexão voltar.
          </div>
        )}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/90 backdrop-blur px-4 h-14 no-print">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="h-10 w-10 -ml-2 grid place-items-center"><Menu className="h-5 w-5" /></button>
          <Logo size={30} subtitle={false} />
          <SyncPill compact />
        </header>
        <div className="hidden lg:flex justify-end px-8 pt-5 no-print"><SyncPill /></div>

        <main className={cn('flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-4 pb-28 lg:pb-10', isScanPage ? 'max-w-3xl' : 'max-w-7xl')}>
          <Outlet />
        </main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur pb-safe no-print" aria-label="Navegação rápida">
          <div className="grid grid-cols-5 h-16">
            {MOBILE.slice(0, 2).map(to => <MobileItem key={to} to={to} />)}
            <NavLink to="/conferir" className="relative -mt-6 flex flex-col items-center" aria-label="Conferir bens">
              <span className="h-14 w-14 rounded-2xl bg-urucum text-primary-foreground grid place-items-center shadow-elevated ring-4 ring-background">
                <ScanLine className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-bold mt-1 text-foreground">Conferir</span>
            </NavLink>
            <MobileItem to="/pendencias" />
            <MobileItem to="/movimentacoes" />
          </div>
        </nav>
      </div>
    </div>
  );
};

const MobileItem: React.FC<{ to: string }> = ({ to }) => {
  const item = NAV.find(n => n.to === to)!;
  return (
    <NavLink to={to} className={({ isActive }) => cn('flex flex-col items-center justify-center gap-1 text-[10px] font-bold', isActive ? 'text-primary' : 'text-muted-foreground')}>
      <item.icon className="h-5 w-5" />
      {item.label === 'Movimentações' ? 'Movim.' : item.label}
    </NavLink>
  );
};
