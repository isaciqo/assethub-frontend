import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, Field, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { VaseProgress } from '@/components/brand/Brand';
import { useInventories, useUnits } from '@/hooks/queries';
import { inventoriesService } from '@/services/api';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import { groupSectors, sectorsOf } from '@/components/Sectors';
import type { ApiError } from '@/types';

const Inventarios: React.FC = () => {
  const { can, user } = useAuth();
  const { data, isLoading } = useInventories();
  const { data: units = [] } = useUnits();
  const [open, setOpen] = useState(false);
  const unitName = (id: string) => units.find(u => u.id === id)?.name || '';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inventários"
        subtitle="Da comarca inteira ou de uma vara, gabinete ou secretaria. A lista de bens previstos fica congelada e várias pessoas conferem ao mesmo tempo."
        actions={can('admin', 'gestor') && <Button onClick={() => setOpen(true)}><Plus /> Abrir inventário</Button>}
      />
      {isLoading ? <Spinner /> : !data?.length ? (
        <EmptyState icon={ClipboardCheck} title="Nenhum inventário ainda" description="Abra o primeiro inventário de uma comarca ou de um setor para começar a conferência." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map(inv => (
            <Link key={inv.id} to={`/inventarios/${inv.id}`} className="card-clay p-5 flex gap-4 hover:shadow-elevated transition-shadow">
              <VaseProgress value={inv.summary?.progress ?? 0} size={92} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-urucum">{inv.number}</span>
                  <Badge variant={inv.status === 'em_andamento' ? 'info' : 'ok'}>{inv.status === 'em_andamento' ? 'Em andamento' : 'Concluído'}</Badge>
                </div>
                <div className="font-display font-bold leading-tight mt-1">{inv.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{unitName(inv.unitId)} · {inv.locations.length ? `${inv.locations.length} setor(es)` : 'comarca inteira'}</div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted py-1.5"><dt className="text-[10px] text-muted-foreground">Previstos</dt><dd className="font-bold tabular">{inv.summary?.expected}</dd></div>
                  <div className="rounded-lg bg-muted py-1.5"><dt className="text-[10px] text-muted-foreground">Conferidos</dt><dd className="font-bold tabular">{inv.summary?.checked}</dd></div>
                  <div className="rounded-lg bg-muted py-1.5"><dt className="text-[10px] text-muted-foreground">Pendências</dt><dd className="font-bold tabular">{inv.summary?.openDiscrepancies}</dd></div>
                </dl>
                <div className="text-[11px] text-muted-foreground mt-2">Aberto em {fmtDate(inv.startedAt)}{inv.completedAt ? ` · encerrado em ${fmtDate(inv.completedAt)}` : ''}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <NewInventoryDialog open={open} onOpenChange={setOpen} defaultUnit={user?.unitId || ''} />
    </div>
  );
};

const NewInventoryDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void; defaultUnit: string }> = ({ open, onOpenChange, defaultUnit }) => {
  const { data: units = [] } = useUnits();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [unitId, setUnitId] = useState(defaultUnit);
  const [name, setName] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const unit = units.find(u => u.id === unitId);
  const sectors = sectorsOf(unit);
  const year = new Date().getFullYear();
  const suggested = unit ? `Inventário ${year} — ${locations.length === 1 ? `${locations[0]} · ` : ''}${unit.name}` : '';

  const create = useMutation({
    mutationFn: () => inventoriesService.create({ unit_id: unitId, name: name || undefined, locations }),
    onSuccess: inv => {
      qc.invalidateQueries({ queryKey: ['inventories'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${inv.number} aberto com ${inv.expectedCount} bens previstos`);
      onOpenChange(false);
      navigate(`/inventarios/${inv.id}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Abrir inventário</DialogTitle>
          <DialogDescription>A lista de bens previstos é congelada agora — bens importados depois não alteram este inventário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Comarca">
            <NativeSelect value={unitId} onChange={e => { setUnitId(e.target.value); setLocations([]); }}>
              <option value="">Selecione…</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.assetCount} bens)</option>)}
            </NativeSelect>
          </Field>
          {unit && sectors.length > 0 && (
            <Field label="O que inventariar" hint={locations.length ? `${locations.length} setor(es) escolhido(s)` : 'Nenhum setor marcado = a comarca inteira.'}>
              <div className="flex gap-1.5 mb-2">
                <button type="button" onClick={() => setLocations([])}
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${!locations.length ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
                  Comarca inteira
                </button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {groupSectors(sectors).map(g => (
                  <div key={g.kind}>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{g.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map(({ name: l }) => {
                        const on = locations.includes(l);
                        return (
                          <button key={l} type="button" onClick={() => setLocations(on ? locations.filter(x => x !== l) : [...locations, l])}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          )}
          <Field label="Nome (opcional)">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={unit ? suggested : ''} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!unitId || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="animate-spin" />} Abrir inventário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Inventarios;
