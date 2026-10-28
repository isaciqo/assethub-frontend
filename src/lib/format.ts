import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export const fmtRelative = (iso?: string | null) =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }) : '—';

export const fmtNumber = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('pt-BR'));

export const fmtMoney = (n?: number | null) =>
  n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const initials = (name?: string) =>
  (name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// Mesma regra do backend (src/lib/text.js → normalizeCode): sem pontuação,
// sem espaços e sem zeros à esquerda — "001.234" e "1234" são o mesmo bem.
export const normalizeCode = (code: string) =>
  String(code ?? '').trim().toUpperCase().replace(/[\s.\-/]/g, '').replace(/^0+(?=.)/, '');

export const normalizeText = (v: string) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
