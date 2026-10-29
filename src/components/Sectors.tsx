import React from 'react';
import { SECTOR_KIND, SECTOR_KIND_ORDER } from '@/lib/labels';
import type { Sector, SectorKind, Unit } from '@/types';

// Estrutura do Tribunal: Comarca → Setor (vara, gabinete, secretaria…) → Sala.

export const sectorsOf = (unit?: Unit | null): Sector[] =>
  unit?.sectors || (unit?.locations || []).map(name => ({ name, kind: 'outro' as SectorKind }));

export function groupSectors<T extends { kind: SectorKind }>(sectors: T[]): { kind: SectorKind; label: string; items: T[] }[] {
  return SECTOR_KIND_ORDER
    .map(kind => ({ kind, label: SECTOR_KIND[kind].plural, items: sectors.filter(s => s.kind === kind) }))
    .filter(g => g.items.length);
}

// "Secretaria de Administração · Auditório" — setor e, se houver, a sala.
export const placeLabel = (sector?: string, room?: string, empty = 'Sem setor') =>
  [sector, room].filter(Boolean).join(' · ') || empty;

// <option>s agrupadas por tipo, para usar dentro de um <NativeSelect>.
export const SectorOptions: React.FC<{ sectors: Sector[] }> = ({ sectors }) => (
  <>
    {groupSectors(sectors).map(g => (
      <optgroup key={g.kind} label={g.label}>
        {g.items.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </optgroup>
    ))}
  </>
);
