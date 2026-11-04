import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PackagePlus, Send, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, NativeSelect } from '@/components/common';
import { SectorOptions } from '@/components/Sectors';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useCatalog, useRequestSources, useRequests } from '@/hooks/queries';
import { requestsService } from '@/services/api';
import { REQUEST_STATUS } from '@/lib/labels';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { ApiError, RequestStatus } from '@/types';

export const RequestStatusBadge: React.FC<{ value: RequestStatus; mine?: boolean }> = ({ value, mine }) => (
  <Badge variant={REQUEST_STATUS[value].variant}>{mine ? REQUEST_STATUS[value].mine : REQUEST_STATUS[value].label}</Badge>
);

// "Pedir um bem": o quê, de qual setor, por quê e urgência/anexo. O destino é o
// setor de quem pede (o sistema descobre pelos bens no nome da pessoa). Pedido
// a um setor com responsável vai primeiro para ele; sem setor ou sem
// responsável, vai para o patrimônio, na aba Solicitações.
export const PedirBemDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const qc = useQueryClient();
  const { data: catalog = [] } = useCatalog();
  const { data: sources = [] } = useRequestSources();
  const [sourceUnit, setSourceUnit] = useState('');
  const [sourceSector, setSourceSector] = useState('');
  const sectors = sources.find(s => s.unitId === sourceUnit)?.sectors || [];
  const owner = sectors.find(s => s.name === sourceSector);
  const [item, setItem] = useState('');
  const [other, setOther] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [justification, setJustification] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) { setSourceUnit(''); setSourceSector(''); setItem(''); setOther(false); setQuantity('1'); setJustification(''); setUrgent(false); setFiles([]); }
  }, [open]);

  const create = useMutation({
    mutationFn: () => requestsService.create({
      item: item.trim(),
      category: catalog.find(c => c.item === item)?.category,
      quantity: Math.max(1, Number(quantity) || 1),
      justification: justification.trim(),
      urgency: urgent ? 'urgente' : 'normal',
      attachment: files[0] || undefined,
      source_unit_id: sourceSector ? sourceUnit : undefined,
      source_sector: sourceSector || undefined,
    }),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['me-area'] });
      toast.success(r.status === 'aguardando_setor' ? `${r.number} enviado para ${r.source?.ownerName}` : `${r.number} enviado ao setor de patrimônio`);
      onOpenChange(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const valid = item.trim().length >= 2 && justification.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" /> Pedir um item</DialogTitle>
          <DialogDescription>Escolha o item e o setor a quem você quer pedir. O responsável pelo setor recebe o pedido e decide se envia.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="1. O que você precisa?">
            <div className="flex flex-wrap gap-1.5">
              {catalog.map(c => (
                <button key={c.item} type="button" onClick={() => { setItem(c.item); setOther(false); }}
                  className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', !other && item === c.item ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}>
                  {c.item}
                </button>
              ))}
              <button type="button" onClick={() => { setOther(true); setItem(''); }}
                className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', other ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}>
                Outro…
              </button>
            </div>
            {other && <Input className="mt-2" autoFocus value={item} onChange={e => setItem(e.target.value)} placeholder="Ex.: Estante de aço" />}
          </Field>

          <Field label="2. De qual setor você quer pedir?" hint={!sourceSector ? 'Se não souber, deixe em branco: o setor de patrimônio decide.' : owner?.ownerName ? `Quem responde: ${owner.ownerName}` : 'Este setor não tem responsável: o pedido vai para o patrimônio.'}>
            <div className="grid sm:grid-cols-2 gap-2">
              <NativeSelect value={sourceUnit} onChange={e => { setSourceUnit(e.target.value); setSourceSector(''); }} aria-label="Comarca do setor">
                <option value="">Comarca…</option>
                {sources.map(u => <option key={u.unitId} value={u.unitId}>{u.unitName}</option>)}
              </NativeSelect>
              <NativeSelect value={sourceSector} onChange={e => setSourceSector(e.target.value)} disabled={!sourceUnit} aria-label="Setor">
                <option value="">Setor…</option>
                <SectorOptions sectors={sectors} />
              </NativeSelect>
            </div>
          </Field>

          <div className="grid grid-cols-[90px_1fr] gap-3">
            <Field label="Quantidade" htmlFor="rq-qty"><Input id="rq-qty" type="number" min={1} max={50} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>
            <Field label="3. Por quê?" htmlFor="rq-why">
              <Textarea id="rq-why" rows={2} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Ex.: a cadeira da recepção quebrou" />
            </Field>
          </div>

          <Field label="4. Urgência e anexo (opcional)">
            <div className="flex gap-1.5 mb-2">
              {[false, true].map(u => (
                <button key={String(u)} type="button" onClick={() => setUrgent(u)}
                  className={cn('rounded-xl border px-4 py-2 text-xs font-bold', urgent === u ? (u ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-primary text-primary-foreground border-primary') : 'hover:bg-accent')}>
                  {u ? 'Urgente' : 'Normal'}
                </button>
              ))}
            </div>
            <PhotoPicker value={files} onChange={setFiles} max={1} allowPdf label="Anexar ofício ou foto" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Send />} Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// "Meus pedidos" — o que a pessoa pediu e em que pé está, em linguagem simples.
export const MeusPedidos: React.FC<{ title?: boolean; empty?: React.ReactNode }> = ({ title = true, empty = null }) => {
  const qc = useQueryClient();
  const { data = [] } = useRequests({ box: 'meus' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['me-area'] }); };
  const cancel = useMutation({
    mutationFn: (id: string) => requestsService.cancel(id),
    onSuccess: () => { refresh(); toast.success('Pedido cancelado'); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  const purchase = useMutation({
    mutationFn: (id: string) => requestsService.askPurchase(id),
    onSuccess: () => { refresh(); toast.success('Pedido de compra enviado ao setor de patrimônio'); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  if (!data.length) return <>{empty}</>;
  return (
    <section className={title ? 'mt-6' : ''} aria-labelledby="meus-pedidos">
      {title && <h2 id="meus-pedidos" className="font-display text-lg font-bold mb-2">Meus pedidos</h2>}
      <ul className="space-y-2">
        {data.map(r => (
          <li key={r.id} className="card-clay p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/solicitacoes/${r.id}`} className="font-semibold hover:underline">{r.quantity > 1 ? `${r.quantity}× ` : ''}{r.item}</Link>
                <div className="text-xs text-muted-foreground">{r.number} · {fmtRelative(r.createdAt)}{r.urgency === 'urgente' ? ' · urgente' : ''}</div>
                {r.source && <div className="text-xs text-muted-foreground">Pedido a: {r.source.sector}{r.source.ownerName ? ` (${r.source.ownerName})` : ''}</div>}
              </div>
              <RequestStatusBadge value={r.status} mine />
            </div>
            {r.status === 'recusada' && r.decisionNote && <p className="text-sm mt-2">Motivo: {r.decisionNote}</p>}
            {r.status === 'aguardando_setor' && <p className="text-sm mt-2 text-muted-foreground">Aguardando {r.source?.ownerName || 'o responsável pelo setor'} responder.</p>}
            {r.status === 'negada_setor' && (
              <div className="mt-2 rounded-xl bg-destructive/10 p-3 text-sm">
                <p><strong>Seu pedido foi negado</strong>{r.handledByName ? ` por ${r.handledByName}` : ''}.{r.decisionNote ? ` Motivo: ${r.decisionNote}` : ''}</p>
                <p className="mt-1 text-muted-foreground">Você pode abrir uma solicitação de compra: o pedido vai para o setor de patrimônio.</p>
                <Button size="sm" className="mt-2" disabled={purchase.isPending} onClick={() => purchase.mutate(r.id)}>
                  {purchase.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart />} Pedir compra ao patrimônio
                </Button>
              </div>
            )}
            {r.status === 'em_atendimento' && (
              <p className="text-sm mt-2 text-muted-foreground">
                {r.source?.ownerId && r.handledBy === r.source.ownerId
                  ? `Seu pedido foi atendido: ${r.handledByName} vai enviar o bem. Quando chegar, confirme o recebimento nas suas tarefas.`
                  : 'Um bem disponível foi separado para você. Quando chegar, confirme o recebimento nas suas tarefas.'}
              </p>
            )}
            {['aguardando_setor', 'negada_setor', 'aberta', 'em_analise'].includes(r.status) && (
              <Button size="sm" variant="ghost" className="mt-1 -ml-2 text-muted-foreground" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancelar pedido</Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
