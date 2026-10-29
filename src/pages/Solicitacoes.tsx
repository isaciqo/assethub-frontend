import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Inbox, Loader2, PackageCheck, Paperclip, ShoppingCart, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConservationBadge, EmptyState, Field, MovementStatusBadge, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { FilterBar, type FilterChip } from '@/components/FilterBar';
import { RequestStatusBadge } from '@/components/Solicitacoes';
import { placeLabel } from '@/components/Sectors';
import { useRequest, useRequestSuggestions, useRequests, useUnits, useUsers } from '@/hooks/queries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { requestsService } from '@/services/api';
import { downloadFile, openFile } from '@/services/http';
import { useAuth } from '@/lib/auth-context';
import { REQUEST_STATUS } from '@/lib/labels';
import { fmtDateTime, fmtRelative, normalizeText } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError, RequestStatus } from '@/types';

// Aba do responsável pelo patrimônio: a fila de pedidos de bens das varas e
// setores. Urgentes primeiro, depois os mais antigos.
const KEYS = ['situacao', 'comarca', 'urgencia'] as const;

const ACTION_LABEL: Record<string, string> = {
  criada: 'Pedido criado',
  em_analise: 'Aberto pelo patrimônio',
  atendimento: 'Atendido com bem disponível',
  encaminhada_compra: 'Encaminhado para compra',
  recusada: 'Recusado',
  cancelada: 'Cancelado por quem pediu',
  atendida: 'Bem entregue',
  movimentacao_encerrada: 'Movimentação encerrada — voltou para análise',
};

const Solicitacoes: React.FC = () => {
  const { values: f, set, clear } = useUrlFilters(KEYS);
  const { data: units = [] } = useUnits();
  const status = f.situacao || 'abertas';
  const { data = [], isLoading } = useRequests({ status: status === 'todas' ? undefined : status, unit_id: f.comarca || undefined, urgency: f.urgencia || undefined });

  const chips: FilterChip[] = [
    ...(f.situacao ? [{ key: 'situacao', label: f.situacao === 'todas' ? 'Todas as situações' : REQUEST_STATUS[f.situacao as RequestStatus]?.label || f.situacao, onRemove: () => set('situacao', '') }] : []),
    ...(f.comarca ? [{ key: 'comarca', label: units.find(u => u.id === f.comarca)?.name || f.comarca, onRemove: () => set('comarca', '') }] : []),
    ...(f.urgencia ? [{ key: 'urgencia', label: f.urgencia === 'urgente' ? 'Urgentes' : 'Normais', onRemove: () => set('urgencia', '') }] : []),
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Solicitações de bens"
        subtitle="Pedidos das varas e setores. Atenda primeiro com um bem que já existe; compra só quando não houver."
      />
      <div className="card-clay p-3 mb-4">
        <FilterBar
          primary={(
            <>
              <NativeSelect value={status} onChange={e => set('situacao', e.target.value === 'abertas' ? '' : e.target.value)} aria-label="Situação" className="md:w-52">
                <option value="abertas">A decidir (novas e em análise)</option>
                <option value="todas">Todas</option>
                {(Object.keys(REQUEST_STATUS) as RequestStatus[]).map(s => <option key={s} value={s}>{REQUEST_STATUS[s].label}</option>)}
              </NativeSelect>
              <NativeSelect value={f.comarca} onChange={e => set('comarca', e.target.value)} aria-label="Comarca" className="md:w-52">
                <option value="">Todas as comarcas</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </NativeSelect>
              <NativeSelect value={f.urgencia} onChange={e => set('urgencia', e.target.value)} aria-label="Urgência" className="md:w-40">
                <option value="">Qualquer urgência</option>
                <option value="urgente">Urgentes</option>
                <option value="normal">Normais</option>
              </NativeSelect>
            </>
          )}
          chips={chips}
          onClear={clear}
          summary={<strong className="text-foreground tabular">{data.length} pedido(s)</strong>}
        />
      </div>

      {isLoading ? <Spinner /> : !data.length ? (
        <EmptyState icon={Inbox} title="Nenhuma solicitação aqui" description={status === 'abertas' ? 'Tudo decidido. Os pedidos novos aparecem aqui assim que alguém pede um bem.' : 'Ajuste os filtros.'} />
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.map(r => (
            <li key={r.id}>
              <Link to={`/solicitacoes/${r.id}`} className="card-clay p-4 block hover:shadow-elevated transition-shadow h-full">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-urucum">{r.number}</span>
                  <div className="flex gap-1">{r.urgency === 'urgente' && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">URGENTE</span>}<RequestStatusBadge value={r.status} /></div>
                </div>
                <div className="font-display font-bold mt-1">{r.quantity > 1 ? `${r.quantity}× ` : ''}{r.item}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.unitName} · {placeLabel(r.sector, r.room)}</div>
                <p className="text-sm mt-2 line-clamp-2">{r.justification}</p>
                <div className="text-xs text-muted-foreground mt-2">{r.requestedByName} · {fmtRelative(r.createdAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const SolicitacaoDetalhe: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data: r, isLoading } = useRequest(id);
  const open = !!r && ['aberta', 'em_analise'].includes(r.status);
  const { data: suggestions = [], isLoading: loadingSug } = useRequestSuggestions(id, open && can('admin', 'gestor'));
  const [dialog, setDialog] = useState<'fulfill' | 'purchase' | 'reject' | null>(null);

  useEffect(() => {
    // O backend muda "aberta" → "em análise" na primeira abertura: a lista e o painel precisam saber.
    if (r) { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }
  }, [r?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Spinner />;
  if (!r) return <EmptyState icon={Inbox} title="Solicitação não encontrada" />;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['request', id] });
    qc.invalidateQueries({ queryKey: ['requests'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['movements'] });
    qc.invalidateQueries({ queryKey: ['assets'] });
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate('/solicitacoes')}><ArrowLeft /> Solicitações</Button>
      <PageHeader
        eyebrow={r.number}
        title={`${r.quantity > 1 ? `${r.quantity}× ` : ''}${r.item}`}
        subtitle={<>{r.unitName} · {placeLabel(r.sector, r.room)} · pedido por <strong>{r.requestedByName}</strong> {fmtRelative(r.createdAt)}</>}
        actions={<div className="flex gap-1.5">{r.urgency === 'urgente' && <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">URGENTE</span>}<RequestStatusBadge value={r.status} /></div>}
      />

      <section className="card-clay p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Justificativa</h2>
        <p className="mt-1">{r.justification}</p>
        {r.category && <p className="text-xs text-muted-foreground mt-2">Categoria: {r.category}</p>}
        {r.attachmentId && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => openFile(`/evidences/${r.attachmentId}`).catch((e: ApiError) => toast.error(e.message))}>
            <Paperclip /> Ver anexo
          </Button>
        )}
        {r.decisionNote && <p className="text-sm mt-3"><strong>Decisão:</strong> {r.decisionNote}</p>}
        {r.purchaseJustification && <p className="text-sm mt-2"><strong>Justificativa da compra:</strong> {r.purchaseJustification}</p>}
      </section>

      {open && can('admin', 'gestor') && (
        <section className="card-clay p-5 mt-4">
          <h2 className="font-display text-lg font-bold">Como atender?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {loadingSug ? 'Procurando bens parados…' : suggestions.length
              ? `${suggestions.length} bem(ns) disponível(is) parecido(s) no acervo. Reaproveite antes de comprar.`
              : 'Nenhum bem parado da mesma categoria no acervo.'}
          </p>
          <div className="grid sm:grid-cols-3 gap-2 mt-4">
            <Button size="lg" disabled={!suggestions.length} onClick={() => setDialog('fulfill')}><PackageCheck /> Atender com bem disponível</Button>
            <Button size="lg" variant="outline" onClick={() => setDialog('purchase')}><ShoppingCart /> Encaminhar para compra</Button>
            <Button size="lg" variant="outline" onClick={() => setDialog('reject')}><XCircle /> Recusar</Button>
          </div>
        </section>
      )}

      {r.status === 'encaminhada_compra' && can('admin', 'gestor') && (
        <Button className="mt-4" variant="outline" onClick={() => downloadFile(`/requests/${r.id}/letter.pdf`).catch((e: ApiError) => toast.error(e.message))}>
          <FileText /> Baixar ofício de encaminhamento (PDF)
        </Button>
      )}

      {r.movements.length > 0 && (
        <section className="card-clay p-5 mt-4">
          <h2 className="font-display text-lg font-bold">Movimentações geradas</h2>
          <ul className="mt-2 divide-y">
            {r.movements.map(m => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <Link to={`/movimentacoes/${m.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">{m.number}</Link>
                <span className="text-xs text-muted-foreground">{m.assetCount} bem(ns)</span>
                <MovementStatusBadge value={m.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card-clay p-5 mt-4">
        <h2 className="font-display text-lg font-bold">Histórico</h2>
        <ol className="mt-2 space-y-2">
          {r.history.map((h, i) => (
            <li key={i} className="text-sm flex gap-3">
              <span className="mt-1.5 h-2 w-2 rounded-sm bg-primary rotate-45 shrink-0" aria-hidden="true" />
              <div>
                <span className="font-semibold">{ACTION_LABEL[h.action] || h.action}</span>{h.note ? ` — ${h.note}` : ''}
                <div className="text-xs text-muted-foreground">{h.byName} · {fmtDateTime(h.at)}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <FulfillDialog open={dialog === 'fulfill'} onOpenChange={o => setDialog(o ? 'fulfill' : null)} requestId={r.id} quantity={r.quantity} suggestions={suggestions} onDone={refresh} />
      <DecisionDialog kind="purchase" open={dialog === 'purchase'} onOpenChange={o => setDialog(o ? 'purchase' : null)} requestId={r.id} available={suggestions.length} onDone={refresh} />
      <DecisionDialog kind="reject" open={dialog === 'reject'} onOpenChange={o => setDialog(o ? 'reject' : null)} requestId={r.id} available={suggestions.length} onDone={refresh} />
    </div>
  );
};

type Suggestion = ReturnType<typeof useRequestSuggestions>['data'] extends (infer T)[] | undefined ? T : never;

const FulfillDialog: React.FC<{
  open: boolean; onOpenChange: (o: boolean) => void; requestId: string; quantity: number; suggestions: Suggestion[]; onDone: () => void;
}> = ({ open, onOpenChange, requestId, quantity, suggestions, onDone }) => {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const [picked, setPicked] = useState<string[]>([]);
  const [sender, setSender] = useState('');

  useEffect(() => {
    if (!open) return;
    setPicked(suggestions.slice(0, quantity).map(s => s.id));
  }, [open, suggestions, quantity]);

  // Quem envia: por padrão, quem tem o primeiro bem escolhido no nome; senão, o próprio gestor.
  const first = suggestions.find(s => s.id === picked[0]);
  const defaultSender = useMemo(
    () => users.find(u => first?.responsibleName && normalizeText(u.name) === normalizeText(first.responsibleName))?.id || user?.id || '',
    [users, first, user],
  );
  useEffect(() => { setSender(defaultSender); }, [defaultSender]);

  const fulfill = useMutation({
    mutationFn: () => requestsService.fulfill(requestId, { asset_ids: picked, deliverer_id: sender }),
    onSuccess: () => { toast.success('Movimentação criada: quem envia e quem recebe já têm a tarefa'); onOpenChange(false); onDone(); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Atender com bem disponível</DialogTitle>
          <DialogDescription>Escolha o(s) bem(ns). O sistema abre a movimentação já aprovada por você: quem envia confirma o envio e quem pediu confirma o recebimento.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {suggestions.map(s => {
            const on = picked.includes(s.id);
            return (
              <li key={s.id}>
                <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-accent">
                  <Checkbox checked={on} onCheckedChange={v => setPicked(v ? [...picked, s.id] : picked.filter(x => x !== s.id))} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold"><code className="text-primary mr-1">{s.code}</code>{s.description}</span>
                    <span className="block text-xs text-muted-foreground">{s.unitName} · {placeLabel(s.location, s.room)}{s.responsibleName ? ` · com ${s.responsibleName}` : ' · sem responsável'}</span>
                  </span>
                  <ConservationBadge value={s.conservationStatus} />
                </label>
              </li>
            );
          })}
        </ul>
        <Field label="Quem envia">
          <NativeSelect value={sender} onChange={e => setSender(e.target.value)}>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!picked.length || !sender || fulfill.isPending} onClick={() => fulfill.mutate()}>
            {fulfill.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />} Atender com {picked.length} bem(ns)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DecisionDialog: React.FC<{
  kind: 'purchase' | 'reject'; open: boolean; onOpenChange: (o: boolean) => void; requestId: string; available: number; onDone: () => void;
}> = ({ kind, open, onOpenChange, requestId, available, onDone }) => {
  const [text, setText] = useState('');
  useEffect(() => { if (!open) setText(''); }, [open]);
  const purchase = kind === 'purchase';
  const required = !purchase || available > 0;

  const decide = useMutation({
    mutationFn: () => (purchase ? requestsService.purchase(requestId, text.trim()) : requestsService.reject(requestId, text.trim())),
    onSuccess: async () => {
      onOpenChange(false);
      onDone();
      if (purchase) {
        toast.success('Encaminhado para compra — baixando o ofício');
        await downloadFile(`/requests/${requestId}/letter.pdf`).catch((e: ApiError) => toast.error(e.message));
      } else toast.success('Pedido recusado');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{purchase ? 'Encaminhar para compra' : 'Recusar pedido'}</DialogTitle>
          <DialogDescription>
            {purchase
              ? available
                ? `Existem ${available} bem(ns) disponível(is) parecido(s). Justifique por que comprar.`
                : 'Não há bem parado que atenda. A compra segue fora do sistema; o ofício em PDF é gerado agora.'
              : 'Quem pediu vê o motivo na hora.'}
          </DialogDescription>
        </DialogHeader>
        <Field label={purchase ? `Justificativa${required ? ' *' : ' (opcional)'}` : 'Motivo *'}>
          <Textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={purchase ? 'Ex.: o disponível não atende à especificação' : 'Ex.: o setor já tem dois armários'} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={purchase ? 'default' : 'destructive'} disabled={(required && text.trim().length < 3) || decide.isPending} onClick={() => decide.mutate()}>
            {decide.isPending && <Loader2 className="animate-spin" />} {purchase ? 'Encaminhar e baixar ofício' : 'Recusar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Solicitacoes;
