import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CheckMethod, CheckStatus, Conservation, InventorySnapshot } from '@/types';
import type { GeoFix } from '@/lib/geo';

// Tudo que a conferência precisa para funcionar sem internet mora aqui — e não
// em useState: recarregar a página, fechar o app ou o aparelho dormir não
// apagam nada. Só limpar os dados do navegador apaga (por isso pedimos
// armazenamento persistente ao preparar o inventário).

export type OpStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

// Avaliação local, feita na hora (offline), só para dar retorno imediato.
// A palavra final é do servidor (check.status no resultado da sincronização).
export type LocalStatus = 'ok' | 'divergente' | 'nao_previsto';

export interface PendingOp {
  operation_id: string;
  inventory_id: string;
  asset_id: string | null;
  asset_code: string;
  observed_location: string;
  observed_condition: Conservation;
  observed_responsible: string;
  observed_description: string;
  notes: string;
  photo: string | null;
  method: CheckMethod;
  elapsed_ms: number | null;
  checked_at: string;
  device_id: string;
  was_offline: boolean;
  geo?: GeoFix | null;
  // Campos só do aparelho (não vão para a API):
  status: OpStatus;
  local_status: LocalStatus;
  asset_description: string;
  attempts: number;
  last_error: string | null;
  server_status: CheckStatus | null;
  server_result: string | null;
  synced_at: string | null;
}

export interface StoredSnapshot extends InventorySnapshot {
  preparedAt: string;
  preparedBy: string;
}

interface AssetHubDB extends DBSchema {
  snapshots: { key: string; value: StoredSnapshot };
  ops: {
    key: string;
    value: PendingOp;
    indexes: { by_inventory: string; by_status: OpStatus };
  };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<AssetHubDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<AssetHubDB>('assethub', 1, {
      upgrade(d) {
        d.createObjectStore('snapshots');
        const ops = d.createObjectStore('ops', { keyPath: 'operation_id' });
        ops.createIndex('by_inventory', 'inventory_id');
        ops.createIndex('by_status', 'status');
        d.createObjectStore('kv');
      },
    });
  }
  return dbPromise;
}

export const offlineDb = {
  async saveSnapshot(s: StoredSnapshot) {
    await (await db()).put('snapshots', s, s.inventory.id);
  },
  async getSnapshot(inventoryId: string) {
    return (await db()).get('snapshots', inventoryId);
  },
  async listSnapshots() {
    return (await db()).getAll('snapshots');
  },
  async deleteSnapshot(inventoryId: string) {
    await (await db()).delete('snapshots', inventoryId);
  },

  async addOp(op: PendingOp) {
    await (await db()).put('ops', op);
  },
  async updateOp(id: string, patch: Partial<PendingOp>) {
    const d = await db();
    const tx = d.transaction('ops', 'readwrite');
    const current = await tx.store.get(id);
    if (current) await tx.store.put({ ...current, ...patch });
    await tx.done;
  },
  async deleteOp(id: string) {
    await (await db()).delete('ops', id);
  },
  async listOps(inventoryId?: string) {
    const d = await db();
    const list = inventoryId ? await d.getAllFromIndex('ops', 'by_inventory', inventoryId) : await d.getAll('ops');
    return list.sort((a, b) => b.checked_at.localeCompare(a.checked_at));
  },
  async listByStatus(status: OpStatus) {
    return (await db()).getAllFromIndex('ops', 'by_status', status);
  },
  // Limpa do aparelho o que o servidor já confirmou (a foto pesa).
  async clearSynced(inventoryId?: string) {
    const ops = await this.listOps(inventoryId);
    const d = await db();
    const tx = d.transaction('ops', 'readwrite');
    await Promise.all(ops.filter(o => o.status === 'SYNCED').map(o => tx.store.delete(o.operation_id)));
    await tx.done;
  },

  async getKv<T>(key: string) {
    return (await (await db()).get('kv', key)) as T | undefined;
  },
  async setKv(key: string, value: unknown) {
    await (await db()).put('kv', value, key);
  },
};

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage || 0, quota: e.quota || 0 } : null;
  } catch {
    return null;
  }
}
