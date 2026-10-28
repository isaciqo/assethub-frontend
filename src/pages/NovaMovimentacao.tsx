import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Loader2, Search, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, NativeSelect, PageHeader } from '@/components/common';
import { useMeta, useUnits, useUsers } from '@/hooks/queries';
import { assetsService, movementsService } from '@/services/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/labels';
import { toast } from '@/components/ui/sonner';
import type { ApiError, Asset } from '@/types';

const NovaMovimentacao: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const { data: units = [] } = useUnits();
  const { data: users = [] } = useUsers();

  const [type, setType] = useState('transferencia_interna');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [destUnit, setDestUnit] = useState(params.get('unit') || '');
  const [destLocation, setDestLocation] = useState(params.get('location') || '');
  const [destResponsible, setDestResponsible] = useState('');
  const [approvers, setApprovers] = useState<string[]>([]);
  const [deliverer, setDeliverer] = useState(user?.id || '');
  const [receiver, setReceiver] = useState('');
  const [reason, setReason] = useState(params.get('discrepancy') ? 'Regularização de divergência encontrada no inventário' : '');
  const [carrier, setCarrier] = useState({ company: '', driver_name: '', driver_document: '', vehicle_plate: '' });

  const rule = meta?.movementTypes.find(t => t.id === type);
  const originUnit = assets[0]?.unitId;

  // Vindo de uma pendência: o bem já vem selecionado e o tipo é deduzido.
  useEffect(() => {
    const id = params.get('asset');
    if (!id) return;
    assetsService.detail(id).then(d => {
      setAssets([d.asset]);
      if (params.get('unit') && params.get('unit') !== d.asset.unitId) setType('transferencia_unidade');
      if (!params.get('unit')) setDestUnit(d.asset.unitId);
      setDestResponsible(d.asset.responsibleName);
    }).catch(() => {});
  }, [params]);

  useEffect(() => { if (type === 'transferencia_interna' && originUnit) setDestUnit(originUnit); }, [type, originUnit]);

  const { data: found } = useQuery({
    queryKey: ['asset-search', search, originUnit],
    queryFn: () => assetsService.list({ search, unit_id: originUnit, pageSize: '8' }),
    enabled: search.trim().length >= 2,
  });

  const destLocations = units.find(u => u.id === destUnit)?.locations || [];
  const approverOptions = useMemo(() => users.filter(u => u.role === 'admin' || u.role === 'gestor'), [users]);

  const create = useMutation({
    mutationFn: () => movementsService.create({
      type,
      reason,
      asset_ids: assets.map(a => a.id),
      destination: { unit_id: destUnit, location: destLocation, responsible_name: destResponsible },
      approver_ids: approvers,
      deliverer_id: deliverer,
      receiver_id: receiver,
      carrier: rule?.requiresCarrier ? carrier : undefined,
      source_discrepancy_id: params.get('discrepancy') || undefined,
    }),
    onSuccess: m => {
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['discrepancies'] });
      toast.success(`${m.number} aberta`);
      navigate(`/movimentacoes/${m.id}`, { replace: true });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const valid = assets.length > 0 && destUnit && deliverer && receiver && reason.trim().length >= 3
    && approvers.length >= (rule?.minApprovals || 0) && (!rule?.requiresCarrier || carrier.company.trim());

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="Nova movimentação" subtitle="Quem pede, quem aprova, quem envia e quem recebe — tudo fica registrado e assinado." />

      <div className="space-y-5">
        <section className="card-clay p-5 space-y-4">
          <Field label="Tipo de movimentação">
            <NativeSelect value={type} onChange={e => setType(e.target.value)}>
              {meta?.movementTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </NativeSelect>
          </Field>
          {rule && (
            <div className="flex gap-2 rounded-xl bg-info/10 p-3 text-xs text-foreground/80">
              <Info className="h-4 w-4 text-info shrink-0" />
              <span>Exige {rule.minApprovals === 0 ? 'nenhuma aprovação' : `${rule.minApprovals} aprovação(ões)`}{rule.requiresCarrier ? ' e dados da transportadora' : ''}. Regra configurável — a validar com o setor de patrimônio do TJPA.</span>
            </div>
          )}
          <Field label="Bens" hint={originUnit ? `Todos saem de ${units.find(u => u.id === originUnit)?.name}.` : 'Busque pelo tombamento ou descrição.'}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {assets.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary pl-3 pr-1 py-1 text-xs font-semibold">
                  <code className="text-primary">{a.code}</code> {a.description.slice(0, 28)}
                  <button onClick={() => setAssets(assets.filter(x => x.id !== a.id))} className="h-5 w-5 rounded-full hover:bg-background grid place-items-center" aria-label="Remover"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tombamento, descrição ou nº de série" className="pl-9" />
              {search.length >= 2 && found && (
                <ul className="absolute z-20 mt-1 w-full rounded-xl border bg-popover shadow-elevated max-h-64 overflow-y-auto">
                  {found.items.filter(a => !assets.some(x => x.id === a.id)).map(a => (
                    <li key={a.id}>
                      <button type="button" disabled={!!a.activeMovementId} onClick={() => { setAssets([...assets, a]); setSearch(''); if (!destResponsible) setDestResponsible(a.responsibleName); }}
                        className="w-full text-left px-3 py-2 hover:bg-accent disabled:opacity-50 text-sm">
                        <code className="font-bold text-primary mr-2">{a.code}</code>{a.description}
                        <span className="block text-xs text-muted-foreground">{a.location}{a.activeMovementId ? ' · já em movimentação' : ''}</span>
                      </button>
                    </li>
                  ))}
                  {found.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</li>}
                </ul>
              )}
            </div>
          </Field>
        </section>

        <section className="card-clay p-5 grid sm:grid-cols-2 gap-4">
          <Field label="Unidade de destino">
            <NativeSelect value={destUnit} onChange={e => setDestUnit(e.target.value)} disabled={type === 'transferencia_interna' && !!originUnit}>
              <option value="">Selecione…</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Sala/setor de destino">
            <Input list="dest-locs" value={destLocation} onChange={e => setDestLocation(e.target.value)} />
            <datalist id="dest-locs">{destLocations.map(l => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field label="Responsável no destino" className="sm:col-span-2">
            <Input value={destResponsible} onChange={e => setDestResponsible(e.target.value)} placeholder="Quem passa a responder pelo bem" />
          </Field>
        </section>

        <section className="card-clay p-5 space-y-4">
          {rule && rule.minApprovals > 0 && (
            <Field label={`Aprovadores (mínimo ${rule.minApprovals})`}>
              <div className="flex flex-wrap gap-1.5">
                {approverOptions.map(u => {
                  const on = approvers.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => setApprovers(on ? approvers.filter(x => x !== u.id) : [...approvers, u.id])}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
                      {u.name} <span className="opacity-70">· {ROLE_LABEL[u.role]}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Quem envia">
              <NativeSelect value={deliverer} onChange={e => setDeliverer(e.target.value)}>
                <option value="">Selecione…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Quem recebe">
              <NativeSelect value={receiver} onChange={e => setReceiver(e.target.value)}>
                <option value="">Selecione…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </NativeSelect>
            </Field>
          </div>
          {rule?.requiresCarrier && (
            <div className="grid sm:grid-cols-2 gap-4 rounded-2xl border border-dashed p-4">
              <Field label="Empresa transportadora"><Input value={carrier.company} onChange={e => setCarrier({ ...carrier, company: e.target.value })} /></Field>
              <Field label="Motorista"><Input value={carrier.driver_name} onChange={e => setCarrier({ ...carrier, driver_name: e.target.value })} /></Field>
              <Field label="Documento do motorista"><Input value={carrier.driver_document} onChange={e => setCarrier({ ...carrier, driver_document: e.target.value })} /></Field>
              <Field label="Placa"><Input value={carrier.vehicle_plate} onChange={e => setCarrier({ ...carrier, vehicle_plate: e.target.value.toUpperCase() })} /></Field>
            </div>
          )}
          <Field label="Motivo">
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} />
          </Field>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button size="lg" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Send />} Abrir movimentação
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NovaMovimentacao;
