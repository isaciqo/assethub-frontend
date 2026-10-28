// crypto.randomUUID só existe em contexto seguro (https/localhost). Abrindo o app
// pelo IP da rede local (http://192.168...) ele some — e o UUID da operação é a
// chave de idempotência da sincronização, então precisa existir sempre.
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function deviceId(): string {
  let id = localStorage.getItem('assethub_device_id');
  if (!id) {
    id = `dev-${uuid().slice(0, 8)}`;
    localStorage.setItem('assethub_device_id', id);
  }
  return id;
}

// Retorno tátil e sonoro a cada leitura — o conferente não precisa olhar a tela
// para saber se o bem foi registrado.
let audioCtx: AudioContext | null = null;
export function feedback(kind: 'ok' | 'warn' | 'error') {
  try {
    navigator.vibrate?.(kind === 'ok' ? 40 : kind === 'warn' ? [40, 60, 40] : [120, 60, 120]);
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = kind === 'ok' ? 880 : kind === 'warn' ? 520 : 220;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch {
    /* sem áudio/vibração — segue silencioso */
  }
}

// Foto comprimida no próprio aparelho: ~100 KB em vez de 4 MB. É o que torna
// viável guardar fotos na fila offline e enviá-las numa conexão fraca do interior.
export async function compressImage(file: File | Blob, maxSide = 1280, quality = 0.62): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
