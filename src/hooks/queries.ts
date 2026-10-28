import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  assetsService, discrepanciesService, inventoriesService, metaService, movementsService, unitsService, usersService,
  type AssetFilters,
} from '@/services/api';

// Dados que mudam pouco ficam "frescos" por mais tempo — e o React Query mantém
// o último valor em memória quando a conexão cai.
const STABLE = { staleTime: 5 * 60 * 1000 };

export const useUnits = () => useQuery({ queryKey: ['units'], queryFn: unitsService.list, ...STABLE });
export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: metaService.get, staleTime: Infinity });
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => usersService.list(), ...STABLE });
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: metaService.dashboard, refetchInterval: 30_000 });

export const useInventories = (params?: { status?: string; unit_id?: string }) =>
  useQuery({ queryKey: ['inventories', params], queryFn: () => inventoriesService.list(params) });

// Detalhe do inventário atualiza sozinho: com várias pessoas conferindo ao
// mesmo tempo, o gestor acompanha o avanço ao vivo.
export const useInventory = (id?: string) =>
  useQuery({ queryKey: ['inventory', id], queryFn: () => inventoriesService.detail(id!), enabled: !!id, refetchInterval: 10_000 });

export const useDiscrepancies = (params: { inventory_id?: string; status?: string; type?: string; unit_id?: string }) =>
  useQuery({ queryKey: ['discrepancies', params], queryFn: () => discrepanciesService.list(params) });

export const useMovements = (params?: { status?: string; scope?: string }) =>
  useQuery({ queryKey: ['movements', params], queryFn: () => movementsService.list(params) });

export const useMovement = (id?: string) =>
  useQuery({ queryKey: ['movement', id], queryFn: () => movementsService.detail(id!), enabled: !!id });

export const useAssets = (filters: AssetFilters) =>
  useQuery({ queryKey: ['assets', filters], queryFn: () => assetsService.list(filters), placeholderData: keepPreviousData });

export const useAssetDetail = (id?: string | null) =>
  useQuery({ queryKey: ['asset', id], queryFn: () => assetsService.detail(id!), enabled: !!id });

export const useFacets = (unitId?: string) =>
  useQuery({ queryKey: ['facets', unitId], queryFn: () => assetsService.facets(unitId), ...STABLE });
