import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Printer, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, NativeSelect, PageHeader, Spinner } from '@/components/common';
import { LogoMark } from '@/components/brand/Brand';
import { useAssets, useFacets, useUnits } from '@/hooks/queries';
import type { Asset } from '@/types';

type Modelo = 'tjpa' | 'qr';
const MODEL_KEY = 'assethub_label_model';

// Modelo TJPA: o mesmo das plaquetas de patrimônio do Tribunal — brasão,
// "Tribunal de Justiça do Estado do Pará / Patrimônio", código de barras
// Code 39 (o das plaquetas reais, que a câmera do app lê) e o tombamento embaixo.
const LabelTjpa: React.FC<{ asset: Asset }> = ({ asset }) => {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svg.current) return;
    // margin = zona de silêncio: sem ela, nenhum leitor reconhece o código.
    const opts = { displayValue: false, margin: 12, height: 40, width: 2, background: 'transparent', lineColor: '#111111' };
    try {
      JsBarcode(svg.current, asset.code.toUpperCase(), { ...opts, format: 'CODE39' });
    } catch {
      // Tombamento com caractere que o Code 39 não aceita.
      JsBarcode(svg.current, asset.code, { ...opts, format: 'CODE128' });
    }
  }, [asset.code]);
  return (
    <div className="label-card break-inside-avoid rounded-[3px] border border-[#b9c0c6] p-2 pr-3 flex items-center gap-2 text-[#1c1c1c]"
      style={{ background: 'linear-gradient(160deg, #f4f6f7 0%, #dfe4e8 55%, #eef1f3 100%)', fontFamily: '"Arial Narrow", Arial, sans-serif' }}>
      <img src="/brasao-tjpa.png" alt="Brasão do TJPA" className="h-[74px] w-[74px] shrink-0 object-contain" />
      <div className="min-w-0 flex-1 flex flex-col items-center">
        <div className="font-bold text-[10.5px] leading-tight whitespace-nowrap tracking-[-0.01em]">Tribunal de Justiça do Estado do Pará</div>
        <div className="font-bold text-[10.5px] leading-tight">Patrimônio</div>
        <svg ref={svg} className="mt-1 h-[38px] w-full" preserveAspectRatio="none" aria-label={`Código de barras ${asset.code}`} />
        <div className="font-bold text-[17px] leading-none mt-1 tracking-wide tabular">{asset.code}</div>
      </div>
    </div>
  );
};

// Modelo QR: a URL /b/<tombamento> — o app lê só o tombamento, e qualquer
// câmera de celular abre a ficha do bem.
const LabelQr: React.FC<{ asset: Asset; unitName: string }> = ({ asset, unitName }) => {
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
  const [modelo, setModelo] = useState<Modelo>(() => { try { return (localStorage.getItem(MODEL_KEY) as Modelo) || 'tjpa'; } catch { return 'tjpa'; } });
  useEffect(() => { try { localStorage.setItem(MODEL_KEY, modelo); } catch { /* sem armazenamento: só não lembra a escolha */ } }, [modelo]);
  const codes = params.get('codes') || '';
  // Cópias de cada etiqueta (uma para o bem, outra de reserva/para a pasta do processo).
  const [copies, setCopies] = useState(() => Math.min(3, Math.max(1, Number(params.get('copias')) || 1)));
  const { data: facets } = useFacets(unitId || undefined);
  const { data, isLoading } = useAssets({ unit_id: unitId || undefined, location: location || undefined, search: codes || undefined, pageSize: '300' });
  const unitName = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.code])), [units]);

  return (
    <div className="animate-fade-in">
      <style>{`@media print { @page { size: A4; margin: 10mm; } aside, header, nav { display: none !important; } main { padding: 0 !important; max-width: none !important; } .labels-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 4mm !important; } .label-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="no-print">
      <PageHeader
        title="Etiquetas"
        subtitle="Imprima em papel adesivo (A4, 3 colunas) e cole nos bens. A câmera do app lê o código de barras e o QR."
        actions={<Button onClick={() => window.print()} disabled={!data?.items.length}><Printer /> Imprimir {(data?.items.length || 0) * copies}</Button>}
      />
      </div>
      <div className="card-clay p-3 grid sm:grid-cols-3 gap-3 mb-4 no-print">
        {!codes && (
          <>
            <NativeSelect value={unitId} onChange={e => { setUnitId(e.target.value); setLocation(''); }} aria-label="Unidade">
              <option value="">Escolha a comarca…</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
            <NativeSelect value={location} onChange={e => setLocation(e.target.value)} disabled={!unitId} aria-label="Setor">
              <option value="">Todos os setores</option>
              {facets?.locations.map(l => <option key={l} value={l}>{l}</option>)}
            </NativeSelect>
          </>
        )}
        <NativeSelect value={modelo} onChange={e => setModelo(e.target.value as Modelo)} aria-label="Modelo da etiqueta">
          <option value="tjpa">Modelo TJPA (código de barras)</option>
          <option value="qr">QR Code (abre a ficha no celular)</option>
        </NativeSelect>
        <NativeSelect value={String(copies)} onChange={e => setCopies(Number(e.target.value))} aria-label="Cópias de cada etiqueta">
          <option value="1">1 etiqueta de cada bem</option>
          <option value="2">2 etiquetas de cada bem</option>
          <option value="3">3 etiquetas de cada bem</option>
        </NativeSelect>
      </div>
      {!unitId && !codes ? (
        <EmptyState icon={Tag} title="Escolha uma comarca" description="As etiquetas são geradas para os bens da comarca (ou de um setor)." />
      ) : isLoading ? <Spinner /> : (
        <div className="labels-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data?.items.flatMap(a => Array.from({ length: copies }, (_, i) => (modelo === 'tjpa'
            ? <LabelTjpa key={`${a.id}-${i}`} asset={a} />
            : <LabelQr key={`${a.id}-${i}`} asset={a} unitName={unitName[a.unitId] || ''} />)))}
        </div>
      )}
    </div>
  );
};

export default Etiquetas;
