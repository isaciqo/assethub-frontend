import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, BellRing, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, MovementStatusBadge, PageHeader, Spinner } from '@/components/common';
import { useMovements, useUnits } from '@/hooks/queries';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'waiting_me', label: 'Aguardando você' },
  { id: 'mine', label: 'Minhas' },
  { id: 'all', label: 'Todas' },
] as const;

const Movimentacoes: React.FC = () => {
  const [scope, setScope] = useState<(typeof TABS)[number]['id']>('waiting_me');
  const { data = [], isLoading } = useMovements({ scope });
  const { data: units = [] } = useUnits();
  const unitName = (id: string) => units.find(u => u.id === id)?.name || '';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Movimentações"
        subtitle="Transferências, mudanças de responsável e devoluções — com aprovação, envio, recebimento, assinaturas e termo."
        actions={<Button asChild><Link to="/movimentacoes/nova"><Plus /> Nova movimentação</Link></Button>}
      />
      <div className="flex gap-1 rounded-xl border p-1 bg-muted w-full sm:w-fit mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setScope(t.id)} className={cn('flex-1 sm:flex-none rounded-lg px-4 py-1.5 text-sm font-bold', scope === t.id ? 'bg-card shadow-card text-primary' : 'text-muted-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : data.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={scope === 'waiting_me' ? 'Nada aguardando você' : 'Nenhuma movimentação'} description="Quando uma movimentação precisar da sua aprovação, envio ou recebimento, ela aparece aqui." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.map(m => (
            <Link key={m.id} to={`/movimentacoes/${m.id}`} className={cn('card-clay p-4 hover:shadow-elevated transition-shadow', m.waitingOnMe && 'ring-2 ring-urucum/50')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-urucum">{m.number}</span>
                <MovementStatusBadge value={m.status} />
                {m.waitingOnMe && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-urucum"><BellRing className="h-3 w-3" /> sua vez</span>}
                <span className="ml-auto text-[11px] text-muted-foreground">{fmtRelative(m.createdAt)}</span>
              </div>
              <div className="font-display font-bold mt-1.5">{m.typeLabel}</div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <span className="truncate">{unitName(m.origin.unitId)}{m.origin.location ? ` · ${m.origin.location}` : ''}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-urucum" />
                <span className="truncate font-semibold">{unitName(m.destination.unitId)}{m.destination.location ? ` · ${m.destination.location}` : ''}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 truncate">
                {m.assetsPreview?.map(a => `${a.code} ${a.description}`).join(' · ')}{m.assetIds.length > 3 ? ` +${m.assetIds.length - 3}` : ''}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Movimentacoes;
