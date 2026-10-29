import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { CameraOff, Flashlight, Loader2, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CheckMethod } from '@/types';

// O QR das etiquetas carrega uma URL (…/b/<tombamento>) — qualquer câmera de
// celular abre a ficha do bem. Aqui extraímos só o tombamento.
export function extractCode(text: string): string {
  const t = text.trim();
  const m = /\/b\/([^/?#\s]+)/.exec(t);
  return decodeURIComponent(m ? m[1] : t);
}

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8, BarcodeFormat.ITF, BarcodeFormat.DATA_MATRIX,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

// Worker do OCR é caro de subir: um só por sessão, criado na primeira leitura.
let ocrWorker: Promise<any> | null = null;
async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_char_whitelist: '0123456789.-/', tessedit_pageseg_mode: '6' as any });
      return worker;
    })();
    ocrWorker.catch(() => { ocrWorker = null; });
  }
  return ocrWorker;
}

interface Props {
  active: boolean;
  onDetected: (code: string, method: CheckMethod) => void;
  // OCR devolve vários números candidatos; quem chama escolhe o que existe no inventário.
  pickOcrCandidate?: (candidates: string[]) => string | null;
  className?: string;
}

export const Scanner: React.FC<Props> = ({ active, onDetected, pickOcrCandidate, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  // Outra aba, câmera de foto ou app em segundo plano: a leitura para e volta
  // sozinha quando a tela reaparece.
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  const reading = active && visible;

  const emit = useCallback((code: string, method: CheckMethod) => {
    const now = Date.now();
    // Mesmo código na frente da câmera não pode virar 10 leituras por segundo.
    if (code === lastRef.current.code && now - lastRef.current.at < 2500) return;
    lastRef.current = { code, at: now };
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    onDetected(code, method);
  }, [onDetected]);

  useEffect(() => {
    if (!reading) return undefined;
    let cancelled = false;
    setError(null);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current!,
        result => {
          if (!result || cancelled) return;
          const format = result.getBarcodeFormat();
          emit(extractCode(result.getText()), format === BarcodeFormat.QR_CODE || format === BarcodeFormat.DATA_MATRIX ? 'qr' : 'barcode');
        },
      )
      .then(controls => {
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
        setTorchAvailable(!!controls.switchTorch);
      })
      .catch(err => {
        const name = err?.name || '';
        setError(
          name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
            : name === 'NotFoundError' ? 'Nenhuma câmera encontrada neste aparelho.'
              : !window.isSecureContext ? 'A câmera exige conexão segura (https ou localhost).'
                : 'Não foi possível abrir a câmera.',
        );
      });
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      setTorch(false);
    };
  }, [reading, emit]);

  const toggleTorch = async () => {
    try {
      await controlsRef.current?.switchTorch?.(!torch);
      setTorch(t => !t);
    } catch { setTorchAvailable(false); }
  };

  // Leitura da plaqueta antiga (sem QR): congela o quadro, recorta a faixa
  // central e reconhece só dígitos.
  const readPlate = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setOcrBusy(true);
    try {
      const canvas = document.createElement('canvas');
      const w = video.videoWidth;
      const h = video.videoHeight;
      const cw = w * 0.8;
      const ch = h * 0.35;
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = 'grayscale(1) contrast(1.6)';
      ctx.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
      const worker = await getOcrWorker();
      const { data } = await worker.recognize(canvas);
      const candidates = [...new Set(((data.text as string).match(/\d[\d.\-/]{2,14}\d/g) || []).map(s => s.replace(/[.\-/]/g, '')))]
        .filter(s => s.length >= 4)
        .sort((a, b) => b.length - a.length);
      const chosen = pickOcrCandidate ? pickOcrCandidate(candidates) : candidates[0];
      if (chosen) emit(chosen, 'ocr');
      else onDetected('', 'ocr');
    } catch {
      onDetected('', 'ocr');
    } finally {
      setOcrBusy(false);
    }
  };

  return (
    <div className={cn('relative overflow-hidden rounded-3xl bg-black aspect-[4/3] sm:aspect-video', className)}>
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
      {active && !error && (
        <>
          <div className="pointer-events-none absolute inset-x-[12%] top-[18%] bottom-[18%] scan-frame">
            <div className="absolute inset-x-2 top-2 h-0.5 bg-urucum/80 shadow-[0_0_12px_hsl(var(--urucum))] animate-scan-line" />
          </div>
          <div className={cn('pointer-events-none absolute inset-0 transition-colors duration-200', flash ? 'bg-success/30' : 'bg-transparent')} />
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-white/85 bg-black/45 rounded-full px-3 py-1 backdrop-blur">
              Aponte para o QR, código de barras ou plaqueta
            </span>
            <div className="flex gap-2">
              {torchAvailable && (
                <Button type="button" size="icon" variant="secondary" className="rounded-full h-11 w-11 bg-white/85" onClick={toggleTorch} aria-label={torch ? 'Desligar lanterna' : 'Ligar lanterna'}>
                  <Flashlight className={torch ? 'text-ochre' : ''} />
                </Button>
              )}
              <Button type="button" variant="secondary" className="rounded-full h-11 bg-white/90 text-foreground" onClick={readPlate} disabled={ocrBusy} aria-label="Ler número da plaqueta">
                {ocrBusy ? <Loader2 className="animate-spin" /> : <ScanText />}
                <span className="hidden sm:inline">{ocrBusy ? 'Lendo…' : 'Ler plaqueta'}</span>
              </Button>
            </div>
          </div>
        </>
      )}
      {(!active || error) && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80 motif-field" style={{ ['--motif-opacity' as string]: 0.18 }}>
          <div>
            <CameraOff className="mx-auto h-8 w-8 mb-2 opacity-80" />
            <p className="text-sm max-w-xs">{error || 'Câmera desligada'}</p>
          </div>
        </div>
      )}
    </div>
  );
};
