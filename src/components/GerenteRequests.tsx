import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Loader2, Search, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, NativeSelect } from '@/components/common';
import { usePossessionChecks, useUnits, useUsers } from '@/hooks/queries';
import { assetsService, movementsService, possessionService } from '@/services/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/labels';
import { fmtRelative } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError, Asset } from '@/types';

const sameName = (a: string, b: string) =>
  a.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase() === b.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// O gerente gera a necessidade: quem está com o bem recebe a tarefa "Enviar"
// e quem vai ficar com ele recebe "Confirmar recebimento".
export const PedirEnvioDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const { data: units = [] } = useUnits();
  const [search, setSearch] = useState('');
  const [asset, setAsset] = useState<Asset | null>(null);
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) { setSearch(''); setAsset(null); setSender(''); setReceiver(''); setLocation(''); setReason(''); }
  }, [open]);

  const { data: found } = useQuery({
    queryKey: ['asset-search', search],
    queryFn: () => assetsService.list({ search, pageSize: '8' }),
    enabled: search.trim().length >= 2 && !asset,
  });

  const pick = (a: Asset) => {
    setAsset(a);
    setLocation(a.location);
    // Quem envia é, por padrão, a pessoa que tem o bem no nome.
    setSender(users.find(u => sameName(u.name, a.responsibleName))?.id || '');
  };

  const receiverUser = users.find(u => u.id === receiver);
  const locations = units.find(u => u.id === asset?.unitId)?.locations || [];

  const create = useMutation({
    mutationFn: () => movementsService.create({
      type: 'mudanca_responsavel',
      reason: reason.trim() || `Envio de ${asset!.description} para ${receiverUser!.name}`,
      asset_ids: [asset!.id],
      destination: { unit_id: asset!.unitId, location, responsible_name: receiverUser!.name },
      approver_ids: [user!.id],
      deliverer_id: sender,
      receiver_id: receiver,
    }),
    onSuccess: m => {
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast.success(`${m.number}: pedido enviado para quem envia e para quem recebe`);
      onOpenChange(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const valid = asset && sender && receiver && sender !== receiver;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Pedir envio de um bem</DialogTitle>
          <DialogDescription>Quem está com o bem recebe a tarefa de enviar, e quem vai ficar com ele confirma o recebimento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Bem">
            {asset ? (
              <div className="flex items-start justify-between gap-2 rounded-xl border p-3">
                <div className="text-sm">
                  <code className="font-bold text-primary">{asset.code}</code> · {asset.description}
                  <div className="text-xs text-muted-foreground">{asset.location} · {asset.responsibleName || 'sem responsável'}</div>
                </div>
                <button onClick={() => { setAsset(null); setSender(''); }} aria-label="Trocar bem" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Tombamento ou descrição" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                </div>
                {found?.items.length ? (
                  <div className="mt-2 rounded-xl border divide-y">
                    {found.items.map(a => (
                      <button key={a.id} type="button" disabled={!!a.activeMovementId || a.status === 'baixado'} onClick={() => pick(a)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
                        <code className="font-bold text-primary">{a.code}</code> · {a.description}
                        <span className="block text-xs text-muted-foreground">{a.activeMovementId ? 'já está em um envio' : `${a.location} · ${a.responsibleName || 'sem responsável'}`}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Field>
          <Field label="Quem envia" hint="Quem está com o bem hoje. Vem preenchido com o responsável do cadastro.">
            <NativeSelect value={sender} onChange={e => setSender(e.target.value)}>
              <option value="">Escolha…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Quem recebe">
            <NativeSelect value={receiver} onChange={e => setReceiver(e.target.value)}>
              <option value="">Escolha…</option>
              {users.filter(u => u.id !== sender).map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Sala de destino">
            <NativeSelect value={location} onChange={e => setLocation(e.target.value)} disabled={!asset}>
              {[...new Set([asset?.location || '', ...locations])].filter(Boolean).map(l => <option key={l} value={l}>{l}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Motivo (opcional)">
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: troca de mouse com defeito" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="urucum" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Send />} Pedir envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const PedirValidacaoDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const [selected, setSelected] = useState<string[]>([]);
  const servidores = useMemo(() => users.filter(u => u.role === 'servidor').map(u => u.id), [users]);

  useEffect(() => { if (open) setSelected(servidores); }, [open, servidores]);

  const send = useMutation({
    mutationFn: () => possessionService.request(selected),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['possession-checks'] });
      if (r.created.length) toast.success(`Validação pedida para ${r.created.map(c => c.userName).join(', ')}`);
      r.skipped.forEach(s => toast.info(`${s.name}: ${s.reason}`));
      onOpenChange(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Pedir validação de bens</DialogTitle>
          <DialogDescription>Cada pessoa escolhida confirma, bem a bem, se ainda está com o que está no nome dela. O que não estiver vira pendência para você.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {users.map(u => (
            <label key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-accent cursor-pointer">
              <Checkbox checked={selected.includes(u.id)} onCheckedChange={v => setSelected(v ? [...selected, u.id] : selected.filter(x => x !== u.id))} />
              <span className="flex-1 text-sm font-semibold">{u.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!selected.length || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="animate-spin" /> : <ClipboardCheck />} Pedir validação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ValidacoesSection: React.FC = () => {
  const { data = [] } = usePossessionChecks();
  if (!data.length) return null;
  return (
    <section className="card-clay p-5 mt-4" aria-labelledby="val">
      <h2 id="val" className="font-display text-lg font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Validações de bens</h2>
      <ul className="mt-3 divide-y">
        {data.slice(0, 8).map(c => (
          <li key={c.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-[11px] font-bold text-urucum">{c.number}</span>
            <span className="font-semibold flex-1 min-w-0">{c.userName}</span>
            {c.status === 'pendente' ? (
              <Badge variant="info">Aguardando · {c.total} bem(ns)</Badge>
            ) : (
              <>
                <Badge variant="ok">{c.confirmed} confirmado(s)</Badge>
                {c.missing > 0 && <Badge variant="danger">{c.missing} não está(ão)</Badge>}
              </>
            )}
            <span className="text-xs text-muted-foreground">{fmtRelative(c.answeredAt || c.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
