import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Printer, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { LogoMark } from '@/components/brand/Brand';
import { useAssets, useFacets, useUnits } from '@/hooks/queries';
import type { Asset } from '@/types';

// Etiquetas QR para colar nos bens. O QR carrega a URL /b/<tombamento>:
// o app lê só o tombamento, e qualquer câmera de celular abre a ficha do bem.
// Plaquetas antigas sem QR continuam legíveis pela leitura de plaqueta (OCR).
const Label: React.FC<{ asset: Asset; unitName: string }> = ({ asset, unitName }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = `${window.location.origin}/b/${encodeURIComponent(asset.code)}`;
    QRCode.toDataURL(url, { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: '#1E2130', light: '#FFFFFF' } }).then(setSrc);
  }, [asset.code]);
  return (
    <div className="label-card break-inside-avoid rounded-xl border-2 border-[#9C3D22] bg-white text-[#1E2130] p-2.5 flex gap-2.5 items-center">
      {src ? <img src={src} alt={`QR do bem ${asset.code}`} className="h-[84px] w-[84px]" /> : <div className="h-[84px] w-[84px] bg-muted" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1"><LogoMark size={14} /><span className="text-[8px] font-bold uppercase tracking-wider">TJPA · Patrimônio</span></div>
        <div className="font-display font-extrabold text-xl leading-none mt-1 tabular">{asset.code}</div>
        <div className="text-[9px] leading-tight mt-1 line-clamp-2">{asset.description}</div>
        <div className="text-[8px] text-[#6b5e55] mt-0.5 truncate">{unitName} · {asset.location}</div>
      </div>
    </div>
  );
};

const Etiquetas: React.FC = () => {
  const [params] = useSearchParams();
  const { data: units = [] } = useUnits();
  const [unitId, setUnitId] = useState(params.get('unit') || '');
  const [location, setLocation] = useState('');
  const codes = params.get('codes') || '';
  const { data: facets } = useFacets(unitId || undefined);
  const { data, isLoading } = useAssets({ unit_id: unitId || undefined, location: location || undefined, search: codes || undefined, pageSize: '300' });
  const unitName = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.code])), [units]);

  return (
    <div className="animate-fade-in">
      <style>{`@media print { @page { size: A4; margin: 10mm; } aside, header, nav { display: none !important; } main { padding: 0 !important; max-width: none !important; } .labels-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 4mm !important; } }`}</style>
      <PageHeader
        title="Etiquetas QR"
        subtitle="Imprima em papel adesivo (A4, 3 colunas) e cole nos bens. Uma etiqueta acelera cada conferência futura."
        actions={<Button onClick={() => window.print()} disabled={!data?.items.length}><Printer /> Imprimir {data?.items.length || 0}</Button>}
      />
      {!codes && (
        <div className="card-clay p-3 grid sm:grid-cols-2 gap-3 mb-4 no-print">
          <NativeSelect value={unitId} onChange={e => { setUnitId(e.target.value); setLocation(''); }} aria-label="Unidade">
            <option value="">Escolha a comarca…</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </NativeSelect>
          <NativeSelect value={location} onChange={e => setLocation(e.target.value)} disabled={!unitId} aria-label="Sala">
            <option value="">Todos os setores</option>
            {facets?.locations.map(l => <option key={l} value={l}>{l}</option>)}
          </NativeSelect>
        </div>
      )}
      {!unitId && !codes ? (
        <EmptyState icon={QrCode} title="Escolha uma comarca" description="As etiquetas são geradas para os bens da comarca (ou de um setor)." />
      ) : isLoading ? <Spinner /> : (
        <div className="labels-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.items.map(a => <Label key={a.id} asset={a} unitName={unitName[a.unitId] || ''} />)}
        </div>
      )}
    </div>
  );
};

export default Etiquetas;
