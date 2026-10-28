import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Ban, Check, CircleCheck, FileText, Link2, Loader2, PackageCheck, ShieldAlert, ShieldCheck, ThumbsDown, ThumbsUp, Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConservationBadge, EmptyState, EvidenceImage, Field, MovementStatusBadge, PageHeader, Spinner } from '@/components/common';
import { SignaturePad } from '@/components/SignaturePad';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useMovement } from '@/hooks/queries';
import { movementsService } from '@/services/api';
import { openFile } from '@/services/http';
import { useAuth } from '@/lib/auth-context';
import { CONSERVATION, CONSERVATION_ORDER } from '@/lib/labels';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { ApiError, Conservation, MovementDetail } from '@/types';

const STEPS = [
  { key: 'solicitada', label: 'Solicitada' },
  { key: 'aprovacao', label: 'Aprovação' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'recebimento', label: 'Recebimento' },
  { key: 'concluida', label: 'Concluída' },
];

function stepIndex(status: string) {
  return { aguardando_aprovacao: 1, aprovada: 2, em_transito: 3, com_pendencia: 3, concluida: 5, rejeitada: 1, cancelada: 0 }[status] ?? 0;
}

const MovimentacaoDetalhe: React.FC = () => {
  const { id } = useParams();
  const { data, isLoading } = useMovement(id);
  const [dialog, setDialog] = useState<null | 'approve' | 'reject' | 'deliver' | 'receive' | 'resolve' | 'cancel'>(null);

  if (isLoading) return <Spinner />;
  if (!data) return <EmptyState title="Movimentação indisponível" description="Verifique a conexão." />;

  const { movement: m, assets, units, users, events, evidences, chain, actions } = data;
  const uName = (uid?: string) => (uid && users[uid]?.name) || '—';
  const current = stepIndex(m.status);
  const photos = evidences.filter(e => e.kind !== 'assinatura');
  const sigs = evidences.filter(e => e.kind === 'assinatura');

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={m.number}
        title={m.typeLabel || m.type}
        subtitle={<span className="inline-flex items-center gap-2"><MovementStatusBadge value={m.status} /> aberta em {fmtDateTime(m.createdAt)} por {uName(m.requestedBy)}</span>}
        actions={<Button variant="outline" onClick={() => openFile(`/movements/${m.id}/term.pdf`).catch((e: ApiError) => toast.error(e.message))}><FileText /> {m.status === 'concluida' ? 'Termo em PDF' : 'Espelho em PDF'}</Button>}
      />

      {/* Linha do tempo das etapas */}
      <ol className="card-clay p-4 grid grid-cols-5 gap-1 mb-4" aria-label="Etapas">
        {STEPS.map((s, i) => {
          const done = i < current || m.status === 'concluida';
          const active = i === current && m.status !== 'concluida';
          const bad = active && ['rejeitada', 'com_pendencia'].includes(m.status);
          return (
            <li key={s.key} className="flex flex-col items-center text-center gap-1.5">
              <span className={cn('h-9 w-9 rounded-xl grid place-items-center text-sm font-bold rotate-45',
                done ? 'bg-success text-success-foreground' : bad ? 'bg-destructive text-destructive-foreground' : active ? 'bg-urucum text-primary-foreground animate-pulse' : 'bg-muted text-muted-foreground')}>
                <span className="-rotate-45">{done ? <Check className="h-4 w-4" /> : i + 1}</span>
              </span>
              <span className={cn('text-[11px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {actions.length > 0 && (
        <div className="card-clay p-4 mb-4 border-urucum/40 bg-urucum/5 flex flex-wrap items-center gap-2">
          <span className="font-display font-bold mr-auto">Sua ação</span>
          {actions.includes('approve') && <><Button variant="success" onClick={() => setDialog('approve')}><ThumbsUp /> Aprovar</Button><Button variant="outline" onClick={() => setDialog('reject')}><ThumbsDown /> Rejeitar</Button></>}
          {actions.includes('deliver') && <Button variant="urucum" onClick={() => setDialog('deliver')}><Truck /> Confirmar entrega</Button>}
          {actions.includes('receive') && <Button variant="urucum" onClick={() => setDialog('receive')}><PackageCheck /> Confirmar recebimento</Button>}
          {actions.includes('resolve_issue') && <Button onClick={() => setDialog('resolve')}><ShieldAlert /> Tratar ocorrência</Button>}
          {actions.includes('cancel') && <Button variant="ghost" onClick={() => setDialog('cancel')}><Ban /> Cancelar</Button>}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <section className="card-clay p-5">
            <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="rounded-2xl bg-muted p-3">
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Origem</div>
                <div className="font-semibold">{units[m.origin.unitId]?.name}</div>
                <div className="text-xs text-muted-foreground">{m.origin.location || '—'} · {m.origin.responsibleName || '—'}</div>
              </div>
              <ArrowRight className="h-6 w-6 text-urucum mx-auto rotate-90 sm:rotate-0" />
              <div className="rounded-2xl bg-primary/10 p-3">
                <div className="text-[10px] font-bold uppercase text-primary">Destino</div>
                <div className="font-semibold">{units[m.destination.unitId]?.name}</div>
                <div className="text-xs text-muted-foreground">{m.destination.location || '—'} · {m.destination.responsibleName || '—'}</div>
              </div>
            </div>
            <p className="text-sm mt-4"><span className="text-muted-foreground">Motivo:</span> {m.reason}</p>
            {m.carrier.company && <p className="text-sm mt-1"><span className="text-muted-foreground">Transporte:</span> {m.carrier.company} · {m.carrier.driverName} · {m.carrier.vehiclePlate}</p>}
          </section>

          <section className="card-clay p-5">
            <h2 className="font-display font-bold mb-3">Bens ({assets.length})</h2>
            <ul className="divide-y">
              {assets.map(a => {
                const dc = m.delivery?.conditions.find(c => c.assetId === a.id)?.condition;
                const rc = m.receipt?.conditions.find(c => c.assetId === a.id)?.condition;
                return (
                  <li key={a.id} className="py-2.5 flex flex-wrap items-center gap-3 text-sm">
                    <code className="font-bold text-primary w-20">{a.code}</code>
                    <span className="flex-1 min-w-[160px]">{a.description}</span>
                    {dc && <span className="text-xs text-muted-foreground">entrega <ConservationBadge value={dc} /></span>}
                    {rc && <span className="text-xs text-muted-foreground">recebimento <ConservationBadge value={rc} /></span>}
                  </li>
                );
              })}
            </ul>
          </section>

          {(photos.length > 0 || sigs.length > 0) && (
            <section className="card-clay p-5">
              <h2 className="font-display font-bold mb-3">Evidências</h2>
              <div className="flex flex-wrap gap-3">
                {sigs.map(e => (
                  <figure key={e.id} className="w-44">
                    <EvidenceImage id={e.id} alt={e.description} className="h-20 w-44 rounded-xl border bg-[hsl(40_60%_98%)] object-contain" />
                    <figcaption className="text-[10px] text-muted-foreground mt-1">Assinatura · {e.stage} · sha256 {e.sha256.slice(0, 10)}…</figcaption>
                  </figure>
                ))}
                {photos.map(e => (
                  <figure key={e.id} className="w-28">
                    {e.kind === 'documento'
                      ? <div className="h-28 w-28 rounded-xl border grid place-items-center text-primary"><FileText className="h-8 w-8" /></div>
                      : <EvidenceImage id={e.id} alt={e.description} className="h-28 w-28 rounded-xl" />}
                    <figcaption className="text-[10px] text-muted-foreground mt-1">{e.stage} · {e.createdByName}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card-clay p-5">
            <h2 className="font-display font-bold mb-3">Participantes</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Solicitante</dt><dd className="font-semibold">{uName(m.requestedBy)}</dd></div>
              {m.approvals.map(a => (
                <div key={a.userId}>
                  <dt className="text-xs text-muted-foreground">Aprovação</dt>
                  <dd className="font-semibold flex items-center gap-2">{uName(a.userId)}
                    <span className={cn('text-[10px] font-bold uppercase', a.status === 'aprovada' ? 'text-success' : a.status === 'rejeitada' ? 'text-destructive' : 'text-warning')}>{a.status}</span>
                  </dd>
                </div>
              ))}
              <div><dt className="text-xs text-muted-foreground">Entrega</dt><dd className="font-semibold">{uName(m.delivererId)}{m.delivery && <span className="block text-xs font-normal text-muted-foreground">{fmtDateTime(m.delivery.at)}</span>}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Recebimento</dt><dd className="font-semibold">{uName(m.receiverId)}{m.receipt && <span className="block text-xs font-normal text-muted-foreground">{fmtDateTime(m.receipt.at)}</span>}</dd></div>
            </dl>
            {m.receipt?.hasIssue && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive font-semibold">Ocorrência: {m.receipt.issueDescription}</div>}
          </section>

          <section className="card-clay p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">Histórico auditável</h2>
              <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold', chain.valid ? 'text-success' : 'text-destructive')}>
                {chain.valid ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}{chain.valid ? 'Cadeia íntegra' : `Quebrada em #${chain.brokenAt}`}
              </span>
            </div>
            <ol className="mt-3 relative border-l-2 border-dashed border-primary/30 ml-2 space-y-4">
              {events.map(e => (
                <li key={e.id} className="pl-4 relative">
                  <span className="absolute -left-[7px] top-1 h-3 w-3 rotate-45 bg-primary" />
                  <div className="text-sm font-semibold leading-snug">{e.summary}</div>
                  <div className="text-xs text-muted-foreground">{e.performedByName}{e.actedAs === 'admin' ? ' (como administrador)' : ''} · {fmtDateTime(e.occurredAt)}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1"><Link2 className="h-3 w-3" />{e.hash.slice(0, 16)}…</div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <ApprovalDialog data={data} mode={dialog === 'approve' || dialog === 'reject' ? dialog : null} onClose={() => setDialog(null)} />
      <HandoverDialog data={data} stage={dialog === 'deliver' ? 'entrega' : dialog === 'receive' ? 'recebimento' : null} onClose={() => setDialog(null)} />
      <SimpleNoteDialog data={data} mode={dialog === 'resolve' || dialog === 'cancel' ? dialog : null} onClose={() => setDialog(null)} />
    </div>
  );
};

function useMovementMutation(id: string, onDone: () => void) {
  const qc = useQueryClient();
  return (fn: () => Promise<unknown>, success: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movement', id] });
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(success);
      onDone();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
}

const ApprovalDialog: React.FC<{ data: MovementDetail; mode: 'approve' | 'reject' | null; onClose: () => void }> = ({ data, mode, onClose }) => {
  const [note, setNote] = useState('');
  const opts = useMovementMutation(data.movement.id, onClose);
  const mut = useMutation(opts(() => movementsService.decide(data.movement.id, mode === 'approve' ? 'aprovada' : 'rejeitada', note), mode === 'approve' ? 'Aprovação registrada' : 'Movimentação rejeitada'));
  return (
    <Dialog open={!!mode} onOpenChange={o => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{mode === 'approve' ? 'Aprovar movimentação' : 'Rejeitar movimentação'}</DialogTitle>
          <DialogDescription>{data.movement.number} · {data.assets.length} bem(ns)</DialogDescription>
        </DialogHeader>
        <Field label={mode === 'reject' ? 'Motivo da rejeição' : 'Observação (opcional)'}><Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button variant={mode === 'approve' ? 'success' : 'destructive'} disabled={mut.isPending || (mode === 'reject' && !note.trim())} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const HandoverDialog: React.FC<{ data: MovementDetail; stage: 'entrega' | 'recebimento' | null; onClose: () => void }> = ({ data, stage, onClose }) => {
  const { user } = useAuth();
  const m = data.movement;
  const initial = () => Object.fromEntries(data.assets.map(a => [a.id, (stage === 'recebimento' ? m.delivery?.conditions.find(c => c.assetId === a.id)?.condition : null) || a.conservationStatus])) as Record<string, Conservation>;
  const [conditions, setConditions] = useState<Record<string, Conservation>>(initial);
  const [signature, setSignature] = useState<string | null>(null);
  const [signer, setSigner] = useState(user?.name || '');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [hasIssue, setHasIssue] = useState(false);
  const [issue, setIssue] = useState('');

  useEffect(() => {
    if (!stage) return;
    setConditions(initial()); setSignature(null); setNotes(''); setPhotos([]); setHasIssue(false); setIssue('');
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = useMovementMutation(m.id, onClose);
  const body = () => ({
    conditions: Object.entries(conditions).map(([asset_id, condition]) => ({ asset_id, condition })),
    signature, signer_name: signer, notes, photos,
    ...(stage === 'recebimento' ? { has_issue: hasIssue, issue_description: issue } : {}),
  });
  const mut = useMutation(opts(
    () => (stage === 'entrega' ? movementsService.deliver(m.id, body()) : movementsService.receive(m.id, body())),
    stage === 'entrega' ? 'Entrega confirmada e assinada' : 'Recebimento registrado',
  ));

  return (
    <Dialog open={!!stage} onOpenChange={o => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{stage === 'entrega' ? 'Confirmar entrega' : 'Confirmar recebimento'}</DialogTitle>
          <DialogDescription>Confira o estado de cada bem, registre fotos se necessário e assine.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {data.assets.map(a => (
              <div key={a.id} className="rounded-xl border p-3">
                <div className="text-sm font-semibold"><code className="text-primary">{a.code}</code> · {a.description}</div>
                <div className="grid grid-cols-5 gap-1 mt-2">
                  {CONSERVATION_ORDER.map(c => (
                    <button key={c} type="button" onClick={() => setConditions({ ...conditions, [a.id]: c })}
                      className={cn('rounded-lg border py-1.5 text-[11px] font-bold', conditions[a.id] === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}>
                      {CONSERVATION[c].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {stage === 'recebimento' && (
            <div className="rounded-xl border border-dashed p-3 space-y-2">
              <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                Houve avaria, falta ou divergência?
                <Switch checked={hasIssue} onCheckedChange={setHasIssue} />
              </label>
              {hasIssue && <Textarea value={issue} onChange={e => setIssue(e.target.value)} placeholder="Descreva a ocorrência" rows={2} />}
              <p className="text-[11px] text-muted-foreground">Se o estado piorar em relação à entrega, a ocorrência é aberta automaticamente e um gestor decide.</p>
            </div>
          )}
          <Field label="Fotos e documentos"><PhotoPicker value={photos} onChange={setPhotos} max={4} allowPdf={false} /></Field>
          <Field label="Observações"><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></Field>
          <Field label="Nome de quem assina"><Input value={signer} onChange={e => setSigner(e.target.value)} /></Field>
          <SignaturePad onChange={setSignature} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button disabled={!signature || mut.isPending || (hasIssue && !issue.trim())} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Assinar e confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SimpleNoteDialog: React.FC<{ data: MovementDetail; mode: 'resolve' | 'cancel' | null; onClose: () => void }> = ({ data, mode, onClose }) => {
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<'concluir' | 'desfazer'>('concluir');
  const opts = useMovementMutation(data.movement.id, onClose);
  const mut = useMutation(opts(
    () => (mode === 'resolve' ? movementsService.resolveIssue(data.movement.id, outcome, note) : movementsService.cancel(data.movement.id, note)),
    mode === 'resolve' ? 'Ocorrência tratada' : 'Movimentação cancelada',
  ));
  return (
    <Dialog open={!!mode} onOpenChange={o => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{mode === 'resolve' ? 'Tratar ocorrência do recebimento' : 'Cancelar movimentação'}</DialogTitle>
          <DialogDescription>{mode === 'resolve' ? data.movement.receipt?.issueDescription : 'Os bens permanecem na origem.'}</DialogDescription>
        </DialogHeader>
        {mode === 'resolve' && (
          <div className="grid grid-cols-2 gap-2">
            {(['concluir', 'desfazer'] as const).map(o => (
              <button key={o} onClick={() => setOutcome(o)} className={cn('rounded-xl border p-3 text-left text-sm', outcome === o ? 'border-primary bg-primary/10' : 'hover:bg-accent')}>
                <div className="font-bold">{o === 'concluir' ? 'Concluir mesmo assim' : 'Desfazer movimentação'}</div>
                <div className="text-xs text-muted-foreground">{o === 'concluir' ? 'Bens passam ao destino com o estado registrado' : 'Bens voltam a constar na origem'}</div>
              </button>
            ))}
          </div>
        )}
        <Field label="Justificativa"><Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button disabled={note.trim().length < 3 || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending && <Loader2 className="animate-spin" />} Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MovimentacaoDetalhe;
