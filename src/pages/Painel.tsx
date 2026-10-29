import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Boxes, ChevronDown, ClipboardCheck, ClipboardList, Gauge, Inbox, PackagePlus, Plus, ScanLine, Send, Timer, TriangleAlert, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarList, EmptyState, PageHeader, Spinner, StatTile } from '@/components/common';
import { VaseProgress } from '@/components/brand/Brand';
import { AssetDetailSheet } from '@/components/AssetDetail';
import { AssetFormDialog } from '@/components/AssetFormDialog';
import { PedirEnvioDialog, PedirValidacaoDialog, ValidacoesSection } from '@/components/GerenteRequests';
import { PedirBemDialog } from '@/components/Solicitacoes';
import { SECTOR_KIND } from '@/lib/labels';
import type { Dashboard } from '@/types';
import { useDashboard } from '@/hooks/queries';
import { useAuth } from '@/lib/auth-context';
import { ASSET_EVENT_LABEL, CHECK_METHOD, DISCREPANCY } from '@/lib/labels';
import { fmtNumber, fmtRelative } from '@/lib/format';
import type { CheckMethod, DiscrepancyType } from '@/types';

const Painel: React.FC = () => {
  const { user, can } = useAuth();
  const { data, isLoading, error } = useDashboard();
  const [creating, setCreating] = useState(false);
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const [requestingSend, setRequestingSend] = useState(false);
  const [requestingCheck, setRequestingCheck] = useState(false);
  const [requestingAsset, setRequestingAsset] = useState(false);

  if (isLoading) return <Spinner />;
  if (error || !data) return <EmptyState icon={WifiOff} title="Painel indisponível offline" description="O painel consolidado precisa de conexão. A conferência continua funcionando normalmente." action={<Button asChild><Link to="/conferir">Ir para a conferência</Link></Button>} />;

  const p = data.productivity;
  const methodTotal = Object.values(p.byMethod).reduce((s, n) => s + (n || 0), 0) || 1;
  const automatic = ((p.byMethod.qr || 0) + (p.byMethod.barcode || 0) + (p.byMethod.ocr || 0)) / methodTotal;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={`Olá, ${user?.name.split(' ')[0]}`}
        title="Painel do patrimônio"
        subtitle="Situação do acervo, inventários em curso e produtividade da conferência."
        actions={(
          <>
            {can('admin', 'gestor') && (
              <>
                <Button variant="outline" onClick={() => setCreating(true)}><Plus /> Adicionar bem</Button>
                <Button variant="outline" onClick={() => setRequestingSend(true)}><Send /> Pedir envio</Button>
                <Button variant="outline" onClick={() => setRequestingCheck(true)}><ClipboardList /> Pedir validação</Button>
              </>
            )}
            <Button variant="outline" onClick={() => setRequestingAsset(true)}><PackagePlus /> Pedir um bem</Button>
            <Button asChild variant="urucum"><Link to="/conferir"><ScanLine /> Conferir bens</Link></Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatTile icon={Boxes} label="Bens cadastrados" value={fmtNumber(data.totals.assets)} hint={`${data.totals.units} comarca(s)`} />
        <StatTile icon={ClipboardCheck} tone="info" label="Inventários em andamento" value={data.totals.openInventories} />
        <StatTile icon={TriangleAlert} tone="warn" label="Pendências abertas" value={data.totals.openDiscrepancies} hint={<Link to="/pendencias" className="underline">revisar</Link>} />
        <StatTile icon={ArrowLeftRight} tone="ok" label="Movimentações em curso" value={data.totals.movementsInProgress} />
        <StatTile
          icon={Inbox}
          tone={data.totals.urgentRequests ? 'danger' : 'clay'}
          label="Solicitações abertas"
          value={data.totals.openRequests}
          hint={can('admin', 'gestor')
            ? <Link to="/solicitacoes" className="underline">{data.totals.urgentRequests ? `${data.totals.urgentRequests} urgente(s) · atender` : 'atender'}</Link>
            : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <section className="card-clay p-5 lg:col-span-1" aria-labelledby="prod">
          <h2 id="prod" className="font-display text-lg font-bold flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /> Produtividade da conferência</h2>
          <div className="mt-4 flex items-end gap-2">
            <Timer className="h-6 w-6 text-urucum mb-1.5" />
            <span className="font-display text-5xl font-extrabold tabular">{p.avgSecondsPerAsset ? p.avgSecondsPerAsset.toLocaleString('pt-BR') : '—'}</span>
            <span className="text-muted-foreground font-semibold mb-1.5">s por bem</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Tempo médio medido no aparelho, entre uma conferência e a seguinte (medição real, não estimativa).</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted p-3"><dt className="text-xs text-muted-foreground">Conferências</dt><dd className="font-bold text-lg tabular">{fmtNumber(p.totalChecks)}</dd></div>
            <div className="rounded-xl bg-muted p-3"><dt className="text-xs text-muted-foreground">Feitas offline</dt><dd className="font-bold text-lg tabular">{fmtNumber(p.offlineChecks)}</dd></div>
            <div className="rounded-xl bg-muted p-3 col-span-2"><dt className="text-xs text-muted-foreground">Identificação sem digitação (QR, barras, OCR)</dt><dd className="font-bold text-lg tabular">{Math.round(automatic * 100)}%</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(Object.entries(p.byMethod) as [CheckMethod, number][]).map(([m, n]) => (
              <span key={m} className="text-[11px] rounded-full bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground">{CHECK_METHOD[m]}: {n}</span>
            ))}
          </div>
        </section>

        <section className="card-clay p-5 lg:col-span-2" aria-labelledby="cov">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="cov" className="font-display text-lg font-bold">Cobertura por comarca e setor</h2>
              <p className="text-xs text-muted-foreground">% dos bens conferidos nos últimos 12 meses. Toque na comarca para ver cada vara e setor.</p>
            </div>
            <div className="flex gap-2" aria-label="Equidade capital e interior">
              <div className="rounded-xl bg-muted px-3 py-2 text-center"><div className="text-[10px] font-bold uppercase text-muted-foreground">Capital</div><div className="font-display text-xl font-bold tabular">{data.equity.capital}%</div></div>
              <div className="rounded-xl bg-muted px-3 py-2 text-center"><div className="text-[10px] font-bold uppercase text-muted-foreground">Interior</div><div className="font-display text-xl font-bold tabular">{data.equity.interior}%</div></div>
            </div>
          </div>
          <CoverageList rows={data.coverage} />
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <section className="card-clay p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Inventários em andamento</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/inventarios">Ver todos</Link></Button>
          </div>
          {data.inventories.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">Nenhum inventário aberto. <Link to="/inventarios" className="text-primary font-semibold underline">Abrir um inventário</Link></p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              {data.inventories.map(inv => (
                <Link key={inv.id} to={`/inventarios/${inv.id}`} className="flex items-center gap-4 rounded-2xl border p-3 hover:bg-accent transition-colors">
                  <VaseProgress value={inv.summary?.progress ?? 0} size={78} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-urucum">{inv.number}</div>
                    <div className="font-semibold leading-tight line-clamp-2">{inv.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 tabular">{inv.summary?.checked}/{inv.summary?.expected} bens · {inv.summary?.openDiscrepancies} pendências</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card-clay p-5">
          <h2 className="font-display text-lg font-bold">Pendências por tipo</h2>
          <div className="mt-4">
            {Object.keys(data.discrepanciesByType).length === 0
              ? <p className="text-sm text-muted-foreground">Nenhuma pendência aberta.</p>
              : (
                <ul className="space-y-1">
                  {(Object.entries(data.discrepanciesByType) as [DiscrepancyType, number][]).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                    <li key={t}>
                      <Link to={`/pendencias?tipo=${t}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent">
                        <span>{DISCREPANCY[t].label}</span><strong className="tabular">{n}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>
      </div>

      <section className="card-clay p-5 mt-4">
        <h2 className="font-display text-lg font-bold">Atividade recente</h2>
        <ol className="mt-3 divide-y">
          {data.recentActivity.map(e => (
            <li key={e.id} className="py-2.5 flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 rounded-sm bg-primary rotate-45 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{ASSET_EVENT_LABEL[e.type] || e.type}</span> — {e.summary}
                <div className="text-xs text-muted-foreground">{e.performedByName || 'Sistema'} · {fmtRelative(e.occurredAt)}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {can('admin', 'gestor') && <ValidacoesSection />}

      <AssetDetailSheet assetId={openAsset} onClose={() => setOpenAsset(null)} />
      <AssetFormDialog open={creating} onOpenChange={setCreating} onSaved={a => setOpenAsset(a.id)} />
      <PedirEnvioDialog open={requestingSend} onOpenChange={setRequestingSend} />
      <PedirValidacaoDialog open={requestingCheck} onOpenChange={setRequestingCheck} />
      <PedirBemDialog open={requestingAsset} onOpenChange={setRequestingAsset} />
    </div>
  );
};

// Cobertura em dois níveis: a comarca (barra) e, aberta, cada setor dela — do
// menos conferido para o mais, que é onde o gestor precisa agir primeiro.
const CoverageList: React.FC<{ rows: Dashboard['coverage'] }> = ({ rows }) => {
  const [open, setOpen] = useState<string | null>(rows.length === 1 ? rows[0].unitId : null);
  return (
    <ul className="mt-5 space-y-2">
      {rows.map(c => {
        const isOpen = open === c.unitId;
        return (
          <li key={c.unitId} className="rounded-xl border">
            <button type="button" onClick={() => setOpen(isOpen ? null : c.unitId)} aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/60 rounded-xl">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{c.name}<span className="text-xs font-normal text-muted-foreground"> · {c.region}</span></span>
                <span className="mt-1 block h-2 rounded-full bg-muted overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${c.pct}%` }} /></span>
              </span>
              <span className="text-sm font-bold tabular w-12 text-right">{c.pct}%</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                <p className="text-xs text-muted-foreground mb-2">{c.checked} de {c.assets} bens conferidos</p>
                {c.sectors.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum setor cadastrado.</p> : (
                  <ul className="space-y-1.5">
                    {c.sectors.map(s => (
                      <li key={s.name || '-'}>
                        <Link to={`/bens?comarca=${c.unitId}&setor=${encodeURIComponent(s.name)}`}
                          className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded-lg px-2 py-1 hover:bg-accent text-xs" title={`${s.checked} de ${s.assets} bens conferidos`}>
                          <span className="truncate"><span className="text-muted-foreground">{SECTOR_KIND[s.kind]?.label} · </span>{s.name || 'Sem setor'}</span>
                          <span className="tabular font-semibold">{s.assets ? `${s.pct}%` : 'sem bens'}</span>
                          <span className="col-span-2 mt-0.5 block h-1.5 rounded-full bg-muted overflow-hidden"><span className="block h-full bg-urucum" style={{ width: `${s.pct}%` }} /></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default Painel;
