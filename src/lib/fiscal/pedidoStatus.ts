// =============================================
// PEDIDO DE VENDA — Status do Pedido de Venda (Fiscal)
//
// Fonte única de cálculo de status visual do Pedido de Venda.
//
// Após a Etapa 1-3 do plano de sincronização, a fonte de verdade
// é o campo `fiscal_invoices.pedido_status` mantido pelo gatilho
// `trg_orders_sync_pv_status` (espelha o ciclo de vida do pedido
// no módulo core). Este módulo apenas LÊ esse valor e fornece
// configuração visual.
//
// Fallback: para registros antigos sem `pedido_status` populado,
// calcula a partir de dados embutidos (compatibilidade).
//
// Status oficiais (6) — ordem de precedência:
//   1. chargeback_perdido       — pedido perdeu disputa (terminal)
//   2. cancelado                — cancelado/expirado/devolvido/NF cancelada
//   3. chargeback_em_andamento  — pedido em disputa ativa
//   4. concluido                — NF autorizada derivada existe
//   5. pendente                 — falta dado fiscal obrigatório
//   6. em_aberto                — padrão (aprovado, pronto para virar NF)
// =============================================

import { CheckCircle, Clock, AlertTriangle, XCircle, FileText, AlertOctagon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PedidoStatus =
  | 'em_aberto'
  | 'pendente'
  | 'nf_criada'
  | 'concluido'
  | 'cancelado'
  | 'chargeback_em_andamento'
  | 'chargeback_perdido';

export interface PedidoStatusInfo {
  value: PedidoStatus;
  label: string;
  className: string;
  icon: LucideIcon;
}

const COLOR = {
  blue: 'bg-blue-500/15 text-blue-700 border border-blue-500/30 dark:text-blue-300',
  yellow: 'bg-yellow-500/15 text-yellow-800 border border-yellow-500/30 dark:text-yellow-300',
  green: 'bg-green-500/15 text-green-700 border border-green-500/30 dark:text-green-300',
  orange: 'bg-orange-500/15 text-orange-700 border border-orange-500/30 dark:text-orange-300',
  red: 'bg-red-500/15 text-red-700 border border-red-500/30 dark:text-red-300',
  purple: 'bg-purple-500/15 text-purple-700 border border-purple-500/30 dark:text-purple-300',
  gray: 'bg-muted text-muted-foreground border border-border',
} as const;

export const PEDIDO_STATUS_CONFIG: Record<PedidoStatus, PedidoStatusInfo> = {
  em_aberto:               { value: 'em_aberto',               label: 'Pedido em aberto',         className: COLOR.blue,   icon: FileText },
  pendente:                { value: 'pendente',                label: 'Pendente',                 className: COLOR.yellow, icon: AlertTriangle },
  nf_criada:               { value: 'nf_criada',               label: 'NF criada',                className: COLOR.purple, icon: FileText },
  concluido:               { value: 'concluido',               label: 'Concluído',                className: COLOR.green,  icon: CheckCircle },
  chargeback_em_andamento: { value: 'chargeback_em_andamento', label: 'Chargeback em andamento',  className: COLOR.orange, icon: AlertOctagon },
  chargeback_perdido:      { value: 'chargeback_perdido',      label: 'Chargeback perdido',       className: COLOR.red,    icon: AlertTriangle },
  cancelado:               { value: 'cancelado',               label: 'Cancelado',                className: COLOR.gray,   icon: XCircle },
};

export const PEDIDO_STATUS_OPTIONS = [
  { value: 'em_aberto',               label: 'Pedido em aberto' },
  { value: 'pendente',                label: 'Pendente' },
  { value: 'nf_criada',               label: 'NF criada' },
  { value: 'concluido',               label: 'Concluído' },
  { value: 'chargeback_em_andamento', label: 'Chargeback em andamento' },
  { value: 'chargeback_perdido',      label: 'Chargeback perdido' },
  { value: 'cancelado',               label: 'Cancelado' },
];

interface PedidoLike {
  id: string;
  fiscal_stage?: string | null;
  status?: string | null;
  pendencia_motivos?: unknown;
  order_status?: string | null;
  pedido_status?: string | null;
  source_order_invoice_id?: string | null;
}

/**
 * Set de IDs de Pedido de Venda que já têm pelo menos uma NF
 * autorizada derivada (filha via source_order_invoice_id).
 * Mantido apenas para o fallback legado.
 */
export function buildConcluidoSet(invoices: PedidoLike[]): Set<string> {
  const set = new Set<string>();
  for (const inv of invoices) {
    if (inv.source_order_invoice_id && inv.status === 'authorized') {
      set.add(inv.source_order_invoice_id);
    }
  }
  return set;
}

export function getPendenciaMotivos(inv: PedidoLike): string[] {
  const raw = inv.pendencia_motivos;
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  return [];
}

const VALID_STATUSES: PedidoStatus[] = [
  'em_aberto','pendente','nf_criada','concluido','cancelado','chargeback_em_andamento','chargeback_perdido',
];

export function derivePedidoStatus(inv: PedidoLike, concluidoSet: Set<string>): PedidoStatus {
  // Fonte de verdade: campo sincronizado pelo gatilho do core
  const fromDb = (inv.pedido_status ?? '').trim();
  if (fromDb && (VALID_STATUSES as string[]).includes(fromDb)) {
    // Pendência fiscal local prevalece sobre "em_aberto" (sem regredir estados terminais)
    if (fromDb === 'em_aberto' && getPendenciaMotivos(inv).length > 0) return 'pendente';
    return fromDb as PedidoStatus;
  }

  // Fallback legado (registros antigos sem pedido_status)
  const orderStatus = inv.order_status || '';
  if (orderStatus === 'chargeback_lost') return 'chargeback_perdido';
  if ([
    'cancelled','cancelled_by_user','payment_expired',
    'returning','returned','invoice_cancelled',
  ].includes(orderStatus)) return 'cancelado';
  if (orderStatus === 'chargeback_detected') return 'chargeback_em_andamento';
  if (concluidoSet.has(inv.id)) return 'concluido';
  if (getPendenciaMotivos(inv).length > 0) return 'pendente';
  return 'em_aberto';
}

/** Bloqueia ações de emissão (Criar NF, Declaração de Conteúdo). */
export function isPedidoBlockedForFiscalActions(status: PedidoStatus): boolean {
  return (
    status === 'pendente' ||
    status === 'cancelado' ||
    status === 'chargeback_em_andamento' ||
    status === 'chargeback_perdido'
  );
}

/** Helper de texto para mensagens de bloqueio. */
export function getPedidoBlockedReason(status: PedidoStatus): string | undefined {
  switch (status) {
    case 'pendente': return 'Resolva as pendências do pedido antes de emitir.';
    case 'cancelado': return 'Pedido cancelado — emissão indisponível.';
    case 'chargeback_em_andamento': return 'Pedido em chargeback — emissão indisponível.';
    case 'chargeback_perdido': return 'Chargeback perdido — emissão indisponível.';
    default: return undefined;
  }
}
