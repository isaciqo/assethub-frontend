import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Logo } from '@/components/brand/Brand';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';

// Casca do perfil servidor: sem menu lateral — a pessoa só tem uma tela.
export const ServidorLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="motif-band" />
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 h-16">
          <Logo size={32} subtitle={false} />
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="h-10 w-10 grid place-items-center rounded-xl hover:bg-accent" aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user && (
              <div className="hidden sm:flex items-center gap-2 pl-2">
                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">{initials(user.name)}</div>
                <div className="leading-tight">
                  <p className="text-sm font-bold">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</p>
                </div>
              </div>
            )}
            <button onClick={() => { logout(); navigate('/login'); }} className="h-10 w-10 grid place-items-center rounded-xl hover:bg-accent" title="Sair" aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
};
