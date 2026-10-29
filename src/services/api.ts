import { http } from './http';
import type {
  Asset, AssetDetail, AuthTokens, Dashboard, Discrepancy, DiscrepancyAction, ImportReport, Inventory, InventoryCheck,
  InventoryDetail, InventorySnapshot, Meta, Movement, MovementDetail, MyArea, Paged, PossessionCheck, Unit, User, VerifyResult,
  AssetFacets, AssetRequest, AssetRequestDetail, CatalogItem,
} from '@/types';

// Um service por recurso, como no MEDagenda (src/services/*.service.ts),
// reunidos aqui porque cada um tem poucas linhas.

export const authService = {
  login: (email: string, password: string) => http.post<AuthTokens>('/auth/login', { email, password }),
  me: () => http.get<User>('/auth/me'),
  logout: () => http.post<void>('/auth/logout'),
};

export const metaService = {
  get: () => http.get<Meta>('/meta'),
  dashboard: () => http.get<Dashboard>('/dashboard'),
};

export const unitsService = {
  list: () => http.get<Unit[]>('/units'),
  create: (data: { name: string; code: string; city?: string; region?: string }) => http.post<Unit>('/units', data),
  setLocation: (id: string, geo: { lat: number; lng: number; accuracy: number | null }) => http.patch<Unit>(`/units/${id}/location`, geo),
};

export const usersService = {
  list: (params?: { role?: string; unit_id?: string }) => http.get<User[]>('/users', params),
};

// location = setor; checked = última conferência (em_dia | atrasada | nunca).
export interface AssetFilters {
  unit_id?: string;
  location?: string;
  room?: string;
  status?: string;
  category?: string;
  brand?: string;
  responsible_name?: string;
  conservation_status?: string;
  checked?: string;
  search?: string;
  page?: string;
  pageSize?: string;
}

export const assetsService = {
  list: (filters: AssetFilters) => http.get<Paged<Asset>>('/assets', filters as Record<string, string>),
  facets: (unit_id?: string, location?: string) => http.get<AssetFacets>('/assets/facets', { unit_id, location }),
  detail: (id: string) => http.get<AssetDetail>(`/assets/${id}`),
  byCode: (code: string) => http.get<AssetDetail>(`/assets/by-code/${encodeURIComponent(code)}`),
  create: (data: Record<string, unknown>) => http.post<Asset>('/assets', data),
  update: (id: string, data: Record<string, unknown>) => http.patch<Asset>(`/assets/${id}`, data),
  importFile: (file: File, opts: { mapping?: Record<string, string>; defaultUnitId?: string; dryRun: boolean }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.mapping) fd.append('mapping', JSON.stringify(opts.mapping));
    if (opts.defaultUnitId) fd.append('default_unit_id', opts.defaultUnitId);
    fd.append('dry_run', String(opts.dryRun));
    return http.post<ImportReport>('/assets/import', fd);
  },
};

export const inventoriesService = {
  list: (params?: { status?: string; unit_id?: string }) => http.get<Inventory[]>('/inventories', params),
  detail: (id: string) => http.get<InventoryDetail>(`/inventories/${id}`),
  checks: (id: string) => http.get<InventoryCheck[]>(`/inventories/${id}/checks`),
  snapshot: (id: string) => http.get<InventorySnapshot>(`/inventories/${id}/snapshot`),
  create: (data: { unit_id: string; name?: string; locations?: string[] }) => http.post<Inventory>('/inventories', data),
  complete: (id: string) => http.post<Inventory>(`/inventories/${id}/complete`),
};

export interface DiscrepancyFilters {
  inventory_id?: string; unit_id?: string; location?: string; status?: string; type?: string; source?: string;
}

export interface MovementFilters {
  status?: string; scope?: string; type?: string; unit_id?: string; location?: string; person_id?: string; from?: string; to?: string;
}

export const discrepanciesService = {
  list: (params: DiscrepancyFilters) => http.get<Discrepancy[]>('/discrepancies', params as Record<string, string>),
  resolve: (id: string, body: { action: DiscrepancyAction; note?: string; data?: Record<string, string> }) => http.post<Discrepancy>(`/discrepancies/${id}/resolve`, body),
  bulkResolve: (body: { ids: string[]; action: DiscrepancyAction; note?: string }) =>
    http.post<{ resolved: number; failed: { id: string; message: string }[] }>('/discrepancies/bulk-resolve', body),
};

export const movementsService = {
  list: (params?: MovementFilters) => http.get<Movement[]>('/movements', params as Record<string, string>),
  detail: (id: string) => http.get<MovementDetail>(`/movements/${id}`),
  create: (data: Record<string, unknown>) => http.post<Movement>('/movements', data),
  decide: (id: string, decision: 'aprovada' | 'rejeitada', note: string) => http.post<Movement>(`/movements/${id}/approval`, { decision, note }),
  deliver: (id: string, body: Record<string, unknown>) => http.post<Movement>(`/movements/${id}/delivery`, body),
  receive: (id: string, body: Record<string, unknown>) => http.post<Movement>(`/movements/${id}/receipt`, body),
  resolveIssue: (id: string, outcome: 'concluir' | 'desfazer', note: string) => http.post<Movement>(`/movements/${id}/resolve-issue`, { outcome, note }),
  cancel: (id: string, note: string) => http.post<Movement>(`/movements/${id}/cancel`, { note }),
  verify: (id: string, h?: string) => http.get<VerifyResult>(`/public/movements/${id}/verify`, { h }),
};

export const meService = {
  area: () => http.get<MyArea>('/me/area'),
  answer: (checkId: string, answers: { asset_id: string; has_it: boolean; note?: string }[]) =>
    http.post<PossessionCheck>(`/me/possession-checks/${checkId}/answer`, { answers }),
};

export const possessionService = {
  list: () => http.get<PossessionCheck[]>('/possession-checks'),
  request: (userIds: string[]) =>
    http.post<{ created: PossessionCheck[]; skipped: { name: string; reason: string }[] }>('/possession-checks', { user_ids: userIds }),
};

export const requestsService = {
  catalog: () => http.get<CatalogItem[]>('/requests/catalog'),
  list: (params?: { status?: string; unit_id?: string; urgency?: string; mine?: string }) => http.get<(AssetRequest & { unitName: string })[]>('/requests', params),
  detail: (id: string) => http.get<AssetRequestDetail>(`/requests/${id}`),
  create: (data: Record<string, unknown>) => http.post<AssetRequest>('/requests', data),
  suggestions: (id: string) => http.get<(Asset & { unitName: string })[]>(`/requests/${id}/suggestions`),
  fulfill: (id: string, body: { asset_ids: string[]; deliverer_id?: string; note?: string }) => http.post<AssetRequest>(`/requests/${id}/fulfill`, body),
  purchase: (id: string, purchase_justification: string) => http.post<AssetRequest>(`/requests/${id}/purchase`, { purchase_justification }),
  reject: (id: string, reason: string) => http.post<AssetRequest>(`/requests/${id}/reject`, { reason }),
  cancel: (id: string) => http.post<AssetRequest>(`/requests/${id}/cancel`),
};
