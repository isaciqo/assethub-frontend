import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, BellRing, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, MovementStatusBadge, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { Input } from '@/components/ui/input';
import { FilterBar, type FilterChip } from '@/components/FilterBar';
import { SectorOptions, sectorsOf } from '@/components/Sectors';
import { useMeta, useMovements, useUnits, useUsers } from '@/hooks/queries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useAuth } from '@/lib/auth-context';
import { MOVEMENT_STATUS } from '@/lib/labels';
import type { MovementStatus } from '@/types';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'waiting_me', label: 'Aguardando você' },
  { id: 'mine', label: 'Minhas' },
  { id: 'all', label: 'Todas' },
] as const;

// Comarca/setor valem para a origem ou o destino; pessoa = quem envia ou quem recebe.
const KEYS = ['situacao', 'tipo', 'comarca', 'setor', 'pessoa', 'de', 'ate'] as const;
type Key = typeof KEYS[number];
const RESETS: Partial<Record<Key, Key[]>> = { comarca: ['setor'] };

const Movimentacoes: React.FC = () => {
  const [scope, setScope] = useState<(typeof TABS)[number]['id']>('waiting_me');
  const { can } = useAuth();
  const { values: f, set, clear } = useUrlFilters(KEYS, RESETS);
  const filtering = KEYS.some(k => f[k]);
  // Com filtro, a busca vale para todas as movimentações (não só "aguardando você").
  const effectiveScope = filtering && scope === 'waiting_me' ? 'all' : scope;
  const { data = [], isLoading } = useMovements({
    scope: effectiveScope,
    status: f.situacao || undefined,
    type: f.tipo || undefined,
    unit_id: f.comarca || undefined,
    location: f.setor || undefined,
    person_id: f.pessoa || undefined,
    from: f.de || undefined,
    to: f.ate || undefined,
  });
  const { data: units = [] } = useUnits();
  const { data: meta } = useMeta();
  const { data: users = [] } = useUsers();
  const unitName = (id: string) => units.find(u => u.id === id)?.name || '';
  const unit = units.find(u => u.id === f.comarca);

  const label: Record<Key, (v: string) => string> = {
    situacao: v => MOVEMENT_STATUS[v as MovementStatus]?.label || v,
    tipo: v => meta?.movementTypes.find(t => t.id === v)?.label || v,
    comarca: v => unitName(v) || v,
    setor: v => v,
    pessoa: v => users.find(u => u.id === v)?.name || 'Pessoa',
    de: v => `desde ${v.split('-').reverse().join('/')}`,
    ate: v => `até ${v.split('-').reverse().join('/')}`,
  };
  const chips: FilterChip[] = KEYS.filter(k => f[k]).map(k => ({ key: k, label: label[k](f[k]), onRemove: () => set(k, '') }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Movimentações"
        subtitle="Transferências, mudanças de responsável e devoluções — com aprovação, envio, recebimento, assinaturas e termo."
        actions={<Button asChild><Link to="/movimentacoes/nova"><Plus /> Nova movimentação</Link></Button>}
      />
      <div className="flex gap-1 rounded-xl border p-1 bg-muted w-full sm:w-fit mb-3">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setScope(t.id)} className={cn('flex-1 sm:flex-none rounded-lg px-4 py-1.5 text-sm font-bold', effectiveScope === t.id ? 'bg-card shadow-card text-primary' : 'text-muted-foreground')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card-clay p-3 mb-4">
        <FilterBar
          primary={(
            <>
              <NativeSelect value={f.situacao} onChange={e => set('situacao', e.target.value)} aria-label="Situação" className="md:w-52">
                <option value="">Todas as situações</option>
                {(Object.keys(MOVEMENT_STATUS) as MovementStatus[]).map(st => <option key={st} value={st}>{MOVEMENT_STATUS[st].label}</option>)}
              </NativeSelect>
              <NativeSelect value={f.comarca} onChange={e => set('comarca', e.target.value)} aria-label="Comarca" className="md:w-52">
                <option value="">Todas as comarcas</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </NativeSelect>
            </>
          )}
          more={(
            <>
              <Field label="Setor (origem ou destino)">
                <NativeSelect value={f.setor} onChange={e => set('setor', e.target.value)} disabled={!unit}>
                  <option value="">{unit ? 'Todos os setores' : 'Escolha a comarca'}</option>
                  <SectorOptions sectors={sectorsOf(unit)} />
                </NativeSelect>
              </Field>
              <Field label="Tipo">
                <NativeSelect value={f.tipo} onChange={e => set('tipo', e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {meta?.movementTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </NativeSelect>
              </Field>
              {can('admin', 'gestor') && (
                <Field label="Pessoa (quem envia ou recebe)">
                  <NativeSelect value={f.pessoa} onChange={e => set('pessoa', e.target.value)}>
                    <option value="">Qualquer pessoa</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </NativeSelect>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="De"><Input type="date" value={f.de} onChange={e => set('de', e.target.value)} /></Field>
                <Field label="Até"><Input type="date" value={f.ate} onChange={e => set('ate', e.target.value)} /></Field>
              </div>
            </>
          )}
          chips={chips}
          onClear={clear}
          summary={filtering ? <strong className="text-foreground tabular">{data.length} movimentação(ões)</strong> : undefined}
        />
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
