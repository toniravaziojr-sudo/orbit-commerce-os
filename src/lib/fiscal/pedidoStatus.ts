// =============================================
// PEDIDO DE VENDA — Status derivado
//
// Fonte única de cálculo de status visual do Pedido de Venda.
// Consome dados já carregados (sem queries extras) e o campo
// `pendencia_motivos` que é mantido pelo trigger SQL puro
// `trg_recompute_pedido_venda_pendencias` no banco.
//
// Status possíveis (ordem de precedência):
//   1. cancelled  — pedido de origem cancelado
//   2. chargeback — pedido em chargeback (detectado ou perdido)
//   3. concluido  — já existe NF autorizada derivada deste pedido
//   4. pendente   — pendencia_motivos.length > 0
//   5. em_aberto  — padrão (aprovado, pronto para virar NF)
// =============================================

import { CheckCircle, Clock, AlertTriangle, XCircle, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PedidoStatus = 'em_aberto' | 'pendente' | 'concluido' | 'cancelled' | 'chargeback';

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
  red: 'bg-red-500/15 text-red-700 border border-red-500/30 dark:text-red-300',
} as const;

export const PEDIDO_STATUS_CONFIG: Record<PedidoStatus, PedidoStatusInfo> = {
  em_aberto: { value: 'em_aberto', label: 'Pedido em aberto', className: COLOR.blue,   icon: FileText },
  pendente:  { value: 'pendente',  label: 'Pendente',         className: COLOR.yellow, icon: AlertTriangle },
  concluido: { value: 'concluido', label: 'Concluído',        className: COLOR.green,  icon: CheckCircle },
  cancelled: { value: 'cancelled', label: 'Cancelado',        className: COLOR.red,    icon: XCircle },
  chargeback:{ value: 'chargeback',label: 'Chargeback',       className: COLOR.red,    icon: AlertTriangle },
};

export const PEDIDO_STATUS_OPTIONS = [
  { value: 'em_aberto',  label: 'Pedido em aberto' },
  { value: 'pendente',   label: 'Pendente' },
  { value: 'concluido',  label: 'Concluído' },
  { value: 'cancelled',  label: 'Cancelado' },
  { value: 'chargeback', label: 'Chargeback' },
];

interface PedidoLike {
  id: string;
  fiscal_stage?: string | null;
  status?: string | null;
  pendencia_motivos?: unknown;
  order_status?: string | null;
  source_order_invoice_id?: string | null;
}

/**
 * Set de IDs de Pedido de Venda que já têm pelo menos uma NF
 * autorizada derivada (filha via source_order_invoice_id).
 * Calculado uma única vez sobre a lista já carregada.
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

export function derivePedidoStatus(inv: PedidoLike, concluidoSet: Set<string>): PedidoStatus {
  const orderStatus = inv.order_status || '';
  if (['cancelled', 'canceled'].includes(orderStatus)) return 'cancelled';
  if (['chargeback_detected', 'chargeback_lost'].includes(orderStatus)) return 'chargeback';
  if (concluidoSet.has(inv.id)) return 'concluido';
  if (getPendenciaMotivos(inv).length > 0) return 'pendente';
  return 'em_aberto';
}

/** Bloqueia ações de emissão (Criar NF, Declaração de Conteúdo). */
export function isPedidoBlockedForFiscalActions(status: PedidoStatus): boolean {
  return status === 'pendente' || status === 'cancelled' || status === 'chargeback';
}
