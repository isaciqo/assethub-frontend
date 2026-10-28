import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { inventoriesService } from '@/services/api';
import { offlineDb, requestPersistentStorage, type PendingOp, type StoredSnapshot } from './db';
import { refreshCounts, syncNow, syncStore } from './sync';

export function useSyncState() {
  return useSyncExternalStore(syncStore.subscribe, syncStore.get);
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const { reachable } = useSyncState();
  return online && reachable;
}

// Baixa o pacote do inventário para o aparelho (precisa de internet uma vez).
export async function prepareOffline(inventoryId: string, userName: string): Promise<{ snapshot: StoredSnapshot; persisted: boolean }> {
  const snap = await inventoriesService.snapshot(inventoryId);
  const stored: StoredSnapshot = { ...snap, preparedAt: new Date().toISOString(), preparedBy: userName };
  await offlineDb.saveSnapshot(stored);
  const persisted = await requestPersistentStorage();
  return { snapshot: stored, persisted };
}

export function useSnapshots() {
  const [list, setList] = useState<StoredSnapshot[]>([]);
  const reload = useCallback(() => { offlineDb.listSnapshots().then(setList); }, []);
  useEffect(() => { reload(); }, [reload]);
  return { snapshots: list, reload };
}

// Estado da conferência de UM inventário no aparelho: snapshot + operações
// locais. Recarrega sempre que a sincronização mexe na fila.
export function useOfflineInventory(inventoryId: string | undefined) {
  const [snapshot, setSnapshot] = useState<StoredSnapshot | null | undefined>(undefined);
  const [ops, setOps] = useState<PendingOp[]>([]);
  const sync = useSyncState();

  const reload = useCallback(async () => {
    if (!inventoryId) return;
    const [s, o] = await Promise.all([offlineDb.getSnapshot(inventoryId), offlineDb.listOps(inventoryId)]);
    setSnapshot(s ?? null);
    setOps(o);
  }, [inventoryId]);

  useEffect(() => { reload(); }, [reload, sync.counts, sync.syncing]);

  const addOp = useCallback(async (op: PendingOp) => {
    await offlineDb.addOp(op);
    await reload();
    await refreshCounts();
    if (navigator.onLine) syncNow();
  }, [reload]);

  const removeOp = useCallback(async (operationId: string) => {
    await offlineDb.deleteOp(operationId);
    await reload();
    await refreshCounts();
  }, [reload]);

  return { snapshot, ops, reload, addOp, removeOp };
}
