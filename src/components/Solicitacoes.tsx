import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PackagePlus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/common';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useCatalog, useRequests } from '@/hooks/queries';
import { requestsService } from '@/services/api';
import { REQUEST_STATUS } from '@/lib/labels';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { ApiError, RequestStatus } from '@/types';

export const RequestStatusBadge: React.FC<{ value: RequestStatus; mine?: boolean }> = ({ value, mine }) => (
  <Badge variant={REQUEST_STATUS[value].variant}>{mine ? REQUEST_STATUS[value].mine : REQUEST_STATUS[value].label}</Badge>
);

// "Pedir um bem" — o ofício do setor em três passos: o quê, por quê e
// urgência/anexo. O destino é o setor de quem pede (o sistema descobre pelos
// bens no nome da pessoa). Quem atende é o responsável pelo patrimônio, na aba
// Solicitações.
export const PedirBemDialog: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void }> = ({ open, onOpenChange }) => {
  const qc = useQueryClient();
  const { data: catalog = [] } = useCatalog();
  const [item, setItem] = useState('');
  const [other, setOther] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [justification, setJustification] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) { setItem(''); setOther(false); setQuantity('1'); setJustification(''); setUrgent(false); setFiles([]); }
  }, [open]);

  const create = useMutation({
    mutationFn: () => requestsService.create({
      item: item.trim(),
      category: catalog.find(c => c.item === item)?.category,
      quantity: Math.max(1, Number(quantity) || 1),
      justification: justification.trim(),
      urgency: urgent ? 'urgente' : 'normal',
      attachment: files[0] || undefined,
    }),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${r.number} enviado ao setor de patrimônio`);
      onOpenChange(false);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const valid = item.trim().length >= 2 && justification.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" /> Pedir um bem</DialogTitle>
          <DialogDescription>O setor de patrimônio vê o pedido na hora e, se houver um bem parado, manda ele antes de pensar em comprar.</DialogDescription>
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

          <div className="grid grid-cols-[90px_1fr] gap-3">
            <Field label="Quantidade" htmlFor="rq-qty"><Input id="rq-qty" type="number" min={1} max={50} value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>
            <Field label="2. Por quê?" htmlFor="rq-why">
              <Textarea id="rq-why" rows={2} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Ex.: a cadeira da recepção quebrou" />
            </Field>
          </div>

          <Field label="3. Urgência e anexo (opcional)">
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
export const MeusPedidos: React.FC = () => {
  const qc = useQueryClient();
  const { data = [] } = useRequests({ mine: 'true' });
  const cancel = useMutation({
    mutationFn: (id: string) => requestsService.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requests'] }); toast.success('Pedido cancelado'); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  if (!data.length) return null;
  return (
    <section className="mt-6" aria-labelledby="meus-pedidos">
      <h2 id="meus-pedidos" className="font-display text-lg font-bold mb-2">Meus pedidos</h2>
      <ul className="space-y-2">
        {data.map(r => (
          <li key={r.id} className="card-clay p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{r.quantity > 1 ? `${r.quantity}× ` : ''}{r.item}</div>
                <div className="text-xs text-muted-foreground">{r.number} · {fmtRelative(r.createdAt)}{r.urgency === 'urgente' ? ' · urgente' : ''}</div>
              </div>
              <RequestStatusBadge value={r.status} mine />
            </div>
            {r.status === 'recusada' && r.decisionNote && <p className="text-sm mt-2">Motivo: {r.decisionNote}</p>}
            {r.status === 'em_atendimento' && <p className="text-sm mt-2 text-muted-foreground">Um bem disponível foi separado para você. Quando chegar, confirme o recebimento nas suas tarefas.</p>}
            {['aberta', 'em_analise'].includes(r.status) && (
              <Button size="sm" variant="ghost" className="mt-1 -ml-2 text-muted-foreground" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancelar pedido</Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
