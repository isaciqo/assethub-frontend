import { http, isOfflineError } from '@/services/http';
import type { CheckStatus } from '@/types';
import { offlineDb, type PendingOp } from './db';

// Motor de sincronização. Regras:
//  • só marca SYNCED o que o servidor confirmou (applied / duplicate_*);
//  • reenvio é seguro — o operation_id é a chave de idempotência no backend;
//  • rejeitada pelo servidor (ex.: inventário encerrado) vira CONFLICT, para
//    revisão, nunca é descartada em silêncio;
//  • sem conexão, nada muda: as operações continuam PENDING.
// Não dependemos de Background Sync (não existe em todos os navegadores):
// sincroniza ao voltar a conexão, a cada 30 s e no botão "Sincronizar agora".

type SyncResult = {
  operationId: string;
  result: 'applied' | 'duplicate_operation' | 'duplicate_check' | 'rejected' | 'failed';
  message?: string;
  check?: { status: CheckStatus };
};

export interface SyncState {
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  reachable: boolean;
  counts: { pending: number; failed: number; conflict: number; synced: number };
}

let state: SyncState = {
  syncing: false,
  lastSyncAt: null,
  lastError: null,
  reachable: typeof navigator === 'undefined' ? true : navigator.onLine,
  counts: { pending: 0, failed: 0, conflict: 0, synced: 0 },
};
const listeners = new Set<() => void>();
const emit = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
};

export const syncStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

export async function refreshCounts() {
  const ops = await offlineDb.listOps();
  const counts = { pending: 0, failed: 0, conflict: 0, synced: 0 };
  ops.forEach(o => {
    if (o.status === 'PENDING') counts.pending += 1;
    else if (o.status === 'FAILED') counts.failed += 1;
    else if (o.status === 'CONFLICT') counts.conflict += 1;
    else counts.synced += 1;
  });
  emit({ counts });
  return counts;
}

const BATCH = 15;

function toPayload(op: PendingOp) {
  return {
    operation_id: op.operation_id,
    inventory_id: op.inventory_id,
    asset_id: op.asset_id || undefined,
    asset_code: op.asset_code,
    observed_location: op.observed_location,
    observed_condition: op.observed_condition,
    observed_responsible: op.observed_responsible,
    observed_description: op.observed_description,
    notes: op.notes,
    photo: op.photo || undefined,
    method: op.method,
    elapsed_ms: op.elapsed_ms ?? undefined,
    checked_at: op.checked_at,
    device_id: op.device_id,
    was_offline: op.was_offline,
  };
}

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  if (!localStorage.getItem('assethub_token')) return;
  const queue = [...(await offlineDb.listByStatus('PENDING')), ...(await offlineDb.listByStatus('FAILED'))]
    .sort((a, b) => a.checked_at.localeCompare(b.checked_at));
  if (!queue.length) {
    await refreshCounts();
    return;
  }

  emit({ syncing: true, lastError: null });
  try {
    for (let i = 0; i < queue.length; i += BATCH) {
      const batch = queue.slice(i, i + BATCH);
      let response: { results: SyncResult[] };
      try {
        response = await http.post('/sync/checks', { operations: batch.map(toPayload) });
        emit({ reachable: true });
      } catch (err) {
        if (isOfflineError(err)) {
          emit({ reachable: false, lastError: 'Sem conexão — as conferências continuam salvas no aparelho.' });
          return;
        }
        // Erro de validação do lote inteiro: marca o lote como FAILED com a
        // mensagem, para aparecer na tela de sincronização.
        const message = (err as { message?: string })?.message || 'Erro ao sincronizar';
        await Promise.all(batch.map(o => offlineDb.updateOp(o.operation_id, { status: 'FAILED', attempts: o.attempts + 1, last_error: message })));
        emit({ lastError: message });
        continue;
      }

      const now = new Date().toISOString();
      await Promise.all(response.results.map(r => {
        const op = batch.find(o => o.operation_id === r.operationId);
        if (!op) return null;
        if (r.result === 'applied' || r.result === 'duplicate_operation' || r.result === 'duplicate_check') {
          return offlineDb.updateOp(op.operation_id, {
            status: 'SYNCED',
            server_status: r.check?.status ?? null,
            server_result: r.result,
            synced_at: now,
            last_error: null,
            // Foto já está no servidor; tira do aparelho para liberar espaço.
            photo: null,
          });
        }
        if (r.result === 'rejected') {
          return offlineDb.updateOp(op.operation_id, { status: 'CONFLICT', server_result: r.result, last_error: r.message || 'Rejeitada pelo servidor' });
        }
        return offlineDb.updateOp(op.operation_id, { status: 'FAILED', attempts: op.attempts + 1, last_error: r.message || 'Falha ao gravar' });
      }));
    }
    emit({ lastSyncAt: new Date().toISOString() });
    await offlineDb.setKv('lastSyncAt', new Date().toISOString());
  } finally {
    emit({ syncing: false });
    await refreshCounts();
  }
}

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  offlineDb.getKv<string>('lastSyncAt').then(v => v && emit({ lastSyncAt: v }));
  refreshCounts();
  window.addEventListener('online', () => { emit({ reachable: true }); syncNow(); });
  window.addEventListener('offline', () => emit({ reachable: false }));
  setInterval(() => {
    if (navigator.onLine && (state.counts.pending || state.counts.failed)) syncNow();
  }, 30_000);
  if (navigator.onLine) syncNow();
}
