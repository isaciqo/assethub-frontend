import React, { useEffect, useState } from 'react';
import { CloudOff, Database, HardDrive, Loader2, RefreshCw, ShieldCheck, Trash2, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, StatTile } from '@/components/common';
import { useOnline, useSnapshots, useSyncState } from '@/offline/hooks';
import { offlineDb, requestPersistentStorage, storageEstimate, type PendingOp } from '@/offline/db';
import { refreshCounts, syncNow } from '@/offline/sync';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { deviceId } from '@/lib/device';
import { toast } from '@/components/ui/sonner';

const STATUS_VARIANT = { PENDING: 'warn', SYNCED: 'ok', FAILED: 'danger', CONFLICT: 'danger' } as const;
const STATUS_LABEL = { PENDING: 'Aguardando envio', SYNCED: 'Sincronizado', FAILED: 'Falhou', CONFLICT: 'Conflito' } as const;

// Transparência total sobre o que está no aparelho: o conferente sabe exatamente
// o que já foi enviado, o que falta e o que precisa de atenção.
const Sincronizacao: React.FC = () => {
  const online = useOnline();
  const sync = useSyncState();
  const { snapshots } = useSnapshots();
  const [ops, setOps] = useState<PendingOp[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const reload = () => offlineDb.listOps().then(setOps);
  useEffect(() => { reload(); }, [sync.counts, sync.syncing]);
  useEffect(() => {
    storageEstimate().then(setStorage);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const discard = async (op: PendingOp) => {
    if (!window.confirm(`Descartar a conferência do bem ${op.asset_code}? Ela não foi aceita pelo servidor: ${op.last_error || ''}`)) return;
    await offlineDb.deleteOp(op.operation_id);
    await refreshCounts();
    reload();
  };

  const clean = async () => {
    await offlineDb.clearSynced();
    await refreshCounts();
    reload();
    toast.success('Conferências já sincronizadas removidas do aparelho');
  };

  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sincronização"
        subtitle="O que está guardado neste aparelho e o que já chegou ao servidor."
        actions={<Button onClick={() => syncNow()} disabled={!online || sync.syncing}>{sync.syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sincronizar agora</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={online ? Wifi : CloudOff} tone={online ? 'ok' : 'warn'} label="Conexão" value={online ? 'Online' : 'Offline'} hint={sync.lastSyncAt ? `última sincronização ${fmtRelative(sync.lastSyncAt)}` : 'ainda não sincronizou'} />
        <StatTile tone="warn" label="Aguardando envio" value={sync.counts.pending} />
        <StatTile tone="danger" label="Falhas / conflitos" value={sync.counts.failed + sync.counts.conflict} />
        <StatTile tone="ok" label="Sincronizadas" value={sync.counts.synced} hint={sync.counts.synced ? <button className="underline" onClick={clean}>limpar do aparelho</button> : undefined} />
      </div>
      {sync.lastError && <div className="mt-3 rounded-xl bg-warning/15 text-sm p-3">{sync.lastError}</div>}

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <section className="card-clay p-5 space-y-2 text-sm">
          <h2 className="font-display font-bold flex items-center gap-2"><HardDrive className="h-4 w-4 text-primary" /> Armazenamento do aparelho</h2>
          <p>Identificador do aparelho: <code className="font-bold">{deviceId()}</code></p>
          <p>Uso: {storage ? `${mb(storage.usage)} de ${mb(storage.quota)}` : 'indisponível'}</p>
          <p className="flex items-center gap-2">
            Armazenamento persistente: {persisted ? <Badge variant="ok"><ShieldCheck className="h-3 w-3" /> concedido</Badge> : <Badge variant="warn">não garantido</Badge>}
            {!persisted && <Button size="sm" variant="outline" onClick={async () => setPersisted(await requestPersistentStorage())}>Solicitar</Button>}
          </p>
          <p className="text-xs text-muted-foreground">Os dados sobrevivem a recarregar a página e fechar o app. Limpar os dados do navegador ou desinstalar o app apaga o que ainda não foi enviado.</p>
        </section>
        <section className="card-clay p-5">
          <h2 className="font-display font-bold flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Inventários no aparelho</h2>
          <ul className="mt-2 divide-y text-sm">
            {snapshots.length === 0 && <li className="py-2 text-muted-foreground">Nenhum.</li>}
            {snapshots.map(s => <li key={s.inventory.id} className="py-2"><strong>{s.inventory.number}</strong> · {s.assets.length} bens · preparado {fmtRelative(s.preparedAt)}</li>)}
          </ul>
        </section>
      </div>

      <section className="card-clay mt-4 overflow-hidden">
        <h2 className="font-display font-bold px-5 pt-4">Fila de operações</h2>
        <ul className="divide-y mt-3">
          {ops.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nenhuma operação neste aparelho.</li>}
          {ops.map(o => (
            <li key={o.operation_id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
              <code className="font-bold text-primary w-20">{o.asset_code}</code>
              <div className="min-w-0 flex-1">
                <div className="truncate">{o.asset_description}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">op {o.operation_id.slice(0, 8)} · {fmtDateTime(o.checked_at)}{o.was_offline ? ' · feita offline' : ''}{o.server_result === 'duplicate_operation' ? ' · reenvio reconhecido (sem duplicar)' : ''}</div>
                {o.last_error && <div className="text-xs text-destructive">{o.last_error}</div>}
              </div>
              <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
              {o.status === 'CONFLICT' && <Button size="sm" variant="ghost" onClick={() => discard(o)}><Trash2 /> Descartar</Button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Sincronizacao;
