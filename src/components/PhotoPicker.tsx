import React, { useRef } from 'react';
import { Camera, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressImage, fileToDataUrl } from '@/lib/device';
import { toast } from '@/components/ui/sonner';

// Foto direto da câmera do celular (capture="environment"), já comprimida.
// `allowPdf` aceita também documento anexo (nota, ofício) nas movimentações.
export const PhotoPicker: React.FC<{ value: string[]; onChange: (v: string[]) => void; max?: number; allowPdf?: boolean; label?: string }> = ({ value, onChange, max = 4, allowPdf, label = 'Adicionar foto' }) => {
  const input = useRef<HTMLInputElement>(null);

  const pick = async (files: FileList | null) => {
    if (!files) return;
    const next = [...value];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      try {
        if (f.type === 'application/pdf') {
          if (f.size > 4 * 1024 * 1024) { toast.error('PDF maior que 4 MB'); continue; }
          next.push(await fileToDataUrl(f));
        } else {
          next.push(await compressImage(f));
        }
      } catch {
        toast.error('Não foi possível ler o arquivo');
      }
    }
    onChange(next);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((src, i) => (
        <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border bg-muted">
          {src.startsWith('data:application/pdf')
            ? <div className="h-full w-full grid place-items-center text-primary"><FileText className="h-7 w-7" /></div>
            : <img src={src} alt={`Anexo ${i + 1}`} className="h-full w-full object-cover" />}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center" aria-label="Remover anexo">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {value.length < max && (
        <Button type="button" variant="outline" className="h-20 w-20 flex-col gap-1 text-xs" onClick={() => input.current?.click()}>
          <Camera className="!size-5" />
          {label}
        </Button>
      )}
      <input ref={input} type="file" accept={allowPdf ? 'image/*,application/pdf' : 'image/*'} capture={allowPdf ? undefined : 'environment'} multiple={!allowPdf} hidden onChange={e => pick(e.target.files)} />
    </div>
  );
};
