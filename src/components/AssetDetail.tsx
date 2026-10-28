import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, History, Pencil, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AssetStatusBadge, CheckStatusBadge, ConservationBadge, MovementStatusBadge, Spinner } from '@/components/common';
import { useAssetDetail } from '@/hooks/queries';
import { useAuth } from '@/lib/auth-context';
import { AssetFormDialog } from '@/components/AssetFormDialog';
import { ASSET_EVENT_LABEL, FIELD_LABEL } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/format';
import type { AssetDetail as Detail } from '@/types';

export const AssetDetailBody: React.FC<{ data: Detail }> = ({ data }) => {
  const { asset: a, unit, events, checks, movements } = data;
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5"><AssetStatusBadge value={a.status} /><ConservationBadge value={a.conservationStatus} /></div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['Unidade', unit?.name], ['Localização', a.location], ['Responsável', a.responsibleName], ['Categoria', a.category],
          ['Marca/modelo', a.brand], ['Nº de série', a.serialNumber], ['Aquisição', fmtDate(a.acquisitionDate)], ['Valor', fmtMoney(a.value)],
          ['Última conferência', fmtDateTime(a.lastCheckedAt)],
        ].map(([k, v]) => (
          <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold break-words">{v || '—'}</dd></div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to={`/movimentacoes/nova?asset=${a.id}`}><ArrowLeftRight /> Movimentar</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to={`/etiquetas?codes=${encodeURIComponent(a.code)}`}><QrCode /> Etiqueta</Link></Button>
        {can('admin', 'gestor') && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Editar / baixa</Button>}
      </div>
      <AssetFormDialog open={editing} onOpenChange={setEditing} asset={a} />

      {movements.length > 0 && (
        <section>
          <h3 className="font-display font-bold mb-2">Movimentações</h3>
          <ul className="space-y-1.5">
            {movements.map(m => (
              <li key={m.id}><Link to={`/movimentacoes/${m.id}`} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-accent">
                <span className="font-semibold">{m.number}</span><MovementStatusBadge value={m.status} />
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      {checks.length > 0 && (
        <section>
          <h3 className="font-display font-bold mb-2">Conferências</h3>
          <ul className="space-y-1.5">
            {checks.slice(0, 8).map(c => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm rounded-xl bg-muted px-3 py-2">
                <span>{fmtDateTime(c.checkedAt)} · {c.checkedByName} · {c.observedLocation}</span><CheckStatusBadge value={c.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-display font-bold mb-2 flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Linha do tempo</h3>
        <ol className="relative border-l-2 border-dashed border-primary/30 ml-2 space-y-3">
          {events.map(e => (
            <li key={e.id} className="pl-4 relative">
              <span className="absolute -left-[7px] top-1 h-3 w-3 rotate-45 bg-primary" />
              <div className="text-sm"><span className="font-semibold">{ASSET_EVENT_LABEL[e.type] || e.type}</span> — {e.summary}</div>
              <div className="text-xs text-muted-foreground">{e.performedByName || 'Sistema'} · {fmtDateTime(e.occurredAt)}</div>
              {e.changes && (
                <ul className="mt-1 text-xs text-muted-foreground">
                  {Object.entries(e.changes).map(([k, v]) => <li key={k}>{FIELD_LABEL[k] || k}: <s>{String(v.from ?? '—')}</s> → <strong className="text-foreground">{String(v.to ?? '—')}</strong></li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

export const AssetDetailSheet: React.FC<{ assetId: string | null; onClose: () => void }> = ({ assetId, onClose }) => {
  const { data, isLoading } = useAssetDetail(assetId);
  return (
    <Sheet open={!!assetId} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <div className="motif-band -mx-6 -mt-6 mb-4" />
        {isLoading || !data ? <Spinner /> : (
          <>
            <SheetHeader className="text-left mb-4">
              <div className="text-[11px] font-bold text-urucum">TOMBAMENTO {data.asset.code}</div>
              <SheetTitle className="font-display text-xl">{data.asset.description}</SheetTitle>
            </SheetHeader>
            <AssetDetailBody data={data} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
