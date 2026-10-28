import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { http } from '@/services/http';
import { ASSET_STATUS, CHECK_STATUS, CONSERVATION, DISCREPANCY, MOVEMENT_STATUS } from '@/lib/labels';
import type { AssetStatus, CheckStatus, Conservation, DiscrepancyType, MovementStatus } from '@/types';
import { MotifDivider } from './brand/Brand';

export const PageHeader: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }> = ({ title, subtitle, actions, eyebrow }) => (
  <div className="mb-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-urucum mb-1">{eyebrow}</div>}
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
    <MotifDivider className="mt-4 opacity-70" />
  </div>
);

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className, label = 'Carregando…' }) => (
  <div className={cn('flex items-center justify-center gap-2 py-12 text-muted-foreground', className)} role="status">
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
    <span className="text-sm">{label}</span>
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ElementType; title: string; description?: React.ReactNode; action?: React.ReactNode }> = ({ icon: Icon, title, description, action }) => (
  <div className="card-clay motif-field flex flex-col items-center text-center px-6 py-12" style={{ ['--motif-opacity' as string]: 0.05 }}>
    {Icon && <div className="h-12 w-12 rounded-2xl bg-secondary text-primary grid place-items-center mb-3"><Icon className="h-6 w-6" /></div>}
    <h3 className="font-display text-lg font-bold">{title}</h3>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ElementType; tone?: 'clay' | 'ok' | 'warn' | 'danger' | 'info'; className?: string }> = ({ label, value, hint, icon: Icon, tone = 'clay', className }) => {
  const toneCls = { clay: 'bg-primary/10 text-primary', ok: 'bg-success/12 text-success', warn: 'bg-warning/15 text-warning', danger: 'bg-destructive/10 text-destructive', info: 'bg-info/12 text-info' }[tone];
  return (
    <div className={cn('card-clay corner-steps p-4 sm:p-5', className)}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {Icon && <span className={cn('h-7 w-7 rounded-lg grid place-items-center', toneCls)}><Icon className="h-4 w-4" /></span>}
        {label}
      </div>
      <div className="font-display text-3xl font-extrabold mt-2 tabular text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
};

export const ConservationBadge = ({ value }: { value: Conservation }) => <Badge variant={CONSERVATION[value]?.variant}>{CONSERVATION[value]?.label || value}</Badge>;
export const AssetStatusBadge = ({ value }: { value: AssetStatus }) => <Badge variant={ASSET_STATUS[value]?.variant}>{ASSET_STATUS[value]?.label || value}</Badge>;
export const CheckStatusBadge = ({ value }: { value: CheckStatus }) => <Badge variant={CHECK_STATUS[value]?.variant}>{CHECK_STATUS[value]?.label || value}</Badge>;
export const DiscrepancyBadge = ({ value }: { value: DiscrepancyType }) => <Badge variant={DISCREPANCY[value]?.variant}>{DISCREPANCY[value]?.label || value}</Badge>;
export const MovementStatusBadge = ({ value }: { value: MovementStatus }) => <Badge variant={MOVEMENT_STATUS[value]?.variant}>{MOVEMENT_STATUS[value]?.label || value}</Badge>;

// Imagem protegida (precisa do Bearer): baixa como Blob e mostra via object URL.
export const EvidenceImage: React.FC<{ id: string; alt: string; className?: string }> = ({ id, alt, className }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    http.blob(`/evidences/${id}`)
      .then(({ blob }) => { if (!alive) return; url = URL.createObjectURL(blob); setSrc(url); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  if (failed) return <div className={cn('grid place-items-center bg-muted text-xs text-muted-foreground', className)}>indisponível offline</div>;
  if (!src) return <div className={cn('animate-pulse bg-muted', className)} />;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={alt} className={cn('object-cover', className)} />
    </a>
  );
};

// Barra horizontal de série única (cobertura por unidade, pendências por tipo).
// Uma cor só (argila); o rótulo fica em cor de texto; tooltip nativo por barra.
export const BarList: React.FC<{ rows: { label: string; value: number; max?: number; display?: string; hint?: string }[]; suffix?: string }> = ({ rows, suffix = '' }) => {
  const max = Math.max(1, ...rows.map(r => r.max ?? r.value));
  return (
    <ul className="space-y-3">
      {rows.map(r => {
        const pct = Math.round(((r.value) / (r.max ?? max)) * 100);
        return (
          <li key={r.label} title={r.hint || `${r.label}: ${r.display ?? r.value}${suffix}`} className="group">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-foreground font-medium">{r.label}</span>
              <span className="tabular text-muted-foreground text-xs font-semibold shrink-0">{r.display ?? r.value}{suffix}</span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-700 group-hover:bg-urucum" style={{ width: `${Math.max(pct, r.value ? 2 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string; htmlFor?: string }> = ({ label, children, hint, className, htmlFor }) => (
  <div className={cn('space-y-1.5', className)}>
    <label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const NativeSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select
    className={cn('flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)}
    {...props}
  >
    {children}
  </select>
);
