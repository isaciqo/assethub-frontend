import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Sparkles, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConservationBadge, Field, NativeSelect, PageHeader, StatTile } from '@/components/common';
import { useUnits } from '@/hooks/queries';
import { assetsService } from '@/services/api';
import { FIELD_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { ApiError, ImportReport } from '@/types';

const FIELDS = ['code', 'description', 'category', 'brand', 'serial_number', 'unit', 'location', 'responsible_name', 'conservation_status', 'acquisition_date', 'value', 'notes'];
const REQUIRED = ['code', 'description'];

// Importação em 3 passos: arquivo → prévia (nada gravado) → confirmar.
// As colunas são reconhecidas sozinhas ("Nº Tombamento", "Descrição do Bem"…),
// e a pessoa pode corrigir o mapeamento antes de gravar.
const Importar: React.FC = () => {
  const { data: units = [] } = useUnits();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [defaultUnit, setDefaultUnit] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [result, setResult] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const run = async (f: File, dryRun: boolean, map?: Record<string, string>) => {
    setBusy(true);
    try {
      const r = await assetsService.importFile(f, { mapping: map, defaultUnitId: defaultUnit || undefined, dryRun });
      if (dryRun) { setPreview(r); setMapping(r.mapping); } else {
        setResult(r);
        qc.invalidateQueries();
        toast.success(`${r.created} bens novos, ${r.updated} atualizados`);
      }
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (f: File | undefined) => {
    if (!f) return;
    setFile(f); setPreview(null); setResult(null); setMapping({});
    run(f, true);
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setMapping({}); };

  return (
    <div className="animate-fade-in max-w-5xl">
      <PageHeader title="Importar planilha patrimonial" subtitle="CSV ou XLSX exportado do sistema patrimonial. Sem integração direta — o arquivo é lido, validado e só grava depois da sua confirmação." />

      {result ? (
        <div className="card-clay p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
          <h2 className="font-display text-2xl font-bold mt-3">Importação concluída</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 text-left">
            <StatTile tone="ok" label="Novos" value={result.created} />
            <StatTile tone="info" label="Atualizados" value={result.updated} />
            <StatTile label="Sem mudança" value={result.unchanged} />
            <StatTile tone={result.errors.length ? 'danger' : 'ok'} label="Linhas com erro" value={result.errors.length} />
          </div>
          {result.createdUnits.length > 0 && <p className="text-sm mt-4">Unidades criadas automaticamente: <strong>{result.createdUnits.map(u => u.name).join(', ')}</strong></p>}
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
            <Button asChild><Link to="/bens">Ver bens</Link></Button>
            <Button asChild variant="urucum"><Link to="/inventarios">Abrir inventário</Link></Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-[1fr_280px] gap-4">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}
              className={cn('card-clay motif-field border-2 border-dashed p-8 text-center transition-colors', drag ? 'border-urucum bg-urucum/5' : 'border-primary/30 hover:border-primary')}
            >
              {busy && !preview ? <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" /> : <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />}
              <div className="font-display text-lg font-bold mt-3">{file ? file.name : 'Arraste a planilha aqui ou toque para escolher'}</div>
              <div className="text-sm text-muted-foreground mt-1">CSV (separado por ; ou ,) ou XLSX · até 15 MB</div>
              <input ref={input} type="file" accept=".csv,.xlsx,.txt" hidden onChange={e => choose(e.target.files?.[0])} />
            </button>
            <div className="card-clay p-4 space-y-3">
              <Field label="Unidade padrão" hint="Usada nas linhas sem coluna de unidade. Unidades novas citadas na planilha são criadas automaticamente.">
                <NativeSelect value={defaultUnit} onChange={e => setDefaultUnit(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </NativeSelect>
              </Field>
              <p className="text-xs text-muted-foreground">Exemplos sintéticos para testar estão em <code>assethub-backend/sample-data/</code>.</p>
            </div>
          </div>

          {preview && file && (
            <div className="space-y-4 mt-4">
              <section className="card-clay p-5">
                <h2 className="font-display font-bold flex items-center gap-2"><Wand2 className="h-4 w-4 text-urucum" /> Colunas reconhecidas</h2>
                <p className="text-xs text-muted-foreground">Detectamos as colunas pelo nome. Corrija se necessário.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {FIELDS.map(f => (
                    <Field key={f} label={`${FIELD_LABEL[f]}${REQUIRED.includes(f) ? ' *' : ''}`}>
                      <NativeSelect value={mapping[f] || ''} onChange={e => setMapping({ ...mapping, [f]: e.target.value })} className={cn(mapping[f] && 'border-success/60 bg-success/5')}>
                        <option value="">— não importar —</option>
                        {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </NativeSelect>
                    </Field>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run(file, true, mapping)}>{busy && <Loader2 className="animate-spin" />} Recalcular prévia</Button>
                </div>
              </section>

              {preview.missingRequired.length > 0 ? (
                <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive font-semibold flex gap-2"><AlertTriangle className="h-5 w-5" /> Indique as colunas de {preview.missingRequired.map(f => FIELD_LABEL[f]).join(' e ')}.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile tone="ok" icon={Sparkles} label="Bens novos" value={preview.created} />
                    <StatTile tone="info" label="Serão atualizados" value={preview.updated} />
                    <StatTile label="Sem mudança" value={preview.unchanged} />
                    <StatTile tone={preview.errors.length ? 'danger' : 'ok'} label="Linhas com erro" value={preview.errors.length} hint={`${preview.totalRows} linhas no arquivo`} />
                  </div>
                  {preview.createdUnits.length > 0 && <div className="rounded-2xl bg-info/10 p-3 text-sm">Serão criadas as unidades: <strong>{preview.createdUnits.map(u => u.name).join(', ')}</strong></div>}

                  <section className="card-clay overflow-hidden">
                    <h2 className="font-display font-bold px-5 pt-4">Amostra</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm mt-3">
                        <thead className="bg-muted/60 text-[11px] uppercase text-muted-foreground"><tr>{['Linha', 'Tombamento', 'Descrição', 'Local', 'Responsável', 'Estado', ''].map(h => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
                        <tbody className="divide-y">
                          {preview.sample.map(s => (
                            <tr key={s.line}>
                              <td className="px-4 py-2 text-muted-foreground tabular">{s.line}</td>
                              <td className="px-4 py-2 font-bold text-primary">{s.code}</td>
                              <td className="px-4 py-2">{s.description}</td>
                              <td className="px-4 py-2">{s.location}</td>
                              <td className="px-4 py-2">{s.responsibleName}</td>
                              <td className="px-4 py-2"><ConservationBadge value={s.conservationStatus} /></td>
                              <td className="px-4 py-2 text-xs font-bold">{s.isNew ? <span className="text-success">novo</span> : <span className="text-info">existente</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                    <section className="card-clay p-5">
                      <h2 className="font-display font-bold">Avisos por linha</h2>
                      <ul className="mt-2 text-sm max-h-56 overflow-y-auto space-y-1">
                        {preview.errors.map((e, i) => <li key={`e${i}`} className="text-destructive">Linha {e.line}{e.code ? ` (${e.code})` : ''}: {e.message}</li>)}
                        {preview.warnings.map((w, i) => <li key={`w${i}`} className="text-warning">Linha {w.line}{w.code ? ` (${w.code})` : ''}: {w.message}</li>)}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">Linhas com erro são ignoradas; as demais podem ser importadas normalmente.</p>
                    </section>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={reset}>Cancelar</Button>
                    <Button size="lg" disabled={busy || preview.created + preview.updated === 0} onClick={() => run(file, false, mapping)}>
                      {busy ? <Loader2 className="animate-spin" /> : <Upload />} Importar {preview.created + preview.updated} bem(ns)
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Importar;
