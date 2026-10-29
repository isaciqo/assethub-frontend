import type {
  AssetStatus, CheckMethod, CheckStatus, Conservation, DiscrepancyAction, DiscrepancyType, MovementStatus, RequestStatus, Role, SectorKind,
} from '@/types';
import type { BadgeProps } from '@/components/ui/badge';

type Variant = NonNullable<BadgeProps['variant']>;

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administração do patrimônio',
  gestor: 'Gerente de patrimônio',
  conferente: 'Conferente',
  servidor: 'Servidor(a)',
};

export const CONSERVATION: Record<Conservation, { label: string; variant: Variant }> = {
  novo: { label: 'Novo', variant: 'ok' },
  bom: { label: 'Bom', variant: 'ok' },
  regular: { label: 'Regular', variant: 'warn' },
  ruim: { label: 'Ruim', variant: 'danger' },
  inservivel: { label: 'Inservível', variant: 'danger' },
};
export const CONSERVATION_ORDER: Conservation[] = ['novo', 'bom', 'regular', 'ruim', 'inservivel'];

export const ASSET_STATUS: Record<AssetStatus, { label: string; variant: Variant }> = {
  ativo: { label: 'Ativo', variant: 'ok' },
  em_movimentacao: { label: 'Em movimentação', variant: 'info' },
  nao_localizado: { label: 'Não localizado', variant: 'danger' },
  baixado: { label: 'Baixado', variant: 'muted' },
};

export const CHECK_STATUS: Record<CheckStatus, { label: string; variant: Variant }> = {
  ok: { label: 'Conferido', variant: 'ok' },
  divergente: { label: 'Com divergência', variant: 'warn' },
  outra_unidade: { label: 'De outra comarca', variant: 'acai' },
  nao_cadastrado: { label: 'Não cadastrado', variant: 'danger' },
  duplicada: { label: 'Duplicada', variant: 'muted' },
};

export const CHECK_METHOD: Record<CheckMethod, string> = {
  qr: 'QR Code',
  barcode: 'Código de barras',
  ocr: 'Leitura da plaqueta',
  manual: 'Digitação',
  busca: 'Busca',
};

export const DISCREPANCY: Record<DiscrepancyType, { label: string; variant: Variant; hint: string }> = {
  nao_localizado: { label: 'Não localizado', variant: 'danger', hint: 'Previsto no inventário e não encontrado até o encerramento.' },
  localizacao_divergente: { label: 'Setor divergente', variant: 'warn', hint: 'Encontrado em setor diferente do cadastro.' },
  outra_unidade: { label: 'De outra comarca', variant: 'acai', hint: 'Bem cadastrado em outra comarca, encontrado aqui.' },
  nao_cadastrado: { label: 'Não cadastrado', variant: 'danger', hint: 'Código lido que não existe na base patrimonial.' },
  conferencia_duplicada: { label: 'Conferência duplicada', variant: 'muted', hint: 'O mesmo bem foi conferido mais de uma vez neste inventário.' },
  estado_alterado: { label: 'Estado alterado (avaria)', variant: 'warn', hint: 'Estado de conservação diferente do cadastro — ex.: estava bom e quebrou.' },
  responsavel_divergente: { label: 'Responsável divergente', variant: 'info', hint: 'Responsável informado em campo difere do cadastro.' },
};

export const DISCREPANCY_ACTION: Record<DiscrepancyAction, string> = {
  atualizar_cadastro: 'Atualizar cadastro',
  manter_cadastro: 'Manter cadastro',
  abrir_movimentacao: 'Regularizar com movimentação',
  marcar_nao_localizado: 'Marcar como não localizado',
  localizado_depois: 'Foi localizado depois',
  descartar: 'Descartar',
  cadastrar_bem: 'Cadastrar o bem',
  manter_primeira: 'Manter a primeira',
  usar_esta: 'Usar esta conferência',
};

export const MOVEMENT_STATUS: Record<MovementStatus, { label: string; variant: Variant }> = {
  aguardando_aprovacao: { label: 'Aguardando aprovação', variant: 'warn' },
  aprovada: { label: 'Aguardando envio', variant: 'info' },
  em_transito: { label: 'Aguardando recebimento', variant: 'info' },
  com_pendencia: { label: 'Com ocorrência', variant: 'danger' },
  concluida: { label: 'Concluída', variant: 'ok' },
  rejeitada: { label: 'Rejeitada', variant: 'danger' },
  cancelada: { label: 'Cancelada', variant: 'muted' },
};

export const ASSET_EVENT_LABEL: Record<string, string> = {
  importado: 'Importado',
  atualizado_importacao: 'Atualizado pela planilha',
  cadastrado: 'Cadastrado',
  editado: 'Ajuste no cadastro',
  baixado: 'Baixado',
  conferido: 'Conferido',
  pendencia_resolvida: 'Pendência resolvida',
  movimentacao_aberta: 'Movimentação aberta',
  movimentacao_entrega: 'Enviado',
  movimentacao_concluida: 'Movimentado',
  movimentacao_encerrada: 'Movimentação encerrada',
};

export const FIELD_LABEL: Record<string, string> = {
  code: 'Tombamento',
  description: 'Descrição',
  category: 'Categoria',
  brand: 'Marca/modelo',
  serial_number: 'Nº de série',
  unit: 'Comarca',
  unit_id: 'Comarca',
  location: 'Setor',
  room: 'Sala',
  responsible_name: 'Responsável',
  conservation_status: 'Estado de conservação',
  acquisition_date: 'Data de aquisição',
  value: 'Valor',
  notes: 'Observações',
  status: 'Situação',
};

// Tipos de setor, na ordem em que aparecem nas listas agrupadas.
export const SECTOR_KIND: Record<SectorKind, { label: string; plural: string }> = {
  vara: { label: 'Vara', plural: 'Varas' },
  gabinete: { label: 'Gabinete', plural: 'Gabinetes' },
  juizado: { label: 'Juizado', plural: 'Juizados' },
  secretaria: { label: 'Secretaria', plural: 'Secretarias' },
  coordenadoria: { label: 'Coordenadoria', plural: 'Coordenadorias e serviços' },
  almoxarifado: { label: 'Almoxarifado', plural: 'Almoxarifados' },
  outro: { label: 'Outro', plural: 'Outros setores' },
};
export const SECTOR_KIND_ORDER = Object.keys(SECTOR_KIND) as SectorKind[];

export const LAST_CHECK: Record<string, string> = {
  em_dia: 'Em dia (até 12 meses)',
  atrasada: 'Atrasada (mais de 12 meses)',
  nunca: 'Nunca conferido',
};

// Situação da solicitação na visão de quem atende (gerente) e na de quem pediu.
export const REQUEST_STATUS: Record<RequestStatus, { label: string; mine: string; variant: Variant }> = {
  aberta: { label: 'Nova', mine: 'Recebido', variant: 'warn' },
  em_analise: { label: 'Em análise', mine: 'Em análise', variant: 'info' },
  em_atendimento: { label: 'Em atendimento', mine: 'A caminho', variant: 'info' },
  atendida: { label: 'Atendida', mine: 'Entregue', variant: 'ok' },
  encaminhada_compra: { label: 'Encaminhada para compra', mine: 'Encaminhado para compra', variant: 'acai' },
  recusada: { label: 'Recusada', mine: 'Recusado', variant: 'danger' },
  cancelada: { label: 'Cancelada', mine: 'Cancelado', variant: 'muted' },
};
