import React from 'react';
import { cn } from '@/lib/utils';

// Marca: espiral quadrada ("grega") — um dos motivos mais recorrentes da
// cerâmica marajoara. Lê-se também como um caminho que se fecha: o bem que é
// encontrado, conferido e volta ao registro.
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 36, className }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="hsl(var(--primary))" />
    <path d="M9 31V9h22v18H15V15h10v6h-4" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3.2" strokeLinecap="square" />
    <rect x="27" y="29" width="4" height="4" fill="hsl(var(--ochre))" />
  </svg>
);

export const Logo: React.FC<{ className?: string; size?: number; subtitle?: boolean; light?: boolean }> = ({ className, size = 36, subtitle = true, light }) => (
  <div className={cn('flex items-center gap-2.5', className)}>
    <LogoMark size={size} />
    <div className="leading-none">
      <div className={cn('font-display font-bold text-[1.05rem] tracking-tight', light ? 'text-sidebar-foreground' : 'text-foreground')}>
        Erekoara
      </div>
      {subtitle && (
        <div className={cn('text-[10px] font-semibold uppercase tracking-[0.18em] mt-1', light ? 'text-sidebar-foreground/50' : 'text-muted-foreground')}>
          TJPA · Inventário
        </div>
      )}
    </div>
  </div>
);

// Silhueta de igaçaba (urna marajoara) usada no indicador de progresso.
const URN_PATH = 'M36 6h48v8c0 4 6 6 6 12 0 8-14 10-14 16 0 6 22 14 22 40 0 22-16 34-38 34S22 104 22 82c0-26 22-34 22-40 0-6-14-8-14-16 0-6 6-8 6-12z';

// Progresso como uma urna sendo "pintada" de baixo para cima. O desenho dos
// frisos aparece sobre o barro conforme os bens são conferidos.
export const VaseProgress: React.FC<{ value: number; size?: number; label?: string; className?: string }> = ({ value, size = 150, label, className }) => {
  const id = React.useId().replace(/:/g, '');
  const pct = Math.max(0, Math.min(100, value));
  const top = 6;
  const bottom = 116;
  const fillY = bottom - ((bottom - top) * pct) / 100;
  return (
    <div className={cn('relative inline-flex flex-col items-center', className)} role="img" aria-label={`${pct}% conferido`}>
      <svg width={size * 0.86} height={size} viewBox="0 0 120 122">
        <defs>
          <clipPath id={`urn-${id}`}><path d={URN_PATH} /></clipPath>
          <pattern id={`motif-${id}`} width="16" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 11h4V7h4V3h4v4h4" fill="none" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.55" strokeWidth="1.6" />
          </pattern>
        </defs>
        <path d={URN_PATH} fill="hsl(var(--muted))" stroke="hsl(var(--primary) / 0.35)" strokeWidth="1.5" />
        <g clipPath={`url(#urn-${id})`}>
          <rect x="0" y={fillY} width="120" height={122 - fillY} fill="hsl(var(--primary))" style={{ transition: 'y .8s ease, height .8s ease' }} />
          <rect x="0" y={fillY} width="120" height={122 - fillY} fill={`url(#motif-${id})`} style={{ transition: 'y .8s ease, height .8s ease' }} />
          <rect x="0" y={fillY - 1} width="120" height="3" fill="hsl(var(--urucum))" style={{ transition: 'y .8s ease' }} />
        </g>
        <path d="M44 42h32M30 72h60" stroke="hsl(var(--ochre))" strokeWidth="2" strokeDasharray="4 3" opacity="0.6" />
      </svg>
      {/* Pastilha de caulim: o número continua legível sobre o grafismo. */}
      <div className="absolute inset-x-0 top-[50%] -translate-y-1/2 flex justify-center">
        <div className="rounded-xl bg-card/95 shadow-card text-center" style={{ padding: `${Math.max(2, size * 0.025)}px ${Math.max(5, size * 0.05)}px` }}>
          <div className="font-display font-extrabold tabular leading-none text-foreground" style={{ fontSize: Math.max(12, size * 0.17) }}>
            {pct}%
          </div>
          {label && size >= 120 && <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{label}</div>}
        </div>
      </div>
    </div>
  );
};

export const MotifDivider: React.FC<{ className?: string }> = ({ className }) => <div className={cn('motif-steps w-full', className)} aria-hidden="true" />;

// Ilustração do login: urna com faixas de grafismo (frisos, losangos, espirais).
export const UrnIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 240 300" className={className} aria-hidden="true">
    <defs>
      <clipPath id="urn-ill"><path d="M72 14h96v18c0 8 12 12 12 24 0 16-28 20-28 32 0 12 44 28 44 80 0 44-32 70-76 70S44 212 44 168c0-52 44-68 44-80 0-12-28-16-28-32 0-12 12-16 12-24z" /></clipPath>
      <pattern id="ill-steps" width="24" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 15h6V9h6V3h6v6h6" fill="none" stroke="hsl(var(--sidebar-background))" strokeWidth="2.4" />
      </pattern>
      <pattern id="ill-diamond" width="22" height="22" patternUnits="userSpaceOnUse">
        <path d="M11 1l10 10-10 10L1 11z M11 6l5 5-5 5-5-5z" fill="none" stroke="hsl(var(--sidebar-background))" strokeWidth="1.8" />
      </pattern>
      <pattern id="ill-spiral" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M3 31V3h28v24H9V9h16v12h-8" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.4" />
      </pattern>
    </defs>
    <ellipse cx="120" cy="284" rx="78" ry="9" fill="hsl(var(--sidebar-background) / 0.25)" />
    <g clipPath="url(#urn-ill)">
      <rect width="240" height="300" fill="hsl(38 45% 88%)" />
      <rect y="14" width="240" height="40" fill="hsl(var(--primary))" />
      <rect y="14" width="240" height="40" fill="url(#ill-steps)" opacity="0.55" />
      <rect y="96" width="240" height="64" fill="url(#ill-spiral)" />
      <rect y="160" width="240" height="10" fill="hsl(var(--sidebar-background))" />
      <rect y="170" width="240" height="56" fill="hsl(var(--urucum))" />
      <rect y="170" width="240" height="56" fill="url(#ill-diamond)" opacity="0.6" />
      <rect y="226" width="240" height="10" fill="hsl(var(--sidebar-background))" />
      <rect y="236" width="240" height="60" fill="hsl(var(--primary))" />
    </g>
    {/* rosto estilizado, como nas urnas antropomorfas */}
    <path d="M98 70h14v6H98zM128 70h14v6h-14zM114 82h12v14h-12z" fill="hsl(var(--sidebar-background))" opacity="0.85" />
  </svg>
);
