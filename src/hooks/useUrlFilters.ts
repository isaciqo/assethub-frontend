import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

// Filtros guardados na URL (?comarca=…&setor=…): sobrevivem ao recarregar e o
// link filtrado pode ser mandado para outra pessoa. Mudar um filtro volta para
// a página 1; `resets` limpa filtros que dependem dele (ex.: setor depende da comarca).
export function useUrlFilters<K extends string>(keys: readonly K[], resets: Partial<Record<K, K[]>> = {}) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(
    () => Object.fromEntries(keys.map(k => [k, params.get(k) || ''])) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, keys.join()],
  );

  const set = useCallback((key: K, value: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      (resets[key] || []).forEach(k => next.delete(k));
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams, resets]);

  const clear = useCallback(() => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      keys.forEach(k => next.delete(k));
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams, keys]);

  const page = Number(params.get('page')) || 1;
  const setPage = useCallback((n: number) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (n > 1) next.set('page', String(n)); else next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  const activeCount = keys.filter(k => values[k]).length;
  return { values, set, clear, page, setPage, activeCount };
}
