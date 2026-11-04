import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Inbox, Loader2, PackageCheck, PackagePlus, Paperclip, Search, Send, ShoppingCart, Users, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConservationBadge, EmptyState, Field, MovementStatusBadge, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { FilterBar, type FilterChip } from '@/components/FilterBar';
import { MeusPedidos, PedirBemDialog, RequestStatusBadge } from '@/components/Solicitacoes';
import { groupSectors, placeLabel, sectorsOf } from '@/components/Sectors';
import { useRequest, useRequestCandidates, useRequestSuggestions, useRequests, useUnits, useUsers } from '@/hooks/queries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { requestsService, unitsService } from '@/services/api';
import { downloadFile, openFile } from '@/services/http';
import { useAuth } from '@/lib/auth-context';
import { REQUEST_STATUS } from '@/lib/labels';
import { fmtDateTime, fmtRelative, normalizeText } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError, AssetRequestDetail, RequestStatus } from '@/types';

// Fila do responsável pelo patrimônio: os pedidos que chegam a ele (sem setor,
// setor sem responsável ou negados pelo setor e levados à compra).
const KEYS = ['situacao', 'comarca', 'urgencia'] as const;

const ACTION_LABEL: Record<string, string> = {
  criada: 'Pedido criado',
  em_analise: 'Aberto pelo patrimônio',
  atendimento: 'Atendido com bem disponível',
  encaminhada_compra: 'Encaminhado para compra',
  recusada: 'Recusado',
  cancelada: 'Cancelado por quem pediu',
  enviada_setor: 'Enviado pelo setor',
  negada_setor: 'Negado pelo setor',
  pedido_compra: 'Levado ao patrimônio para compra',
  atendida: 'Bem entregue',
  movimentacao_encerrada: 'Movimentação encerrada — voltou para análise',
};

const FilaPatrimonio: React.FC = () => {
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
    <div>
      <p className="text-sm text-muted-foreground mb-3">Pedidos que chegam ao patrimônio. Atenda primeiro com um bem que já existe; compra só quando não houver.</p>
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

type Aba = 'setor' | 'meus' | 'patrimonio' | 'responsaveis';

// Solicitações: pedir um item a um setor, responder os pedidos feitos ao setor
// da pessoa e acompanhar os próprios. O gestor também vê a fila do patrimônio
// e define quem responde por cada setor.
const Solicitacoes: React.FC = () => {
  const { can } = useAuth();
  const manager = can('admin', 'gestor');
  const [params, setParams] = useSearchParams();
  const [asking, setAsking] = useState(false);
  const { data: toMe = [] } = useRequests({ box: 'setor' });
  const waiting = toMe.filter(r => r.status === 'aguardando_setor').length;
  const tabs: { id: Aba; label: string; count?: number }[] = [
    { id: 'setor', label: 'Para o meu setor', count: waiting },
    { id: 'meus', label: 'Meus pedidos' },
    ...(manager ? [{ id: 'patrimonio' as Aba, label: 'Patrimônio' }, { id: 'responsaveis' as Aba, label: 'Responsáveis dos setores' }] : []),
  ];
  const aba = (tabs.find(t => t.id === params.get('aba'))?.id) || (manager ? 'patrimonio' : waiting ? 'setor' : 'meus');
  const go = (id: Aba) => setParams(prev => { const n = new URLSearchParams(); n.set('aba', id); if (id === 'patrimonio') ['situacao', 'comarca', 'urgencia'].forEach(k => prev.get(k) && n.set(k, prev.get(k)!)); return n; }, { replace: true });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Solicitações"
        subtitle="Peça um item a um setor. Quem responde pelo setor decide se envia; se não tiver, você pode pedir a compra ao patrimônio."
        actions={<Button size="lg" onClick={() => setAsking(true)}><PackagePlus /> Pedir um item</Button>}
      />
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted p-1 mb-4" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => go(t.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold ${aba === t.id ? 'bg-card shadow-card text-primary' : 'text-muted-foreground'}`}>
            {t.label}
            {!!t.count && <span className="ml-1.5 rounded-full bg-urucum text-white text-[11px] px-1.5 py-0.5 tabular">{t.count}</span>}
          </button>
        ))}
      </div>

      {aba === 'setor' && <ParaMeuSetor />}
      {aba === 'meus' && (
        <MeusPedidos title={false} empty={<EmptyState icon={Inbox} title="Você ainda não pediu nada" description="Toque em “Pedir um item” para pedir a um setor." />} />
      )}
      {aba === 'patrimonio' && manager && <FilaPatrimonio />}
      {aba === 'responsaveis' && manager && <ResponsaveisSetores />}
      <PedirBemDialog open={asking} onOpenChange={setAsking} />
    </div>
  );
};

// Pedidos feitos aos setores que a pessoa responde.
const ParaMeuSetor: React.FC = () => {
  const { data = [], isLoading } = useRequests({ box: 'setor' });
  if (isLoading) return <Spinner />;
  if (!data.length) {
    return <EmptyState icon={Inbox} title="Nenhum pedido para o seu setor" description="Quando alguém pedir um item a um setor que você responde, ele aparece aqui." />;
  }
  return (
    <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {data.map(r => (
        <li key={r.id}>
          <Link to={`/solicitacoes/${r.id}`} className="card-clay p-4 block hover:shadow-elevated transition-shadow h-full">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold text-urucum">{r.number}</span>
              <div className="flex gap-1">{r.urgency === 'urgente' && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">URGENTE</span>}<RequestStatusBadge value={r.status} /></div>
            </div>
            <div className="font-display font-bold mt-1">{r.quantity > 1 ? `${r.quantity}× ` : ''}{r.item}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Pedido ao setor {r.source?.sector} · por {r.requestedByName}</div>
            <p className="text-sm mt-2 line-clamp-2">{r.justification}</p>
            <div className="text-xs text-muted-foreground mt-2">{fmtRelative(r.createdAt)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
};

// Quem responde pelos pedidos de cada setor. Sem responsável, os pedidos ao
// setor vão direto para o patrimônio.
const ResponsaveisSetores: React.FC = () => {
  const qc = useQueryClient();
  const { data: units = [] } = useUnits();
  const { data: users = [] } = useUsers();
  const save = useMutation({
    mutationFn: (v: { unitId: string; location: string; userId: string }) => unitsService.setSectorOwner(v.unitId, v.location, v.userId || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); qc.invalidateQueries({ queryKey: ['request-sources'] }); toast.success('Responsável atualizado'); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Quem responde pelos pedidos feitos a cada setor. Sem responsável, o pedido vai para o patrimônio.</p>
      {units.map(u => (
        <section key={u.id} className="card-clay p-4">
          <h2 className="font-display font-bold">{u.name}</h2>
          {groupSectors(sectorsOf(u)).map(g => (
            <div key={g.kind} className="mt-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{g.label}</div>
              <ul className="divide-y">
                {g.items.map(sct => (
                  <li key={sct.name} className="py-2 grid sm:grid-cols-[1fr_260px] gap-2 sm:items-center">
                    <span className="text-sm font-semibold">{sct.name}</span>
                    <NativeSelect value={sct.ownerId || ''} disabled={save.isPending} aria-label={`Responsável por ${sct.name}`}
                      onChange={e => save.mutate({ unitId: u.id, location: sct.name, userId: e.target.value })}>
                      <option value="">Sem responsável (patrimônio)</option>
                      {users.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </NativeSelect>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
};

// Responsável pelo setor: procura na lista dele se tem o item e decide se envia.
const RespostaDoSetor: React.FC<{ r: AssetRequestDetail; onDone: () => void }> = ({ r, onDone }) => {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [denying, setDenying] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const { data: candidates = [], isFetching } = useRequestCandidates(r.id, term);
  const respond = useMutation({
    mutationFn: (decision: 'enviar' | 'negar') => requestsService.respond(r.id, { decision, asset_ids: decision === 'enviar' ? picked : [], note: note.trim() }),
    onSuccess: (_, decision) => {
      toast.success(decision === 'enviar' ? `Pedido atendido: envie o bem para ${r.requestedByName} pela sua Minha área` : `${r.requestedByName} foi avisado(a) de que o setor não tem o item`);
      onDone();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <section className="card-clay p-5 mt-4">
      <h2 className="font-display text-lg font-bold">Você tem este item?</h2>
      <p className="text-sm text-muted-foreground mt-1">Procure na sua lista (os bens do setor {r.source?.sector} e os que estão no seu nome) e escolha o que vai enviar.</p>
      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Ex.: ${r.item.toLowerCase()}`} aria-label="Procurar na minha lista" />
      </div>
      <ul className="mt-3 space-y-1.5 max-h-80 overflow-y-auto">
        {isFetching && !candidates.length ? <li className="text-sm text-muted-foreground p-2">Procurando…</li>
          : !candidates.length ? <li className="text-sm text-muted-foreground p-2">Nenhum bem encontrado na sua lista{term ? ` para “${term}”` : ''}.</li>
            : candidates.map(a => {
              const on = picked.includes(a.id);
              return (
                <li key={a.id}>
                  <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-accent">
                    <Checkbox checked={on} onCheckedChange={v => setPicked(v ? [...picked, a.id] : picked.filter(x => x !== a.id))} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold"><code className="text-primary mr-1">{a.code}</code>{a.description}</span>
                      <span className="block text-xs text-muted-foreground">{placeLabel(a.location, a.room)}{a.responsibleName ? ` · com ${a.responsibleName}` : ' · sem responsável'}</span>
                    </span>
                    <ConservationBadge value={a.conservationStatus} />
                  </label>
                </li>
              );
            })}
      </ul>
      <Field label="Recado para quem pediu (opcional)" className="mt-3">
        <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={denying ? 'Ex.: não temos cadeira sobrando no setor' : 'Ex.: pode buscar na sala 3'} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        <Button size="lg" disabled={!picked.length || respond.isPending} onClick={() => respond.mutate('enviar')}>
          {respond.isPending && !denying ? <Loader2 className="animate-spin" /> : <Send />} Enviar {picked.length > 1 ? `${picked.length} bens` : 'o bem escolhido'}
        </Button>
        <Button size="lg" variant="outline" disabled={respond.isPending} onClick={() => { setDenying(true); respond.mutate('negar'); }}>
          <XCircle /> Não tenho — negar pedido
        </Button>
      </div>
    </section>
  );
};

export const SolicitacaoDetalhe: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, user } = useAuth();
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
    qc.invalidateQueries({ queryKey: ['me-area'] });
    qc.invalidateQueries({ queryKey: ['request-candidates'] });
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
        actions={<div className="flex gap-1.5">{r.urgency === 'urgente' && <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">URGENTE</span>}<RequestStatusBadge value={r.status} mine={user?.id === r.requestedBy} /></div>}
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
        {r.source && <p className="text-sm mt-3"><strong>Pedido ao setor:</strong> {r.source.sector}{r.sourceUnitName ? ` · ${r.sourceUnitName}` : ''} · {r.source.ownerName ? `responde ${r.source.ownerName}` : 'sem responsável (patrimônio)'}</p>}
        {r.decisionNote && <p className="text-sm mt-3"><strong>Decisão:</strong> {r.decisionNote}{r.handledByName ? ` — ${r.handledByName}` : ''}</p>}
        {r.purchaseJustification && <p className="text-sm mt-2"><strong>Justificativa da compra:</strong> {r.purchaseJustification}</p>}
      </section>

      {r.status === 'aguardando_setor' && (user?.id === r.source?.ownerId || can('admin', 'gestor')) && <RespostaDoSetor r={r} onDone={refresh} />}
      {r.status === 'aguardando_setor' && user?.id === r.requestedBy && (
        <p className="card-clay p-4 mt-4 text-sm">Aguardando <strong>{r.source?.ownerName}</strong> responder se o setor tem o item.</p>
      )}
      {r.status === 'negada_setor' && user?.id === r.requestedBy && <PedirCompra id={r.id} by={r.handledByName} onDone={refresh} />}

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

      {can('admin', 'gestor') && <>
      <FulfillDialog open={dialog === 'fulfill'} onOpenChange={o => setDialog(o ? 'fulfill' : null)} requestId={r.id} quantity={r.quantity} suggestions={suggestions} onDone={refresh} />
      <DecisionDialog kind="purchase" open={dialog === 'purchase'} onOpenChange={o => setDialog(o ? 'purchase' : null)} requestId={r.id} available={suggestions.length} onDone={refresh} />
      <DecisionDialog kind="reject" open={dialog === 'reject'} onOpenChange={o => setDialog(o ? 'reject' : null)} requestId={r.id} available={suggestions.length} onDone={refresh} />
      </>}
    </div>
  );
};

// Setor negou: quem pediu leva o pedido ao patrimônio, que decide a compra.
const PedirCompra: React.FC<{ id: string; by: string; onDone: () => void }> = ({ id, by, onDone }) => {
  const ask = useMutation({
    mutationFn: () => requestsService.askPurchase(id),
    onSuccess: () => { toast.success('Pedido de compra enviado ao setor de patrimônio'); onDone(); },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <section className="card-clay p-5 mt-4 border-destructive/40">
      <h2 className="font-display text-lg font-bold">Seu pedido foi negado{by ? ` por ${by}` : ''}</h2>
      <p className="text-sm text-muted-foreground mt-1">O setor não tem o item para enviar. Você pode abrir uma solicitação de compra: o pedido vai para o setor de patrimônio, que decide.</p>
      <Button size="lg" className="mt-4" disabled={ask.isPending} onClick={() => ask.mutate()}>
        {ask.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart />} Pedir compra ao patrimônio
      </Button>
    </section>
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
