import { useEffect, useRef, useState } from 'react';

// Localização no momento da ação (conferência, envio, recebimento). Funciona
// sem internet (é o GPS do aparelho). Nunca trava a ação: se a pessoa negar ou
// o sinal demorar, a ação segue sem localização.
export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number | null;
}

const toFix = (p: GeolocationPosition): GeoFix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null,
});

export function getPosition(timeoutMs = 6000): Promise<GeoFix | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(toFix(p)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

// Mantém a última posição enquanto a tela está aberta — na conferência cada
// leitura usa a posição mais recente sem esperar o GPS.
export function useGeoWatch(enabled = true) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [denied, setDenied] = useState(false);
  const ref = useRef<GeoFix | null>(null);

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      p => { ref.current = toFix(p); setFix(ref.current); setDenied(false); },
      err => { if (err.code === err.PERMISSION_DENIED) setDenied(true); },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix, denied, latest: ref };
}

export const mapsUrl = (g: { lat: number; lng: number }) => `https://www.google.com/maps?q=${g.lat},${g.lng}`;
