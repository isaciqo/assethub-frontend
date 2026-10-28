import React, { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Assinatura desenhada com o dedo/caneta. Exporta PNG com fundo transparente
// (data URL) — o mesmo formato que o backend guarda como evidência.
export const SignaturePad: React.FC<{ onChange: (dataUrl: string | null) => void; label?: string }> = ({ onChange, label = 'Assine dentro do quadro' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#1E2130';
  }, []);

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk.current) { hasInk.current = true; setEmpty(false); }
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChange(hasInk.current ? canvasRef.current!.toDataURL('image/png') : null);
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-2xl border-2 border-dashed border-primary/40 bg-[hsl(40_60%_98%)]">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none cursor-crosshair rounded-2xl"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          aria-label="Área de assinatura"
        />
        <div className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-[#1E2130]/30" />
        {empty && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#6b5e55]">{label}</div>}
      </div>
      <div className="flex justify-end mt-1">
        <Button type="button" variant="ghost" size="sm" onClick={clear}><Eraser /> Limpar</Button>
      </div>
    </div>
  );
};
