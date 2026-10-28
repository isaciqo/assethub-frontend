// Espelha os formatters do backend (src/lib/formatters.js).

export type Role = 'admin' | 'gestor' | 'conferente';
export type Conservation = 'novo' | 'bom' | 'regular' | 'ruim' | 'inservivel';
export type AssetStatus = 'ativo' | 'em_movimentacao' | 'nao_localizado' | 'baixado';
export type CheckStatus = 'ok' | 'divergente' | 'outra_unidade' | 'nao_cadastrado' | 'duplicada';
export type CheckMethod = 'qr' | 'barcode' | 'ocr' | 'manual' | 'busca';
export type DiscrepancyType =
  | 'nao_localizado' | 'localizacao_divergente' | 'outra_unidade' | 'nao_cadastrado'
  | 'conferencia_duplicada' | 'estado_alterado' | 'responsavel_divergente';
export type DiscrepancyAction =
  | 'marcar_nao_localizado' | 'localizado_depois' | 'descartar' | 'atualizar_cadastro' | 'manter_cadastro'
  | 'abrir_movimentacao' | 'cadastrar_bem' | 'manter_primeira' | 'usar_esta';
export type MovementStatus =
  | 'aguardando_aprovacao' | 'aprovada' | 'em_transito' | 'com_pendencia' | 'concluida' | 'rejeitada' | 'cancelada';
export type MovementAction = 'approve' | 'deliver' | 'receive' | 'resolve_issue' | 'cancel';

export interface ApiError {
  message: string;
  statusCode: number;
  offline?: boolean;
}

export interface AuthTokens { accessToken: string; refreshToken?: string }

export interface Unit {
  id: string;
  name: string;
  code: string;
  city: string;
  region: 'capital' | 'interior';
  locations: string[];
  assetCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  registration: string;
  unitId: string | null;
  unit?: Unit | null;
}

export interface Asset {
  id: string;
  code: string;
  codeNormalized: string;
  description: string;
  category: string;
  brand: string;
  serialNumber: string;
  unitId: string;
  location: string;
  responsibleName: string;
  conservationStatus: Conservation;
  status: AssetStatus;
  acquisitionDate: string | null;
  value: number | null;
  notes: string;
  lastCheckedAt: string | null;
  lastInventoryId: string | null;
  activeMovementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetEvent {
  id: string;
  assetId: string;
  type: string;
  summary: string;
  performedByName: string;
  referenceType: string | null;
  referenceId: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  occurredAt: string;
}

export interface InventoryCheck {
  id: string;
  operationId: string;
  inventoryId: string;
  assetId: string | null;
  assetCode: string;
  assetDescription?: string;
  observedLocation: string;
  observedCondition: Conservation;
  observedResponsible: string;
  notes: string;
  photoEvidenceId: string | null;
  status: CheckStatus;
  isPrimary: boolean;
  method: CheckMethod;
  elapsedMs: number | null;
  checkedByName: string;
  checkedAt: string;
  wasOffline: boolean;
}

export interface AssetDetail {
  asset: Asset;
  unit: Unit | null;
  events: AssetEvent[];
  checks: InventoryCheck[];
  movements: Movement[];
}

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }

export interface InventorySummary {
  expected: number;
  checked: number;
  remaining: number;
  progress: number;
  ok: number;
  divergent: number;
  otherUnit: number;
  notRegistered: number;
  duplicates: number;
  notFound: number;
  openDiscrepancies: number;
  totalChecks: number;
  offline: number;
  avgSeconds: number | null;
  firstCheckAt: string | null;
  lastCheckAt: string | null;
  byLocation?: { location: string; expected: number; checked: number }[];
  byMethod?: Partial<Record<CheckMethod, number>>;
}

export interface Inventory {
  id: string;
  number: string;
  name: string;
  unitId: string;
  locations: string[];
  status: 'em_andamento' | 'concluido' | 'cancelado';
  expectedCount: number;
  startedAt: string;
  completedAt: string | null;
  summary?: InventorySummary;
}

export interface InventoryDetail extends Inventory {
  unit: Unit;
  recentChecks: InventoryCheck[];
  team: { userId: string; name: string; count: number }[];
}

export interface SnapshotAsset {
  id: string;
  code: string;
  codeNormalized: string;
  description: string;
  category: string;
  brand: string;
  serialNumber: string;
  location: string;
  responsibleName: string;
  conservationStatus: Conservation;
}

export interface InventorySnapshot {
  inventory: Inventory;
  unit: Unit;
  assets: SnapshotAsset[];
  serverChecks: { assetId: string; status: CheckStatus; checkedByName: string; checkedAt: string; operationId: string }[];
  generatedAt: string;
}

export interface Discrepancy {
  id: string;
  inventoryId: string;
  inventoryNumber: string;
  unitId: string;
  assetId: string | null;
  assetCode: string;
  checkId: string | null;
  type: DiscrepancyType;
  expected: Record<string, any> | null;
  observed: Record<string, any> | null;
  status: 'aberta' | 'resolvida';
  resolution: { action: DiscrepancyAction; note: string; resolvedByName: string; resolvedAt: string; movementId: string | null } | null;
  asset: Asset | null;
  photoEvidenceId: string | null;
  checkedByName: string;
  checkNotes: string;
  createdAt: string;
}

export interface Place { unitId: string; location: string; responsibleName: string }

export interface Handover {
  at: string;
  by: string;
  byName: string;
  conditions: { assetId: string; condition: Conservation }[];
  notes: string;
  signatureEvidenceId: string | null;
  signerName: string;
  photoEvidenceIds: string[];
  hasIssue: boolean;
  issueDescription: string;
}

export interface Movement {
  id: string;
  number: string;
  type: string;
  typeLabel?: string;
  reason: string;
  assetIds: string[];
  origin: Place;
  destination: Place;
  requestedBy: string;
  approvals: { userId: string; status: 'pendente' | 'aprovada' | 'rejeitada'; note: string; decidedAt: string | null }[];
  delivererId: string;
  receiverId: string;
  carrier: { company: string; driverName: string; driverDocument: string; vehiclePlate: string };
  expectedDate: string | null;
  delivery: Handover | null;
  receipt: Handover | null;
  issueResolution: { note: string; resolvedAt: string } | null;
  status: MovementStatus;
  chainHead: string | null;
  sourceDiscrepancyId: string | null;
  createdAt: string;
  completedAt: string | null;
  assetsPreview?: { code: string; description: string }[];
  waitingOn?: string[];
  waitingOnMe?: boolean;
}

export interface MovementEvent {
  id: string;
  seq: number;
  type: string;
  summary: string;
  performedByName: string;
  actedAs: string;
  details: any;
  occurredAt: string;
  prevHash: string | null;
  hash: string;
}

export interface Evidence {
  id: string;
  stage: string;
  kind: 'foto' | 'assinatura' | 'documento';
  mime: string;
  size: number;
  sha256: string;
  description: string;
  createdByName: string;
  createdAt: string;
}

export interface MovementDetail {
  movement: Movement;
  assets: Asset[];
  units: Record<string, Unit>;
  users: Record<string, User>;
  events: MovementEvent[];
  evidences: Evidence[];
  chain: { valid: boolean; brokenAt: number | null; head: string | null };
  actions: MovementAction[];
  waitingOn: string[];
}

export interface MovementType { id: string; label: string; minApprovals: number; requiresCarrier: boolean }

export interface Meta {
  movementTypes: MovementType[];
  discrepancyActions: Record<DiscrepancyType, DiscrepancyAction[]>;
}

export interface ImportReport {
  fileName: string;
  headers: string[];
  mapping: Record<string, string>;
  totalRows: number;
  missingRequired: string[];
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  errors: { line: number; code?: string; message: string }[];
  warnings: { line: number; code?: string; message: string }[];
  createdUnits: Unit[];
  sample: { line: number; code: string; description: string; location: string; responsibleName: string; conservationStatus: Conservation; isNew: boolean }[];
}

export interface Dashboard {
  totals: { assets: number; units: number; openInventories: number; openDiscrepancies: number; movementsInProgress: number };
  assetsByStatus: Partial<Record<AssetStatus, number>>;
  assetsByCondition: Partial<Record<Conservation, number>>;
  discrepanciesByType: Partial<Record<DiscrepancyType, number>>;
  movementsByStatus: Partial<Record<MovementStatus, number>>;
  productivity: { totalChecks: number; offlineChecks: number; avgSecondsPerAsset: number | null; byMethod: Partial<Record<CheckMethod, number>> };
  coverage: { unitId: string; name: string; code: string; region: 'capital' | 'interior'; assets: number; checked: number; pct: number }[];
  equity: { capital: number; interior: number };
  inventories: Inventory[];
  recentActivity: AssetEvent[];
}

export interface VerifyResult {
  number: string;
  type: string;
  status: MovementStatus;
  originUnit: string;
  destinationUnit: string;
  assetCount: number;
  eventCount: number;
  createdAt: string;
  completedAt: string | null;
  chainValid: boolean;
  chainHead: string | null;
  hashMatches: boolean | null;
}
