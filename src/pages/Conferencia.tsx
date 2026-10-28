import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, CameraOff, Check, CloudOff, Keyboard, Loader2, MapPin, PackageSearch, RefreshCw, Search, Zap, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, Field, Spinner } from '@/components/common';
import { VaseProgress } from '@/components/brand/Brand';
import { Scanner } from '@/components/Scanner';
import { PhotoPicker } from '@/components/PhotoPicker';
import { prepareOffline, useOfflineInventory, useOnline } from '@/offline/hooks';
import { offlineDb, type LocalStatus, type PendingOp } from '@/offline/db';
import { refreshCounts, syncNow } from '@/offline/sync';
import { useAuth } from '@/lib/auth-context';
import { deviceId, feedback, uuid } from '@/lib/device';
import { normalizeCode, normalizeText, fmtDateTime } from '@/lib/format';
import { CHECK_METHOD, CHECK_STATUS, CONSERVATION, CONSERVATION_ORDER } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { CheckMethod, Conservation, SnapshotAsset } from '@/types';

type Mode = 'rapida' | 'detalhada';

interface Draft {
  asset: SnapshotAsset | null;
  code: string;
  method: CheckMethod;
  location: string;
  condition: Conservation;
  responsible: string;
  description: string;
  notes: string;
  photos: string[];
  editing?: PendingOp;
}

const MAX_ELAPSED = 10 * 60 * 1000;

const OP_STATUS: Record<PendingOp['status'], { label: string; variant: 'warn' | 'ok' | 'danger' | 'muted' }> = {
  PENDING: { label: 'No aparelho', variant: 'warn' },
  SYNCED: { label: 'Enviado', variant: 'ok' },
  FAILED: { label: 'Falhou — tentará de novo', variant: 'danger' },
  CONFLICT: { label: 'Conflito', variant: 'danger' },
};

const LOCAL_STATUS: Record<LocalStatus, { label: string; variant: 'ok' | 'warn' | 'danger' }> = {
  ok: { label: 'Conferido', variant: 'ok' },
  divergente: { label: 'Divergência', variant: 'warn' },
  nao_previsto: { label: 'Não previsto', variant: 'danger' },
};

const Conferencia: React.FC = () => {
  const { inventoryId } = useParams();
  const { user } = useAuth();
  const online = useOnline();
  const { snapshot, ops, addOp, reload } = useOfflineInventory(inventoryId);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('assethub_scan_mode') as Mode) || 'rapida');
  const [room, setRoom] = useState(() => localStorage.getItem(`assethub_room_${inventoryId}`) || '');
  const [cameraOn, setCameraOn] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  const [preparing, setPreparing] = useState(false);
  const lastAt = useRef(Date.now());

  useEffect(() => { localStorage.setItem('assethub_scan_mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem(`assethub_room_${inventoryId}`, room); lastAt.current = Date.now(); }, [room, inventoryId]);

  // Com internet, atualiza o pacote a cada minuto: o que os colegas conferiram
  // em outros aparelhos aparece aqui como "já conferido".
  useEffect(() => {
    if (!online || !inventoryId || !snapshot) return undefined;
    const t = setInterval(() => { prepareOffline(inventoryId, user?.name || '').then(reload).catch(() => {}); }, 60_000);
    return () => clearInterval(t);
  }, [online, inventoryId, snapshot, user?.name, reload]);

  const byCode = useMemo(() => new Map((snapshot?.assets || []).map(a => [a.codeNormalized, a])), [snapshot]);
  const byId = useMemo(() => new Map((snapshot?.assets || []).map(a => [a.id, a])), [snapshot]);

  // Conferido = pelo servidor (qualquer aparelho) OU por este aparelho.
  const checked = useMemo(() => {
    const map = new Map<string, { by: string; at: string; local?: PendingOp }>();
    snapshot?.serverChecks.forEach(c => map.set(c.assetId, { by: c.checkedByName, at: c.checkedAt }));
    [...ops].reverse().forEach(o => { if (o.asset_id && !map.get(o.asset_id)?.local) map.set(o.asset_id, { by: user?.name || 'você', at: o.checked_at, local: o }); });
    return map;
  }, [snapshot, ops, user?.name]);

  const total = snapshot?.assets.length || 0;
  const done = snapshot ? snapshot.assets.filter(a => checked.has(a.id)).length : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const locations = useMemo(() => {
    const set = new Set([...(snapshot?.unit.locations || []), ...(snapshot?.assets.map(a => a.location).filter(Boolean) || [])]);
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [snapshot]);
  const roomAssets = useMemo(() => (snapshot?.assets || []).filter(a => !room || normalizeText(a.location) === normalizeText(room)), [snapshot, room]);
  const remaining = roomAssets.filter(a => !checked.has(a.id));

  const localStatusFor = (asset: SnapshotAsset | null, location: string, condition: Conservation, responsible: string): LocalStatus => {
    if (!asset) return 'nao_previsto';
    const diff = (location && normalizeText(location) !== normalizeText(asset.location))
      || condition !== asset.conservationStatus
      || (responsible && normalizeText(responsible) !== normalizeText(asset.responsibleName));
    return diff ? 'divergente' : 'ok';
  };

  const save = useCallback(async (d: Draft) => {
    const now = Date.now();
    const elapsed = Math.min(now - lastAt.current, MAX_ELAPSED);
    lastAt.current = now;
    const local_status = localStatusFor(d.asset, d.location, d.condition, d.responsible);

    if (d.editing && d.editing.status === 'PENDING') {
      await offlineDb.updateOp(d.editing.operation_id, {
        observed_location: d.location, observed_condition: d.condition, observed_responsible: d.responsible,
        observed_description: d.description, notes: d.notes, photo: d.photos[0] || null, local_status,
      });
      await reload();
      await refreshCounts();
      if (navigator.onLine) syncNow();
      toast.success('Conferência corrigida antes do envio');
      return;
    }

    await addOp({
      operation_id: uuid(),
      inventory_id: inventoryId!,
      asset_id: d.asset?.id || null,
      asset_code: d.asset?.code || d.code,
      observed_location: d.location,
      observed_condition: d.condition,
      observed_responsible: d.responsible,
      observed_description: d.description,
      notes: d.notes,
      photo: d.photos[0] || null,
      method: d.method,
      elapsed_ms: elapsed,
      checked_at: new Date().toISOString(),
      device_id: deviceId(),
      was_offline: !navigator.onLine,
      status: 'PENDING',
      local_status,
      asset_description: d.asset?.description || d.description || 'Bem não previsto',
      attempts: 0,
      last_error: null,
      server_status: null,
      server_result: null,
      synced_at: null,
    });
    feedback(local_status === 'ok' ? 'ok' : local_status === 'divergente' ? 'warn' : 'error');
  }, [addOp, inventoryId, reload]);

  const draftFor = (asset: SnapshotAsset | null, code: string, method: CheckMethod): Draft => ({
    asset, code, method,
    location: room || asset?.location || '',
    condition: asset?.conservationStatus || 'bom',
    responsible: '',
    description: '',
    notes: '',
    photos: [],
  });

  const handleCode = useCallback((raw: string, method: CheckMethod) => {
    if (!raw) {
      feedback('error');
      toast.error('Não consegui ler o número da plaqueta', { description: 'Aproxime a câmera, melhore a luz ou digite o tombamento.' });
      return;
    }
    const asset = byCode.get(normalizeCode(raw)) || null;

    if (!asset) {
      feedback('error');
      setCameraOn(false);
      setDraft(draftFor(null, raw.trim(), method));
      return;
    }

    const prev = checked.get(asset.id);
    if (prev) {
      feedback('warn');
      toast.warning(`${asset.code} já foi conferido`, {
        description: `por ${prev.by} em ${fmtDateTime(prev.at)}`,
        action: prev.local && prev.local.status === 'PENDING'
          ? { label: 'Corrigir', onClick: () => openEdit(prev.local!) }
          : { label: 'Conferir de novo', onClick: () => setDraft(draftFor(asset, asset.code, method)) },
      });
      return;
    }

    if (mode === 'detalhada') {
      setCameraOn(false);
      setDraft(draftFor(asset, asset.code, method));
      return;
    }

    // Varredura rápida: bem previsto, sem mudança → um bipe e pronto.
    const d = draftFor(asset, asset.code, method);
    save(d);
    const moved = room && normalizeText(room) !== normalizeText(asset.location);
    toast[moved ? 'warning' : 'success'](`${asset.code} · ${asset.description}`, {
      description: moved ? `Cadastrado em "${asset.location}" — registrado aqui em "${room}"` : `${asset.location || 'sem local'} · ${CONSERVATION[asset.conservationStatus].label}`,
      duration: 2500,
    });
  }, [byCode, checked, mode, room, save]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (op: PendingOp) => {
    const asset = op.asset_id ? byId.get(op.asset_id) || null : null;
    setCameraOn(false);
    setDraft({
      asset, code: op.asset_code, method: op.method, location: op.observed_location, condition: op.observed_condition,
      responsible: op.observed_responsible, description: op.observed_description, notes: op.notes,
      photos: op.photo ? [op.photo] : [], editing: op,
    });
  };

  const pickOcr = useCallback((candidates: string[]) => candidates.find(c => byCode.has(normalizeCode(c))) || candidates[0] || null, [byCode]);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2 || !snapshot) return [];
    const nq = normalizeText(q);
    const nc = normalizeCode(q);
    return snapshot.assets.filter(a => a.codeNormalized.includes(nc) || normalizeText(a.description).includes(nq) || normalizeText(a.serialNumber).includes(nq)).slice(0, 8);
  }, [query, snapshot]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const exact = snapshot?.assets.find(a => a.codeNormalized === normalizeCode(query));
    if (exact) handleCode(exact.code, 'manual');
    else if (results.length === 1) handleCode(results[0].code, 'busca');
    else handleCode(query.trim(), 'manual');
    setQuery('');
  };

  if (snapshot === undefined) return <Spinner />;
  if (snapshot === null) {
    return (
      <EmptyState
        icon={CloudOff}
        title="Inventário não preparado neste aparelho"
        description={online ? 'Baixe o pacote do inventário para conferir — depois funciona sem internet.' : 'Sem conexão. Prepare o inventário quando houver internet.'}
        action={online && (
          <Button disabled={preparing} onClick={async () => { setPreparing(true); try { await prepareOffline(inventoryId!, user?.name || ''); await reload(); } finally { setPreparing(false); } }}>
            {preparing && <Loader2 className="animate-spin" />} Preparar agora
          </Button>
        )}
      />
    );
  }

  const pendingHere = ops.filter(o => o.status !== 'SYNCED').length;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/conferir" aria-label="Voltar"><ArrowLeft /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-urucum">{snapshot.inventory.number} · {snapshot.unit.code}</div>
          <h1 className="font-display text-xl font-bold leading-tight truncate">{snapshot.inventory.name}</h1>
        </div>
        <VaseProgress value={pct} size={62} />
      </div>

      <div className="card-clay p-3 grid sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
        <Field label="Estou na sala/setor" htmlFor="room">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input id="room" list="rooms" value={room} onChange={e => setRoom(e.target.value)} placeholder="Escolha ou digite a sala" className="pl-9 h-11 rounded-xl" />
            <datalist id="rooms">{locations.map(l => <option key={l} value={l} />)}</datalist>
          </div>
        </Field>
        <div className="flex rounded-xl border p-1 bg-muted" role="radiogroup" aria-label="Modo de conferência">
          {([['rapida', Zap, 'Rápida'], ['detalhada', ListChecks, 'Detalhada']] as const).map(([m, Icon, label]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold', mode === m ? 'bg-card shadow-card text-primary' : 'text-muted-foreground')}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground px-1 -mt-1">
        {mode === 'rapida'
          ? 'Varredura rápida: cada leitura confere o bem na hora, com os dados do cadastro e a sala atual. Toque em "Corrigir" se algo estiver diferente.'
          : 'Detalhada: cada leitura abre a ficha para conferir estado, responsável, observações e foto.'}
      </div>

      <form onSubmit={submitTyped} className="relative">
        <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Digite o tombamento ou busque pela descrição" className="pl-9 h-12 rounded-xl" inputMode="search" aria-label="Tombamento ou descrição" />
        {results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-xl border bg-popover shadow-elevated max-h-72 overflow-y-auto">
            {results.map(a => (
              <li key={a.id}>
                <button type="button" onClick={() => { handleCode(a.code, 'busca'); setQuery(''); }} className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-center gap-3">
                  <code className="text-xs font-bold text-primary w-20 shrink-0">{a.code}</code>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.description}</span>
                    <span className="block text-xs text-muted-foreground truncate">{a.location}</span>
                  </span>
                  {checked.has(a.id) && <Check className="h-4 w-4 text-success" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <Scanner active={cameraOn} onDetected={handleCode} pickOcrCandidate={pickOcr} />

      <Tabs defaultValue="faltam">
        <TabsList className="w-full grid grid-cols-2 rounded-xl">
          <TabsTrigger value="faltam" className="rounded-lg">Faltam {room ? 'nesta sala' : ''} ({remaining.length})</TabsTrigger>
          <TabsTrigger value="feitos" className="rounded-lg">Conferidos aqui ({ops.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="faltam">
          {remaining.length === 0 ? (
            <div className="card-clay p-6 text-center text-sm">
              <PackageSearch className="h-8 w-8 mx-auto text-success mb-2" />
              {roomAssets.length ? 'Todos os bens previstos desta sala foram conferidos.' : room ? 'Nenhum bem previsto nesta sala.' : 'Todos os bens previstos foram conferidos.'}
            </div>
          ) : (
            <ul className="card-clay divide-y">
              {remaining.slice(0, 80).map(a => (
                <li key={a.id}>
                  <button onClick={() => handleCode(a.code, 'busca')} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-accent">
                    <code className="text-xs font-bold text-primary w-20 shrink-0">{a.code}</code>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{a.description}</span>
                      <span className="block text-xs text-muted-foreground truncate">{a.location} · {a.responsibleName}</span>
                    </span>
                    <span className="text-xs font-semibold text-primary">Conferir</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="feitos">
          {ops.length === 0 ? <p className="text-sm text-muted-foreground p-4">Nenhuma conferência feita neste aparelho ainda.</p> : (
            <ul className="card-clay divide-y">
              {ops.map(o => (
                <li key={o.operation_id} className="px-4 py-3 flex items-center gap-3">
                  <code className="text-xs font-bold text-primary w-20 shrink-0">{o.asset_code}</code>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{o.asset_description}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(o.checked_at)} · {CHECK_METHOD[o.method]}{o.last_error ? ` · ${o.last_error}` : ''}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant={o.server_status ? CHECK_STATUS[o.server_status].variant : LOCAL_STATUS[o.local_status].variant}>{o.server_status ? CHECK_STATUS[o.server_status].label : LOCAL_STATUS[o.local_status].label}</Badge>
                      <Badge variant={OP_STATUS[o.status].variant}>{OP_STATUS[o.status].label}</Badge>
                    </div>
                  </div>
                  {o.status === 'PENDING' && <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Corrigir</Button>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-20 lg:bottom-6 z-20 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto flex items-center gap-2 pointer-events-auto">
          <Button size="xl" variant={cameraOn ? 'secondary' : 'urucum'} className="flex-1 shadow-elevated" onClick={() => setCameraOn(c => !c)}>
            {cameraOn ? <CameraOff /> : <Camera />} {cameraOn ? 'Pausar câmera' : 'Escanear'}
          </Button>
          <Button size="xl" variant="outline" className="bg-card shadow-elevated" onClick={() => syncNow()} disabled={!online} aria-label="Sincronizar agora">
            <RefreshCw /> <span className="tabular">{pendingHere}</span>
          </Button>
        </div>
      </div>
      <div className="h-16" />

      <CheckSheet draft={draft} locations={locations} onClose={() => setDraft(null)} onSave={async d => { await save(d); setDraft(null); if (!d.editing) toast.success(d.asset ? `${d.asset.code} conferido` : 'Bem não previsto registrado'); }} />
    </div>
  );
};

const CheckSheet: React.FC<{ draft: Draft | null; locations: string[]; onClose: () => void; onSave: (d: Draft) => Promise<void> }> = ({ draft, locations, onClose, onSave }) => {
  const [d, setD] = useState<Draft | null>(draft);
  const [saving, setSaving] = useState(false);
  useEffect(() => setD(draft), [draft]);
  if (!d) return <Sheet open={false} />;
  const a = d.asset;
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });

  return (
    <Sheet open={!!draft} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <div className="motif-band -mx-6 -mt-6 mb-4 rounded-t-3xl" />
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl">
            {a ? <><code className="text-primary">{a.code}</code> · {a.description}</> : <>Bem não previsto: <code className="text-destructive">{d.code}</code></>}
          </SheetTitle>
          <SheetDescription>
            {a ? `Cadastro: ${a.location || 'sem local'} · ${a.responsibleName || 'sem responsável'} · ${CONSERVATION[a.conservationStatus].label}${a.serialNumber ? ` · S/N ${a.serialNumber}` : ''}`
              : 'Este código não está na lista prevista do inventário. Ele será registrado e o servidor verifica se é de outra unidade ou se não existe na base.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-5">
          {!a && (
            <Field label="O que é este bem?">
              <Input value={d.description} onChange={e => set({ description: e.target.value })} placeholder="Ex.: impressora térmica, cadeira azul…" autoFocus />
            </Field>
          )}
          <Field label="Onde foi encontrado">
            <Input list="rooms-sheet" value={d.location} onChange={e => set({ location: e.target.value })} />
            <datalist id="rooms-sheet">{locations.map(l => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field label="Estado de conservação">
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
              {CONSERVATION_ORDER.map(c => (
                <button key={c} type="button" role="radio" aria-checked={d.condition === c} onClick={() => set({ condition: c })}
                  className={cn('rounded-xl border px-1 py-2.5 text-xs font-bold transition-colors', d.condition === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}>
                  {CONSERVATION[c].label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Responsável encontrado (opcional)" hint="Deixe em branco se não verificou.">
            <Input value={d.responsible} onChange={e => set({ responsible: e.target.value })} placeholder={a?.responsibleName || ''} />
          </Field>
          <Field label="Observações">
            <Textarea value={d.notes} onChange={e => set({ notes: e.target.value })} rows={2} placeholder="Ex.: tela trincada, sem plaqueta, em uso pela assessoria…" />
          </Field>
          <Field label="Foto (opcional)">
            <PhotoPicker value={d.photos} onChange={photos => set({ photos })} max={1} />
          </Field>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" size="xl" className="px-4" onClick={onClose}>Cancelar</Button>
          <Button size="xl" className="flex-1 min-w-0" disabled={saving || (!a && !d.description.trim())} onClick={async () => { setSaving(true); try { await onSave(d); } finally { setSaving(false); } }}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />} {d.editing ? 'Salvar correção' : <>Confirmar<span className="hidden sm:inline"> conferência</span></>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Conferencia;
