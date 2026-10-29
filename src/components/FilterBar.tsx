import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface FilterChip { key: string; label: string; onRemove: () => void }

// Barra de filtros única (Bens, Movimentações, Pendências, Solicitações).
// Celular: busca + botão "Filtros (N)" que abre uma gaveta com tudo.
// Computador: os filtros principais ficam à vista; o resto, em "Mais filtros".
// Abaixo, um chip por filtro ativo (com ×) e "Limpar filtros".
export const FilterBar: React.FC<{
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  primary?: React.ReactNode;
  more?: React.ReactNode;
  chips: FilterChip[];
  onClear: () => void;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ search, primary, more, chips, onClear, summary, actions }) => {
  const [open, setOpen] = useState(false);
  // Busca com atraso: só filtra quando a pessoa para de digitar.
  const [text, setText] = useState(search?.value || '');
  useEffect(() => { setText(search?.value || ''); }, [search?.value]);
  useEffect(() => {
    if (!search || text === search.value) return undefined;
    const t = setTimeout(() => search.onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {search && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={text} onChange={e => setText(e.target.value)} placeholder={search.placeholder} className="pl-9" aria-label="Buscar" />
          </div>
        )}
        {primary && <div className="hidden md:contents">{primary}</div>}
        <Button variant="outline" onClick={() => setOpen(true)} className={cn(!more && 'md:hidden')}>
          <SlidersHorizontal />
          <span className="md:hidden">Filtros{chips.length ? ` (${chips.length})` : ''}</span>
          <span className="hidden md:inline">Mais filtros</span>
        </Button>
        {actions}
      </div>

      {(chips.length > 0 || summary) && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {summary && <span className="text-muted-foreground mr-1">{summary}</span>}
          {chips.map(c => (
            <button key={c.key} type="button" onClick={c.onRemove}
              className="inline-flex items-center gap-1 rounded-full border bg-accent px-2.5 py-0.5 text-xs font-semibold hover:border-primary"
              aria-label={`Remover filtro ${c.label}`}>
              {c.label} <X className="h-3 w-3" />
            </button>
          ))}
          {chips.length > 0 && <button type="button" onClick={onClear} className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground ml-1">Limpar filtros</button>}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-sm">
          <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4">
            {primary && <div className="space-y-4 md:hidden">{primary}</div>}
            {more}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClear}>Limpar</Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>Ver resultado</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
