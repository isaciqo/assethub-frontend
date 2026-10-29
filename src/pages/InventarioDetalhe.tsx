import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Download, FileText, Loader2, Lock, MapPin, ScanLine, Sheet as SheetIcon, Smartphone, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BarList, CheckStatusBadge, EmptyState, GeoTag, PageHeader, Spinner, StatTile } from '@/components/common';
import { VaseProgress } from '@/components/brand/Brand';
import { useInventory } from '@/hooks/queries';
import { inventoriesService, unitsService } from '@/services/api';
import { getPosition } from '@/lib/geo';
import { downloadFile, openFile } from '@/services/http';
import { prepareOffline, useOfflineInventory } from '@/offline/hooks';
import { useAuth } from '@/lib/auth-context';
import { CHECK_METHOD } from '@/lib/labels';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError } from '@/types';

const InventarioDetalhe: React.FC = () => {
  const { id } = useParams();
  const { data: inv, isLoading } = useInventory(id);
  const { snapshot, ops } = useOfflineInventory(id);
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmClose, setConfirmClose] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const complete = useMutation({
    mutationFn: () => inventoriesService.complete(id!),
    onSuccess: r => {
      qc.invalidateQueries();
      toast.success(`Inventário encerrado — ${r.summary?.notFound ?? 0} bem(ns) não localizado(s) viraram pendência`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  // O gerente, no prédio, fixa a posição atual como o ponto da unidade.
  const pinUnit = useMutation({
    mutationFn: async () => {
      const geo = await getPosition(15_000);
      if (!geo) throw { message: 'Não foi possível obter a localização. Libere o GPS para este site e tente de novo.' };
      return unitsService.setLocation(inv!.unit.id, geo);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', id] });
      qc.invalidateQueries({ queryKey: ['units'] });
      toast.success('Ponto da unidade fixado aqui. As próximas ações vão mostrar se foram feitas na unidade.');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  if (isLoading) return <Spinner />;
  if (!inv) return <EmptyState title="Inventário indisponível" description="Sem conexão? Se ele foi preparado neste aparelho, a conferência continua em Conferir." action={<Button asChild><Link to="/conferir">Conferir</Link></Button>} />;

  const s = inv.summary!;
  const open = inv.status === 'em_andamento';
  const pendingLocal = ops.filter(o => o.status !== 'SYNCED').length;

  const prepareAndGo = async () => {
    setPreparing(true);
    try {
      const { persisted } = await prepareOffline(inv.id, user?.name || '');
      toast.success('Inventário pronto para uso offline neste aparelho', { description: persisted ? 'Armazenamento persistente concedido.' : 'O navegador não garantiu armazenamento persistente — sincronize com frequência.' });
      navigate(`/conferir/${inv.id}`);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={inv.number}
        title={inv.name}
        subtitle={<>{inv.unit.name}{inv.locations.length ? ` · ${inv.locations.join(', ')}` : ' · comarca inteira'} · aberto {fmtRelative(inv.startedAt)}</>}
        actions={
          <>
            {open && (
              <Button variant="urucum" onClick={prepareAndGo} disabled={preparing}>
                {preparing ? <Loader2 className="animate-spin" /> : <ScanLine />} {snapshot ? 'Continuar conferência' : 'Conferir neste aparelho'}
              </Button>
            )}
            <Button variant="outline" asChild><Link to={`/pendencias?inventario=${inv.id}`}><TriangleAlert /> Pendências ({s.openDiscrepancies})</Link></Button>
            {can('admin', 'gestor') && (
              <Button variant="outline" onClick={() => pinUnit.mutate()} disabled={pinUnit.isPending} title="Use estando no prédio da unidade">
                {pinUnit.isPending ? <Loader2 className="animate-spin" /> : <MapPin />} {inv.unit.geo ? 'Refixar ponto da unidade' : 'Fixar ponto da unidade aqui'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="card-clay p-5 flex flex-col items-center text-center">
          <VaseProgress value={s.progress} size={190} label="conferido" />
          <div className="mt-3 font-display text-2xl font-bold tabular">{s.checked} <span className="text-muted-foreground text-base font-semibold">de {s.expected}</span></div>
          <div className="text-xs text-muted-foreground">bens previstos conferidos</div>
          <Badge variant={open ? 'info' : 'ok'} className="mt-3">{open ? 'Em andamento' : `Concluído ${fmtRelative(inv.completedAt)}`}</Badge>
          {snapshot && (
            <div className="mt-4 w-full rounded-xl bg-success/10 text-success text-xs font-semibold p-2.5 flex items-center gap-2">
              <Smartphone className="h-4 w-4 shrink-0" /> Disponível offline neste aparelho{pendingLocal ? ` · ${pendingLocal} a enviar` : ''}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile tone="ok" label="Sem divergência" value={s.ok} />
            <StatTile tone="warn" label="Com divergência" value={s.divergent + s.otherUnit} hint={s.otherUnit ? `${s.otherUnit} de outra comarca` : undefined} />
            <StatTile tone="danger" label={open ? 'Faltam conferir' : 'Não localizados'} value={open ? s.remaining : s.notFound} />
            <StatTile tone="info" label="Tempo médio/bem" value={s.avgSeconds ? `${s.avgSeconds.toFixed(1)}s` : '—'} hint={`${s.offline} offline · ${s.notRegistered} não cadastrado(s)`} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="card-clay p-5">
              <h2 className="font-display font-bold">Progresso por setor</h2>
              <div className="mt-4 max-h-80 overflow-y-auto pr-1">
                <BarList rows={(s.byLocation || []).map(l => ({ label: l.location, value: l.checked, max: l.expected, display: `${l.checked}/${l.expected}`, hint: `${l.location}: ${l.checked} de ${l.expected}` }))} />
              </div>
            </section>
            <section className="card-clay p-5">
              <h2 className="font-display font-bold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Equipe</h2>
              <ul className="mt-3 space-y-2">
                {inv.team.length === 0 && <li className="text-sm text-muted-foreground">Ninguém conferiu ainda.</li>}
                {inv.team.map((t, i) => (
                  <li key={t.userId} className="flex items-center justify-between text-sm">
                    <span><span className="text-muted-foreground tabular mr-2">{i + 1}.</span>{t.name}</span>
                    <span className="font-bold tabular">{t.count}</span>
                  </li>
                ))}
              </ul>
              {s.byMethod && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {Object.entries(s.byMethod).map(([m, n]) => <span key={m} className="text-[11px] rounded-full bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground">{CHECK_METHOD[m as keyof typeof CHECK_METHOD]}: {n}</span>)}
                </div>
              )}
            </section>
          </div>

          <section className="card-clay p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold">Relatório consolidado</h2>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadFile(`/inventories/${inv.id}/export`, { format: 'xlsx' }).catch((e: ApiError) => toast.error(e.message))}><SheetIcon /> Planilha XLSX</Button>
                <Button size="sm" variant="outline" onClick={() => downloadFile(`/inventories/${inv.id}/export`, { format: 'csv' }).catch((e: ApiError) => toast.error(e.message))}><Download /> CSV</Button>
                <Button size="sm" variant="outline" onClick={() => openFile(`/inventories/${inv.id}/export?format=pdf`).catch((e: ApiError) => toast.error(e.message))}><FileText /> PDF</Button>
                {open && can('admin', 'gestor') && <Button size="sm" onClick={() => setConfirmClose(true)}><Lock /> Encerrar inventário</Button>}
              </div>
            </div>
          </section>

          <section className="card-clay p-5">
            <h2 className="font-display font-bold">Últimas conferências <span className="text-xs text-muted-foreground font-normal">(atualiza sozinho)</span></h2>
            <ul className="mt-3 divide-y">
              {inv.recentChecks.length === 0 && <li className="py-3 text-sm text-muted-foreground">Nenhuma conferência ainda.</li>}
              {inv.recentChecks.slice(0, 15).map(c => (
                <li key={c.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <code className="text-xs font-bold text-primary w-20 shrink-0">{c.assetCode}</code>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{c.assetDescription || '—'}</div>
                    <div className="text-xs text-muted-foreground">{c.checkedByName} · {fmtDateTime(c.checkedAt)} · {CHECK_METHOD[c.method]}{c.wasOffline ? ' · offline' : ''}</div>
                    <GeoTag geo={c.geo} />
                  </div>
                  <CheckStatusBadge value={c.status} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar {inv.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {s.remaining} bem(ns) ainda não conferidos viram pendências de "não localizado" para revisão. Nada muda no cadastro dos bens até alguém decidir cada pendência.
              {pendingLocal > 0 && <strong className="block mt-2 text-destructive">Atenção: este aparelho tem {pendingLocal} conferência(s) ainda não enviadas. Sincronize antes de encerrar.</strong>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => complete.mutate()}><CheckCheck className="h-4 w-4 mr-1" /> Encerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InventarioDetalhe;
