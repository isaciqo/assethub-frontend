import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DiscrepancyBadge, EmptyState, EvidenceImage, Field, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { useDiscrepancies, useInventories, useMeta, useUnits } from '@/hooks/queries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar, type FilterChip } from '@/components/FilterBar';
import { SectorOptions, sectorsOf } from '@/components/Sectors';
import { discrepanciesService } from '@/services/api';
import { useAuth } from '@/lib/auth-context';
import { CONSERVATION, DISCREPANCY, DISCREPANCY_ACTION } from '@/lib/labels';
import { fmtDateTime } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError, Discrepancy, DiscrepancyAction, DiscrepancyType } from '@/types';

const NOTE_REQUIRED: DiscrepancyAction[] = ['manter_cadastro', 'descartar', 'localizado_depois', 'marcar_nao_localizado'];

// "O que diz o cadastro × o que foi visto" em linguagem simples.
function Comparison({ d, unitName }: { d: Discrepancy; unitName: (id: string) => string }) {
  const e = d.expected || {};
  const o = d.observed || {};
  const row = (label: string, a?: string, b?: string) => (
    <div className="grid grid-cols-[90px_1fr_16px_1fr] items-center gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate rounded-lg bg-muted px-2 py-1">{a || '—'}</span>
      <ArrowRight className="h-3.5 w-3.5 text-urucum" />
      <span className="truncate rounded-lg bg-urucum/10 px-2 py-1 font-semibold">{b || '—'}</span>
    </div>
  );
  switch (d.type) {
    case 'localizacao_divergente': return row('Setor', e.location, o.location);
    case 'outra_unidade': return <>{row('Comarca', unitName(e.unit_id), unitName(o.unit_id))}{row('Setor', e.location, o.location)}</>;
    case 'estado_alterado': return row('Estado', CONSERVATION[e.condition as keyof typeof CONSERVATION]?.label, CONSERVATION[o.condition as keyof typeof CONSERVATION]?.label);
    case 'responsavel_divergente': return row('Responsável', e.responsible_name, o.responsible_name);
    case 'nao_localizado': return <p className="text-sm">Previsto em <strong>{e.location || '—'}</strong>{e.responsible_name ? <> · responsável {e.responsible_name}</> : null}. Não foi encontrado até o encerramento.</p>;
    case 'nao_cadastrado': return <p className="text-sm">Encontrado em <strong>{o.location || '—'}</strong>{o.description ? <>: “{o.description}”</> : null}.</p>;
    case 'conferencia_duplicada': return <>{row('Conferido por', e.checked_by_name, o.checked_by_name)}{row('Quando', fmtDateTime(e.checked_at), fmtDateTime(o.checked_at))}{row('Setor', e.location, o.location)}</>;
    default: return null;
  }
}

// Filtros na URL — o painel abre direto em "?tipo=estado_alterado", por exemplo.
const KEYS = ['situacao', 'tipo', 'comarca', 'setor', 'origem', 'inventario'] as const;
type Key = typeof KEYS[number];
const RESETS: Partial<Record<Key, Key[]>> = { comarca: ['setor'] };
const ORIGIN: Record<string, string> = { inventario: 'Inventário', validacao: 'Validação do servidor' };

const Pendencias: React.FC = () => {
  const { values: f, set, clear } = useUrlFilters(KEYS, RESETS);
  const inventoryId = f.inventario;
  const status = (f.situacao || 'aberta') as 'aberta' | 'resolvida';
  const type = f.tipo;
  const { data: inventories = [] } = useInventories();
  const { data: units = [] } = useUnits();
  const { data: meta } = useMeta();
  const { data = [], isLoading } = useDiscrepancies({
    inventory_id: inventoryId || undefined,
    status,
    type: type || undefined,
    unit_id: f.comarca || undefined,
    location: f.setor || undefined,
    source: f.origem || undefined,
  });
  const unit = units.find(u => u.id === f.comarca);
  const { can } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{ ids: string[]; action: DiscrepancyAction; type: DiscrepancyType; discrepancy?: Discrepancy } | null>(null);
  const [note, setNote] = useState('');
  const [desc, setDesc] = useState('');

  const unitName = (id: string) => units.find(u => u.id === id)?.name || '—';
  const canDecide = can('admin', 'gestor');

  // Trocar qualquer filtro desfaz a seleção em lote.
  useEffect(() => { setSelected([]); }, [inventoryId, status, type, f.comarca, f.setor, f.origem]);

  const label: Record<Key, (v: string) => string> = {
    situacao: v => (v === 'resolvida' ? 'Resolvidas' : 'Abertas'),
    tipo: v => DISCREPANCY[v as DiscrepancyType]?.label || v,
    comarca: v => unitName(v),
    setor: v => v,
    origem: v => ORIGIN[v] || v,
    inventario: v => inventories.find(i => i.id === v)?.number || 'Inventário',
  };
  const chips: FilterChip[] = KEYS.filter(k => f[k]).map(k => ({ key: k, label: label[k](f[k]), onRemove: () => set(k, '') }));

  const counts = useMemo(() => data.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.type]: (acc[d.type] || 0) + 1 }), {}), [data]);

  const resolve = useMutation({
    mutationFn: async () => {
      if (!pending) return null;
      if (pending.ids.length === 1) {
        await discrepanciesService.resolve(pending.ids[0], { action: pending.action, note, data: pending.action === 'cadastrar_bem' && desc ? { description: desc } : undefined });
        return { resolved: 1, failed: [] };
      }
      return discrepanciesService.bulkResolve({ ids: pending.ids, action: pending.action, note });
    },
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['discrepancies'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`${r?.resolved} pendência(s) resolvida(s)`, r?.failed.length ? { description: `${r.failed.length} não puderam ser resolvidas` } : undefined);
      setPending(null); setNote(''); setDesc(''); setSelected([]);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const act = (d: Discrepancy, action: DiscrepancyAction) => {
    if (action === 'abrir_movimentacao') {
      const o = d.observed || {};
      const q = new URLSearchParams({ asset: d.assetId || '', discrepancy: d.id, unit: o.unit_id || d.unitId, location: o.location || '' });
      navigate(`/movimentacoes/nova?${q}`);
      return;
    }
    setPending({ ids: [d.id], action, type: d.type, discrepancy: d });
  };

  const selectedType = selected.length ? data.find(d => d.id === selected[0])?.type : undefined;
  const bulkActions = selectedType ? (meta?.discrepancyActions[selectedType] || []).filter(a => a !== 'abrir_movimentacao' && a !== 'cadastrar_bem' && a !== 'usar_esta') : [];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Pendências" subtitle="Divergências encontradas em campo. Nada muda no cadastro sem uma decisão registrada aqui." />

      <div className="card-clay p-3 mb-4">
        <FilterBar
          primary={(
            <>
              <div className="flex rounded-xl border p-1 bg-muted md:w-56">
                {(['aberta', 'resolvida'] as const).map(st => (
                  <button key={st} onClick={() => set('situacao', st === 'aberta' ? '' : st)} className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${status === st ? 'bg-card shadow-card text-primary' : 'text-muted-foreground'}`}>
                    {st === 'aberta' ? 'Abertas' : 'Resolvidas'}
                  </button>
                ))}
              </div>
              <NativeSelect value={type} onChange={e => set('tipo', e.target.value)} aria-label="Tipo" className="md:w-60">
                <option value="">Todos os tipos</option>
                {(Object.keys(DISCREPANCY) as DiscrepancyType[]).map(t => <option key={t} value={t}>{DISCREPANCY[t].label}{counts[t] ? ` (${counts[t]})` : ''}</option>)}
              </NativeSelect>
            </>
          )}
          more={(
            <>
              <Field label="Comarca">
                <NativeSelect value={f.comarca} onChange={e => set('comarca', e.target.value)}>
                  <option value="">Todas as comarcas</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Setor">
                <NativeSelect value={f.setor} onChange={e => set('setor', e.target.value)} disabled={!unit}>
                  <option value="">{unit ? 'Todos os setores' : 'Escolha a comarca'}</option>
                  <SectorOptions sectors={sectorsOf(unit)} />
                </NativeSelect>
              </Field>
              <Field label="Origem">
                <NativeSelect value={f.origem} onChange={e => set('origem', e.target.value)}>
                  <option value="">Inventário e validação</option>
                  {Object.entries(ORIGIN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Inventário">
                <NativeSelect value={inventoryId} onChange={e => set('inventario', e.target.value)}>
                  <option value="">Todos os inventários</option>
                  {inventories.map(i => <option key={i.id} value={i.id}>{i.number} — {i.name}</option>)}
                </NativeSelect>
              </Field>
            </>
          )}
          chips={chips.filter(c => c.key !== 'situacao')}
          onClear={clear}
          summary={<strong className="text-foreground tabular">{data.length} pendência(s)</strong>}
        />
      </div>

      {selected.length > 0 && canDecide && (
        <div className="sticky top-16 lg:top-4 z-20 card-clay p-3 mb-4 flex flex-wrap items-center gap-2 border-primary/40 shadow-elevated">
          <span className="text-sm font-bold mr-2">{selected.length} selecionada(s) · {DISCREPANCY[selectedType!].label}</span>
          {bulkActions.map(a => <Button key={a} size="sm" variant="outline" onClick={() => setPending({ ids: selected, action: a, type: selectedType! })}>{DISCREPANCY_ACTION[a]}</Button>)}
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Limpar</Button>
        </div>
      )}

      {isLoading ? <Spinner /> : data.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={status === 'aberta' ? 'Nenhuma pendência aberta' : 'Nenhuma pendência resolvida'} description="Quando a conferência encontrar algo diferente do cadastro, aparece aqui para decisão." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.map(d => {
            const actions = meta?.discrepancyActions[d.type] || [];
            const isSel = selected.includes(d.id);
            const canSelect = canDecide && status === 'aberta' && (!selectedType || selectedType === d.type);
            return (
              <article key={d.id} className={`card-clay p-4 ${isSel ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-start gap-3">
                  {canSelect && <Checkbox checked={isSel} onCheckedChange={v => setSelected(v ? [...selected, d.id] : selected.filter(x => x !== d.id))} aria-label="Selecionar" className="mt-1" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DiscrepancyBadge value={d.type} />
                      <span className="text-[11px] font-bold text-urucum">{d.inventoryNumber}</span>
                    </div>
                    <h3 className="font-semibold mt-1.5 leading-tight"><code className="text-primary">{d.assetCode}</code> · {d.asset?.description || d.observed?.description || 'Bem sem cadastro'}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{DISCREPANCY[d.type].hint}{d.checkedByName ? ` Conferido por ${d.checkedByName}.` : ''}</p>
                  </div>
                  {d.photoEvidenceId && <EvidenceImage id={d.photoEvidenceId} alt="Foto da conferência" className="h-16 w-16 rounded-xl shrink-0" />}
                </div>
                <div className="mt-3 space-y-1.5"><Comparison d={d} unitName={unitName} /></div>
                {d.checkNotes && <p className="mt-2 text-xs italic text-muted-foreground">“{d.checkNotes}”</p>}

                {d.status === 'aberta' && canDecide && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {actions.map((a, i) => (
                      <Button key={a} size="sm" variant={i === 0 ? 'default' : 'outline'} onClick={() => act(d, a)}>{DISCREPANCY_ACTION[a]}</Button>
                    ))}
                  </div>
                )}
                {d.resolution && (
                  <div className="mt-3 rounded-xl bg-success/10 p-2.5 text-xs">
                    <strong className="text-success">{DISCREPANCY_ACTION[d.resolution.action]}</strong> por {d.resolution.resolvedByName} em {fmtDateTime(d.resolution.resolvedAt)}
                    {d.resolution.note && <div className="mt-0.5 text-foreground/80">“{d.resolution.note}”</div>}
                    {d.resolution.movementId && <button className="underline font-semibold mt-1" onClick={() => navigate(`/movimentacoes/${d.resolution!.movementId}`)}>Ver movimentação</button>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!pending} onOpenChange={o => !o && setPending(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-warning" /> {pending && DISCREPANCY_ACTION[pending.action]}</DialogTitle>
            <DialogDescription>
              {pending?.action === 'atualizar_cadastro' && 'O cadastro central do bem passa a refletir o que foi encontrado em campo. A alteração fica no histórico do bem.'}
              {pending?.action === 'marcar_nao_localizado' && 'O bem passa à situação "não localizado" no cadastro.'}
              {pending?.action === 'cadastrar_bem' && 'Um novo bem é criado com este tombamento, na comarca do inventário.'}
              {pending?.action === 'usar_esta' && 'A conferência repetida passa a valer e a primeira vira duplicada.'}
              {pending && pending.ids.length > 1 && ` Aplicar a ${pending.ids.length} pendências.`}
            </DialogDescription>
          </DialogHeader>
          {pending?.action === 'cadastrar_bem' && (
            <Field label="Descrição do bem">
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder={pending.discrepancy?.observed?.description || ''} />
            </Field>
          )}
          <Field label={pending && NOTE_REQUIRED.includes(pending.action) ? 'Justificativa (obrigatória)' : 'Justificativa (opcional)'}>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancelar</Button>
            <Button disabled={resolve.isPending || (!!pending && NOTE_REQUIRED.includes(pending.action) && !note.trim())} onClick={() => resolve.mutate()}>
              {resolve.isPending && <Loader2 className="animate-spin" />} Confirmar decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pendencias;
