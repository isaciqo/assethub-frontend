import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudDownload, Loader2, ScanLine, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Spinner } from '@/components/common';
import { VaseProgress } from '@/components/brand/Brand';
import { useInventories } from '@/hooks/queries';
import { prepareOffline, useOnline, useSnapshots } from '@/offline/hooks';
import { offlineDb } from '@/offline/db';
import { useAuth } from '@/lib/auth-context';
import { fmtRelative } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError } from '@/types';

// Escolha do inventário para conferir. Mostra primeiro o que já está no
// aparelho (funciona sem internet) e depois os abertos no servidor.
const Conferir: React.FC = () => {
  const online = useOnline();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { snapshots, reload } = useSnapshots();
  const { data: open, isLoading } = useInventories({ status: 'em_andamento' });
  const [busy, setBusy] = useState<string | null>(null);

  const prepare = async (id: string) => {
    setBusy(id);
    try {
      await prepareOffline(id, user?.name || '');
      navigate(`/conferir/${id}`);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    const ops = await offlineDb.listOps(id);
    if (ops.some(o => o.status !== 'SYNCED')) {
      toast.error('Há conferências deste inventário ainda não enviadas. Sincronize antes de remover.');
      return;
    }
    await offlineDb.clearSynced(id);
    await offlineDb.deleteSnapshot(id);
    reload();
  };

  // Inventário preparado aqui que não está mais aberto no servidor foi
  // encerrado: a lista guardada é antiga. Sem conferências a enviar, sai do
  // aparelho; com conferências pendentes, fica só para sincronizar.
  const isClosed = (id: string) => online && !!open && !open.some(i => i.id === id);
  useEffect(() => {
    if (!online || !open) return;
    const stale = snapshots.filter(s => !open.some(i => i.id === s.inventory.id));
    if (!stale.length) return;
    Promise.all(stale.map(async s => {
      const ops = await offlineDb.listOps(s.inventory.id);
      if (ops.some(o => o.status !== 'SYNCED')) return false;
      await offlineDb.clearSynced(s.inventory.id);
      await offlineDb.deleteSnapshot(s.inventory.id);
      return true;
    })).then(r => { if (r.some(Boolean)) reload(); });
  }, [online, open, snapshots, reload]);

  const notPrepared = (open || []).filter(i => !snapshots.some(s => s.inventory.id === i.id));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Conferir bens" subtitle="Prepare o inventário enquanto há internet; depois a conferência funciona mesmo sem sinal." />

      <h2 className="font-display font-bold mb-3 flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Neste aparelho</h2>
      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-8">Nenhum inventário preparado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {snapshots.map(s => {
            const checked = s.serverChecks.length;
            const pct = s.assets.length ? Math.round((checked / s.assets.length) * 100) : 0;
            return (
              <div key={s.inventory.id} className="card-clay p-4 flex items-center gap-4">
                <VaseProgress value={pct} size={70} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-urucum">{s.inventory.number}</div>
                  <div className="font-semibold leading-tight truncate">{s.inventory.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {isClosed(s.inventory.id) ? 'Encerrado · sincronize as conferências pendentes' : `${s.unit.name} · preparado ${fmtRelative(s.preparedAt)}`}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!isClosed(s.inventory.id) && <Button asChild variant="urucum" size="sm"><Link to={`/conferir/${s.inventory.id}`}><ScanLine /> Conferir</Link></Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(s.inventory.id)} aria-label="Remover do aparelho"><Trash2 /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="font-display font-bold mb-3 flex items-center gap-2"><CloudDownload className="h-4 w-4 text-primary" /> Inventários abertos</h2>
      {!online ? (
        <p className="text-sm text-muted-foreground">Sem conexão — só os inventários já preparados neste aparelho estão disponíveis.</p>
      ) : isLoading ? <Spinner /> : notPrepared.length === 0 ? (
        snapshots.length === 0
          ? <EmptyState icon={ScanLine} title="Nenhum inventário aberto" description="Um gerente precisa abrir o inventário da comarca ou do setor primeiro." action={<Button asChild variant="outline"><Link to="/inventarios">Ver inventários</Link></Button>} />
          : <p className="text-sm text-muted-foreground">Todos os inventários abertos já estão neste aparelho.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notPrepared.map(inv => (
            <div key={inv.id} className="card-clay p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-urucum">{inv.number}</div>
                <div className="font-semibold leading-tight truncate">{inv.name}</div>
                <div className="text-xs text-muted-foreground tabular">{inv.summary?.checked}/{inv.summary?.expected} conferidos</div>
              </div>
              <Button className="shrink-0" onClick={() => prepare(inv.id)} disabled={busy === inv.id}>
                {busy === inv.id ? <Loader2 className="animate-spin" /> : <CloudDownload />} Preparar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Conferir;
