import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, ShieldCheck, WifiOff, ScanLine, Briefcase, GraduationCap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo, UrnIllustration } from '@/components/brand/Brand';
import { Field } from '@/components/common';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/components/ui/sonner';
import type { ApiError } from '@/types';

const DEMO_PASSWORD = 'Patrimonio@2026';

const DEMO = [
  { email: 'admin@tjpa.demo', label: 'Administrador', hint: 'Cadastra bens, importa planilhas e decide tudo', icon: ShieldCheck },
  { email: 'gerente@tjpa.demo', label: 'Gerente', hint: 'Abre inventários, aprova e decide pendências', icon: Briefcase },
  { email: 'estagiario@tjpa.demo', label: 'Estagiário', hint: 'Confere os bens em campo e pede movimentações', icon: GraduationCap },
];

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const submit = async (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault();
    setLoading(true);
    setPending(override?.email || null);
    try {
      await login(override?.email || email, override?.password || password);
      navigate((location.state as { from?: string })?.from || '/painel', { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.offline ? 'Sem conexão. O primeiro acesso precisa de internet.' : apiErr.message || 'Não foi possível entrar');
    } finally {
      setLoading(false);
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-background">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground p-12 motif-field" style={{ ['--motif' as string]: '36 30% 84%', ['--motif-opacity' as string]: 0.05 }}>
        <div className="absolute inset-x-0 top-0 motif-band" />
        <Logo light />
        <div className="relative z-10 max-w-lg">
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] text-white">
            Cada bem no seu lugar.<br /><span className="text-sidebar-primary">Cada passo registrado.</span>
          </h1>
          <p className="mt-5 text-sidebar-foreground/75 leading-relaxed">
            Inventário patrimonial do TJPA pelo celular: aponte a câmera, confira em segundos, trabalhe sem internet
            nas comarcas do interior e mantenha a trilha auditável de cada entrega e recebimento.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              [ScanLine, 'QR Code, código de barras ou leitura da plaqueta'],
              [WifiOff, 'Conferência 100% offline, sincroniza depois sem duplicar'],
              [ShieldCheck, 'Termos com assinatura, fotos e cadeia de hash verificável'],
            ].map(([Icon, text]) => {
              const I = Icon as React.ElementType;
              return (
                <li key={text as string} className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-sidebar-primary/15 text-sidebar-primary grid place-items-center"><I className="h-4 w-4" /></span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-[11px] text-sidebar-foreground/45 max-w-md">
          Identidade visual inspirada nos grafismos da cerâmica marajoara e tapajônica — patrimônio cultural do Pará.
          Dados de demonstração 100% sintéticos.
        </p>
        <UrnIllustration className="absolute -right-10 bottom-10 w-[300px] opacity-95 drop-shadow-2xl" />
      </section>

      <section className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="lg:hidden mb-8"><Logo /></div>
        <div className="w-full max-w-sm mx-auto">
          <h2 className="font-display text-3xl font-bold">Entrar como</h2>
          <p className="text-sm text-muted-foreground mt-1">Toque em um perfil para entrar.</p>

          <div className="mt-8 space-y-3">
            {DEMO.map(d => {
              const Icon = d.icon;
              return (
                <button
                  key={d.email}
                  type="button"
                  disabled={loading}
                  onClick={() => submit(undefined, { email: d.email, password: DEMO_PASSWORD })}
                  className="group w-full flex items-center gap-4 text-left rounded-2xl border bg-card p-4 hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors disabled:opacity-60"
                >
                  <span className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    {pending === d.email ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-bold">{d.label}</span>
                    <span className="block text-xs text-muted-foreground">{d.hint}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </button>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <button type="button" onClick={() => setShowForm(v => !v)} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              {showForm ? 'Esconder' : 'Entrar com e-mail e senha'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <Field label="E-mail" htmlFor="email">
                <Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl" />
              </Field>
              <Field label="Senha" htmlFor="password">
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl" />
              </Field>
              <Button type="submit" size="xl" className="w-full" disabled={loading}>
                {loading && !pending ? <Loader2 className="animate-spin" /> : <LogIn />} Entrar
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

export default Login;
