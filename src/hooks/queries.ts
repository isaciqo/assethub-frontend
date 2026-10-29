import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  assetsService, discrepanciesService, inventoriesService, meService, metaService, movementsService, possessionService, requestsService,
  unitsService, usersService, type AssetFilters, type DiscrepancyFilters, type MovementFilters,
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

export const useDiscrepancies = (params: DiscrepancyFilters) =>
  useQuery({ queryKey: ['discrepancies', params], queryFn: () => discrepanciesService.list(params) });

export const useMovements = (params?: MovementFilters) =>
  useQuery({ queryKey: ['movements', params], queryFn: () => movementsService.list(params) });

export const useMovement = (id?: string) =>
  useQuery({ queryKey: ['movement', id], queryFn: () => movementsService.detail(id!), enabled: !!id });

export const useAssets = (filters: AssetFilters) =>
  useQuery({ queryKey: ['assets', filters], queryFn: () => assetsService.list(filters), placeholderData: keepPreviousData });

export const useAssetDetail = (id?: string | null) =>
  useQuery({ queryKey: ['asset', id], queryFn: () => assetsService.detail(id!), enabled: !!id });

export const useFacets = (unitId?: string, location?: string) =>
  useQuery({ queryKey: ['facets', unitId, location], queryFn: () => assetsService.facets(unitId, location || undefined), ...STABLE });

export const useMyArea = () => useQuery({ queryKey: ['me-area'], queryFn: meService.area, refetchInterval: 20_000 });
export const usePossessionChecks = () => useQuery({ queryKey: ['possession-checks'], queryFn: possessionService.list, refetchInterval: 30_000 });

export const useRequests = (params?: { status?: string; unit_id?: string; urgency?: string; mine?: string }) =>
  useQuery({ queryKey: ['requests', params], queryFn: () => requestsService.list(params), refetchInterval: 30_000 });
export const useRequest = (id?: string) =>
  useQuery({ queryKey: ['request', id], queryFn: () => requestsService.detail(id!), enabled: !!id });
export const useRequestSuggestions = (id?: string, enabled = true) =>
  useQuery({ queryKey: ['request-suggestions', id], queryFn: () => requestsService.suggestions(id!), enabled: !!id && enabled });
export const useCatalog = () => useQuery({ queryKey: ['request-catalog'], queryFn: requestsService.catalog, staleTime: Infinity });
