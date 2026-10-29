import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Download, Plus, QrCode, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AssetStatusBadge, ConservationBadge, EmptyState, Field, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { AssetDetailSheet } from '@/components/AssetDetail';
import { AssetFormDialog } from '@/components/AssetFormDialog';
import { FilterBar, type FilterChip } from '@/components/FilterBar';
import { SectorOptions, placeLabel, sectorsOf } from '@/components/Sectors';
import { useAssets, useFacets, useUnits } from '@/hooks/queries';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { downloadFile } from '@/services/http';
import { useAuth } from '@/lib/auth-context';
import { ASSET_STATUS, CONSERVATION, CONSERVATION_ORDER, LAST_CHECK } from '@/lib/labels';
import { fmtNumber, fmtRelative } from '@/lib/format';
import { toast } from '@/components/ui/sonner';
import type { ApiError, AssetStatus } from '@/types';

const PAGE = 25;

// Um filtro para cada coluna da planilha. Nomes curtos na URL, para o link
// filtrado caber numa mensagem.
const KEYS = ['busca', 'comarca', 'setor', 'sala', 'categoria', 'marca', 'responsavel', 'situacao', 'estado', 'conferencia'] as const;
type Key = typeof KEYS[number];
const RESETS: Partial<Record<Key, Key[]>> = { comarca: ['setor', 'sala'], setor: ['sala'] };

const Bens: React.FC = () => {
  const { can } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { values: f, set, clear, page, setPage } = useUrlFilters(KEYS, RESETS);
  const { data: units = [] } = useUnits();
  const { data: facets } = useFacets(f.comarca || undefined, f.setor || undefined);
  const unit = units.find(u => u.id === f.comarca);
  const sectors = unit ? sectorsOf(unit) : [];

  const filters = {
    search: f.busca || undefined,
    unit_id: f.comarca || undefined,
    location: f.setor || undefined,
    room: f.sala || undefined,
    category: f.categoria || undefined,
    brand: f.marca || undefined,
    responsible_name: f.responsavel || undefined,
    status: f.situacao || undefined,
    conservation_status: f.estado || undefined,
    checked: f.conferencia || undefined,
  };
  const { data, isLoading, isFetching } = useAssets({ ...filters, page: String(page), pageSize: String(PAGE) });
  const unitCode = (id: string) => units.find(u => u.id === id)?.code || '';
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  const exportAs = (format: 'csv' | 'xlsx') => downloadFile('/assets/export', { ...filters, format }).catch((e: ApiError) => toast.error(e.message));

  const label: Record<Key, (v: string) => string> = {
    busca: v => `"${v}"`,
    comarca: v => units.find(u => u.id === v)?.name || v,
    setor: v => v,
    sala: v => `Sala ${v}`,
    categoria: v => v,
    marca: v => v,
    responsavel: v => v,
    situacao: v => ASSET_STATUS[v as AssetStatus]?.label || v,
    estado: v => `Estado ${CONSERVATION[v as keyof typeof CONSERVATION]?.label.toLowerCase() || v}`,
    conferencia: v => LAST_CHECK[v] || v,
  };
  const chips: FilterChip[] = KEYS.filter(k => f[k]).map(k => ({ key: k, label: label[k](f[k]), onRemove: () => set(k, '') }));

  const select = (key: Key, aria: string, all: string, options: React.ReactNode, className = 'md:w-48') => (
    <NativeSelect value={f[key]} onChange={e => set(key, e.target.value)} aria-label={aria} className={className}>
      <option value="">{all}</option>
      {options}
    </NativeSelect>
  );
  const plain = (list: string[] = []) => list.map(v => <option key={v} value={v}>{v}</option>);

  const comarcaSelect = select('comarca', 'Comarca', 'Todas as comarcas', units.map(u => <option key={u.id} value={u.id}>{u.name}</option>));
  const setorSelect = select('setor', 'Setor', unit ? 'Todos os setores' : 'Escolha a comarca', <SectorOptions sectors={sectors} />);
  const situacaoSelect = select('situacao', 'Situação', 'Todas as situações', (Object.keys(ASSET_STATUS) as AssetStatus[]).map(s => <option key={s} value={s}>{ASSET_STATUS[s].label}</option>));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bens patrimoniais"
        subtitle="Acervo patrimonial por comarca e setor"
        actions={
          <>
            {can('admin', 'gestor') && <Button variant="outline" onClick={() => setCreating(true)}><Plus /> Cadastrar bem</Button>}
            {can('admin', 'gestor') && <Button asChild variant="outline"><Link to="/importar"><Upload /> Importar</Link></Button>}
            <Button asChild variant="outline"><Link to={`/etiquetas${f.comarca ? `?unit=${f.comarca}` : ''}`}><QrCode /> Etiquetas</Link></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button><Download /> Exportar</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Exporta {data ? `os ${fmtNumber(data.total)} bens` : 'os bens'} {chips.length ? 'filtrados' : 'cadastrados'}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportAs('xlsx')}>Planilha (XLSX)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAs('csv')}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="card-clay p-3 mb-4">
        <FilterBar
          search={{ value: f.busca, onChange: v => set('busca', v), placeholder: 'Tombamento, descrição, série, responsável, setor…' }}
          primary={<>{comarcaSelect}{setorSelect}{situacaoSelect}</>}
          more={
            <>
              {f.comarca && facets?.rooms.length ? <Field label="Sala">{select('sala', 'Sala', 'Todas as salas', plain(facets.rooms), '')}</Field> : null}
              <Field label="Categoria">{select('categoria', 'Categoria', 'Todas as categorias', plain(facets?.categories), '')}</Field>
              <Field label="Marca/modelo">{select('marca', 'Marca', 'Todas as marcas', plain(facets?.brands), '')}</Field>
              <Field label="Responsável">{select('responsavel', 'Responsável', 'Todos os responsáveis', plain(facets?.responsibles), '')}</Field>
              <Field label="Estado de conservação">{select('estado', 'Estado de conservação', 'Todos os estados', CONSERVATION_ORDER.map(c => <option key={c} value={c}>{CONSERVATION[c].label}</option>), '')}</Field>
              <Field label="Última conferência" hint="Cobertura: bem conferido nos últimos 12 meses está em dia.">
                {select('conferencia', 'Última conferência', 'Qualquer data', Object.entries(LAST_CHECK).map(([k, v]) => <option key={k} value={k}>{v}</option>), '')}
              </Field>
            </>
          }
          chips={chips}
          onClear={clear}
          summary={data ? <strong className="text-foreground tabular">{fmtNumber(data.total)} bens encontrados</strong> : undefined}
        />
      </div>

      {isLoading ? <Spinner /> : !data?.items.length ? (
        <EmptyState icon={Boxes} title="Nenhum bem encontrado" description="Ajuste os filtros ou importe a planilha patrimonial." />
      ) : (
        <div className={`card-clay overflow-hidden ${isFetching ? 'opacity-70' : ''}`}>
          <div className="hidden md:grid grid-cols-[110px_1fr_190px_140px_120px_120px] gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground border-b bg-muted/50">
            <span>Tombamento</span><span>Descrição</span><span>Comarca · Setor</span><span>Responsável</span><span>Estado</span><span>Conferido</span>
          </div>
          <ul className="divide-y">
            {data.items.map(a => (
              <li key={a.id}>
                <button onClick={() => setOpen(a.id)} className="w-full text-left px-4 py-3 hover:bg-accent/60 grid md:grid-cols-[110px_1fr_190px_140px_120px_120px] gap-x-3 gap-y-1 items-center text-sm">
                  <code className="font-bold text-primary">{a.code}</code>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.description}</span>
                    <span className="block text-xs text-muted-foreground truncate">{a.category}{a.brand ? ` · ${a.brand}` : ''}</span>
                  </span>
                  <span className="text-xs truncate"><span className="font-bold text-muted-foreground mr-1">{unitCode(a.unitId)}</span>{placeLabel(a.location, a.room, '')}</span>
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
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
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
