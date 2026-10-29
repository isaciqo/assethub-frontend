import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, ClipboardCheck, Loader2, MapPin, PackageCheck, PackagePlus, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConservationBadge, EmptyState, Spinner } from '@/components/common';
import { HandoverDialog } from '@/pages/MovimentacaoDetalhe';
import { MeusPedidos, PedirBemDialog } from '@/components/Solicitacoes';
import { placeLabel } from '@/components/Sectors';
import { useMovement, useMyArea } from '@/hooks/queries';
import { meService } from '@/services/api';
import { useAuth } from '@/lib/auth-context';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { ApiError, MyTask, PossessionCheck } from '@/types';

type HandoverTask = Extract<MyTask, { kind: 'enviar' | 'receber' }>;

const MinhaArea: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, error } = useMyArea();
  const [handover, setHandover] = useState<HandoverTask | null>(null);
  const [validating, setValidating] = useState<PossessionCheck | null>(null);
  const [asking, setAsking] = useState(false);

  if (isLoading) return <Spinner />;
  if (error || !data) return <EmptyState title="Não foi possível carregar" description="Verifique a conexão e tente de novo." />;

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <p className="text-sm font-semibold text-urucum">Olá, {user?.name.split(' ')[0]}</p>
        <h1 className="font-display text-3xl font-extrabold mt-1">Minha área</h1>
        <p className="text-sm text-muted-foreground mt-1">O que você precisa fazer e os bens que estão no seu nome.</p>
        <Button className="mt-4" size="lg" onClick={() => setAsking(true)}><PackagePlus /> Pedir um bem</Button>
        <MeusPedidos />
      </div>

      <section aria-labelledby="todo">
        <h2 id="todo" className="font-display text-lg font-bold flex items-center gap-2">
          Para fazer
          {data.tasks.length > 0 && <span className="rounded-full bg-urucum text-white text-xs px-2 py-0.5 tabular">{data.tasks.length}</span>}
        </h2>
        {data.tasks.length === 0 ? (
          <div className="mt-3 rounded-2xl border bg-card p-5 flex items-center gap-3">
            <CircleCheck className="h-6 w-6 text-success shrink-0" />
            <div>
              <p className="font-semibold">Tudo em dia</p>
              <p className="text-sm text-muted-foreground">Quando o gerente pedir algo para você, aparece aqui.</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {data.tasks.map(t => (t.kind === 'validar'
              ? <ValidateCard key={t.check.id} check={t.check} onOpen={() => setValidating(t.check)} />
              : <HandoverCard key={t.movementId} task={t} onOpen={() => setHandover(t)} />))}
          </div>
        )}
      </section>

      <section aria-labelledby="mine">
        <h2 id="mine" className="font-display text-lg font-bold">Meus bens <span className="text-muted-foreground font-semibold">({data.assets.length})</span></h2>
        {data.assets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum bem no seu nome.</p>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {data.assets.map(a => (
              <article key={a.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <code className="text-xs font-bold text-primary">{a.code}</code>
                  {a.status === 'em_movimentacao' ? <Badge variant="info">Em envio</Badge> : <ConservationBadge value={a.conservationStatus} />}
                </div>
                <p className="font-semibold leading-tight mt-1">{a.description}</p>
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {placeLabel(a.location, a.room)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <TaskHandover task={handover} onClose={() => setHandover(null)} />
      <ValidateDialog check={validating} onClose={() => setValidating(null)} />
      <PedirBemDialog open={asking} onOpenChange={setAsking} />
    </div>
  );
};

const TaskShell: React.FC<{ icon: React.ElementType; title: string; subtitle: string; action: React.ReactNode; children?: React.ReactNode }> = ({ icon: Icon, title, subtitle, action, children }) => (
  <article className="rounded-2xl border-2 border-urucum/30 bg-card p-4">
    <div className="flex items-start gap-3">
      <span className="h-11 w-11 shrink-0 rounded-xl bg-urucum/15 text-urucum grid place-items-center"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold leading-tight">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        {children}
      </div>
    </div>
    <div className="mt-3 flex justify-end">{action}</div>
  </article>
);

const HandoverCard: React.FC<{ task: HandoverTask; onOpen: () => void }> = ({ task, onOpen }) => {
  const send = task.kind === 'enviar';
  return (
    <TaskShell
      icon={send ? Send : PackageCheck}
      title={send ? `Enviar para ${task.to}` : `Receber de ${task.from}`}
      subtitle={`${task.number} · pedido ${fmtRelative(task.createdAt)}${task.destinationLocation ? ` · destino: ${task.destinationLocation}` : ''}`}
      action={<Button variant="urucum" onClick={onOpen}>{send ? <><Send /> Enviar</> : <><PackageCheck /> Confirmar recebimento</>}</Button>}
    >
      <ul className="mt-2 space-y-0.5">
        {task.assets.map(a => <li key={a.code} className="text-sm"><code className="text-primary font-bold">{a.code}</code> · {a.description}</li>)}
      </ul>
      {task.reason && <p className="text-xs italic text-muted-foreground mt-1.5">“{task.reason}”</p>}
    </TaskShell>
  );
};

const ValidateCard: React.FC<{ check: PossessionCheck; onOpen: () => void }> = ({ check, onOpen }) => (
  <TaskShell
    icon={ClipboardCheck}
    title="Validar seus bens"
    subtitle={`${check.requestedByName || 'O gerente'} pediu para você confirmar se ${check.total === 1 ? 'o bem ainda está' : `os ${check.total} bens ainda estão`} com você · ${fmtRelative(check.createdAt)}`}
    action={<Button variant="urucum" onClick={onOpen}><ClipboardCheck /> Validar</Button>}
  />
);

// Busca o detalhe da movimentação e reaproveita a assinatura de envio/recebimento.
const TaskHandover: React.FC<{ task: HandoverTask | null; onClose: () => void }> = ({ task, onClose }) => {
  const qc = useQueryClient();
  const { data } = useMovement(task?.movementId);
  if (!task || !data) return null;
  const close = () => {
    qc.invalidateQueries({ queryKey: ['me-area'] });
    onClose();
  };
  return <HandoverDialog data={data} stage={task.kind === 'enviar' ? 'entrega' : 'recebimento'} onClose={close} />;
};

const ValidateDialog: React.FC<{ check: PossessionCheck | null; onClose: () => void }> = ({ check, onClose }) => {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, { hasIt: boolean; note: string }>>({});
  useEffect(() => { setAnswers({}); }, [check?.id]);

  const mut = useMutation({
    mutationFn: () => meService.answer(check!.id, check!.items.map(i => ({ asset_id: i.assetId, has_it: answers[i.assetId].hasIt, note: answers[i.assetId].note }))),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['me-area'] });
      toast.success(r.missing ? `Respostas enviadas. ${r.missing} bem(ns) foram para o gerente verificar.` : 'Pronto! Todos os bens confirmados.');
      onClose();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const set = (id: string, hasIt: boolean) => setAnswers({ ...answers, [id]: { hasIt, note: answers[id]?.note || '' } });
  const done = !!check && check.items.every(i => answers[i.assetId]);

  return (
    <Dialog open={!!check} onOpenChange={o => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Validar seus bens</DialogTitle>
          <DialogDescription>Para cada bem, diga se ele ainda está com você.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {check?.items.map(i => {
            const a = answers[i.assetId];
            return (
              <div key={i.assetId} className="rounded-xl border p-3">
                <p className="text-sm font-semibold"><code className="text-primary">{i.code}</code> · {i.description}</p>
                {i.location && <p className="text-xs text-muted-foreground">{i.location}</p>}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button type="button" onClick={() => set(i.assetId, true)}
                    className={cn('rounded-xl border py-2.5 text-sm font-bold flex items-center justify-center gap-1.5', a?.hasIt === true ? 'bg-success text-white border-success' : 'hover:bg-accent')}>
                    <ThumbsUp className="h-4 w-4" /> Está comigo
                  </button>
                  <button type="button" onClick={() => set(i.assetId, false)}
                    className={cn('rounded-xl border py-2.5 text-sm font-bold flex items-center justify-center gap-1.5', a?.hasIt === false ? 'bg-destructive text-white border-destructive' : 'hover:bg-accent')}>
                    <ThumbsDown className="h-4 w-4" /> Não está
                  </button>
                </div>
                {a?.hasIt === false && (
                  <Input className="mt-2" placeholder="Sabe onde pode estar? (opcional)" value={a.note}
                    onChange={e => setAnswers({ ...answers, [i.assetId]: { hasIt: false, note: e.target.value } })} />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button disabled={!done || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Enviar respostas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MinhaArea;
