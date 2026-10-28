import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Download, Plus, QrCode, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AssetStatusBadge, ConservationBadge, EmptyState, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { AssetDetailSheet } from '@/components/AssetDetail';
import { AssetFormDialog } from '@/components/AssetFormDialog';
import { useAssets, useFacets, useUnits } from '@/hooks/queries';
import { downloadFile } from '@/services/http';
import { useAuth } from '@/lib/auth-context';
import { ASSET_STATUS } from '@/lib/labels';
import { fmtNumber, fmtRelative } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError, AssetStatus } from '@/types';

const PAGE = 25;

const Bens: React.FC = () => {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [unitId, setUnitId] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data: units = [] } = useUnits();
  const { data: facets } = useFacets(unitId || undefined);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  const filters = { search: debounced || undefined, unit_id: unitId || undefined, status: status || undefined, category: category || undefined, page: String(page), pageSize: String(PAGE) };
  const { data, isLoading, isFetching } = useAssets(filters);
  const unitName = (id: string) => units.find(u => u.id === id)?.code || '';
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  const exportAs = (format: 'csv' | 'xlsx') => downloadFile('/assets/export', { ...filters, page: undefined, pageSize: undefined, format }).catch((e: ApiError) => toast.error(e.message));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bens patrimoniais"
        subtitle={data ? `${fmtNumber(data.total)} bens encontrados` : 'Acervo patrimonial'}
        actions={
          <>
            {can('admin', 'gestor') && <Button variant="outline" onClick={() => setCreating(true)}><Plus /> Cadastrar bem</Button>}
            {can('admin', 'gestor') && <Button asChild variant="outline"><Link to="/importar"><Upload /> Importar</Link></Button>}
            <Button asChild variant="outline"><Link to={`/etiquetas${unitId ? `?unit=${unitId}` : ''}`}><QrCode /> Etiquetas</Link></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button><Download /> Exportar</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportAs('xlsx')}>Planilha (XLSX)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs('csv')}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="card-clay p-3 grid sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tombamento, descrição, série, responsável, sala…" className="pl-9" aria-label="Buscar bens" />
        </div>
        <NativeSelect value={unitId} onChange={e => { setUnitId(e.target.value); setCategory(''); setPage(1); }} aria-label="Unidade">
          <option value="">Todas as unidades</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </NativeSelect>
        <NativeSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Situação">
          <option value="">Todas as situações</option>
          {(Object.keys(ASSET_STATUS) as AssetStatus[]).map(s => <option key={s} value={s}>{ASSET_STATUS[s].label}</option>)}
        </NativeSelect>
        <NativeSelect value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {facets?.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
      </div>

      {isLoading ? <Spinner /> : !data?.items.length ? (
        <EmptyState icon={Boxes} title="Nenhum bem encontrado" description="Ajuste os filtros ou importe a planilha patrimonial." />
      ) : (
        <div className={`card-clay overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
          <div className="hidden md:grid grid-cols-[110px_1fr_170px_140px_120px_120px] gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground border-b bg-muted/50">
            <span>Tombamento</span><span>Descrição</span><span>Local</span><span>Responsável</span><span>Estado</span><span>Conferido</span>
          </div>
          <ul className="divide-y">
            {data.items.map(a => (
              <li key={a.id}>
                <button onClick={() => setOpen(a.id)} className="w-full text-left px-4 py-3 hover:bg-accent/60 grid md:grid-cols-[110px_1fr_170px_140px_120px_120px] gap-x-3 gap-y-1 items-center text-sm">
                  <code className="font-bold text-primary">{a.code}</code>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.description}</span>
                    <span className="block text-xs text-muted-foreground truncate">{a.category}{a.brand ? ` · ${a.brand}` : ''}</span>
                  </span>
                  <span className="text-xs truncate"><span className="font-bold text-muted-foreground mr-1">{unitName(a.unitId)}</span>{a.location}</span>
                  <span className="text-xs truncate hidden md:block">{a.responsibleName}</span>
                  <span className="flex gap-1 flex-wrap"><ConservationBadge value={a.conservationStatus} />{a.status !== 'ativo' && <AssetStatusBadge value={a.status} />}</span>
                  <span className="text-xs text-muted-foreground">{a.lastCheckedAt ? fmtRelative(a.lastCheckedAt) : 'nunca'}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
            <span className="text-muted-foreground tabular">Página {page} de {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        </div>
      )}
      <AssetDetailSheet assetId={open} onClose={() => setOpen(null)} />
      <AssetFormDialog open={creating} onOpenChange={setCreating} onSaved={a => setOpen(a.id)} />
    </div>
  );
};

export default Bens;
